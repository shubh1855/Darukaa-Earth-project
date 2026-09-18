from calendar import monthrange
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from .database import SessionLocal
from .models import Site, SiteMetric


def _subtract_months(value: date, months: int) -> date:
    month_index = value.year * 12 + value.month - 1 - months
    year, month_zero_indexed = divmod(month_index, 12)
    month = month_zero_indexed + 1
    day = min(value.day, monthrange(year, month)[1])
    return date(year, month, day)


def seed_demo_metrics(db: Session) -> int:
    sites = db.scalars(select(Site).order_by(Site.id)).all()
    created = 0
    today = date.today().replace(day=1)

    for site in sites:
        for offset in (2, 1, 0):
            period = _subtract_months(today, offset)
            exists = db.scalar(
                select(SiteMetric.id).where(
                    SiteMetric.site_id == site.id,
                    SiteMetric.period == period,
                )
            )
            if exists is not None:
                continue

            created += 1
            db.add(
                SiteMetric(
                    site_id=site.id,
                    period=period,
                    carbon_tonnes_co2e=round(site.area_hectares * (0.42 + offset * 0.03), 2),
                    biodiversity_score=round(min(100, 58 + site.id * 3 + (2 - offset) * 4), 1),
                )
            )

    db.commit()
    return created


def main() -> None:
    with SessionLocal() as db:
        print(f"Created {seed_demo_metrics(db)} demo metrics.")


if __name__ == "__main__":
    main()
