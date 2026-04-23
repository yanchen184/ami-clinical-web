import apiClient from './client';
import type { MedMaster, MedMasterRequest, PaginatedResponse } from '../types';

export const getMedMasters = async (params: {
  keyword?: string;
  page?: number;
  size?: number;
}): Promise<PaginatedResponse<MedMaster>> => {
  const response = await apiClient.get<PaginatedResponse<MedMaster>>('/api/med-masters', {
    params: { page: params.page ?? 0, size: params.size ?? 20, keyword: params.keyword },
  });
  return response.data;
};

export const getMedMaster = async (id: number): Promise<MedMaster> => {
  const response = await apiClient.get<MedMaster>(`/api/med-masters/${id}`);
  return response.data;
};

export const createMedMaster = async (data: MedMasterRequest): Promise<MedMaster> => {
  const response = await apiClient.post<MedMaster>('/api/med-masters', data);
  return response.data;
};

export const updateMedMaster = async (
  id: number,
  data: MedMasterRequest,
): Promise<MedMaster> => {
  const response = await apiClient.put<MedMaster>(`/api/med-masters/${id}`, data);
  return response.data;
};

export const deleteMedMaster = async (id: number): Promise<void> => {
  await apiClient.delete(`/api/med-masters/${id}`);
};
