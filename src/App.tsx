import {
  Activity,
  AlertTriangle,
  Archive,
  ArrowDown,
  ArrowUp,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileJson,
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
  Plus,
  Radar,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import {
  ChangeEvent,
  CSSProperties,
  Fragment,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { SheetData } from "write-excel-file/browser";
import {
  binaryAnchors,
  CansDomain,
  CansInstrument,
  CansItem,
  getInstrument,
  instruments,
  needAnchors,
  strengthAnchors,
} from "./cansData";

type Tab = "score" | "results" | "compare" | "archive";
type ThemeMode = "light" | "dark";
type AdministrationStatus = "in_progress" | "suspended" | "completed";
type AssessmentStatus = "draft" | "final";
type HelpTopic =
  | "overview"
  | "patients"
  | "scoring"
  | "fusion"
  | "results"
  | "data";

interface Patient {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  createdAt: string;
}

interface Administration {
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

interface Assessment {
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

interface StoredState {
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

interface ItemGuidanceOverride {
  description: string;
  scoreHints: Record<string, string>;
  updatedAt: string;
}

interface ManualDetail {
  title: string;
  manualTitle: string;
  source: string;
  text: string;
  match: number;
}

interface ItemInfoState {
  item: CansItem;
  detail?: ManualDetail;
  loading: boolean;
}

interface DomainStats {
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

interface NeedBand {
  domain: CansDomain;
  answered: number;
  total: number;
  percentages: [number, number, number, number];
  cumulative: [number, number, number, number];
}

interface StrengthPoint {
  item: CansItem;
  raw: number | undefined;
  value: number;
}

interface FusionDraft {
  scores: Record<string, number | undefined>;
  notes: Record<string, string | undefined>;
}

interface ManualScoreHint {
  score: number;
  text: string;
}

interface ParsedManualDetail {
  description: string;
  scoreHints: ManualScoreHint[];
}

interface EncryptedBackup {
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

interface BackupDialogState {
  mode: "export" | "import";
  passphrase: string;
  confirmPassphrase: string;
  showPassphrase: boolean;
  busy: boolean;
  error: string;
  encryptedBackup?: EncryptedBackup;
  fileName?: string;
}

const storageKey = "cans-studio-state-v4";
const previousStorageKey = "cans-studio-state-v3";
const obsoleteStorageKeys = ["cans-studio-state-v1", "cans-studio-state-v2"];
const themeKey = "cans-studio-theme";
const finalAdministrationId = "final-assessment";
const backupIterations = 600_000;

const uid = (prefix: string) =>
  `${prefix}-${typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;

const nowIso = () => new Date().toISOString();
const today = () => nowIso().slice(0, 10);

const compactToken = (length: number) => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(length);
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    crypto.getRandomValues(bytes);
  } else {
    bytes.forEach((_, index) => {
      bytes[index] = Math.floor(Math.random() * 256);
    });
  }
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
};

const makeInstallationId = () => uid("site");

const makePatientCode = (installationId: string) => {
  const site = installationId.replace(/[^a-z0-9]/gi, "").slice(-5).toUpperCase() || compactToken(5);
  return `CANS-${site}-${compactToken(7)}`;
};

const createAdministration = (position = 1): Administration => ({
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

const createAssessment = (
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

const emptyState = (): StoredState => ({
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

type StoredStateInput = Omit<
  StoredState,
  "schemaVersion" | "itemGuidanceOverrides"
> & {
  schemaVersion: 3 | 4;
  itemGuidanceOverrides?: Record<string, ItemGuidanceOverride>;
};

const sanitizeGuidanceOverrides = (
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

const sanitizeState = (value: StoredStateInput): StoredState => ({
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

const parseState = (value: unknown): StoredState => {
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

const loadState = (): StoredState => {
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

const patientName = (patient: Patient) =>
  `${patient.firstName} ${patient.lastName}`.replace(/\s+/g, " ").trim();

const composeBirthDate = (day: string, month: string, year: string) => {
  if (!/^\d{1,2}$/.test(day) || !/^\d{1,2}$/.test(month) || !/^\d{4}$/.test(year)) {
    return "";
  }
  const numericDay = Number(day);
  const numericMonth = Number(month);
  const numericYear = Number(year);
  const candidate = new Date(Date.UTC(numericYear, numericMonth - 1, numericDay));
  if (
    candidate.getUTCFullYear() !== numericYear ||
    candidate.getUTCMonth() !== numericMonth - 1 ||
    candidate.getUTCDate() !== numericDay ||
    candidate > new Date()
  ) {
    return "";
  }
  return `${year}-${String(numericMonth).padStart(2, "0")}-${String(
    numericDay,
  ).padStart(2, "0")}`;
};

const domainItems = (domain: CansDomain) => domain.items;

const splitDomainItems = (items: CansItem[]) => {
  if (items.length < 10) return [items];
  const midpoint = Math.ceil(items.length / 2);
  return [items.slice(0, midpoint), items.slice(midpoint)];
};

const flattenItems = (instrument: CansInstrument) =>
  instrument.domains.flatMap((domain) =>
    domain.items.map((item) => ({ domain, item })),
  );

const effectiveScore = (value: number | undefined) => value ?? 0;

const scoreLabel = (item: CansItem, value: number | undefined) => {
  if (value === undefined) return "0 predefinito (non inserito)";
  if (item.kind === "strength") return strengthAnchors[value] ?? String(value);
  if (item.kind === "binary") return binaryAnchors[value] ?? String(value);
  return needAnchors[value] ?? String(value);
};

const scoreClass = (item: CansItem, value: number | undefined) => {
  if (value === undefined) return "empty";
  if (item.kind === "binary") return value === 1 ? "warning" : "quiet";
  if (item.kind === "strength") {
    if (value <= 1) return "success";
    if (value === 2) return "warning";
    return "danger";
  }
  if (value >= 3) return "danger";
  if (value === 2) return "warning";
  if (value === 1) return "info";
  return "quiet";
};

const getStats = (
  instrument: CansInstrument,
  scores: Record<string, number | undefined>,
): DomainStats[] =>
  instrument.domains.map((domain) => {
    const items = domainItems(domain);
    const scored = items.map((item) => ({
      item,
      value: effectiveScore(scores[item.id]),
      entered: scores[item.id] !== undefined,
    }));
    const rawIndex =
      scored.reduce((sum, entry) => {
        if (entry.item.kind === "binary") return sum + (entry.value === 1 ? 0.8 : 0);
        if (entry.item.kind === "strength") return sum + (3 - entry.value) / 3;
        return sum + entry.value / 3;
      }, 0) / Math.max(items.length, 1);

    return {
      domain,
      answered: scored.filter((entry) => entry.entered).length,
      total: items.length,
      actionable: scored.filter(
        (entry) => entry.item.kind === "need" && entry.value >= 2,
      ).length,
      urgent: scored.filter(
        (entry) => entry.item.kind === "need" && entry.value === 3,
      ).length,
      usefulStrengths: scored.filter(
        (entry) => entry.item.kind === "strength" && entry.value <= 1,
      ).length,
      missingStrengths: scored.filter(
        (entry) => entry.item.kind === "strength" && entry.value >= 2,
      ).length,
      binaryYes: scored.filter(
        (entry) => entry.item.kind === "binary" && entry.value === 1,
      ).length,
      index: Math.round(Math.min(1, rawIndex) * 100) / 100,
    };
  });

const getNeedBands = (
  instrument: CansInstrument,
  scores: Record<string, number | undefined>,
): NeedBand[] =>
  instrument.domains
    .filter(
      (domain) =>
        domain.type === "core" &&
        domain.items.some((item) => item.kind === "need"),
    )
    .map((domain) => {
      const needs = domain.items.filter((item) => item.kind === "need");
      const counts: [number, number, number, number] = [0, 0, 0, 0];
      needs.forEach((item) => {
        const value = effectiveScore(scores[item.id]);
        counts[value as 0 | 1 | 2 | 3] += 1;
      });
      const answered = needs.filter((item) => scores[item.id] !== undefined).length;
      const denominator = Math.max(needs.length, 1);
      const percentages = counts.map((count) => count / denominator) as [
        number,
        number,
        number,
        number,
      ];
      return {
        domain,
        answered,
        total: needs.length,
        percentages,
        cumulative: [
          percentages[0],
          percentages[0] + percentages[1],
          percentages[0] + percentages[1] + percentages[2],
          needs.length ? 1 : 0,
        ],
      };
    });

const getStrengthPoints = (
  instrument: CansInstrument,
  scores: Record<string, number | undefined>,
): StrengthPoint[] =>
  flattenItems(instrument)
    .filter(({ item }) => item.kind === "strength")
    .map(({ item }) => {
      const raw = scores[item.id];
      return {
        item,
        raw,
        value: 3 - effectiveScore(raw),
      };
    });

const getTriggeredModuleIds = (
  instrument: CansInstrument,
  scores: Record<string, number | undefined>,
) =>
  new Set(
    flattenItems(instrument)
      .filter(
        ({ item }) =>
          item.opensModule &&
          effectiveScore(scores[item.id]) > 0,
      )
      .map(({ item }) => item.opensModule as string),
  );

const getActivatedModuleIds = (
  instrument: CansInstrument,
  scores: Record<string, number | undefined>,
) => {
  const moduleIds = getTriggeredModuleIds(instrument, scores);
  instrument.domains
    .filter(
      (domain) =>
        domain.type !== "core" &&
        domain.type !== "transition" &&
        domain.items.some((item) => scores[item.id] !== undefined),
    )
    .forEach((domain) => moduleIds.add(domain.id));
  return moduleIds;
};

const getApplicableDomains = (
  instrument: CansInstrument,
  scores: Record<string, number | undefined>,
) => {
  const moduleIds = getActivatedModuleIds(instrument, scores);
  return instrument.domains.filter(
    (domain) =>
      domain.type === "core" ||
      domain.type === "transition" ||
      moduleIds.has(domain.id),
  );
};

const getCompletion = (
  instrument: CansInstrument,
  scores: Record<string, number | undefined>,
) => {
  const items = getApplicableDomains(instrument, scores).flatMap((domain) =>
    domain.items.map((item) => ({ domain, item })),
  );
  const completed = items.filter(({ item }) => scores[item.id] !== undefined).length;
  return {
    completed,
    total: items.length,
    percentage: items.length ? Math.round((completed / items.length) * 100) : 0,
  };
};

const statusLabel = (status: AdministrationStatus) => {
  if (status === "completed") return "Completata";
  if (status === "suspended") return "Sospesa";
  return "In corso";
};

const cleanManualLines = (parts: string[]) =>
  parts.reduce((text, part) => {
    const cleaned = part.replace(/\s+/g, " ").trim();
    if (!cleaned) return text;
    if (!text) return cleaned;
    if (/[\p{L}]-$/u.test(text) && /^\p{Ll}/u.test(cleaned)) {
      return `${text.slice(0, -1)}${cleaned}`;
    }
    return `${text} ${cleaned}`;
  }, "");

const isTrailingManualHeading = (line: string) => {
  const letters = line.replace(/[^\p{L}]/gu, "");
  if (letters.length < 7) return false;
  const upper = letters.replace(/[^\p{Lu}]/gu, "").length;
  return upper / letters.length > 0.86 && line.length < 120;
};

const parseManualDetail = (detail: ManualDetail): ParsedManualDetail => {
  const lines = detail.text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const markerPattern = /^([0-3])(?:\s+(.*))?$/;
  const markers: { score: number; index: number; trailing: string }[] = [];
  let expectedScore = 0;

  lines.forEach((line, index) => {
    const match = line.match(markerPattern);
    if (!match || Number(match[1]) !== expectedScore) return;
    markers.push({
      score: expectedScore,
      index,
      trailing: match[2]?.trim() ?? "",
    });
    expectedScore += 1;
  });

  if (markers.length < 2) {
    return { description: cleanManualLines(lines), scoreHints: [] };
  }

  const firstMarker = markers[0];
  let evaluationCueIndex = -1;
  for (let index = 0; index < firstMarker.index; index += 1) {
    if (
      /^(Valutare|Considerare|Per la punteggiatura|Punteggiare)/i.test(
        lines[index],
      )
    ) {
      evaluationCueIndex = index;
    }
  }
  const estimatedStart = Math.max(
    0,
    firstMarker.index -
      Math.ceil((markers[1].index - firstMarker.index) / 2),
  );
  const scoringStart = firstMarker.trailing
    ? firstMarker.index
    : evaluationCueIndex >= 0
      ? evaluationCueIndex + 1
      : estimatedStart;
  const description = cleanManualLines(lines.slice(0, scoringStart));
  const lastMarker = markers[markers.length - 1];
  const stopIndex = lines.findIndex(
    (line, index) =>
      index > lastMarker.index &&
      (line.startsWith("MODULO ") ||
        line.startsWith("PUNTI DI FORZA ") ||
        isTrailingManualHeading(line)),
  );
  const scoringEnd = stopIndex >= 0 ? stopIndex : lines.length;
  const buckets = new Map<number, string[]>(
    markers.map((marker) => [marker.score, []]),
  );
  let previousText: { score: number; text: string } | undefined;

  lines.slice(scoringStart, scoringEnd).forEach((line, offset) => {
    const index = scoringStart + offset;
    const exactMarker = markers.find((marker) => marker.index === index);
    if (exactMarker) {
      if (exactMarker.trailing) {
        buckets.get(exactMarker.score)?.push(exactMarker.trailing);
        previousText = { score: exactMarker.score, text: exactMarker.trailing };
      }
      return;
    }

    let nearest = markers.reduce((best, marker) => {
      const distance = Math.abs(marker.index - index);
      const bestDistance = Math.abs(best.index - index);
      return distance < bestDistance ||
        (distance === bestDistance && marker.score > best.score)
        ? marker
        : best;
    }, markers[0]);
    if (
      previousText &&
      /[\p{L}]-$/u.test(previousText.text) &&
      /^\p{Ll}/u.test(line)
    ) {
      nearest = markers.find((marker) => marker.score === previousText?.score) ?? nearest;
    }
    buckets.get(nearest.score)?.push(line);
    previousText = { score: nearest.score, text: line };
  });

  return {
    description,
    scoreHints: markers.map((marker) => ({
      score: marker.score,
      text: cleanManualLines(buckets.get(marker.score) ?? []),
    })),
  };
};

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
};

const base64ToBytes = (value: string) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const deriveBackupKey = async (
  passphrase: string,
  salt: Uint8Array<ArrayBuffer>,
  usage: KeyUsage[],
  iterations = backupIterations,
) => {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      iterations,
      salt,
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    usage,
  );
};

const encryptBackup = async (
  state: StoredState,
  passphrase: string,
): Promise<EncryptedBackup> => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveBackupKey(passphrase, salt, ["encrypt"]);
  const plaintext = new TextEncoder().encode(
    JSON.stringify({ ...state, exportedAt: nowIso() }),
  );
  const payload = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  return {
    format: "CANS Studio encrypted backup",
    version: 1,
    createdAt: nowIso(),
    kdf: {
      name: "PBKDF2",
      hash: "SHA-256",
      iterations: backupIterations,
      salt: bytesToBase64(salt),
    },
    cipher: {
      name: "AES-GCM",
      iv: bytesToBase64(iv),
    },
    payload: bytesToBase64(new Uint8Array(payload)),
  };
};

const isEncryptedBackup = (value: unknown): value is EncryptedBackup => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<EncryptedBackup>;
  return (
    candidate.format === "CANS Studio encrypted backup" &&
    candidate.version === 1 &&
    candidate.kdf?.name === "PBKDF2" &&
    typeof candidate.kdf.iterations === "number" &&
    candidate.kdf.iterations >= 100_000 &&
    candidate.kdf.iterations <= 2_000_000 &&
    candidate.cipher?.name === "AES-GCM" &&
    typeof candidate.payload === "string"
  );
};

const decryptBackup = async (
  backup: EncryptedBackup,
  passphrase: string,
): Promise<StoredState> => {
  const salt = base64ToBytes(backup.kdf.salt);
  const iv = base64ToBytes(backup.cipher.iv);
  const key = await deriveBackupKey(
    passphrase,
    salt,
    ["decrypt"],
    backup.kdf.iterations,
  );
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    base64ToBytes(backup.payload),
  );
  return parseState(JSON.parse(new TextDecoder().decode(plaintext)));
};

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};

const downloadSvgPng = async (svg: SVGSVGElement, fileName: string) => {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const box = svg.viewBox.baseVal;
  const width = box?.width || svg.clientWidth || 900;
  const height = box?.height || svg.clientHeight || 520;
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));

  const serialized = new XMLSerializer().serializeToString(clone);
  const imageUrl = URL.createObjectURL(
    new Blob([serialized], { type: "image/svg+xml;charset=utf-8" }),
  );
  const image = new Image();
  image.decoding = "async";
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Impossibile esportare il grafico"));
    image.src = imageUrl;
  });

  const canvas = document.createElement("canvas");
  const scale = 2;
  canvas.width = width * scale;
  canvas.height = height * scale;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.scale(scale, scale);
  context.fillStyle =
    getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || "white";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  URL.revokeObjectURL(imageUrl);
  canvas.toBlob((blob) => {
    if (blob) downloadBlob(blob, fileName);
  }, "image/png");
};

const mergeById = <T extends { id: string }>(
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

function App() {
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(state));
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
    patients.find((patient) => patient.id === state.selectedPatientId) ?? patients[0];
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
  const scoringAdministration: Administration | undefined = viewingFinal &&
    selectedAssessment
    ? {
        id: finalAdministrationId,
        label: "Valutazione finale",
        respondentRole: "Fusione delle sottosomministrazioni",
        clinician: "",
        date: selectedAssessment.finalizedAt?.slice(0, 10) ?? selectedAssessment.date,
        status: "completed",
        scores: selectedAssessment.finalScores,
        itemNotes: selectedAssessment.finalItemNotes,
        notes: selectedAssessment.finalNotes,
        updatedAt: selectedAssessment.finalizedAt ?? selectedAssessment.updatedAt,
      }
    : selectedAdministration;
  const instrument = getInstrument(selectedAssessment?.instrumentId ?? "cans-5-17");
  const allItems = useMemo(() => flattenItems(instrument), [instrument]);
  const completion = getCompletion(instrument, scoringAdministration?.scores ?? {});
  const finalCompletion = getCompletion(instrument, selectedAssessment?.finalScores ?? {});

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
    setNotice(`Creato il paziente ${patientName(patient)}.`);
  };

  const addAssessment = (instrumentId: CansInstrument["id"]) => {
    if (!selectedPatient) return;
    const position = patientAssessments.length;
    const assessment = createAssessment(selectedPatient.id, instrumentId, position);
    updateState((current) => ({
      ...current,
      assessments: [...current.assessments, assessment],
      selectedAssessmentId: assessment.id,
      selectedAdministrationId: assessment.administrations[0].id,
    }));
    setTab("score");
    setDomainFilter("all-core");
  };

  const selectAssessment = (assessmentId: string) => {
    const assessment = state.assessments.find((entry) => entry.id === assessmentId);
    updateState((current) => ({
      ...current,
      selectedAssessmentId: assessmentId,
      selectedAdministrationId:
        assessment?.status === "final"
          ? finalAdministrationId
          : assessment?.administrations[0]?.id ?? "",
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

  const setScore = (itemId: string, value: number) => {
    if (!selectedAdministration || selectedAdministration.status !== "in_progress") return;
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
  };

  const setItemNote = (itemId: string, note: string) => {
    if (!selectedAdministration || selectedAdministration.status !== "in_progress") return;
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
  };

  const clearAdministration = () => {
    if (!selectedAdministration || selectedAdministration.status !== "in_progress") return;
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
        [itemId]: {
          ...guidance,
          updatedAt: nowIso(),
        },
      },
    }));
    setNotice("Descrizione e criteri dell'item aggiornati.");
  };

  const resetItemGuidance = (itemId: string) => {
    updateState((current) => {
      const itemGuidanceOverrides = { ...current.itemGuidanceOverrides };
      delete itemGuidanceOverrides[itemId];
      return { ...current, itemGuidanceOverrides };
    });
    setNotice("Ripristinato il testo originale del manuale.");
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
  };

  const deleteAssessment = () => {
    if (!selectedAssessment) return;
    const remaining = patientAssessments.filter(
      (assessment) => assessment.id !== selectedAssessment.id,
    );
    updateState((current) => ({
      ...current,
      assessments: current.assessments.filter(
        (assessment) => assessment.id !== selectedAssessment.id,
      ),
      selectedAssessmentId: remaining[0]?.id ?? "",
      selectedAdministrationId: remaining[0]?.administrations[0]?.id ?? "",
    }));
  };

  const deleteAdministration = (administrationId: string) => {
    if (!selectedAssessment || selectedAssessment.administrations.length <= 1) return;
    const remaining = selectedAssessment.administrations.filter(
      (administration) => administration.id !== administrationId,
    );
    updateState((current) => ({
      ...current,
      selectedAdministrationId: remaining[0]?.id ?? "",
      assessments: current.assessments.map((assessment) =>
        assessment.id === selectedAssessment.id
          ? {
              ...assessment,
              status: "draft",
              administrations: remaining,
              updatedAt: nowIso(),
            }
          : assessment,
      ),
    }));
  };

  const startFusion = () => {
    if (!selectedAssessment) return;
    const scores = { ...selectedAssessment.finalScores };
    const notes = { ...selectedAssessment.finalItemNotes };
    allItems.forEach(({ item }) => {
      if (scores[item.id] !== undefined) return;
      const hasAnyEnteredScore = selectedAssessment.administrations.some(
        (administration) => administration.scores[item.id] !== undefined,
      );
      if (!hasAnyEnteredScore) return;
      const values = selectedAssessment.administrations
        .map((administration) =>
          effectiveScore(administration.scores[item.id]),
        );
      const unique = Array.from(new Set(values));
      if (unique.length === 1) scores[item.id] = unique[0];
    });
    setFusionDraft({ scores, notes });
    setShowOnlyDiscordant(true);
  };

  const saveFusion = () => {
    if (!selectedAssessment || !fusionDraft) return;
    const scoredBySources = new Set(
      selectedAssessment.administrations.flatMap((administration) =>
        Object.entries(administration.scores)
          .filter(([, value]) => value !== undefined)
          .map(([itemId]) => itemId),
      ),
    );
    const unresolved = Array.from(scoredBySources).filter(
      (itemId) => fusionDraft.scores[itemId] === undefined,
    );
    if (unresolved.length) {
      setNotice(`Restano ${unresolved.length} item da decidere nella fusione.`);
      return;
    }
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
    setNotice("Valutazione finale salvata. Le sottosomministrazioni restano disponibili.");
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

  const exportExcel = async () => {
    const { default: writeXlsxFile } = await import("write-excel-file/browser");
    const patientSheet: SheetData = [
      headerRow([
        "ID globale paziente",
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
        "Codice paziente",
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
        "Codice paziente",
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
        "Codice paziente",
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
        { data: patientSheet, sheet: "Pazienti", stickyRowsCount: 1 },
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
          current.selectedPatientId || incoming.selectedPatientId || incoming.patients[0]?.id || "",
        selectedAssessmentId:
          current.selectedAssessmentId ||
          importedAssessmentId,
        selectedAdministrationId:
          current.selectedAdministrationId ||
          importedAdministrationId,
      }));
      setBackupDialog(null);
      setNotice(
        `Import completato: ${incoming.patients.length} pazienti e ${incoming.assessments.length} intervalli.`,
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
    if (domainFilter !== "all" && domainFilter !== "all-core") {
      return instrument.domains.filter((domain) => domain.id === domainFilter);
    }

    return instrument.domains.filter(
      (domain) =>
        domain.type === "core" ||
        domain.type === "transition" ||
        (domainFilter === "all" && !triggeredModuleIds.has(domain.id)),
    );
  })();

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Pazienti">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true">
            <Radar size={21} />
          </div>
          <div>
            <p className="app-name">CANS Studio</p>
            <p className="app-subtitle">Scoring collaborativo</p>
          </div>
        </div>

        <div className="privacy-note">
          <LockKeyhole size={17} />
          <span>
            L'anagrafica resta sul dispositivo ed è inclusa solo nei backup cifrati.
          </span>
        </div>

        <label className="search-field">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">Cerca paziente</span>
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
            <p className="muted-copy compact">Nessun paziente corrispondente.</p>
          )}
        </div>

        <div className="sidebar-footer">
          <div className="new-patient">
            <p className="section-label">Nuovo paziente</p>
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
                    setBirthDayDraft(event.target.value.replace(/\D/g, "").slice(0, 2))
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
                    setBirthMonthDraft(event.target.value.replace(/\D/g, "").slice(0, 2))
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
                    setBirthYearDraft(event.target.value.replace(/\D/g, "").slice(0, 4))
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
              <Plus size={16} /> Aggiungi paziente
            </button>
          </div>

          <div className="global-data-actions">
            <button className="secondary-button" onClick={openExportBackup}>
              <FileJson size={16} /> Backup cifrato
            </button>
            <button className="secondary-button" onClick={() => fileInputRef.current?.click()}>
              <FileUp size={16} /> Importa dati
            </button>
            <button
              className="secondary-button"
              onClick={exportExcel}
              title="Il file Excel contiene dati in chiaro"
            >
              <FileSpreadsheet size={16} /> Excel non cifrato
            </button>
          </div>
        </div>
      </aside>

      <main className="workspace" id="main-content">
        <header className="topbar">
          <div>
            <p className="eyeline">Paziente selezionato</p>
            <h1>
              {selectedPatient ? patientName(selectedPatient) : "Nessun paziente selezionato"}
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
          <div className="topbar-actions">
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
                  updateAdministration(selectedAdministration.id, patch, invalidateFinal)
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
      {notice && <div className="toast" role="status">{notice}</div>}
    </div>
  );
}

function HelpDialog({ close }: { close: () => void }) {
  const [topic, setTopic] = useState<HelpTopic>("overview");
  const topics: {
    id: HelpTopic;
    label: string;
    icon: ReactNode;
  }[] = [
    { id: "overview", label: "Primi passi", icon: <Play size={17} /> },
    { id: "patients", label: "Pazienti e tempi", icon: <UsersRound size={17} /> },
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
                  <HelpStep icon={<UserRound size={18} />} title="Paziente">
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
                  title="Pazienti, intervalli e sottosomministrazioni"
                  description="Ogni paziente può avere più valutazioni nel tempo e più fonti nello stesso intervallo."
                />
                <HelpFeatureRows
                  rows={[
                    {
                      icon: <UserRound size={18} />,
                      title: "Creare e cercare un paziente",
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
                      title: "Zero predefinito",
                      text: "Un item non inserito vale 0 nei calcoli, ma rimane indicato come predefinito per distinguerlo da una scelta esplicita.",
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
                  description="La fusione produce il punteggio definitivo del paziente per quello specifico intervallo T."
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
                      text: "Importa un backup cifrato per unire pazienti, intervalli, fonti e testi personalizzati con quelli già presenti.",
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

function AssessmentContextBar({
  assessment,
  administration,
  viewingFinal,
  updateAssessment,
  updateAdministration,
  selectAdministration,
  addAdministration,
  startFusion,
}: {
  assessment: Assessment;
  administration: Administration;
  viewingFinal: boolean;
  updateAssessment: (patch: Partial<Assessment>) => void;
  updateAdministration: (patch: Partial<Administration>) => void;
  selectAdministration: (id: string) => void;
  addAdministration: () => void;
  startFusion: () => void;
}) {
  const hasAnyScores = assessment.administrations.some((entry) =>
    Object.values(entry.scores).some((value) => value !== undefined),
  );
  return (
    <section className="assessment-context" aria-label="Intervallo e fonte selezionati">
      <div className="timepoint-fields">
        <label>
          Intervallo
          <input
            value={assessment.interval}
            onChange={(event) => updateAssessment({ interval: event.target.value })}
          />
        </label>
        <label>
          Data T
          <input
            type="date"
            value={assessment.date}
            onChange={(event) => updateAssessment({ date: event.target.value })}
          />
        </label>
        <label>
          Strumento
          <select
            value={assessment.instrumentId}
            disabled={hasAnyScores}
            onChange={(event) =>
              updateAssessment({
                instrumentId: event.target.value as CansInstrument["id"],
              })
            }
          >
            {instruments.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="source-switcher">
        <label>
          Vista compilazione
          <select
            value={administration.id}
            onChange={(event) => selectAdministration(event.target.value)}
          >
            {assessment.status === "final" && (
              <option value={finalAdministrationId}>
                Valutazione finale - fusione
              </option>
            )}
            {assessment.administrations.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label} - {statusLabel(entry.status)}
              </option>
            ))}
          </select>
        </label>
        <button className="icon-button" onClick={addAdministration} title="Aggiungi fonte">
          <Plus size={17} />
        </button>
      </div>
      <div className="context-status">
        <span className={`status-badge ${viewingFinal ? "completed" : assessment.status}`}>
          {viewingFinal
            ? "Vista finale"
            : assessment.status === "final"
              ? "Fonte originale"
              : "Da finalizzare"}
        </span>
        <button className="primary-button" onClick={startFusion} disabled={!hasAnyScores}>
          <GitMerge size={16} />
          {assessment.status === "final" ? "Rivedi fusione" : "Fondi punteggi"}
        </button>
      </div>
    </section>
  );
}

function TabButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className={`tab-button ${active ? "is-active" : ""}`} onClick={onClick}>
      {icon}
      {label}
    </button>
  );
}

function ScoringView({
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
          {!viewingFinal && <div className="inline-actions">
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
          </div>}
        </div>

        {!viewingFinal && <div className="source-metadata">
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
        </div>}

        <div className="domain-stack">
          {displayedDomains.map((domain) => (
            <section
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
                {splitDomainItems(domain.items).map((items, columnIndex) => (
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
          ))}
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

function InlineModuleBlock({
  domain,
  administration,
  setScore,
  setNote,
  openInfo,
  readOnly,
}: {
  domain: CansDomain;
  administration: Administration;
  setScore: (itemId: string, value: number) => void;
  setNote: (itemId: string, note: string) => void;
  openInfo: (item: CansItem) => void;
  readOnly: boolean;
}) {
  return (
    <section className="inline-module">
      <div className="inline-module-heading">
        <div>
          <h4>{domain.title}</h4>
          <p>Approfondimento attivato dal punteggio precedente</p>
        </div>
        <span>{domain.items.length} item</span>
      </div>
      <div className="inline-module-matrix">
        <div className="score-matrix-head" aria-hidden="true">
          <span>Item</span>
          <span>0</span>
          <span>1</span>
          <span>2</span>
          <span>3</span>
          <span>Azioni</span>
        </div>
        {domain.items.map((item) => (
          <ScoreRow
            key={item.id}
            item={item}
            value={administration.scores[item.id]}
            note={administration.itemNotes[item.id] ?? ""}
            setScore={setScore}
            setNote={setNote}
            openInfo={openInfo}
            readOnly={readOnly}
          />
        ))}
      </div>
    </section>
  );
}

function ScoreRow({
  item,
  value,
  note,
  setScore,
  setNote,
  openInfo,
  readOnly,
}: {
  item: CansItem;
  value: number | undefined;
  note: string;
  setScore: (itemId: string, value: number) => void;
  setNote: (itemId: string, note: string) => void;
  openInfo: (item: CansItem) => void;
  readOnly: boolean;
}) {
  const [noteOpen, setNoteOpen] = useState(Boolean(note));
  const values = item.kind === "binary" ? [0, 1] : [0, 1, 2, 3];
  const scoreSlots = [0, 1, 2, 3].map((entry) =>
    values.includes(entry) ? entry : undefined,
  );
  return (
    <div className={`score-row ${noteOpen ? "has-note-editor" : ""}`}>
      <div className="item-copy">
        <strong>{item.label}</strong>
        <span className={scoreClass(item, value)}>{scoreLabel(item, value)}</span>
        {item.opensModule && <em>apre modulo se &gt; 0</em>}
      </div>
      {scoreSlots.map((entry, index) => (
        <div className="score-cell" key={index}>
          {entry === undefined ? (
            <span className="score-cell-empty" aria-hidden="true" />
          ) : (
            <button
              className={`matrix-score-button ${
                value === entry
                  ? "is-selected"
                  : value === undefined && entry === 0
                    ? "is-default"
                    : ""
              } ${scoreClass(item, entry)}`}
              onClick={() => setScore(item.id, entry)}
              aria-label={`${item.label}: ${scoreLabel(item, entry)}`}
              aria-pressed={value === entry}
              disabled={readOnly}
              title={scoreLabel(item, entry)}
            >
              {item.kind === "binary" ? binaryAnchors[entry] : entry}
            </button>
          )}
        </div>
      ))}
      <div className="item-row-actions">
        <button
          className="mini-icon-button"
          onClick={() => openInfo(item)}
          aria-label={`Informazioni su ${item.label}`}
          title="Descrizione e criteri dal manuale"
        >
          <Info size={15} />
        </button>
        <button
          className={`mini-icon-button ${note ? "has-content" : ""}`}
          onClick={() => setNoteOpen((open) => !open)}
          aria-label={`Nota per ${item.label}`}
          title="Aggiungi una nota al punteggio"
        >
          <MessageSquarePlus size={15} />
        </button>
      </div>
      {noteOpen && (
        <div className="item-note-editor">
          <label>
            Motivo del punteggio
            <textarea
              value={note}
              disabled={readOnly}
              maxLength={600}
              onChange={(event) => setNote(item.id, event.target.value)}
              placeholder="Breve nota clinica utile al confronto tra le fonti"
            />
          </label>
          <span>{note.length}/600</span>
        </div>
      )}
    </div>
  );
}

function ItemInfoDialog({
  item,
  detail,
  loading,
  guidanceOverride,
  saveGuidance,
  resetGuidance,
  close,
}: {
  item: CansItem;
  detail?: ManualDetail;
  loading: boolean;
  guidanceOverride?: ItemGuidanceOverride;
  saveGuidance: (
    itemId: string,
    guidance: Omit<ItemGuidanceOverride, "updatedAt">,
  ) => void;
  resetGuidance: (itemId: string) => void;
  close: () => void;
}) {
  const parsed = useMemo(
    () => (detail ? parseManualDetail(detail) : undefined),
    [detail],
  );
  const scoreValues = item.kind === "binary" ? [0, 1] : [0, 1, 2, 3];
  const resolvedGuidance = useMemo<ParsedManualDetail | undefined>(() => {
    if (!parsed && !guidanceOverride) return undefined;
    return {
      description:
        guidanceOverride?.description ?? parsed?.description ?? "",
      scoreHints: scoreValues.map((score) => ({
        score,
        text:
          guidanceOverride?.scoreHints[String(score)] ??
          parsed?.scoreHints.find((hint) => hint.score === score)?.text ??
          "",
      })),
    };
  }, [guidanceOverride, item.kind, parsed]);
  const [editing, setEditing] = useState(false);
  const [draftDescription, setDraftDescription] = useState("");
  const [draftHints, setDraftHints] = useState<Record<string, string>>({});
  const [editError, setEditError] = useState("");

  useEffect(() => {
    setEditing(false);
    setEditError("");
    setDraftDescription(resolvedGuidance?.description ?? "");
    setDraftHints(
      Object.fromEntries(
        (resolvedGuidance?.scoreHints ?? []).map((hint) => [
          String(hint.score),
          hint.text,
        ]),
      ),
    );
  }, [item.id, guidanceOverride, resolvedGuidance]);

  const beginEditing = () => {
    setDraftDescription(resolvedGuidance?.description ?? "");
    setDraftHints(
      Object.fromEntries(
        (resolvedGuidance?.scoreHints ?? []).map((hint) => [
          String(hint.score),
          hint.text,
        ]),
      ),
    );
    setEditError("");
    setEditing(true);
  };

  const saveEditing = () => {
    const description = draftDescription.trim();
    const scoreHints = Object.fromEntries(
      scoreValues.map((score) => [
        String(score),
        (draftHints[String(score)] ?? "").trim(),
      ]),
    );
    if (!description || Object.values(scoreHints).some((text) => !text)) {
      setEditError("Completa la descrizione e tutti i criteri di punteggio.");
      return;
    }
    saveGuidance(item.id, { description, scoreHints });
    setEditing(false);
  };

  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <section
        className="modal item-info-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="item-info-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <p className="eyeline">Manuale {detail?.source === "cans-0-5" ? "CANS 0-5" : "CANS 5-17+"}</p>
            <h2 id="item-info-title">{item.label}</h2>
          </div>
          <button className="icon-button" onClick={close} aria-label="Chiudi">
            <X size={18} />
          </button>
        </div>
        {loading ? (
          <div className="empty-inline">
            <CircleHelp size={22} />
            <p>Caricamento delle indicazioni dal manuale…</p>
          </div>
        ) : resolvedGuidance ? (
          <div className="manual-content">
            <section>
              <div className="manual-section-heading">
                <h3>Descrizione dell’item</h3>
                {guidanceOverride && !editing && (
                  <span className="status-badge in_progress">
                    Testo personalizzato
                  </span>
                )}
              </div>
              {editing ? (
                <textarea
                  className="manual-description-editor"
                  value={draftDescription}
                  onChange={(event) => setDraftDescription(event.target.value)}
                  aria-label={`Descrizione di ${item.label}`}
                />
              ) : (
                <p>{resolvedGuidance.description}</p>
              )}
            </section>
            {resolvedGuidance.scoreHints.length ? (
              <section>
                <h3>Come attribuire il punteggio</h3>
                <div className="manual-score-list">
                  {resolvedGuidance.scoreHints.map((hint) => (
                    <div
                      className={`manual-score-row ${editing ? "is-editing" : ""}`}
                      key={hint.score}
                    >
                      <span
                        className={`manual-score-badge ${scoreClass(
                          item,
                          hint.score,
                        )}`}
                        aria-label={`Punteggio ${hint.score}`}
                      >
                        {hint.score}
                      </span>
                      {editing ? (
                        <textarea
                          value={draftHints[String(hint.score)] ?? ""}
                          onChange={(event) =>
                            setDraftHints((current) => ({
                              ...current,
                              [String(hint.score)]: event.target.value,
                            }))
                          }
                          aria-label={`Criterio per il punteggio ${hint.score}`}
                        />
                      ) : (
                        <p>{hint.text}</p>
                      )}
                    </div>
                  ))}
                </div>
                {editError && <p className="form-error">{editError}</p>}
              </section>
            ) : null}
          </div>
        ) : (
          <div className="empty-inline">
            <CircleHelp size={22} />
            <p>Il dettaglio testuale non è disponibile per questo item.</p>
          </div>
        )}
        <div className="modal-footer">
          <p>
            {guidanceOverride
              ? "Le modifiche sono salvate sul dispositivo e incluse nel backup cifrato."
              : "Testo tratto dal manuale italiano allegato. Il giudizio clinico resta affidato al professionista formato CANS."}
          </p>
          <div className="inline-actions">
            {editing ? (
              <>
                {guidanceOverride && (
                  <button
                    className="secondary-button"
                    onClick={() => {
                      resetGuidance(item.id);
                      setEditing(false);
                    }}
                  >
                    <RotateCcw size={16} /> Ripristina originale
                  </button>
                )}
                <button
                  className="secondary-button"
                  onClick={() => setEditing(false)}
                >
                  Annulla
                </button>
                <button className="primary-button" onClick={saveEditing}>
                  <Check size={16} /> Salva modifiche
                </button>
              </>
            ) : (
              <>
                <button className="secondary-button" onClick={beginEditing}>
                  <Pencil size={16} /> Modifica testo
                </button>
                <button className="primary-button" onClick={close}>Chiudi</button>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function BackupDialog({
  state,
  setState,
  generatePassphrase,
  copyPassphrase,
  close,
  confirm,
}: {
  state: BackupDialogState;
  setState: (value: BackupDialogState | null) => void;
  generatePassphrase: () => void;
  copyPassphrase: () => void;
  close: () => void;
  confirm: () => void;
}) {
  const exporting = state.mode === "export";
  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <section
        className="modal backup-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="backup-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <p className="eyeline">
              {exporting ? "Protezione del backup" : "Importazione protetta"}
            </p>
            <h2 id="backup-title">
              {exporting ? "Crea backup completo cifrato" : "Sblocca il backup"}
            </h2>
          </div>
          <button className="icon-button" onClick={close} aria-label="Chiudi">
            <X size={18} />
          </button>
        </div>

        <div className="backup-content">
          <div className="backup-security-note">
            <ShieldCheck size={19} />
            <p>
              {exporting
                ? "Il file includerà anagrafica, punteggi e note. Comunica la passphrase al destinatario attraverso un canale separato."
                : `Il file ${state.fileName ?? ""} è cifrato. La passphrase non viene memorizzata dall'app.`}
            </p>
          </div>

          <label>
            Passphrase
            <div className="password-field">
              <input
                type={state.showPassphrase ? "text" : "password"}
                value={state.passphrase}
                autoFocus
                autoComplete="off"
                onChange={(event) =>
                  setState({
                    ...state,
                    passphrase: event.target.value,
                    error: "",
                  })
                }
                placeholder={
                  exporting ? "Almeno 12 caratteri" : "Passphrase del backup"
                }
              />
              <button
                type="button"
                className="icon-button"
                onClick={() =>
                  setState({ ...state, showPassphrase: !state.showPassphrase })
                }
                aria-label={
                  state.showPassphrase ? "Nascondi passphrase" : "Mostra passphrase"
                }
              >
                {state.showPassphrase ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
              {exporting && (
                <button
                  type="button"
                  className="icon-button"
                  onClick={copyPassphrase}
                  disabled={!state.passphrase}
                  aria-label="Copia passphrase"
                  title="Copia passphrase"
                >
                  <Copy size={17} />
                </button>
              )}
            </div>
          </label>

          {exporting && (
            <>
              <label>
                Conferma passphrase
                <input
                  type={state.showPassphrase ? "text" : "password"}
                  value={state.confirmPassphrase}
                  autoComplete="off"
                  onChange={(event) =>
                    setState({
                      ...state,
                      confirmPassphrase: event.target.value,
                      error: "",
                    })
                  }
                />
              </label>
              <button
                type="button"
                className="secondary-button generate-passphrase"
                onClick={generatePassphrase}
              >
                <LockKeyhole size={16} /> Genera passphrase sicura
              </button>
            </>
          )}

          {state.error && (
            <p className="form-error" role="alert">
              {state.error}
            </p>
          )}
        </div>

        <div className="modal-footer">
          <p>
            La passphrase non può essere recuperata. Senza di essa il backup resta
            illeggibile.
          </p>
          <div className="inline-actions">
            <button className="secondary-button" onClick={close} disabled={state.busy}>
              Annulla
            </button>
            <button className="primary-button" onClick={confirm} disabled={state.busy}>
              <LockKeyhole size={16} />
              {state.busy
                ? exporting
                  ? "Cifratura..."
                  : "Sblocco..."
                : exporting
                  ? "Crea backup"
                  : "Importa dati"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function FusionDialog({
  assessment,
  instrument,
  draft,
  setDraft,
  showOnlyDiscordant,
  setShowOnlyDiscordant,
  close,
  save,
}: {
  assessment: Assessment;
  instrument: CansInstrument;
  draft: FusionDraft;
  setDraft: (draft: FusionDraft) => void;
  showOnlyDiscordant: boolean;
  setShowOnlyDiscordant: (value: boolean) => void;
  close: () => void;
  save: () => void;
}) {
  const rows = flattenItems(instrument).map(({ domain, item }) => {
    const sourceValues = assessment.administrations.map((administration) =>
      effectiveScore(administration.scores[item.id]),
    );
    const unique = Array.from(new Set(sourceValues));
    const hasAny = assessment.administrations.some(
      (administration) => administration.scores[item.id] !== undefined,
    );
    return {
      domain,
      item,
      discordant: hasAny && unique.length > 1,
      hasAny,
    };
  });
  const discordantCount = rows.filter((row) => row.discordant).length;
  const visibleRows = rows
    .filter((row) => row.hasAny)
    .filter((row) => !showOnlyDiscordant || row.discordant)
    .sort((left, right) => Number(right.discordant) - Number(left.discordant));
  const unresolved = rows.filter(
    (row) => row.hasAny && draft.scores[row.item.id] === undefined,
  ).length;

  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <section
        className="modal fusion-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fusion-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header fusion-header">
          <div>
            <p className="eyeline">
              {assessment.interval} - {instrument.title}
            </p>
            <h2 id="fusion-title">Fusione delle sottosomministrazioni</h2>
            <p>
              I punteggi concordi sono proposti automaticamente. Le righe evidenziate
              richiedono una decisione manuale.
            </p>
          </div>
          <button className="icon-button" onClick={close} aria-label="Chiudi">
            <X size={18} />
          </button>
        </div>

        <div className="fusion-toolbar">
          <div className="summary-strip compact-summary">
            <Metric
              icon={<AlertTriangle size={17} />}
              label="Discordanze"
              value={discordantCount}
              tone="warning"
            />
            <Metric
              icon={<ClipboardList size={17} />}
              label="Fonti"
              value={assessment.administrations.length}
              tone="info"
            />
            <Metric
              icon={<CheckCircle2 size={17} />}
              label="Da decidere"
              value={unresolved}
              tone={unresolved ? "danger" : "success"}
            />
          </div>
          <label className="toggle-control">
            <input
              type="checkbox"
              checked={showOnlyDiscordant}
              onChange={(event) => setShowOnlyDiscordant(event.target.checked)}
            />
            <span>Solo punteggi discordanti</span>
          </label>
        </div>

        <div className="fusion-table">
          {visibleRows.length ? (
            visibleRows.map(({ domain, item, discordant }) => {
              const values = item.kind === "binary" ? [0, 1] : [0, 1, 2, 3];
              return (
                <article
                  className={`fusion-row ${discordant ? "is-discordant" : ""}`}
                  key={item.id}
                >
                  <div className="fusion-item-title">
                    <span>{domain.shortTitle}</span>
                    <h3>{item.label}</h3>
                    {discordant && <em>Punteggi discordanti</em>}
                  </div>
                  <div className="source-evidence">
                    {assessment.administrations.map((administration) => {
                      const value = administration.scores[item.id];
                      const displayedValue = effectiveScore(value);
                      const note = administration.itemNotes[item.id];
                      return (
                        <div className="source-evidence-entry" key={administration.id}>
                          <div>
                            <strong>{administration.label}</strong>
                            <span
                              className={`score-chip ${scoreClass(
                                item,
                                displayedValue,
                              )} ${value === undefined ? "is-default" : ""}`}
                              title={value === undefined ? "0 predefinito" : undefined}
                            >
                              {displayedValue}
                            </span>
                          </div>
                          <p>{note || "Nessuna nota per questo item."}</p>
                        </div>
                      );
                    })}
                  </div>
                  <div className="final-decision">
                    <span>Punteggio finale</span>
                    <div className="score-buttons compact-buttons">
                      {values.map((value) => (
                        <button
                          key={value}
                          className={`${
                            draft.scores[item.id] === value ? "is-selected" : ""
                          } ${scoreClass(item, value)}`}
                          onClick={() =>
                            setDraft({
                              ...draft,
                              scores: { ...draft.scores, [item.id]: value },
                            })
                          }
                          title={scoreLabel(item, value)}
                        >
                          {item.kind === "binary" ? binaryAnchors[value] : value}
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={draft.notes[item.id] ?? ""}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          notes: {
                            ...draft.notes,
                            [item.id]: event.target.value || undefined,
                          },
                        })
                      }
                      placeholder="Nota sulla decisione finale, facoltativa"
                    />
                  </div>
                </article>
              );
            })
          ) : (
            <div className="empty-inline">
              <CheckCircle2 size={24} />
              <p>
                {showOnlyDiscordant
                  ? "Non ci sono punteggi discordanti. Mostra tutti gli item per controllare la proposta finale."
                  : "Nessun item è stato ancora punteggiato nelle fonti."}
              </p>
            </div>
          )}
        </div>

        <div className="modal-footer fusion-footer">
          <p>
            {unresolved
              ? `Decidi ancora ${unresolved} item prima di salvare.`
              : "Tutti gli item compilati nelle fonti hanno un punteggio finale."}
          </p>
          <div className="inline-actions">
            <button className="secondary-button" onClick={close}>Annulla</button>
            <button className="primary-button" onClick={save} disabled={Boolean(unresolved)}>
              <Check size={16} /> Salva valutazione finale
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function ResultsView({
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

function CompareView({
  selectedAssessment,
  previousAssessment,
  instrument,
}: {
  selectedAssessment: Assessment;
  previousAssessment?: Assessment;
  instrument: CansInstrument;
}) {
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
        </div>
        <div className="comparison-star-grid">
          <CansNeedStarChart
            bands={previousBands}
            title={`Bisogni ${previousAssessment.interval}`}
          />
          <CansNeedStarChart
            bands={currentBands}
            title={`Bisogni ${selectedAssessment.interval}`}
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
            Nei punti di forza, l’area più estesa indica maggiori risorse
            disponibili per il piano di intervento.
          </p>
        </div>
      </aside>
    </section>
  );
}

function ArchiveView({
  patientAssessments,
  selectedAssessment,
  selectedAdministrationId,
  selectAssessment,
  selectAdministration,
  deleteAssessment,
  deleteAdministration,
  startFusion,
}: {
  patientAssessments: Assessment[];
  selectedAssessment: Assessment;
  selectedAdministrationId: string;
  selectAssessment: (id: string) => void;
  selectAdministration: (id: string) => void;
  deleteAssessment: () => void;
  deleteAdministration: (id: string) => void;
  startFusion: () => void;
}) {
  return (
    <section className="archive-panel">
      <div className="panel-heading">
        <div>
          <p className="eyeline">Tracciabilità completa</p>
          <h2>Archivio intervalli e fonti</h2>
          <p className="heading-support">
            Le sottosomministrazioni restano recuperabili anche dopo la fusione.
          </p>
        </div>
        <button className="primary-button" onClick={startFusion}>
          <GitMerge size={16} /> Apri fusione
        </button>
      </div>
      <div className="archive-layout">
        <div className="assessment-timeline">
          {patientAssessments.map((assessment) => {
            const completedSources = assessment.administrations.filter(
              (entry) => entry.status === "completed",
            ).length;
            return (
              <button
                className={`timeline-row ${
                  assessment.id === selectedAssessment.id ? "is-active" : ""
                }`}
                key={assessment.id}
                onClick={() => selectAssessment(assessment.id)}
              >
                <CalendarDays size={18} />
                <span>
                  <strong>{assessment.interval}</strong>
                  <em>
                    {formatDate(assessment.date)} -{" "}
                    {getInstrument(assessment.instrumentId).title}
                  </em>
                </span>
                <span className={`status-badge ${assessment.status}`}>
                  {assessment.status === "final" ? "Finale" : "Aperto"}
                </span>
                <span>
                  {completedSources}/{assessment.administrations.length} fonti complete
                </span>
              </button>
            );
          })}
        </div>
        <div className="source-archive">
          <div className="source-archive-heading">
            <div>
              <h3>{selectedAssessment.interval}</h3>
              <p>{selectedAssessment.administrations.length} sottosomministrazioni</p>
            </div>
            <span className={`status-badge ${selectedAssessment.status}`}>
              {selectedAssessment.status === "final"
                ? "Valutazione finale salvata"
                : "Da finalizzare"}
            </span>
          </div>
          {selectedAssessment.administrations.map((administration) => {
            const scored = Object.values(administration.scores).filter(
              (value) => value !== undefined,
            ).length;
            const notes = Object.values(administration.itemNotes).filter(Boolean).length;
            return (
              <article
                className={`source-card ${
                  administration.id === selectedAdministrationId ? "is-active" : ""
                }`}
                key={administration.id}
              >
                <button
                  className="source-card-main"
                  onClick={() => selectAdministration(administration.id)}
                >
                  <span className={`source-status-dot ${administration.status}`} />
                  <span>
                    <strong>{administration.label}</strong>
                    <em>
                      {administration.respondentRole || "Ruolo non indicato"} ·{" "}
                      {formatDate(administration.date)}
                    </em>
                  </span>
                  <span>{scored} punteggi</span>
                  <span>{notes} note</span>
                  <span className={`status-badge ${administration.status}`}>
                    {statusLabel(administration.status)}
                  </span>
                </button>
                <button
                  className="mini-icon-button"
                  onClick={() => deleteAdministration(administration.id)}
                  disabled={selectedAssessment.administrations.length <= 1}
                  aria-label={`Elimina ${administration.label}`}
                  title="Elimina sottosomministrazione"
                >
                  <Trash2 size={15} />
                </button>
              </article>
            );
          })}
          {selectedAssessment.finalNotes && (
            <div className="notes-block">
              <h3>Nota finale</h3>
              <p>{selectedAssessment.finalNotes}</p>
            </div>
          )}
        </div>
      </div>
      <button className="danger-button" onClick={deleteAssessment}>
        <Trash2 size={16} /> Elimina l’intero intervallo selezionato
      </button>
    </section>
  );
}

function CansNeedStarChart({
  id,
  bands,
  title,
}: {
  id?: string;
  bands: NeedBand[];
  title: string;
}) {
  const size = 480;
  const center = size / 2;
  const radius = 150;
  const axes = bands.length || 1;
  const bandPolygons = [3, 2, 1, 0].map((score) => ({
    score,
    points: bands
      .map((entry, index) =>
        polarPoint(
          center,
          radius * entry.cumulative[score as 0 | 1 | 2 | 3],
          index,
          axes,
        ),
      )
      .map(formatPoint)
      .join(" "),
  }));

  return (
    <figure className="star-card formal-star">
      <figcaption>{title}</figcaption>
      <svg id={id} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={title}>
        <ChartBackground
          count={bands.length}
          center={center}
          radius={radius}
          labels={bands.map((entry) => entry.domain.shortTitle)}
          ticks={[0, 20, 40, 60, 80, 100]}
        />
        {bandPolygons.map((band) => (
          <polygon
            key={band.score}
            points={band.points}
            className={`cans-band score-${band.score}`}
          />
        ))}
        <g className="star-legend">
          {[
            ["3", "massima priorità"],
            ["2", "azione richiesta"],
            ["1", "monitoraggio"],
            ["0", "nessuna azione"],
          ].map(([score, label], index) => (
            <g key={score} transform={`translate(16 ${18 + index * 18})`}>
              <rect width="10" height="10" className={`legend-fill score-${score}`} />
              <text x="16" y="9">
                {score} - {label}
              </text>
            </g>
          ))}
        </g>
        {bands.map((entry, index) => {
          const point = polarPoint(center, radius + 58, index, axes);
          return (
            <text
              key={`coverage-${entry.domain.id}`}
              x={point.x}
              y={point.y + 13}
              textAnchor="middle"
              className="coverage-label"
            >
              {entry.answered}/{entry.total}
            </text>
          );
        })}
      </svg>
    </figure>
  );
}

function StrengthsStarChart({
  id,
  points,
  previousPoints,
  title,
}: {
  id?: string;
  points: StrengthPoint[];
  previousPoints?: StrengthPoint[];
  title: string;
}) {
  const size = 480;
  const center = size / 2;
  const radius = 148;
  const axes = points.length || 1;
  const current = points
    .map((entry, index) =>
      polarPoint(center, radius * (entry.value / 3), index, axes),
    )
    .map(formatPoint)
    .join(" ");
  const previous = previousPoints
    ?.map((entry, index) =>
      polarPoint(center, radius * (entry.value / 3), index, axes),
    )
    .map(formatPoint)
    .join(" ");

  return (
    <figure className="star-card formal-star">
      <figcaption>{title}</figcaption>
      <svg id={id} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={title}>
        <ChartBackground
          count={points.length}
          center={center}
          radius={radius}
          labels={points.map((entry) => shortenLabel(entry.item.label))}
          ticks={[0, 1, 2, 3]}
          strength
        />
        {previous && <polygon points={previous} className="star-previous" />}
        <polygon points={current} className="strength-fill" />
        {points.map((entry, index) => {
          const point = polarPoint(center, radius * (entry.value / 3), index, axes);
          return (
            <circle
              key={entry.item.id}
              cx={point.x}
              cy={point.y}
              r="3.5"
              className={`strength-dot raw-${entry.raw ?? "empty"}`}
            />
          );
        })}
        <text x="16" y="24" className="chart-note">
          Pieno = punto di forza positivo e utilizzabile
        </text>
        <text x="16" y="42" className="chart-note">
          Vuoto = punto di forza mancante o critico
        </text>
      </svg>
    </figure>
  );
}

function ChartBackground({
  count,
  center,
  radius,
  labels,
  ticks,
  strength = false,
}: {
  count: number;
  center: number;
  radius: number;
  labels: string[];
  ticks: number[];
  strength?: boolean;
}) {
  const rings = strength ? [1 / 3, 2 / 3, 1] : [0.2, 0.4, 0.6, 0.8, 1];
  return (
    <>
      {rings.map((ring) => (
        <polygon
          key={ring}
          points={labels
            .map((_, index) =>
              polarPoint(center, radius * ring, index, Math.max(count, 1)),
            )
            .map(formatPoint)
            .join(" ")}
          className="star-ring"
        />
      ))}
      {labels.map((label, index) => {
        const end = polarPoint(center, radius, index, Math.max(count, 1));
        const text = polarPoint(
          center,
          radius + (count > 10 ? 37 : 48),
          index,
          Math.max(count, 1),
        );
        return (
          <g key={`${label}-${index}`}>
            <line
              x1={center}
              y1={center}
              x2={end.x}
              y2={end.y}
              className="star-axis"
            />
            <text
              x={text.x}
              y={text.y}
              textAnchor="middle"
              dominantBaseline="middle"
              className={count > 10 ? "dense-axis-label" : ""}
            >
              {label}
            </text>
          </g>
        );
      })}
      {ticks.map((tick, index) => {
        const ratio = strength ? tick / 3 : tick / 100;
        return (
          <text
            key={tick}
            x={center + 5}
            y={center - radius * ratio + (index === 0 ? -4 : 0)}
            className="radial-tick"
          >
            {tick}
          </text>
        );
      })}
    </>
  );
}

function StackedDomainChart({
  id,
  bands,
  title,
}: {
  id?: string;
  bands: NeedBand[];
  title: string;
}) {
  const width = 780;
  const rowHeight = 42;
  const height = 72 + bands.length * rowHeight;
  const barX = 190;
  const barWidth = 520;
  return (
    <figure className="star-card wide-chart">
      <figcaption>{title}</figcaption>
      <svg id={id} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
        {bands.map((entry, index) => {
          const y = 40 + index * rowHeight;
          let x = barX;
          return (
            <g key={entry.domain.id}>
              <text x="18" y={y + 16} className="bar-label">
                {entry.domain.shortTitle}
              </text>
              {entry.percentages.map((percentage, score) => {
                const segmentWidth = percentage * barWidth;
                const rect = (
                  <rect
                    key={score}
                    x={x}
                    y={y}
                    width={segmentWidth}
                    height="22"
                    className={`legend-fill score-${score}`}
                  />
                );
                x += segmentWidth;
                return rect;
              })}
              <rect
                x={barX}
                y={y}
                width={barWidth}
                height="22"
                className="bar-outline"
              />
              <text x={barX + barWidth + 10} y={y + 16} className="coverage-label">
                {entry.answered}/{entry.total}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

function ResultList({
  title,
  items,
  scores,
  notes,
  empty,
}: {
  title: string;
  items: { domain: CansDomain; item: CansItem }[];
  scores: Record<string, number | undefined>;
  notes: Record<string, string | undefined>;
  empty: string;
}) {
  return (
    <section className="result-list">
      <h3>{title}</h3>
      {items.length ? (
        items.slice(0, 14).map(({ domain, item }) => (
          <div className="result-row" key={item.id}>
            <span
              className={`score-chip ${scoreClass(
                item,
                effectiveScore(scores[item.id]),
              )} ${scores[item.id] === undefined ? "is-default" : ""}`}
              title={
                scores[item.id] === undefined ? "0 predefinito" : undefined
              }
            >
              {effectiveScore(scores[item.id])}
            </span>
            <span>
              <strong>{item.label}</strong>
              <em>{domain.shortTitle}</em>
              {notes[item.id] && <small>{notes[item.id]}</small>}
            </span>
          </div>
        ))
      ) : (
        <p className="muted-copy">{empty}</p>
      )}
    </section>
  );
}

function Metric({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className={`metric ${tone}`}>
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function EmptyPatient() {
  return (
    <section className="empty-panel">
      <UsersRound size={36} />
      <h2>Aggiungi il primo paziente</h2>
      <p>
        Inserisci nome, cognome e data di nascita nella barra laterale. Il sistema
        assegnerà anche un codice stabile per unire correttamente i backup.
      </p>
    </section>
  );
}

function EmptyAssessment({
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

function polarPoint(center: number, radius: number, index: number, total: number) {
  const angle = -Math.PI / 2 + (index / total) * Math.PI * 2;
  return {
    x: center + Math.cos(angle) * radius,
    y: center + Math.sin(angle) * radius,
  };
}

function formatPoint(point: { x: number; y: number }) {
  return `${Math.round(point.x * 10) / 10},${Math.round(point.y * 10) / 10}`;
}

function shortenLabel(label: string) {
  return label.length > 14 ? `${label.slice(0, 13)}…` : label;
}

function formatDate(date: string) {
  if (!date) return "senza data";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

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

export default App;
