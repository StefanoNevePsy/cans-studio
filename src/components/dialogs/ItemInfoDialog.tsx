import { Check, CircleHelp, Pencil, RotateCcw, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { CansItem } from "../../cansData";
import type {
  ItemGuidanceOverride,
  ManualDetail,
  ParsedManualDetail,
} from "../../types/cans";
import { scoreClass } from "../../utils/cansMath";

export function ItemInfoDialog({
  item,
  detail,
  loading,
  guidanceOverride,
  saveGuidance,
  resetGuidance,
  close,
}: {
  item: CansItem;
  detail?: ManualDetail;
  loading: boolean;
  guidanceOverride?: ItemGuidanceOverride;
  saveGuidance: (
    itemId: string,
    guidance: Omit<ItemGuidanceOverride, "updatedAt">,
  ) => void;
  resetGuidance: (itemId: string) => void;
  close: () => void;
}) {
  const parsed = useMemo(
    () =>
      detail
        ? {
            description: detail.description,
            scoreHints: Object.entries(detail.scoreHints)
              .map(([score, text]) => ({
                score: Number(score),
                text,
              }))
              .sort((left, right) => left.score - right.score),
          }
        : undefined,
    [detail],
  );
  const scoreValues = item.kind === "binary" ? [0, 1] : [0, 1, 2, 3];
  const resolvedGuidance = useMemo<ParsedManualDetail | undefined>(() => {
    if (!parsed && !guidanceOverride) return undefined;
    return {
      description:
        guidanceOverride?.description ?? parsed?.description ?? "",
      scoreHints: scoreValues.map((score) => ({
        score,
        text:
          guidanceOverride?.scoreHints[String(score)] ??
          parsed?.scoreHints.find((hint) => hint.score === score)?.text ??
          "",
      })),
    };
  }, [guidanceOverride, item.kind, parsed]);
  const [editing, setEditing] = useState(false);
  const [draftDescription, setDraftDescription] = useState("");
  const [draftHints, setDraftHints] = useState<Record<string, string>>({});
  const [editError, setEditError] = useState("");

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [close]);

  useEffect(() => {
    setEditing(false);
    setEditError("");
    setDraftDescription(resolvedGuidance?.description ?? "");
    setDraftHints(
      Object.fromEntries(
        (resolvedGuidance?.scoreHints ?? []).map((hint) => [
          String(hint.score),
          hint.text,
        ]),
      ),
    );
  }, [item.id, guidanceOverride, resolvedGuidance]);

  const beginEditing = () => {
    setDraftDescription(resolvedGuidance?.description ?? "");
    setDraftHints(
      Object.fromEntries(
        (resolvedGuidance?.scoreHints ?? []).map((hint) => [
          String(hint.score),
          hint.text,
        ]),
      ),
    );
    setEditError("");
    setEditing(true);
  };

  const saveEditing = () => {
    const description = draftDescription.trim();
    const scoreHints = Object.fromEntries(
      scoreValues.map((score) => [
        String(score),
        (draftHints[String(score)] ?? "").trim(),
      ]),
    );
    if (!description || Object.values(scoreHints).some((text) => !text)) {
      setEditError("Completa la descrizione e tutti i criteri di punteggio.");
      return;
    }
    saveGuidance(item.id, { description, scoreHints });
    setEditing(false);
  };

  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <section
        className="modal item-info-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="item-info-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <p className="eyeline">Manuale {detail?.source === "cans-0-5" ? "CANS 0-5" : "CANS 5-17+"}</p>
            <h2 id="item-info-title">{item.label}</h2>
          </div>
          <button className="icon-button" onClick={close} aria-label="Chiudi">
            <X size={18} />
          </button>
        </div>
        {loading ? (
          <div className="empty-inline">
            <CircleHelp size={22} />
            <p>Caricamento delle indicazioni dal manuale…</p>
          </div>
        ) : resolvedGuidance ? (
          <div className="manual-content">
            <section>
              <div className="manual-section-heading">
                <h3>Descrizione dell’item</h3>
                {guidanceOverride && !editing && (
                  <span className="status-badge in_progress">
                    Testo personalizzato
                  </span>
                )}
              </div>
              {editing ? (
                <textarea
                  className="manual-description-editor"
                  value={draftDescription}
                  onChange={(event) => setDraftDescription(event.target.value)}
                  aria-label={`Descrizione di ${item.label}`}
                />
              ) : (
                <p>{resolvedGuidance.description}</p>
              )}
            </section>
            {resolvedGuidance.scoreHints.length ? (
              <section>
                <h3>Come attribuire il punteggio</h3>
                <div className="manual-score-list">
                  {resolvedGuidance.scoreHints.map((hint) => (
                    <div
                      className={`manual-score-row ${editing ? "is-editing" : ""}`}
                      key={hint.score}
                    >
                      <span
                        className={`manual-score-badge ${scoreClass(
                          item,
                          hint.score,
                        )}`}
                        aria-label={`Punteggio ${hint.score}`}
                      >
                        {hint.score}
                      </span>
                      {editing ? (
                        <textarea
                          value={draftHints[String(hint.score)] ?? ""}
                          onChange={(event) =>
                            setDraftHints((current) => ({
                              ...current,
                              [String(hint.score)]: event.target.value,
                            }))
                          }
                          aria-label={`Criterio per il punteggio ${hint.score}`}
                        />
                      ) : (
                        <p>{hint.text}</p>
                      )}
                    </div>
                  ))}
                </div>
                {editError && <p className="form-error">{editError}</p>}
              </section>
            ) : null}
          </div>
        ) : (
          <div className="empty-inline">
            <CircleHelp size={22} />
            <p>Il dettaglio testuale non è disponibile per questo item.</p>
          </div>
        )}
        <div className="modal-footer">
          <p>
            {guidanceOverride
              ? "Le modifiche sono salvate sul dispositivo e incluse nel backup cifrato."
              : `Testo tratto dal manuale italiano allegato, pagina PDF ${detail?.page}. Il giudizio clinico resta affidato al professionista formato CANS.`}
          </p>
          <div className="inline-actions">
            {editing ? (
              <>
                {guidanceOverride && (
                  <button
                    className="secondary-button"
                    onClick={() => {
                      resetGuidance(item.id);
                      setEditing(false);
                    }}
                  >
                    <RotateCcw size={16} /> Ripristina originale
                  </button>
                )}
                <button
                  className="secondary-button"
                  onClick={() => setEditing(false)}
                >
                  Annulla
                </button>
                <button className="primary-button" onClick={saveEditing}>
                  <Check size={16} /> Salva modifiche
                </button>
              </>
            ) : (
              <>
                <button className="secondary-button" onClick={beginEditing}>
                  <Pencil size={16} /> Modifica testo
                </button>
                <button className="primary-button" onClick={close}>Chiudi</button>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
