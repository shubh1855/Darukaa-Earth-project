import type { ChartOptions } from "chart.js";

export const baseChartOptions: ChartOptions<"line"> = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: "index", intersect: false },
};

export const carbonChartOptions: ChartOptions<"line"> = {
  ...baseChartOptions,
  scales: { y: { suggestedMin: 900 } },
};

export const biodiversityChartOptions: ChartOptions<"line"> = {
  ...baseChartOptions,
  scales: { y: { suggestedMin: 72, max: 100 } },
};

export const deltaBarOptions: ChartOptions<"bar"> = {
  responsive: true,
  maintainAspectRatio: false,
  scales: { y: { beginAtZero: true } },
};

export function createCarbonDataset(
  carbonValues: Array<number | null>,
  forecastLength: number,
) {
  return {
    label: "Carbon (tCO₂e)",
    data: [
      ...carbonValues,
      ...Array.from({ length: forecastLength }, () => null),
    ],
    borderColor: "#10b981",
    backgroundColor: "rgba(16,185,129,0.12)",
    borderWidth: 2.5,
    fill: true,
    tension: 0.3,
    pointRadius: 3,
    pointHoverRadius: 5,
  };
}

export function createForecastDataset(
  carbonValues: Array<number | null>,
  forecast: Array<{ period: string; value: number }>,
) {
  return {
    label: "Forecast (3M)",
    data: [
      ...Array.from(
        { length: Math.max(0, carbonValues.length - 1) },
        () => null,
      ),
      carbonValues[carbonValues.length - 1] ?? null,
      ...forecast.map((point) => point.value),
    ],
    borderColor: "#f59e0b",
    backgroundColor: "transparent",
    borderDash: [7, 4],
    borderWidth: 2,
    pointRadius: 3,
    pointHoverRadius: 5,
    fill: false,
    tension: 0.3,
  };
}

export function createBiodiversityDataset(
  biodiversityValues: Array<number | null>,
) {
  return {
    label: "Biodiversity (/100)",
    data: biodiversityValues,
    borderColor: "#8b5cf6",
    backgroundColor: "rgba(139,92,246,0.10)",
    borderWidth: 2.5,
    fill: true,
    tension: 0.3,
    pointRadius: 3,
    pointHoverRadius: 5,
  };
}
