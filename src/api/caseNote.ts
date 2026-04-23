import apiClient from './client';
import type { CaseNote } from '../types';

export const getCaseNotes = async (patientId: string): Promise<CaseNote[]> => {
  const response = await apiClient.get<CaseNote[]>(`/api/patients/${patientId}/notes`);
  return response.data;
};

export const createCaseNote = async (
  patientId: string,
  content: string,
): Promise<CaseNote> => {
  const response = await apiClient.post<CaseNote>(`/api/patients/${patientId}/notes`, {
    content,
  });
  return response.data;
};
