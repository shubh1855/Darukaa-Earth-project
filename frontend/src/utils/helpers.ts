import type { PolygonGeometry, Site } from "../types/index";

export function deltaLabel(
  current: number | null,
  previous: number | null,
  unit: string,
): string {
  if (current === null || previous === null) {
    return "No prior period";
  }
  const delta = current - previous;
  const percentage = previous === 0 ? 0 : (delta / previous) * 100;
  const precision = unit.includes("/") ? 3 : 1;
  return `${delta <= 0 ? "▼" : "▲"} ${Math.abs(delta).toFixed(precision)} ${unit} (${delta >= 0 ? "+" : ""}${percentage.toFixed(1)}% vs prior)`;
}

export function deltaTone(
  current: number | null,
  previous: number | null,
  favorableDirection: "increase" | "decrease",
): string {
  if (current === null || previous === null || current === previous) {
    return "trend-neutral";
  }
  const delta = current - previous;
  const isFavorable = favorableDirection === "increase" ? delta > 0 : delta < 0;
  return isFavorable ? "trend-good" : "trend-bad";
}

export function getThumbnailPolygonPoints(geometry: PolygonGeometry): string {
  const ring = geometry.coordinates[0] ?? [];
  const longitudes = ring.map(([longitude]: number[]) => longitude);
  const latitudes = ring.map(([, latitude]: number[]) => latitude);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const longitudeRange = maxLongitude - minLongitude || 1;
  const latitudeRange = maxLatitude - minLatitude || 1;

  return ring
    .map(([longitude, latitude]: number[]) => {
      const x = 12 + ((longitude - minLongitude) / longitudeRange) * 76;
      const y = 50 - ((latitude - minLatitude) / latitudeRange) * 40;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export function getSitePoint(site: Site): [number, number] {
  const ring = site.geometry.coordinates[0] ?? [];
  if (ring.length === 0) {
    return [0, 0];
  }

  const uniqueRing = ring.length > 1 ? ring.slice(0, -1) : ring;
  const longitude =
    uniqueRing.reduce((sum: number, [value]: number[]) => sum + value, 0) /
    uniqueRing.length;
  const latitude =
    uniqueRing.reduce((sum: number, [, value]: number[]) => sum + value, 0) /
    uniqueRing.length;
  return [longitude, latitude];
}

export function calculateAreaFromRing(ring: number[][]): number | null {
  if (ring.length < 4) {
    return null;
  }

  let area = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    const [longitudeA, latitudeA] = ring[index];
    const [longitudeB, latitudeB] = ring[index + 1];
    area += longitudeA * latitudeB - longitudeB * latitudeA;
  }

  return Math.abs(area) * 0.5 * 12364;
}
