// Thin client for ami-ai-service (Python FastAPI on :17900).
// Distinct from src/api/client.ts which targets the Spring Boot ami-web-service.
// This service has no envelope wrapping and no JWT — it speaks raw FastAPI JSON.

import type { MockHisRecord } from '../rulebase/mockHis';

const AI_BASE = import.meta.env.VITE_AI_SERVICE_URL || 'http://localhost:17900';

// ---- Wire-format types (mirror app/schemas/analyze.py + cdss_action.py) ----

export type Frequency =
  | 'QD' | 'BID' | 'TID' | 'QID' | 'QHS' | 'QAM'
  | 'PRN' | 'Q4H' | 'Q6H' | 'Q8H' | 'Q12H';

export type LabName =
  | 'LDL_C' | 'HBA1C' | 'EGFR' | 'SCR'
  | 'SBP' | 'DBP' | 'AST' | 'ALT' | 'LVEF';

export interface PatientStateWire {
  patient_id: string;
  age?: number;
  sex?: 'M' | 'F';
  has_ami: boolean;
  has_diabetes: boolean;
  has_hypertension: boolean;
  has_hyperlipidemia: boolean;
  has_ckd: boolean;
  has_hfref: boolean;
  has_fh: boolean;
  has_pad: boolean;
  ami_onset_date?: string;
  recurrent_event: boolean;
  adr: {
    nsaids: boolean;
    penicillin: boolean;
    cephalosporin: boolean;
    tetracycline: boolean;
    sulfonamide: boolean;
    anticonvulsan: boolean;
    statin_intolerance: boolean;
    allergic_med_codes: string[];
  };
  labs: { name: LabName; value: number; measured_at?: string }[];
  medications: { med_code: string; visit_date?: string; med_days?: number; frequency?: Frequency }[];
  adherence?: { h_days: number; g_days: number };
}

export interface CdssItemWire {
  content: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW' | null;
  source: string | null;
  structured: Record<string, unknown> | null;
}

export interface HermesStepWire {
  step: number;
  name: string;
  title: string;
  duration_ms: number;
  summary: string;
  detail: Record<string, unknown>;
}

export interface AnalyzeResponseWire {
  summary_id: number;
  soap: { S: string; O: string; A: string; P: string };
  cdss: {
    recommendations: CdssItemWire[];
    warnings: CdssItemWire[];
    rule_sources: string[];
  };
  rule_sources: string[];
  used_rag: boolean;
  triggers: string[];
  skill_versions: Record<string, string>;
  latency_ms: number;
  trace: { steps: HermesStepWire[]; total_ms: number } | null;
}

// ---- Mapping: MockHisRecord → PatientStateWire ----

export function mockHisToPatientState(p: MockHisRecord): PatientStateWire {
  return {
    patient_id: p.chrNoNew,
    age: p.age,
    sex: p.gender,
    has_ami: true,
    has_diabetes: p.hasDiabetes,
    has_hypertension: p.hasHtn,
    has_hyperlipidemia: false,
    has_ckd: p.hasCkd,
    has_hfref: p.hasHfref,
    has_fh: p.hasFh,
    has_pad: p.hasPad,
    ami_onset_date: p.amiOnsetDate,
    recurrent_event: p.recurrentEvent,
    adr: {
      nsaids: p.adr.nsaids ?? false,
      penicillin: p.adr.penicillin ?? false,
      cephalosporin: p.adr.cephalosporin ?? false,
      tetracycline: p.adr.tetracycline ?? false,
      sulfonamide: p.adr.sulfonamide ?? false,
      anticonvulsan: p.adr.anticonvulsan ?? false,
      statin_intolerance: p.adr.statinIntolerance ?? false,
      allergic_med_codes: p.adr.allergicMedCodes ?? [],
    },
    labs: p.labs.flatMap((l) => {
      const out: { name: LabName; value: number; measured_at?: string }[] = [
        { name: 'LDL_C', value: l.ldlC, measured_at: l.reportDate },
      ];
      if (l.hba1c !== undefined) out.push({ name: 'HBA1C', value: l.hba1c, measured_at: l.reportDate });
      if (l.egfr !== undefined) out.push({ name: 'EGFR', value: l.egfr, measured_at: l.reportDate });
      return out;
    }),
    medications: p.medications.map((m) => ({
      med_code: m.medCode,
      visit_date: m.visitDate,
      med_days: m.medDays,
    })),
    adherence: { h_days: p.adherence.hDays, g_days: p.adherence.gDays },
  };
}

// ---- API calls ----

export async function analyzePatient(patient: PatientStateWire): Promise<AnalyzeResponseWire> {
  const res = await fetch(`${AI_BASE}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patient }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`AI service /analyze failed (${res.status}): ${body.slice(0, 300)}`);
  }
  return (await res.json()) as AnalyzeResponseWire;
}

export interface AiHealth {
  status: string;
  components: {
    gemini?: { status: string; model?: string };
    database?: { status: string };
    pgvector?: { status: string; version?: string };
    skills?: { status: string; soul_version?: string; diseases?: string[] };
  };
}

export async function getAiHealth(): Promise<AiHealth> {
  const res = await fetch(`${AI_BASE}/health`);
  if (!res.ok) throw new Error(`AI service /health failed (${res.status})`);
  return (await res.json()) as AiHealth;
}
