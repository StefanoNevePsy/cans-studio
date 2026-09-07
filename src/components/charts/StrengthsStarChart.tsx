import { useState } from "react";
import type { StrengthPoint } from "../../types/cans";
import { formatPoint, polarPoint, shortenLabel } from "../../utils/cansMath";
import { ChartBackground } from "./ChartBackground";

export function StrengthsStarChart({
  id,
  points,
  previousPoints,
  title,
}: {
  id?: string;
  points: StrengthPoint[];
  previousPoints?: StrengthPoint[];
  title: string;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const size = 480;
  const center = size / 2;
  const radius = 148;
  const axes = points.length || 1;

  const current = points
    .map((entry, index) =>
      polarPoint(center, radius * (entry.value / 3), index, axes),
    )
    .map(formatPoint)
    .join(" ");

  const previous = previousPoints
    ?.map((entry, index) =>
      polarPoint(center, radius * (entry.value / 3), index, axes),
    )
    .map(formatPoint)
    .join(" ");

  const activePoint = hoveredIndex !== null ? points[hoveredIndex] : null;

  return (
    <figure className="star-card formal-star">
      <figcaption>{title}</figcaption>
      <svg id={id} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={title}>
        <ChartBackground
          count={points.length}
          center={center}
          radius={radius}
          labels={points.map((entry) => shortenLabel(entry.item.label))}
          ticks={[0, 1, 2, 3]}
          strength
          onHoverAxis={setHoveredIndex}
        />
        {previous && <polygon points={previous} className="star-previous" />}
        <polygon points={current} className="strength-fill" />
        {points.map((entry, index) => {
          const point = polarPoint(center, radius * (entry.value / 3), index, axes);
          return (
            <circle
              key={entry.item.id}
              cx={point.x}
              cy={point.y}
              r={hoveredIndex === index ? "5.5" : "3.5"}
              className={`strength-dot raw-${entry.raw ?? "empty"} ${
                hoveredIndex === index ? "is-active" : ""
              }`}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              style={{ cursor: "pointer" }}
            />
          );
        })}
        <text x="16" y="24" className="chart-note">
          Pieno = punto di forza positivo e utilizzabile
        </text>
        <text x="16" y="42" className="chart-note">
          Vuoto = punto di forza mancante o critico
        </text>

        {activePoint && (
          <g transform={`translate(${center}, ${size - 28})`}>
            <rect
              x="-150"
              y="-14"
              width="300"
              height="26"
              rx="6"
              fill="var(--surface-strong)"
              stroke="var(--border)"
              strokeWidth="1"
            />
            <text
              x="0"
              y="4"
              textAnchor="middle"
              fontSize="11"
              fontWeight="600"
              fill="var(--ink)"
            >
              {activePoint.item.label}: {activePoint.raw !== undefined ? `Punteggio ${activePoint.raw}` : "Non compilato"}
            </text>
          </g>
        )}
      </svg>
    </figure>
  );
}
