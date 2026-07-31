// Per-account user settings, ENCRYPTED at rest (AES-GCM under the passkey-derived
// key), stored in IndexedDB — same shape and threat model as the dataset cache.
// Only opaque label IDS are kept; label NAMES are never persisted (they're
// re-resolved live from the account's label list each session).

import { b64uDecode, b64uEncode } from '../auth/webauthn'
import { settingsGet, settingsSet } from '../auth/idb'

export interface Settings {
  waitingLabelIds: string[] // labels the user maps to the GTD "waiting-for" role
}

interface StoredSettings {
  version: 1
  account: string // non-reversible hash of the token (plaintext, for matching)
  iv: string // base64url
  ciphertext: string // base64url — AES-GCM(JSON(settings))
}

export const EMPTY_SETTINGS: Settings = { waitingLabelIds: [] }

export async function loadSettings(
  account: string,
  cacheKey: CryptoKey,
): Promise<Settings | undefined> {
  const s = await settingsGet<StoredSettings>()
  if (!s || s.version !== 1 || s.account !== account) return undefined
  try {
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: b64uDecode(s.iv) },
      cacheKey,
      b64uDecode(s.ciphertext),
    )
    return JSON.parse(new TextDecoder().decode(pt)) as Settings
  } catch {
    return undefined // wrong key / corrupt → treat as unset
  }
}

export async function saveSettings(
  account: string,
  cacheKey: CryptoKey,
  settings: Settings,
): Promise<void> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const data = new TextEncoder().encode(JSON.stringify(settings))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cacheKey, data)
  await settingsSet<StoredSettings>({
    version: 1,
    account,
    iv: b64uEncode(iv),
    ciphertext: b64uEncode(ct),
  })
}
