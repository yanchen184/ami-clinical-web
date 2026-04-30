import { test, type Page } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const BASE = process.env.WEB_BASE || 'http://localhost:17000'
const API = process.env.API_BASE || 'http://localhost:17081'
const SHOT = path.join(__dirname, 'artifacts/rwd-detail')
fs.mkdirSync(SHOT, { recursive: true })

const DOCTOR = { username: 'doctor01', password: 'Doctor@123456' }

async function getToken(): Promise<string> {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(DOCTOR),
  })
  const json = (await res.json()) as Record<string, unknown>
  const data = (json.data ?? json) as Record<string, unknown>
  return ((data.accessToken ?? data.token ?? '') as string)
}

async function injectToken(page: Page, token: string): Promise<void> {
  await page.addInitScript((t) => {
    window.localStorage.setItem('token', t)
  }, token)
}

async function getFirstPatientId(token: string): Promise<string> {
  const res = await fetch(`${API}/api/patients?page=0&size=5`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const json = (await res.json()) as Record<string, unknown>
  const data = (json.data ?? json) as Record<string, unknown>
  const content = (data.content ?? []) as Array<{ id: string }>
  return content[0]?.id ?? ''
}

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'mobile', width: 390, height: 844 },
] as const

let token = ''
let patientId = ''

test.beforeAll(async () => {
  token = await getToken()
  if (!token) throw new Error('Failed to login as doctor01')
  patientId = await getFirstPatientId(token)
  if (!patientId) throw new Error('No patient found')
  console.log(`Got token (len=${token.length}), patientId=${patientId}`)
})

for (const vp of VIEWPORTS) {
  test(`detail RWD @ ${vp.name} ${vp.width}x${vp.height}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } })
    const page = await ctx.newPage()
    await injectToken(page, token)
    await page.goto(`${BASE}/doctor/patients/${patientId}`, { timeout: 60000 })
    await page.waitForLoadState('networkidle', { timeout: 20000 })
    await page.waitForTimeout(2000)
    await page.screenshot({ path: path.join(SHOT, `${vp.name}_01_top.png`), fullPage: false })
    await page.screenshot({ path: path.join(SHOT, `${vp.name}_02_full.png`), fullPage: true })
    await ctx.close()
  })
}
