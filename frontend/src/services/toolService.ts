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

// 获取工具（别名）
export async function getById(id: string): Promise<DataTool> {
  return getTool(id);
}

// 获取工具的schema
export async function getSchema(id: string): Promise<{ schema: FormField[] }> {
  return get<{ schema: FormField[] }>(`/tools/${id}/schema`);
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

// ==================== 字段映射 API ====================

// 字段映射目标信息类型
export interface MappingTargetInfo {
  code: string;
  name: string;
  threshold?: string;
  description?: string;
  indicatorName?: string;
  indicatorCode?: string;
  elementType?: string;
  dataType?: string;
  formula?: string;
}

// 字段映射类型
export interface FieldMapping {
  id?: string;
  toolId: string;
  fieldId: string;
  mappingType: 'data_indicator' | 'element';
  targetId: string;
  createdAt?: string;
  updatedAt?: string;
  targetInfo?: MappingTargetInfo;
}

// 扩展的表单字段类型（包含映射信息）
export interface ExtendedFormField extends FormField {
  mapping?: {
    mappingType: 'data_indicator' | 'element';
    targetId: string;
    targetInfo?: MappingTargetInfo;
  } | null;
}

// 完整表单schema响应类型
export interface FullSchemaResponse {
  id: string;
  name: string;
  type: string;
  target: string;
  description: string;
  status: string;
  schema: ExtendedFormField[];
  mappings: Array<{
    fieldId: string;
    mappingType: string;
    targetId: string;
  }>;
}

// 获取工具的字段映射
export async function getFieldMappings(toolId: string): Promise<FieldMapping[]> {
  return get<FieldMapping[]>(`/tools/${toolId}/field-mappings`);
}

// 保存工具的字段映射（全量更新）
export async function saveFieldMappings(
  toolId: string,
  mappings: Array<{ fieldId: string; mappingType: string; targetId: string }>
): Promise<void> {
  return put(`/tools/${toolId}/field-mappings`, { mappings });
}

// 添加单个字段映射
export async function addFieldMapping(
  toolId: string,
  fieldId: string,
  mappingType: 'data_indicator' | 'element',
  targetId: string
): Promise<{ id: string }> {
  return post<{ id: string }>(`/tools/${toolId}/field-mappings`, {
    fieldId,
    mappingType,
    targetId,
  });
}

// 删除单个字段映射
export async function deleteFieldMapping(toolId: string, fieldId: string): Promise<void> {
  return del(`/tools/${toolId}/field-mappings/${fieldId}`);
}

// 获取完整的表单schema（含字段映射信息）
export async function getFullSchema(toolId: string): Promise<FullSchemaResponse> {
  return get<FullSchemaResponse>(`/tools/${toolId}/full-schema`);
}

// ==================== 数据指标 API ====================

// 数据指标类型
export interface DataIndicator {
  id: string;
  indicatorId: string;
  code: string;
  name: string;
  threshold: string;
  description: string;
  dataSource?: string;
  indicatorName: string;
  indicatorCode: string;
  indicatorLevel: number;
  systemId: string;
  systemName: string;
  supportingMaterials?: SupportingMaterial[];
}

// 佐证资料配置类型
export interface SupportingMaterial {
  id: string;
  code: string;
  name: string;
  fileTypes: string;
  maxSize: string;
  description: string;
  required: number;
}

// 获取所有数据指标列表
export async function getDataIndicators(params?: {
  systemId?: string;
  indicatorId?: string;
  keyword?: string;
}): Promise<DataIndicator[]> {
  return get<DataIndicator[]>('/data-indicators', params as Record<string, string>);
}

// 获取单个数据指标详情（含佐证资料配置）
export async function getDataIndicator(id: string): Promise<DataIndicator> {
  return get<DataIndicator>(`/data-indicators/${id}`);
}

// ==================== 要素查询 API ====================

// 扩展的要素类型（含库名称）
export interface ElementWithLibrary extends Element {
  libraryId: string;
  libraryName: string;
}

// 获取所有要素列表
export async function getElements(params?: {
  libraryId?: string;
  elementType?: string;
  keyword?: string;
}): Promise<ElementWithLibrary[]> {
  return get<ElementWithLibrary[]>('/elements', params as Record<string, string>);
}
