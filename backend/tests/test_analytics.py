from datetime import date

from conftest import register_and_get_token
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.database import Base
from app.models import Site, SiteMetric
from app.seed_metrics import seed_demo_metrics


def _create_project(client: TestClient, headers: dict[str, str]) -> int:
    response = client.post(
        "/api/projects",
        json={"name": "Analytics project", "description": "Metrics test"},
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()["id"]


def _create_site(client: TestClient, project_id: int, headers: dict[str, str]) -> int:
    response = client.post(
        f"/api/projects/{project_id}/sites",
        json={
            "name": "Analytics site",
            "geometry": {
                "type": "Polygon",
                "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
            },
        },
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()["id"]


def test_site_analytics_returns_empty_state(client: TestClient):
    token = register_and_get_token(client, "analytics-owner@example.com")
    headers = {"Authorization": f"Bearer {token}"}
    project_id = _create_project(client, headers)
    site_id = _create_site(client, project_id, headers)

    response = client.get(f"/api/sites/{site_id}/analytics", headers=headers)

    assert response.status_code == 200
    assert response.json()["metrics"] == []
    assert response.json()["latest_carbon_tonnes_co2e"] is None
    assert response.json()["latest_biodiversity_score"] is None


def test_project_analytics_returns_site_summary(client: TestClient):
    token = register_and_get_token(client, "project-analytics@example.com")
    headers = {"Authorization": f"Bearer {token}"}
    project_id = _create_project(client, headers)
    _create_site(client, project_id, headers)

    response = client.get(f"/api/projects/{project_id}/analytics", headers=headers)

    assert response.status_code == 200
    payload = response.json()
    assert payload["site_count"] == 1
    assert payload["total_area_hectares"] == 12364.0
    assert payload["sites_with_metrics"] == 0
    assert len(payload["sites"]) == 1
    assert payload["sites"][0]["carbon_history"] == []

    seed_response = client.post(
        f"/api/projects/{project_id}/analytics/seed",
        headers=headers,
    )
    assert seed_response.status_code == 200
    assert seed_response.json() == {"created_count": 18}

    seeded = client.get(f"/api/projects/{project_id}/analytics", headers=headers)
    assert seeded.json()["sites_with_metrics"] == 1
    assert len(seeded.json()["sites"][0]["carbon_history"]) == 18


def test_site_analytics_respects_owner(client: TestClient):
    owner_token = register_and_get_token(client, "analytics-owner-two@example.com")
    other_token = register_and_get_token(client, "analytics-other@example.com")
    owner_headers = {"Authorization": f"Bearer {owner_token}"}
    other_headers = {"Authorization": f"Bearer {other_token}"}
    project_id = _create_project(client, owner_headers)
    site_id = _create_site(client, project_id, owner_headers)

    response = client.get(f"/api/sites/{site_id}/analytics", headers=other_headers)

    assert response.status_code == 404


def test_seed_demo_metrics_is_idempotent(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'metrics.db'}")
    Base.metadata.create_all(bind=engine)

    with Session(engine) as db:
        db.add(
            Site(
                project_id=1,
                name="Seed site",
                geometry_json='{"type":"Polygon"}',
                area_hectares=10,
            )
        )
        db.commit()
        assert seed_demo_metrics(db) == 18
        assert seed_demo_metrics(db) == 0
        assert len(db.scalars(select(SiteMetric)).all()) == 18
        latest_period = db.scalar(select(SiteMetric.period).order_by(SiteMetric.period.desc()))
        assert latest_period == date.today().replace(day=1)
