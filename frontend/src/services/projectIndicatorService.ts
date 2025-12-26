/**
 * 项目指标体系服务
 * 管理项目级指标体系副本的 API 调用
 */

import { get, post, put, del } from './api';

// ==================== 类型定义 ====================

// 项目指标体系
export interface ProjectIndicatorSystem {
  id: string;
  projectId: string;
  name: string;
  type?: string;  // 达标类 | 评分类
  target?: string;
  description?: string;
  tags?: string[];
  attachments?: string[];
  indicatorCount: number;
  createdAt?: string;
  updatedAt?: string;
}

// 项目指标
export interface ProjectIndicator {
  id: string;
  systemId: string;
  parentId?: string;
  code: string;
  name: string;
  description?: string;
  level: number;
  isLeaf: boolean;
  weight?: number;
  sortOrder: number;
  children?: ProjectIndicator[];
  dataIndicators?: ProjectDataIndicator[];
  supportingMaterials?: ProjectSupportingMaterial[];
}

// 项目数据指标
export interface ProjectDataIndicator {
  id: string;
  indicatorId: string;
  code: string;
  name: string;
  description?: string;
  dataType?: string;
  unit?: string;
  threshold?: string;
  calculationMethod?: string;
  dataSource?: string;
  collectionFrequency?: string;
  sortOrder: number;
}

// 项目佐证资料
export interface ProjectSupportingMaterial {
  id: string;
  indicatorId: string;
  code?: string;
  name: string;
  fileTypes?: string;
  maxSize?: number;
  description?: string;
  required: boolean;
  sortOrder: number;
}

// ==================== API 调用 ====================

/**
 * 从模板复制指标体系到项目
 */
export async function copyIndicatorSystemToProject(
  projectId: string,
  indicatorSystemId: string
): Promise<{ systemId: string }> {
  return post(`/projects/${projectId}/indicator-system/copy`, { indicatorSystemId });
}

/**
 * 获取项目指标体系
 */
export async function getProjectIndicatorSystem(
  projectId: string
): Promise<ProjectIndicatorSystem | null> {
  return get<ProjectIndicatorSystem | null>(`/projects/${projectId}/indicator-system`);
}

/**
 * 更新项目指标体系基本信息
 */
export async function updateProjectIndicatorSystem(
  projectId: string,
  data: Partial<Pick<ProjectIndicatorSystem, 'name' | 'type' | 'target' | 'description' | 'tags' | 'attachments'>>
): Promise<void> {
  return put(`/projects/${projectId}/indicator-system`, data);
}

/**
 * 删除项目指标体系
 */
export async function deleteProjectIndicatorSystem(projectId: string): Promise<void> {
  return del(`/projects/${projectId}/indicator-system`);
}

/**
 * 获取项目指标树
 */
export async function getProjectIndicatorTree(projectId: string): Promise<ProjectIndicator[]> {
  const result = await get<ProjectIndicator[]>(`/projects/${projectId}/indicator-system/tree`);
  return result || [];
}

/**
 * 保存项目指标树
 */
export async function saveProjectIndicatorTree(
  projectId: string,
  tree: ProjectIndicator[]
): Promise<{ indicatorCount: number }> {
  return put(`/projects/${projectId}/indicator-system/tree`, { tree });
}

/**
 * 添加指标
 */
export async function addProjectIndicator(
  projectId: string,
  data: {
    parentId?: string;
    code: string;
    name: string;
    description?: string;
    level?: number;
    isLeaf?: boolean;
    weight?: number;
  }
): Promise<{ id: string }> {
  return post(`/projects/${projectId}/indicators`, data);
}

/**
 * 更新指标
 */
export async function updateProjectIndicator(
  projectId: string,
  indicatorId: string,
  data: Partial<Pick<ProjectIndicator, 'code' | 'name' | 'description' | 'isLeaf' | 'weight'>>
): Promise<void> {
  return put(`/projects/${projectId}/indicators/${indicatorId}`, data);
}

/**
 * 删除指标（级联删除子指标和关联数据）
 */
export async function deleteProjectIndicator(
  projectId: string,
  indicatorId: string
): Promise<{ deletedCount: number }> {
  return del(`/projects/${projectId}/indicators/${indicatorId}`);
}

// ==================== 数据指标-要素关联 ====================

// 要素关联类型
export interface ProjectElementAssociation {
  id: string;
  dataIndicatorId?: string;
  supportingMaterialId?: string;
  elementId: string;
  mappingType: 'primary' | 'reference';
  description: string;
  elementCode: string;
  elementName: string;
  elementType: string;
  dataType: string;
  formula?: string;
  libraryId: string;
  libraryName: string;
}

// 数据指标及其要素关联
export interface ProjectDataIndicatorWithElements {
  id: string;
  code: string;
  name: string;
  threshold?: string;
  description?: string;
  indicatorId: string;
  indicatorCode: string;
  indicatorName: string;
  elements: ProjectElementAssociation[];
}

/**
 * 获取项目下所有数据指标及其要素关联
 */
export async function getProjectDataIndicatorElements(
  projectId: string
): Promise<ProjectDataIndicatorWithElements[]> {
  const result = await get<ProjectDataIndicatorWithElements[]>(
    `/projects/${projectId}/indicator-system/data-indicator-elements`
  );
  return result || [];
}

/**
 * 获取项目数据指标的要素关联列表
 */
export async function getProjectDataIndicatorElementsById(
  projectId: string,
  dataIndicatorId: string
): Promise<ProjectElementAssociation[]> {
  const result = await get<ProjectElementAssociation[]>(
    `/projects/${projectId}/data-indicators/${dataIndicatorId}/elements`
  );
  return result || [];
}

/**
 * 批量保存项目数据指标-要素关联
 */
export async function saveProjectDataIndicatorElements(
  projectId: string,
  dataIndicatorId: string,
  elements: Array<{ elementId: string; mappingType?: string; description?: string }>
): Promise<void> {
  return put(`/projects/${projectId}/data-indicators/${dataIndicatorId}/elements`, { elements });
}

// ==================== 佐证材料-要素关联 ====================

/**
 * 获取项目佐证材料的要素关联列表
 */
export async function getProjectSupportingMaterialElements(
  projectId: string,
  supportingMaterialId: string
): Promise<ProjectElementAssociation[]> {
  const result = await get<ProjectElementAssociation[]>(
    `/projects/${projectId}/supporting-materials/${supportingMaterialId}/elements`
  );
  return result || [];
}

/**
 * 批量保存项目佐证材料-要素关联
 */
export async function saveProjectSupportingMaterialElements(
  projectId: string,
  supportingMaterialId: string,
  elements: Array<{ elementId: string; mappingType?: string; description?: string }>
): Promise<void> {
  return put(`/projects/${projectId}/supporting-materials/${supportingMaterialId}/elements`, { elements });
}
