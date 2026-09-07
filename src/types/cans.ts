import type { CansDomain, CansInstrument, CansItem } from "../cansData";

export type Tab = "score" | "results" | "compare" | "archive";
export type ThemeMode = "light" | "dark";
export type AdministrationStatus = "in_progress" | "suspended" | "completed";
export type AssessmentStatus = "draft" | "final";

export type HelpTopic =
  | "overview"
  | "patients"
  | "scoring"
  | "fusion"
  | "results"
  | "data";

export interface Patient {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  createdAt: string;
}

export interface Administration {
  id: string;
  label: string;
  respondentRole: string;
  clinician: string;
  date: string;
  status: AdministrationStatus;
  scores: Record<string, number | undefined>;
  itemNotes: Record<string, string | undefined>;
  notes: string;
  updatedAt: string;
}

export interface Assessment {
  id: string;
  patientId: string;
  instrumentId: CansInstrument["id"];
  date: string;
  interval: string;
  status: AssessmentStatus;
  administrations: Administration[];
  finalScores: Record<string, number | undefined>;
  finalItemNotes: Record<string, string | undefined>;
  finalNotes: string;
  finalizedAt?: string;
  updatedAt: string;
}

export interface ItemGuidanceOverride {
  description: string;
  scoreHints: Record<string, string>;
  updatedAt: string;
}

export interface StoredState {
  app: "CANS Studio";
  schemaVersion: 4;
  installationId: string;
  patients: Patient[];
  assessments: Assessment[];
  itemGuidanceOverrides: Record<string, ItemGuidanceOverride>;
  selectedPatientId: string;
  selectedAssessmentId: string;
  selectedAdministrationId: string;
}

export interface ManualDetail {
  title: string;
  manualTitle: string;
  source: string;
  page: number;
  description: string;
  scoreHints: Record<string, string>;
  match: number;
}

export interface ItemInfoState {
  item: CansItem;
  detail?: ManualDetail;
  loading: boolean;
}

export interface DomainStats {
  domain: CansDomain;
  answered: number;
  total: number;
  actionable: number;
  urgent: number;
  usefulStrengths: number;
  missingStrengths: number;
  binaryYes: number;
  index: number;
}

export interface NeedBand {
  domain: CansDomain;
  answered: number;
  total: number;
  percentages: [number, number, number, number];
  cumulative: [number, number, number, number];
}

export interface StrengthPoint {
  item: CansItem;
  raw: number | undefined;
  value: number;
}

export interface FusionDraft {
  scores: Record<string, number | undefined>;
  notes: Record<string, string | undefined>;
}

export interface ManualScoreHint {
  score: number;
  text: string;
}

export interface ParsedManualDetail {
  description: string;
  scoreHints: ManualScoreHint[];
}

export interface EncryptedBackup {
  format: "CANS Studio encrypted backup";
  version: 1;
  createdAt: string;
  kdf: {
    name: "PBKDF2";
    hash: "SHA-256";
    iterations: number;
    salt: string;
  };
  cipher: {
    name: "AES-GCM";
    iv: string;
  };
  payload: string;
}

export interface BackupDialogState {
  mode: "export" | "import";
  passphrase: string;
  confirmPassphrase: string;
  showPassphrase: boolean;
  busy: boolean;
  error: string;
  encryptedBackup?: EncryptedBackup;
  fileName?: string;
}
