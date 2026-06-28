import { describe, expect, it } from 'vitest'
import { b64uDecode, b64uEncode } from '../src/lib/auth/webauthn'

describe('base64url helpers', () => {
  it('round-trips arbitrary bytes', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255])
    expect([...b64uDecode(b64uEncode(bytes))]).toEqual([...bytes])
  })

  it('produces URL-safe output with no padding', () => {
    const out = b64uEncode(new Uint8Array([255, 255, 255, 255, 255]))
    expect(out).not.toMatch(/[+/=]/)
  })
})
