import { formatPoint, polarPoint } from "../../utils/cansMath";

export function ChartBackground({
  count,
  center,
  radius,
  labels,
  ticks,
  strength = false,
  onHoverAxis,
}: {
  count: number;
  center: number;
  radius: number;
  labels: string[];
  ticks: number[];
  strength?: boolean;
  onHoverAxis?: (index: number | null) => void;
}) {
  const rings = strength ? [1 / 3, 2 / 3, 1] : [0.2, 0.4, 0.6, 0.8, 1];
  return (
    <>
      {rings.map((ring) => (
        <polygon
          key={ring}
          points={labels
            .map((_, index) =>
              polarPoint(center, radius * ring, index, Math.max(count, 1)),
            )
            .map(formatPoint)
            .join(" ")}
          className="star-ring"
        />
      ))}
      {labels.map((label, index) => {
        const end = polarPoint(center, radius, index, Math.max(count, 1));
        const text = polarPoint(
          center,
          radius + (count > 10 ? 37 : 48),
          index,
          Math.max(count, 1),
        );
        return (
          <g
            key={`${label}-${index}`}
            onMouseEnter={() => onHoverAxis?.(index)}
            onMouseLeave={() => onHoverAxis?.(null)}
            style={{ cursor: onHoverAxis ? "pointer" : "default" }}
          >
            <line
              x1={center}
              y1={center}
              x2={end.x}
              y2={end.y}
              className="star-axis"
            />
            <text
              x={text.x}
              y={text.y}
              textAnchor="middle"
              dominantBaseline="middle"
              className={count > 10 ? "dense-axis-label" : ""}
            >
              {label}
            </text>
          </g>
        );
      })}
      {ticks.map((tick) => {
        const ratio = strength ? tick / 3 : tick / 100;
        return (
          <text
            key={tick}
            x={center + 5}
            y={center - radius * ratio - 2}
            className="star-tick-label"
          >
            {tick}
            {!strength && "%"}
          </text>
        );
      })}
    </>
  );
}
