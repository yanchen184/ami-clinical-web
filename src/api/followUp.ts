import apiClient from './client';
import type { FollowUpEvent, FollowUpEventRequest } from '../types';

export const getFollowUpEvents = async (params: {
  start: string;
  end: string;
}): Promise<FollowUpEvent[]> => {
  const response = await apiClient.get<FollowUpEvent[]>('/api/follow-ups', { params });
  return response.data;
};

export const createFollowUpEvent = async (data: FollowUpEventRequest): Promise<FollowUpEvent> => {
  const response = await apiClient.post<FollowUpEvent>('/api/follow-ups', data);
  return response.data;
};

export const updateFollowUpEvent = async (
  id: number,
  data: Partial<FollowUpEventRequest>,
): Promise<FollowUpEvent> => {
  const response = await apiClient.patch<FollowUpEvent>(`/api/follow-ups/${id}`, data);
  return response.data;
};

export const deleteFollowUpEvent = async (id: number): Promise<void> => {
  await apiClient.delete(`/api/follow-ups/${id}`);
};
