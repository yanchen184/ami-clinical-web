// ── Auth ──
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  username: string;
  roles: Role[];
}

export type Role = 'ROLE_ADMIN' | 'ROLE_DOCTOR' | 'ROLE_CASE_MANAGER';

export interface JwtPayload {
  sub: string;
  roles: Role[];
  exp: number;
  iat: number;
}

// ── Patient ──
export type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface Patient {
  id: string;
  name: string;
  medicalRecordNo: string | null;
  age: number | null;
  gender: string;
  amiOnsetDate: string | null;
  admissionDate: string | null;
  dischargeDiagnosis: string | null; // ICD10
  diagnosis: string | null;
  phone: string | null;
  lineUserId: string | null;
  assignedCaseManagerId: number | null;
  riskLevel: RiskLevel;
  alertFlagged: boolean;
  alertFlagReason: string | null;
  lastVisitDate: string | null;
  lastReportDate: string | null;
  createdDate: string;
  lastModifiedDate: string;
}

export interface PaginatedResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

// ── SOAP Summary ──
export interface SoapSummary {
  id: number;
  patientId: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  generatedAt: string;
  promptVersion?: string;
}

// ── CDSS Advice ──
export type AdviceType = 'MEDICATION' | 'LIFESTYLE' | 'REFERRAL' | 'MONITORING';

export interface CdssAdvice {
  id: number;
  type: AdviceType;
  content: string;
  confidence: number; // 0-100
  evidenceLevel?: string;
  disclaimer: string;
  createdAt: string;
}

// ── Measurement ──
export type MeasurementType =
  | 'BLOOD_PRESSURE'
  | 'LDL_C'
  | 'BLOOD_GLUCOSE'
  | 'HBA1C'
  | 'WEIGHT'
  | 'HEART_RATE';

export interface Measurement {
  id: string;
  type: MeasurementType | string;
  value: Record<string, number>;
  recordedAt: string;
  source?: string;
}

export interface TrendIndicator {
  metric: MeasurementType | string;
  label: string;
  unit: string;
  status: 'RED' | 'YELLOW' | 'GREEN' | 'UNKNOWN';
  latestValue: number | null;
  targetValue: number | null;
  dataPoints: Array<{ date: string; value: number }>;
}

// ── Medication (近 90 日用藥) ──
export interface MedicationRecord {
  id: number;
  visitDate: string;
  drugName: string;
  genericName: string | null;
  hospitalCode: string | null;
  dailyFrequency: number | null; // QDC
  prescribedDays: number | null;
}

// ── Diagnosis (就醫診斷) ──
export type VisitType = 'OUTPATIENT' | 'EMERGENCY' | 'INPATIENT';

export interface DiagnosisRecord {
  id: number;
  visitDate: string;
  visitType: VisitType;
  icdCode: string;
  icdDescription: string | null;
}

// ── Adverse Drug Reaction ──
export interface AdverseReaction {
  id: number;
  drugName: string;
  hospitalCode: string | null;
  updatedDate: string;
}

// ── Case Note ──
export interface CaseNote {
  id: number;
  patientId: string;
  content: string;
  createdBy: string;
  createdAt: string;
}

// ── Notification ──
export interface NotificationLog {
  objid: number;
  recipientId: number;
  subject: string;
  content: string | null;
  status: string;
  createdDate: string;
}

export interface NotificationRequest {
  patientId: string;
  type: string;
  content: string;
}

// ── KPI ──
export interface KpiSummary {
  totalPatients: number;
  activePatients: number;
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
  reportingRate: number;
  abnormalCount: number;
}

// ── Doctor Feedback ──
export interface DoctorFeedback {
  patientId: string;
  rating: number;
  comment: string;
  correctedAssessment?: string;
  correctedPlan?: string;
}

// ── Alert Rule ──
export interface AlertRule {
  id: number;
  metric: string;
  metricLabel: string;
  unit: string;
  yellowThreshold: number;
  redThreshold: number;
  enabled: boolean;
}

export interface AlertRuleUpdateRequest {
  yellowThreshold: number;
  redThreshold: number;
  enabled: boolean;
}

// ── Follow-up Calendar ──
export type FollowUpType = 'PHONE' | 'CLINIC' | 'EDUCATION' | 'LAB';

export interface FollowUpEvent {
  id: number;
  patientId: string;
  patientName: string;
  type: FollowUpType;
  scheduledAt: string;
  note: string | null;
  caseManagerId: number;
  caseManagerName: string;
}

export interface FollowUpEventRequest {
  patientId: string;
  type: FollowUpType;
  scheduledAt: string;
  note?: string;
}

// ── Med Master (藥品基本檔) ──
export interface MedMaster {
  id: number;
  hospitalCode: string;
  nhiCode: string | null;
  atcCode: string | null;
  drugName: string;
  genericName: string | null;
  dosageForm: string | null;
  specification: string | null;
  enabled: boolean;
}

export interface MedMasterRequest {
  hospitalCode: string;
  nhiCode?: string;
  atcCode?: string;
  drugName: string;
  genericName?: string;
  dosageForm?: string;
  specification?: string;
}

// ── Formula Master (配方主檔) ──
export type FormulaCategory = 'STATIN' | 'COMBINATION' | 'OTHER';
export type FormulaInsuranceType = 'NHI' | 'SELF_PAY';

export interface FormulaItem {
  id: number;
  formulaId: number;
  medMasterId: number;
  drugName: string;
  dddValue: number;
  priority: number;
}

export interface Formula {
  id: number;
  name: string;
  ldlReductionPct: number;
  category: FormulaCategory;
  insuranceType: FormulaInsuranceType;
  enabled: boolean;
  items: FormulaItem[];
}

export interface FormulaRequest {
  name: string;
  ldlReductionPct: number;
  category: FormulaCategory;
  insuranceType: FormulaInsuranceType;
}

export interface FormulaItemRequest {
  medMasterId: number;
  dddValue: number;
  priority: number;
}

// ── Formula Combo (配方組合) ──
export interface FormulaCombo {
  id: number;
  formulaAId: number;
  formulaAName: string;
  formulaBId: number;
  formulaBName: string;
  formulaCId: number | null;
  formulaCName: string | null;
  combinedLdlReductionPct: number;
}
