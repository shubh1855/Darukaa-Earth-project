from calendar import monthrange
from datetime import date
from math import sin

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


def seed_demo_metrics(db: Session, project_id: int | None = None) -> int:
    query = select(Site).order_by(Site.id)
    if project_id is not None:
        query = query.where(Site.project_id == project_id)
    sites = db.scalars(query).all()
    created = 0
    today = date.today().replace(day=1)

    for site in sites:
        base_carbon = max(12, site.area_hectares * (0.46 + site.id * 0.012))
        base_biodiversity = 78 + (site.id % 5)
        for offset in range(17, -1, -1):
            period = _subtract_months(today, offset)
            metric = db.scalar(
                select(SiteMetric).where(
                    SiteMetric.site_id == site.id,
                    SiteMetric.period == period,
                )
            )
            progress = 17 - offset
            noise = sin(site.id * 31 + progress * 7)
            carbon = round(
                max(0, base_carbon * (1 - progress * 0.009) + noise * base_carbon * 0.018),
                2,
            )
            biodiversity = round(
                min(100, max(72, base_biodiversity + progress * 0.32 + noise * 2.2)),
                1,
            )
            if metric is None:
                created += 1
                db.add(
                    SiteMetric(
                        site_id=site.id,
                        period=period,
                        carbon_tonnes_co2e=carbon,
                        biodiversity_score=biodiversity,
                    )
                )
            else:
                metric.carbon_tonnes_co2e = carbon
                metric.biodiversity_score = biodiversity

    db.commit()
    return created


def main() -> None:
    with SessionLocal() as db:
        print(f"Created {seed_demo_metrics(db)} demo metrics.")


if __name__ == "__main__":
    main()
