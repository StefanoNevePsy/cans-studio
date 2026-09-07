import type { CansDomain, CansItem } from "../../cansData";
import { effectiveScore, scoreClass } from "../../utils/cansMath";

export function ResultList({
  title,
  items,
  scores,
  notes,
  empty,
}: {
  title: string;
  items: { domain: CansDomain; item: CansItem }[];
  scores: Record<string, number | undefined>;
  notes: Record<string, string | undefined>;
  empty: string;
}) {
  return (
    <section className="result-list">
      <h3>{title}</h3>
      {items.length ? (
        items.slice(0, 14).map(({ domain, item }) => (
          <div className="result-row" key={item.id}>
            <span
              className={`score-chip ${scoreClass(
                item,
                effectiveScore(scores[item.id]),
              )}`}
              title={
                scores[item.id] === undefined ? "0 predefinito" : undefined
              }
            >
              {effectiveScore(scores[item.id])}
            </span>
            <span>
              <strong>{item.label}</strong>
              <em>{domain.shortTitle}</em>
              {notes[item.id] && <small>{notes[item.id]}</small>}
            </span>
          </div>
        ))
      ) : (
        <p className="muted-copy">{empty}</p>
      )}
    </section>
  );
}
