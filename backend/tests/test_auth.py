import json


def register(client, name="Test User", email="test@example.com", password="password123"):
    return client.post("/api/auth/register", json={"name": name, "email": email, "password": password})


def test_register_success(client):
    res = register(client)
    assert res.status_code == 201
    data = json.loads(res.data)
    assert "token" in data
    assert data["user"]["email"] == "test@example.com"


def test_register_duplicate_email(client):
    register(client, email="dup@example.com")
    res = register(client, email="dup@example.com")
    assert res.status_code == 409


def test_login_success(client):
    register(client, email="login@example.com")
    res = client.post("/api/auth/login", json={"email": "login@example.com", "password": "password123"})
    assert res.status_code == 200
    assert "token" in json.loads(res.data)


def test_login_wrong_password(client):
    register(client, email="wrong@example.com")
    res = client.post("/api/auth/login", json={"email": "wrong@example.com", "password": "badpass"})
    assert res.status_code == 401


def test_protected_route_without_token(client):
    res = client.post("/api/rides", json={})
    assert res.status_code == 401
