// 采集工具和要素库相关API服务

import { get, post, put, del } from './api';

// 采集工具类型
export interface DataTool {
  id: string;
  name: string;
  type: '表单' | '问卷';
  target: string;
  description: string;
  schema?: FormField[];
  status: 'published' | 'editing' | 'draft';
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
}

// 表单字段类型
export type ControlType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'select'
  | 'checkbox'
  | 'radio'
  | 'date'
  | 'time'
  | 'file'
  | 'switch'
  | 'divider'
  | 'group'
  | 'dynamicList';

export interface FormField {
  id: string;
  type: ControlType;
  label: string;
  placeholder?: string;
  helpText?: string;
  width: '25%' | '50%' | '75%' | '100%';
  required: boolean;
  options?: { label: string; value: string }[];
  optionLayout?: 'horizontal' | 'vertical';
  conditionalDisplay?: boolean;
  decimalPlaces?: '整数' | '1位小数' | '2位小数';
  minValue?: string;
  maxValue?: string;
  unit?: string;
  children?: FormField[];
}

// 要素库类型
export interface ElementLibrary {
  id: string;
  name: string;
  description: string;
  elementCount: number;
  status: 'published' | 'draft';
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
  elements?: Element[];
}

// 要素类型
export interface Element {
  id: string;
  code: string;
  name: string;
  elementType: '基础要素' | '派生要素';
  dataType: '文本' | '数字' | '日期' | '时间' | '逻辑' | '数组' | '文件';
  formula?: string;
}

// ==================== 采集工具 API ====================

// 获取采集工具列表
export async function getTools(params?: { status?: string; type?: string }): Promise<DataTool[]> {
  return get<DataTool[]>('/tools', params as Record<string, string>);
}

// 获取单个采集工具（含schema）
export async function getTool(id: string): Promise<DataTool> {
  return get<DataTool>(`/tools/${id}`);
}

// 创建采集工具
export async function createTool(data: Partial<DataTool>): Promise<{ id: string }> {
  return post<{ id: string }>('/tools', data);
}

// 更新采集工具
export async function updateTool(id: string, data: Partial<DataTool>): Promise<void> {
  return put(`/tools/${id}`, data);
}

// 保存表单schema
export async function saveToolSchema(id: string, schema: FormField[]): Promise<void> {
  return put(`/tools/${id}/schema`, { schema });
}

// 发布工具
export async function publishTool(id: string): Promise<void> {
  return post(`/tools/${id}/publish`);
}

// 取消发布
export async function unpublishTool(id: string): Promise<void> {
  return post(`/tools/${id}/unpublish`);
}

// 删除工具
export async function deleteTool(id: string): Promise<void> {
  return del(`/tools/${id}`);
}

// ==================== 要素库 API ====================

// 获取要素库列表
export async function getElementLibraries(): Promise<ElementLibrary[]> {
  return get<ElementLibrary[]>('/element-libraries');
}

// 获取单个要素库（含要素）
export async function getElementLibrary(id: string): Promise<ElementLibrary> {
  return get<ElementLibrary>(`/element-libraries/${id}`);
}

// 创建要素库
export async function createElementLibrary(data: Partial<ElementLibrary>): Promise<{ id: string }> {
  return post<{ id: string }>('/element-libraries', data);
}

// 更新要素库
export async function updateElementLibrary(id: string, data: Partial<ElementLibrary>): Promise<void> {
  return put(`/element-libraries/${id}`, data);
}

// 删除要素库
export async function deleteElementLibrary(id: string): Promise<void> {
  return del(`/element-libraries/${id}`);
}

// 添加要素
export async function addElement(libraryId: string, data: Partial<Element>): Promise<{ id: string }> {
  return post<{ id: string }>(`/element-libraries/${libraryId}/elements`, data);
}

// 更新要素
export async function updateElement(id: string, data: Partial<Element>): Promise<void> {
  return put(`/elements/${id}`, data);
}

// 删除要素
export async function deleteElement(id: string): Promise<void> {
  return del(`/elements/${id}`);
}
