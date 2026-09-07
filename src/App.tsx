import {
  BookOpen,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  FileJson,
  FileSpreadsheet,
  FileUp,
  LineChart,
  Lock,
  LockKeyhole,
  Menu,
  Moon,
  Plus,
  Radar,
  Search,
  ShieldCheck,
  Sun,
  Unlock,
  UserRound,
  X,
} from "lucide-react";
import {
  ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CansDomain,
  CansInstrument,
  CansItem,
  getInstrument,
} from "./cansData";
import { EmptyAssessment } from "./components/common/EmptyAssessment";
import { EmptyPatient } from "./components/common/EmptyPatient";
import { TabButton } from "./components/common/TabButton";
import { AssessmentContextBar } from "./components/common/AssessmentContextBar";
import { BackupDialog } from "./components/dialogs/BackupDialog";
import { FusionDialog } from "./components/dialogs/FusionDialog";
import { HelpDialog } from "./components/dialogs/HelpDialog";
import { ItemInfoDialog } from "./components/dialogs/ItemInfoDialog";
import { ArchiveView } from "./components/views/ArchiveView";
import { CompareView } from "./components/views/CompareView";
import { ResultsView } from "./components/views/ResultsView";
import { ScoringView } from "./components/views/ScoringView";
import {
  compactToken,
  decryptBackup,
  downloadBlob,
  downloadSvgPng,
  encryptBackup,
  isEncryptedBackup,
  makePatientCode,
  nowIso,
  today,
  uid,
} from "./services/crypto";
import { exportExcel } from "./services/excelExport";
import {
  createAdministration,
  createAssessment,
  finalAdministrationId,
  loadState,
  mergeById,
  parseState,
  saveState,
  storageKey,
  themeKey,
} from "./services/storage";
import type {
  Administration,
  Assessment,
  BackupDialogState,
  FusionDraft,
  ItemGuidanceOverride,
  ItemInfoState,
  ManualDetail,
  Patient,
  StoredState,
  Tab,
  ThemeMode,
} from "./types/cans";
import {
  composeBirthDate,
  flattenItems,
  formatDate,
  getActivatedModuleIds,
  getCompletion,
  getTriggeredModuleIds,
  patientName,
} from "./utils/cansMath";

export function App() {
  const [state, setState] = useState<StoredState>(() => loadState());
  const [theme, setTheme] = useState<ThemeMode>(() =>
    localStorage.getItem(themeKey) === "dark" ? "dark" : "light",
  );
  const [tab, setTab] = useState<Tab>("score");
  const [query, setQuery] = useState("");
  const [domainFilter, setDomainFilter] = useState("all-core");
  const [firstNameDraft, setFirstNameDraft] = useState("");
  const [lastNameDraft, setLastNameDraft] = useState("");
  const [birthDayDraft, setBirthDayDraft] = useState("");
  const [birthMonthDraft, setBirthMonthDraft] = useState("");
  const [birthYearDraft, setBirthYearDraft] = useState("");
  const [infoState, setInfoState] = useState<ItemInfoState | null>(null);
  const [fusionDraft, setFusionDraft] = useState<FusionDraft | null>(null);
  const [backupDialog, setBackupDialog] = useState<BackupDialogState | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [showOnlyDiscordant, setShowOnlyDiscordant] = useState(true);
  const [notice, setNotice] = useState("");
  const [isLocked, setIsLocked] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Safe persistence with try/catch
  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(themeKey, theme);
  }, [theme]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const patients = state.patients;
  const selectedPatient =
    patients.find((patient) => patient.id === state.selectedPatientId) ??
    patients[0];

  const patientAssessments = useMemo(
    () =>
      state.assessments
        .filter((assessment) => assessment.patientId === selectedPatient?.id)
        .sort((left, right) => {
          const dateOrder = right.date.localeCompare(left.date);
          return dateOrder || right.updatedAt.localeCompare(left.updatedAt);
        }),
    [selectedPatient?.id, state.assessments],
  );

  const selectedAssessment =
    patientAssessments.find(
      (assessment) => assessment.id === state.selectedAssessmentId,
    ) ?? patientAssessments[0];

  const viewingFinal =
    selectedAssessment?.status === "final" &&
    state.selectedAdministrationId === finalAdministrationId;

  const selectedAdministration = viewingFinal
    ? undefined
    : selectedAssessment?.administrations.find(
        (administration) => administration.id === state.selectedAdministrationId,
      ) ?? selectedAssessment?.administrations[0];

  const scoringAdministration: Administration | undefined =
    viewingFinal && selectedAssessment
      ? {
          id: finalAdministrationId,
          label: "Valutazione finale",
          respondentRole: "Fusione delle sottosomministrazioni",
          clinician: "",
          date:
            selectedAssessment.finalizedAt?.slice(0, 10) ??
            selectedAssessment.date,
          status: "completed",
          scores: selectedAssessment.finalScores,
          itemNotes: selectedAssessment.finalItemNotes,
          notes: selectedAssessment.finalNotes,
          updatedAt:
            selectedAssessment.finalizedAt ?? selectedAssessment.updatedAt,
        }
      : selectedAdministration;

  const instrument = getInstrument(
    selectedAssessment?.instrumentId ?? "cans-5-17",
  );

  const completion = getCompletion(
    instrument,
    scoringAdministration?.scores ?? {},
  );
  const finalCompletion = getCompletion(
    instrument,
    selectedAssessment?.finalScores ?? {},
  );

  const normalizedQuery = query.trim().toLocaleLowerCase("it");
  const filteredPatients = patients.filter((patient) =>
    [patientName(patient), patient.birthDate, patient.code]
      .join(" ")
      .toLocaleLowerCase("it")
      .includes(normalizedQuery),
  );

  const finalAssessments = patientAssessments
    .filter(
      (assessment) =>
        assessment.status === "final" &&
        assessment.instrumentId === selectedAssessment?.instrumentId,
    )
    .sort((left, right) => left.date.localeCompare(right.date));

  const currentFinalIndex = finalAssessments.findIndex(
    (assessment) => assessment.id === selectedAssessment?.id,
  );
  const previousAssessment =
    currentFinalIndex > 0 ? finalAssessments[currentFinalIndex - 1] : undefined;

  const updateState = (recipe: (current: StoredState) => StoredState) =>
    setState((current) => recipe(current));

  const selectPatient = (patientId: string) => {
    const firstAssessment = state.assessments
      .filter((assessment) => assessment.patientId === patientId)
      .sort((left, right) => right.date.localeCompare(left.date))[0];
    updateState((current) => ({
      ...current,
      selectedPatientId: patientId,
      selectedAssessmentId: firstAssessment?.id ?? "",
      selectedAdministrationId:
        firstAssessment?.status === "final"
          ? finalAdministrationId
          : firstAssessment?.administrations[0]?.id ?? "",
    }));
    setSidebarOpen(false);
  };

  const addPatient = () => {
    const firstName = firstNameDraft.trim();
    const lastName = lastNameDraft.trim();
    const birthDate = composeBirthDate(
      birthDayDraft,
      birthMonthDraft,
      birthYearDraft,
    );
    if (!firstName || !lastName || !birthDate) {
      setNotice("Inserisci nome, cognome e una data di nascita valida.");
      return;
    }
    const patient: Patient = {
      id: uid("patient"),
      code: makePatientCode(state.installationId),
      firstName,
      lastName,
      birthDate,
      createdAt: nowIso(),
    };
    updateState((current) => ({
      ...current,
      patients: [...current.patients, patient],
      selectedPatientId: patient.id,
      selectedAssessmentId: "",
      selectedAdministrationId: "",
    }));
    setFirstNameDraft("");
    setLastNameDraft("");
    setBirthDayDraft("");
    setBirthMonthDraft("");
    setBirthYearDraft("");
    setNotice(`Aggiunta la persona ${patientName(patient)}.`);
  };

  const addAssessment = (instrumentId: CansInstrument["id"]) => {
    if (!selectedPatient) return;
    const position = patientAssessments.length;
    const assessment = createAssessment(selectedPatient.id, instrumentId, position);
    updateState((current) => ({
      ...current,
      assessments: [assessment, ...current.assessments],
      selectedAssessmentId: assessment.id,
      selectedAdministrationId: assessment.administrations[0].id,
    }));
    setTab("score");
    setNotice(`Creato ${assessment.interval}.`);
  };

  const selectAssessment = (assessmentId: string) => {
    const target = state.assessments.find(
      (assessment) => assessment.id === assessmentId,
    );
    updateState((current) => ({
      ...current,
      selectedAssessmentId: assessmentId,
      selectedAdministrationId:
        target?.status === "final"
          ? finalAdministrationId
          : target?.administrations[0]?.id ?? "",
    }));
  };

  const updateAssessment = (patch: Partial<Assessment>) => {
    if (!selectedAssessment) return;
    updateState((current) => ({
      ...current,
      assessments: current.assessments.map((assessment) =>
        assessment.id === selectedAssessment.id
          ? { ...assessment, ...patch, updatedAt: nowIso() }
          : assessment,
      ),
    }));
  };

  const deleteAssessment = () => {
    if (!selectedAssessment) return;
    updateState((current) => {
      const remaining = current.assessments.filter(
        (assessment) => assessment.id !== selectedAssessment.id,
      );
      const nextSelected = remaining.find(
        (assessment) => assessment.patientId === selectedPatient?.id,
      );
      return {
        ...current,
        assessments: remaining,
        selectedAssessmentId: nextSelected?.id ?? "",
        selectedAdministrationId:
          nextSelected?.status === "final"
            ? finalAdministrationId
            : nextSelected?.administrations[0]?.id ?? "",
      };
    });
    setNotice("Intervallo T eliminato.");
  };

  const addAdministration = () => {
    if (!selectedAssessment) return;
    const administration = createAdministration(
      selectedAssessment.administrations.length + 1,
    );
    updateState((current) => ({
      ...current,
      selectedAdministrationId: administration.id,
      assessments: current.assessments.map((assessment) =>
        assessment.id === selectedAssessment.id
          ? {
              ...assessment,
              status: "draft",
              administrations: [...assessment.administrations, administration],
              updatedAt: nowIso(),
            }
          : assessment,
      ),
    }));
    setTab("score");
    setNotice(`Aggiunta la fonte ${administration.label}.`);
  };

  const updateAdministration = (
    administrationId: string,
    patch: Partial<Administration>,
    invalidateFinal = false,
  ) => {
    if (!selectedAssessment) return;
    updateState((current) => ({
      ...current,
      assessments: current.assessments.map((assessment) =>
        assessment.id === selectedAssessment.id
          ? {
              ...assessment,
              status: invalidateFinal ? "draft" : assessment.status,
              administrations: assessment.administrations.map((administration) =>
                administration.id === administrationId
                  ? { ...administration, ...patch, updatedAt: nowIso() }
                  : administration,
              ),
              updatedAt: nowIso(),
            }
          : assessment,
      ),
    }));
  };

  const deleteAdministration = (administrationId: string) => {
    if (!selectedAssessment || selectedAssessment.administrations.length <= 1)
      return;
    updateState((current) => ({
      ...current,
      assessments: current.assessments.map((assessment) =>
        assessment.id === selectedAssessment.id
          ? {
              ...assessment,
              status: "draft",
              administrations: assessment.administrations.filter(
                (administration) => administration.id !== administrationId,
              ),
              updatedAt: nowIso(),
            }
          : assessment,
      ),
      selectedAdministrationId:
        state.selectedAdministrationId === administrationId
          ? selectedAssessment.administrations.find(
              (administration) => administration.id !== administrationId,
            )?.id ?? ""
          : state.selectedAdministrationId,
    }));
    setNotice("Sottosomministrazione eliminata.");
  };

  // Stabilized callbacks for ScoreRow memoization
  const setScore = useCallback(
    (itemId: string, value: number) => {
      if (
        !selectedAdministration ||
        selectedAdministration.status !== "in_progress"
      )
        return;
      const nextScores = {
        ...selectedAdministration.scores,
        [itemId]:
          selectedAdministration.scores[itemId] === value ? undefined : value,
      };
      updateAdministration(
        selectedAdministration.id,
        { scores: nextScores },
        true,
      );
    },
    [selectedAdministration],
  );

  const setItemNote = useCallback(
    (itemId: string, note: string) => {
      if (
        !selectedAdministration ||
        selectedAdministration.status !== "in_progress"
      )
        return;
      updateAdministration(
        selectedAdministration.id,
        {
          itemNotes: {
            ...selectedAdministration.itemNotes,
            [itemId]: note || undefined,
          },
        },
        true,
      );
    },
    [selectedAdministration],
  );

  const clearAdministration = () => {
    if (
      !selectedAdministration ||
      selectedAdministration.status !== "in_progress"
    )
      return;
    updateAdministration(
      selectedAdministration.id,
      { scores: {}, itemNotes: {} },
      true,
    );
  };

  const openItemInfo = async (item: CansItem) => {
    setInfoState({ item, loading: true });
    const module = await import("./itemDetails.json");
    const details = module.default as Record<string, ManualDetail>;
    setInfoState({ item, detail: details[item.id], loading: false });
  };

  const saveItemGuidance = (
    itemId: string,
    guidance: Omit<ItemGuidanceOverride, "updatedAt">,
  ) => {
    updateState((current) => ({
      ...current,
      itemGuidanceOverrides: {
        ...current.itemGuidanceOverrides,
        [itemId]: { ...guidance, updatedAt: nowIso() },
      },
    }));
    setNotice("Testo dell'item aggiornato.");
  };

  const resetItemGuidance = (itemId: string) => {
    updateState((current) => {
      const nextOverrides = { ...current.itemGuidanceOverrides };
      delete nextOverrides[itemId];
      return {
        ...current,
        itemGuidanceOverrides: nextOverrides,
      };
    });
    setNotice("Ripristinato il testo originale del manuale.");
  };

  const startFusion = () => {
    if (!selectedAssessment) return;
    const initialScores: Record<string, number | undefined> = {};
    const initialNotes: Record<string, string | undefined> = {};
    flattenItems(instrument).forEach(({ item }) => {
      const existingFinal = selectedAssessment.finalScores[item.id];
      if (existingFinal !== undefined) {
        initialScores[item.id] = existingFinal;
      } else {
        const sourceValues = selectedAssessment.administrations
          .map((administration) => administration.scores[item.id])
          .filter((value): value is number => value !== undefined);
        const unique = Array.from(new Set(sourceValues));
        if (unique.length === 1) {
          initialScores[item.id] = unique[0];
        }
      }
      initialNotes[item.id] = selectedAssessment.finalItemNotes[item.id];
    });
    setFusionDraft({
      scores: initialScores,
      notes: initialNotes,
    });
  };

  const saveFusion = () => {
    if (!selectedAssessment || !fusionDraft) return;
    const finalizedAt = nowIso();
    updateState((current) => ({
      ...current,
      selectedAdministrationId: finalAdministrationId,
      assessments: current.assessments.map((assessment) =>
        assessment.id === selectedAssessment.id
          ? {
              ...assessment,
              status: "final",
              finalScores: fusionDraft.scores,
              finalItemNotes: fusionDraft.notes,
              finalizedAt,
              updatedAt: finalizedAt,
            }
          : assessment,
      ),
    }));
    setFusionDraft(null);
    setTab("score");
    setNotice(
      "Valutazione finale salvata. Le sottosomministrazioni restano disponibili.",
    );
  };

  const openExportBackup = () => {
    setBackupDialog({
      mode: "export",
      passphrase: "",
      confirmPassphrase: "",
      showPassphrase: false,
      busy: false,
      error: "",
    });
  };

  const generateBackupPassphrase = () => {
    const passphrase = Array.from({ length: 4 }, () => compactToken(5)).join("-");
    setBackupDialog((current) =>
      current
        ? {
            ...current,
            passphrase,
            confirmPassphrase: current.mode === "export" ? passphrase : "",
            showPassphrase: true,
            error: "",
          }
        : current,
    );
  };

  const copyBackupPassphrase = async () => {
    if (!backupDialog?.passphrase) return;
    await navigator.clipboard.writeText(backupDialog.passphrase);
    setNotice("Passphrase copiata. Comunicala attraverso un canale separato.");
  };

  const exportEncryptedBackup = async () => {
    if (!backupDialog || backupDialog.mode !== "export") return;
    if (backupDialog.passphrase.length < 12) {
      setBackupDialog({ ...backupDialog, error: "Usa almeno 12 caratteri." });
      return;
    }
    if (backupDialog.passphrase !== backupDialog.confirmPassphrase) {
      setBackupDialog({ ...backupDialog, error: "Le passphrase non coincidono." });
      return;
    }
    setBackupDialog({ ...backupDialog, busy: true, error: "" });
    try {
      const encrypted = await encryptBackup(state, backupDialog.passphrase);
      downloadBlob(
        new Blob([JSON.stringify(encrypted)], {
          type: "application/json",
        }),
        `cans-studio-backup-${today()}.cansbackup`,
      );
      setBackupDialog(null);
      setNotice("Backup completo cifrato creato.");
    } catch {
      setBackupDialog((current) =>
        current
          ? {
              ...current,
              busy: false,
              error: "Non è stato possibile cifrare il backup.",
            }
          : current,
      );
    }
  };

  const handleExportExcel = async () => {
    try {
      await exportExcel(state);
    } catch {
      setNotice("Errore durante l'esportazione del file Excel.");
    }
  };

  const exportChartsPng = async () => {
    if (!selectedAssessment || !selectedPatient) return;
    const chartIds = ["needs-star", "strengths-star", "domain-stacked"];
    for (const id of chartIds) {
      const element = document.getElementById(id);
      if (element instanceof SVGSVGElement) {
        await downloadSvgPng(
          element,
          `cans-${id}-${selectedPatient.code}-${selectedAssessment.interval}.png`,
        );
      }
    }
  };

  const importData = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!isEncryptedBackup(parsed)) throw new Error("Backup non cifrato");
      setBackupDialog({
        mode: "import",
        passphrase: "",
        confirmPassphrase: "",
        showPassphrase: false,
        busy: false,
        error: "",
        encryptedBackup: parsed,
        fileName: file.name,
      });
    } catch {
      setNotice("Seleziona un backup cifrato creato da CANS Studio.");
    } finally {
      event.target.value = "";
    }
  };

  const importEncryptedBackup = async () => {
    if (
      !backupDialog ||
      backupDialog.mode !== "import" ||
      !backupDialog.encryptedBackup
    ) {
      return;
    }
    if (!backupDialog.passphrase) {
      setBackupDialog({ ...backupDialog, error: "Inserisci la passphrase." });
      return;
    }
    setBackupDialog({ ...backupDialog, busy: true, error: "" });
    try {
      const incoming = await decryptBackup(
        backupDialog.encryptedBackup,
        backupDialog.passphrase,
        parseState,
      );
      const importedAssessmentId =
        incoming.selectedAssessmentId || incoming.assessments[0]?.id || "";
      const importedAssessment = incoming.assessments.find(
        (assessment) => assessment.id === importedAssessmentId,
      );
      const importedAdministrationId =
        importedAssessment?.status === "final"
          ? finalAdministrationId
          : incoming.selectedAdministrationId ||
            importedAssessment?.administrations[0]?.id ||
            "";
      updateState((current) => ({
        ...current,
        patients: mergeById(current.patients, incoming.patients, () => false),
        assessments: mergeById(
          current.assessments,
          incoming.assessments,
          (localValue, incomingValue) =>
            incomingValue.updatedAt.localeCompare(localValue.updatedAt) > 0,
        ),
        itemGuidanceOverrides: Object.fromEntries(
          Array.from(
            new Set([
              ...Object.keys(current.itemGuidanceOverrides),
              ...Object.keys(incoming.itemGuidanceOverrides),
            ]),
          ).map((itemId) => {
            const localValue = current.itemGuidanceOverrides[itemId];
            const incomingValue = incoming.itemGuidanceOverrides[itemId];
            if (!localValue) return [itemId, incomingValue];
            if (!incomingValue) return [itemId, localValue];
            return [
              itemId,
              incomingValue.updatedAt.localeCompare(localValue.updatedAt) > 0
                ? incomingValue
                : localValue,
            ];
          }),
        ),
        selectedPatientId:
          current.selectedPatientId ||
          incoming.selectedPatientId ||
          incoming.patients[0]?.id ||
          "",
        selectedAssessmentId:
          current.selectedAssessmentId || importedAssessmentId,
        selectedAdministrationId:
          current.selectedAdministrationId || importedAdministrationId,
      }));
      setBackupDialog(null);
      setNotice(
        `Import completato: ${incoming.patients.length} persone e ${incoming.assessments.length} intervalli.`,
      );
    } catch {
      setBackupDialog((current) =>
        current
          ? {
              ...current,
              busy: false,
              error: "Passphrase errata oppure backup danneggiato.",
            }
          : current,
      );
    }
  };

  const activeScores = scoringAdministration?.scores ?? {};
  const activatedModuleIds = getActivatedModuleIds(instrument, activeScores);
  const triggeredModuleIds = getTriggeredModuleIds(instrument, activeScores);

  const displayedDomains = (() => {
    if (domainFilter !== "all-core" && domainFilter !== "all") {
      const selected = instrument.domains.find(
        (domain) => domain.id === domainFilter,
      );
      return selected ? [selected] : [];
    }
    return instrument.domains.filter(
      (domain) =>
        domain.type === "core" ||
        domain.type === "transition" ||
        (domainFilter === "all" && !triggeredModuleIds.has(domain.id)),
    );
  })();

  // Clinical Screen Lock for privacy
  if (isLocked) {
    return (
      <div className="lock-screen" role="dialog" aria-modal="true">
        <div className="lock-card">
          <Lock size={44} />
          <h2>Schermo Protetto</h2>
          <p>
            I dati clinici della persona sono temporaneamente oscurati per tutela
            della privacy in studio.
          </p>
          <button
            type="button"
            className="primary-button"
            onClick={() => setIsLocked(false)}
          >
            <Unlock size={17} /> Sblocca schermata
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {/* Mobile overlay backdrop when drawer is open */}
      {sidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`sidebar ${sidebarOpen ? "is-open" : ""}`}
        aria-label="Persone"
      >
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true">
            <Radar size={21} />
          </div>
          <div>
            <p className="app-name">CANS Studio</p>
            <p className="app-subtitle">Scoring collaborativo</p>
          </div>
          <button
            className="icon-button mobile-sidebar-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Chiudi menu"
          >
            <X size={18} />
          </button>
        </div>

        <div className="privacy-note">
          <LockKeyhole size={17} />
          <span>
            L'anagrafica resta sul dispositivo ed è inclusa solo nei backup cifrati.
          </span>
        </div>

        <label className="search-field">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">Cerca persona</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cerca nome, data o codice"
          />
        </label>

        <div className="patient-list">
          {filteredPatients.map((patient) => (
            <button
              className={`patient-row ${
                patient.id === selectedPatient?.id ? "is-active" : ""
              }`}
              key={patient.id}
              onClick={() => selectPatient(patient.id)}
            >
              <span className="avatar">
                <UserRound size={16} />
              </span>
              <span className="patient-text">
                <strong>{patientName(patient)}</strong>
                <span>
                  {formatDate(patient.birthDate)} · {patient.code}
                </span>
              </span>
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          ))}
          {!filteredPatients.length && (
            <p className="muted-copy compact">Nessuna persona corrispondente.</p>
          )}
        </div>

        <div className="sidebar-footer">
          <div className="new-patient">
            <p className="section-label">Nuova persona</p>
            <label>
              Nome
              <input
                autoComplete="given-name"
                value={firstNameDraft}
                onChange={(event) => setFirstNameDraft(event.target.value)}
                placeholder="Nome"
              />
            </label>
            <label>
              Cognome
              <input
                autoComplete="family-name"
                value={lastNameDraft}
                onChange={(event) => setLastNameDraft(event.target.value)}
                placeholder="Cognome"
              />
            </label>
            <label>
              Data di nascita
              <span className="birth-date-fields">
                <input
                  inputMode="numeric"
                  value={birthDayDraft}
                  maxLength={2}
                  aria-label="Giorno di nascita"
                  onChange={(event) =>
                    setBirthDayDraft(
                      event.target.value.replace(/\D/g, "").slice(0, 2),
                    )
                  }
                  placeholder="GG"
                />
                <span aria-hidden="true">/</span>
                <input
                  inputMode="numeric"
                  value={birthMonthDraft}
                  maxLength={2}
                  aria-label="Mese di nascita"
                  onChange={(event) =>
                    setBirthMonthDraft(
                      event.target.value.replace(/\D/g, "").slice(0, 2),
                    )
                  }
                  placeholder="MM"
                />
                <span aria-hidden="true">/</span>
                <input
                  inputMode="numeric"
                  value={birthYearDraft}
                  maxLength={4}
                  aria-label="Anno di nascita"
                  onChange={(event) =>
                    setBirthYearDraft(
                      event.target.value.replace(/\D/g, "").slice(0, 4),
                    )
                  }
                  placeholder="AAAA"
                />
              </span>
            </label>
            <button
              className="primary-button"
              onClick={addPatient}
              disabled={
                !firstNameDraft.trim() ||
                !lastNameDraft.trim() ||
                !composeBirthDate(birthDayDraft, birthMonthDraft, birthYearDraft)
              }
            >
              <Plus size={16} /> Aggiungi persona
            </button>
          </div>

          <div className="global-data-actions">
            <button className="secondary-button" onClick={openExportBackup}>
              <FileJson size={16} /> Backup cifrato
            </button>
            <button
              className="secondary-button"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileUp size={16} /> Importa dati
            </button>
            <button
              className="secondary-button"
              onClick={handleExportExcel}
              title="Il file Excel contiene dati in chiaro"
            >
              <FileSpreadsheet size={16} /> Excel non cifrato
            </button>
          </div>
        </div>
      </aside>

      <main className="workspace" id="main-content">
        <header className="topbar">
          <div className="topbar-title-area">
            <button
              className="icon-button mobile-menu-toggle"
              onClick={() => setSidebarOpen(true)}
              aria-label="Apri elenco persone"
              title="Persone"
            >
              <Menu size={19} />
            </button>
            <div>
              <p className="eyeline">Persona selezionata</p>
              <h1>
                {selectedPatient
                  ? patientName(selectedPatient)
                  : "Nessuna persona selezionata"}
              </h1>
              <div className="meta-row">
                {selectedPatient && (
                  <>
                    <span>Nato/a il {formatDate(selectedPatient.birthDate)}</span>
                    <span>{selectedPatient.code}</span>
                    <span>{patientAssessments.length} intervalli T</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="topbar-actions">
            <button
              className="icon-button"
              onClick={() => setIsLocked(true)}
              aria-label="Blocca schermo per privacy"
              title="Blocca schermo (Privacy studio)"
            >
              <Lock size={17} />
            </button>
            <button
              className="icon-button"
              onClick={() => setHelpOpen(true)}
              aria-label="Apri il manuale dell'app"
              title="Manuale dell'app"
            >
              <BookOpen size={17} />
            </button>
            <button
              className="icon-button"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label={theme === "dark" ? "Usa tema chiaro" : "Usa tema scuro"}
              title={theme === "dark" ? "Tema chiaro" : "Tema scuro"}
            >
              {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            {selectedPatient && (
              <>
                <button
                  className="secondary-button"
                  onClick={() => addAssessment("cans-0-5")}
                >
                  <Plus size={16} /> Nuovo T 0-5
                </button>
                <button
                  className="secondary-button"
                  onClick={() => addAssessment("cans-5-17")}
                >
                  <Plus size={16} /> Nuovo T 5-17+
                </button>
              </>
            )}
          </div>
        </header>

        {selectedAssessment && scoringAdministration ? (
          <>
            <AssessmentContextBar
              assessment={selectedAssessment}
              administration={scoringAdministration}
              viewingFinal={viewingFinal}
              updateAssessment={updateAssessment}
              updateAdministration={(patch) =>
                selectedAdministration &&
                updateAdministration(selectedAdministration.id, patch)
              }
              selectAdministration={(id) =>
                updateState((current) => ({
                  ...current,
                  selectedAdministrationId: id,
                }))
              }
              addAdministration={addAdministration}
              startFusion={startFusion}
            />

            <nav className="tabs" aria-label="Sezioni">
              <TabButton
                active={tab === "score"}
                icon={<ClipboardList size={16} />}
                label="Compilazione"
                onClick={() => setTab("score")}
              />
              <TabButton
                active={tab === "results"}
                icon={<Radar size={16} />}
                label="Risultati finali"
                onClick={() => setTab("results")}
              />
              <TabButton
                active={tab === "compare"}
                icon={<LineChart size={16} />}
                label="Confronto"
                onClick={() => setTab("compare")}
              />
              <TabButton
                active={tab === "archive"}
                icon={<CalendarDays size={16} />}
                label="Archivio"
                onClick={() => setTab("archive")}
              />
            </nav>

            {tab === "score" && (
              <ScoringView
                instrument={instrument}
                assessment={selectedAssessment}
                administration={scoringAdministration}
                viewingFinal={viewingFinal}
                completion={completion}
                displayedDomains={displayedDomains}
                activatedModuleIds={activatedModuleIds}
                triggeredModuleIds={triggeredModuleIds}
                domainFilter={domainFilter}
                setDomainFilter={setDomainFilter}
                setScore={setScore}
                setItemNote={setItemNote}
                openInfo={openItemInfo}
                clearAdministration={clearAdministration}
                updateAdministration={(patch, invalidateFinal = false) =>
                  selectedAdministration &&
                  updateAdministration(
                    selectedAdministration.id,
                    patch,
                    invalidateFinal,
                  )
                }
                addAdministration={addAdministration}
                startFusion={startFusion}
              />
            )}

            {tab === "results" && (
              <ResultsView
                instrument={instrument}
                assessment={selectedAssessment}
                finalCompletion={finalCompletion}
                exportChartsPng={exportChartsPng}
                startFusion={startFusion}
                setTab={setTab}
              />
            )}

            {tab === "compare" && (
              <CompareView
                selectedAssessment={selectedAssessment}
                previousAssessment={previousAssessment}
                instrument={instrument}
              />
            )}

            {tab === "archive" && (
              <ArchiveView
                patientAssessments={patientAssessments}
                selectedAssessment={selectedAssessment}
                selectedAdministrationId={scoringAdministration.id}
                selectAssessment={selectAssessment}
                selectAdministration={(id) =>
                  updateState((current) => ({
                    ...current,
                    selectedAdministrationId: id,
                  }))
                }
                deleteAssessment={deleteAssessment}
                deleteAdministration={deleteAdministration}
                startFusion={startFusion}
              />
            )}
          </>
        ) : selectedPatient ? (
          <EmptyAssessment
            addAssessment={addAssessment}
            patientCode={selectedPatient.code}
          />
        ) : (
          <EmptyPatient />
        )}

        <input
          ref={fileInputRef}
          className="sr-only"
          type="file"
          accept=".cansbackup,application/json"
          onChange={importData}
        />
      </main>

      {infoState && (
        <ItemInfoDialog
          item={infoState.item}
          detail={infoState.detail}
          loading={infoState.loading}
          guidanceOverride={state.itemGuidanceOverrides[infoState.item.id]}
          saveGuidance={saveItemGuidance}
          resetGuidance={resetItemGuidance}
          close={() => setInfoState(null)}
        />
      )}
      {fusionDraft && selectedAssessment && (
        <FusionDialog
          assessment={selectedAssessment}
          instrument={instrument}
          draft={fusionDraft}
          setDraft={setFusionDraft}
          showOnlyDiscordant={showOnlyDiscordant}
          setShowOnlyDiscordant={setShowOnlyDiscordant}
          close={() => setFusionDraft(null)}
          save={saveFusion}
        />
      )}
      {backupDialog && (
        <BackupDialog
          state={backupDialog}
          setState={setBackupDialog}
          generatePassphrase={generateBackupPassphrase}
          copyPassphrase={copyBackupPassphrase}
          close={() => setBackupDialog(null)}
          confirm={
            backupDialog.mode === "export"
              ? exportEncryptedBackup
              : importEncryptedBackup
          }
        />
      )}
      {helpOpen && <HelpDialog close={() => setHelpOpen(false)} />}
      {notice && (
        <div className="toast" role="status" aria-live="polite">
          {notice}
        </div>
      )}
    </div>
  );
}

export default App;
