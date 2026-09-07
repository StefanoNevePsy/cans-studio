import {
  binaryAnchors,
  CansDomain,
  CansInstrument,
  CansItem,
  needAnchors,
  strengthAnchors,
} from "../cansData";
import type {
  AdministrationStatus,
  DomainStats,
  NeedBand,
  Patient,
  StrengthPoint,
} from "../types/cans";

export const patientName = (patient: Patient) =>
  `${patient.firstName} ${patient.lastName}`.replace(/\s+/g, " ").trim();

export const composeBirthDate = (day: string, month: string, year: string) => {
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

export const formatDate = (date: string) => {
  if (!date) return "senza data";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));
};

export const shortenLabel = (label: string) => {
  return label.length > 14 ? `${label.slice(0, 13)}…` : label;
};

export const domainItems = (domain: CansDomain) => domain.items;

export const splitDomainItems = (items: CansItem[]) => {
  if (items.length < 10) return [items];
  const midpoint = Math.ceil(items.length / 2);
  return [items.slice(0, midpoint), items.slice(midpoint)];
};

export const flattenItems = (instrument: CansInstrument) =>
  instrument.domains.flatMap((domain) =>
    domain.items.map((item) => ({ domain, item })),
  );

export const effectiveScore = (value: number | undefined) => value ?? 0;

export const scoreLabel = (item: CansItem, value: number | undefined) => {
  if (value === undefined) return "Non compilato";
  if (item.kind === "strength") return strengthAnchors[value] ?? String(value);
  if (item.kind === "binary") return binaryAnchors[value] ?? String(value);
  return needAnchors[value] ?? String(value);
};

export const scoreClass = (item: CansItem, value: number | undefined) => {
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

export const statusLabel = (status: AdministrationStatus) => {
  if (status === "completed") return "Completata";
  if (status === "suspended") return "Sospesa";
  return "In corso";
};

export const getStats = (
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

export const getNeedBands = (
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

export const getStrengthPoints = (
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

export const getTriggeredModuleIds = (
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

export const getActivatedModuleIds = (
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

export const getApplicableDomains = (
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

export const getCompletion = (
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

export const polarPoint = (
  center: number,
  radius: number,
  index: number,
  total: number,
) => {
  const angle = -Math.PI / 2 + (index / total) * Math.PI * 2;
  return {
    x: center + Math.cos(angle) * radius,
    y: center + Math.sin(angle) * radius,
  };
};

export const formatPoint = (point: { x: number; y: number }) => {
  return `${Math.round(point.x * 10) / 10},${Math.round(point.y * 10) / 10}`;
};
