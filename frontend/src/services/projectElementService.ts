/**
 * 项目要素服务
 * 管理项目级要素库副本的 API 调用
 */

import { get, post, put, del } from './api';

// ==================== 类型定义 ====================

// 项目要素库
export interface ProjectElementLibrary {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  elementCount: number;
  createdAt?: string;
  updatedAt?: string;
}

// 项目要素
export interface ProjectElement {
  id: string;
  libraryId: string;
  code?: string;
  name: string;
  elementType?: string;  // 基础要素 | 派生要素
  dataType?: string;
  toolId?: string;
  fieldId?: string;
  fieldLabel?: string;
  formula?: string;
  collectionLevel?: string;  // school | district | auto
  calculationLevel?: string; // school | district
  dataSource?: string;
  aggregation?: {
    enabled?: boolean;
    method?: string;
    scope?: string;
    overwrite?: boolean;
  };
  sortOrder: number;
}

// ==================== API 调用 ====================

/**
 * 从模板复制要素库到项目
 */
export async function copyElementLibraryToProject(
  projectId: string,
  elementLibraryId: string
): Promise<{ libraryId: string }> {
  return post(`/projects/${projectId}/element-library/copy`, { elementLibraryId });
}

/**
 * 获取项目要素库
 */
export async function getProjectElementLibrary(
  projectId: string
): Promise<ProjectElementLibrary | null> {
  return get<ProjectElementLibrary | null>(`/projects/${projectId}/element-library`);
}

/**
 * 更新项目要素库基本信息
 */
export async function updateProjectElementLibrary(
  projectId: string,
  data: Partial<Pick<ProjectElementLibrary, 'name' | 'description'>>
): Promise<void> {
  return put(`/projects/${projectId}/element-library`, data);
}

/**
 * 删除项目要素库
 */
export async function deleteProjectElementLibrary(projectId: string): Promise<void> {
  return del(`/projects/${projectId}/element-library`);
}

/**
 * 获取项目要素列表
 */
export async function getProjectElements(
  projectId: string,
  params?: { elementType?: string; keyword?: string }
): Promise<ProjectElement[]> {
  const result = await get<ProjectElement[]>(
    `/projects/${projectId}/elements`,
    params as Record<string, string>
  );
  return result || [];
}

/**
 * 添加要素
 */
export async function addProjectElement(
  projectId: string,
  data: {
    code?: string;
    name: string;
    elementType?: string;
    dataType?: string;
    toolId?: string;
    fieldId?: string;
    fieldLabel?: string;
    formula?: string;
    collectionLevel?: string;
    calculationLevel?: string;
    dataSource?: string;
    aggregation?: ProjectElement['aggregation'];
  }
): Promise<{ id: string }> {
  return post(`/projects/${projectId}/elements`, data);
}

/**
 * 更新要素
 */
export async function updateProjectElement(
  projectId: string,
  elementId: string,
  data: Partial<Omit<ProjectElement, 'id' | 'libraryId' | 'sortOrder'>>
): Promise<void> {
  return put(`/projects/${projectId}/elements/${elementId}`, data);
}

/**
 * 删除要素
 */
export async function deleteProjectElement(
  projectId: string,
  elementId: string
): Promise<void> {
  return del(`/projects/${projectId}/elements/${elementId}`);
}

/**
 * 批量导入要素
 */
export async function importProjectElements(
  projectId: string,
  elements: Array<Omit<ProjectElement, 'id' | 'libraryId' | 'sortOrder'>>,
  mode: 'append' | 'replace' = 'append'
): Promise<{ inserted: number }> {
  return post(`/projects/${projectId}/elements/import`, { elements, mode });
}
