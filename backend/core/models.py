"""Database models for OIPay MVP.

Implements:
- Room: has an auto-generated short invite code.
- Member: belongs to exactly one room (MVP requirement).
- Expense + ExpenseSplit: store integer cents only.
"""

import secrets
import string
import uuid

from django.db import models


INVITE_CODE_ALPHABET = string.ascii_uppercase + string.digits


def generate_invite_code(length: int = 6) -> str:
    # Short, URL-safe-ish code; uppercase/digits keeps it easy to type.
    return ''.join(secrets.choice(INVITE_CODE_ALPHABET) for _ in range(length))


def generate_member_token() -> str:
    # Used as a lightweight room credential for MVP (header-based).
    return secrets.token_hex(24)


class Room(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=120)
    invite_code = models.CharField(max_length=12, unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.invite_code:
            # Generate until unique. Small collision chance; DB unique constraint is final guard.
            for _ in range(10):
                candidate = generate_invite_code()
                if not Room.objects.filter(invite_code=candidate).exists():
                    self.invite_code = candidate
                    break
            if not self.invite_code:
                # Extremely unlikely fallback
                self.invite_code = generate_invite_code(10)
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"Room({self.name})"


class Member(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='members')
    display_name = models.CharField(max_length=80)
    access_token = models.CharField(max_length=64, db_index=True, default=generate_member_token, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"Member({self.display_name})"


class Expense(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='expenses')
    payer_member = models.ForeignKey(Member, on_delete=models.PROTECT, related_name='paid_expenses')
    amount_cents = models.PositiveIntegerField()
    description = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                check=models.Q(amount_cents__gt=0),
                name='expense_amount_positive',
            )
        ]

    def __str__(self) -> str:
        return f"Expense({self.description}, {self.amount_cents})"


class ExpenseSplit(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    expense = models.ForeignKey(Expense, on_delete=models.CASCADE, related_name='splits')
    member = models.ForeignKey(Member, on_delete=models.CASCADE, related_name='splits')
    share_cents = models.PositiveIntegerField()

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['expense', 'member'], name='unique_expense_member_split'),
            models.CheckConstraint(
                check=models.Q(share_cents__gt=0),
                name='expense_split_share_positive',
            ),
        ]

    def __str__(self) -> str:
        return f"Split({self.member_id}, {self.share_cents})"
