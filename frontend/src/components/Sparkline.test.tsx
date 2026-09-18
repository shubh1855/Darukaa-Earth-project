import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Sparkline } from "../components/Sparkline";

describe("Sparkline", () => {
  it("renders empty state when no data points", () => {
    render(<Sparkline values={[]} />);
    expect(screen.getByText("No trend")).toBeInTheDocument();
  });

  it("renders empty state when only one data point", () => {
    render(<Sparkline values={[100]} />);
    expect(screen.getByText("No trend")).toBeInTheDocument();
  });

  it("renders empty state when all values are null", () => {
    render(<Sparkline values={[null, null, null]} />);
    expect(screen.getByText("No trend")).toBeInTheDocument();
  });

  it("renders SVG when sufficient data points exist", () => {
    render(<Sparkline values={[100, 110, 105]} />);

    const svg = screen.getByRole("img");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("aria-label", "Carbon trend");
  });

  it("renders SVG with correct viewBox", () => {
    render(<Sparkline values={[100, 110, 105, 120]} />);

    const svg = screen.getByRole("img");
    expect(svg).toHaveAttribute("viewBox", "0 0 100 30");
  });

  it("handles mixed null and numeric values", () => {
    render(<Sparkline values={[100, null, 110, 105]} />);

    const svg = screen.getByRole("img");
    expect(svg).toBeInTheDocument();
  });

  it("renders polyline element in SVG", () => {
    const { container } = render(<Sparkline values={[100, 110, 105]} />);

    const polyline = container.querySelector("polyline");
    expect(polyline).toBeInTheDocument();
    expect(polyline).toHaveAttribute("points");
  });
});
