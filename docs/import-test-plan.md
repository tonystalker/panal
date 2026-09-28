# Personal Analytics — Backup Import Test Plan (V1)

_Last updated: 2026-09-29_  
_Fixture:_ `tests/fixtures/backup-v1.json`

---

## Purpose

Verify that the encrypted backup export/import round-trip is correct, safe, and produces exactly the same data as the original before any Milestone 1 code ships.

---

## Fixture description

`tests/fixtures/backup-v1.json` contains:

- A valid V1 envelope structure with all required fields.
- A `_plaintext_for_tests` field (not part of the real format) holding the expected decrypted payload — used for assertion without needing to derive the real encryption key in unit tests.
- Represents one user, one daily log (2026-09-29), two task instances (1 quantitative, 1 binary), two manual metrics, no connector connections, no metric events, one dashboard widget.

> **Note:** The `payload` field in the fixture is a placeholder string. Unit tests that test the full round-trip must generate a real ciphertext using `lib/crypto.ts` (to be implemented in Milestone 1) with the test passphrase `"test-passphrase-do-not-use"` and the fixed salt/IV from the fixture.

---

## Test cases

### TC-01 — Valid backup round-trip (happy path)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Call `exportBackup(passphrase)` | Returns a JSON string matching the V1 envelope schema |
| 2 | Parse the returned JSON | `version === 1`, `app === "personal-analytics"`, `encryption.algorithm === "AES-GCM"` |
| 3 | Call `importBackup(json, passphrase)` | Resolves without error |
| 4 | Query Dexie after import | All tables match the fixture's `_plaintext_for_tests.tables` exactly |

---

### TC-02 — Wrong passphrase

| Step | Action | Expected |
|------|--------|----------|
| 1 | Export with passphrase `"correct"` | Returns valid ciphertext |
| 2 | Import with passphrase `"wrong"` | AES-GCM decryption throws; UI shows "Wrong passphrase or corrupted file" |

---

### TC-03 — Tampered ciphertext

| Step | Action | Expected |
|------|--------|----------|
| 1 | Export normally | Valid ciphertext |
| 2 | Flip one byte in `payload` field | AES-GCM authentication tag fails |
| 3 | Import | Decryption throws; import is rejected |

---

### TC-04 — Wrong `app` field

| Step | Action | Expected |
|------|--------|----------|
| 1 | Load fixture; change `app` to `"other-app"` | — |
| 2 | Call `importBackup` | Rejected before decryption; error: "Not a Personal Analytics backup file" |

---

### TC-05 — Unknown `version`

| Step | Action | Expected |
|------|--------|----------|
| 1 | Load fixture; change `version` to `99` | — |
| 2 | Call `importBackup` | Rejected before decryption; error: "Unsupported backup version: 99" |

---

### TC-06 — `schemaVersion` mismatch inside payload

| Step | Action | Expected |
|------|--------|----------|
| 1 | Export; decrypt manually; change `schemaVersion` to `2`; re-encrypt; wrap in V1 envelope | — |
| 2 | Import | Rejected after decryption; error: "Backup schema version mismatch" |

---

### TC-07 — Invalid row in payload (Zod failure)

| Step | Action | Expected |
|------|--------|----------|
| 1 | In fixture payload, set a `taskInstance.status` to `"invalid-value"` | — |
| 2 | Import | Zod validation fails; import rejected; error lists the offending field |

---

### TC-08 — Empty tables (new user backup)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Export with no data (fresh install) | Envelope valid; all table arrays are `[]` |
| 2 | Import | Succeeds; Dexie is empty but not errored |

---

### TC-09 — Credential field is stripped on export

| Step | Action | Expected |
|------|--------|----------|
| 1 | Add a connector connection with a non-null `encryptedCredential` | — |
| 2 | Export | Decrypted payload's `connectorConnections[0].encryptedCredential` is `null` |

---

### TC-10 — Idempotent import (import twice)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Import the fixture once | Data loaded |
| 2 | Import the same fixture again | Dexie transaction clears and re-inserts; row counts identical; no duplicates |

---

## Manual E2E checklist (Playwright — Milestone 1 polish)

- [ ] Export backup → file download dialog appears, file has `.panal-backup` extension
- [ ] Import backup → file picker + passphrase dialog → success toast
- [ ] Import with wrong passphrase → error banner, no data changed
- [ ] Export → clear all local data → import → all data restored
- [ ] Offline: export works without network
