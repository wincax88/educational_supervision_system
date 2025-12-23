/**
 * 普及普惠指标汇总组件 - 树形结构版
 *
 * 显示学前教育普及普惠督导评估的指标汇总：
 * - 维度一：普及普惠水平（3项指标）
 * - 维度二：政府保障情况（11项指标）
 * - 维度三：幼儿园保教质量保障情况（6项指标）
 * - 综合达标情况与等级判定
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, Tree, Spin, Empty, Tag, Tooltip, Divider } from 'antd';
import type { DataNode } from 'antd/es/tree';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  FolderOutlined,
  FolderOpenOutlined,
  FileTextOutlined,
  BarChartOutlined,
  SafetyOutlined,
  TeamOutlined,
  BankOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import {
  getUniversalizationSummary,
  getOverallCompliance,
  UniversalizationSummary,
  OverallComplianceResponse,
  IndicatorData,
  IndicatorEvaluation,
  getComplianceLevelText,
  getComplianceLevelColor,
  getPreschoolLevelText,
} from '../../../services/preschoolStatisticsService';
import IndicatorDetailModal, { IndicatorDetail } from './IndicatorDetailModal';
import styles from './IndicatorSummaryTree.module.css';

interface PreschoolIndicatorSummaryProps {
  districtId: string;
  projectId: string;
  refreshKey?: number;
}

// 指标维度定义
interface IndicatorDimension {
  code: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  indicatorCodes: string[];
  weight: number;
}

// 三大维度配置
const INDICATOR_DIMENSIONS: IndicatorDimension[] = [
  {
    code: '1',
    name: '普及普惠水平',
    description: '3项指标均要达到要求：学前三年毛入园率≥85%、普惠性幼儿园覆盖率≥80%、公办园在园幼儿占比≥50%',
    icon: <BarChartOutlined />,
    color: '#1890ff',
    indicatorCodes: ['1.1', '1.2', '1.3'],
    weight: 30,
  },
  {
    code: '2',
    name: '政府保障情况',
    description: '11项指标均要达到要求（以政策落实、保障机制与关键约束为主）',
    icon: <BankOutlined />,
    color: '#722ed1',
    indicatorCodes: ['2.1', '2.2', '2.3', '2.4', '2.5', '2.6', '2.7', '2.8', '2.9', '2.10', '2.11'],
    weight: 40,
  },
  {
    code: '3',
    name: '幼儿园保教质量保障情况',
    description: '6项指标均要达到要求（含办园条件、师资队伍、保教质量等）',
    icon: <TeamOutlined />,
    color: '#52c41a',
    indicatorCodes: ['3.1', '3.2', '3.3', '3.4', '3.5', '3.6'],
    weight: 30,
  },
];

// 指标详情配置（用于显示指标类型）
const INDICATOR_DETAILS: Record<string, { type: 'data' | 'material' | 'both'; label: string }> = {
  // 维度一：普及普惠水平
  '1.1': { type: 'data', label: '学前三年毛入园率' },
  '1.2': { type: 'both', label: '普惠性幼儿园覆盖率' },
  '1.3': { type: 'data', label: '公办园在园幼儿占比' },
  // 维度二：政府保障情况
  '2.1': { type: 'material', label: '党的领导坚强有力' },
  '2.2': { type: 'material', label: '发展规划科学合理' },
  '2.3': { type: 'material', label: '公共服务网络基本完善' },
  '2.4': { type: 'data', label: '小区配套幼儿园管理规范' },
  '2.5': { type: 'data', label: '财政投入到位' },
  '2.6': { type: 'data', label: '收费合理' },
  '2.7': { type: 'data', label: '教师工资待遇有保障' },
  '2.8': { type: 'material', label: '安全风险防控机制健全' },
  '2.9': { type: 'material', label: '监管制度比较完善' },
  '2.10': { type: 'material', label: '办园条件改善' },
  '2.11': { type: 'data', label: '无重大安全责任事故' },
  // 维度三：幼儿园保教质量保障情况
  '3.1': { type: 'data', label: '办园条件合格' },
  '3.2': { type: 'data', label: '班额基本达标' },
  '3.3': { type: 'data', label: '教师配足配齐' },
  '3.4': { type: 'material', label: '教师管理制度严格' },
  '3.5': { type: 'material', label: '落实科学保教要求' },
  '3.6': { type: 'material', label: '无"小学化"现象' },
};

const PreschoolIndicatorSummary: React.FC<PreschoolIndicatorSummaryProps> = ({
  districtId,
  projectId,
  refreshKey,
}) => {
  const [universalizationData, setUniversalizationData] = useState<UniversalizationSummary | null>(null);
  const [universalizationLoading, setUniversalizationLoading] = useState(false);
  const [overallComplianceData, setOverallComplianceData] = useState<OverallComplianceResponse | null>(null);
  const [overallComplianceLoading, setOverallComplianceLoading] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [indicatorDetailVisible, setIndicatorDetailVisible] = useState(false);
  const [selectedIndicator, setSelectedIndicator] = useState<IndicatorDetail | null>(null);
  const hasInitialExpanded = useRef(false);

  // 加载普及普惠水平指标数据
  useEffect(() => {
    if (!districtId || !projectId) return;

    const loadUniversalizationData = async () => {
      setUniversalizationLoading(true);
      try {
        const result = await getUniversalizationSummary(districtId, projectId);
        setUniversalizationData(result);
      } catch (error) {
        console.error('加载普及普惠水平指标数据失败:', error);
      } finally {
        setUniversalizationLoading(false);
      }
    };

    loadUniversalizationData();
  }, [districtId, projectId, refreshKey]);

  // 加载综合达标情况数据
  useEffect(() => {
    if (!districtId || !projectId) return;

    const loadOverallComplianceData = async () => {
      setOverallComplianceLoading(true);
      try {
        const result = await getOverallCompliance(districtId, projectId);
        setOverallComplianceData(result);
      } catch (error) {
        console.error('加载综合达标情况数据失败:', error);
      } finally {
        setOverallComplianceLoading(false);
      }
    };

    loadOverallComplianceData();
  }, [districtId, projectId, refreshKey]);

  // 根据维度获取指标数据
  const getIndicatorsByDimension = (dimension: IndicatorDimension): IndicatorEvaluation[] => {
    if (!overallComplianceData?.indicators) return [];
    return overallComplianceData.indicators.filter(ind =>
      dimension.indicatorCodes.includes(ind.code)
    );
  };

  // 计算维度达标统计
  const getDimensionStats = (indicators: IndicatorEvaluation[]) => {
    const total = indicators.length;
    const compliant = indicators.filter(i => i.complianceLevel === 'compliant').length;
    const basic = indicators.filter(i => i.complianceLevel === 'basic').length;
    const nonCompliant = indicators.filter(i => i.complianceLevel === 'non-compliant').length;
    const pending = indicators.filter(i => i.complianceLevel === 'pending').length;
    const passRate = total > 0 ? Math.round(((compliant + basic) / total) * 100) : 0;
    return { total, compliant, basic, nonCompliant, pending, passRate };
  };

  // 渲染普及普惠水平指标节点（带详细数值）
  const renderUniversalizationIndicatorNode = (indicator: IndicatorData): DataNode => {
    let valueClass = styles.indicatorValue;
    let statusTag;

    if (indicator.isPending) {
      valueClass += ` ${styles.pending}`;
      statusTag = <Tag color="default">待填报</Tag>;
    } else if (indicator.isCompliant) {
      valueClass += ` ${styles.compliant}`;
      statusTag = <Tag icon={<CheckCircleOutlined />} color="success">合格</Tag>;
    } else if (indicator.isBasic) {
      valueClass += ` ${styles.basic}`;
      statusTag = <Tag color="warning">基本合格</Tag>;
    } else {
      valueClass += ` ${styles.nonCompliant}`;
      statusTag = <Tag icon={<CloseCircleOutlined />} color="error">不合格</Tag>;
    }

    const detail = INDICATOR_DETAILS[indicator.code];

    const handleShowDetail = (e: React.MouseEvent) => {
      e.stopPropagation();
      setSelectedIndicator({
        code: indicator.code,
        name: indicator.name,
        type: detail?.type || 'data',
        threshold: `${indicator.operator}${indicator.threshold}${indicator.unit}`,
        value: indicator.value,
        displayValue: indicator.value !== null ? `${indicator.value}${indicator.unit}` : null,
        isCompliant: indicator.isCompliant,
        unit: indicator.unit,
        operator: indicator.operator,
        dataSource: detail?.type === 'material' ? 'material' : 'district',
      });
      setIndicatorDetailVisible(true);
    };

    return {
      key: `universalization-${indicator.code}`,
      title: (
        <Tooltip title={indicator.name}>
          <div className={styles.indicatorTitle}>
            <span className={styles.indicatorCode}>{indicator.code}</span>
            <span className={styles.indicatorName}>{indicator.name}</span>
            {detail?.type === 'data' && (
              <Tag icon={<BarChartOutlined />} className={styles.typeTag} color="blue">数据</Tag>
            )}
            {detail?.type === 'both' && (
              <>
                <Tag icon={<BarChartOutlined />} className={styles.typeTag} color="blue">数据</Tag>
                <Tag icon={<FileTextOutlined />} className={styles.typeTag} color="orange">佐证</Tag>
              </>
            )}
            <span className={valueClass}>
              {indicator.value !== null ? `${indicator.value}${indicator.unit}` : '-'}
            </span>
            <span className={styles.indicatorThreshold}>
              标准: {indicator.operator}{indicator.threshold}{indicator.unit}
            </span>
            <span className={styles.statusTag}>{statusTag}</span>
            <Tooltip title="查看数据来源和计算公式">
              <InfoCircleOutlined
                style={{ color: '#1890ff', cursor: 'pointer', marginLeft: 8 }}
                onClick={handleShowDetail}
              />
            </Tooltip>
          </div>
        </Tooltip>
      ),
      isLeaf: true,
    };
  };

  // 渲染指标节点（政府保障和保教质量）
  const renderIndicatorNode = (indicator: IndicatorEvaluation): DataNode => {
    const detail = INDICATOR_DETAILS[indicator.code];
    let valueClass = styles.indicatorValue;
    let statusTag;

    if (indicator.complianceLevel === 'pending') {
      valueClass += ` ${styles.pending}`;
      statusTag = <Tag color="default">待填报</Tag>;
    } else if (indicator.complianceLevel === 'compliant') {
      valueClass += ` ${styles.compliant}`;
      statusTag = <Tag icon={<CheckCircleOutlined />} color="success">合格</Tag>;
    } else if (indicator.complianceLevel === 'basic') {
      valueClass += ` ${styles.basic}`;
      statusTag = <Tag color="warning">基本合格</Tag>;
    } else {
      valueClass += ` ${styles.nonCompliant}`;
      statusTag = <Tag icon={<CloseCircleOutlined />} color="error">不合格</Tag>;
    }

    const handleShowDetail = (e: React.MouseEvent) => {
      e.stopPropagation();
      setSelectedIndicator({
        code: indicator.code,
        name: indicator.name,
        type: detail?.type || 'material',
        threshold: '达到要求',
        isCompliant: indicator.complianceLevel === 'compliant',
        displayValue: indicator.complianceLevel === 'pending' ? '待填报' : (indicator.complianceLevel === 'compliant' ? '合格' : (indicator.complianceLevel === 'basic' ? '基本合格' : '不合格')),
        dataSource: detail?.type === 'data' ? 'district' : 'material',
      });
      setIndicatorDetailVisible(true);
    };

    return {
      key: `indicator-${indicator.code}`,
      title: (
        <Tooltip title={indicator.name}>
          <div className={styles.indicatorTitle}>
            <span className={styles.indicatorCode}>{indicator.code}</span>
            <span className={styles.indicatorName}>
              {indicator.name.length > 20 ? indicator.name.substring(0, 20) + '...' : indicator.name}
            </span>
            {detail?.type === 'data' && (
              <Tag icon={<BarChartOutlined />} className={styles.typeTag} color="blue">数据</Tag>
            )}
            {detail?.type === 'material' && (
              <Tag icon={<FileTextOutlined />} className={styles.typeTag} color="orange">佐证</Tag>
            )}
            {detail?.type === 'both' && (
              <>
                <Tag icon={<BarChartOutlined />} className={styles.typeTag} color="blue">数据</Tag>
                <Tag icon={<FileTextOutlined />} className={styles.typeTag} color="orange">佐证</Tag>
              </>
            )}
            <span className={styles.statusTag}>{statusTag}</span>
            <Tooltip title="查看数据来源和计算公式">
              <InfoCircleOutlined
                style={{ color: '#1890ff', cursor: 'pointer', marginLeft: 8 }}
                onClick={handleShowDetail}
              />
            </Tooltip>
          </div>
        </Tooltip>
      ),
      isLeaf: true,
    };
  };

  // 构建树形数据
  const treeData = useMemo((): DataNode[] => {
    const nodes: DataNode[] = [];

    INDICATOR_DIMENSIONS.forEach((dimension, dimIndex) => {
      const indicators = getIndicatorsByDimension(dimension);
      const stats = getDimensionStats(indicators);
      const isDimension1 = dimension.code === '1';

      // 维度节点
      let children: DataNode[] = [];

      if (isDimension1 && universalizationData?.indicators) {
        // 维度一使用带详细数值的节点
        children = universalizationData.indicators.map(renderUniversalizationIndicatorNode);
      } else if (indicators.length > 0) {
        children = indicators.map(renderIndicatorNode);
      }

      // 计算维度状态标签
      let dimensionStatusTag;
      if (stats.pending > 0) {
        dimensionStatusTag = (
          <Tag icon={<ExclamationCircleOutlined />} color="warning">
            {stats.compliant + stats.basic}/{stats.total} 合格，{stats.pending} 项待填报
          </Tag>
        );
      } else if (stats.compliant + stats.basic === stats.total) {
        dimensionStatusTag = (
          <Tag icon={<CheckCircleOutlined />} color="success">
            {stats.compliant + stats.basic}/{stats.total} 全部合格
          </Tag>
        );
      } else {
        dimensionStatusTag = (
          <Tag icon={<CloseCircleOutlined />} color="error">
            {stats.compliant + stats.basic}/{stats.total} 合格
          </Tag>
        );
      }

      nodes.push({
        key: `dimension-${dimension.code}`,
        title: (
          <div className={styles.dimensionTitle}>
            <span className={styles.dimensionName}>
              <span className={styles.dimensionIcon} style={{ color: dimension.color }}>
                {dimension.icon}
              </span>
              维度{dimension.code}：{dimension.name}（{stats.total}项）
              <Tag className={styles.weightTag}>权重 {dimension.weight}%</Tag>
            </span>
            <div className={styles.dimensionStats}>
              {dimensionStatusTag}
            </div>
          </div>
        ),
        children: children.length > 0 ? children : undefined,
      });
    });

    return nodes;
  }, [universalizationData, overallComplianceData]);

  // 计算总体汇总和等级判定
  const overallSummary = useMemo(() => {
    if (!overallComplianceData) {
      return {
        compliantCount: 0,
        basicCount: 0,
        nonCompliantCount: 0,
        pendingCount: 0,
        totalCount: 0,
        level: 'non-compliant' as const,
        levelText: '待评估',
      };
    }

    const { summary, complianceLevel } = overallComplianceData;
    return {
      compliantCount: summary.compliantCount,
      basicCount: summary.basicCount,
      nonCompliantCount: summary.nonCompliantCount,
      pendingCount: summary.pendingCount,
      totalCount: summary.totalCount,
      level: complianceLevel?.level || 'non-compliant',
      levelText: complianceLevel ? getPreschoolLevelText(complianceLevel.level) : '待评估',
    };
  }, [overallComplianceData]);

  // 默认全部展开 - 当所有数据加载完成后展开
  const isAllDataLoaded = !universalizationLoading && !overallComplianceLoading;

  useEffect(() => {
    // 当所有数据加载完成且尚未初始展开时，展开所有节点
    if (isAllDataLoaded && treeData.length > 0 && !hasInitialExpanded.current) {
      // 递归收集所有非叶子节点的 key
      const collectAllKeys = (nodes: DataNode[]): React.Key[] => {
        const keys: React.Key[] = [];
        nodes.forEach(node => {
          if (node.children && node.children.length > 0) {
            keys.push(node.key);
            keys.push(...collectAllKeys(node.children));
          }
        });
        return keys;
      };
      setExpandedKeys(collectAllKeys(treeData));
      hasInitialExpanded.current = true;
    }
  }, [treeData, isAllDataLoaded]);

  // 当 projectId 或 districtId 变化时重置初始展开状态
  useEffect(() => {
    hasInitialExpanded.current = false;
  }, [projectId, districtId]);

  // 自定义节点图标
  const renderIcon = (props: any) => {
    if (props.isLeaf) {
      return null;
    }
    return props.expanded ? <FolderOpenOutlined /> : <FolderOutlined />;
  };

  // 获取等级样式类
  const getLevelClass = (level: string) => {
    switch (level) {
      case 'excellence':
        return styles.excellence;
      case 'improved':
        return styles.improved;
      case 'consolidated':
        return styles.consolidated;
      default:
        return styles.nonCompliant;
    }
  };

  if (!projectId) {
    return <Empty description="请先选择项目" />;
  }

  const isLoading = universalizationLoading || overallComplianceLoading;

  if (isLoading && treeData.length === 0) {
    return (
      <div className={styles.loadingContainer}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      {/* 顶部总体汇总 */}
      <Card className={styles.summaryCard} size="small">
        <div className={styles.summaryContent}>
          <div className={styles.summaryStats}>
            <div className={styles.statItem}>
              <span className={styles.statValue} style={{ color: '#52c41a' }}>
                {overallSummary.compliantCount}
              </span>
              <span className={styles.statLabel}>合格</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statValue} style={{ color: '#faad14' }}>
                {overallSummary.basicCount}
              </span>
              <span className={styles.statLabel}>基本合格</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statValue} style={{ color: '#ff4d4f' }}>
                {overallSummary.nonCompliantCount}
              </span>
              <span className={styles.statLabel}>不合格</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statValue} style={{ color: '#999' }}>
                {overallSummary.pendingCount}
              </span>
              <span className={styles.statLabel}>待填报</span>
            </div>
            <Divider type="vertical" style={{ height: 40 }} />
            <div className={styles.statItem}>
              <span className={styles.statValue} style={{ color: '#1890ff' }}>
                {overallSummary.totalCount}
              </span>
              <span className={styles.statLabel}>总指标数</span>
            </div>
          </div>
          <div className={`${styles.summaryLevel} ${getLevelClass(overallSummary.level)}`}>
            <SafetyOutlined style={{ fontSize: 24, marginBottom: 4 }} />
            <span className={styles.levelLabel}>综合达标等级</span>
            <span className={`${styles.levelValue} ${getLevelClass(overallSummary.level)}`}>
              {overallSummary.levelText}
            </span>
          </div>
        </div>
      </Card>

      {/* 等级判定标准说明 */}
      {overallComplianceData?.config && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200, padding: '8px 12px', background: '#f6ffed', borderRadius: 6 }}>
              <div style={{ fontWeight: 600, color: '#52c41a', marginBottom: 4 }}>
                {overallComplianceData.config.levels.excellence.name}
              </div>
              <div style={{ fontSize: 12, color: '#666' }}>
                {overallComplianceData.config.totalIndicators}项全部合格，或33项合格+3项基本合格
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 200, padding: '8px 12px', background: '#e6f7ff', borderRadius: 6 }}>
              <div style={{ fontWeight: 600, color: '#1890ff', marginBottom: 4 }}>
                {overallComplianceData.config.levels.improved.name}
              </div>
              <div style={{ fontSize: 12, color: '#666' }}>
                至少{overallComplianceData.config.levels.improved.minCompliant}项合格，
                最多{overallComplianceData.config.levels.improved.maxBasicCompliant}项基本合格
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 200, padding: '8px 12px', background: '#f0f5ff', borderRadius: 6 }}>
              <div style={{ fontWeight: 600, color: '#597ef7', marginBottom: 4 }}>
                {overallComplianceData.config.levels.consolidated.name}
              </div>
              <div style={{ fontSize: 12, color: '#666' }}>
                至少{overallComplianceData.config.levels.consolidated.minCompliant}项合格，
                最多{overallComplianceData.config.levels.consolidated.maxBasicCompliant}项基本合格
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* 树形结构 */}
      <Card>
        {treeData.length > 0 ? (
          <div className={styles.treeContainer}>
            <Tree
              treeData={treeData}
              expandedKeys={expandedKeys}
              onExpand={(keys) => setExpandedKeys(keys)}
              showLine={{ showLeafIcon: false }}
              showIcon
              icon={renderIcon}
              className={styles.indicatorTree}
              selectable={false}
            />
          </div>
        ) : (
          <Empty description="暂无指标数据" />
        )}
      </Card>

      {/* 指标详情弹窗 */}
      <IndicatorDetailModal
        visible={indicatorDetailVisible}
        onClose={() => setIndicatorDetailVisible(false)}
        indicator={selectedIndicator}
      />
    </div>
  );
};

export default PreschoolIndicatorSummary;
