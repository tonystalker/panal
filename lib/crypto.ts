/**
 * lib/crypto.ts
 *
 * AES-GCM + PBKDF2 backup encryption/decryption using the Web Crypto API.
 * Follows the spec in docs/export-format.md exactly.
 *
 * Rules:
 *  - Never use custom crypto; always SubtleCrypto.
 *  - Never store the passphrase or the raw DEK anywhere.
 *  - Generate fresh salt + IV on every export.
 */

const ITERATIONS = 600_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const TAG_LENGTH = 128;

function b64uEncode(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64uDecode(s: string): ArrayBuffer {
  if (!s || typeof s !== "string") {
    throw new Error("Invalid base64url string");
  }
  try {
    const padded = s.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(padded);
    const buf = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
    return buf.buffer;
  } catch {
    throw new Error("Failed to decode base64url data");
  }
}

async function deriveKey(passphrase: string, salt: ArrayBuffer): Promise<CryptoKey> {
  const raw = new TextEncoder().encode(passphrase);
  const baseKey = await crypto.subtle.importKey("raw", raw, "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, hash: "SHA-256", iterations: ITERATIONS },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export interface BackupEnvelope {
  version: number;
  app: string;
  exportedAt: string;
  deviceId: string;
  encryption: {
    algorithm: string;
    kdf: string;
    kdfParams: { hash: string; iterations: number; saltB64: string };
    ivB64: string;
    tagLength: number;
  };
  payload: string; // base64url ciphertext
}

export async function encryptBackup(
  plaintext: object,
  passphrase: string,
  deviceId: string,
): Promise<BackupEnvelope> {
  const exportedAt = new Date().toISOString();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES)).buffer;
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES)).buffer;
  const key = await deriveKey(passphrase, salt);

  const plaintextStr = JSON.stringify(plaintext);
  const additionalData = new TextEncoder().encode(`1:${exportedAt}`);

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, tagLength: TAG_LENGTH, additionalData },
    key,
    new TextEncoder().encode(plaintextStr),
  );

  return {
    version: 1,
    app: "personal-analytics",
    exportedAt,
    deviceId,
    encryption: {
      algorithm: "AES-GCM",
      kdf: "PBKDF2",
      kdfParams: { hash: "SHA-256", iterations: ITERATIONS, saltB64: b64uEncode(salt) },
      ivB64: b64uEncode(iv),
      tagLength: TAG_LENGTH,
    },
    payload: b64uEncode(ciphertext),
  };
}

export async function decryptBackup(envelope: BackupEnvelope, passphrase: string): Promise<object> {
  if (!envelope || typeof envelope !== "object") {
    throw new Error("Invalid backup envelope");
  }
  if (envelope.app !== "personal-analytics") {
    throw new Error("Not a Personal Analytics backup file");
  }
  if (envelope.version !== 1) {
    throw new Error(`Unsupported backup version: ${envelope.version}`);
  }
  if (
    !envelope.encryption ||
    envelope.encryption.algorithm !== "AES-GCM" ||
    !envelope.encryption.kdfParams?.saltB64 ||
    !envelope.encryption.ivB64 ||
    !envelope.payload ||
    !envelope.exportedAt
  ) {
    throw new Error("Corrupted or malformed backup envelope");
  }

  let salt: ArrayBuffer;
  let iv: ArrayBuffer;
  let ciphertext: ArrayBuffer;
  try {
    salt = b64uDecode(envelope.encryption.kdfParams.saltB64);
    iv = b64uDecode(envelope.encryption.ivB64);
    ciphertext = b64uDecode(envelope.payload);
  } catch {
    throw new Error("Corrupted backup payload encoding");
  }

  const key = await deriveKey(passphrase, salt);
  const additionalData = new TextEncoder().encode(`1:${envelope.exportedAt}`);

  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv, tagLength: TAG_LENGTH, additionalData },
      key,
      ciphertext,
    );
  } catch {
    throw new Error("Wrong passphrase or corrupted file");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(plaintext));
  } catch {
    throw new Error("Corrupted backup data: payload is not valid JSON");
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    (parsed as { schemaVersion?: number }).schemaVersion !== envelope.version
  ) {
    throw new Error("Backup schema version mismatch");
  }
  return parsed as object;
}
