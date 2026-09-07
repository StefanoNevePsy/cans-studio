import { ClipboardList, Plus } from "lucide-react";
import type { CansInstrument } from "../../cansData";

export function EmptyAssessment({
  addAssessment,
  patientCode,
}: {
  addAssessment: (instrumentId: CansInstrument["id"]) => void;
  patientCode: string;
}) {
  return (
    <section className="empty-panel">
      <ClipboardList size={36} />
      <h2>Nessun intervallo per {patientCode}</h2>
      <p>
        Crea un T e poi aggiungi tutte le sottosomministrazioni necessarie: genitori,
        servizi, scuola, clinici o altre fonti.
      </p>
      <div className="inline-actions">
        <button className="secondary-button" onClick={() => addAssessment("cans-0-5")}>
          <Plus size={16} /> CANS 0-5
        </button>
        <button className="primary-button" onClick={() => addAssessment("cans-5-17")}>
          <Plus size={16} /> CANS 5-17+
        </button>
      </div>
    </section>
  );
}
