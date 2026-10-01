/**
 * lib/connectors/vault.ts
 *
 * Local encrypted credential vault.
 * PATs are encrypted with AES-GCM before being written to ConnectorConnection.encryptedCredential.
 * The vault passphrase is derived from a device-local key stored in localStorage
 * (not a user passphrase — this is distinct from the backup passphrase).
 *
 * Security properties:
 *  - Token never touches localStorage/sessionStorage/URL/logs in plaintext.
 *  - Encrypted blob is only in IndexedDB via Dexie.
 *  - Device key is in localStorage — acceptable for V1 private build; cloud sync
 *    will use a proper KEK derivation path.
 */

import { db } from "@/lib/db";
import { nowISO } from "@/lib/date";
import { generateId } from "@/lib/uuid";
import type { ConnectorId } from "./types";

const DEVICE_KEY_STORAGE_KEY = "panal:vault-key-b64";
const SALT_BYTES = 16;
const IV_BYTES = 12;
const TAG_LENGTH = 128;
const KDF_ITERATIONS = 100_000; // lower than backup — device key is random, not a human password

// ---------------------------------------------------------------------------
// Device key — random 256-bit key persisted as base64 in localStorage
// ---------------------------------------------------------------------------

function b64Encode(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function b64Decode(s: string): ArrayBuffer {
  try {
    const binary = atob(s);
    const buf = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
    return buf.buffer;
  } catch {
    throw new Error("Invalid base64 encoding");
  }
}

async function getOrCreateDeviceKey(): Promise<CryptoKey> {
  let raw = localStorage.getItem(DEVICE_KEY_STORAGE_KEY);
  if (!raw) {
    const keyMaterial = crypto.getRandomValues(new Uint8Array(32));
    raw = b64Encode(keyMaterial.buffer);
    localStorage.setItem(DEVICE_KEY_STORAGE_KEY, raw);
  }
  // Re-derive a proper AES key from the stored random bytes using PBKDF2
  const keyBytes = b64Decode(raw);
  const salt = new Uint8Array(keyBytes, 0, 16);  // first 16 bytes as salt
  const baseKey = await crypto.subtle.importKey("raw", keyBytes, "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, hash: "SHA-256", iterations: KDF_ITERATIONS },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

// ---------------------------------------------------------------------------
// Encrypt / decrypt
// ---------------------------------------------------------------------------

async function encryptToken(token: string): Promise<string> {
  const key = await getOrCreateDeviceKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES)).buffer;
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES)).buffer;
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, tagLength: TAG_LENGTH },
    key,
    new TextEncoder().encode(token),
  );
  // Encode as salt:iv:ciphertext separated by colons
  return [b64Encode(salt), b64Encode(iv), b64Encode(ciphertext)].join(":");
}

async function decryptToken(blob: string): Promise<string> {
  if (!blob || typeof blob !== "string") {
    throw new Error("Invalid credential blob: empty or non-string");
  }
  const parts = blob.split(":");
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    throw new Error("Invalid credential blob: expected salt:iv:ciphertext format");
  }
  const [, ivB64, cipherB64] = parts;
  try {
    const key = await getOrCreateDeviceKey();
    const iv = b64Decode(ivB64);
    const ciphertext = b64Decode(cipherB64);
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv, tagLength: TAG_LENGTH },
      key,
      ciphertext,
    );
    return new TextDecoder().decode(plaintext);
  } catch {
    throw new Error("Failed to decrypt connector credential");
  }
}

// ---------------------------------------------------------------------------
// Public vault API
// ---------------------------------------------------------------------------

/**
 * Store an encrypted token for a connector.
 * Creates the ConnectorConnection row if it doesn't exist.
 */
export async function vaultStore(
  connectorId: ConnectorId,
  token: string,
  settings: Record<string, unknown>,
  displayName: string,
): Promise<void> {
  const encrypted = await encryptToken(token);
  const existing = await db.connectorConnections
    .where("connectorId")
    .equals(connectorId)
    .first();

  if (existing) {
    await db.connectorConnections.update(existing.id, {
      encryptedCredential: encrypted,
      settings,
      displayName,
      status: "connected",
      lastError: null,
      updatedAt: nowISO(),
    });
  } else {
    await db.connectorConnections.add({
      id: generateId(),
      connectorId,
      displayName,
      status: "connected",
      settings,
      encryptedCredential: encrypted,
      lastSyncedAt: null,
      lastError: null,
      createdAt: nowISO(),
      updatedAt: nowISO(),
    });
  }
}

/** Retrieve and decrypt a stored token. Throws if not found. */
export async function vaultRead(connectorId: ConnectorId): Promise<string> {
  const row = await db.connectorConnections
    .where("connectorId")
    .equals(connectorId)
    .first();
  if (!row?.encryptedCredential) {
    throw new Error(`No credential stored for ${connectorId}`);
  }
  return decryptToken(row.encryptedCredential);
}

/** Wipe the stored credential (but keep the row + settings/history by default). */
export async function vaultClear(connectorId: ConnectorId): Promise<void> {
  const row = await db.connectorConnections
    .where("connectorId")
    .equals(connectorId)
    .first();
  if (row) {
    await db.connectorConnections.update(row.id, {
      encryptedCredential: null,
      status: "not_connected",
      updatedAt: nowISO(),
    });
  }
}
