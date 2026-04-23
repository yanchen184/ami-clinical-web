import apiClient from './client';
import type { AlertRule, AlertRuleUpdateRequest } from '../types';

export const getAlertRules = async (): Promise<AlertRule[]> => {
  const response = await apiClient.get<AlertRule[]>('/api/alert-rules');
  return response.data;
};

export const updateAlertRule = async (
  id: number,
  data: AlertRuleUpdateRequest,
): Promise<AlertRule> => {
  const response = await apiClient.put<AlertRule>(`/api/alert-rules/${id}`, data);
  return response.data;
};
