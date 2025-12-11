/**
 * 指标树查看器组件
 * 只读模式展示指标体系的树形结构
 */

import React, { useState, useEffect } from 'react';
import { Modal, Tree, Tag, Spin, Empty, Descriptions } from 'antd';
import {
  FileTextOutlined,
  FolderOutlined,
  FolderOpenOutlined,
  CheckCircleOutlined,
  FileOutlined,
} from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';
import * as indicatorService from '../../services/indicatorService';
import type { Indicator, DataIndicator, SupportingMaterial } from '../../services/indicatorService';
import styles from './index.module.css';

interface IndicatorTreeViewerProps {
  visible: boolean;
  onClose: () => void;
  systemId: string;
  systemName?: string;
}

const IndicatorTreeViewer: React.FC<IndicatorTreeViewerProps> = ({
  visible,
  onClose,
  systemId,
  systemName,
}) => {
  const [loading, setLoading] = useState(false);
  const [treeData, setTreeData] = useState<DataNode[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);

  useEffect(() => {
    if (visible && systemId) {
      loadIndicatorTree();
    }
  }, [visible, systemId]);

  const loadIndicatorTree = async () => {
    setLoading(true);
    try {
      const data = await indicatorService.getIndicatorTree(systemId);
      const nodes = convertToTreeData(data);
      setTreeData(nodes);
      // 默认展开一级指标
      const firstLevelKeys = data.map(item => item.id);
      setExpandedKeys(firstLevelKeys);
    } catch (error) {
      console.error('加载指标树失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 将指标数据转换为 Tree 组件的数据格式
  const convertToTreeData = (indicators: Indicator[]): DataNode[] => {
    return indicators.map(indicator => {
      const isLeaf = indicator.isLeaf;
      const hasDataIndicators = isLeaf && indicator.dataIndicators && indicator.dataIndicators.length > 0;
      const hasMaterials = isLeaf && indicator.supportingMaterials && indicator.supportingMaterials.length > 0;

      const children: DataNode[] = [];

      // 如果有子指标，递归转换
      if (indicator.children && indicator.children.length > 0) {
        children.push(...convertToTreeData(indicator.children));
      }

      // 如果是末级指标，添加数据指标和佐证资料节点
      if (isLeaf) {
        if (hasDataIndicators) {
          children.push({
            key: `${indicator.id}-data-indicators`,
            title: (
              <span className={styles.groupTitle}>
                <CheckCircleOutlined className={styles.groupIcon} />
                数据指标 ({indicator.dataIndicators!.length})
              </span>
            ),
            selectable: false,
            children: indicator.dataIndicators!.map(di => ({
              key: di.id,
              title: renderDataIndicator(di),
              isLeaf: true,
              selectable: false,
            })),
          });
        }

        if (hasMaterials) {
          children.push({
            key: `${indicator.id}-materials`,
            title: (
              <span className={styles.groupTitle}>
                <FileOutlined className={styles.groupIcon} />
                佐证资料 ({indicator.supportingMaterials!.length})
              </span>
            ),
            selectable: false,
            children: indicator.supportingMaterials!.map(m => ({
              key: m.id,
              title: renderMaterial(m),
              isLeaf: true,
              selectable: false,
            })),
          });
        }
      }

      return {
        key: indicator.id,
        title: renderIndicatorTitle(indicator),
        children: children.length > 0 ? children : undefined,
        isLeaf: isLeaf && !hasDataIndicators && !hasMaterials,
        selectable: false,
      };
    });
  };

  // 渲染指标标题
  const renderIndicatorTitle = (indicator: Indicator) => {
    const levelColors = ['#1890ff', '#52c41a', '#fa8c16'];
    const levelColor = levelColors[indicator.level - 1] || '#666';

    return (
      <div className={styles.indicatorTitle}>
        <Tag color={levelColor} className={styles.levelTag}>
          {indicator.level}级
        </Tag>
        <span className={styles.indicatorCode}>{indicator.code}</span>
        <span className={styles.indicatorName}>{indicator.name}</span>
        {indicator.weight && (
          <Tag className={styles.weightTag}>权重: {indicator.weight}%</Tag>
        )}
      </div>
    );
  };

  // 渲染数据指标
  const renderDataIndicator = (di: DataIndicator) => {
    return (
      <div className={styles.dataIndicatorItem}>
        <span className={styles.diCode}>{di.code}</span>
        <span className={styles.diName}>{di.name}</span>
        {di.threshold && (
          <Tag color="orange" className={styles.thresholdTag}>
            阈值: {di.threshold}
          </Tag>
        )}
      </div>
    );
  };

  // 渲染佐证资料
  const renderMaterial = (m: SupportingMaterial) => {
    return (
      <div className={styles.materialItem}>
        <span className={styles.materialCode}>{m.code}</span>
        <span className={styles.materialName}>{m.name}</span>
        {m.required && (
          <Tag color="red" className={styles.requiredTag}>必填</Tag>
        )}
      </div>
    );
  };

  // 自定义节点图标
  const renderIcon = (props: any) => {
    if (props.isLeaf) {
      return <FileTextOutlined />;
    }
    return props.expanded ? <FolderOpenOutlined /> : <FolderOutlined />;
  };

  return (
    <Modal
      title={`指标体系: ${systemName || '加载中...'}`}
      open={visible}
      onCancel={onClose}
      footer={null}
      width={900}
      className={styles.viewerModal}
    >
      {loading ? (
        <div className={styles.loadingContainer}>
          <Spin size="large" tip="加载指标树..." />
        </div>
      ) : treeData.length === 0 ? (
        <Empty description="暂无指标数据" />
      ) : (
        <div className={styles.treeContainer}>
          <Tree
            treeData={treeData}
            expandedKeys={expandedKeys}
            onExpand={(keys) => setExpandedKeys(keys)}
            showLine={{ showLeafIcon: false }}
            showIcon
            icon={renderIcon}
            className={styles.indicatorTree}
          />
        </div>
      )}
    </Modal>
  );
};

export default IndicatorTreeViewer;
