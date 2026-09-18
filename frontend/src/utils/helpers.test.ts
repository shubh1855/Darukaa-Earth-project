import { describe, it, expect } from "vitest";
import {
  deltaLabel,
  deltaTone,
  calculateAreaFromRing,
  getSitePoint,
  getThumbnailPolygonPoints,
} from "../utils/helpers";
import type { Site, PolygonGeometry } from "../types/index";

describe("Helper Functions", () => {
  describe("deltaLabel", () => {
    it("returns 'No prior period' when current is null", () => {
      expect(deltaLabel(null, 100, "tCO2e")).toBe("No prior period");
    });

    it("returns 'No prior period' when previous is null", () => {
      expect(deltaLabel(100, null, "tCO2e")).toBe("No prior period");
    });

    it("formats positive delta correctly", () => {
      const result = deltaLabel(110, 100, "tCO2e");
      expect(result).toContain("▲");
      expect(result).toContain("10.0 tCO2e");
      expect(result).toContain("+10.0% vs prior");
    });

    it("formats negative delta correctly", () => {
      const result = deltaLabel(90, 100, "tCO2e");
      expect(result).toContain("▼");
      expect(result).toContain("10.0 tCO2e");
      expect(result).toContain("-10.0% vs prior");
    });

    it("handles zero previous value", () => {
      const result = deltaLabel(100, 0, "tCO2e");
      expect(result).toContain("100.0 tCO2e");
      expect(result).toContain("0.0% vs prior");
    });

    it("uses higher precision for ratio units", () => {
      const result = deltaLabel(1.234, 1.0, "tCO2e/ha");
      expect(result).toContain("0.234 tCO2e/ha");
    });
  });

  describe("deltaTone", () => {
    it("returns 'trend-neutral' when current is null", () => {
      expect(deltaTone(null, 100, "increase")).toBe("trend-neutral");
    });

    it("returns 'trend-neutral' when previous is null", () => {
      expect(deltaTone(100, null, "increase")).toBe("trend-neutral");
    });

    it("returns 'trend-neutral' when values are equal", () => {
      expect(deltaTone(100, 100, "increase")).toBe("trend-neutral");
    });

    it("returns 'trend-good' for increase when direction favors increase", () => {
      expect(deltaTone(110, 100, "increase")).toBe("trend-good");
    });

    it("returns 'trend-bad' for decrease when direction favors increase", () => {
      expect(deltaTone(90, 100, "increase")).toBe("trend-bad");
    });

    it("returns 'trend-good' for decrease when direction favors decrease", () => {
      expect(deltaTone(90, 100, "decrease")).toBe("trend-good");
    });

    it("returns 'trend-bad' for increase when direction favors decrease", () => {
      expect(deltaTone(110, 100, "decrease")).toBe("trend-bad");
    });
  });

  describe("calculateAreaFromRing", () => {
    it("returns null for ring with less than 4 points", () => {
      expect(
        calculateAreaFromRing([
          [0, 0],
          [1, 0],
        ]),
      ).toBeNull();
      expect(
        calculateAreaFromRing([
          [0, 0],
          [1, 0],
          [1, 1],
        ]),
      ).toBeNull();
    });

    it("calculates area for valid ring (square)", () => {
      const ring = [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
        [0, 0],
      ];
      const area = calculateAreaFromRing(ring);
      expect(area).toBeGreaterThan(0);
      expect(area).toBe(12364); // 1 degree square * 12364 multiplier
    });

    it("returns positive area regardless of vertex order", () => {
      const clockwise = [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
        [0, 0],
      ];
      const counterClockwise = [
        [0, 0],
        [0, 1],
        [1, 1],
        [1, 0],
        [0, 0],
      ];
      expect(calculateAreaFromRing(clockwise)).toBe(
        calculateAreaFromRing(counterClockwise),
      );
    });
  });

  describe("getSitePoint", () => {
    function makeSite(coordinates: number[][][]): Site {
      return {
        id: 1,
        project_id: 1,
        name: "Test",
        geometry: { type: "Polygon", coordinates } as PolygonGeometry,
        area_hectares: 10,
        created_at: "2024-01-01",
      };
    }

    it("returns centroid of a simple polygon ring", () => {
      const site = makeSite([
        [
          [0, 0],
          [2, 0],
          [2, 2],
          [0, 2],
          [0, 0],
        ],
      ]);
      const [lon, lat] = getSitePoint(site);
      expect(lon).toBe(1);
      expect(lat).toBe(1);
    });

    it("returns [0, 0] for empty coordinates", () => {
      const site = makeSite([]);
      expect(getSitePoint(site)).toEqual([0, 0]);
    });

    it("returns [0, 0] for empty ring", () => {
      const site = makeSite([[]]);
      expect(getSitePoint(site)).toEqual([0, 0]);
    });

    it("handles single-point ring", () => {
      const site = makeSite([[[5, 10]]]);
      const [lon, lat] = getSitePoint(site);
      expect(lon).toBe(5);
      expect(lat).toBe(10);
    });
  });

  describe("getThumbnailPolygonPoints", () => {
    it("maps polygon to SVG coordinates", () => {
      const geometry: PolygonGeometry = {
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
            [0, 0],
          ],
        ],
      };
      const result = getThumbnailPolygonPoints(geometry);
      // Should produce space-separated x,y pairs
      const pairs = result.split(" ");
      expect(pairs.length).toBe(5);
      // Each pair should be "x,y" format
      for (const pair of pairs) {
        const [x, y] = pair.split(",").map(Number);
        expect(Number.isFinite(x)).toBe(true);
        expect(Number.isFinite(y)).toBe(true);
      }
    });

    it("handles empty coordinates gracefully", () => {
      const geometry: PolygonGeometry = {
        type: "Polygon",
        coordinates: [],
      };
      const result = getThumbnailPolygonPoints(geometry);
      expect(result).toBe("");
    });
  });
});
