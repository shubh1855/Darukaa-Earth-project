from datetime import UTC, date, datetime

from geoalchemy2 import Geometry
from sqlalchemy import Date, DateTime, Float, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import TypeDecorator

from .database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))

    projects: Mapped[list["Project"]] = relationship(
        back_populates="owner",
        cascade="all, delete-orphan",
    )


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))

    owner: Mapped[User] = relationship(back_populates="projects")
    sites: Mapped[list["Site"]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
    )


class SpatialGeometry(TypeDecorator):
    impl = Text
    cache_ok = True

    # GeoAlchemy inspects the declared type during PostgreSQL DDL events,
    # before SQLAlchemy replaces the implementation with Geometry.
    geometry_type = "POLYGON"
    srid = 4326
    dimension = 2
    spatial_index = False
    use_N_D_index = False
    use_typmod = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(Geometry(geometry_type="POLYGON", srid=4326))
        return dialect.type_descriptor(Text())


class Site(Base):
    __tablename__ = "sites"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    geometry_json: Mapped[str] = mapped_column(Text)
    geometry: Mapped[object | None] = mapped_column(SpatialGeometry(), nullable=True)
    area_hectares: Mapped[float] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))

    project: Mapped[Project] = relationship(back_populates="sites")
    metrics: Mapped[list["SiteMetric"]] = relationship(
        back_populates="site",
        cascade="all, delete-orphan",
    )


class SiteMetric(Base):
    __tablename__ = "site_metrics"
    __table_args__ = (UniqueConstraint("site_id", "period", name="uq_site_metrics_site_period"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    site_id: Mapped[int] = mapped_column(ForeignKey("sites.id", ondelete="CASCADE"), index=True)
    period: Mapped[date] = mapped_column(Date, index=True)
    carbon_tonnes_co2e: Mapped[float | None] = mapped_column(Float, nullable=True)
    biodiversity_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))

    site: Mapped[Site] = relationship(back_populates="metrics")
