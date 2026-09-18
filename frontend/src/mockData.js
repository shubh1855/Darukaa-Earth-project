const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function monthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function monthOffset(date, offset) {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1);
}

function formatMonth(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

function seededNoise(seed) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return (value - Math.floor(value)) * 2 - 1;
}

export function generateMockMetrics(siteId, areaHectares, count = 18) {
  const current = monthStart(new Date());
  const baseCarbon = Math.max(12, areaHectares * (0.46 + siteId * 0.012));
  const baseBiodiversity = 78 + (siteId % 5);

  return Array.from({ length: count }, (_, index) => {
    const month = monthOffset(current, index - count + 1);
    const noise = seededNoise(siteId * 31 + index * 7);
    const carbon = Math.max(
      0,
      baseCarbon * (1 - index * 0.009) + noise * baseCarbon * 0.018,
    );
    const biodiversity = Math.min(
      100,
      Math.max(72, baseBiodiversity + index * 0.32 + noise * 2.2),
    );

    return {
      period: formatMonth(month),
      carbon_tonnes_co2e: Number(carbon.toFixed(2)),
      biodiversity_score: Number(biodiversity.toFixed(1)),
    };
  });
}

export function ensureMockHistory(analytics) {
  if (analytics.metrics.length >= 18) {
    return analytics;
  }

  const metrics = generateMockMetrics(
    analytics.site_id,
    analytics.area_hectares,
    18,
  );
  const latest = metrics[metrics.length - 1];

  return {
    ...analytics,
    latest_carbon_tonnes_co2e: latest.carbon_tonnes_co2e,
    latest_biodiversity_score: latest.biodiversity_score,
    metrics,
  };
}

export function linearForecast(metrics, months = 3) {
  const values = metrics
    .map((metric, index) => ({
      index,
      value: metric.carbon_tonnes_co2e,
    }))
    .filter((point) => point.value !== null);

  if (values.length < 2) {
    return [];
  }

  const meanX = values.reduce((sum, point) => sum + point.index, 0) / values.length;
  const meanY = values.reduce((sum, point) => sum + point.value, 0) / values.length;
  const numerator = values.reduce(
    (sum, point) => sum + (point.index - meanX) * (point.value - meanY),
    0,
  );
  const denominator = values.reduce(
    (sum, point) => sum + (point.index - meanX) ** 2,
    0,
  );
  const slope = denominator === 0 ? 0 : numerator / denominator;
  const intercept = meanY - slope * meanX;
  const lastDate = new Date(`${metrics[metrics.length - 1].period}T00:00:00`);

  return Array.from({ length: months }, (_, offset) => {
    const index = metrics.length + offset;
    const date = monthOffset(lastDate, offset + 1);
    return {
      period: formatMonth(date),
      value: Number(Math.max(0, intercept + slope * index).toFixed(2)),
    };
  });
}

export function formatMonthLabel(period) {
  const date = new Date(`${period}T00:00:00`);
  return `${MONTH_NAMES[date.getMonth()]} ${String(date.getFullYear()).slice(-2)}`;
}
