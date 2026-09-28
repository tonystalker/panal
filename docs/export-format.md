# Personal Analytics — Encrypted Export Format (V1)

_Last updated: 2026-09-29_

This document defines the file format for encrypted local backups (`*.panal-backup`).  
The format is versioned from day one so future migrations can validate and upgrade older files.

---

## File extension and MIME type

| Property | Value |
|----------|-------|
| Extension | `.panal-backup` |
| MIME type | `application/x-panal-backup+json` |
| Encoding | UTF-8 JSON (the ciphertext field is base64url) |

---

## Top-level envelope

```jsonc
{
  "version": 1,                      // integer — schema version; increment on breaking change
  "app": "personal-analytics",       // string — fixed identifier to reject foreign files
  "exportedAt": "2026-09-29T04:00:00.000Z", // ISO 8601 UTC — when the export was created
  "deviceId": "<uuid-v4>",           // source device; informational only
  "encryption": {
    "algorithm": "AES-GCM",          // fixed for V1
    "kdf": "PBKDF2",                 // key derivation function
    "kdfParams": {
      "hash": "SHA-256",
      "iterations": 600000,          // OWASP 2023 minimum for PBKDF2-SHA-256
      "saltB64": "<base64url-salt>"  // 16 bytes of random salt
    },
    "ivB64": "<base64url-iv>",       // 12 bytes of random IV; unique per export
    "tagLength": 128                 // GCM auth tag bits
  },
  "payload": "<base64url-ciphertext>" // AES-GCM ciphertext of the serialized payload object
}
```

### Field rules

- `version` **must** be validated before decryption. Reject files with unknown versions.
- `app` **must** equal `"personal-analytics"`. Reject mismatches to prevent accidental cross-app imports.
- `encryption.kdfParams.saltB64` must be a fresh random value for every export (never reuse).
- `encryption.ivB64` must be a fresh random value for every export (never reuse).
- The `payload` field is base64url (RFC 4648 §5) — no padding characters.

---

## Plaintext payload (after decryption)

The decrypted value is a JSON string. Parse it to obtain:

```jsonc
{
  "schemaVersion": 1,       // must match the outer envelope version
  "exportedAt": "...",      // repeat for integrity cross-check
  "tables": {
    "userProfile":          [ /* UserProfile rows */ ],
    "dailyLogs":            [ /* DailyLog rows */ ],
    "taskTemplates":        [ /* TaskTemplate rows */ ],
    "taskInstances":        [ /* TaskInstance rows */ ],
    "manualMetrics":        [ /* ManualMetric rows */ ],
    "connectorConnections": [ /* ConnectorConnection rows — credentials stripped */ ],
    "metricEvents":         [ /* MetricEvent rows */ ],
    "dashboardWidgets":     [ /* DashboardWidget rows */ ]
  }
}
```

### Payload rules

- `connectorConnections` rows **must not** include `encryptedCredential`. Credentials are wiped before serializing. Reconnect after restore.
- All `Date`/timestamp fields are ISO 8601 UTC strings.
- All IDs are UUID v4 strings.
- `schemaVersion` must equal the outer `version`. Mismatch → reject and show error.

---

## Key derivation

```
key = PBKDF2(
  password = utf8(userPassphrase),
  salt     = decode(kdfParams.saltB64),
  iterations = kdfParams.iterations,  // 600 000
  hash     = "SHA-256",
  keyLength = 256 bits
)
```

Use `SubtleCrypto.importKey` → `SubtleCrypto.deriveKey` via the Web Crypto API. Never implement a custom KDF.

---

## Encryption

```
ciphertext || authTag = AES-GCM-Encrypt(
  key           = derivedKey,
  iv            = decode(ivB64),       // 12 bytes
  plaintext     = utf8(JSON.stringify(payloadObject)),
  additionalData = utf8(version + ":" + exportedAt)  // authenticated but not encrypted
)

payload field = base64url(ciphertext || authTag)
```

The `additionalData` binds the ciphertext to this specific envelope so the version and timestamp cannot be swapped on a different file.

---

## Import validation sequence

On import, the app **must** perform these checks in order before overwriting local data:

1. Parse outer JSON; verify `app === "personal-analytics"` — reject otherwise.
2. Verify `version` is known (currently only `1`) — reject unknown versions with a user-facing message.
3. Derive key from user-supplied passphrase using `kdfParams`.
4. Decrypt `payload` with AES-GCM; if decryption fails (wrong key or tampered file) → show "Wrong passphrase or corrupted file."
5. Parse plaintext JSON; verify `schemaVersion === version`.
6. Validate each table array against its Zod schema — reject if any row fails.
7. Present a summary to the user: "Import will replace all local data. X daily logs, Y tasks, Z metric events. Continue?"
8. On confirm: run a Dexie transaction to clear and re-insert all tables atomically.

---

## Readable export (non-encrypted)

A separate "Export readable copy" action produces a plain JSON file (no encryption) and a CSV file. These are for portability only — they do not replace the encrypted backup for restore purposes.

```jsonc
// readable-export.json
{
  "exportedAt": "...",
  "schemaVersion": 1,
  "tables": { /* same structure as payload.tables, credentials stripped */ }
}
```

---

## Future migration policy

| Old version | New version | Action |
|-------------|-------------|--------|
| 1 | 2 | Decrypt with V1 key, migrate payload shape, re-encrypt with V2 envelope |

On import of an older version: decrypt, run migration transforms, prompt user to re-export under the new format to avoid keeping old-format backups.
