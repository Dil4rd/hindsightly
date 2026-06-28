// The encrypted token vault.
//
// A token is encrypted once PER enrolled credential (multi-recipient pattern):
// any enrolled passkey can unlock, and losing/leaving one authenticator is a
// non-event. The AES key is derived from the credential's PRF output and is
// never stored — only the ciphertext, IV and credentialId are persisted, none
// of which are secret.

import {
  b64uDecode,
  b64uEncode,
  getPrfOutput,
  isWebAuthnAvailable,
  registerCredential,
} from './webauthn'
import { idbClear, idbGet, idbSet } from './idb'

export interface WrappedToken {
  credentialId: string // base64url
  label: string
  iv: string // base64url — AES-GCM nonce
  ciphertext: string // base64url
  createdAt: string // ISO (supplied by caller)
}

export interface Vault {
  version: 2
  wrapped: WrappedToken[]
}

const HKDF_INFO = new TextEncoder().encode('hindsight/token-key/v1')
// Fixed, non-secret HKDF salt (PRF output is already high-entropy; HKDF's role
// here is domain separation via `info`).
const HKDF_SALT = new TextEncoder().encode('hindsight:hkdf:v1')

async function deriveAesKey(prfOutput: ArrayBuffer): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey('raw', prfOutput, 'HKDF', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: HKDF_SALT, info: HKDF_INFO },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function loadVault(): Promise<Vault | undefined> {
  return idbGet<Vault>()
}

export function hasCredentials(v: Vault | undefined): v is Vault {
  // Require the current vault version; an older-scheme record is treated as
  // not-enrolled so the user re-enrolls cleanly (it gets overwritten).
  return !!v && v.version === 2 && v.wrapped.length > 0
}

/**
 * Enroll a passkey that can decrypt `token`. If a vault already exists the new
 * wrapped copy is appended (backup-key enrollment); re-enrolling the same
 * credential id replaces its entry.
 */
export async function enroll(token: string, label: string, createdAt: string): Promise<Vault> {
  if (!isWebAuthnAvailable()) throw new Error('WebAuthn is not available in this browser.')

  const { credentialId, prfOutput } = await registerCredential(label)

  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveAesKey(prfOutput)
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(token),
  )

  const wrapped: WrappedToken = {
    credentialId,
    label,
    iv: b64uEncode(iv),
    ciphertext: b64uEncode(ct),
    createdAt,
  }

  const existing = await loadVault()
  const vault: Vault =
    existing && existing.version === 2
      ? {
          ...existing,
          wrapped: [
            ...existing.wrapped.filter((w) => w.credentialId !== credentialId),
            wrapped,
          ],
        }
      : { version: 2, wrapped: [wrapped] }

  await idbSet(vault)
  return vault
}

/** Prompt for any enrolled credential and return the decrypted token. */
export async function unlock(vault: Vault): Promise<string> {
  if (!vault.wrapped.length) throw new Error('No credentials are enrolled.')

  const { credentialId, prfOutput } = await getPrfOutput(
    vault.wrapped.map((w) => w.credentialId),
  )

  const entry = vault.wrapped.find((w) => w.credentialId === credentialId)
  if (!entry) throw new Error('The credential used is not enrolled in this vault.')

  const key = await deriveAesKey(prfOutput)
  try {
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: b64uDecode(entry.iv) },
      key,
      b64uDecode(entry.ciphertext),
    )
    return new TextDecoder().decode(pt)
  } catch {
    throw new Error(
      'Could not decrypt the stored token (it may be from an older version). ' +
        'Click "Reset stored token" and enroll again.',
    )
  }
}

export async function resetVault(): Promise<void> {
  await idbClear()
}
