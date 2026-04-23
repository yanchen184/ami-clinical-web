import apiClient from './client';
import type {
  AdverseReaction,
  CdssAdvice,
  DiagnosisRecord,
  DoctorFeedback,
  Measurement,
  MeasurementType,
  MedicationRecord,
  PaginatedResponse,
  Patient,
  SoapSummary,
  TrendIndicator,
} from '../types';

interface PatientListParams {
  page?: number;
  size?: number;
  search?: string;
  riskLevel?: string;
  assignedToMe?: boolean;
  alertStatus?: 'RED';
  sortBy?: 'riskLevel' | 'lastVisitDate' | 'lastReportDate';
}

export const getPatients = async (
  params: PatientListParams = {},
): Promise<PaginatedResponse<Patient>> => {
  const response = await apiClient.get<PaginatedResponse<Patient>>('/api/patients', {
    params: {
      page: params.page ?? 0,
      size: params.size ?? 20,
      keyword: params.search || undefined,
      riskLevel: params.riskLevel || undefined,
      assignedToMe: params.assignedToMe || undefined,
      alertStatus: params.alertStatus || undefined,
      sortBy: params.sortBy || undefined,
    },
  });
  return response.data;
};

export const getPatient = async (id: string): Promise<Patient> => {
  const response = await apiClient.get<Patient>(`/api/patients/${id}`);
  return response.data;
};

export const getPatientSummary = async (id: string): Promise<SoapSummary> => {
  const response = await apiClient.get<SoapSummary>(`/api/patients/${id}/summary`);
  return response.data;
};

export const getPatientMeasurements = async (
  id: string,
  type: MeasurementType | string = 'BLOOD_PRESSURE',
  days?: number,
): Promise<Measurement[]> => {
  const response = await apiClient.get<Measurement[]>(`/api/patients/${id}/measurements`, {
    params: { type, days },
  });
  return response.data;
};

export const getPatientTrendIndicators = async (
  id: string,
  days: 7 | 30 | 90 = 30,
): Promise<TrendIndicator[]> => {
  const response = await apiClient.get<TrendIndicator[]>(
    `/api/patients/${id}/measurements/trend`,
    { params: { days } },
  );
  return response.data;
};

export const getPatientCdssAdvice = async (id: string): Promise<CdssAdvice[]> => {
  const response = await apiClient.get<CdssAdvice[]>(`/api/patients/${id}/cdss-advice`);
  return response.data;
};

export const getPatientMedications = async (
  id: string,
  days = 90,
): Promise<MedicationRecord[]> => {
  const response = await apiClient.get<MedicationRecord[]>(`/api/patients/${id}/medications`, {
    params: { days },
  });
  return response.data;
};

export const getPatientDiagnoses = async (id: string): Promise<DiagnosisRecord[]> => {
  const response = await apiClient.get<DiagnosisRecord[]>(`/api/patients/${id}/diagnoses`);
  return response.data;
};

export const getPatientAdverseReactions = async (id: string): Promise<AdverseReaction[]> => {
  const response = await apiClient.get<AdverseReaction[]>(
    `/api/patients/${id}/adverse-reactions`,
  );
  return response.data;
};

export const updatePatientAlertFlag = async (
  id: string,
  flagged: boolean,
  reason?: string,
): Promise<void> => {
  await apiClient.patch(`/api/patients/${id}/alert-flag`, { flagged, reason });
};

export const submitDoctorFeedback = async (feedback: DoctorFeedback): Promise<void> => {
  await apiClient.post(`/api/patients/${feedback.patientId}/feedback`, feedback);
};

export const triggerReportRegenerate = async (id: string): Promise<void> => {
  await apiClient.post(`/api/patients/${id}/report/regenerate`);
};
