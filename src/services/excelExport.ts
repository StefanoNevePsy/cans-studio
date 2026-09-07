import type { SheetData } from "write-excel-file/browser";
import { getInstrument } from "../cansData";
import type { StoredState } from "../types/cans";
import { flattenItems, scoreLabel, statusLabel } from "../utils/cansMath";
import { today } from "./crypto";

type XlsxCell = SheetData[number][number];

const headerRow = (values: string[]): XlsxCell[] =>
  values.map((value) => ({
    value,
    fontWeight: "bold",
    backgroundColor: "#EDEAFB",
    color: "#211839",
  }));

const textCell = (value: string): XlsxCell => ({ value });
const numberCell = (value: number): XlsxCell => ({ value });

export const exportExcel = async (state: StoredState) => {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
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

  await writeXlsxFile(
    [
      { data: patientSheet, sheet: "Persone", stickyRowsCount: 1 },
      { data: timepointSheet, sheet: "Intervalli T", stickyRowsCount: 1 },
      {
        data: administrationSheet,
        sheet: "Sottosomministrazioni",
        stickyRowsCount: 1,
      },
      { data: scoreSheet, sheet: "Punteggi e note", stickyRowsCount: 1 },
    ],
    { fontFamily: "Calibri", fontSize: 11 },
  ).toFile(`cans-studio-${today()}.xlsx`);
};
