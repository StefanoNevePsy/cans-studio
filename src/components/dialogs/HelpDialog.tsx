import {
  AlertTriangle,
  Archive,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Download,
  FileSpreadsheet,
  FileUp,
  GitMerge,
  Info,
  KeyRound,
  LineChart,
  LockKeyhole,
  MessageSquarePlus,
  Moon,
  Pause,
  Pencil,
  Play,
  Radar,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Trash2,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { ReactNode, useEffect, useState } from "react";
import type { HelpTopic } from "../../types/cans";
import { scoreClass } from "../../utils/cansMath";

export function HelpDialog({ close }: { close: () => void }) {
  const [topic, setTopic] = useState<HelpTopic>("overview");

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [close]);

  const topics: {
    id: HelpTopic;
    label: string;
    icon: ReactNode;
  }[] = [
    { id: "overview", label: "Primi passi", icon: <Play size={17} /> },
    { id: "patients", label: "Persone e tempi", icon: <UsersRound size={17} /> },
    { id: "scoring", label: "Compilazione", icon: <ClipboardList size={17} /> },
    { id: "fusion", label: "Fusione", icon: <GitMerge size={17} /> },
    { id: "results", label: "Risultati", icon: <Radar size={17} /> },
    { id: "data", label: "Dati e sicurezza", icon: <ShieldCheck size={17} /> },
  ];

  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <section
        className="modal help-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <p className="eyeline">Guida operativa</p>
            <h2 id="help-title">Manuale di CANS Studio</h2>
          </div>
          <button className="icon-button" onClick={close} aria-label="Chiudi">
            <X size={18} />
          </button>
        </div>

        <div className="help-layout">
          <nav className="help-navigation" aria-label="Capitoli del manuale">
            {topics.map((entry) => (
              <button
                className={topic === entry.id ? "is-active" : ""}
                key={entry.id}
                onClick={() => setTopic(entry.id)}
              >
                {entry.icon}
                <span>{entry.label}</span>
                <ChevronRight size={15} aria-hidden="true" />
              </button>
            ))}
          </nav>

          <div className="help-content">
            {topic === "overview" && (
              <>
                <HelpHeading
                  icon={<Play size={22} />}
                  title="Dalla registrazione al risultato finale"
                  description="Il flusso principale segue una sequenza stabile. Puoi interromperlo e riprenderlo senza perdere il lavoro."
                />
                <div className="help-workflow" aria-label="Flusso principale">
                  <HelpStep icon={<UserRound size={18} />} title="Persona">
                    Inserisci nome, cognome e data di nascita.
                  </HelpStep>
                  <ChevronRight size={18} aria-hidden="true" />
                  <HelpStep icon={<CalendarDays size={18} />} title="Intervallo T">
                    Crea un T0, T1 o successivo con lo strumento adatto all'età.
                  </HelpStep>
                  <ChevronRight size={18} aria-hidden="true" />
                  <HelpStep icon={<ClipboardList size={18} />} title="Fonti">
                    Compila una o più sottosomministrazioni.
                  </HelpStep>
                  <ChevronRight size={18} aria-hidden="true" />
                  <HelpStep icon={<GitMerge size={18} />} title="Finale">
                    Confronta le fonti e salva il punteggio condiviso.
                  </HelpStep>
                </div>
                <HelpCallout icon={<Info size={19} />} title="Salvataggio automatico">
                  Punteggi, note e stato delle somministrazioni vengono conservati
                  automaticamente sul dispositivo. Non serve un pulsante Salva durante
                  la compilazione.
                </HelpCallout>
                <HelpFeatureRows
                  rows={[
                    {
                      icon: <Moon size={18} />,
                      title: "Tema chiaro o scuro",
                      text: "Usa il pulsante con sole o luna nella barra superiore.",
                    },
                    {
                      icon: <BookOpen size={18} />,
                      title: "Riaprire questa guida",
                      text: "Il pulsante con il libro resta sempre nella barra superiore.",
                    },
                    {
                      icon: <Archive size={18} />,
                      title: "Ritrovare il lavoro",
                      text: "La scheda Archivio raccoglie intervalli, fonti, stati e note.",
                    },
                  ]}
                />
              </>
            )}

            {topic === "patients" && (
              <>
                <HelpHeading
                  icon={<UsersRound size={22} />}
                  title="Persone, intervalli e sottosomministrazioni"
                  description="Ogni persona può avere più valutazioni nel tempo e più fonti nello stesso intervallo."
                />
                <HelpFeatureRows
                  rows={[
                    {
                      icon: <UserRound size={18} />,
                      title: "Creare e cercare una persona",
                      text: "Compila l'anagrafica nella barra laterale. Il campo Cerca accetta nome, data o codice CANS.",
                    },
                    {
                      icon: <CalendarDays size={18} />,
                      title: "Creare un nuovo T",
                      text: "Seleziona Nuovo T 0-5 oppure Nuovo T 5-17+. Modifica data e nome dell'intervallo nella barra di contesto.",
                    },
                    {
                      icon: <UsersRound size={18} />,
                      title: "Aggiungere una fonte",
                      text: "Usa Nuova fonte nello stesso T per genitori, clinici, scuola, assistenti sociali o altri informatori.",
                    },
                    {
                      icon: <Pause size={18} />,
                      title: "Sospendere e riprendere",
                      text: "Sospendi una fonte incompleta e riprendila in seguito. I dati già inseriti restano disponibili.",
                    },
                  ]}
                />
                <HelpCallout icon={<Archive size={19} />} title="Valutazione finale e fonti">
                  Dopo la fusione, la valutazione finale viene mostrata per prima. Le
                  singole sottosomministrazioni restano consultabili e modificabili
                  dall'Archivio o dal selettore della fonte.
                </HelpCallout>
              </>
            )}

            {topic === "scoring" && (
              <>
                <HelpHeading
                  icon={<ClipboardList size={22} />}
                  title="Compilare le griglie CANS"
                  description="Le righe seguono le griglie dei manuali e mantengono visibili le colonne di punteggio."
                />
                <div className="help-score-scale" aria-label="Esempio scala di punteggio">
                  {[0, 1, 2, 3].map((score) => (
                    <span className={`manual-score-badge ${scoreClass({ id: "", label: "", kind: "need" }, score)}`} key={score}>
                      {score}
                    </span>
                  ))}
                  <p>
                    Per i bisogni, 2 e 3 richiedono azione. Per i punti di forza la
                    scala è invertita: 0 e 1 indicano risorse disponibili o utilizzabili.
                  </p>
                </div>
                <HelpFeatureRows
                  rows={[
                    {
                      icon: <Settings2 size={18} />,
                      title: "Punteggi chiari",
                      text: "Un item non inserito vale 0 nei calcoli ma resta non compilato fino alla scelta esplicita dell'operatore.",
                    },
                    {
                      icon: <ChevronRight size={18} />,
                      title: "Moduli di approfondimento",
                      text: "Quando un item di screening supera 0, il modulo associato compare immediatamente sotto la sua riga.",
                    },
                    {
                      icon: <Info size={18} />,
                      title: "Descrizioni e criteri",
                      text: "Apri il pulsante informazioni di un item per leggere descrizione e criteri 0-3. Puoi correggere il testo con Modifica testo.",
                    },
                    {
                      icon: <MessageSquarePlus size={18} />,
                      title: "Nota sul punteggio",
                      text: "Aggiungi una breve motivazione clinica: verrà mostrata durante il confronto tra le fonti.",
                    },
                  ]}
                />
              </>
            )}

            {topic === "fusion" && (
              <>
                <HelpHeading
                  icon={<GitMerge size={22} />}
                  title="Confrontare e fondere le fonti"
                  description="La fusione produce il punteggio definitivo della persona per quello specifico intervallo T."
                />
                <HelpFeatureRows
                  rows={[
                    {
                      icon: <CheckCircle2 size={18} />,
                      title: "Punteggi concordi",
                      text: "Quando tutte le fonti riportano lo stesso valore, l'app propone automaticamente quel punteggio.",
                    },
                    {
                      icon: <AlertTriangle size={18} />,
                      title: "Discordanze",
                      text: "Le differenze vengono evidenziate insieme alle note delle singole fonti. Anche un campo vuoto partecipa come 0 predefinito.",
                    },
                    {
                      icon: <Pencil size={18} />,
                      title: "Decisione finale",
                      text: "Scegli manualmente il valore condiviso e aggiungi, se utile, una nota sulla decisione.",
                    },
                    {
                      icon: <RotateCcw size={18} />,
                      title: "Correzioni successive",
                      text: "Se modifichi una fonte dopo la fusione, il T torna nello stato Da finalizzare per evitare risultati non aggiornati.",
                    },
                  ]}
                />
                <HelpCallout icon={<GitMerge size={19} />} title="Prima di salvare">
                  Controlla le discordanze, disattiva il filtro Solo punteggi discordanti
                  per una revisione completa e salva la valutazione finale.
                </HelpCallout>
              </>
            )}

            {topic === "results" && (
              <>
                <HelpHeading
                  icon={<Radar size={22} />}
                  title="Leggere risultati e andamento"
                  description="I risultati sono disponibili dopo il salvataggio della valutazione finale."
                />
                <HelpFeatureRows
                  rows={[
                    {
                      icon: <AlertTriangle size={18} />,
                      title: "Sintesi operative",
                      text: "Trovi bisogni azionabili, azioni intensive, punti di forza utilizzabili e risorse da costruire.",
                    },
                    {
                      icon: <Radar size={18} />,
                      title: "Stelle CANS",
                      text: "Le stelle mostrano bisogni e punti di forza secondo la rappresentazione formalizzata; tabelle e legende accompagnano sempre il grafico.",
                    },
                    {
                      icon: <LineChart size={18} />,
                      title: "Confronto nel tempo",
                      text: "La scheda Confronto mette in relazione il T corrente con la precedente valutazione finale dello stesso strumento.",
                    },
                    {
                      icon: <Download size={18} />,
                      title: "Esportare i grafici",
                      text: "Usa PNG grafici nella scheda Risultati finali per ottenere immagini ad alta risoluzione.",
                    },
                  ]}
                />
              </>
            )}

            {topic === "data" && (
              <>
                <HelpHeading
                  icon={<ShieldCheck size={22} />}
                  title="Backup, scambio dati e privacy"
                  description="L'app non usa un server centrale: dati clinici e anagrafici restano nel browser o nel dispositivo."
                />
                <HelpFeatureRows
                  rows={[
                    {
                      icon: <KeyRound size={18} />,
                      title: "Backup cifrato",
                      text: "Crea un file completo protetto da passphrase. Comunica il file e la passphrase attraverso canali separati.",
                    },
                    {
                      icon: <FileUp size={18} />,
                      title: "Importazione",
                      text: "Importa un backup cifrato per unire persone, intervalli, fonti e testi personalizzati con quelli già presenti.",
                    },
                    {
                      icon: <FileSpreadsheet size={18} />,
                      title: "Excel non cifrato",
                      text: "L'esportazione Excel contiene dati leggibili. Conservala e trasferiscila solo in ambienti autorizzati.",
                    },
                    {
                      icon: <Trash2 size={18} />,
                      title: "Eliminazione",
                      text: "Puoi svuotare una fonte o eliminare sottosomministrazioni e intervalli dall'Archivio. Le operazioni non sono annullabili.",
                    },
                  ]}
                />
                <HelpCallout icon={<LockKeyhole size={19} />} title="Passphrase">
                  La passphrase non può essere recuperata dall'app. Verifica il backup
                  prima di cancellare dati dal dispositivo e conserva la passphrase in
                  un luogo separato e autorizzato.
                </HelpCallout>
              </>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <p>
            La guida descrive il funzionamento dell'app. L'attribuzione dei punteggi
            resta responsabilità del professionista formato CANS.
          </p>
          <button className="primary-button" onClick={close}>Chiudi manuale</button>
        </div>
      </section>
    </div>
  );
}

function HelpHeading({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <header className="help-heading">
      <span>{icon}</span>
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </header>
  );
}

function HelpStep({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="help-step">
      <span>{icon}</span>
      <strong>{title}</strong>
      <p>{children}</p>
    </div>
  );
}

function HelpCallout({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <aside className="help-callout">
      <span>{icon}</span>
      <div>
        <strong>{title}</strong>
        <p>{children}</p>
      </div>
    </aside>
  );
}

function HelpFeatureRows({
  rows,
}: {
  rows: { icon: ReactNode; title: string; text: string }[];
}) {
  return (
    <div className="help-feature-list">
      {rows.map((row) => (
        <div className="help-feature-row" key={row.title}>
          <span>{row.icon}</span>
          <div>
            <strong>{row.title}</strong>
            <p>{row.text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
