// WebAuthn ceremonies used purely as a PRF key-derivation oracle.
// No server, no signature verification — security rests on the fact that the
// correct PRF output can only be produced by the authenticator that holds the
// credential secret.

const RP_NAME = 'Hindsight'

// --- base64url helpers ------------------------------------------------------

export function b64uEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function b64uDecode(str: string): Uint8Array<ArrayBuffer> {
  const s = str.replace(/-/g, '+').replace(/_/g, '/')
  const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : ''
  const bin = atob(s + pad)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(n))
}

export function isWebAuthnAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.PublicKeyCredential &&
    !!navigator.credentials
  )
}

/**
 * Normalize a PRF result to an ArrayBuffer. Authenticators/passkey providers
 * return it as an ArrayBuffer or a typed-array view; anything else (or absent)
 * yields null so callers can fall back or fail with a clear message — instead
 * of WebCrypto's cryptic "Key data must be a BufferSource".
 */
function toArrayBuffer(v: unknown): ArrayBuffer | null {
  if (v instanceof ArrayBuffer) return v
  if (ArrayBuffer.isView(v)) {
    const view = v as ArrayBufferView
    return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer
  }
  return null
}

// --- registration -----------------------------------------------------------

export interface NewCredential {
  credentialId: string // base64url
  prfOutput: ArrayBuffer
  salt: string // base64url — PRF input for this credential
}

/** Register a new passkey and obtain its PRF output for a fresh random salt. */
export async function registerCredential(label: string): Promise<NewCredential> {
  const salt = randomBytes(32)

  const cred = (await navigator.credentials.create({
    publicKey: {
      rp: { name: RP_NAME, id: location.hostname },
      user: { id: randomBytes(16), name: label, displayName: label },
      challenge: randomBytes(32),
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 }, // ES256
        { type: 'public-key', alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'required',
      },
      // Enable PRF; some authenticators also evaluate it at creation time.
      extensions: { prf: { eval: { first: salt } } } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null

  if (!cred) throw new Error('Registration was cancelled.')

  const credentialId = b64uEncode(cred.rawId)
  const ext = cred.getClientExtensionResults() as PrfExtensionResults

  // Some providers (e.g. 1Password) return PRF at create(); many don't, or
  // return a non-buffer shape. Accept only a real buffer, else get it via an
  // assertion ceremony.
  let prfOutput = toArrayBuffer(ext?.prf?.results?.first)
  if (!prfOutput) {
    prfOutput = (await getPrfOutput([{ id: credentialId, salt: b64uEncode(salt) }])).prfOutput
  }

  return { credentialId, prfOutput, salt: b64uEncode(salt) }
}

// --- assertion (unlock) -----------------------------------------------------

export interface PrfResult {
  credentialId: string // base64url — which credential the user actually used
  prfOutput: ArrayBuffer
}

/**
 * Run an assertion across the given credentials and return the PRF output of
 * whichever one the user picked. Each credential carries its own salt, passed
 * via `evalByCredential` so the browser evaluates PRF for the chosen one only.
 */
export async function getPrfOutput(
  creds: { id: string; salt: string }[],
): Promise<PrfResult> {
  const evalByCredential: Record<string, { first: BufferSource }> = {}
  for (const c of creds) evalByCredential[c.id] = { first: b64uDecode(c.salt) }

  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: randomBytes(32),
      rpId: location.hostname,
      userVerification: 'required',
      allowCredentials: creds.map((c) => ({
        type: 'public-key' as const,
        id: b64uDecode(c.id),
      })),
      extensions: { prf: { evalByCredential } } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null

  if (!assertion) throw new Error('Unlock was cancelled.')

  const ext = assertion.getClientExtensionResults() as PrfExtensionResults
  const prfOutput = toArrayBuffer(ext?.prf?.results?.first)
  if (!prfOutput) {
    throw new Error('No usable PRF output returned (passkey/authenticator lacks PRF support).')
  }
  return { credentialId: b64uEncode(assertion.rawId), prfOutput }
}

// PRF results aren't in the stock DOM typings yet.
interface PrfExtensionResults {
  prf?: { results?: { first?: unknown } }
}
