// Validates the full PRF enroll -> persist -> unlock -> decrypt path WITHOUT a
// browser, using a simulated authenticator. Crucially it reproduces 1Password's
// real-world quirk: returning the PRF result as a plain number[] rather than an
// ArrayBuffer. Uses Node's WebCrypto for the actual HKDF/AES-GCM.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// In-memory replacement for the IndexedDB vault store.
vi.mock('../src/lib/auth/idb', () => {
  let rec: unknown
  return {
    idbGet: async () => rec,
    idbSet: async (v: unknown) => {
      rec = v
    },
    idbClear: async () => {
      rec = undefined
    },
  }
})

import { enroll, loadVault, resetVault, unlock } from '../src/lib/auth/vault'

type PrfShape = 'array' | 'arraybuffer' | 'uint8' | 'garbage'

function asShape(bytes: Uint8Array, shape: PrfShape): unknown {
  switch (shape) {
    case 'array':
      return Array.from(bytes) // 1Password's actual shape
    case 'arraybuffer':
      return bytes.buffer.slice(0)
    case 'uint8':
      return bytes
    case 'garbage':
      return { not: 'a buffer' }
  }
}

// Deterministic PRF: output depends only on (credentialId, salt), so create()
// and a later get() for the same credential yield identical bytes.
async function prfFor(credId: Uint8Array, salt: Uint8Array, shape: PrfShape): Promise<unknown> {
  const buf = new Uint8Array(credId.length + salt.length)
  buf.set(credId, 0)
  buf.set(salt, credId.length)
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', buf))
  return asShape(digest, shape)
}

function installAuthenticator(shape: PrfShape) {
  const credentials = {
    async create(opts: any) {
      const credId = crypto.getRandomValues(new Uint8Array(16))
      const salt = new Uint8Array(opts.publicKey.extensions.prf.eval.first)
      const first = await prfFor(credId, salt, shape)
      return {
        rawId: credId.buffer,
        type: 'public-key',
        getClientExtensionResults: () => ({ prf: { enabled: true, results: { first } } }),
      }
    },
    async get(opts: any) {
      const credId = new Uint8Array(opts.publicKey.allowCredentials[0].id)
      const salt = new Uint8Array(opts.publicKey.extensions.prf.eval.first)
      const first = await prfFor(credId, salt, shape)
      return {
        rawId: credId.buffer,
        type: 'public-key',
        getClientExtensionResults: () => ({ prf: { results: { first } } }),
      }
    },
  }
  vi.stubGlobal('navigator', { credentials })
  vi.stubGlobal('window', globalThis)
  vi.stubGlobal('location', { hostname: 'localhost', origin: 'http://localhost' })
  vi.stubGlobal('PublicKeyCredential', class {})
}

beforeEach(async () => {
  await resetVault()
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('vault PRF round-trip (simulated authenticator)', () => {
  for (const shape of ['array', 'arraybuffer', 'uint8'] as PrfShape[]) {
    it(`enroll then unlock round-trips the token (PRF as ${shape})`, async () => {
      installAuthenticator(shape)
      const token = 'todoist-token-0343abcd'
      await enroll(token, 'my key', '2026-06-28T00:00:00Z')

      const v = await loadVault()
      expect(v?.version).toBe(2)
      expect(v?.wrapped.length).toBe(1)

      expect((await unlock(v!)).token).toBe(token)
    })
  }

  it('fails with a clear PRF error for an unsupported result shape', async () => {
    installAuthenticator('garbage')
    await expect(enroll('t', 'k', '2026-06-28T00:00:00Z')).rejects.toThrow(/PRF/)
  })

  it('supports multi-credential enrollment (an enrolled key unlocks)', async () => {
    installAuthenticator('array')
    await enroll('tok', 'k1', '2026-06-28T00:00:00Z')
    await enroll('tok', 'k2', '2026-06-28T00:00:00Z')

    const v = await loadVault()
    expect(v?.wrapped.length).toBe(2)
    expect((await unlock(v!)).token).toBe('tok')
  })
})
