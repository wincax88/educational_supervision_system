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
  Modal,
  Select,
  Space,
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
  MenuUnfoldOutlined,
  MenuFoldOutlined,
  FilterOutlined,
} from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';
import * as indicatorService from '../../../services/indicatorService';
import type { Indicator, DataIndicator, SupportingMaterial, DataIndicatorWithElements } from '../../../services/indicatorService';
import * as toolService from '../../../services/toolService';
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

type AutoLinkResult = {
  linked: number;
  skippedAlreadyAssociated: number;
  skippedNoMatch: number;
  failed: number;
};

// 要素关联统计
interface ElementAssociationStats {
  total: number;      // 数据指标总数
  associated: number; // 已关联要素的数据指标数
  unassociated: number; // 未关联要素的数据指标数
}

const normalizeText = (value?: string): string => {
  if (!value) return '';
  // 统一大小写、去空白、去常见分隔符，提升名称匹配命中率
  return value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[\s\-_—–·•/\\()（）【】[\]{}<>《》"'“”‘’,，.。:：;；!?！？]+/g, '');
};

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  const concurrency = Math.max(1, limit);
  let idx = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (idx < items.length) {
      const current = items[idx++];
      await worker(current);
    }
  });
  await Promise.all(runners);
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

  // 筛选状态：all=全部, unassociated=未关联要素
  const [filterMode, setFilterMode] = useState<'all' | 'unassociated'>('all');

  // 自动关联要素（按要素库）
  const [autoLinkModalVisible, setAutoLinkModalVisible] = useState(false);
  const [autoLinking, setAutoLinking] = useState(false);
  const [elementLibraries, setElementLibraries] = useState<toolService.ElementLibrary[]>([]);

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

  // 收集全部数据指标（包含所在指标名称）
  const collectDataIndicators = useCallback((): Array<{ di: DataIndicator; indicatorName: string }> => {
    const result: Array<{ di: DataIndicator; indicatorName: string }> = [];
    const walk = (list: Indicator[]) => {
      list.forEach(ind => {
        if (ind.dataIndicators?.length) {
          ind.dataIndicators.forEach(di => {
            result.push({ di, indicatorName: ind.name });
          });
        }
        if (ind.children?.length) walk(ind.children);
      });
    };
    walk(indicators);
    return result;
  }, [indicators]);

  const loadElementLibraries = useCallback(async () => {
    try {
      const libs = await toolService.getElementLibraries();
      setElementLibraries(libs);
    } catch (error) {
      console.error('加载要素库失败:', error);
      message.error('加载要素库失败');
    }
  }, []);

  const handleOpenAutoLink = async () => {
    if (disabled) {
      message.warning('当前为只读状态，无法自动关联要素');
      return;
    }
    if (!indicatorSystemId) {
      message.warning('请先关联指标体系');
      return;
    }
    if (USE_MOCK) {
      message.warning('Mock 模式下不支持自动关联要素（无后端持久化）');
      return;
    }
    await loadElementLibraries();
    setAutoLinkModalVisible(true);
  };

  const autoLinkByLibrary = useCallback(
    async (libraryId: string): Promise<AutoLinkResult> => {
      const allDataIndicators = collectDataIndicators();
      if (allDataIndicators.length === 0) {
        return { linked: 0, skippedAlreadyAssociated: 0, skippedNoMatch: 0, failed: 0 };
      }

      const elements = await toolService.getElements({ libraryId });
      const codeMap = new Map<string, toolService.ElementWithLibrary>();
      const nameMap = new Map<string, toolService.ElementWithLibrary[]>();
      elements.forEach(el => {
        if (el.code) codeMap.set(normalizeText(el.code), el);
        const nk = normalizeText(el.name);
        if (!nk) return;
        const prev = nameMap.get(nk) || [];
        prev.push(el);
        nameMap.set(nk, prev);
      });

      let linked = 0;
      let skippedAlreadyAssociated = 0;
      let skippedNoMatch = 0;
      let failed = 0;

      const tasks = allDataIndicators.map(({ di }) => di);

      await runWithConcurrency(tasks, 5, async (di) => {
        try {
          const existing = elementAssociations.get(di.id)?.elements || [];
          if (existing.length > 0) {
            skippedAlreadyAssociated++;
            return;
          }

          const byCode = codeMap.get(normalizeText(di.code));
          let matched: toolService.ElementWithLibrary | undefined = byCode;

          if (!matched) {
            const candidates = nameMap.get(normalizeText(di.name)) || [];
            if (candidates.length === 1) matched = candidates[0];
          }

          if (!matched) {
            skippedNoMatch++;
            return;
          }

          await indicatorService.saveDataIndicatorElements(di.id, [
            { elementId: matched.id, mappingType: 'primary', description: '' },
          ]);
          linked++;
        } catch (e) {
          failed++;
          console.error('自动关联失败:', di, e);
        }
      });

      return { linked, skippedAlreadyAssociated, skippedNoMatch, failed };
    },
    [collectDataIndicators, elementAssociations]
  );

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

  // 根据筛选条件过滤指标树
  const filterIndicatorsByMode = useCallback((indicatorList: Indicator[]): Indicator[] => {
    if (filterMode === 'all') return indicatorList;

    // 递归过滤，只保留有未关联要素的数据指标的指标节点
    const filterRecursive = (items: Indicator[]): Indicator[] => {
      const result: Indicator[] = [];

      for (const ind of items) {
        // 递归过滤子指标
        const filteredChildren = ind.children ? filterRecursive(ind.children) : [];

        // 过滤数据指标，只保留未关联要素的
        const filteredDataIndicators = ind.dataIndicators?.filter(di => {
          const assoc = elementAssociations.get(di.id);
          return !assoc?.elements || assoc.elements.length === 0;
        }) || [];

        // 如果有未关联的数据指标或有子节点包含未关联的，则保留该节点
        if (filteredDataIndicators.length > 0 || filteredChildren.length > 0) {
          result.push({
            ...ind,
            children: filteredChildren.length > 0 ? filteredChildren : undefined,
            dataIndicators: filteredDataIndicators.length > 0 ? filteredDataIndicators : undefined,
          });
        }
      }

      return result;
    };

    return filterRecursive(indicatorList);
  }, [filterMode, elementAssociations]);

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

  // 收集所有可展开节点的key
  const collectAllExpandableKeys = useCallback((treeData: DataNode[]): React.Key[] => {
    const keys: React.Key[] = [];
    const traverse = (nodes: DataNode[]) => {
      nodes.forEach(node => {
        if (node.children && node.children.length > 0) {
          keys.push(node.key);
          traverse(node.children);
        }
      });
    };
    traverse(treeData);
    return keys;
  }, []);

  // 展开/收起全部节点
  const handleExpandAll = useCallback(() => {
    const filteredIndicators = filterIndicatorsByMode(indicators);
    const treeData = buildTreeData(filteredIndicators);
    const allKeys = collectAllExpandableKeys(treeData);
    setExpandedKeys(allKeys);
  }, [indicators, collectAllExpandableKeys, filterIndicatorsByMode]);

  const handleCollapseAll = useCallback(() => {
    setExpandedKeys([]);
  }, []);

  // 判断是否全部展开
  const isAllExpanded = useCallback(() => {
    const filteredIndicators = filterIndicatorsByMode(indicators);
    if (filteredIndicators.length === 0) return false;
    const treeData = buildTreeData(filteredIndicators);
    const allKeys = collectAllExpandableKeys(treeData);
    return allKeys.length > 0 && allKeys.every(key => expandedKeys.includes(key));
  }, [indicators, expandedKeys, collectAllExpandableKeys, filterIndicatorsByMode]);

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
        <Space>
          <Button
            icon={<DatabaseOutlined />}
            onClick={handleOpenAutoLink}
            disabled={disabled || loading}
          >
            自动关联要素
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={loadData}
            loading={loading}
          >
            刷新
          </Button>
        </Space>
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
        {/* 筛选和展开/收起按钮 */}
        {indicators.length > 0 && (
          <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space>
              <FilterOutlined style={{ color: '#666' }} />
              <Select
                value={filterMode}
                onChange={setFilterMode}
                style={{ width: 140 }}
                size="small"
                options={[
                  { value: 'all', label: '全部指标' },
                  { value: 'unassociated', label: '未关联要素' },
                ]}
              />
              {filterMode === 'unassociated' && stats.unassociated > 0 && (
                <Tag color="warning">{stats.unassociated} 项未关联</Tag>
              )}
            </Space>
            <Space>
              {isAllExpanded() ? (
                <Button
                  icon={<MenuFoldOutlined />}
                  size="small"
                  onClick={handleCollapseAll}
                >
                  收起全部
                </Button>
              ) : (
                <Button
                  icon={<MenuUnfoldOutlined />}
                  size="small"
                  onClick={handleExpandAll}
                >
                  展开全部
                </Button>
              )}
            </Space>
          </div>
        )}
        <Spin spinning={loading}>
          {(() => {
            const filteredIndicators = filterIndicatorsByMode(indicators);
            if (filteredIndicators.length > 0) {
              return (
                <Tree
                  showLine={{ showLeafIcon: false }}
                  showIcon
                  expandedKeys={expandedKeys}
                  onExpand={(keys) => setExpandedKeys(keys)}
                  treeData={buildTreeData(filteredIndicators)}
                  className={styles.indicatorTree}
                />
              );
            } else if (indicators.length > 0 && filterMode === 'unassociated') {
              return (
                <Empty
                  description="所有数据指标均已关联要素"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              );
            } else {
              return <Empty description="暂无指标数据" />;
            }
          })()}
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

      {/* 自动关联要素 - 选择要素库 */}
      <Modal
        title="自动关联评估要素"
        open={autoLinkModalVisible}
        onCancel={() => {
          if (!autoLinking) setAutoLinkModalVisible(false);
        }}
        footer={null}
        destroyOnClose
      >
        <div style={{ color: '#595959', marginBottom: 12, lineHeight: '22px' }}>
          选择要素库后将自动为<strong>未关联</strong>的“数据指标”匹配并关联要素（优先按编码匹配，其次按名称匹配）。
        </div>
        <Select
          placeholder="选择要素库后开始自动关联"
          style={{ width: '100%' }}
          showSearch
          optionFilterProp="label"
          disabled={autoLinking}
          options={elementLibraries.map(lib => ({
            value: lib.id,
            label: lib.name,
          }))}
          onChange={async (libraryId) => {
            if (!libraryId) return;
            setAutoLinking(true);
            const hide = message.loading('正在自动关联要素，请稍候...', 0);
            try {
              const res = await autoLinkByLibrary(libraryId);
              await loadData();
              setAutoLinkModalVisible(false);
              message.success(
                `自动关联完成：成功关联 ${res.linked} 项，已有关联跳过 ${res.skippedAlreadyAssociated} 项，未匹配 ${res.skippedNoMatch} 项，失败 ${res.failed} 项`
              );
            } catch (error) {
              console.error('自动关联要素失败:', error);
              message.error('自动关联要素失败');
            } finally {
              hide();
              setAutoLinking(false);
            }
          }}
        />
        <div style={{ marginTop: 12, textAlign: 'right' }}>
          <Button onClick={() => setAutoLinkModalVisible(false)} disabled={autoLinking}>
            关闭
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default IndicatorTab;
