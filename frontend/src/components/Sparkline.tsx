export function Sparkline({ values }: { values: Array<number | null> }) {
  const points = values.filter((value): value is number => value !== null);
  if (points.length < 2) {
    return <span className="sparkline-empty">No trend</span>;
  }

  const minimum = Math.min(...points);
  const maximum = Math.max(...points);
  const range = maximum - minimum || 1;
  const path = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100;
      const y = 28 - (((value ?? minimum) - minimum) / range) * 24;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      className="sparkline"
      viewBox="0 0 100 30"
      role="img"
      aria-label="Carbon trend"
    >
      <polyline points={path} />
    </svg>
  );
}
