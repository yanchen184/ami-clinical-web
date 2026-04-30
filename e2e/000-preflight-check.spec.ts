/**
 * AMI Clinical Web — Preflight Check
 *
 * 截圖 / 操作手冊開始拍之前的「功能完成前提條件」檢查。
 * 對應 docs/qa/requirements.md 的「✅ 開始截圖前的『功能完成』前提條件」18 條 gate。
 *
 * 執行：
 *   npx playwright test e2e/000-preflight-check.spec.ts --project=chromium --reporter=list
 *
 * 報告輸出：e2e/artifacts/preflight-report.json + console
 *
 * 任何 fail 都代表「現在還不能開始拍 Part A / Part B 截圖」。
 */

import { test, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const WEB_BASE = 'http://localhost:17000'
const API_BASE = 'http://localhost:17000' // proxied to :17081 by Vite
const AI_BASE = 'http://localhost:17900'
const PATIENT_API_BASE = 'http://localhost:17082'  // patient-api real port (:16000 is a separate legacy service)
const PATIENT_WEB_BASE = 'http://localhost:17001'

const REPORT_PATH = path.resolve(__dirname, 'artifacts/preflight-report.json')

const DOCTOR = { username: 'doctor01', password: 'Doctor@123456' }
const CM = { username: 'cm01', password: 'Manager@123456' }
const ADMIN = { username: 'admin', password: 'Admin@123456' }

type Check = { id: string; part: 'A' | 'B' | 'shared'; label: string; pass: boolean; detail: string }
const results: Check[] = []

function record(id: string, part: 'A' | 'B' | 'shared', label: string, pass: boolean, detail: string) {
  results.push({ id, part, label, pass, detail })
  const icon = pass ? '✅' : '❌'
  console.log(`${icon} [${id}] ${label} — ${detail}`)
}

async function fetchT(url: string, init: RequestInit = {}, timeoutMs = 8000): Promise<Response> {
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: ac.signal })
  } finally {
    clearTimeout(t)
  }
}

async function loginToken(creds: { username: string; password: string }): Promise<string> {
  const res = await fetchT(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(creds),
  })
  if (!res.ok) throw new Error(`login ${creds.username} ${res.status}`)
  const json: any = await res.json()
  const token = json?.data?.accessToken ?? json?.accessToken ?? json?.token ?? ''
  if (!token) throw new Error(`no token for ${creds.username}: ${JSON.stringify(json).slice(0, 200)}`)
  return token
}

async function apiGet(url: string, token: string): Promise<{ status: number; body: any }> {
  const res = await fetchT(url, { headers: { Authorization: `Bearer ${token}` } })
  const text = await res.text()
  let body: any = null
  try {
    body = JSON.parse(text)
  } catch {
    body = text
  }
  return { status: res.status, body }
}

async function apiPost(url: string, body: unknown, token?: string): Promise<{ status: number; body: any }> {
  const res = await fetchT(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  }, 60000)  // /analyze can take 30+ seconds
  const text = await res.text()
  let parsed: any = null
  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = text
  }
  return { status: res.status, body: parsed }
}

test.setTimeout(180_000)

test('preflight: 18 prerequisites for screenshot tour', async () => {
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true })

  // ── shared.1 ─ services up & reachable ────────────────────────────────────
  for (const [name, url, expectStatuses] of [
    ['clinical-web :17000', `${WEB_BASE}/`, [200]],
    ['clinical-api :17081 (via proxy)', `${API_BASE}/api/auth/login`, [405, 400, 401]], // GET on POST endpoint = 405
    ['ai-service :17900', `${AI_BASE}/health`, [200]],
    ['patient-api :16000', `${PATIENT_API_BASE}/`, [200, 401, 403, 404]],
    ['patient-web :17001', `${PATIENT_WEB_BASE}/`, [200]],
  ] as const) {
    try {
      const res = await fetchT(url, { method: 'GET' }, 5000)
      const ok = (expectStatuses as readonly number[]).includes(res.status)
      record(`shared.svc.${name}`, 'shared', `${name} reachable`, ok, `HTTP ${res.status}`)
    } catch (e: any) {
      record(`shared.svc.${name}`, 'shared', `${name} reachable`, false, `connect failed: ${e.message}`)
    }
  }

  // ── shared.2 ─ ai-service health JSON shape ───────────────────────────────
  try {
    const r = await fetchT(`${AI_BASE}/health`, {}, 5000)
    const j: any = await r.json()
    const okGemini = j?.components?.gemini?.status === 'ok'
    const okDb = j?.components?.database?.status === 'ok'
    const okPgv = j?.components?.pgvector?.status === 'ok'
    const okSkills = j?.components?.skills?.status === 'ok'
    const allOk = okGemini && okDb && okPgv && okSkills
    record(
      'shared.health',
      'shared',
      'ai-service all components ok',
      allOk,
      `gemini=${okGemini} db=${okDb} pgvector=${okPgv} skills=${okSkills} | model=${j?.components?.gemini?.model}`,
    )
  } catch (e: any) {
    record('shared.health', 'shared', 'ai-service health JSON', false, e.message)
  }

  // ── A.1 ─ 3 test accounts can login ───────────────────────────────────────
  let doctorToken = ''
  let cmToken = ''
  let adminToken = ''
  for (const [label, creds, setter] of [
    ['doctor01', DOCTOR, (t: string) => (doctorToken = t)],
    ['cm01', CM, (t: string) => (cmToken = t)],
    ['admin', ADMIN, (t: string) => (adminToken = t)],
  ] as const) {
    try {
      const t = await loginToken(creds)
      setter(t)
      record(`A.login.${label}`, 'A', `${label} can login`, true, `token len=${t.length}`)
    } catch (e: any) {
      record(`A.login.${label}`, 'A', `${label} can login`, false, e.message)
    }
  }

  if (!doctorToken) {
    record('A.precondition', 'A', 'doctor token required for further checks', false, 'STOP — fix login first')
    fs.writeFileSync(REPORT_PATH, JSON.stringify(results, null, 2))
    return
  }

  // ── A.2 ─ patient list ≥ 5 ────────────────────────────────────────────────
  let firstPatientId = ''
  let patientCount = 0
  try {
    const { status, body } = await apiGet(`${API_BASE}/api/patients?page=0&size=20`, doctorToken)
    const content = body?.data?.content ?? body?.content ?? []
    patientCount = body?.data?.totalElements ?? body?.totalElements ?? content.length
    firstPatientId = content[0]?.id ?? ''
    const ok = patientCount >= 5
    record('A.patients.count', 'A', 'patient list ≥ 5', ok, `total=${patientCount} firstId=${firstPatientId} status=${status}`)
  } catch (e: any) {
    record('A.patients.count', 'A', 'patient list ≥ 5', false, e.message)
  }

  // ── A.3 ─ patient detail has all required fields ──────────────────────────
  if (firstPatientId) {
    try {
      const { body } = await apiGet(`${API_BASE}/api/patients/${firstPatientId}`, doctorToken)
      const p = body?.data ?? body
      const fields = ['age', 'gender', 'amiOnsetDate', 'diagnosis', 'riskLevel']
      const missing = fields.filter((f) => p?.[f] == null || p?.[f] === '')
      record(
        'A.patients.detail',
        'A',
        'patient detail required fields filled',
        missing.length === 0,
        missing.length === 0 ? `all ${fields.length} fields present` : `missing: ${missing.join(',')}`,
      )
    } catch (e: any) {
      record('A.patients.detail', 'A', 'patient detail required fields', false, e.message)
    }
  }

  // ── A.4 ─ KPI summary returns non-zero ────────────────────────────────────
  if (cmToken || doctorToken) {
    const tok = cmToken || doctorToken
    // Try a few likely paths for KPI
    const kpiPaths = ['/api/kpi/summary', '/api/casemanager/kpi', '/api/dashboard/kpi', '/api/kpi']
    let kpiOk = false
    let kpiDetail = ''
    for (const p of kpiPaths) {
      const { status, body } = await apiGet(`${API_BASE}${p}`, tok)
      if (status === 200) {
        const data = body?.data ?? body
        const numbers = JSON.stringify(data).match(/\d+/g)?.map(Number) ?? []
        const hasNonZero = numbers.some((n) => n > 0)
        kpiOk = hasNonZero
        kpiDetail = `${p} → ${status}, numbers: ${numbers.slice(0, 8).join(',')}${hasNonZero ? '' : ' (all zero)'}`
        break
      }
      kpiDetail = `${p} → ${status} (try next)`
    }
    record('A.kpi', 'A', 'KPI summary endpoint returns non-zero', kpiOk, kpiDetail)
  }

  // ── A.5 ─ red alerts list ≥ 1 ─────────────────────────────────────────────
  if (cmToken || doctorToken) {
    const tok = cmToken || doctorToken
    const paths = ['/api/casemanager/red-alerts', '/api/red-alerts', '/api/alerts/red']
    let okPath = ''
    let count = -1
    for (const p of paths) {
      const { status, body } = await apiGet(`${API_BASE}${p}`, tok)
      if (status === 200) {
        const data = body?.data ?? body
        count = Array.isArray(data) ? data.length : data?.content?.length ?? data?.totalElements ?? 0
        okPath = p
        break
      }
    }
    record(
      'A.redalerts',
      'A',
      'red alerts list ≥ 1',
      count >= 1,
      okPath ? `${okPath} → count=${count}` : `no working endpoint tried: ${paths.join(', ')}`,
    )
  }

  // ── A.6 ─ calendar events ≥ 1 ─────────────────────────────────────────────
  if (cmToken || doctorToken) {
    const tok = cmToken || doctorToken
    const paths = ['/api/calendar/events', '/api/casemanager/calendar', '/api/events']
    let okPath = ''
    let count = -1
    for (const p of paths) {
      const { status, body } = await apiGet(`${API_BASE}${p}`, tok)
      if (status === 200) {
        const data = body?.data ?? body
        count = Array.isArray(data) ? data.length : data?.content?.length ?? 0
        okPath = p
        break
      }
    }
    record(
      'A.calendar',
      'A',
      'calendar events ≥ 1',
      count >= 1,
      okPath ? `${okPath} → count=${count}` : `no working endpoint`,
    )
  }

  // ── A.7 ─ trends data has ≥ 7 distinct days ───────────────────────────────
  if (firstPatientId && doctorToken) {
    const paths = [
      `/api/patients/${firstPatientId}/measurements`,
      `/api/patients/${firstPatientId}/trends`,
      `/api/measurements?patientId=${firstPatientId}`,
    ]
    let days = 0
    let okPath = ''
    for (const p of paths) {
      const { status, body } = await apiGet(`${API_BASE}${p}`, doctorToken)
      if (status === 200) {
        const data = body?.data ?? body
        const arr = Array.isArray(data) ? data : data?.content ?? []
        const distinctDays = new Set(arr.map((m: any) => (m.measuredAt ?? m.recordedAt ?? m.date ?? '').slice(0, 10)))
        days = distinctDays.size
        okPath = p
        break
      }
    }
    record(
      'A.trends',
      'A',
      'measurement spans ≥ 7 distinct days',
      days >= 7,
      okPath ? `${okPath} → distinct days=${days}` : 'no measurements endpoint working',
    )
  }

  // ── A.8 ─ medications + diagnoses non-empty ───────────────────────────────
  if (firstPatientId && doctorToken) {
    for (const [label, paths] of [
      ['medications', [`/api/patients/${firstPatientId}/medications`, `/api/medications?patientId=${firstPatientId}`]],
      ['diagnoses', [`/api/patients/${firstPatientId}/diagnoses`, `/api/diagnoses?patientId=${firstPatientId}`]],
    ] as const) {
      let count = -1
      let okPath = ''
      for (const p of paths) {
        const { status, body } = await apiGet(`${API_BASE}${p}`, doctorToken)
        if (status === 200) {
          const data = body?.data ?? body
          count = Array.isArray(data) ? data.length : data?.content?.length ?? 0
          okPath = p
          break
        }
      }
      record(`A.${label}`, 'A', `${label} non-empty`, count >= 1, okPath ? `${okPath} → ${count}` : 'no endpoint')
    }
  }

  // ── B.1 ─ /ai/analyze returns 200 with 7-step trace ──────────────────────
  // 端點路徑：POST /api/patients/{id}/ai/analyze（不是 /analyze）
  // body 需要 fixture（HermesAnalyzeRequest）
  let analyzeRes: any = null
  if (firstPatientId && doctorToken) {
    const fixture = {
      patientId: firstPatientId,
      age: 65,
      sex: 'M',
      icd10: ['I21.0'],
      has_ami: true,
      has_diabetes: true,
      has_hypertension: true,
      has_hyperlipidemia: true,
      has_ckd: false,
      has_hf: false,
      labs: [
        { name: 'LDL', value: 130, unit: 'mg/dL', date: '2026-04-20' },
        { name: 'HbA1c', value: 7.5, unit: '%', date: '2026-04-20' },
      ],
      medications: [
        { name: 'Aspirin', dose: '100mg', freq: 'QD' },
        { name: 'Metformin', dose: '500mg', freq: 'BID' },
      ],
      note: 'Preflight smoke test — please return realistic CDSS advice.',
    }
    try {
      const { status, body } = await apiPost(
        `${API_BASE}/api/patients/${firstPatientId}/ai/analyze`,
        fixture,
        doctorToken,
      )
      analyzeRes = body?.data ?? body
      // Real shape: trace = { steps: [...], total_ms } / cdss = { recommendations, warnings, rule_sources }
      const traceObj = analyzeRes?.trace ?? {}
      const steps = traceObj?.steps ?? (Array.isArray(traceObj) ? traceObj : [])
      const stepCount = Array.isArray(steps) ? steps.length : 0
      const hasLatency =
        stepCount > 0 &&
        steps.every(
          (s: any) =>
            typeof s.duration_ms === 'number' ||
            typeof s.latency_ms === 'number' ||
            typeof s.latencyMs === 'number',
        )
      record(
        'B.analyze.status',
        'B',
        '/ai/analyze returns 200',
        status === 200,
        `status=${status}, body keys: ${Object.keys(analyzeRes ?? {}).join(',').slice(0, 200)}`,
      )
      record(
        'B.analyze.7steps',
        'B',
        'trace has 7 steps with per-step duration',
        stepCount === 7 && hasLatency,
        `step count=${stepCount}, all have duration_ms=${hasLatency}`,
      )
    } catch (e: any) {
      record('B.analyze.status', 'B', '/ai/analyze returns 200', false, e.message)
    }
  }

  // ── B.2 ─ summary fields filled ───────────────────────────────────────────
  if (analyzeRes) {
    const s = analyzeRes
    const summaryId = s.summary_id ?? s.summaryId
    const totalLatency = s.latency_ms ?? s.total_latency_ms ?? s.totalLatencyMs ?? s.trace?.total_ms
    const usedRag = s.used_rag ?? s.usedRag
    const skillVersions = s.skill_versions ?? s.skillVersions
    const allFilled = !!summaryId && totalLatency != null && usedRag !== undefined && skillVersions !== undefined
    record(
      'B.summary',
      'B',
      'analyze summary 4 fields filled (id/latency/used_rag/skill_versions)',
      allFilled,
      `summary_id=${!!summaryId}, latency=${totalLatency}, used_rag=${usedRag}, skill_versions=${JSON.stringify(skillVersions)?.slice(0, 80)}`,
    )

    // Inline rule_sources mix check from analyze response (more reliable than re-fetching)
    const rs: string[] = Array.isArray(s.rule_sources) ? s.rule_sources : (s.cdss?.rule_sources ?? [])
    const hasSkill = rs.some((x) => typeof x === 'string' && x.includes('SKILL/'))
    const hasExample = rs.some((x) => typeof x === 'string' && x.includes('example#'))
    record(
      'B.rule_sources.inline',
      'B',
      'analyze rule_sources contains SKILL/* AND example#*',
      hasSkill && hasExample,
      `count=${rs.length}, has SKILL=${hasSkill}, has example=${hasExample}, samples=${rs.slice(0, 3).join('|')}`,
    )

    // Inline cdss recommendations count
    const recs = s.cdss?.recommendations ?? (Array.isArray(s.cdss) ? s.cdss : [])
    record(
      'B.cdss.inline',
      'B',
      'analyze response has ≥3 CDSS recommendations',
      Array.isArray(recs) && recs.length >= 3,
      `recommendations count=${Array.isArray(recs) ? recs.length : 'not-array'}, warnings=${Array.isArray(s.cdss?.warnings) ? s.cdss.warnings.length : 0}`,
    )
  }

  // ── B.3 ─ persistence: /summary contains SOAP, /cdss-advice persists ──────
  // 端點：GET /api/patients/{id}/summary       → AiSummaryResponse
  //       GET /api/patients/{id}/cdss-advice   → List<Map>
  if (firstPatientId && doctorToken) {
    // 3a. AI summary (SOAP) — persisted by analyze
    try {
      const { status, body } = await apiGet(`${API_BASE}/api/patients/${firstPatientId}/summary`, doctorToken)
      const data = body?.data ?? body
      const soap = data?.soap ?? data?.aiSummary?.soap ?? data
      const allFilled = ['subjective', 'objective', 'assessment', 'plan'].every((k) => {
        const v = soap?.[k]
        return typeof v === 'string' && v.length > 5
      })
      record(
        'B.soap',
        'B',
        'SOAP four sections persisted (subjective/objective/assessment/plan)',
        allFilled,
        `status=${status}, keys=${Object.keys(soap ?? {}).join(',').slice(0, 200)}`,
      )
    } catch (e: any) {
      record('B.soap', 'B', '/summary readable', false, e.message)
    }

    // 3b. CDSS advice persistence (known backend gap if empty even after /analyze)
    try {
      const { body } = await apiGet(`${API_BASE}/api/patients/${firstPatientId}/cdss-advice`, doctorToken)
      const cdss = body?.data ?? body
      const list = Array.isArray(cdss) ? cdss : []
      record(
        'B.cdss.persist',
        'B',
        'cdss-advice persisted to DB after /analyze',
        list.length >= 1,
        `count=${list.length}${list.length === 0 ? ' — backend gap: analyze does not write to cdss_advice table?' : ''}`,
      )

      if (list.length > 0) {
        const first = list[0]
        const hasType = !!(first.type ?? first.category)
        const hasContent = !!(first.content ?? first.text ?? first.advice ?? first.recommendation)
        const hasConfidence = first.confidence != null
        record(
          'B.cdss.shape',
          'B',
          'CdssAdviceCard shape (type/content/confidence)',
          hasType && hasContent && hasConfidence,
          `keys=${Object.keys(first).join(',').slice(0, 200)}`,
        )
      }
    } catch (e: any) {
      record('B.cdss.persist', 'B', 'cdss-advice readable', false, e.message)
    }
  }

  // ── Write report ──────────────────────────────────────────────────────────
  const passed = results.filter((r) => r.pass).length
  const failed = results.length - passed

  fs.writeFileSync(
    REPORT_PATH,
    JSON.stringify(
      { ts: new Date().toISOString(), passed, failed, total: results.length, checks: results },
      null,
      2,
    ),
  )

  // Group summary
  const byPart = (p: 'A' | 'B' | 'shared') => {
    const list = results.filter((r) => r.part === p)
    const ok = list.filter((r) => r.pass).length
    return `${p}: ${ok}/${list.length}`
  }

  console.log('\n' + '='.repeat(60))
  console.log(`PREFLIGHT REPORT — ${passed}/${results.length} passed`)
  console.log(`  ${byPart('shared')} | ${byPart('A')} | ${byPart('B')}`)
  console.log('='.repeat(60))
  if (failed > 0) {
    console.log('\nFAILED checks:')
    for (const r of results.filter((x) => !x.pass)) {
      console.log(`  ❌ [${r.id}] ${r.label}\n     ${r.detail}`)
    }
  }
  console.log(`\nFull report: ${REPORT_PATH}`)

  // 不直接 fail spec — preflight 的目的是「列出問題」，不是 block CI。
  // 由 caller 決定要不要因為 failed > 0 就停手。
  expect.soft(failed, `${failed} prerequisites failed — see ${REPORT_PATH}`).toBe(0)
})
