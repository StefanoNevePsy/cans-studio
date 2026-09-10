import type { SheetData } from "write-excel-file/browser";
import { CansInstrument, getInstrument, instruments } from "../cansData";
import type { StoredState } from "../types/cans";
import {
  flattenItems,
  getStats,
  scoreLabel,
  statusLabel,
} from "../utils/cansMath";
import { today } from "./crypto";

type XlsxCell = SheetData[number][number];

const metaHeaderCell = (value: string): XlsxCell => ({
  value,
  fontWeight: "bold",
  backgroundColor: "#EDEAFB",
  color: "#211839",
});

const groupingHeaderCell = (value: string): XlsxCell => ({
  value,
  fontWeight: "bold",
  backgroundColor: "#DDD6FE",
  color: "#2E1065",
});

const itemHeaderCell = (value: string): XlsxCell => ({
  value,
  fontWeight: "bold",
  backgroundColor: "#F1F5F9",
  color: "#0F172A",
});

const headerRow = (values: string[]): XlsxCell[] =>
  values.map((value) => metaHeaderCell(value));

const textCell = (value: string): XlsxCell => ({ value });
const numberCell = (value: number): XlsxCell => ({ value, type: Number });
const emptyCell = (): XlsxCell => ({ value: null });

function computeAgeAtDate(birthDate: string, targetDate: string): number | null {
  if (!birthDate || !targetDate) return null;
  const birth = new Date(birthDate);
  const target = new Date(targetDate);
  if (isNaN(birth.getTime()) || isNaN(target.getTime())) return null;
  let age = target.getFullYear() - birth.getFullYear();
  const m = target.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && target.getDate() < birth.getDate())) {
    age--;
  }
  return age >= 0 ? age : null;
}

interface MatrixSheetConfig {
  instrument: CansInstrument;
  state: StoredState;
  mode: "final" | "administrations";
}

function buildStatisticalMatrixSheet({
  instrument,
  state,
  mode,
}: MatrixSheetConfig): SheetData {
  const allItems = flattenItems(instrument);
  const domains = instrument.domains;

  // Header row construction
  const headers: XlsxCell[] = [];

  // 1. Patient & Assessment Meta Headers
  const baseMetaHeaders = [
    "ID_Persona",
    "Codice_Persona",
    "Nome",
    "Cognome",
    "Data_Nascita",
    "Eta_Anni",
    "ID_T",
    "Intervallo_T",
    "Data_Valutazione",
    "Strumento",
  ];

  if (mode === "final") {
    baseMetaHeaders.push("Stato_Valutazione", "N_Fonti");
  } else {
    baseMetaHeaders.push(
      "ID_Fonte",
      "Fonte_Etichetta",
      "Ruolo_Intervistato",
      "Compilante",
      "Data_Fonte",
      "Stato_Fonte",
    );
  }

  baseMetaHeaders.forEach((title) => headers.push(metaHeaderCell(title)));

  // 2. Domain / Grouping Headers
  domains.forEach((domain) => {
    headers.push(groupingHeaderCell(`[${domain.shortTitle}] Media`));
    headers.push(groupingHeaderCell(`[${domain.shortTitle}] Somma`));
    const hasNeeds = domain.items.some((i) => i.kind === "need");
    if (hasNeeds) {
      headers.push(groupingHeaderCell(`[${domain.shortTitle}] Azionabili (2-3)`));
    }
    const hasStrengths = domain.items.some((i) => i.kind === "strength");
    if (hasStrengths) {
      headers.push(
        groupingHeaderCell(`[${domain.shortTitle}] Punti Forza Utili (0-1)`),
      );
    }
    headers.push(groupingHeaderCell(`[${domain.shortTitle}] Indice`));
  });

  // 3. Individual Item Headers
  allItems.forEach(({ domain, item }) => {
    headers.push(itemHeaderCell(`[${domain.shortTitle}] ${item.label}`));
  });

  // Data rows construction
  const dataRows: XlsxCell[][] = [];

  const relevantAssessments = state.assessments.filter(
    (assessment) => assessment.instrumentId === instrument.id,
  );

  relevantAssessments.forEach((assessment) => {
    const patient = state.patients.find((p) => p.id === assessment.patientId);
    const age = patient
      ? computeAgeAtDate(patient.birthDate, assessment.date)
      : null;

    if (mode === "final") {
      // In final mode, take assessment.finalScores if present, otherwise fall back to first administration scores
      const hasFinalScores = Object.keys(assessment.finalScores).length > 0;
      const scores = hasFinalScores
        ? assessment.finalScores
        : (assessment.administrations[0]?.scores ?? {});

      const stats = getStats(instrument, scores);

      const row: XlsxCell[] = [
        textCell(patient?.id ?? assessment.patientId),
        textCell(patient?.code ?? ""),
        textCell(patient?.firstName ?? ""),
        textCell(patient?.lastName ?? ""),
        textCell(patient?.birthDate ?? ""),
        age !== null ? numberCell(age) : emptyCell(),
        textCell(assessment.id),
        textCell(assessment.interval),
        textCell(assessment.date),
        textCell(instrument.title),
        textCell(assessment.status === "final" ? "Finale" : "Bozza"),
        numberCell(assessment.administrations.length),
      ];

      // Domain metrics
      domains.forEach((domain) => {
        let sum = 0;
        let answered = 0;
        let actionable = 0;
        let usefulStrengths = 0;

        domain.items.forEach((item) => {
          const score = scores[item.id];
          if (score !== undefined) {
            answered++;
            sum += score;
            if (item.kind === "need" && score >= 2) {
              actionable++;
            } else if (item.kind === "strength" && score <= 1) {
              usefulStrengths++;
            }
          }
        });

        const mean =
          answered > 0 ? Math.round((sum / answered) * 100) / 100 : null;
        const stat = stats.find((s) => s.domain.id === domain.id);

        row.push(mean !== null ? numberCell(mean) : emptyCell());
        row.push(answered > 0 ? numberCell(sum) : emptyCell());
        if (domain.items.some((i) => i.kind === "need")) {
          row.push(answered > 0 ? numberCell(actionable) : emptyCell());
        }
        if (domain.items.some((i) => i.kind === "strength")) {
          row.push(answered > 0 ? numberCell(usefulStrengths) : emptyCell());
        }
        row.push(stat ? numberCell(stat.index) : emptyCell());
      });

      // Individual item scores
      allItems.forEach(({ item }) => {
        const value = scores[item.id];
        row.push(value !== undefined ? numberCell(value) : emptyCell());
      });

      dataRows.push(row);
    } else {
      // In administrations mode, generate a row for each administration
      assessment.administrations.forEach((administration) => {
        const scores = administration.scores;
        const stats = getStats(instrument, scores);

        const row: XlsxCell[] = [
          textCell(patient?.id ?? assessment.patientId),
          textCell(patient?.code ?? ""),
          textCell(patient?.firstName ?? ""),
          textCell(patient?.lastName ?? ""),
          textCell(patient?.birthDate ?? ""),
          age !== null ? numberCell(age) : emptyCell(),
          textCell(assessment.id),
          textCell(assessment.interval),
          textCell(assessment.date),
          textCell(instrument.title),
          textCell(administration.id),
          textCell(administration.label),
          textCell(administration.respondentRole),
          textCell(administration.clinician),
          textCell(administration.date),
          textCell(statusLabel(administration.status)),
        ];

        // Domain metrics
        domains.forEach((domain) => {
          let sum = 0;
          let answered = 0;
          let actionable = 0;
          let usefulStrengths = 0;

          domain.items.forEach((item) => {
            const score = scores[item.id];
            if (score !== undefined) {
              answered++;
              sum += score;
              if (item.kind === "need" && score >= 2) {
                actionable++;
              } else if (item.kind === "strength" && score <= 1) {
                usefulStrengths++;
              }
            }
          });

          const mean =
            answered > 0 ? Math.round((sum / answered) * 100) / 100 : null;
          const stat = stats.find((s) => s.domain.id === domain.id);

          row.push(mean !== null ? numberCell(mean) : emptyCell());
          row.push(answered > 0 ? numberCell(sum) : emptyCell());
          if (domain.items.some((i) => i.kind === "need")) {
            row.push(answered > 0 ? numberCell(actionable) : emptyCell());
          }
          if (domain.items.some((i) => i.kind === "strength")) {
            row.push(answered > 0 ? numberCell(usefulStrengths) : emptyCell());
          }
          row.push(stat ? numberCell(stat.index) : emptyCell());
        });

        // Individual item scores
        allItems.forEach(({ item }) => {
          const value = scores[item.id];
          row.push(value !== undefined ? numberCell(value) : emptyCell());
        });

        dataRows.push(row);
      });
    }
  });

  return [headers, ...dataRows];
}

export const exportExcel = async (state: StoredState) => {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");

  // Determine which instruments are active or have assessments
  const presentInstrumentIds = Array.from(
    new Set(state.assessments.map((a) => a.instrumentId)),
  );
  const activeInstrumentIds =
    presentInstrumentIds.length > 0
      ? presentInstrumentIds
      : (["cans-5-17"] as const);

  const sheetsToExport: {
    data: SheetData;
    sheet: string;
    stickyRowsCount: number;
  }[] = [];

  // 1. Generate Statistical Matrices (Wide Format) in the front tabs
  activeInstrumentIds.forEach((instId) => {
    const instrument = getInstrument(instId);
    const suffix =
      instId === "cans-0-5" ? "0-5" : instId === "cans-5-17" ? "5-17" : instId;

    // Assessment / Final matrix
    const matrixData = buildStatisticalMatrixSheet({
      instrument,
      state,
      mode: "final",
    });

    sheetsToExport.push({
      data: matrixData,
      sheet: `Matrice Statistica (${suffix})`,
      stickyRowsCount: 1,
    });

    // Multi-informant / Administrations matrix (if any exist)
    const hasAdministrations = state.assessments.some(
      (a) => a.instrumentId === instId && a.administrations.length > 0,
    );

    if (hasAdministrations) {
      const adminMatrixData = buildStatisticalMatrixSheet({
        instrument,
        state,
        mode: "administrations",
      });
      sheetsToExport.push({
        data: adminMatrixData,
        sheet: `Fonti Statistiche (${suffix})`,
        stickyRowsCount: 1,
      });
    }
  });

  // 2. Original Reference Sheets (Persone, Intervalli T, Sottosomministrazioni, Punteggi e note)
  const patientSheet: SheetData = [
    headerRow([
      "ID globale persona",
      "Codice",
      "Nome",
      "Cognome",
      "Data di nascita",
      "Intervalli T",
    ]),
    ...state.patients.map((patient) => [
      textCell(patient.id),
      textCell(patient.code),
      textCell(patient.firstName),
      textCell(patient.lastName),
      textCell(patient.birthDate),
      numberCell(
        state.assessments.filter(
          (assessment) => assessment.patientId === patient.id,
        ).length,
      ),
    ]),
  ];

  const timepointSheet: SheetData = [
    headerRow([
      "ID T",
      "Codice persona",
      "Strumento",
      "Data",
      "Intervallo",
      "Stato finale",
      "Sottosomministrazioni",
      "Finalizzato il",
      "Nota finale",
    ]),
    ...state.assessments.map((assessment) => {
      const patient = state.patients.find(
        (entry) => entry.id === assessment.patientId,
      );
      return [
        textCell(assessment.id),
        textCell(patient?.code ?? ""),
        textCell(getInstrument(assessment.instrumentId).title),
        textCell(assessment.date),
        textCell(assessment.interval),
        textCell(assessment.status === "final" ? "Finale" : "Da finalizzare"),
        numberCell(assessment.administrations.length),
        textCell(assessment.finalizedAt ?? ""),
        textCell(assessment.finalNotes),
      ];
    }),
  ];

  const administrationSheet: SheetData = [
    headerRow([
      "ID sottosomministrazione",
      "ID T",
      "Codice persona",
      "Fonte",
      "Ruolo/intervistato",
      "Compilante",
      "Data",
      "Stato",
      "Nota generale",
    ]),
    ...state.assessments.flatMap((assessment) => {
      const patient = state.patients.find(
        (entry) => entry.id === assessment.patientId,
      );
      return assessment.administrations.map((administration) => [
        textCell(administration.id),
        textCell(assessment.id),
        textCell(patient?.code ?? ""),
        textCell(administration.label),
        textCell(administration.respondentRole),
        textCell(administration.clinician),
        textCell(administration.date),
        textCell(statusLabel(administration.status)),
        textCell(administration.notes),
      ]);
    }),
  ];

  const scoreRows: XlsxCell[][] = [];
  state.assessments.forEach((assessment) => {
    const patient = state.patients.find(
      (entry) => entry.id === assessment.patientId,
    );
    const entryInstrument = getInstrument(assessment.instrumentId);
    const items = flattenItems(entryInstrument);
    assessment.administrations.forEach((administration) => {
      items.forEach(({ domain, item }) => {
        const value = administration.scores[item.id];
        if (value === undefined && !administration.itemNotes[item.id]) return;
        scoreRows.push([
          textCell(assessment.id),
          textCell(patient?.code ?? ""),
          textCell(assessment.interval),
          textCell(administration.label),
          textCell("Sottosomministrazione"),
          textCell(domain.title),
          textCell(item.label),
          value === undefined ? textCell("") : numberCell(value),
          textCell(scoreLabel(item, value)),
          textCell(administration.itemNotes[item.id] ?? ""),
        ]);
      });
    });
    items.forEach(({ domain, item }) => {
      const value = assessment.finalScores[item.id];
      if (value === undefined && !assessment.finalItemNotes[item.id]) return;
      scoreRows.push([
        textCell(assessment.id),
        textCell(patient?.code ?? ""),
        textCell(assessment.interval),
        textCell("Valutazione finale"),
        textCell("Finale"),
        textCell(domain.title),
        textCell(item.label),
        value === undefined ? textCell("") : numberCell(value),
        textCell(scoreLabel(item, value)),
        textCell(assessment.finalItemNotes[item.id] ?? ""),
      ]);
    });
  });

  const scoreSheet: SheetData = [
    headerRow([
      "ID T",
      "Codice persona",
      "Intervallo",
      "Fonte",
      "Tipo",
      "Dominio",
      "Item",
      "Punteggio",
      "Etichetta",
      "Nota item",
    ]),
    ...scoreRows,
  ];

  sheetsToExport.push(
    { data: patientSheet, sheet: "Persone", stickyRowsCount: 1 },
    { data: timepointSheet, sheet: "Intervalli T", stickyRowsCount: 1 },
    {
      data: administrationSheet,
      sheet: "Sottosomministrazioni",
      stickyRowsCount: 1,
    },
    { data: scoreSheet, sheet: "Punteggi e note", stickyRowsCount: 1 },
  );

  await writeXlsxFile(sheetsToExport, {
    fontFamily: "Calibri",
    fontSize: 11,
  }).toFile(`cans-studio-${today()}.xlsx`);
};
