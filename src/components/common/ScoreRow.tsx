import { Info, MessageSquarePlus } from "lucide-react";
import React, { useState } from "react";
import { binaryAnchors, CansItem } from "../../cansData";
import { scoreClass, scoreLabel } from "../../utils/cansMath";

export interface ScoreRowProps {
  item: CansItem;
  value: number | undefined;
  note: string;
  setScore: (itemId: string, value: number) => void;
  setNote: (itemId: string, note: string) => void;
  openInfo: (item: CansItem) => void;
  readOnly: boolean;
}

export const ScoreRow = React.memo(function ScoreRow({
  item,
  value,
  note,
  setScore,
  setNote,
  openInfo,
  readOnly,
}: ScoreRowProps) {
  const [noteOpen, setNoteOpen] = useState(Boolean(note));
  const values = item.kind === "binary" ? [0, 1] : [0, 1, 2, 3];
  const scoreSlots = [0, 1, 2, 3].map((entry) =>
    values.includes(entry) ? entry : undefined,
  );

  return (
    <div className={`score-row ${noteOpen ? "has-note-editor" : ""}`}>
      <div className="item-copy">
        <strong>{item.label}</strong>
        <span className={scoreClass(item, value)}>{scoreLabel(item, value)}</span>
        {item.opensModule && <em>apre modulo se &gt; 0</em>}
      </div>
      {scoreSlots.map((entry, index) => (
        <div className="score-cell" key={index}>
          {entry === undefined ? (
            <span className="score-cell-empty" aria-hidden="true" />
          ) : (
            <button
              className={`matrix-score-button ${
                value === entry ? "is-selected" : ""
              } ${scoreClass(item, entry)}`}
              onClick={() => setScore(item.id, entry)}
              aria-label={`${item.label}: ${scoreLabel(item, entry)}`}
              aria-pressed={value === entry}
              disabled={readOnly}
              title={scoreLabel(item, entry)}
            >
              {item.kind === "binary" ? binaryAnchors[entry] : entry}
            </button>
          )}
        </div>
      ))}
      <div className="item-row-actions">
        <button
          className="mini-icon-button"
          onClick={() => openInfo(item)}
          aria-label={`Informazioni su ${item.label}`}
          title="Descrizione e criteri dal manuale"
        >
          <Info size={15} />
        </button>
        <button
          className={`mini-icon-button ${note ? "has-content" : ""}`}
          onClick={() => setNoteOpen((open) => !open)}
          aria-label={`Nota per ${item.label}`}
          title="Aggiungi una nota al punteggio"
        >
          <MessageSquarePlus size={15} />
        </button>
      </div>
      {noteOpen && (
        <div className="item-note-editor">
          <label>
            Motivo del punteggio
            <textarea
              value={note}
              disabled={readOnly}
              maxLength={600}
              onChange={(event) => setNote(item.id, event.target.value)}
              placeholder="Breve nota clinica utile al confronto tra le fonti"
            />
          </label>
          <span>{note.length}/600</span>
        </div>
      )}
    </div>
  );
});
