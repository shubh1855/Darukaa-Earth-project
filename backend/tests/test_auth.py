from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.main import app


@pytest.fixture()
def client(tmp_path: Path):
    db_path = tmp_path / 'test.db'
    engine = create_engine(f'sqlite:///{db_path}', connect_args={'check_same_thread': False})
    testing_session_local = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = testing_session_local()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_register_and_login(client: TestClient):
    register_response = client.post(
        '/api/auth/register',
        json={'email': 'admin@darukaa.test', 'password': 'strongpass123'},
    )
    assert register_response.status_code == 201
    register_data = register_response.json()
    assert register_data['access_token']
    assert register_data['token_type'] == 'bearer'

    duplicate_response = client.post(
        '/api/auth/register',
        json={'email': 'admin@darukaa.test', 'password': 'strongpass123'},
    )
    assert duplicate_response.status_code == 409

    login_response = client.post(
        '/api/auth/login',
        json={'email': 'admin@darukaa.test', 'password': 'strongpass123'},
    )
    assert login_response.status_code == 200
    assert login_response.json()['access_token']


def test_me_requires_and_accepts_token(client: TestClient):
    register_response = client.post(
        '/api/auth/register',
        json={'email': 'owner@darukaa.test', 'password': 'strongpass123'},
    )
    token = register_response.json()['access_token']

    unauthorized = client.get('/api/auth/me')
    assert unauthorized.status_code == 401

    authorized = client.get('/api/auth/me', headers={'Authorization': f'Bearer {token}'})
    assert authorized.status_code == 200
    assert authorized.json()['email'] == 'owner@darukaa.test'
