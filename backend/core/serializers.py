"""DRF serializers (request/response validation and shape).

Important MVP behaviors live here:
- Validates payer + participant membership.
- Auto-includes payer if omitted.
- Computes equal splits with safe rounding.
"""

from __future__ import annotations

from typing import List

from django.db import transaction
from rest_framework import serializers

from .models import Expense, ExpenseSplit, Member, Room


class RoomCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120)

    def validate_name(self, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError('Room name cannot be empty')
        return cleaned

    def create(self, validated_data):
        return Room.objects.create(name=validated_data['name'])


class MemberSerializer(serializers.ModelSerializer):
    class Meta:
        model = Member
        fields = ['id', 'room', 'display_name', 'created_at']
        read_only_fields = ['id', 'room', 'created_at']


class RoomSerializer(serializers.ModelSerializer):
    class Meta:
        model = Room
        fields = ['id', 'name', 'invite_code', 'created_at']
        read_only_fields = ['id', 'invite_code', 'created_at']


class RoomDetailSerializer(serializers.ModelSerializer):
    members = MemberSerializer(many=True, read_only=True)

    class Meta:
        model = Room
        fields = ['id', 'name', 'invite_code', 'created_at', 'members']


class RoomJoinSerializer(serializers.Serializer):
    invite_code = serializers.CharField(max_length=12)
    display_name = serializers.CharField(max_length=80)

    def validate_invite_code(self, value: str) -> str:
        value = value.strip().upper()
        if not value:
            raise serializers.ValidationError('invite_code is required')
        return value

    def validate_display_name(self, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError('display_name is required')
        return cleaned

    def create(self, validated_data):
        try:
            room = Room.objects.get(invite_code=validated_data['invite_code'])
        except Room.DoesNotExist as exc:
            raise serializers.ValidationError({'invite_code': 'Invalid invite_code'}) from exc

        member = Member.objects.create(room=room, display_name=validated_data['display_name'])
        return {
            'room': room,
            'member': member,
        }


class ExpenseSplitSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpenseSplit
        fields = ['id', 'member', 'share_cents']


class ExpenseListSerializer(serializers.ModelSerializer):
    splits = ExpenseSplitSerializer(many=True, read_only=True)

    class Meta:
        model = Expense
        fields = ['id', 'room', 'payer_member', 'amount_cents', 'description', 'created_at', 'splits']


class ExpenseCreateSerializer(serializers.Serializer):
    payer_member_id = serializers.UUIDField()
    amount_cents = serializers.IntegerField(min_value=1, max_value=1_000_000_00)
    description = serializers.CharField(max_length=255)
    participant_member_ids = serializers.ListField(
        child=serializers.UUIDField(), allow_empty=False
    )

    def validate_description(self, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError('description is required')
        return cleaned

    def validate(self, attrs):
        room: Room = self.context['room']
        acting_member: Member = self.context['acting_member']

        try:
            payer = Member.objects.get(id=attrs['payer_member_id'], room=room)
        except Member.DoesNotExist as exc:
            raise serializers.ValidationError({'payer_member_id': 'Payer must belong to the room'}) from exc

        if payer.id != acting_member.id:
            raise serializers.ValidationError({'payer_member_id': 'You can only add expenses for yourself'})

        participant_ids = list(attrs['participant_member_ids'])
        if len(participant_ids) != len(set(participant_ids)):
            raise serializers.ValidationError({'participant_member_ids': 'Duplicate participants are not allowed'})

        # Auto-include payer if missing.
        if payer.id not in participant_ids:
            participant_ids.append(payer.id)

        participants = list(Member.objects.filter(room=room, id__in=participant_ids))
        if len(participants) != len(set(participant_ids)):
            raise serializers.ValidationError({'participant_member_ids': 'All participants must belong to the room'})

        attrs['payer'] = payer
        attrs['participants'] = participants
        attrs['participant_member_ids'] = participant_ids
        return attrs

    def create(self, validated_data):
        room: Room = self.context['room']
        payer: Member = validated_data['payer']
        participants: List[Member] = validated_data['participants']
        amount = int(validated_data['amount_cents'])
        description = validated_data['description']

        # Deterministic rounding distribution: sort UUIDs, give +1 cent to first remainder.
        participants_sorted = sorted(participants, key=lambda m: str(m.id))
        n = len(participants_sorted)
        base = amount // n
        remainder = amount % n
        shares = [base + (1 if idx < remainder else 0) for idx in range(n)]

        if sum(shares) != amount:
            # Should never happen, but keeps us safe.
            raise serializers.ValidationError('Split does not sum to total amount')

        with transaction.atomic():
            expense = Expense.objects.create(
                room=room,
                payer_member=payer,
                amount_cents=amount,
                description=description,
            )

            ExpenseSplit.objects.bulk_create(
                [
                    ExpenseSplit(expense=expense, member=member, share_cents=share)
                    for member, share in zip(participants_sorted, shares)
                ]
            )

        return expense
