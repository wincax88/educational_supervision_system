/**
 * 评估报告服务
 * 提供报告查看相关的 API 调用
 */

import { get } from './api';

// 报告列表项
export interface ReportItem {
  id: string;
  name: string;
  description?: string;
  assessmentType: string;
  status: string;
  startDate?: string;
  endDate?: string;
  createdAt?: string;
  updatedAt?: string;
  indicatorSystemName?: string;
  districtCount: number;
  approvedSubmissions: number;
  totalSubmissions: number;
}

// 报告列表响应
export interface ReportListResponse {
  list: ReportItem[];
  total: number;
  page: number;
  pageSize: number;
}

// 报告详情
export interface ReportDetail {
  project: {
    id: string;
    name: string;
    description?: string;
    assessmentType: string;
    status: string;
    startDate?: string;
    endDate?: string;
    createdAt?: string;
    updatedAt?: string;
    indicatorSystemId?: string;
    indicatorSystemName?: string;
  };
  summary: {
    totalDistricts: number;
    totalSchools: number;
    totalSubmissions: number;
    approvedSubmissions: number;
    pendingSubmissions: number;
    rejectedSubmissions: number;
  };
  districts: Array<{
    id: string;
    name: string;
    code: string;
    schoolCount: number;
    approvedCount: number;
  }>;
  indicators: Array<{
    id: string;
    name: string;
    code: string;
    parentId?: string;
    level: number;
    weight?: number;
    description?: string;
    sortOrder: number;
  }>;
  expertReviews: Array<{
    id: string;
    expertName: string;
    reviewStatus: string;
    assignedAt?: string;
    reviewedAt?: string;
  }>;
}

// 统计概览
export interface StatisticsOverview {
  projectStats: {
    totalProjects: number;
    completedProjects: number;
    reviewingProjects: number;
    fillingProjects: number;
    balancedProjects: number;
    preschoolProjects: number;
  };
  yearlyStats: Array<{
    year: number;
    count: number;
    completed: number;
  }>;
  submissionStats: {
    totalSubmissions: number;
    approvedSubmissions: number;
    pendingSubmissions: number;
    rejectedSubmissions: number;
  };
}

// 区县排名项
export interface DistrictRanking {
  id: string;
  name: string;
  code: string;
  schoolCount: number;
  submissionCount: number;
  approvedCount: number;
  approvalRate: number;
  rank: number;
}

// 查询参数
export interface ReportQueryParams {
  type?: string;
  year?: string;
  status?: string;
  keyword?: string;
  page?: string;
  pageSize?: string;
}

/**
 * 获取报告列表
 */
export async function getReportList(params?: ReportQueryParams): Promise<ReportListResponse> {
  return get<ReportListResponse>('/reports', params as Record<string, string>);
}

/**
 * 获取报告详情
 */
export async function getReportDetail(projectId: string): Promise<ReportDetail> {
  return get<ReportDetail>(`/reports/${projectId}`);
}

/**
 * 获取统计概览
 */
export async function getStatisticsOverview(): Promise<StatisticsOverview> {
  return get<StatisticsOverview>('/reports/statistics/overview');
}

/**
 * 获取区县排名
 */
export async function getDistrictRankings(projectId?: string): Promise<DistrictRanking[]> {
  const params = projectId ? { projectId } : undefined;
  return get<DistrictRanking[]>('/reports/rankings/districts', params);
}

/**
 * 导出报告（占位）
 */
export async function exportReport(projectId: string, format: 'pdf' | 'excel' = 'excel'): Promise<{ status: string; message: string }> {
  return get<{ status: string; message: string }>(`/reports/${projectId}/export`, { format });
}
