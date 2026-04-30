// PhaseB：前端不再直連 ai-service，改走 Java proxy /api/patients/{id}/ai/*
// VITE_AI_SERVICE_URL 仍保留作為 E2E mock 攔截 / 開發直連用途。
const AI_BASE = (import.meta.env.VITE_AI_SERVICE_URL as string) || '';

export interface PatientFixture {
  patientId: string;
  age?: number;
  sex?: string;
  icd10?: string[];
  has_ami?: boolean;
  has_diabetes?: boolean;
  has_hypertension?: boolean;
  has_hyperlipidemia?: boolean;
  has_ckd?: boolean;
  has_hf?: boolean;
  labs?: Array<{ name: string; value: number; unit?: string; measured_at?: string }>;
  medications?: Array<{ name: string; dose?: string; frequency?: string }>;
  note?: string;
}

export interface HermesStep {
  step: number;
  name: string;
  title: string;
  duration_ms: number;
  summary: string;
  detail: Record<string, unknown>;
}

export interface HermesTrace {
  steps: HermesStep[];
  total_ms: number;
}

export type AdvicePriority = 'HIGH' | 'MEDIUM' | 'LOW';

export interface CdssItem {
  content: string;
  priority?: AdvicePriority | null;
  source?: string | null;
}

export interface AnalyzeResponse {
  summary_id: number;
  soap: { S: string; O: string; A: string; P: string };
  cdss: {
    recommendations: CdssItem[];
    warnings: CdssItem[];
    rule_sources: string[];
  };
  rule_sources: string[];
  used_rag: boolean;
  triggers: string[];
  skill_versions: Record<string, string>;
  latency_ms: number;
  trace?: HermesTrace | null;
}

export interface FeedbackRequest {
  ai_summary_id: number;
  feedback_type: 'thumbs_up' | 'thumbs_down' | 'correction';
  doctor_id: string;
  original_text?: string;
  corrected_text?: string;
  reason_category?: string;
  reason_text?: string;
}

export interface FeedbackResponse {
  feedback_id: number;
  sync_status: string;
}

export interface FeedbackSyncResult {
  processed: number;
  evolve_skill: number;
  write_example: number;
  needs_seed: number;
  ignored: number;
}

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

/** PhaseB：透過 Java proxy 打 ai-service。 */
function proxyUrl(patientId: string, path: string): string {
  if (AI_BASE) {
    // E2E / 開發直連模式：直接打 ai-service
    return `${AI_BASE}${path}`;
  }
  return `/api/patients/${patientId}/ai${path}`;
}

export function analyze(patient: PatientFixture): Promise<AnalyzeResponse> {
  const path = AI_BASE ? '/analyze' : '/analyze';
  return jsonFetch<AnalyzeResponse>(proxyUrl(patient.patientId, path), {
    method: 'POST',
    body: JSON.stringify(AI_BASE ? { patient } : patient),
  });
}

export function submitFeedback(patientId: string, payload: FeedbackRequest): Promise<FeedbackResponse> {
  return jsonFetch<FeedbackResponse>(proxyUrl(patientId, '/feedback'), {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function syncFeedback(patientId: string): Promise<FeedbackSyncResult> {
  return jsonFetch<FeedbackSyncResult>(
    AI_BASE ? `${AI_BASE}/admin/feedback/sync` : `/api/patients/${patientId}/ai/feedback/sync`,
    { method: 'POST' },
  );
}
