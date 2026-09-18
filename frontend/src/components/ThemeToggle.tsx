import { ThemeIcon } from "./ThemeIcon";

export function ThemeToggle({
  darkMode,
  onToggle,
}: {
  darkMode: boolean;
  onToggle: (dark: boolean) => void;
}) {
  return (
    <aside className="theme-switcher" aria-label="Colour theme">
      <button
        type="button"
        className={
          !darkMode ? "theme-button theme-button-active" : "theme-button"
        }
        onClick={() => onToggle(false)}
        aria-label="Use light theme"
        title="Light theme"
      >
        <ThemeIcon kind="sun" />
      </button>
      <button
        type="button"
        className={
          darkMode ? "theme-button theme-button-active" : "theme-button"
        }
        onClick={() => onToggle(true)}
        aria-label="Use dark theme"
        title="Dark theme"
      >
        <ThemeIcon kind="moon" />
      </button>
    </aside>
  );
}
