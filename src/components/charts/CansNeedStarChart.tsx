import { useState } from "react";
import type { NeedBand } from "../../types/cans";
import { formatPoint, polarPoint } from "../../utils/cansMath";
import { ChartBackground } from "./ChartBackground";

export function CansNeedStarChart({
  id,
  bands,
  title,
  previousBands,
}: {
  id?: string;
  bands: NeedBand[];
  title: string;
  previousBands?: NeedBand[];
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const size = 480;
  const center = size / 2;
  const radius = 150;
  const axes = bands.length || 1;

  const bandPolygons = [3, 2, 1, 0].map((score) => ({
    score,
    points: bands
      .map((entry, index) =>
        polarPoint(
          center,
          radius * entry.cumulative[score as 0 | 1 | 2 | 3],
          index,
          axes,
        ),
      )
      .map(formatPoint)
      .join(" "),
  }));

  // Optional ghost polygon for previous assessment (comparing actionable needs: score >= 2)
  const previousActionable =
    previousBands &&
    previousBands
      .map((entry, index) =>
        polarPoint(
          center,
          radius * entry.cumulative[2], // cumulative 2 includes score 2 and 3
          index,
          axes,
        ),
      )
      .map(formatPoint)
      .join(" ");

  const activeBand = hoveredIndex !== null ? bands[hoveredIndex] : null;

  return (
    <figure className="star-card formal-star">
      <figcaption>{title}</figcaption>
      <svg id={id} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={title}>
        <ChartBackground
          count={bands.length}
          center={center}
          radius={radius}
          labels={bands.map((entry) => entry.domain.shortTitle)}
          ticks={[0, 20, 40, 60, 80, 100]}
          onHoverAxis={setHoveredIndex}
        />
        {bandPolygons.map((band) => (
          <polygon
            key={band.score}
            points={band.points}
            className={`cans-band score-${band.score}`}
          />
        ))}

        {previousActionable && (
          <polygon
            points={previousActionable}
            fill="none"
            stroke="var(--ink)"
            strokeWidth="2"
            strokeDasharray="4 3"
            opacity="0.65"
          />
        )}

        <g className="star-legend">
          {[
            ["3", "massima priorità"],
            ["2", "azione richiesta"],
            ["1", "monitoraggio"],
            ["0", "nessuna azione"],
          ].map(([score, label], index) => (
            <g key={score} transform={`translate(16 ${18 + index * 18})`}>
              <rect width="10" height="10" className={`legend-fill score-${score}`} />
              <text x="16" y="9">
                {score} - {label}
              </text>
            </g>
          ))}
        </g>

        {/* Coverage numbers around axes */}
        {bands.map((entry, index) => {
          const point = polarPoint(center, radius + 58, index, axes);
          return (
            <text
              key={`coverage-${entry.domain.id}`}
              x={point.x}
              y={point.y + 13}
              textAnchor="middle"
              className={`coverage-label ${hoveredIndex === index ? "is-hovered" : ""}`}
            >
              {entry.answered}/{entry.total}
            </text>
          );
        })}

        {/* Interactive SVG tooltip banner if an axis is hovered */}
        {activeBand && (
          <g transform={`translate(${center}, ${size - 28})`}>
            <rect
              x="-140"
              y="-14"
              width="280"
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
              {activeBand.domain.title}: {Math.round(activeBand.cumulative[2] * 100)}% bisogni attivi
            </text>
          </g>
        )}
      </svg>
    </figure>
  );
}
