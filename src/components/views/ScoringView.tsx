import {
  Check,
  CheckCircle2,
  Filter,
  GitMerge,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { CSSProperties, Fragment, useMemo, useState } from "react";
import {
  CansDomain,
  CansInstrument,
  CansItem,
  needAnchors,
  strengthAnchors,
} from "../../cansData";
import type { Administration, Assessment } from "../../types/cans";
import { getCompletion, splitDomainItems, statusLabel } from "../../utils/cansMath";
import { InlineModuleBlock } from "../common/InlineModuleBlock";
import { ScoreRow } from "../common/ScoreRow";

export function ScoringView({
  instrument,
  assessment,
  administration,
  viewingFinal,
  completion,
  displayedDomains,
  activatedModuleIds,
  triggeredModuleIds,
  domainFilter,
  setDomainFilter,
  setScore,
  setItemNote,
  openInfo,
  clearAdministration,
  updateAdministration,
  addAdministration,
  startFusion,
}: {
  instrument: CansInstrument;
  assessment: Assessment;
  administration: Administration;
  viewingFinal: boolean;
  completion: ReturnType<typeof getCompletion>;
  displayedDomains: CansDomain[];
  activatedModuleIds: Set<string>;
  triggeredModuleIds: Set<string>;
  domainFilter: string;
  setDomainFilter: (value: string) => void;
  setScore: (itemId: string, value: number) => void;
  setItemNote: (itemId: string, note: string) => void;
  openInfo: (item: CansItem) => void;
  clearAdministration: () => void;
  updateAdministration: (
    patch: Partial<Administration>,
    invalidateFinal?: boolean,
  ) => void;
  addAdministration: () => void;
  startFusion: () => void;
}) {
  const [showOnlyMissing, setShowOnlyMissing] = useState(false);
  const readOnly = viewingFinal || administration.status !== "in_progress";

  const inlineModuleByItemId = useMemo(() => {
    const result = new Map<string, CansDomain>();
    const assignedModules = new Set<string>();
    displayedDomains.forEach((domain) => {
      domain.items.forEach((item) => {
        if (
          !item.opensModule ||
          !triggeredModuleIds.has(item.opensModule) ||
          assignedModules.has(item.opensModule)
        ) {
          return;
        }
        const module = instrument.domains.find(
          (candidate) => candidate.id === item.opensModule,
        );
        if (!module) return;
        result.set(item.id, module);
        assignedModules.add(module.id);
      });
    });
    return result;
  }, [displayedDomains, instrument.domains, triggeredModuleIds]);

  const scrollToDomain = (domainId: string) => {
    const element = document.getElementById(`domain-${domainId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <section className="content-grid scoring-grid">
      <div className="main-panel">
        <div className="panel-heading">
          <div>
            <p className="eyeline">{instrument.version}</p>
            <h2>{administration.label}</h2>
            <p className="heading-support">
              {viewingFinal
                ? "Vista completa del punteggio condiviso. Seleziona una fonte per consultarne o correggerne i dati."
                : "Ogni modifica viene salvata automaticamente in questa fonte."}
            </p>
          </div>
          <div className="scoring-filters">
            <label className="toggle-control missing-filter-toggle">
              <input
                type="checkbox"
                checked={showOnlyMissing}
                onChange={(event) => setShowOnlyMissing(event.target.checked)}
              />
              <Filter size={15} />
              <span>Solo non compilati</span>
            </label>
            <label className="domain-filter">
              Dominio
              <select
                value={domainFilter}
                onChange={(event) => setDomainFilter(event.target.value)}
              >
                <option value="all-core">Domini principali</option>
                <option value="all">Tutto lo strumento</option>
                {instrument.domains.map((domain) => (
                  <option value={domain.id} key={domain.id}>
                    {domain.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* Sticky domain anchor navigation bar for fast jumping */}
        <nav className="domain-anchor-nav" aria-label="Navigazione rapida domini">
          {displayedDomains.map((domain) => {
            const answeredCount = domain.items.filter(
              (item) => administration.scores[item.id] !== undefined,
            ).length;
            const isComplete = answeredCount === domain.items.length;
            return (
              <button
                key={domain.id}
                type="button"
                className={`domain-anchor-chip ${isComplete ? "is-complete" : ""}`}
                onClick={() => scrollToDomain(domain.id)}
                title={`Salta a ${domain.title}`}
              >
                <span>{domain.shortTitle}</span>
                <span className="anchor-count">
                  {answeredCount}/{domain.items.length}
                </span>
              </button>
            );
          })}
        </nav>

        <div
          className={`administration-state ${
            viewingFinal ? "completed" : administration.status
          }`}
        >
          <div>
            {viewingFinal ? (
              <CheckCircle2 size={18} />
            ) : administration.status === "suspended" ? (
              <Pause size={18} />
            ) : administration.status === "completed" ? (
              <CheckCircle2 size={18} />
            ) : (
              <Play size={18} />
            )}
            <span>
              <strong>
                {viewingFinal ? "Valutazione finale" : statusLabel(administration.status)}
              </strong>
              {viewingFinal
                ? " I punteggi derivano dalla fusione e sono consultabili per intero."
                : administration.status === "suspended"
                ? " Puoi riprenderla senza perdere punteggi o note."
                : administration.status === "completed"
                  ? " Riaprila solo se devi correggere questa fonte."
                  : " Puoi sospenderla e continuare in un secondo momento."}
            </span>
          </div>
          {!viewingFinal && (
            <div className="inline-actions">
              {administration.status === "in_progress" ? (
                <>
                  <button
                    className="secondary-button"
                    onClick={() => updateAdministration({ status: "suspended" })}
                  >
                    <Pause size={16} /> Sospendi
                  </button>
                  <button
                    className="primary-button"
                    onClick={() => updateAdministration({ status: "completed" })}
                    disabled={!completion.completed}
                  >
                    <Check size={16} /> Completa fonte
                  </button>
                </>
              ) : (
                <button
                  className="secondary-button"
                  onClick={() => updateAdministration({ status: "in_progress" })}
                >
                  <RotateCcw size={16} /> Riprendi
                </button>
              )}
            </div>
          )}
        </div>

        {!viewingFinal && (
          <div className="source-metadata">
            <label>
              Nome della fonte
              <input
                value={administration.label}
                disabled={readOnly}
                onChange={(event) =>
                  updateAdministration({ label: event.target.value }, true)
                }
                placeholder="es. Genitori"
              />
            </label>
            <label>
              Intervistato o ruolo
              <input
                value={administration.respondentRole}
                disabled={readOnly}
                onChange={(event) =>
                  updateAdministration({ respondentRole: event.target.value }, true)
                }
                placeholder="es. Madre e padre"
              />
            </label>
            <label>
              Compilante
              <input
                value={administration.clinician}
                disabled={readOnly}
                onChange={(event) =>
                  updateAdministration({ clinician: event.target.value }, true)
                }
                placeholder="es. Assistente sociale"
              />
            </label>
            <label>
              Data
              <input
                type="date"
                value={administration.date}
                disabled={readOnly}
                onChange={(event) =>
                  updateAdministration({ date: event.target.value }, true)
                }
              />
            </label>
          </div>
        )}

        <div className="domain-stack">
          {displayedDomains.map((domain) => {
            const domainItemsList = showOnlyMissing
              ? domain.items.filter(
                  (item) => administration.scores[item.id] === undefined,
                )
              : domain.items;

            if (showOnlyMissing && domainItemsList.length === 0) {
              return null;
            }

            return (
              <section
                id={`domain-${domain.id}`}
                className={`domain-section ${
                  domain.items.length >= 10 ? "is-wide" : ""
                } ${activatedModuleIds.has(domain.id) ? "is-activated-module" : ""}`}
                key={domain.id}
              >
                <div className="domain-title">
                  <div>
                    <h3>{domain.title}</h3>
                    <p>
                      {activatedModuleIds.has(domain.id)
                        ? "Modulo attivato dal punteggio di screening"
                        : domain.type === "module"
                        ? "Modulo di approfondimento"
                        : domain.type === "placement"
                          ? "Modulo collocamento"
                          : domain.type === "transition"
                            ? "Dominio di transizione"
                            : "Dominio principale"}
                    </p>
                  </div>
                  <span>{domain.items.length} item</span>
                </div>
                <div className="domain-matrix">
                  {splitDomainItems(domainItemsList).map((items, columnIndex) => (
                    <div
                      className="score-matrix-column"
                      key={`${domain.id}-column-${columnIndex}`}
                    >
                      <div className="score-matrix">
                        <div className="score-matrix-head" aria-hidden="true">
                          <span>Item</span>
                          <span>0</span>
                          <span>1</span>
                          <span>2</span>
                          <span>3</span>
                          <span>Azioni</span>
                        </div>
                        {items.map((item) => {
                          const inlineModule = inlineModuleByItemId.get(item.id);
                          return (
                            <Fragment key={item.id}>
                              <ScoreRow
                                item={item}
                                value={administration.scores[item.id]}
                                note={administration.itemNotes[item.id] ?? ""}
                                setScore={setScore}
                                setNote={setItemNote}
                                openInfo={openInfo}
                                readOnly={readOnly}
                              />
                              {inlineModule && (
                                <InlineModuleBlock
                                  domain={inlineModule}
                                  administration={administration}
                                  setScore={setScore}
                                  setNote={setItemNote}
                                  openInfo={openInfo}
                                  readOnly={readOnly}
                                />
                              )}
                            </Fragment>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      <aside className="side-panel sticky-panel">
        <div
          className="progress-ring"
          style={{ "--progress": `${completion.percentage}%` } as CSSProperties}
        >
          <div>
            <strong>{completion.percentage}%</strong>
            <span>
              {completion.completed}/{completion.total} item
            </span>
          </div>
        </div>
        <div className="side-action-stack">
          <button className="secondary-button full" onClick={addAdministration}>
            <Plus size={16} /> Nuova fonte nello stesso T
          </button>
          <button className="primary-button full" onClick={startFusion}>
            <GitMerge size={16} /> Confronta e fondi
          </button>
        </div>
        <div className="legend-box">
          <h3>Legenda bisogni</h3>
          {needAnchors.map((anchor, index) => (
            <p key={anchor}>
              <span className={`score-dot need-${index}`}>{index}</span>
              {anchor.slice(4)}
            </p>
          ))}
        </div>
        <div className="legend-box">
          <h3>Legenda punti di forza</h3>
          {strengthAnchors.map((anchor, index) => (
            <p key={anchor}>
              <span className={`score-dot strength-${index}`}>{index}</span>
              {anchor.slice(4)}
            </p>
          ))}
        </div>
        {viewingFinal ? (
          administration.notes && (
            <div className="notes-block final-notes">
              <h3>Nota finale</h3>
              <p>{administration.notes}</p>
            </div>
          )
        ) : (
          <>
            <textarea
              className="general-note"
              value={administration.notes}
              disabled={readOnly}
              onChange={(event) =>
                updateAdministration({ notes: event.target.value }, true)
              }
              placeholder="Nota generale su questa sottosomministrazione"
              aria-label="Nota generale sottosomministrazione"
            />
            <button
              className="secondary-button full"
              onClick={clearAdministration}
              disabled={readOnly}
            >
              <Trash2 size={16} /> Svuota punteggi e note
            </button>
          </>
        )}
        {assessment.status === "final" && (
          <p className="muted-copy compact">
            Una modifica a una fonte riporta il T allo stato “da finalizzare”.
          </p>
        )}
      </aside>
    </section>
  );
}
