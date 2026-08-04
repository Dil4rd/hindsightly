import { describe, expect, it } from 'vitest'
import { presetWindow } from '../src/lib/stats/filters'
import { granularityFor } from '../src/lib/stats/series'

describe('presetWindow', () => {
  it("'day' is calendar today (local midnight → now), not rolling 24h", () => {
    const now = new Date(2026, 5, 15, 14, 30) // local 2026-06-15 14:30
    const { since, until } = presetWindow('day', now)
    expect(until).toBe(now)
    expect(since.getTime()).toBe(new Date(2026, 5, 15, 0, 0, 0, 0).getTime())
  })

  it("'week' stays a rolling 7 days", () => {
    const now = new Date('2026-06-15T14:30:00Z')
    const { since } = presetWindow('week', now)
    expect(now.getTime() - since.getTime()).toBe(7 * 86_400_000)
  })
})

describe('granularityFor', () => {
  it('buckets day by day-part; week/month by day; quarter/year by week', () => {
    expect(granularityFor('day')).toBe('daypart')
    expect(granularityFor('week')).toBe('day')
    expect(granularityFor('month')).toBe('day')
    expect(granularityFor('quarter')).toBe('week')
    expect(granularityFor('year')).toBe('week')
  })
})
