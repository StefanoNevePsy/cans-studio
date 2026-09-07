import type { EncryptedBackup, StoredState } from "../types/cans";

export const backupIterations = 600_000;

export const uid = (prefix: string) =>
  `${prefix}-${typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;

export const nowIso = () => new Date().toISOString();
export const today = () => nowIso().slice(0, 10);

export const compactToken = (length: number) => {
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

export const makeInstallationId = () => uid("site");

export const makePatientCode = (installationId: string) => {
  const site =
    installationId.replace(/[^a-z0-9]/gi, "").slice(-5).toUpperCase() ||
    compactToken(5);
  return `CANS-${site}-${compactToken(7)}`;
};

export const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
};

export const base64ToBytes = (value: string) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

export const deriveBackupKey = async (
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

export const encryptBackup = async (
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

export const isEncryptedBackup = (value: unknown): value is EncryptedBackup => {
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

export const decryptBackup = async (
  backup: EncryptedBackup,
  passphrase: string,
  parseStateFn: (val: unknown) => StoredState,
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
  return parseStateFn(JSON.parse(new TextDecoder().decode(plaintext)));
};

export const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const downloadSvgPng = async (svg: SVGSVGElement, fileName: string) => {
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
    getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() ||
    "white";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  URL.revokeObjectURL(imageUrl);
  canvas.toBlob((blob) => {
    if (blob) downloadBlob(blob, fileName);
  }, "image/png");
};
