"""Django admin registrations.

Not needed for the API, but handy for inspecting data while developing.
"""

from django.contrib import admin

from .models import Room, Member, Expense, ExpenseSplit


@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'invite_code', 'created_at')
    search_fields = ('name', 'invite_code')


@admin.register(Member)
class MemberAdmin(admin.ModelAdmin):
    list_display = ('id', 'display_name', 'room', 'created_at')
    search_fields = ('display_name',)


class ExpenseSplitInline(admin.TabularInline):
    model = ExpenseSplit
    extra = 0


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ('id', 'room', 'payer_member', 'amount_cents', 'description', 'created_at')
    inlines = [ExpenseSplitInline]
