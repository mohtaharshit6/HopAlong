import json


def _register_and_token(client, email="rider@example.com"):
    res = client.post("/api/auth/register", json={"name": "Test", "email": email, "password": "password123"})
    return json.loads(res.data)["token"]


RIDE_PAYLOAD = {
    "start_location": "VIT Bhopal",
    "start_lat": 23.0776,
    "start_lng": 76.8514,
    "end_location": "Bhopal Railway Station",
    "end_lat": 23.2688,
    "end_lng": 77.4093,
    "date": "2026-06-01",
    "time": "08:00",
    "total_seats": 3,
    "fare": 150.0,
}


def test_create_ride(client):
    token = _register_and_token(client, "driver1@example.com")
    res = client.post("/api/rides", json=RIDE_PAYLOAD, headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 201
    data = json.loads(res.data)
    assert data["available_seats"] == 3
    assert data["status"] == "scheduled"


def test_list_rides(client):
    res = client.get("/api/rides")
    assert res.status_code == 200
    assert isinstance(json.loads(res.data), list)


def test_get_ride_not_found(client):
    res = client.get("/api/rides/nonexistent-id")
    assert res.status_code == 404


def test_ride_requires_auth(client):
    res = client.post("/api/rides", json=RIDE_PAYLOAD)
    assert res.status_code == 401
