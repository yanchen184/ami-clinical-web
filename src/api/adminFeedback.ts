import apiClient from './client';
import type { PaginatedResponse } from '../types';

export interface FeedbackReviewItem {
  id: number;
  patientId: string;
  patientName: string;
  aiSummaryId: string | null;
  rating: number;
  comment: string | null;
  createdAt: string;
}

export interface FeedbackSyncResult {
  processed: number;
  evolve_skill: number;
  write_example: number;
  needs_seed: number;
  ignored: number;
}

export interface FeedbackStats {
  pendingCount: number;
  threshold: number;
}

export const getFeedbackReviewList = async (
  page = 0,
  size = 20,
): Promise<PaginatedResponse<FeedbackReviewItem>> => {
  const res = await apiClient.get<PaginatedResponse<FeedbackReviewItem>>(
    '/api/admin/feedback/review',
    { params: { page, size } },
  );
  return res.data;
};

export const triggerFeedbackSync = async (): Promise<FeedbackSyncResult> => {
  const res = await apiClient.post<FeedbackSyncResult>('/api/admin/feedback/sync');
  return res.data;
};

export const getFeedbackStats = async (): Promise<FeedbackStats> => {
  const res = await apiClient.get<FeedbackStats>('/api/admin/feedback/stats');
  return res.data;
};
