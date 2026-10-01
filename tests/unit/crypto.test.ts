/**
 * tests/unit/crypto.test.ts
 * Unit tests for the AES-GCM backup encryption round-trip.
 */

import { describe, it, expect } from "vitest";
import { encryptBackup, decryptBackup } from "@/lib/crypto";

const PASSPHRASE = "test-passphrase-vitest";
const DEVICE_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

const SAMPLE_PAYLOAD = {
  schemaVersion: 1,
  exportedAt: new Date().toISOString(),
  tables: {
    userProfile: [{ id: "u1", timezone: "UTC", createdAt: new Date().toISOString(), preferences: {} }],
    dailyLogs: [],
    taskInstances: [],
    manualMetrics: [],
    connectorConnections: [],
    metricEvents: [],
    dashboardWidgets: [],
  },
};

describe("encryptBackup / decryptBackup round-trip", () => {
  it("encrypts and decrypts to the original payload", async () => {
    const envelope = await encryptBackup(SAMPLE_PAYLOAD, PASSPHRASE, DEVICE_ID);
    expect(envelope.version).toBe(1);
    expect(envelope.app).toBe("personal-analytics");
    expect(envelope.payload).toBeTruthy();

    const decrypted = await decryptBackup(envelope, PASSPHRASE);
    expect(decrypted).toMatchObject({ schemaVersion: 1 });
  }, 30_000); // KDF is intentionally slow

  it("throws on wrong passphrase", async () => {
    const envelope = await encryptBackup(SAMPLE_PAYLOAD, PASSPHRASE, DEVICE_ID);
    await expect(decryptBackup(envelope, "wrong-passphrase")).rejects.toThrow(
      "Wrong passphrase or corrupted file",
    );
  }, 30_000);

  it("throws on wrong app field", async () => {
    const envelope = await encryptBackup(SAMPLE_PAYLOAD, PASSPHRASE, DEVICE_ID);
    const tampered = { ...envelope, app: "other-app" };
    await expect(decryptBackup(tampered, PASSPHRASE)).rejects.toThrow(
      "Not a Personal Analytics backup file",
    );
  }, 30_000);

  it("throws on unknown version", async () => {
    const envelope = await encryptBackup(SAMPLE_PAYLOAD, PASSPHRASE, DEVICE_ID);
    const tampered = { ...envelope, version: 99 };
    await expect(decryptBackup(tampered, PASSPHRASE)).rejects.toThrow("Unsupported backup version: 99");
  }, 30_000);

  it("throws on malformed or incomplete envelope", async () => {
    // @ts-expect-error testing invalid envelope
    await expect(decryptBackup(null, PASSPHRASE)).rejects.toThrow("Invalid backup envelope");

    const envelope = await encryptBackup(SAMPLE_PAYLOAD, PASSPHRASE, DEVICE_ID);
    // @ts-expect-error testing missing payload
    const missingPayload = { ...envelope, payload: undefined };
    await expect(decryptBackup(missingPayload, PASSPHRASE)).rejects.toThrow(
      "Corrupted or malformed backup envelope",
    );
  }, 30_000);

  it("throws on corrupted ciphertext payload", async () => {
    const envelope = await encryptBackup(SAMPLE_PAYLOAD, PASSPHRASE, DEVICE_ID);
    const tampered = { ...envelope, payload: "not-valid-base64!!!" };
    await expect(decryptBackup(tampered, PASSPHRASE)).rejects.toThrow();
  }, 30_000);
});
