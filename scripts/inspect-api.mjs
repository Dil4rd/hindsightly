// Privacy-safe Todoist API inspector for development.
// Prints ONLY structure (key -> type), enum values for event_type/object_type,
// pagination keys, and extra_data field NAMES. Never prints task content,
// names, notes, or any string values. Token read from .env (gitignored).
//
//   node scripts/inspect-api.mjs

import { readFileSync } from 'node:fs'

function loadToken() {
  if (process.env.TODOIST_API_TOKEN) return process.env.TODOIST_API_TOKEN
  const env = readFileSync(new URL('../.env', import.meta.url), 'utf8')
  const m = env.match(/TODOIST_API_TOKEN\s*=\s*(\S+)/)
  if (!m) throw new Error('TODOIST_API_TOKEN not found in env or .env')
  return m[1]
}

const TOKEN = loadToken()
const BASE = 'https://api.todoist.com'

async function get(path, params = {}) {
  const url = new URL(BASE + path)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v))
  const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } })
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = { __nonjson__: text.slice(0, 200) } // error bodies are safe to show
  }
  return { status: res.status, json, url: `${url.pathname}${url.search}` }
}

const typeOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v)

function schemaOf(items) {
  const arr = Array.isArray(items) ? items : [items]
  const schema = {}
  for (const it of arr.slice(0, 100)) {
    if (it && typeof it === 'object' && !Array.isArray(it)) {
      for (const [k, v] of Object.entries(it)) {
        const t = typeOf(v)
        schema[k] = !schema[k] ? t : schema[k].includes(t) ? schema[k] : `${schema[k]}|${t}`
      }
    }
  }
  return schema
}

const asList = (json) =>
  Array.isArray(json) ? json : json?.results ?? json?.events ?? json?.items ?? []

function header(title) {
  console.log(`\n=== ${title} ===`)
}

// --- projects ---------------------------------------------------------------
{
  const r = await get('/api/v1/projects', { limit: 200 })
  header('GET /api/v1/projects')
  console.log('status:', r.status)
  console.log('top-level keys:', Array.isArray(r.json) ? '(array)' : Object.keys(r.json))
  const list = asList(r.json)
  console.log('count:', list.length)
  console.log('project schema:', schemaOf(list))
  console.log('have parent_id set on any:', list.some((p) => p?.parent_id != null))
}

// --- completed by completion date -------------------------------------------
{
  const since = new Date(Date.now() - 30 * 864e5).toISOString()
  const until = new Date().toISOString()
  for (const params of [
    { since, until, limit: 5 },
    { since, until, limit: 5, annotate_items: true },
  ]) {
    const r = await get('/api/v1/tasks/completed/by_completion_date', params)
    header(`GET /api/v1/tasks/completed/by_completion_date ${JSON.stringify(Object.keys(params))}`)
    console.log('status:', r.status, '|', r.url)
    if (r.status >= 400) {
      console.log('error:', r.json)
      continue
    }
    console.log('top-level keys:', Array.isArray(r.json) ? '(array)' : Object.keys(r.json))
    const list = asList(r.json)
    console.log('count:', list.length)
    console.log('item schema:', schemaOf(list))
    break
  }
}

// --- find the activity-log endpoint -----------------------------------------
{
  header('activity endpoint discovery')
  const candidates = [
    '/api/v1/activities',
    '/api/v1/activity',
    '/api/v1/activity/get',
    '/sync/v9/activity/get',
    '/api/v1/sync/activity/get',
  ]
  for (const path of candidates) {
    const r = await get(path, { limit: 1 })
    console.log(
      `${r.status}  ${path}`,
      r.status === 200 ? `keys=${Array.isArray(r.json) ? '(array)' : Object.keys(r.json)}` : '',
    )
  }
}

// --- activity log -----------------------------------------------------------
{
  const r = await get('/api/v1/activities', { limit: 100 })
  header('GET /api/v1/activities?limit=100')
  console.log('status:', r.status, '|', r.url)
  if (r.status >= 400) {
    console.log('error:', r.json)
  } else {
    console.log('top-level keys:', Array.isArray(r.json) ? '(array)' : Object.keys(r.json))
    const events = asList(r.json)
    console.log('event count returned:', events.length)
    console.log('event schema:', schemaOf(events))
    console.log('distinct event_type:', [...new Set(events.map((e) => e?.event_type))])
    console.log('distinct object_type:', [...new Set(events.map((e) => e?.object_type))])
    const extra = new Set()
    for (const e of events) if (e?.extra_data) Object.keys(e.extra_data).forEach((k) => extra.add(k))
    console.log('union of extra_data keys:', [...extra])
    console.log('extra_data schema:', schemaOf(events.map((e) => e?.extra_data).filter(Boolean)))
  }
}
