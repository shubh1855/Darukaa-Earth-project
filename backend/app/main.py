import json
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from geoalchemy2.elements import WKTElement
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .auth import create_access_token, get_current_user, hash_password, verify_password
from .config import settings
from .database import Base, engine, get_db
from .models import Project, Site, User
from .schemas import (
    AuthRequest,
    ProjectCreateRequest,
    ProjectResponse,
    SiteCreateRequest,
    SiteDetailResponse,
    SiteListResponse,
    TokenResponse,
    UserResponse,
)


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="Darukaa.Earth API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/auth/register", response_model=TokenResponse, status_code=201)
def register(payload: AuthRequest, db: Session = Depends(get_db)):
    existing_user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if existing_user:
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(email=payload.email.lower(), password_hash=hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)

    return TokenResponse(access_token=create_access_token(user.id))


@app.post("/api/auth/login", response_model=TokenResponse)
def login(payload: AuthRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    return TokenResponse(access_token=create_access_token(user.id))


@app.get("/api/auth/me", response_model=UserResponse)
def current_user(user: User = Depends(get_current_user)):
    return user


@app.get("/api/projects", response_model=list[ProjectResponse])
def list_projects(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = select(Project).where(Project.owner_id == user.id).order_by(Project.created_at.desc())
    return list(db.scalars(query))


@app.post("/api/projects", response_model=ProjectResponse, status_code=201)
def create_project(
    payload: ProjectCreateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = Project(
        owner_id=user.id,
        name=payload.name.strip(),
        description=payload.description.strip(),
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def _geojson_to_wkt(geometry: dict) -> WKTElement:
    coordinates = ", ".join(f"{lon} {lat}" for lon, lat in geometry["coordinates"][0])
    return WKTElement(f"POLYGON (({coordinates}))", srid=4326)


def _compute_polygon_area_hectares(geometry: dict) -> float:
    ring = geometry["coordinates"][0]
    area_degrees = 0.0

    for i in range(len(ring) - 1):
        lon1, lat1 = ring[i]
        lon2, lat2 = ring[i + 1]
        area_degrees += (lon1 * lat2) - (lon2 * lat1)

    return abs(area_degrees) * 0.5 * 12364


def _get_owned_project_or_404(project_id: int, user_id: int, db: Session) -> Project:
    project = db.scalar(
        select(Project).where(Project.id == project_id, Project.owner_id == user_id)
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def _to_site_response(site: Site) -> SiteDetailResponse:
    return SiteDetailResponse(
        id=site.id,
        project_id=site.project_id,
        name=site.name,
        geometry=json.loads(site.geometry_json),
        area_hectares=site.area_hectares,
        created_at=site.created_at,
    )


@app.get("/api/projects/{id}/sites", response_model=list[SiteListResponse])
def list_sites_for_project(
    id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_owned_project_or_404(project_id=id, user_id=user.id, db=db)
    query = select(Site).where(Site.project_id == id).order_by(Site.created_at.desc())
    return [_to_site_response(site) for site in db.scalars(query)]


@app.post("/api/projects/{id}/sites", response_model=SiteDetailResponse, status_code=201)
def create_site_for_project(
    id: int,
    payload: SiteCreateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _get_owned_project_or_404(project_id=id, user_id=user.id, db=db)

    database_dialect = db.get_bind().dialect.name
    site = Site(
        project_id=project.id,
        name=payload.name,
        geometry_json=json.dumps(payload.geometry),
        geometry=_geojson_to_wkt(payload.geometry) if database_dialect == "postgresql" else None,
        area_hectares=_compute_polygon_area_hectares(payload.geometry),
    )
    db.add(site)
    db.flush()

    if database_dialect == "postgresql":
        projected_area = db.scalar(
            select(func.ST_Area(func.ST_Transform(site.geometry, 6933)) / 10000).where(
                Site.id == site.id
            )
        )
        if projected_area is not None:
            site.area_hectares = float(projected_area)

    db.commit()
    db.refresh(site)

    return _to_site_response(site)


@app.get("/api/sites/{id}", response_model=SiteDetailResponse)
def get_site_detail(
    id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    site = db.scalar(select(Site).join(Project).where(Site.id == id, Project.owner_id == user.id))
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")

    return _to_site_response(site)
