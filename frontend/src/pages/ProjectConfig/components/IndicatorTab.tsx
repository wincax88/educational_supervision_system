/**
 * 指标体系 Tab 组件
 * 显示项目关联的指标体系
 * 支持编辑数据指标与评估要素的关联
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Button,
  Tree,
  Tag,
  Spin,
  Empty,
  Progress,
  Card,
  Statistic,
  Row,
  Col,
  Tooltip,
  message,
} from 'antd';
import {
  FileTextOutlined,
  FolderOutlined,
  FolderOpenOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  LinkOutlined,
  EyeOutlined,
  ReloadOutlined,
  EditOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';
import * as indicatorService from '../../../services/indicatorService';
import type { Indicator, DataIndicator, SupportingMaterial, DataIndicatorWithElements } from '../../../services/indicatorService';
import ElementAssociationDrawer from './ElementAssociationDrawer';
import styles from '../index.module.css';

// Mock 数据导入
import { indicatorTrees, dataIndicatorElements } from '../../../mock/data';

// Mock 模式开关
// 通过环境变量 REACT_APP_USE_MOCK=true 启用 Mock 模式，默认使用 API
const USE_MOCK = process.env.REACT_APP_USE_MOCK === 'true';

interface IndicatorTabProps {
  projectId: string;
  indicatorSystemId?: string;
  indicatorSystemName?: string;
  disabled?: boolean; // 是否禁用编辑（非配置中状态）
}

// 要素关联统计
interface ElementAssociationStats {
  total: number;      // 数据指标总数
  associated: number; // 已关联要素的数据指标数
  unassociated: number; // 未关联要素的数据指标数
}

const IndicatorTab: React.FC<IndicatorTabProps> = ({
  projectId,
  indicatorSystemId,
  indicatorSystemName,
  disabled = false,
}) => {
  const [loading, setLoading] = useState(false);
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);

  // 要素关联编辑状态
  const [elementAssociations, setElementAssociations] = useState<Map<string, DataIndicatorWithElements>>(new Map());
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedDataIndicator, setSelectedDataIndicator] = useState<DataIndicator | null>(null);
  const [selectedIndicatorName, setSelectedIndicatorName] = useState<string>('');

  // 要素关联统计
  const [stats, setStats] = useState<ElementAssociationStats>({ total: 0, associated: 0, unassociated: 0 });

  // 加载指标体系树和要素关联
  const loadData = useCallback(async () => {
    if (!indicatorSystemId) return;

    setLoading(true);
    try {
      let treeData: Indicator[];
      let elementsData: DataIndicatorWithElements[];

      if (USE_MOCK) {
        // 使用 Mock 数据
        treeData = indicatorTrees[indicatorSystemId] || [];
        elementsData = dataIndicatorElements[indicatorSystemId] || [];
      } else {
        // 使用 API 数据
        const [apiTreeData, apiElementsData] = await Promise.all([
          indicatorService.getIndicatorTree(indicatorSystemId),
          indicatorService.getSystemDataIndicatorElements(indicatorSystemId),
        ]);
        treeData = apiTreeData;
        elementsData = apiElementsData;
      }

      setIndicators(treeData);

      // 构建要素关联映射
      const assocMap = new Map<string, DataIndicatorWithElements>();
      elementsData.forEach(di => {
        assocMap.set(di.id, di);
      });
      setElementAssociations(assocMap);

      // 统计数据指标和要素关联
      let totalDataIndicators = 0;
      let associatedCount = 0;

      const countDataIndicators = (indicatorList: Indicator[]) => {
        indicatorList.forEach(ind => {
          if (ind.dataIndicators) {
            ind.dataIndicators.forEach(di => {
              totalDataIndicators++;
              const diWithElements = assocMap.get(di.id);
              if (diWithElements?.elements && diWithElements.elements.length > 0) {
                associatedCount++;
              }
            });
          }
          if (ind.children) {
            countDataIndicators(ind.children);
          }
        });
      };
      countDataIndicators(treeData);

      setStats({
        total: totalDataIndicators,
        associated: associatedCount,
        unassociated: totalDataIndicators - associatedCount,
      });

      // 默认展开第一级
      const firstLevelKeys = treeData.map(item => item.id);
      setExpandedKeys(firstLevelKeys);
    } catch (error) {
      console.error('加载指标体系失败:', error);
      message.error('加载指标体系失败');
    } finally {
      setLoading(false);
    }
  }, [indicatorSystemId]);

  // 打开要素关联编辑抽屉
  const handleEditElementAssociation = (di: DataIndicator, indicatorName: string) => {
    setSelectedDataIndicator(di);
    setSelectedIndicatorName(indicatorName);
    setDrawerVisible(true);
  };

  // 获取数据指标的要素关联数量
  const getElementCount = (dataIndicatorId: string): number => {
    const assoc = elementAssociations.get(dataIndicatorId);
    return assoc?.elements?.length || 0;
  };

  // 获取数据指标关联的要素信息列表（包含要素名和要素库名）
  const getElementInfos = (dataIndicatorId: string): Array<{ name: string; library: string }> => {
    const assoc = elementAssociations.get(dataIndicatorId);
    return assoc?.elements?.map(e => ({
      name: e.elementName,
      library: e.libraryName || '未知要素库',
    })) || [];
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 渲染数据指标节点
  const renderDataIndicatorNode = (di: DataIndicator, indicatorId: string, indicatorName: string) => {
    const elementCount = getElementCount(di.id);
    const elementInfos = getElementInfos(di.id);
    const hasElements = elementCount > 0;

    return (
      <div className={styles.dataIndicatorNode}>
        <span className={styles.diCode}>{di.code}</span>
        <span className={styles.diName}>{di.name}</span>
        {di.threshold && (
          <Tag color="blue" className={styles.diThreshold}>
            阈值: {di.threshold}
          </Tag>
        )}
        {/* 要素关联状态 */}
        <Tooltip
          title={
            hasElements
              ? (
                <div>
                  <div>已关联 {elementCount} 个评估要素：</div>
                  <ul style={{ margin: '4px 0 0 0', paddingLeft: 16, listStyle: 'none' }}>
                    {elementInfos.map((info, idx) => (
                      <li key={idx} style={{ marginBottom: 4 }}>
                        <span>{info.name}</span>
                        <span style={{ color: '#8c8c8c', fontSize: 12, marginLeft: 8 }}>
                          [{info.library}]
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )
              : disabled ? '要素关联（只读）' : '点击关联评估要素'
          }
        >
          <Tag
            color={hasElements ? 'success' : 'warning'}
            icon={hasElements ? <CheckCircleOutlined /> : <ExclamationCircleOutlined />}
            style={{ cursor: disabled ? 'default' : 'pointer' }}
            onClick={(e) => {
              e.stopPropagation();
              if (!disabled) {
                handleEditElementAssociation(di, indicatorName);
              }
            }}
          >
            <DatabaseOutlined style={{ marginRight: 4 }} />
            {hasElements ? `已关联 ${elementCount} 个要素` : '未关联要素'}
          </Tag>
        </Tooltip>
        {/* 编辑按钮 - 仅在可编辑状态显示 */}
        {!disabled && (
          <Tooltip title="编辑要素关联">
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                handleEditElementAssociation(di, indicatorName);
              }}
              style={{ marginLeft: 4 }}
            />
          </Tooltip>
        )}
      </div>
    );
  };

  // 渲染佐证资料节点
  const renderMaterialNode = (material: SupportingMaterial) => {
    return (
      <div className={styles.materialNode}>
        <FileTextOutlined className={styles.materialIcon} />
        <span className={styles.materialName}>{material.name}</span>
        {material.required ? (
          <Tag color="red">必传</Tag>
        ) : (
          <Tag>选传</Tag>
        )}
        <span className={styles.materialTypes}>
          {material.fileTypes} | {material.maxSize}
        </span>
      </div>
    );
  };

  // 构建树形数据
  const buildTreeData = (indicatorList: Indicator[]): DataNode[] => {
    return indicatorList.map(indicator => {
      const children: DataNode[] = [];

      // 添加子指标
      if (indicator.children && indicator.children.length > 0) {
        children.push(...buildTreeData(indicator.children));
      }

      // 添加数据指标
      if (indicator.dataIndicators && indicator.dataIndicators.length > 0) {
        children.push({
          key: `${indicator.id}-data-indicators`,
          title: (
            <span className={styles.groupTitle}>
              <LinkOutlined /> 数据指标 ({indicator.dataIndicators.length})
            </span>
          ),
          selectable: false,
          children: indicator.dataIndicators.map(di => ({
            key: `di-${di.id}`,
            title: renderDataIndicatorNode(di, indicator.id, indicator.name),
            isLeaf: true,
            selectable: false,
          })),
        });
      }

      // 添加佐证资料
      if (indicator.supportingMaterials && indicator.supportingMaterials.length > 0) {
        children.push({
          key: `${indicator.id}-materials`,
          title: (
            <span className={styles.groupTitle}>
              <FileTextOutlined /> 佐证资料 ({indicator.supportingMaterials.length})
            </span>
          ),
          selectable: false,
          children: indicator.supportingMaterials.map(material => ({
            key: `material-${material.id}`,
            title: renderMaterialNode(material),
            isLeaf: true,
            selectable: false,
          })),
        });
      }

      // 获取层级颜色
      const levelColors: Record<number, string> = {
        1: 'blue',
        2: 'green',
        3: 'orange',
      };

      return {
        key: indicator.id,
        title: (
          <div className={styles.indicatorNode}>
            <Tag color={levelColors[indicator.level] || 'default'}>
              {indicator.level}级
            </Tag>
            <span className={styles.indicatorCode}>{indicator.code}</span>
            <span className={styles.indicatorName}>{indicator.name}</span>
            {indicator.weight && (
              <span className={styles.indicatorWeight}>权重: {indicator.weight}%</span>
            )}
          </div>
        ),
        children: children.length > 0 ? children : undefined,
        icon: ({ expanded }: { expanded?: boolean }) =>
          expanded ? <FolderOpenOutlined /> : <FolderOutlined />,
      };
    });
  };

  // 如果没有关联指标体系
  if (!indicatorSystemId) {
    return (
      <div className={styles.indicatorTab}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="暂未关联指标体系"
        >
          <Button type="primary" icon={<LinkOutlined />}>
            关联指标体系
          </Button>
        </Empty>
      </div>
    );
  }

  return (
    <div className={styles.indicatorTab}>
      {/* 指标体系信息头 */}
      <div className={styles.indicatorHeader}>
        <div className={styles.indicatorInfo}>
          <h3 className={styles.indicatorSystemName}>
            <FileTextOutlined /> {indicatorSystemName || '指标体系'}
          </h3>
          <Button
            icon={<EyeOutlined />}
            size="small"
            onClick={() => window.open(`/indicator-library`, '_blank')}
          >
            查看完整体系
          </Button>
        </div>
        <Button
          icon={<ReloadOutlined />}
          onClick={loadData}
          loading={loading}
        >
          刷新
        </Button>
      </div>

      {/* 要素关联统计卡片 */}
      {stats.total > 0 && (
        <Card className={styles.mappingStatsCard} size="small">
          <Row gutter={24}>
            <Col span={6}>
              <Statistic
                title="数据指标总数"
                value={stats.total}
                suffix="项"
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="已关联要素"
                value={stats.associated}
                suffix="项"
                valueStyle={{ color: '#52c41a' }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="未关联要素"
                value={stats.unassociated}
                suffix="项"
                valueStyle={{ color: stats.unassociated > 0 ? '#faad14' : '#52c41a' }}
              />
            </Col>
            <Col span={6}>
              <div className={styles.mappingProgress}>
                <span className={styles.progressLabel}>要素关联完成度</span>
                <Progress
                  percent={stats.total > 0 ? Math.round((stats.associated / stats.total) * 100) : 0}
                  status={stats.unassociated > 0 ? 'active' : 'success'}
                  size="small"
                />
              </div>
            </Col>
          </Row>
        </Card>
      )}

      {/* 指标树 */}
      <div className={styles.indicatorTreeContainer}>
        <Spin spinning={loading}>
          {indicators.length > 0 ? (
            <Tree
              showLine={{ showLeafIcon: false }}
              showIcon
              expandedKeys={expandedKeys}
              onExpand={(keys) => setExpandedKeys(keys)}
              treeData={buildTreeData(indicators)}
              className={styles.indicatorTree}
            />
          ) : (
            <Empty description="暂无指标数据" />
          )}
        </Spin>
      </div>

      {/* 要素关联编辑抽屉 */}
      <ElementAssociationDrawer
        visible={drawerVisible}
        onClose={() => {
          setDrawerVisible(false);
          setSelectedDataIndicator(null);
        }}
        dataIndicator={selectedDataIndicator}
        indicatorName={selectedIndicatorName}
        onSaved={loadData}
      />
    </div>
  );
};

export default IndicatorTab;
