import {
  Activity,
  AlertTriangle,
  Download,
  GitMerge,
  Info,
  LineChart,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { CansInstrument } from "../../cansData";
import type { Assessment, Tab } from "../../types/cans";
import {
  effectiveScore,
  flattenItems,
  getCompletion,
  getNeedBands,
  getStats,
  getStrengthPoints,
} from "../../utils/cansMath";
import { CansNeedStarChart } from "../charts/CansNeedStarChart";
import { StackedDomainChart } from "../charts/StackedDomainChart";
import { StrengthsStarChart } from "../charts/StrengthsStarChart";
import { Metric } from "../common/Metric";
import { ResultList } from "../common/ResultList";

export function ResultsView({
  instrument,
  assessment,
  finalCompletion,
  exportChartsPng,
  startFusion,
  setTab,
}: {
  instrument: CansInstrument;
  assessment: Assessment;
  finalCompletion: ReturnType<typeof getCompletion>;
  exportChartsPng: () => void;
  startFusion: () => void;
  setTab: (tab: Tab) => void;
}) {
  if (assessment.status !== "final") {
    return (
      <section className="empty-panel">
        <GitMerge size={34} />
        <h2>Questo T non è ancora finalizzato</h2>
        <p>
          Confronta le sottosomministrazioni, risolvi le eventuali discordanze e
          salva il punteggio definitivo prima di generare risultati e stella.
        </p>
        <button className="primary-button" onClick={startFusion}>
          <GitMerge size={16} /> Apri fusione
        </button>
      </section>
    );
  }

  const stats = getStats(instrument, assessment.finalScores).filter(
    (entry) => entry.domain.type === "core" || entry.domain.type === "transition",
  );
  const needBands = getNeedBands(instrument, assessment.finalScores);
  const allItems = flattenItems(instrument);
  const actionableItems = allItems.filter(
    ({ item }) =>
      item.kind === "need" &&
      effectiveScore(assessment.finalScores[item.id]) >= 2,
  );
  const urgentItems = actionableItems.filter(
    ({ item }) => effectiveScore(assessment.finalScores[item.id]) === 3,
  );
  const usefulStrengths = allItems.filter(
    ({ item }) =>
      item.kind === "strength" &&
      effectiveScore(assessment.finalScores[item.id]) <= 1,
  );
  const missingStrengths = allItems.filter(
    ({ item }) =>
      item.kind === "strength" &&
      effectiveScore(assessment.finalScores[item.id]) >= 2,
  );
  const strengthPoints = getStrengthPoints(instrument, assessment.finalScores);

  return (
    <section className="content-grid results-grid">
      <div className="main-panel">
        <div className="panel-heading">
          <div>
            <p className="eyeline">
              {instrument.title} - {assessment.interval}
            </p>
            <h2>Risultati finali e stella CANS</h2>
            <p className="heading-support">
              Calcolati dal punteggio finale condiviso; gli item non inseriti
              assumono valore 0, mentre la copertura indica quanti sono stati
              compilati esplicitamente.
            </p>
          </div>
          <div className="inline-actions">
            <button className="secondary-button" onClick={exportChartsPng}>
              <Download size={16} /> PNG grafici
            </button>
            <button className="secondary-button" onClick={() => setTab("compare")}>
              <LineChart size={16} /> Confronta nel tempo
            </button>
          </div>
        </div>

        <div className="summary-strip">
          <Metric
            icon={<AlertTriangle size={18} />}
            label="Bisogni azionabili"
            value={actionableItems.length}
            tone="warning"
          />
          <Metric
            icon={<Activity size={18} />}
            label="Azioni intensive"
            value={urgentItems.length}
            tone="danger"
          />
          <Metric
            icon={<Sparkles size={18} />}
            label="Punti di forza utili"
            value={usefulStrengths.length}
            tone="success"
          />
          <Metric
            icon={<ShieldCheck size={18} />}
            label="PDF da costruire"
            value={missingStrengths.length}
            tone="info"
          />
        </div>

        <div className="formal-note">
          <Info size={17} />
          <p>
            La stella dei bisogni segue la rappresentazione polare descritta da
            Benzoni et al.: ogni asse mostra la distribuzione percentuale 0/1/2/3
            del dominio; le bande sono cumulative e il rosso indica la massima
            priorità. La stella dei punti di forza inverte la scala: pieno significa
            risorsa disponibile, vuoto risorsa mancante o critica.
          </p>
        </div>

        <div className="cans-visual-stack">
          <div className="chart-pair">
            <CansNeedStarChart
              id="needs-star"
              bands={needBands}
              title="Stella CANS formalizzata - bisogni"
            />
            <StrengthsStarChart
              id="strengths-star"
              points={strengthPoints}
              title="Stella CANS formalizzata - punti di forza"
            />
          </div>
          <StackedDomainChart
            id="domain-stacked"
            bands={needBands}
            title="Distribuzione dei punteggi per dominio"
          />
          <div className="domain-table">
            <div className="table-head">
              <span>Dominio</span>
              <span>Compilati</span>
              <span>Azioni</span>
              <span>Indice descrittivo</span>
            </div>
            {stats.map((entry) => (
              <div className="table-row" key={entry.domain.id}>
                <strong>{entry.domain.shortTitle}</strong>
                <span>
                  {entry.answered}/{entry.total}
                </span>
                <span>
                  {entry.domain.items.some((item) => item.kind === "strength")
                    ? `${entry.usefulStrengths} PDF`
                    : `${entry.actionable} bisogni`}
                </span>
                <span>{Math.round(entry.index * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <aside className="side-panel list-panel">
        <div className="final-coverage">
          <span>Copertura finale</span>
          <strong>{finalCompletion.percentage}%</strong>
          <em>
            {finalCompletion.completed}/{finalCompletion.total} item
          </em>
        </div>
        <ResultList
          title="Priorità di azione"
          items={actionableItems}
          scores={assessment.finalScores}
          notes={assessment.finalItemNotes}
          empty="Nessun bisogno con punteggio 2 o 3."
        />
        <ResultList
          title="Punti di forza utilizzabili"
          items={usefulStrengths}
          scores={assessment.finalScores}
          notes={assessment.finalItemNotes}
          empty="Nessun punto di forza con punteggio 0 o 1."
        />
        <ResultList
          title="Da costruire o identificare"
          items={missingStrengths}
          scores={assessment.finalScores}
          notes={assessment.finalItemNotes}
          empty="Nessun punto di forza con punteggio 2 o 3."
        />
      </aside>
    </section>
  );
}
