import React from "react";
import type { CansDomain, CansItem } from "../../cansData";
import type { Administration } from "../../types/cans";
import { ScoreRow } from "./ScoreRow";

export interface InlineModuleBlockProps {
  domain: CansDomain;
  administration: Administration;
  setScore: (itemId: string, value: number) => void;
  setNote: (itemId: string, note: string) => void;
  openInfo: (item: CansItem) => void;
  readOnly: boolean;
}

export const InlineModuleBlock = React.memo(function InlineModuleBlock({
  domain,
  administration,
  setScore,
  setNote,
  openInfo,
  readOnly,
}: InlineModuleBlockProps) {
  return (
    <section className="inline-module">
      <div className="inline-module-heading">
        <div>
          <h4>{domain.title}</h4>
          <p>Approfondimento attivato dal punteggio precedente</p>
        </div>
        <span>{domain.items.length} item</span>
      </div>
      <div className="inline-module-matrix">
        <div className="score-matrix-head" aria-hidden="true">
          <span>Item</span>
          <span>0</span>
          <span>1</span>
          <span>2</span>
          <span>3</span>
          <span>Azioni</span>
        </div>
        {domain.items.map((item) => (
          <ScoreRow
            key={item.id}
            item={item}
            value={administration.scores[item.id]}
            note={administration.itemNotes[item.id] ?? ""}
            setScore={setScore}
            setNote={setNote}
            openInfo={openInfo}
            readOnly={readOnly}
          />
        ))}
      </div>
    </section>
  );
});
