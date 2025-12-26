/**
 * 项目采集工具服务
 * 管理项目级采集工具副本的 API 调用
 */

import { get, post, put, del } from './api';

// ==================== 类型定义 ====================

// 项目采集工具
export interface ProjectDataTool {
  id: string;
  projectId?: string;
  name: string;
  type?: string;  // 表单 | 问卷
  target?: string;
  description?: string;
  schema?: Record<string, unknown>;
  status: string;  // draft | published
  sortOrder: number;
  isRequired: boolean;
  requireReview: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// 字段映射
export interface ProjectFieldMapping {
  id?: string;
  toolId: string;
  fieldId: string;
  fieldLabel?: string;
  mappingType: string;  // data_indicator | element
  targetId?: string;
}

// ==================== API 调用 ====================

/**
 * 从模板复制采集工具到项目
 */
export async function copyDataToolToProject(
  projectId: string,
  toolId: string
): Promise<{ toolId: string }> {
  return post(`/projects/${projectId}/data-tools/copy`, { toolId });
}

/**
 * 批量复制采集工具到项目
 */
export async function copyDataToolsToProject(
  projectId: string,
  toolIds: string[]
): Promise<Array<{ toolId: string } | { error: string }>> {
  const result = await post<Array<{ toolId: string } | { error: string }>>(
    `/projects/${projectId}/data-tools/copy`,
    { toolIds }
  );
  return result || [];
}

/**
 * 获取项目采集工具列表
 */
export async function getProjectDataTools(
  projectId: string,
  params?: { type?: string; status?: string }
): Promise<ProjectDataTool[]> {
  const result = await get<ProjectDataTool[]>(
    `/projects/${projectId}/data-tools`,
    params as Record<string, string>
  );
  return result || [];
}

/**
 * 获取单个项目采集工具详情
 */
export async function getProjectDataTool(
  projectId: string,
  toolId: string
): Promise<ProjectDataTool | null> {
  return get<ProjectDataTool | null>(`/projects/${projectId}/data-tools/${toolId}`);
}

/**
 * 更新项目采集工具
 */
export async function updateProjectDataTool(
  projectId: string,
  toolId: string,
  data: Partial<Pick<ProjectDataTool, 'name' | 'type' | 'target' | 'description' | 'status' | 'isRequired' | 'requireReview' | 'sortOrder'>>
): Promise<void> {
  return put(`/projects/${projectId}/data-tools/${toolId}`, data);
}

/**
 * 删除项目采集工具
 */
export async function deleteProjectDataTool(
  projectId: string,
  toolId: string
): Promise<void> {
  return del(`/projects/${projectId}/data-tools/${toolId}`);
}

/**
 * 获取采集工具的表单配置
 */
export async function getProjectDataToolSchema(
  projectId: string,
  toolId: string
): Promise<Record<string, unknown> | null> {
  return get<Record<string, unknown> | null>(
    `/projects/${projectId}/data-tools/${toolId}/schema`
  );
}

/**
 * 保存采集工具的表单配置
 */
export async function saveProjectDataToolSchema(
  projectId: string,
  toolId: string,
  schema: Record<string, unknown>
): Promise<void> {
  return put(`/projects/${projectId}/data-tools/${toolId}/schema`, { schema });
}

/**
 * 获取采集工具的字段映射
 */
export async function getProjectFieldMappings(
  projectId: string,
  toolId: string
): Promise<ProjectFieldMapping[]> {
  const result = await get<ProjectFieldMapping[]>(
    `/projects/${projectId}/data-tools/${toolId}/field-mappings`
  );
  return result || [];
}

/**
 * 保存采集工具的字段映射（全量更新）
 */
export async function saveProjectFieldMappings(
  projectId: string,
  toolId: string,
  mappings: Omit<ProjectFieldMapping, 'id'>[]
): Promise<void> {
  return put(`/projects/${projectId}/data-tools/${toolId}/field-mappings`, { mappings });
}

/**
 * 调整工具排序
 */
export async function reorderProjectDataTools(
  projectId: string,
  toolIds: string[]
): Promise<void> {
  return put(`/projects/${projectId}/data-tools/order`, { toolIds });
}

/**
 * 发布采集工具
 */
export async function publishProjectDataTool(
  projectId: string,
  toolId: string
): Promise<void> {
  return post(`/projects/${projectId}/data-tools/${toolId}/publish`, {});
}

/**
 * 取消发布采集工具
 */
export async function unpublishProjectDataTool(
  projectId: string,
  toolId: string
): Promise<void> {
  return post(`/projects/${projectId}/data-tools/${toolId}/unpublish`, {});
}
