import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeToggle } from "../components/ThemeToggle";

describe("ThemeToggle", () => {
  it("renders both theme buttons", () => {
    const onToggle = vi.fn();
    render(<ThemeToggle darkMode={false} onToggle={onToggle} />);

    expect(screen.getByLabelText("Use light theme")).toBeInTheDocument();
    expect(screen.getByLabelText("Use dark theme")).toBeInTheDocument();
  });

  it("marks light theme as active when darkMode is false", () => {
    const onToggle = vi.fn();
    render(<ThemeToggle darkMode={false} onToggle={onToggle} />);

    const lightButton = screen.getByLabelText("Use light theme");
    expect(lightButton).toHaveClass("theme-button-active");
  });

  it("marks dark theme as active when darkMode is true", () => {
    const onToggle = vi.fn();
    render(<ThemeToggle darkMode={true} onToggle={onToggle} />);

    const darkButton = screen.getByLabelText("Use dark theme");
    expect(darkButton).toHaveClass("theme-button-active");
  });

  it("calls onToggle with false when light theme is clicked", async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(<ThemeToggle darkMode={true} onToggle={onToggle} />);

    const lightButton = screen.getByLabelText("Use light theme");
    await user.click(lightButton);

    expect(onToggle).toHaveBeenCalledWith(false);
  });

  it("calls onToggle with true when dark theme is clicked", async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(<ThemeToggle darkMode={false} onToggle={onToggle} />);

    const darkButton = screen.getByLabelText("Use dark theme");
    await user.click(darkButton);

    expect(onToggle).toHaveBeenCalledWith(true);
  });
});
