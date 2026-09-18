import { describe, it, expect } from "vitest";
import { deltaLabel, deltaTone, calculateAreaFromRing } from "../utils/helpers";

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
});
