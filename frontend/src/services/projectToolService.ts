// 项目-采集工具关联服务

import { get, post, put, del } from './api';

// 项目工具关联类型
export interface ProjectTool {
  id: string;
  projectId: string;
  toolId: string;
  sortOrder: number;
  isRequired: number;
  createdAt: string;
  toolName: string;
  toolType: '表单' | '问卷';
  toolTarget: string;
  toolDescription: string;
  toolStatus: 'published' | 'editing' | 'draft';
}

// 可用工具类型（未关联的已发布工具）
export interface AvailableTool {
  id: string;
  name: string;
  type: '表单' | '问卷';
  target: string;
  description: string;
  status: string;
  createdBy: string;
  createdAt: string;
}

// ==================== 项目工具关联 API ====================

// 获取项目关联的采集工具列表
export async function getProjectTools(projectId: string): Promise<ProjectTool[]> {
  return get<ProjectTool[]>(`/projects/${projectId}/tools`);
}

// 关联采集工具到项目
export async function addProjectTool(
  projectId: string,
  toolId: string,
  isRequired: boolean = true
): Promise<{ id: string }> {
  return post<{ id: string }>(`/projects/${projectId}/tools`, { toolId, isRequired });
}

// 批量关联采集工具到项目
export async function batchAddProjectTools(
  projectId: string,
  toolIds: string[]
): Promise<void> {
  return post(`/projects/${projectId}/tools/batch`, { toolIds });
}

// 移除项目与工具的关联
export async function removeProjectTool(projectId: string, toolId: string): Promise<void> {
  return del(`/projects/${projectId}/tools/${toolId}`);
}

// 更新关联属性（是否必填）
export async function updateProjectTool(
  projectId: string,
  toolId: string,
  isRequired: boolean
): Promise<void> {
  return put(`/projects/${projectId}/tools/${toolId}`, { isRequired });
}

// 调整工具排序
export async function updateProjectToolsOrder(
  projectId: string,
  toolIds: string[]
): Promise<void> {
  return put(`/projects/${projectId}/tools/order`, { toolIds });
}

// 获取项目可用的采集工具（未关联的已发布工具）
export async function getAvailableTools(projectId: string): Promise<AvailableTool[]> {
  return get<AvailableTool[]>(`/projects/${projectId}/available-tools`);
}
