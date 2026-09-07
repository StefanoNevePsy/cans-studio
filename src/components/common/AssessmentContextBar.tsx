import { GitMerge, Plus } from "lucide-react";
import { CansInstrument, instruments } from "../../cansData";
import { finalAdministrationId } from "../../services/storage";
import type { Administration, Assessment } from "../../types/cans";
import { statusLabel } from "../../utils/cansMath";

export function AssessmentContextBar({
  assessment,
  administration,
  viewingFinal,
  updateAssessment,
  updateAdministration,
  selectAdministration,
  addAdministration,
  startFusion,
}: {
  assessment: Assessment;
  administration: Administration;
  viewingFinal: boolean;
  updateAssessment: (patch: Partial<Assessment>) => void;
  updateAdministration: (patch: Partial<Administration>) => void;
  selectAdministration: (id: string) => void;
  addAdministration: () => void;
  startFusion: () => void;
}) {
  const hasAnyScores = assessment.administrations.some((entry) =>
    Object.values(entry.scores).some((value) => value !== undefined),
  );

  return (
    <section className="assessment-context" aria-label="Intervallo e fonte selezionati">
      <div className="timepoint-fields">
        <label>
          Intervallo
          <input
            value={assessment.interval}
            onChange={(event) => updateAssessment({ interval: event.target.value })}
          />
        </label>
        <label>
          Data T
          <input
            type="date"
            value={assessment.date}
            onChange={(event) => updateAssessment({ date: event.target.value })}
          />
        </label>
        <label>
          Strumento
          <select
            value={assessment.instrumentId}
            disabled={hasAnyScores}
            onChange={(event) =>
              updateAssessment({
                instrumentId: event.target.value as CansInstrument["id"],
              })
            }
          >
            {instruments.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="source-switcher">
        <label>
          Vista compilazione
          <select
            value={administration.id}
            onChange={(event) => selectAdministration(event.target.value)}
          >
            {assessment.status === "final" && (
              <option value={finalAdministrationId}>
                Valutazione finale - fusione
              </option>
            )}
            {assessment.administrations.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label} - {statusLabel(entry.status)}
              </option>
            ))}
          </select>
        </label>
        <button className="icon-button" onClick={addAdministration} title="Aggiungi fonte">
          <Plus size={17} />
        </button>
      </div>
      <div className="context-status">
        <span className={`status-badge ${viewingFinal ? "completed" : assessment.status}`}>
          {viewingFinal
            ? "Vista finale"
            : assessment.status === "final"
              ? "Fonte originale"
              : "Da finalizzare"}
        </span>
        <button className="primary-button" onClick={startFusion} disabled={!hasAnyScores}>
          <GitMerge size={16} />
          {assessment.status === "final" ? "Rivedi fusione" : "Fondi punteggi"}
        </button>
      </div>
    </section>
  );
}
