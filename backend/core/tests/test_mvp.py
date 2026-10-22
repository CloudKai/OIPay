"""End-to-end MVP tests.

These tests hit the HTTP API and verify:
- Correct split math and net balances
- Correct simplified settlements
- Safe rounding behavior
- Validation errors for invalid participants
"""

import pytest
from rest_framework.test import APIClient

from core.models import ExpenseSplit, Member, Room


def auth_headers(member_id: str, member_token: str) -> dict:
    return {
        'HTTP_X_MEMBER_ID': member_id,
        'HTTP_X_MEMBER_TOKEN': member_token,
    }


@pytest.mark.django_db
def test_two_person_equal_split():
    client = APIClient()

    room_resp = client.post('/api/rooms/', {'name': 'Trip'}, format='json')
    assert room_resp.status_code == 201
    room_id = room_resp.data['id']
    invite_code = room_resp.data['invite_code']

    a = client.post('/api/rooms/join/', {'invite_code': invite_code, 'display_name': 'A'}, format='json')
    b = client.post('/api/rooms/join/', {'invite_code': invite_code, 'display_name': 'B'}, format='json')
    assert a.status_code == 201
    assert b.status_code == 201

    a_id = a.data['member']['id']
    a_token = a.data['member_token']
    b_id = b.data['member']['id']
    a_auth = auth_headers(a_id, a_token)

    # A pays 100 for A+B -> 50/50
    exp = client.post(
        f'/api/rooms/{room_id}/expenses/',
        {
            'payer_member_id': a_id,
            'amount_cents': 100,
            'description': 'Dinner',
            'participant_member_ids': [a_id, b_id],
        },
        format='json',
        **a_auth,
    )
    assert exp.status_code == 201

    bal = client.get(f'/api/rooms/{room_id}/balances/', **a_auth)
    assert bal.status_code == 200
    balances = {row['member_id']: row for row in bal.data['balances']}
    assert balances[a_id]['net_cents'] == 50
    assert balances[b_id]['net_cents'] == -50

    settlements = bal.data['settlements']
    assert settlements == [{'from_member_id': b_id, 'to_member_id': a_id, 'amount_cents': 50}]


@pytest.mark.django_db
def test_three_person_multiple_expenses_simplifies():
    client = APIClient()

    room = client.post('/api/rooms/', {'name': 'Trip'}, format='json').data
    invite_code = room['invite_code']
    room_id = room['id']

    a_join = client.post('/api/rooms/join/', {'invite_code': invite_code, 'display_name': 'A'}, format='json').data
    b_join = client.post('/api/rooms/join/', {'invite_code': invite_code, 'display_name': 'B'}, format='json').data
    c_join = client.post('/api/rooms/join/', {'invite_code': invite_code, 'display_name': 'C'}, format='json').data

    a = a_join['member']['id']
    b = b_join['member']['id']
    c = c_join['member']['id']
    a_auth = auth_headers(a, a_join['member_token'])
    b_auth = auth_headers(b, b_join['member_token'])

    # A pays 300 for all (100 each)
    assert client.post(
        f'/api/rooms/{room_id}/expenses/',
        {
            'payer_member_id': a,
            'amount_cents': 300,
            'description': 'Hotel',
            'participant_member_ids': [a, b, c],
        },
        format='json',
        **a_auth,
    ).status_code == 201

    # B pays 150 for B+C (75 each)
    assert client.post(
        f'/api/rooms/{room_id}/expenses/',
        {
            'payer_member_id': b,
            'amount_cents': 150,
            'description': 'Museum',
            'participant_member_ids': [b, c],
        },
        format='json',
        **b_auth,
    ).status_code == 201

    bal = client.get(f'/api/rooms/{room_id}/balances/', **a_auth)
    balances = {row['member_id']: row['net_cents'] for row in bal.data['balances']}

    # Compute expected:
    # Paid: A 300, B 150, C 0
    # Owed: A 100, B 100+75=175, C 100+75=175
    # Net: A +200, B -25, C -175
    assert balances[a] == 200
    assert balances[b] == -25
    assert balances[c] == -175

    settlements = bal.data['settlements']
    # Greedy: C->A 175, B->A 25
    assert settlements == [
        {'from_member_id': c, 'to_member_id': a, 'amount_cents': 175},
        {'from_member_id': b, 'to_member_id': a, 'amount_cents': 25},
    ]


@pytest.mark.django_db
def test_rounding_100_split_3_is_34_33_33():
    room = Room.objects.create(name='Trip')
    a = Member.objects.create(room=room, display_name='A')
    b = Member.objects.create(room=room, display_name='B')
    c = Member.objects.create(room=room, display_name='C')
    a_auth = auth_headers(str(a.id), a.access_token)

    client = APIClient()
    resp = client.post(
        f'/api/rooms/{room.id}/expenses/',
        {
            'payer_member_id': str(a.id),
            'amount_cents': 100,
            'description': 'Snack',
            'participant_member_ids': [str(a.id), str(b.id), str(c.id)],
        },
        format='json',
        **a_auth,
    )
    assert resp.status_code == 201

    splits = list(ExpenseSplit.objects.filter(expense_id=resp.data['id']).order_by('member_id'))
    shares = [s.share_cents for s in splits]
    assert sorted(shares) == [33, 33, 34]
    assert sum(shares) == 100


@pytest.mark.django_db
def test_invalid_participants_rejected():
    client = APIClient()
    room = client.post('/api/rooms/', {'name': 'Trip'}, format='json').data
    room_id = room['id']
    invite_code = room['invite_code']

    join = client.post('/api/rooms/join/', {'invite_code': invite_code, 'display_name': 'A'}, format='json').data
    member = join['member']['id']
    auth = auth_headers(member, join['member_token'])

    # Empty list must be rejected
    r = client.post(
        f'/api/rooms/{room_id}/expenses/',
        {
            'payer_member_id': member,
            'amount_cents': 100,
            'description': 'Bad',
            'participant_member_ids': [],
        },
        format='json',
        **auth,
    )
    assert r.status_code == 400

    # Participant from another room must be rejected
    room2 = client.post('/api/rooms/', {'name': 'Trip2'}, format='json').data
    invite2 = room2['invite_code']
    outsider = client.post('/api/rooms/join/', {'invite_code': invite2, 'display_name': 'X'}, format='json').data['member']['id']

    r2 = client.post(
        f'/api/rooms/{room_id}/expenses/',
        {
            'payer_member_id': member,
            'amount_cents': 100,
            'description': 'Bad2',
            'participant_member_ids': [member, outsider],
        },
        format='json',
        **auth,
    )
    assert r2.status_code == 400


@pytest.mark.django_db
def test_room_endpoints_require_valid_member_credentials():
    client = APIClient()
    room = client.post('/api/rooms/', {'name': 'Trip'}, format='json').data
    room_id = room['id']
    join = client.post('/api/rooms/join/', {'invite_code': room['invite_code'], 'display_name': 'A'}, format='json').data
    member_id = join['member']['id']

    assert client.get(f'/api/rooms/{room_id}/').status_code == 403
    assert client.get(f'/api/rooms/{room_id}/expenses/').status_code == 403
    assert client.get(f'/api/rooms/{room_id}/balances/').status_code == 403

    bad_auth = auth_headers(member_id, 'not-a-valid-token')
    assert client.get(f'/api/rooms/{room_id}/', **bad_auth).status_code == 403


@pytest.mark.django_db
def test_member_cannot_spoof_payer():
    client = APIClient()
    room_resp = client.post('/api/rooms/', {'name': 'Trip'}, format='json').data
    room_id = room_resp['id']
    invite_code = room_resp['invite_code']

    a = client.post('/api/rooms/join/', {'invite_code': invite_code, 'display_name': 'A'}, format='json').data
    b = client.post('/api/rooms/join/', {'invite_code': invite_code, 'display_name': 'B'}, format='json').data
    a_auth = auth_headers(a['member']['id'], a['member_token'])
    b_id = b['member']['id']

    resp = client.post(
        f'/api/rooms/{room_id}/expenses/',
        {
            'payer_member_id': b_id,
            'amount_cents': 1200,
            'description': 'Invalid',
            'participant_member_ids': [a['member']['id'], b_id],
        },
        format='json',
        **a_auth,
    )
    assert resp.status_code == 400
