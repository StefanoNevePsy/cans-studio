import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ClipboardList,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect } from "react";
import { binaryAnchors, CansInstrument } from "../../cansData";
import type { Assessment, FusionDraft } from "../../types/cans";
import {
  effectiveScore,
  flattenItems,
  scoreClass,
  scoreLabel,
} from "../../utils/cansMath";
import { Metric } from "../common/Metric";

export function FusionDialog({
  assessment,
  instrument,
  draft,
  setDraft,
  showOnlyDiscordant,
  setShowOnlyDiscordant,
  close,
  save,
}: {
  assessment: Assessment;
  instrument: CansInstrument;
  draft: FusionDraft;
  setDraft: (draft: FusionDraft) => void;
  showOnlyDiscordant: boolean;
  setShowOnlyDiscordant: (value: boolean) => void;
  close: () => void;
  save: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [close]);

  const rows = flattenItems(instrument).map(({ domain, item }) => {
    const sourceValues = assessment.administrations
      .map((administration) => administration.scores[item.id])
      .filter((val): val is number => val !== undefined);

    const hasAny = sourceValues.length > 0;
    const unique = Array.from(new Set(sourceValues));
    const discordant = hasAny && unique.length > 1;

    return {
      domain,
      item,
      discordant,
      hasAny,
      sourceValues,
    };
  });

  const discordantCount = rows.filter((row) => row.discordant).length;
  const visibleRows = rows
    .filter((row) => row.hasAny)
    .filter((row) => !showOnlyDiscordant || row.discordant)
    .sort((left, right) => Number(right.discordant) - Number(left.discordant));

  const unresolved = rows.filter(
    (row) => row.hasAny && draft.scores[row.item.id] === undefined,
  ).length;

  // Quick action: accept concordant scores where all sources with a score agreed
  const acceptConcordant = () => {
    const nextScores = { ...draft.scores };
    rows.forEach(({ item, hasAny, discordant, sourceValues }) => {
      if (hasAny && !discordant && sourceValues.length > 0) {
        nextScores[item.id] = sourceValues[0];
      }
    });
    setDraft({ ...draft, scores: nextScores });
  };

  // Quick action: set all undecided or discordant to highest severity / need
  const applyMaxNeed = () => {
    const nextScores = { ...draft.scores };
    rows.forEach(({ item, hasAny, sourceValues }) => {
      if (hasAny && sourceValues.length > 0) {
        if (item.kind === "strength") {
          // for strength, lower number is stronger, but higher need is higher number (3 = non identificato)
          nextScores[item.id] = Math.max(...sourceValues);
        } else {
          nextScores[item.id] = Math.max(...sourceValues);
        }
      }
    });
    setDraft({ ...draft, scores: nextScores });
  };

  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <section
        className="modal fusion-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fusion-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header fusion-header">
          <div>
            <p className="eyeline">
              {assessment.interval} - {instrument.title}
            </p>
            <h2 id="fusion-title">Fusione delle sottosomministrazioni</h2>
            <p>
              I punteggi concordi sono proposti automaticamente. Le righe evidenziate
              richiedono una decisione manuale.
            </p>
          </div>
          <button className="icon-button" onClick={close} aria-label="Chiudi">
            <X size={18} />
          </button>
        </div>

        <div className="fusion-toolbar">
          <div className="summary-strip compact-summary">
            <Metric
              icon={<AlertTriangle size={17} />}
              label="Discordanze"
              value={discordantCount}
              tone="warning"
            />
            <Metric
              icon={<ClipboardList size={17} />}
              label="Fonti"
              value={assessment.administrations.length}
              tone="info"
            />
            <Metric
              icon={<CheckCircle2 size={17} />}
              label="Da decidere"
              value={unresolved}
              tone={unresolved ? "danger" : "success"}
            />
          </div>

          <div className="inline-actions fusion-quick-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={acceptConcordant}
              title="Compila automaticamente tutti gli item su cui le fonti concordano"
            >
              <Check size={15} /> Accetta concordanti
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={applyMaxNeed}
              title="Imposta al punteggio di maggior gravità/bisogno rilevato"
            >
              <Sparkles size={15} /> Applica massimo bisogno
            </button>
            <label className="toggle-control">
              <input
                type="checkbox"
                checked={showOnlyDiscordant}
                onChange={(event) => setShowOnlyDiscordant(event.target.checked)}
              />
              <span>Solo punteggi discordanti</span>
            </label>
          </div>
        </div>

        <div className="fusion-table">
          {visibleRows.length ? (
            visibleRows.map(({ domain, item, discordant }) => {
              const values = item.kind === "binary" ? [0, 1] : [0, 1, 2, 3];
              return (
                <article
                  className={`fusion-row ${discordant ? "is-discordant" : ""}`}
                  key={item.id}
                >
                  <div className="fusion-item-title">
                    <span>{domain.shortTitle}</span>
                    <h3>{item.label}</h3>
                    {discordant && (
                      <em className="discordant-badge">Punteggi discordanti</em>
                    )}
                  </div>
                  <div className="source-evidence">
                    {assessment.administrations.map((administration) => {
                      const value = administration.scores[item.id];
                      const displayedValue = effectiveScore(value);
                      const note = administration.itemNotes[item.id];
                      return (
                        <div className="source-evidence-entry" key={administration.id}>
                          <div>
                            <strong>{administration.label}</strong>
                            <span
                              className={`score-chip ${
                                value !== undefined
                                  ? scoreClass(item, displayedValue)
                                  : "empty"
                              }`}
                              title={value === undefined ? "Non compilato" : undefined}
                            >
                              {value !== undefined ? displayedValue : "-"}
                            </span>
                          </div>
                          <p>{note || "Nessuna nota per questo item."}</p>
                        </div>
                      );
                    })}
                  </div>
                  <div className="final-decision">
                    <span>Punteggio finale</span>
                    <div className="score-buttons compact-buttons">
                      {values.map((value) => (
                        <button
                          key={value}
                          className={`${
                            draft.scores[item.id] === value ? "is-selected" : ""
                          } ${scoreClass(item, value)}`}
                          onClick={() =>
                            setDraft({
                              ...draft,
                              scores: { ...draft.scores, [item.id]: value },
                            })
                          }
                          title={scoreLabel(item, value)}
                        >
                          {item.kind === "binary" ? binaryAnchors[value] : value}
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={draft.notes[item.id] ?? ""}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          notes: {
                            ...draft.notes,
                            [item.id]: event.target.value || undefined,
                          },
                        })
                      }
                      placeholder="Nota sulla decisione finale, facoltativa"
                    />
                  </div>
                </article>
              );
            })
          ) : (
            <div className="empty-inline">
              <CheckCircle2 size={24} />
              <p>
                {showOnlyDiscordant
                  ? "Non ci sono punteggi discordanti. Mostra tutti gli item per controllare la proposta finale."
                  : "Nessun item è stato ancora punteggiato nelle fonti."}
              </p>
            </div>
          )}
        </div>

        <div className="modal-footer fusion-footer">
          <p>
            {unresolved
              ? `Decidi ancora ${unresolved} item prima di salvare.`
              : "Tutti gli item compilati nelle fonti hanno un punteggio finale."}
          </p>
          <div className="inline-actions">
            <button className="secondary-button" onClick={close}>Annulla</button>
            <button className="primary-button" onClick={save} disabled={Boolean(unresolved)}>
              <Check size={16} /> Salva valutazione finale
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
