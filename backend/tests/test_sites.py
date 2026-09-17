from conftest import register_and_get_token
from fastapi.testclient import TestClient


def _create_project(client: TestClient, headers: dict[str, str], name: str = "Mangrove") -> int:
    response = client.post(
        "/api/projects",
        json={"name": name, "description": "Project for site tests"},
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()["id"]


def _polygon():
    return {
        "type": "Polygon",
        "coordinates": [
            [
                [0.0, 0.0],
                [1.0, 0.0],
                [1.0, 1.0],
                [0.0, 1.0],
                [0.0, 0.0],
            ]
        ],
    }


def test_create_list_and_get_site(client: TestClient):
    token = register_and_get_token(client, "site-owner@example.com")
    headers = {"Authorization": f"Bearer {token}"}
    project_id = _create_project(client, headers)

    create_response = client.post(
        f"/api/projects/{project_id}/sites",
        json={"geometry": _polygon()},
        headers=headers,
    )
    assert create_response.status_code == 201
    created = create_response.json()
    assert created["project_id"] == project_id
    assert created["geometry"]["type"] == "Polygon"
    assert created["area_hectares"] == 12364.0

    list_response = client.get(f"/api/projects/{project_id}/sites", headers=headers)
    assert list_response.status_code == 200
    listed = list_response.json()
    assert len(listed) == 1
    assert listed[0]["id"] == created["id"]

    detail_response = client.get(f"/api/sites/{created['id']}", headers=headers)
    assert detail_response.status_code == 200
    detail = detail_response.json()
    assert detail["id"] == created["id"]
    assert detail["geometry"] == _polygon()


def test_site_access_isolated_by_project_owner(client: TestClient):
    owner_token = register_and_get_token(client, "owner-one@example.com")
    other_token = register_and_get_token(client, "owner-two@example.com")

    owner_headers = {"Authorization": f"Bearer {owner_token}"}
    other_headers = {"Authorization": f"Bearer {other_token}"}

    project_id = _create_project(client, owner_headers)

    create_site = client.post(
        f"/api/projects/{project_id}/sites",
        json={"geometry": _polygon()},
        headers=owner_headers,
    )
    assert create_site.status_code == 201
    site_id = create_site.json()["id"]

    assert client.get(f"/api/projects/{project_id}/sites", headers=other_headers).status_code == 404
    assert (
        client.post(
            f"/api/projects/{project_id}/sites",
            json={"geometry": _polygon()},
            headers=other_headers,
        ).status_code
        == 404
    )
    assert client.get(f"/api/sites/{site_id}", headers=other_headers).status_code == 404


def test_create_site_invalid_geometry_returns_422(client: TestClient):
    token = register_and_get_token(client, "invalid-geometry@example.com")
    headers = {"Authorization": f"Bearer {token}"}
    project_id = _create_project(client, headers, "Invalid Geometry")

    invalid_polygon = {
        "type": "Polygon",
        "coordinates": [
            [
                [0.0, 0.0],
                [1.0, 0.0],
                [1.0, 1.0],
                [0.0, 1.0],
            ]
        ],
    }

    response = client.post(
        f"/api/projects/{project_id}/sites",
        json={"geometry": invalid_polygon},
        headers=headers,
    )
    assert response.status_code == 422
