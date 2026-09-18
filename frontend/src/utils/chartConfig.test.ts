import { describe, it, expect } from "vitest";
import {
  createCarbonDataset,
  createForecastDataset,
  createBiodiversityDataset,
  carbonChartOptions,
  biodiversityChartOptions,
  deltaBarOptions,
  baseChartOptions,
} from "../utils/chartConfig";

describe("Chart Configuration", () => {
  describe("createCarbonDataset", () => {
    it("creates dataset with carbon values and forecast padding", () => {
      const carbonValues = [100, 110, 105];
      const dataset = createCarbonDataset(carbonValues, 3);

      expect(dataset.label).toBe("Carbon (tCO₂e)");
      expect(dataset.data).toHaveLength(6); // 3 values + 3 forecast nulls
      expect(dataset.data.slice(0, 3)).toEqual([100, 110, 105]);
      expect(dataset.data.slice(3)).toEqual([null, null, null]);
    });

    it("uses correct styling", () => {
      const dataset = createCarbonDataset([100], 0);

      expect(dataset.borderColor).toBe("#10b981");
      expect(dataset.fill).toBe(true);
      expect(dataset.tension).toBe(0.3);
    });

    it("handles empty values array", () => {
      const dataset = createCarbonDataset([], 0);

      expect(dataset.data).toHaveLength(0);
      expect(dataset.label).toBe("Carbon (tCO₂e)");
    });

    it("handles empty values with forecast padding", () => {
      const dataset = createCarbonDataset([], 3);

      expect(dataset.data).toHaveLength(3);
      expect(dataset.data).toEqual([null, null, null]);
    });
  });

  describe("createForecastDataset", () => {
    it("creates dataset with leading nulls and forecast values", () => {
      const carbonValues = [100, 110, 105];
      const forecast = [
        { period: "2024-04", value: 108 },
        { period: "2024-05", value: 112 },
      ];
      const dataset = createForecastDataset(carbonValues, forecast);

      expect(dataset.label).toBe("Forecast (3M)");
      // 2 leading nulls + last actual value + 2 forecast values = 5
      expect(dataset.data).toHaveLength(5);
      expect(dataset.data[2]).toBe(105); // Last actual value
      expect(dataset.data[3]).toBe(108);
      expect(dataset.data[4]).toBe(112);
    });

    it("uses dashed line style", () => {
      const dataset = createForecastDataset([100], []);

      expect(dataset.borderDash).toEqual([7, 4]);
      expect(dataset.fill).toBe(false);
      expect(dataset.borderColor).toBe("#f59e0b");
    });

    it("handles empty carbon values", () => {
      const dataset = createForecastDataset([], []);

      // last value is null when array is empty
      expect(dataset.data).toHaveLength(1);
      expect(dataset.data[0]).toBeNull();
    });
  });

  describe("createBiodiversityDataset", () => {
    it("creates dataset with biodiversity values", () => {
      const values = [70, 75, 72];
      const dataset = createBiodiversityDataset(values);

      expect(dataset.label).toBe("Biodiversity (/100)");
      expect(dataset.data).toEqual([70, 75, 72]);
    });

    it("uses purple color scheme", () => {
      const dataset = createBiodiversityDataset([70]);

      expect(dataset.borderColor).toBe("#8b5cf6");
      expect(dataset.fill).toBe(true);
    });

    it("handles empty values array", () => {
      const dataset = createBiodiversityDataset([]);

      expect(dataset.data).toEqual([]);
      expect(dataset.label).toBe("Biodiversity (/100)");
    });
  });

  describe("Chart Options", () => {
    it("baseChartOptions has correct defaults", () => {
      expect(baseChartOptions.responsive).toBe(true);
      expect(baseChartOptions.maintainAspectRatio).toBe(false);
      expect(baseChartOptions.interaction?.mode).toBe("index");
      expect(baseChartOptions.interaction?.intersect).toBe(false);
    });

    it("carbonChartOptions has correct y-axis minimum", () => {
      expect(carbonChartOptions.scales?.y?.suggestedMin).toBe(900);
      expect(carbonChartOptions.responsive).toBe(true);
      expect(carbonChartOptions.maintainAspectRatio).toBe(false);
    });

    it("biodiversityChartOptions has correct y-axis range", () => {
      expect(biodiversityChartOptions.scales?.y?.suggestedMin).toBe(72);
      expect(biodiversityChartOptions.scales?.y?.max).toBe(100);
    });

    it("deltaBarOptions starts y-axis at zero", () => {
      expect(deltaBarOptions.scales?.y?.beginAtZero).toBe(true);
      expect(deltaBarOptions.responsive).toBe(true);
    });
  });
});
