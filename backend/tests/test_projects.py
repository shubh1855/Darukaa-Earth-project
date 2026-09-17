from conftest import register_and_get_token
from fastapi.testclient import TestClient


def test_create_and_list_projects(client: TestClient):
    token = register_and_get_token(client, "owner@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    create_response = client.post(
        "/api/projects",
        json={"name": "Mangrove Revival", "description": "Coastal restoration and carbon sink"},
        headers=headers,
    )
    assert create_response.status_code == 201
    created = create_response.json()
    assert created["name"] == "Mangrove Revival"

    list_response = client.get("/api/projects", headers=headers)
    assert list_response.status_code == 200
    projects = list_response.json()
    assert len(projects) == 1
    assert projects[0]["name"] == "Mangrove Revival"


def test_projects_are_isolated_per_user(client: TestClient):
    owner_token = register_and_get_token(client, "owner-a@example.com")
    other_token = register_and_get_token(client, "owner-b@example.com")

    owner_headers = {"Authorization": f"Bearer {owner_token}"}
    other_headers = {"Authorization": f"Bearer {other_token}"}

    create_response = client.post(
        "/api/projects",
        json={"name": "Private Project"},
        headers=owner_headers,
    )
    assert create_response.status_code == 201

    owner_list = client.get("/api/projects", headers=owner_headers)
    other_list = client.get("/api/projects", headers=other_headers)

    assert len(owner_list.json()) == 1
    assert owner_list.json()[0]["name"] == "Private Project"
    assert other_list.json() == []


def test_projects_requires_authentication(client: TestClient):
    response = client.get("/api/projects")
    assert response.status_code == 401
