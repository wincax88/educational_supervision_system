/**
 * 佐证资料上传组件
 * 按指标分组显示佐证资料要求，支持上传、预览、下载、删除
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Upload,
  Button,
  List,
  Tag,
  Tooltip,
  Modal,
  message,
  Progress,
  Spin,
  Empty,
} from 'antd';
import {
  UploadOutlined,
  DeleteOutlined,
  DownloadOutlined,
  FileOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  FileExcelOutlined,
  FilePptOutlined,
  FileZipOutlined,
  FileImageOutlined,
  EyeOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import * as materialService from '../../services/materialService';
import type {
  SubmissionMaterial,
  MaterialRequirementGroup,
  MaterialConfig,
} from '../../services/materialService';
import styles from './index.module.css';

interface MaterialUploaderProps {
  submissionId: string;
  toolId?: string;
  onUploadSuccess?: () => void;
  readonly?: boolean;
}

// 获取文件图标
const getFileIcon = (fileType: string) => {
  const iconType = materialService.getFileIconType(fileType);
  switch (iconType) {
    case 'pdf':
      return <FilePdfOutlined className={styles.fileIconPdf} />;
    case 'word':
      return <FileWordOutlined className={styles.fileIconWord} />;
    case 'excel':
      return <FileExcelOutlined className={styles.fileIconExcel} />;
    case 'ppt':
      return <FilePptOutlined className={styles.fileIconPpt} />;
    case 'zip':
      return <FileZipOutlined className={styles.fileIconZip} />;
    case 'image':
      return <FileImageOutlined className={styles.fileIconImage} />;
    default:
      return <FileOutlined className={styles.fileIconDefault} />;
  }
};

const MaterialUploader: React.FC<MaterialUploaderProps> = ({
  submissionId,
  toolId,
  onUploadSuccess,
  readonly = false,
}) => {
  const [loading, setLoading] = useState(false);
  const [materials, setMaterials] = useState<SubmissionMaterial[]>([]);
  const [requirements, setRequirements] = useState<MaterialRequirementGroup[]>([]);
  const [uploadingMap, setUploadingMap] = useState<Record<string, number>>({});

  // 加载已上传的资料
  const loadMaterials = useCallback(async () => {
    if (!submissionId) return;
    try {
      const data = await materialService.getMaterials(submissionId);
      setMaterials(data);
    } catch (error) {
      console.error('加载佐证资料失败:', error);
    }
  }, [submissionId]);

  // 加载资料要求
  const loadRequirements = useCallback(async () => {
    if (!toolId) return;
    try {
      const data = await materialService.getToolMaterialRequirements(toolId);
      setRequirements(data);
    } catch (error) {
      console.error('加载资料要求失败:', error);
    }
  }, [toolId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadMaterials(), loadRequirements()]).finally(() => {
      setLoading(false);
    });
  }, [loadMaterials, loadRequirements]);

  // 上传文件
  const handleUpload = async (
    file: File,
    config?: MaterialConfig,
    indicatorId?: string
  ) => {
    // 验证文件类型
    if (config && !materialService.validateFileType(file, config.fileTypes)) {
      message.error(`不支持的文件类型，允许: ${config.fileTypes}`);
      return false;
    }

    // 验证文件大小
    if (config && !materialService.validateFileSize(file, config.maxSize)) {
      message.error(`文件大小超过限制，最大: ${config.maxSize}`);
      return false;
    }

    const uploadKey = config?.id || 'default';
    setUploadingMap((prev) => ({ ...prev, [uploadKey]: 0 }));

    try {
      await materialService.uploadMaterial(submissionId, file, {
        materialConfigId: config?.id,
        indicatorId,
      });

      setUploadingMap((prev) => ({ ...prev, [uploadKey]: 100 }));
      message.success('上传成功');

      // 刷新资料列表
      await loadMaterials();
      onUploadSuccess?.();

      // 清除进度
      setTimeout(() => {
        setUploadingMap((prev) => {
          const newMap = { ...prev };
          delete newMap[uploadKey];
          return newMap;
        });
      }, 500);

      return true;
    } catch (error: any) {
      message.error(error.message || '上传失败');
      setUploadingMap((prev) => {
        const newMap = { ...prev };
        delete newMap[uploadKey];
        return newMap;
      });
      return false;
    }
  };

  // 删除资料
  const handleDelete = (material: SubmissionMaterial) => {
    Modal.confirm({
      title: '确认删除',
      icon: <ExclamationCircleOutlined />,
      content: `确定要删除文件 "${material.fileName}" 吗？`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await materialService.deleteMaterial(material.id);
          message.success('删除成功');
          await loadMaterials();
        } catch (error: any) {
          message.error(error.message || '删除失败');
        }
      },
    });
  };

  // 下载资料
  const handleDownload = (material: SubmissionMaterial) => {
    const url = materialService.getDownloadUrl(material.id);
    window.open(url, '_blank');
  };

  // 预览图片
  const handlePreview = (material: SubmissionMaterial) => {
    if (material.fileType.includes('image')) {
      Modal.info({
        title: material.fileName,
        width: 800,
        content: (
          <div className={styles.previewContainer}>
            <img
              src={materialService.getDownloadUrl(material.id)}
              alt={material.fileName}
              className={styles.previewImage}
            />
          </div>
        ),
        okText: '关闭',
      });
    } else {
      // 非图片文件直接下载
      handleDownload(material);
    }
  };

  // 获取某个配置下已上传的资料
  const getMaterialsByConfig = (configId: string) => {
    return materials.filter((m) => m.materialConfigId === configId);
  };

  // 获取某个指标下已上传的资料（未关联配置的）
  const getMaterialsByIndicator = (indicatorId: string) => {
    return materials.filter(
      (m) => m.indicatorId === indicatorId && !m.materialConfigId
    );
  };

  // 渲染资料项
  const renderMaterialItem = (material: SubmissionMaterial) => (
    <div key={material.id} className={styles.materialItem}>
      <div className={styles.materialIcon}>{getFileIcon(material.fileType)}</div>
      <div className={styles.materialInfo}>
        <div className={styles.materialName}>{material.fileName}</div>
        <div className={styles.materialMeta}>
          {materialService.formatFileSize(material.fileSize)}
          <span className={styles.separator}>|</span>
          {material.createdAt}
        </div>
      </div>
      <div className={styles.materialActions}>
        {material.fileType.includes('image') && (
          <Tooltip title="预览">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => handlePreview(material)}
            />
          </Tooltip>
        )}
        <Tooltip title="下载">
          <Button
            type="text"
            icon={<DownloadOutlined />}
            onClick={() => handleDownload(material)}
          />
        </Tooltip>
        {!readonly && (
          <Tooltip title="删除">
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(material)}
            />
          </Tooltip>
        )}
      </div>
    </div>
  );

  // 渲染上传区域
  const renderUploadArea = (config?: MaterialConfig, indicatorId?: string) => {
    const uploadKey = config?.id || 'default';
    const isUploading = uploadingMap[uploadKey] !== undefined;

    return (
      <div className={styles.uploadArea}>
        <Upload
          accept={config?.fileTypes?.split(',').map((t) => `.${t.trim()}`).join(',')}
          showUploadList={false}
          beforeUpload={(file) => {
            handleUpload(file, config, indicatorId);
            return false;
          }}
          disabled={readonly || isUploading}
        >
          <Button
            icon={<UploadOutlined />}
            loading={isUploading}
            disabled={readonly}
          >
            {isUploading ? '上传中...' : '上传文件'}
          </Button>
        </Upload>
        {config && (
          <div className={styles.uploadHint}>
            允许类型: {config.fileTypes} | 最大: {config.maxSize}
          </div>
        )}
        {isUploading && (
          <Progress
            percent={uploadingMap[uploadKey]}
            size="small"
            className={styles.uploadProgress}
          />
        )}
      </div>
    );
  };

  // 渲染配置项卡片
  const renderConfigCard = (config: MaterialConfig, indicatorId: string) => {
    const uploadedMaterials = getMaterialsByConfig(config.id);
    const isRequired = config.required === 1;

    return (
      <div key={config.id} className={styles.configCard}>
        <div className={styles.configHeader}>
          <span className={styles.configCode}>{config.code}</span>
          <span className={styles.configName}>{config.name}</span>
          {isRequired ? (
            <Tag color="red">必传</Tag>
          ) : (
            <Tag>可选</Tag>
          )}
        </div>
        {config.description && (
          <div className={styles.configDesc}>{config.description}</div>
        )}

        {/* 已上传的文件 */}
        {uploadedMaterials.length > 0 && (
          <div className={styles.materialList}>
            {uploadedMaterials.map(renderMaterialItem)}
          </div>
        )}

        {/* 上传区域 */}
        {!readonly && renderUploadArea(config, indicatorId)}
      </div>
    );
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <Spin tip="加载中..." />
      </div>
    );
  }

  // 如果没有资料要求，显示通用上传区
  if (requirements.length === 0) {
    return (
      <Card title="佐证资料" className={styles.materialUploader}>
        {materials.length > 0 ? (
          <div className={styles.materialList}>
            {materials.map(renderMaterialItem)}
          </div>
        ) : (
          <Empty description="暂无佐证资料" />
        )}
        {!readonly && renderUploadArea()}
      </Card>
    );
  }

  return (
    <div className={styles.materialUploader}>
      {requirements.map((group) => (
        <Card
          key={group.indicatorId}
          title={
            <div className={styles.groupHeader}>
              <Tag color="blue">{group.indicatorCode}</Tag>
              <span>{group.indicatorName}</span>
            </div>
          }
          className={styles.groupCard}
        >
          {group.materials.map((config) =>
            renderConfigCard(config, group.indicatorId)
          )}

          {/* 该指标下其他未关联配置的资料 */}
          {getMaterialsByIndicator(group.indicatorId).length > 0 && (
            <div className={styles.otherMaterials}>
              <div className={styles.otherMaterialsTitle}>其他资料</div>
              {getMaterialsByIndicator(group.indicatorId).map(renderMaterialItem)}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
};

export default MaterialUploader;
