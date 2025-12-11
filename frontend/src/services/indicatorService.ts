// 指标体系相关API服务

import { get, post, put, del } from './api';

// 类型定义
export interface IndicatorSystem {
  id: string;
  name: string;
  type: '达标类' | '评分类';
  target: string;
  tags: string[];
  description: string;
  indicatorCount: number;
  attachments: { name: string; size: string }[];
  status: 'published' | 'editing' | 'draft';
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
}

export interface DataIndicator {
  id: string;
  code: string;
  name: string;
  threshold: string;
  description: string;
  thresholdType?: 'single' | 'range'; // 达标阈值类型：单值比较 | 区间
  precision?: number; // 精确位数
  targetType?: string; // 适用对象类型，如"幼儿园"
}

export interface SupportingMaterial {
  id: string;
  code: string;
  name: string;
  fileTypes: string;
  maxSize: string;
  description: string;
  required?: boolean;
  targetType?: string; // 适用对象类型，如"幼儿园"
}

export interface Indicator {
  id: string;
  code: string;
  name: string;
  description: string;
  level: number;
  isLeaf: boolean;
  weight?: number;
  sortOrder?: number;
  dataIndicators?: DataIndicator[];
  supportingMaterials?: SupportingMaterial[];
  children?: Indicator[];
}

// 获取指标体系列表
export async function getIndicatorSystems(): Promise<IndicatorSystem[]> {
  return get<IndicatorSystem[]>('/indicator-systems');
}

// 获取单个指标体系
export async function getIndicatorSystem(id: string): Promise<IndicatorSystem> {
  return get<IndicatorSystem>(`/indicator-systems/${id}`);
}

// 创建指标体系
export async function createIndicatorSystem(data: Partial<IndicatorSystem>): Promise<{ id: string }> {
  return post<{ id: string }>('/indicator-systems', data);
}

// 更新指标体系
export async function updateIndicatorSystem(id: string, data: Partial<IndicatorSystem>): Promise<void> {
  return put(`/indicator-systems/${id}`, data);
}

// 删除指标体系
export async function deleteIndicatorSystem(id: string): Promise<void> {
  return del(`/indicator-systems/${id}`);
}

// 获取指标树
export async function getIndicatorTree(systemId: string): Promise<Indicator[]> {
  return get<Indicator[]>(`/indicator-systems/${systemId}/tree`);
}

// 保存指标树
export async function saveIndicatorTree(systemId: string, tree: Indicator[]): Promise<void> {
  return put(`/indicator-systems/${systemId}/tree`, { tree });
}

// 添加指标节点
export async function addIndicator(
  systemId: string,
  data: {
    parentId?: string;
    code: string;
    name: string;
    description?: string;
    level: number;
    isLeaf: boolean;
  }
): Promise<{ id: string }> {
  return post<{ id: string }>(`/indicator-systems/${systemId}/indicators`, data);
}

// 更新指标节点
export async function updateIndicator(
  systemId: string,
  indicatorId: string,
  data: Partial<Indicator>
): Promise<void> {
  return put(`/indicator-systems/${systemId}/indicators/${indicatorId}`, data);
}

// 删除指标节点
export async function deleteIndicator(systemId: string, indicatorId: string): Promise<void> {
  return del(`/indicator-systems/${systemId}/indicators/${indicatorId}`);
}
