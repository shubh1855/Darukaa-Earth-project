import { describe, it, expect } from "vitest";
import {
  createCarbonDataset,
  createForecastDataset,
  createBiodiversityDataset,
  carbonChartOptions,
  biodiversityChartOptions,
  deltaBarOptions,
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
  });

  describe("Chart Options", () => {
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
