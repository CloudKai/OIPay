"""DRF API views.

Each class corresponds to one endpoint (create/join room, list/create expenses,
compute balances + simplified settlements).
"""

from __future__ import annotations

from uuid import UUID

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Member, Room
from .serializers import (
    ExpenseCreateSerializer,
    ExpenseListSerializer,
    MemberSerializer,
    RoomCreateSerializer,
    RoomDetailSerializer,
    RoomJoinSerializer,
    RoomSerializer,
)
from .services.balances import compute_member_balances, simplify_settlements


def require_room_member(request, room: Room) -> Member:
    member_id_raw = request.headers.get('X-Member-Id')
    member_token = request.headers.get('X-Member-Token')
    if not member_id_raw or not member_token:
        raise PermissionDenied('Missing room credentials. Please join the room again.')

    try:
        member_id = UUID(member_id_raw)
    except ValueError as exc:
        raise PermissionDenied('Invalid room credentials.') from exc

    member = room.members.filter(id=member_id, access_token=member_token).first()
    if not member:
        raise PermissionDenied('Invalid room credentials.')
    return member


class RoomCreateAPIView(APIView):
    def post(self, request):
        serializer = RoomCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        room = serializer.save()
        return Response(RoomSerializer(room).data, status=status.HTTP_201_CREATED)


class RoomJoinAPIView(APIView):
    def post(self, request):
        serializer = RoomJoinSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = serializer.save()
        return Response(
            {
                'room': RoomSerializer(result['room']).data,
                'member': MemberSerializer(result['member']).data,
                'member_token': result['member'].access_token,
            },
            status=status.HTTP_201_CREATED,
        )


class RoomDetailAPIView(APIView):
    def get(self, request, room_id):
        room = get_object_or_404(Room.objects.prefetch_related('members'), id=room_id)
        require_room_member(request, room)
        return Response(RoomDetailSerializer(room).data)


class RoomExpenseListCreateAPIView(APIView):
    def get(self, request, room_id):
        room = get_object_or_404(Room, id=room_id)
        require_room_member(request, room)
        expenses = room.expenses.prefetch_related('splits').order_by('created_at')
        return Response(ExpenseListSerializer(expenses, many=True).data)

    def post(self, request, room_id):
        room = get_object_or_404(Room, id=room_id)
        member = require_room_member(request, room)
        serializer = ExpenseCreateSerializer(data=request.data, context={'room': room, 'acting_member': member})
        serializer.is_valid(raise_exception=True)
        expense = serializer.save()
        return Response(ExpenseListSerializer(expense).data, status=status.HTTP_201_CREATED)


class RoomBalancesAPIView(APIView):
    def get(self, request, room_id):
        room = get_object_or_404(Room, id=room_id)
        require_room_member(request, room)
        balances = compute_member_balances(room)
        settlements = simplify_settlements(balances)

        return Response(
            {
                'room_id': str(room.id),
                'balances': [
                    {
                        'member_id': b.member_id,
                        'paid_cents': b.paid_cents,
                        'owed_cents': b.owed_cents,
                        'net_cents': b.net_cents,
                    }
                    for b in balances
                ],
                'settlements': settlements,
            }
        )
