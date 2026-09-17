from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class AuthRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: int
    email: EmailStr
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProjectCreateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    description: str = ""


class ProjectResponse(BaseModel):
    id: int
    name: str
    description: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


def _is_valid_coordinate(value: Any) -> bool:
    return isinstance(value, int | float) and not isinstance(value, bool)


def validate_geojson_polygon(geometry: dict[str, Any]) -> dict[str, Any]:
    if geometry.get("type") != "Polygon":
        raise ValueError("geometry.type must be Polygon")

    coordinates = geometry.get("coordinates")
    if not isinstance(coordinates, list) or len(coordinates) != 1:
        raise ValueError("coordinates must contain exactly one ring")

    ring = coordinates[0]
    if not isinstance(ring, list) or len(ring) < 4:
        raise ValueError("ring must contain at least 4 points")

    normalized_ring: list[list[float]] = []
    for point in ring:
        if not isinstance(point, list) or len(point) != 2:
            raise ValueError("each point must be [lon, lat]")

        lon, lat = point
        if not _is_valid_coordinate(lon) or not _is_valid_coordinate(lat):
            raise ValueError("lon/lat must be numeric")

        lon_value = float(lon)
        lat_value = float(lat)

        if not -180 <= lon_value <= 180:
            raise ValueError("lon must be in [-180, 180]")
        if not -90 <= lat_value <= 90:
            raise ValueError("lat must be in [-90, 90]")

        normalized_ring.append([lon_value, lat_value])

    if normalized_ring[0] != normalized_ring[-1]:
        raise ValueError("ring must be closed")

    return {"type": "Polygon", "coordinates": [normalized_ring]}


class SiteCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    geometry: dict[str, Any]

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("name must not be blank")
        return normalized

    @field_validator("geometry")
    @classmethod
    def validate_geometry(cls, value: dict[str, Any]) -> dict[str, Any]:
        return validate_geojson_polygon(value)


class SiteListResponse(BaseModel):
    id: int
    project_id: int
    name: str
    geometry: dict[str, Any]
    area_hectares: float
    created_at: datetime


class SiteDetailResponse(SiteListResponse):
    pass
