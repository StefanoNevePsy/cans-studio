import { CalendarDays, GitMerge, Trash2 } from "lucide-react";
import { getInstrument } from "../../cansData";
import type { Assessment } from "../../types/cans";
import { formatDate, statusLabel } from "../../utils/cansMath";

export function ArchiveView({
  patientAssessments,
  selectedAssessment,
  selectedAdministrationId,
  selectAssessment,
  selectAdministration,
  deleteAssessment,
  deleteAdministration,
  startFusion,
}: {
  patientAssessments: Assessment[];
  selectedAssessment: Assessment;
  selectedAdministrationId: string;
  selectAssessment: (id: string) => void;
  selectAdministration: (id: string) => void;
  deleteAssessment: () => void;
  deleteAdministration: (id: string) => void;
  startFusion: () => void;
}) {
  return (
    <section className="archive-panel">
      <div className="panel-heading">
        <div>
          <p className="eyeline">Tracciabilità completa</p>
          <h2>Archivio intervalli e fonti</h2>
          <p className="heading-support">
            Le sottosomministrazioni restano recuperabili anche dopo la fusione.
          </p>
        </div>
        <button className="primary-button" onClick={startFusion}>
          <GitMerge size={16} /> Apri fusione
        </button>
      </div>
      <div className="archive-layout">
        <div className="assessment-timeline">
          {patientAssessments.map((assessment) => {
            const completedSources = assessment.administrations.filter(
              (entry) => entry.status === "completed",
            ).length;
            return (
              <button
                className={`timeline-row ${
                  assessment.id === selectedAssessment.id ? "is-active" : ""
                }`}
                key={assessment.id}
                onClick={() => selectAssessment(assessment.id)}
              >
                <CalendarDays size={18} />
                <span>
                  <strong>{assessment.interval}</strong>
                  <em>
                    {formatDate(assessment.date)} -{" "}
                    {getInstrument(assessment.instrumentId).title}
                  </em>
                </span>
                <span className={`status-badge ${assessment.status}`}>
                  {assessment.status === "final" ? "Finale" : "Aperto"}
                </span>
                <span>
                  {completedSources}/{assessment.administrations.length} fonti complete
                </span>
              </button>
            );
          })}
        </div>
        <div className="source-archive">
          <div className="source-archive-heading">
            <div>
              <h3>{selectedAssessment.interval}</h3>
              <p>{selectedAssessment.administrations.length} sottosomministrazioni</p>
            </div>
            <span className={`status-badge ${selectedAssessment.status}`}>
              {selectedAssessment.status === "final"
                ? "Valutazione finale salvata"
                : "Da finalizzare"}
            </span>
          </div>
          {selectedAssessment.administrations.map((administration) => {
            const scored = Object.values(administration.scores).filter(
              (value) => value !== undefined,
            ).length;
            const notes = Object.values(administration.itemNotes).filter(Boolean).length;
            return (
              <article
                className={`source-card ${
                  administration.id === selectedAdministrationId ? "is-active" : ""
                }`}
                key={administration.id}
              >
                <button
                  className="source-card-main"
                  onClick={() => selectAdministration(administration.id)}
                >
                  <span className={`source-status-dot ${administration.status}`} />
                  <span>
                    <strong>{administration.label}</strong>
                    <em>
                      {administration.respondentRole || "Ruolo non indicato"} ·{" "}
                      {formatDate(administration.date)}
                    </em>
                  </span>
                  <span>{scored} punteggi</span>
                  <span>{notes} note</span>
                  <span className={`status-badge ${administration.status}`}>
                    {statusLabel(administration.status)}
                  </span>
                </button>
                <button
                  className="mini-icon-button"
                  onClick={() => deleteAdministration(administration.id)}
                  disabled={selectedAssessment.administrations.length <= 1}
                  aria-label={`Elimina ${administration.label}`}
                  title="Elimina sottosomministrazione"
                >
                  <Trash2 size={15} />
                </button>
              </article>
            );
          })}
          {selectedAssessment.finalNotes && (
            <div className="notes-block">
              <h3>Nota finale</h3>
              <p>{selectedAssessment.finalNotes}</p>
            </div>
          )}
        </div>
      </div>
      <button className="danger-button" onClick={deleteAssessment}>
        <Trash2 size={16} /> Elimina l’intero intervallo selezionato
      </button>
    </section>
  );
}
