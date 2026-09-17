from fastapi.testclient import TestClient


def test_register_and_login(client: TestClient):
    register_response = client.post(
        "/api/auth/register",
        json={"email": "admin@example.com", "password": "strongpass123"},
    )
    assert register_response.status_code == 201
    register_data = register_response.json()
    assert register_data["access_token"]
    assert register_data["token_type"] == "bearer"

    duplicate_response = client.post(
        "/api/auth/register",
        json={"email": "admin@example.com", "password": "strongpass123"},
    )
    assert duplicate_response.status_code == 409

    login_response = client.post(
        "/api/auth/login",
        json={"email": "admin@example.com", "password": "strongpass123"},
    )
    assert login_response.status_code == 200
    assert login_response.json()["access_token"]


def test_me_requires_and_accepts_token(client: TestClient):
    register_response = client.post(
        "/api/auth/register",
        json={"email": "owner@example.com", "password": "strongpass123"},
    )
    token = register_response.json()["access_token"]

    unauthorized = client.get("/api/auth/me")
    assert unauthorized.status_code == 401

    authorized = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert authorized.status_code == 200
    assert authorized.json()["email"] == "owner@example.com"
