import apiClient from './client';
import type { NotificationLog, NotificationRequest } from '../types';

export const getNotifications = async (): Promise<NotificationLog[]> => {
  const response = await apiClient.get<NotificationLog[]>('/api/notifications');
  return response.data;
};

export const markAsRead = async (id: number): Promise<void> => {
  await apiClient.patch(`/api/notifications/${id}/read`);
};

export const sendNotification = async (data: NotificationRequest): Promise<void> => {
  await apiClient.post(`/api/patients/${data.patientId}/notify`, { content: data.content });
};
