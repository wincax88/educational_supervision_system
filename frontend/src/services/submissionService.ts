// 填报和项目相关API服务

import { get, post, put, del } from './api';
import { FormField } from './toolService';

// 项目类型
export interface Project {
  id: string;
  name: string;
  keywords: string[];
  description: string;
  indicatorSystemId?: string;
  indicatorSystemName?: string;
  startDate: string;
  endDate: string;
  status: '配置中' | '填报中' | '评审中' | '已中止' | '已完成';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// 填报记录类型
export interface Submission {
  id: string;
  projectId: string;
  projectName?: string;
  formId: string;
  formName?: string;
  submitterId?: string;
  submitterName?: string;
  submitterOrg?: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  data: Record<string, unknown>;
  schema?: FormField[];
  rejectReason?: string;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  approvedAt?: string;
}

// 统计类型
export interface SubmissionStats {
  total: number;
  draft: number;
  submitted: number;
  approved: number;
  rejected: number;
}

// ==================== 项目 API ====================

// 获取项目列表
export async function getProjects(params?: { status?: string; year?: string }): Promise<Project[]> {
  return get<Project[]>('/projects', params as Record<string, string>);
}

// 获取单个项目
export async function getProject(id: string): Promise<Project> {
  return get<Project>(`/projects/${id}`);
}

// 创建项目
export async function createProject(data: Partial<Project>): Promise<{ id: string }> {
  return post<{ id: string }>('/projects', data);
}

// 更新项目
export async function updateProject(id: string, data: Partial<Project>): Promise<void> {
  return put(`/projects/${id}`, data);
}

// 启动填报
export async function startProject(id: string): Promise<void> {
  return post(`/projects/${id}/start`);
}

// ==================== 填报 API ====================

// 获取填报记录列表
export async function getSubmissions(params?: {
  projectId?: string;
  formId?: string;
  status?: string;
  submitterOrg?: string;
}): Promise<Submission[]> {
  return get<Submission[]>('/submissions', params as Record<string, string>);
}

// 获取项目下的填报记录
export async function getProjectSubmissions(projectId: string): Promise<Submission[]> {
  return get<Submission[]>(`/projects/${projectId}/submissions`);
}

// 获取单个填报记录（含数据和schema）
export async function getSubmission(id: string): Promise<Submission> {
  return get<Submission>(`/submissions/${id}`);
}

// 创建填报记录
export async function createSubmission(data: {
  projectId: string;
  formId: string;
  submitterId?: string;
  submitterName?: string;
  submitterOrg?: string;
  data?: Record<string, unknown>;
}): Promise<{ id: string }> {
  return post<{ id: string }>('/submissions', data);
}

// 更新填报数据
export async function updateSubmission(
  id: string,
  data: {
    data?: Record<string, unknown>;
    submitterName?: string;
    submitterOrg?: string;
  }
): Promise<void> {
  return put(`/submissions/${id}`, data);
}

// 提交填报
export async function submitSubmission(id: string): Promise<void> {
  return post(`/submissions/${id}/submit`);
}

// 审核通过
export async function approveSubmission(id: string): Promise<void> {
  return post(`/submissions/${id}/approve`);
}

// 审核驳回
export async function rejectSubmission(id: string, reason?: string): Promise<void> {
  return post(`/submissions/${id}/reject`, { reason });
}

// 退回修改
export async function reviseSubmission(id: string): Promise<void> {
  return post(`/submissions/${id}/revise`);
}

// 删除填报记录
export async function deleteSubmission(id: string): Promise<void> {
  return del(`/submissions/${id}`);
}

// 获取项目填报统计
export async function getProjectStats(projectId: string): Promise<SubmissionStats> {
  return get<SubmissionStats>(`/projects/${projectId}/stats`);
}
