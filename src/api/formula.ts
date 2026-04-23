import apiClient from './client';
import type {
  Formula,
  FormulaCombo,
  FormulaItem,
  FormulaItemRequest,
  FormulaRequest,
  PaginatedResponse,
} from '../types';

export const getFormulas = async (params?: {
  keyword?: string;
  page?: number;
  size?: number;
}): Promise<PaginatedResponse<Formula>> => {
  const response = await apiClient.get<PaginatedResponse<Formula>>('/api/formulas', {
    params: { page: params?.page ?? 0, size: params?.size ?? 20, keyword: params?.keyword },
  });
  return response.data;
};

export const getFormula = async (id: number): Promise<Formula> => {
  const response = await apiClient.get<Formula>(`/api/formulas/${id}`);
  return response.data;
};

export const createFormula = async (data: FormulaRequest): Promise<Formula> => {
  const response = await apiClient.post<Formula>('/api/formulas', data);
  return response.data;
};

export const updateFormula = async (id: number, data: FormulaRequest): Promise<Formula> => {
  const response = await apiClient.put<Formula>(`/api/formulas/${id}`, data);
  return response.data;
};

export const deleteFormula = async (id: number): Promise<void> => {
  await apiClient.delete(`/api/formulas/${id}`);
};

export const addFormulaItem = async (
  formulaId: number,
  data: FormulaItemRequest,
): Promise<FormulaItem> => {
  const response = await apiClient.post<FormulaItem>(`/api/formulas/${formulaId}/items`, data);
  return response.data;
};

export const updateFormulaItem = async (
  formulaId: number,
  itemId: number,
  data: Partial<FormulaItemRequest>,
): Promise<FormulaItem> => {
  const response = await apiClient.put<FormulaItem>(
    `/api/formulas/${formulaId}/items/${itemId}`,
    data,
  );
  return response.data;
};

export const deleteFormulaItem = async (formulaId: number, itemId: number): Promise<void> => {
  await apiClient.delete(`/api/formulas/${formulaId}/items/${itemId}`);
};

export const getFormulaCombos = async (params?: {
  keyword?: string;
  minReduction?: number;
  maxReduction?: number;
  page?: number;
  size?: number;
}): Promise<PaginatedResponse<FormulaCombo>> => {
  const response = await apiClient.get<PaginatedResponse<FormulaCombo>>('/api/formula-combos', {
    params: {
      page: params?.page ?? 0,
      size: params?.size ?? 20,
      keyword: params?.keyword,
      minReduction: params?.minReduction,
      maxReduction: params?.maxReduction,
    },
  });
  return response.data;
};
