// 项目服务

import { get, post, put, del } from './api';

// 项目类型
export interface Project {
  id: string;
  name: string;
  keywords?: string;
  description?: string;
  indicatorSystemId?: string;
  startDate?: string;
  endDate?: string;
  status: '配置中' | '填报中' | '评审中' | '已中止' | '已完成';
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
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

// 更新项目状态
export async function updateStatus(id: string, status: string): Promise<void> {
  return put(`/projects/${id}/status`, { status });
}
