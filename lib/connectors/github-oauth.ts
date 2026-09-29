/**
 * lib/connectors/github-oauth.ts
 *
 * GitHub Device Flow OAuth.
 * Spec: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow
 *
 * Why Device Flow and not Authorization Code + PKCE?
 *   - GitHub's OAuth server does not support PKCE for OAuth Apps.
 *   - Device Flow requires no server, no client_secret, and no redirect URI.
 *   - The client_id is public (not a secret) and safe in a browser bundle.
 *   - Token is received via polling and immediately encrypted into the local vault;
 *     it is never stored in localStorage, URL params, or logs.
 *
 * Environment variable required:
 *   NEXT_PUBLIC_GITHUB_CLIENT_ID — from GitHub → Settings → Developer Settings
 *   → OAuth Apps → (your app) → Client ID
 */

const DEVICE_CODE_URL = "/api/github/device";
const TOKEN_URL = "/api/github/token";

// read:user lets the GraphQL contributions query run.
// repo is added only when the user opts in to private-repo activity.
const BASE_SCOPE = "read:user";
const PRIVATE_SCOPE = "read:user repo";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RawDeviceCode {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

interface RawTokenResponse {
  access_token?: string;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

export interface DeviceChallenge {
  deviceCode: string;
  userCode: string;       // e.g. "ABCD-1234" — shown to the user
  verificationUri: string; // always "https://github.com/login/device"
  expiresAt: number;      // Date.now() + expires_in * 1000
  intervalMs: number;     // minimum poll interval in ms
}

// ---------------------------------------------------------------------------
// Step 1 — request a device + user code
// ---------------------------------------------------------------------------

export async function requestDeviceCode(includePrivate: boolean): Promise<DeviceChallenge> {
  const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
  if (!clientId) {
    throw new Error("NEXT_PUBLIC_GITHUB_CLIENT_ID is not set. See .env.local.");
  }

  const res = await fetch(DEVICE_CODE_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      scope: includePrivate ? PRIVATE_SCOPE : BASE_SCOPE,
    }),
  });

  if (!res.ok) {
    throw new Error(`GitHub device code request failed: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as RawDeviceCode;

  return {
    deviceCode: data.device_code,
    userCode: data.user_code,
    verificationUri: data.verification_uri,
    expiresAt: Date.now() + data.expires_in * 1000,
    intervalMs: (data.interval ?? 5) * 1000,
  };
}

// ---------------------------------------------------------------------------
// Step 2 — poll for the access token
// ---------------------------------------------------------------------------

/** Called repeatedly while the user authorizes. Resolves with the access token. */
export async function pollForToken(
  challenge: DeviceChallenge,
  signal: AbortSignal,
): Promise<string> {
  const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID!;
  let intervalMs = challenge.intervalMs;

  const attempt = async (): Promise<string> => {
    if (signal.aborted) throw new Error("Cancelled");
    if (Date.now() > challenge.expiresAt) throw new Error("Authorization expired — please try again.");

    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        device_code: challenge.deviceCode,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      }),
    });

    const data = (await res.json()) as RawTokenResponse;

    if (data.access_token) return data.access_token;

    switch (data.error) {
      case "authorization_pending":
        // Normal — user hasn't authorized yet
        await sleep(intervalMs, signal);
        return attempt();

      case "slow_down":
        // GitHub asks us to back off; increase interval by 5 s (required by spec)
        intervalMs += 5_000;
        await sleep(intervalMs, signal);
        return attempt();

      case "expired_token":
        throw new Error("Authorization expired — please try again.");

      case "access_denied":
        throw new Error("Authorization denied by GitHub.");

      default:
        throw new Error(data.error_description ?? data.error ?? "Unknown OAuth error.");
    }
  };

  // Initial wait before first poll
  await sleep(intervalMs, signal);
  return attempt();
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(id);
      reject(new Error("Cancelled"));
    }, { once: true });
  });
}
