import type { CansInstrument } from "../cansData";
import type {
  Administration,
  Assessment,
  ItemGuidanceOverride,
  StoredState,
} from "../types/cans";
import {
  makeInstallationId,
  makePatientCode,
  nowIso,
  today,
  uid,
} from "./crypto";

export const storageKey = "cans-studio-state-v4";
export const previousStorageKey = "cans-studio-state-v3";
export const obsoleteStorageKeys = [
  "cans-studio-state-v1",
  "cans-studio-state-v2",
];
export const themeKey = "cans-studio-theme";
export const finalAdministrationId = "final-assessment";

export const createAdministration = (position = 1): Administration => ({
  id: uid("source"),
  label: `Fonte ${position}`,
  respondentRole: "",
  clinician: "",
  date: today(),
  status: "in_progress",
  scores: {},
  itemNotes: {},
  notes: "",
  updatedAt: nowIso(),
});

export const createAssessment = (
  patientId: string,
  instrumentId: CansInstrument["id"],
  position: number,
): Assessment => {
  const administration = createAdministration(1);
  return {
    id: uid("timepoint"),
    patientId,
    instrumentId,
    date: today(),
    interval: `T${position}`,
    status: "draft",
    administrations: [administration],
    finalScores: {},
    finalItemNotes: {},
    finalNotes: "",
    updatedAt: nowIso(),
  };
};

export const emptyState = (): StoredState => ({
  app: "CANS Studio",
  schemaVersion: 4,
  installationId: makeInstallationId(),
  patients: [],
  assessments: [],
  itemGuidanceOverrides: {},
  selectedPatientId: "",
  selectedAssessmentId: "",
  selectedAdministrationId: "",
});

export type StoredStateInput = Omit<
  StoredState,
  "schemaVersion" | "itemGuidanceOverrides"
> & {
  schemaVersion: 3 | 4;
  itemGuidanceOverrides?: Record<string, ItemGuidanceOverride>;
};

export const sanitizeGuidanceOverrides = (
  value: unknown,
): Record<string, ItemGuidanceOverride> => {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value).flatMap(([itemId, candidate]) => {
      if (!candidate || typeof candidate !== "object") return [];
      const entry = candidate as Partial<ItemGuidanceOverride>;
      if (
        typeof entry.description !== "string" ||
        !entry.scoreHints ||
        typeof entry.scoreHints !== "object"
      ) {
        return [];
      }
      const scoreHints = Object.fromEntries(
        Object.entries(entry.scoreHints).filter(
          ([score, text]) => /^[0-3]$/.test(score) && typeof text === "string",
        ),
      ) as Record<string, string>;
      return [
        [
          itemId,
          {
            description: entry.description,
            scoreHints,
            updatedAt:
              typeof entry.updatedAt === "string" ? entry.updatedAt : nowIso(),
          },
        ],
      ];
    }),
  );
};

export const sanitizeState = (value: StoredStateInput): StoredState => ({
  ...value,
  app: "CANS Studio",
  schemaVersion: 4,
  itemGuidanceOverrides: sanitizeGuidanceOverrides(
    value.itemGuidanceOverrides,
  ),
  patients: (value.patients ?? []).map((patient) => ({
    id: patient.id || uid("patient"),
    code: patient.code || makePatientCode(value.installationId),
    firstName: patient.firstName || "",
    lastName: patient.lastName || "",
    birthDate: patient.birthDate || "",
    createdAt: patient.createdAt || nowIso(),
  })),
  assessments: (value.assessments ?? []).map((assessment) => ({
    ...assessment,
    status: assessment.status ?? "draft",
    administrations: (assessment.administrations ?? []).map((administration) => ({
      ...administration,
      status: administration.status ?? "in_progress",
      scores: administration.scores ?? {},
      itemNotes: administration.itemNotes ?? {},
      notes: administration.notes ?? "",
      updatedAt: administration.updatedAt ?? nowIso(),
    })),
    finalScores: assessment.finalScores ?? {},
    finalItemNotes: assessment.finalItemNotes ?? {},
    finalNotes: assessment.finalNotes ?? "",
    updatedAt: assessment.updatedAt ?? nowIso(),
  })),
});

export const parseState = (value: unknown): StoredState => {
  if (!value || typeof value !== "object") throw new Error("Formato non valido");
  const candidate = value as Partial<StoredStateInput>;
  if (
    (candidate.schemaVersion === 3 || candidate.schemaVersion === 4) &&
    candidate.app === "CANS Studio"
  ) {
    return sanitizeState(candidate as StoredStateInput);
  }
  throw new Error("Formato non valido");
};

export const loadState = (): StoredState => {
  try {
    obsoleteStorageKeys.forEach((key) => localStorage.removeItem(key));
    const current =
      localStorage.getItem(storageKey) ??
      localStorage.getItem(previousStorageKey);
    if (current) {
      const state = parseState(JSON.parse(current));
      localStorage.setItem(storageKey, JSON.stringify(state));
      localStorage.removeItem(previousStorageKey);
      const selectedAssessment = state.assessments.find(
        (assessment) => assessment.id === state.selectedAssessmentId,
      );
      if (selectedAssessment?.status === "final") {
        state.selectedAdministrationId = finalAdministrationId;
      }
      return state;
    }
  } catch {
    return emptyState();
  }
  return emptyState();
};

export const saveState = (state: StoredState): boolean => {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
    return true;
  } catch (error) {
    console.error("Errore nel salvataggio locale (possibile quota esaurita):", error);
    return false;
  }
};

export const mergeById = <T extends { id: string }>(
  local: T[],
  incoming: T[],
  chooseIncoming: (localValue: T, incomingValue: T) => boolean,
) => {
  const merged = new Map(local.map((entry) => [entry.id, entry]));
  incoming.forEach((entry) => {
    const current = merged.get(entry.id);
    if (!current || chooseIncoming(current, entry)) merged.set(entry.id, entry);
  });
  return Array.from(merged.values());
};
