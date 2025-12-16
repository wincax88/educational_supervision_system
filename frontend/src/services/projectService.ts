// 项目服务

import { get, post, put, del } from './api';

// 项目类型
export interface Project {
  id: string;
  name: string;
  keywords?: string | string[];
  description?: string;
  indicatorSystemId?: string;
  indicatorSystemName?: string;
  startDate?: string;
  endDate?: string;
  status: '配置中' | '填报中' | '评审中' | '已中止' | '已完成';
  isPublished?: boolean;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

// 数据指标映射信息
export interface DataIndicatorMapping {
  id: string;
  code: string;
  name: string;
  threshold?: string;
  description?: string;
  indicatorId: string;
  indicatorCode: string;
  indicatorName: string;
  mapping: {
    toolId: string;
    toolName: string;
    fieldId: string;
    fieldLabel: string;
  } | null;
  isMapped: boolean;
}

// 指标映射汇总响应
export interface IndicatorMappingSummary {
  project: {
    id: string;
    name: string;
    indicatorSystemId: string;
    indicatorSystemName: string;
  };
  dataIndicators: DataIndicatorMapping[];
  stats: {
    total: number;
    mapped: number;
    unmapped: number;
  };
}

// ==================== 项目 API ====================

// 获取项目列表
export async function getProjects(params?: { status?: string }): Promise<Project[]> {
  return get<Project[]>('/projects', params as Record<string, string>);
}

// 获取单个项目
export async function getById(id: string): Promise<Project> {
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

// 删除项目
export async function deleteProject(id: string): Promise<void> {
  return del(`/projects/${id}`);
}

// 更新项目状态（通用）
export async function updateStatus(id: string, status: string): Promise<void> {
  return put(`/projects/${id}/status`, { status });
}

// 启动填报（配置中 → 填报中）
export async function startProject(id: string): Promise<void> {
  return post(`/projects/${id}/start`, {});
}

// 中止项目（任意状态 → 已中止）
export async function stopProject(id: string): Promise<void> {
  return post(`/projects/${id}/stop`, {});
}

// 进入评审（填报中 → 评审中）
export async function reviewProject(id: string): Promise<void> {
  return post(`/projects/${id}/review`, {});
}

// 完成项目（评审中 → 已完成）
export async function completeProject(id: string): Promise<void> {
  return post(`/projects/${id}/complete`, {});
}

// 重新启动（已中止 → 配置中）
export async function restartProject(id: string): Promise<void> {
  return post(`/projects/${id}/restart`, {});
}

// 发布项目
export async function publishProject(id: string): Promise<void> {
  return post(`/projects/${id}/publish`, {});
}

// 取消发布项目
export async function unpublishProject(id: string): Promise<void> {
  return post(`/projects/${id}/unpublish`, {});
}

// 获取项目的指标映射汇总
export async function getIndicatorMappingSummary(projectId: string): Promise<IndicatorMappingSummary> {
  return get<IndicatorMappingSummary>(`/projects/${projectId}/indicator-mapping-summary`);
}
