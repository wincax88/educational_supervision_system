// 佐证资料服务

import { get, post, del } from './api';

// 佐证资料类型
export interface SubmissionMaterial {
  id: string;
  submissionId: string;
  materialConfigId?: string;
  indicatorId?: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  fileType: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  // 关联信息
  materialCode?: string;
  materialName?: string;
  allowedTypes?: string;
  maxSize?: string;
}

// 佐证资料配置类型
export interface MaterialConfig {
  id: string;
  code: string;
  name: string;
  fileTypes: string;
  maxSize: string;
  description?: string;
  required: number;
}

// 按指标分组的佐证资料要求
export interface MaterialRequirementGroup {
  indicatorId: string;
  indicatorName: string;
  indicatorCode: string;
  materials: MaterialConfig[];
}

// 上传结果
export interface UploadResult {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
}

// ==================== 佐证资料 API ====================

// 获取填报的佐证资料列表
export async function getMaterials(submissionId: string): Promise<SubmissionMaterial[]> {
  return get<SubmissionMaterial[]>(`/submissions/${submissionId}/materials`);
}

// 上传佐证资料
export async function uploadMaterial(
  submissionId: string,
  file: File,
  options?: {
    materialConfigId?: string;
    indicatorId?: string;
    description?: string;
  }
): Promise<UploadResult> {
  const formData = new FormData();
  formData.append('file', file);
  if (options?.materialConfigId) {
    formData.append('materialConfigId', options.materialConfigId);
  }
  if (options?.indicatorId) {
    formData.append('indicatorId', options.indicatorId);
  }
  if (options?.description) {
    formData.append('description', options.description);
  }

  const response = await fetch(`/api/submissions/${submissionId}/materials`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || '上传失败');
  }

  const result = await response.json();
  if (result.code !== 0) {
    throw new Error(result.message || '上传失败');
  }

  return result.data;
}

// 删除佐证资料
export async function deleteMaterial(materialId: string): Promise<void> {
  return del(`/materials/${materialId}`);
}

// 获取下载链接
export function getDownloadUrl(materialId: string): string {
  return `/api/materials/${materialId}/download`;
}

// 获取数据指标的佐证资料要求
export async function getMaterialRequirements(indicatorId: string): Promise<MaterialConfig[]> {
  return get<MaterialConfig[]>(`/data-indicators/${indicatorId}/material-requirements`);
}

// 获取工具表单的佐证资料要求
export async function getToolMaterialRequirements(toolId: string): Promise<MaterialRequirementGroup[]> {
  return get<MaterialRequirementGroup[]>(`/tools/${toolId}/material-requirements`);
}

// 格式化文件大小
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 获取文件图标类型
export function getFileIconType(fileType: string): string {
  if (fileType.includes('image')) return 'image';
  if (fileType.includes('pdf')) return 'pdf';
  if (fileType.includes('word') || fileType.includes('document')) return 'word';
  if (fileType.includes('excel') || fileType.includes('spreadsheet')) return 'excel';
  if (fileType.includes('powerpoint') || fileType.includes('presentation')) return 'ppt';
  if (fileType.includes('zip') || fileType.includes('rar') || fileType.includes('7z')) return 'zip';
  return 'file';
}

// 验证文件类型
export function validateFileType(file: File, allowedTypes: string): boolean {
  if (!allowedTypes || allowedTypes === '*') return true;

  const types = allowedTypes.split(',').map(t => t.trim().toLowerCase());
  const fileExt = file.name.split('.').pop()?.toLowerCase() || '';

  return types.includes(fileExt) || types.includes('*');
}

// 验证文件大小
export function validateFileSize(file: File, maxSize: string): boolean {
  if (!maxSize) return true;

  const match = maxSize.match(/(\d+)(MB|KB|GB)?/i);
  if (!match) return true;

  let maxBytes = parseInt(match[1]);
  const unit = (match[2] || 'MB').toUpperCase();

  if (unit === 'KB') maxBytes *= 1024;
  else if (unit === 'MB') maxBytes *= 1024 * 1024;
  else if (unit === 'GB') maxBytes *= 1024 * 1024 * 1024;

  return file.size <= maxBytes;
}
