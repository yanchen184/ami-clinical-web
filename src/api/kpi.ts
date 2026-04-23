import apiClient from './client';
import type { KpiSummary } from '../types';

export const getKpiSummary = async (): Promise<KpiSummary> => {
  const response = await apiClient.get<KpiSummary>('/api/kpi/summary');
  return response.data;
};
