"""API URL routes for the MVP.

Defines the endpoints requested in the spec under `/api/...`.
"""

from django.urls import path

from .views import (
    RoomCreateAPIView,
    RoomJoinAPIView,
    RoomDetailAPIView,
    RoomExpenseListCreateAPIView,
    RoomBalancesAPIView,
)

urlpatterns = [
    path('rooms/', RoomCreateAPIView.as_view(), name='room-create'),
    path('rooms/join/', RoomJoinAPIView.as_view(), name='room-join'),
    path('rooms/<uuid:room_id>/', RoomDetailAPIView.as_view(), name='room-detail'),
    path('rooms/<uuid:room_id>/expenses/', RoomExpenseListCreateAPIView.as_view(), name='room-expenses'),
    path('rooms/<uuid:room_id>/balances/', RoomBalancesAPIView.as_view(), name='room-balances'),
]
