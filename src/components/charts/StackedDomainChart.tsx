import type { NeedBand } from "../../types/cans";

export function StackedDomainChart({
  id,
  bands,
  title,
}: {
  id?: string;
  bands: NeedBand[];
  title: string;
}) {
  const width = 780;
  const rowHeight = 42;
  const height = 72 + bands.length * rowHeight;
  const barX = 190;
  const barWidth = 520;
  return (
    <figure className="star-card wide-chart">
      <figcaption>{title}</figcaption>
      <svg id={id} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
        {bands.map((entry, index) => {
          const y = 40 + index * rowHeight;
          let x = barX;
          return (
            <g key={entry.domain.id}>
              <text x="18" y={y + 16} className="bar-label">
                {entry.domain.shortTitle}
              </text>
              {entry.percentages.map((percentage, score) => {
                const segmentWidth = percentage * barWidth;
                const rect = (
                  <rect
                    key={score}
                    x={x}
                    y={y}
                    width={segmentWidth}
                    height="22"
                    className={`legend-fill score-${score}`}
                  />
                );
                x += segmentWidth;
                return rect;
              })}
              <rect
                x={barX}
                y={y}
                width={barWidth}
                height="22"
                className="bar-outline"
              />
              <text x={barX + barWidth + 10} y={y + 16} className="coverage-label">
                {entry.answered}/{entry.total}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
