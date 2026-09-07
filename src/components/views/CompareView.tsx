import { ArrowDown, ArrowUp, Layers, LineChart } from "lucide-react";
import { useState } from "react";
import { CansInstrument } from "../../cansData";
import type { Assessment } from "../../types/cans";
import { getNeedBands, getStats, getStrengthPoints } from "../../utils/cansMath";
import { CansNeedStarChart } from "../charts/CansNeedStarChart";
import { StrengthsStarChart } from "../charts/StrengthsStarChart";

export function CompareView({
  selectedAssessment,
  previousAssessment,
  instrument,
}: {
  selectedAssessment: Assessment;
  previousAssessment?: Assessment;
  instrument: CansInstrument;
}) {
  const [showOverlay, setShowOverlay] = useState(true);

  if (selectedAssessment.status !== "final") {
    return (
      <section className="empty-panel">
        <LineChart size={32} />
        <h2>Finalizza prima questo intervallo</h2>
        <p>Il confronto temporale usa solo valutazioni finali condivise.</p>
      </section>
    );
  }
  if (!previousAssessment) {
    return (
      <section className="empty-panel">
        <LineChart size={32} />
        <h2>Serve almeno un altro T finale</h2>
        <p>
          Finalizza un altro intervallo dello stesso strumento per confrontare
          domini, bisogni e punti di forza nel tempo.
        </p>
      </section>
    );
  }

  const currentStats = getStats(instrument, selectedAssessment.finalScores).filter(
    (entry) => entry.domain.type === "core",
  );
  const previousStats = getStats(instrument, previousAssessment.finalScores).filter(
    (entry) => entry.domain.type === "core",
  );
  const currentBands = getNeedBands(instrument, selectedAssessment.finalScores);
  const previousBands = getNeedBands(instrument, previousAssessment.finalScores);

  return (
    <section className="content-grid results-grid">
      <div className="main-panel">
        <div className="panel-heading">
          <div>
            <p className="eyeline">
              {previousAssessment.interval} → {selectedAssessment.interval}
            </p>
            <h2>Confronto tra valutazioni finali</h2>
          </div>
          <div className="inline-actions">
            <label className="toggle-control">
              <input
                type="checkbox"
                checked={showOverlay}
                onChange={(event) => setShowOverlay(event.target.checked)}
              />
              <Layers size={15} />
              <span>Sovrapposizione profilo precedente</span>
            </label>
          </div>
        </div>
        <div className="comparison-star-grid">
          <CansNeedStarChart
            bands={previousBands}
            title={`Bisogni ${previousAssessment.interval}`}
          />
          <CansNeedStarChart
            bands={currentBands}
            previousBands={showOverlay ? previousBands : undefined}
            title={`Bisogni ${selectedAssessment.interval}${showOverlay ? ` (con traccia ${previousAssessment.interval})` : ""}`}
          />
          <StrengthsStarChart
            points={getStrengthPoints(instrument, selectedAssessment.finalScores)}
            previousPoints={getStrengthPoints(
              instrument,
              previousAssessment.finalScores,
            )}
            title={`Punti di forza ${previousAssessment.interval}/${selectedAssessment.interval}`}
          />
        </div>
        <div className="trend-table">
          <div className="table-head">
            <span>Dominio</span>
            <span>Prima</span>
            <span>Ora</span>
            <span>Delta</span>
          </div>
          {currentStats.map((entry) => {
            const previous = previousStats.find(
              (item) => item.domain.id === entry.domain.id,
            );
            const before = Math.round((previous?.index ?? 0) * 100);
            const current = Math.round(entry.index * 100);
            const delta = current - before;
            return (
              <div className="table-row" key={entry.domain.id}>
                <strong>{entry.domain.shortTitle}</strong>
                <span>{before}%</span>
                <span>{current}%</span>
                <span className={delta > 0 ? "delta-up" : delta < 0 ? "delta-down" : ""}>
                  {delta > 0 ? (
                    <ArrowUp size={14} />
                  ) : delta < 0 ? (
                    <ArrowDown size={14} />
                  ) : null}
                  {delta > 0 ? "+" : ""}
                  {delta}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <aside className="side-panel">
        <div className="comparison-note">
          <h3>Lettura clinica</h3>
          <p>
            Il confronto mantiene separate le due stelle dei bisogni, così la
            composizione delle bande 0/1/2/3 resta leggibile.
          </p>
          <p>
            La linea tratteggiata sovrapposta sul T attuale rappresenta il contorno
            dei bisogni azionabili ($\ge 2$) dell’intervallo precedente per un
            colpo d’occhio immediato.
          </p>
          <p>
            Nei punti di forza, l’area più estesa indica maggiori risorse
            disponibili per il piano di intervento.
          </p>
        </div>
      </aside>
    </section>
  );
}
