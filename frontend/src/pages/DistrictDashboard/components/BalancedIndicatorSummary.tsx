/**
 * 优质均衡指标汇总组件 - 树形结构版
 *
 * 显示义务教育优质均衡发展督导评估的指标汇总：
 * - 7项资源配置指标（小学/初中）
 * - 政府保障程度（15项指标）
 * - 教育质量（9项指标）
 * - 社会认可度（1项指标）
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, Tree, Tag, Spin, Empty, Button, Tooltip, Divider } from 'antd';
import type { DataNode } from 'antd/es/tree';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  FolderOutlined,
  FolderOpenOutlined,
  FileTextOutlined,
  TeamOutlined,
  BankOutlined,
  BarChartOutlined,
  HeartOutlined,
  EyeOutlined,
  InfoCircleOutlined,
  SafetyOutlined,
} from '@ant-design/icons';
import {
  getResourceIndicatorsSummary,
  ResourceIndicatorsSummary,
  CVIndicatorSummary,
  getGovernmentGuaranteeSummary,
  GovernmentGuaranteeResponse,
  GovernmentGuaranteeIndicator,
  getEducationQualitySummary,
  EducationQualityResponse,
  EducationQualityIndicator,
  getSocialRecognitionSummary,
  SocialRecognitionResponse,
  SocialRecognitionIndicator,
} from '../../../services/statisticsService';
import SchoolDetailModal from './SchoolDetailModal';
import IndicatorDetailModal, { IndicatorDetail } from './IndicatorDetailModal';
import styles from './IndicatorSummaryTree.module.css';

interface BalancedIndicatorSummaryProps {
  districtId: string;
  projectId: string;
  refreshKey?: number;
}

// 指标代码到简称映射
const INDICATOR_SHORT_NAMES: Record<string, string> = {
  L1: '高学历教师',
  L2: '骨干教师',
  L3: '体艺教师',
  L4: '教学用房',
  L5: '体育场馆',
  L6: '教学设备',
  L7: '多媒体教室',
};

const BalancedIndicatorSummary: React.FC<BalancedIndicatorSummaryProps> = ({
  districtId,
  projectId,
  refreshKey,
}) => {
  const [loading, setLoading] = useState(false);
  const [primaryData, setPrimaryData] = useState<ResourceIndicatorsSummary | null>(null);
  const [juniorData, setJuniorData] = useState<ResourceIndicatorsSummary | null>(null);
  const [govData, setGovData] = useState<GovernmentGuaranteeResponse | null>(null);
  const [govLoading, setGovLoading] = useState(false);
  const [eduQualityData, setEduQualityData] = useState<EducationQualityResponse | null>(null);
  const [eduQualityLoading, setEduQualityLoading] = useState(false);
  const [socialRecogData, setSocialRecogData] = useState<SocialRecognitionResponse | null>(null);
  const [socialRecogLoading, setSocialRecogLoading] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [schoolModalVisible, setSchoolModalVisible] = useState(false);
  const [schoolModalTab, setSchoolModalTab] = useState<'primary' | 'junior'>('primary');
  const [indicatorDetailVisible, setIndicatorDetailVisible] = useState(false);
  const [selectedIndicator, setSelectedIndicator] = useState<IndicatorDetail | null>(null);
  const hasInitialExpanded = useRef(false);

  // 加载资源配置指标数据
  useEffect(() => {
    if (!districtId || !projectId) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const [primaryResult, juniorResult] = await Promise.all([
          getResourceIndicatorsSummary(districtId, projectId, '小学'),
          getResourceIndicatorsSummary(districtId, projectId, '初中'),
        ]);
        setPrimaryData(primaryResult);
        setJuniorData(juniorResult);
      } catch (error) {
        console.error('加载数据失败:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [districtId, projectId, refreshKey]);

  // 加载政府保障程度指标数据
  useEffect(() => {
    if (!districtId || !projectId) return;

    const loadGovData = async () => {
      setGovLoading(true);
      try {
        const result = await getGovernmentGuaranteeSummary(districtId, projectId);
        setGovData(result);
      } catch (error) {
        console.error('加载政府保障程度数据失败:', error);
      } finally {
        setGovLoading(false);
      }
    };

    loadGovData();
  }, [districtId, projectId, refreshKey]);

  // 加载教育质量指标数据
  useEffect(() => {
    if (!districtId || !projectId) return;

    const loadEduQualityData = async () => {
      setEduQualityLoading(true);
      try {
        const result = await getEducationQualitySummary(districtId, projectId);
        setEduQualityData(result);
      } catch (error) {
        console.error('加载教育质量数据失败:', error);
      } finally {
        setEduQualityLoading(false);
      }
    };

    loadEduQualityData();
  }, [districtId, projectId, refreshKey]);

  // 加载社会认可度指标数据
  useEffect(() => {
    if (!districtId || !projectId) return;

    const loadSocialRecogData = async () => {
      setSocialRecogLoading(true);
      try {
        const result = await getSocialRecognitionSummary(districtId, projectId);
        setSocialRecogData(result);
      } catch (error) {
        console.error('加载社会认可度数据失败:', error);
      } finally {
        setSocialRecogLoading(false);
      }
    };

    loadSocialRecogData();
  }, [districtId, projectId, refreshKey]);

  // 渲染达标状态标签
  const renderStatusTag = (isCompliant: boolean | null, pendingCount?: number) => {
    if (isCompliant === null) {
      if (pendingCount && pendingCount > 0) {
        return <Tag icon={<ExclamationCircleOutlined />} color="warning">待填报</Tag>;
      }
      return <Tag color="default">暂无数据</Tag>;
    }
    return isCompliant ? (
      <Tag icon={<CheckCircleOutlined />} color="success">达标</Tag>
    ) : (
      <Tag icon={<CloseCircleOutlined />} color="error">未达标</Tag>
    );
  };

  // 渲染差异系数指标节点
  const renderCVIndicatorNode = (cv: CVIndicatorSummary, schoolType: '小学' | '初中'): DataNode => {
    const cvThreshold = schoolType === '小学' ? 0.50 : 0.45;
    let statusTag;
    let valueClass = styles.indicatorValue;

    if (cv.cv === null) {
      if (cv.count > 0 && cv.count < 2) {
        statusTag = <Tag color="warning">需2所学校</Tag>;
      } else {
        statusTag = <Tag color="default">暂无数据</Tag>;
      }
      valueClass += ` ${styles.pending}`;
    } else {
      statusTag = cv.isCompliant ? (
        <Tag icon={<CheckCircleOutlined />} color="success">达标</Tag>
      ) : (
        <Tag icon={<CloseCircleOutlined />} color="error">未达标</Tag>
      );
      valueClass += cv.isCompliant ? ` ${styles.compliant}` : ` ${styles.nonCompliant}`;
    }

    return {
      key: `cv-${schoolType}-${cv.code}`,
      title: (
        <div className={styles.indicatorTitle}>
          <span className={styles.indicatorCode}>{cv.code}</span>
          <span className={styles.indicatorName}>{INDICATOR_SHORT_NAMES[cv.code]}</span>
          <span className={valueClass}>
            CV: {cv.cv !== null ? cv.cv.toFixed(4) : '-'}
          </span>
          <span className={styles.indicatorThreshold}>标准: ≤{cvThreshold}</span>
          <span className={styles.statusTag}>{statusTag}</span>
        </div>
      ),
      isLeaf: true,
    };
  };

  // 渲染政府保障程度指标节点
  const renderGovIndicatorNode = (indicator: GovernmentGuaranteeIndicator): DataNode => {
    let statusTag;
    let valueClass = styles.indicatorValue;

    if (indicator.isCompliant === null) {
      statusTag = <Tag color="default">{indicator.displayValue || '待填报'}</Tag>;
      valueClass += ` ${styles.pending}`;
    } else {
      statusTag = indicator.isCompliant ? (
        <Tag icon={<CheckCircleOutlined />} color="success">达标</Tag>
      ) : (
        <Tag icon={<CloseCircleOutlined />} color="error">未达标</Tag>
      );
      valueClass += indicator.isCompliant ? ` ${styles.compliant}` : ` ${styles.nonCompliant}`;
    }

    const handleShowDetail = (e: React.MouseEvent) => {
      e.stopPropagation();
      setSelectedIndicator({
        code: indicator.code,
        name: indicator.name,
        shortName: indicator.shortName,
        type: indicator.type,
        threshold: indicator.threshold,
        description: indicator.description,
        value: indicator.value,
        displayValue: indicator.displayValue,
        isCompliant: indicator.isCompliant,
        details: indicator.details,
        dataSource: 'district',
      });
      setIndicatorDetailVisible(true);
    };

    return {
      key: `gov-${indicator.code}`,
      title: (
        <div className={styles.indicatorTitle}>
          <span className={styles.indicatorCode}>{indicator.code.replace('G', '')}</span>
          <Tooltip title={indicator.name}>
            <span className={styles.indicatorName}>{indicator.shortName}</span>
          </Tooltip>
          <span className={valueClass}>{indicator.displayValue || '-'}</span>
          <span className={styles.indicatorThreshold}>标准: {indicator.threshold}</span>
          <span className={styles.statusTag}>{statusTag}</span>
          <Tooltip title="查看数据来源和计算公式">
            <InfoCircleOutlined
              style={{ color: '#1890ff', cursor: 'pointer', marginLeft: 8 }}
              onClick={handleShowDetail}
            />
          </Tooltip>
        </div>
      ),
      isLeaf: true,
    };
  };

  // 渲染教育质量指标节点
  const renderEduQualityIndicatorNode = (indicator: EducationQualityIndicator): DataNode => {
    let statusTag;
    let valueClass = styles.indicatorValue;
    const isMaterialType = indicator.type === 'material';

    if (indicator.isCompliant === null) {
      statusTag = <Tag color="default">{indicator.displayValue || '待填报'}</Tag>;
      valueClass += ` ${styles.pending}`;
    } else {
      statusTag = indicator.isCompliant ? (
        <Tag icon={<CheckCircleOutlined />} color="success">达标</Tag>
      ) : (
        <Tag icon={<CloseCircleOutlined />} color="error">未达标</Tag>
      );
      valueClass += indicator.isCompliant ? ` ${styles.compliant}` : ` ${styles.nonCompliant}`;
    }

    const handleShowDetail = (e: React.MouseEvent) => {
      e.stopPropagation();
      setSelectedIndicator({
        code: indicator.code,
        name: indicator.name,
        shortName: indicator.shortName,
        type: indicator.type,
        threshold: indicator.threshold,
        description: indicator.description,
        value: indicator.value,
        displayValue: indicator.displayValue,
        isCompliant: indicator.isCompliant,
        details: indicator.details,
        dataSource: isMaterialType ? 'material' : 'district',
      });
      setIndicatorDetailVisible(true);
    };

    return {
      key: `edu-${indicator.code}`,
      title: (
        <div className={styles.indicatorTitle}>
          <span className={styles.indicatorCode}>{indicator.code.replace('Q', '')}</span>
          <Tooltip title={indicator.name}>
            <span className={styles.indicatorName}>{indicator.shortName}</span>
          </Tooltip>
          {isMaterialType && <Tag icon={<FileTextOutlined />} className={styles.typeTag}>佐证</Tag>}
          <span className={valueClass}>{indicator.displayValue || '-'}</span>
          <span className={styles.indicatorThreshold}>标准: {indicator.threshold}</span>
          <span className={styles.statusTag}>{statusTag}</span>
          <Tooltip title="查看数据来源和计算公式">
            <InfoCircleOutlined
              style={{ color: '#1890ff', cursor: 'pointer', marginLeft: 8 }}
              onClick={handleShowDetail}
            />
          </Tooltip>
        </div>
      ),
      isLeaf: true,
    };
  };

  // 渲染社会认可度指标节点
  const renderSocialRecogIndicatorNode = (indicator: SocialRecognitionIndicator): DataNode => {
    let statusTag;
    let valueClass = styles.indicatorValue;

    if (indicator.isCompliant === null) {
      statusTag = <Tag color="default">{indicator.displayValue || '待填报'}</Tag>;
      valueClass += ` ${styles.pending}`;
    } else {
      statusTag = indicator.isCompliant ? (
        <Tag icon={<CheckCircleOutlined />} color="success">达标</Tag>
      ) : (
        <Tag icon={<CloseCircleOutlined />} color="error">未达标</Tag>
      );
      valueClass += indicator.isCompliant ? ` ${styles.compliant}` : ` ${styles.nonCompliant}`;
    }

    const handleShowDetail = (e: React.MouseEvent) => {
      e.stopPropagation();
      setSelectedIndicator({
        code: indicator.code,
        name: indicator.name,
        shortName: indicator.shortName,
        type: indicator.type,
        threshold: indicator.threshold,
        description: indicator.description,
        value: indicator.value,
        displayValue: indicator.displayValue,
        isCompliant: indicator.isCompliant,
        details: indicator.details,
        dataSource: 'district',
      });
      setIndicatorDetailVisible(true);
    };

    return {
      key: `social-${indicator.code}`,
      title: (
        <div className={styles.indicatorTitle}>
          <span className={styles.indicatorCode}>{indicator.code.replace('S', '')}</span>
          <Tooltip title={indicator.name}>
            <span className={styles.indicatorName}>{indicator.shortName}</span>
          </Tooltip>
          <span className={valueClass}>{indicator.displayValue || '-'}</span>
          <span className={styles.indicatorThreshold}>标准: {indicator.threshold}</span>
          <span className={styles.statusTag}>{statusTag}</span>
          <Tooltip title="查看数据来源和计算公式">
            <InfoCircleOutlined
              style={{ color: '#1890ff', cursor: 'pointer', marginLeft: 8 }}
              onClick={handleShowDetail}
            />
          </Tooltip>
        </div>
      ),
      isLeaf: true,
    };
  };

  // 构建树形数据
  const treeData = useMemo((): DataNode[] => {
    const nodes: DataNode[] = [];

    // 一、资源配置指标
    const resourceChildren: DataNode[] = [];

    // 七项指标达标率（学校级别）- 放在第一位
    const primaryOverallCompliance = primaryData?.summary?.overallCompliance;
    const juniorOverallCompliance = juniorData?.summary?.overallCompliance;
    if (primaryOverallCompliance || juniorOverallCompliance) {
      const overallChildren: DataNode[] = [];

      // 小学七项指标达标率详情
      if (primaryOverallCompliance) {
        overallChildren.push({
          key: 'overall-primary',
          title: (
            <div className={styles.indicatorTitle}>
              <span className={styles.indicatorCode}>小学</span>
              <span className={styles.indicatorName}>各校7项指标达标率</span>
              <span className={styles.indicatorValue}>
                {primaryOverallCompliance.compliantSchools}/{primaryData?.summary?.schoolCount || 0} 所达标
              </span>
              <span className={styles.indicatorThreshold}>标准: 至少6项达标，余项≥85%</span>
              <Tag
                icon={primaryOverallCompliance.allSchoolsCompliant ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                color={primaryOverallCompliance.allSchoolsCompliant ? 'success' : 'error'}
              >
                {primaryOverallCompliance.allSchoolsCompliant ? '全部达标' : '未全部达标'}
              </Tag>
            </div>
          ),
          isLeaf: true,
        });
      }

      // 初中七项指标达标率详情
      if (juniorOverallCompliance) {
        overallChildren.push({
          key: 'overall-junior',
          title: (
            <div className={styles.indicatorTitle}>
              <span className={styles.indicatorCode}>初中</span>
              <span className={styles.indicatorName}>各校7项指标达标率</span>
              <span className={styles.indicatorValue}>
                {juniorOverallCompliance.compliantSchools}/{juniorData?.summary?.schoolCount || 0} 所达标
              </span>
              <span className={styles.indicatorThreshold}>标准: 至少6项达标，余项≥85%</span>
              <Tag
                icon={juniorOverallCompliance.allSchoolsCompliant ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                color={juniorOverallCompliance.allSchoolsCompliant ? 'success' : 'error'}
              >
                {juniorOverallCompliance.allSchoolsCompliant ? '全部达标' : '未全部达标'}
              </Tag>
            </div>
          ),
          isLeaf: true,
        });
      }

      const totalSchoolsForOverall = (primaryData?.summary?.schoolCount || 0) + (juniorData?.summary?.schoolCount || 0);
      const compliantSchoolsForOverall = (primaryOverallCompliance?.compliantSchools || 0) + (juniorOverallCompliance?.compliantSchools || 0);
      const allSchoolsCompliantForOverall = (primaryOverallCompliance?.allSchoolsCompliant ?? true) && (juniorOverallCompliance?.allSchoolsCompliant ?? true);

      resourceChildren.push({
        key: 'resource-overall-compliance',
        title: (
          <div className={styles.schoolTypeTitle}>
            <span className={styles.schoolTypeName}>
              <SafetyOutlined style={{ color: '#fa8c16' }} />
              七项指标达标率
            </span>
            <div className={styles.dimensionStats}>
              <Tooltip title="各学校7项资源配置指标达标情况（至少6项达标，余项≥85%）">
                <Tag
                  icon={allSchoolsCompliantForOverall ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                  color={allSchoolsCompliantForOverall ? 'success' : 'error'}
                >
                  {compliantSchoolsForOverall}/{totalSchoolsForOverall} 所学校达标
                </Tag>
              </Tooltip>
              <Button
                type="link"
                size="small"
                icon={<EyeOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  setSchoolModalTab('primary');
                  setSchoolModalVisible(true);
                }}
                className={styles.detailButton}
              >
                查看学校详情
              </Button>
            </div>
          </div>
        ),
        children: overallChildren,
      });
    }

    // 小学
    if (primaryData?.summary?.cvIndicators) {
      const primaryCompliant = primaryData.summary.cvIndicators.filter(cv => cv.isCompliant === true).length;
      const primaryTotal = primaryData.summary.cvIndicators.length;
      const primaryOverall = primaryData.summary.overallCompliance;
      resourceChildren.push({
        key: 'resource-primary',
        title: (
          <div className={styles.schoolTypeTitle}>
            <span className={styles.schoolTypeName}>
              <TeamOutlined style={{ color: '#1890ff' }} />
              小学（差异系数 ≤0.50）
            </span>
            <div className={styles.dimensionStats}>
              <Tooltip title="7项差异系数达标情况">
                <Tag color={primaryData.summary.allCompliant ? 'success' : 'error'}>
                  差异系数 {primaryCompliant}/{primaryTotal}
                </Tag>
              </Tooltip>
              {primaryOverall && (
                <Tooltip title="各学校7项指标达标率（至少6项达标，余项≥85%）">
                  <Tag color={primaryOverall.allSchoolsCompliant ? 'success' : 'error'}>
                    学校达标 {primaryOverall.compliantSchools}/{primaryData.summary.schoolCount}
                  </Tag>
                </Tooltip>
              )}
              <Button
                type="link"
                size="small"
                icon={<EyeOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  setSchoolModalTab('primary');
                  setSchoolModalVisible(true);
                }}
                className={styles.detailButton}
              >
                查看学校详情
              </Button>
            </div>
          </div>
        ),
        isLeaf: true,
      });
    }

    // 初中
    if (juniorData?.summary?.cvIndicators) {
      const juniorCompliant = juniorData.summary.cvIndicators.filter(cv => cv.isCompliant === true).length;
      const juniorTotal = juniorData.summary.cvIndicators.length;
      const juniorOverall = juniorData.summary.overallCompliance;
      resourceChildren.push({
        key: 'resource-junior',
        title: (
          <div className={styles.schoolTypeTitle}>
            <span className={styles.schoolTypeName}>
              <TeamOutlined style={{ color: '#52c41a' }} />
              初中（差异系数 ≤0.45）
            </span>
            <div className={styles.dimensionStats}>
              <Tooltip title="7项差异系数达标情况">
                <Tag color={juniorData.summary.allCompliant ? 'success' : 'error'}>
                  差异系数 {juniorCompliant}/{juniorTotal}
                </Tag>
              </Tooltip>
              {juniorOverall && (
                <Tooltip title="各学校7项指标达标率（至少6项达标，余项≥85%）">
                  <Tag color={juniorOverall.allSchoolsCompliant ? 'success' : 'error'}>
                    学校达标 {juniorOverall.compliantSchools}/{juniorData.summary.schoolCount}
                  </Tag>
                </Tooltip>
              )}
              <Button
                type="link"
                size="small"
                icon={<EyeOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  setSchoolModalTab('junior');
                  setSchoolModalVisible(true);
                }}
                className={styles.detailButton}
              >
                查看学校详情
              </Button>
            </div>
          </div>
        ),
        isLeaf: true,
      });
    }

    // 资源配置汇总
    const resourceCompliant = (primaryData?.summary?.compliantCvCount || 0) + (juniorData?.summary?.compliantCvCount || 0);
    const resourceTotal = (primaryData?.summary?.totalCvCount || 0) + (juniorData?.summary?.totalCvCount || 0);
    const resourceAllCompliant = primaryData?.summary?.allCompliant && juniorData?.summary?.allCompliant;

    // 学校达标率汇总
    const totalSchools = (primaryData?.summary?.schoolCount || 0) + (juniorData?.summary?.schoolCount || 0);
    const compliantSchools = (primaryData?.summary?.overallCompliance?.compliantSchools || 0) +
      (juniorData?.summary?.overallCompliance?.compliantSchools || 0);
    const allSchoolsCompliant = primaryData?.summary?.overallCompliance?.allSchoolsCompliant &&
      juniorData?.summary?.overallCompliance?.allSchoolsCompliant;

    // 判断数据是否已加载（非 loading 状态且有数据对象）
    const resourceDataLoaded = !loading && (primaryData !== null || juniorData !== null);

    nodes.push({
      key: 'dimension-resource',
      title: (
        <div className={styles.dimensionTitle}>
          <span className={styles.dimensionName}>
            <BarChartOutlined className={styles.dimensionIcon} style={{ color: '#1890ff' }} />
            一、资源配置指标（7项差异系数 × 2）
          </span>
          <div className={styles.dimensionStats}>
            {resourceDataLoaded ? (
              <>
                <Tooltip title="7项差异系数达标情况（小学+初中）">
                  {resourceAllCompliant === null ? (
                    <Tag icon={<ExclamationCircleOutlined />} color="warning">
                      差异系数 {resourceCompliant}/{resourceTotal} 待计算
                    </Tag>
                  ) : (
                    <Tag icon={resourceAllCompliant ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                      color={resourceAllCompliant ? 'success' : 'error'}>
                      差异系数 {resourceCompliant}/{resourceTotal}
                    </Tag>
                  )}
                </Tooltip>
                {totalSchools > 0 && (
                  <Tooltip title="各学校7项指标达标率（至少6项达标，余项≥85%）">
                    <Tag icon={allSchoolsCompliant ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                      color={allSchoolsCompliant ? 'success' : 'error'}>
                      学校达标 {compliantSchools}/{totalSchools}
                    </Tag>
                  </Tooltip>
                )}
              </>
            ) : (
              <Tag color="default">加载中...</Tag>
            )}
          </div>
        </div>
      ),
      children: resourceChildren,
    });

    // 二、政府保障程度
    if (govData?.indicators) {
      nodes.push({
        key: 'dimension-gov',
        title: (
          <div className={styles.dimensionTitle}>
            <span className={styles.dimensionName}>
              <BankOutlined className={styles.dimensionIcon} style={{ color: '#722ed1' }} />
              二、政府保障程度（15项指标）
            </span>
            <div className={styles.dimensionStats}>
              {govData.summary.allCompliant === null ? (
                <Tag icon={<ExclamationCircleOutlined />} color="warning">
                  {govData.summary.compliantCount}/{govData.summary.totalCount} 项达标，{govData.summary.pendingCount} 项待填报
                </Tag>
              ) : govData.summary.allCompliant ? (
                <Tag icon={<CheckCircleOutlined />} color="success">
                  {govData.summary.compliantCount}/{govData.summary.totalCount} 项全部达标
                </Tag>
              ) : (
                <Tag icon={<CloseCircleOutlined />} color="error">
                  {govData.summary.compliantCount}/{govData.summary.totalCount} 项达标
                </Tag>
              )}
            </div>
          </div>
        ),
        children: govData.indicators.map(renderGovIndicatorNode),
      });
    }

    // 三、教育质量
    if (eduQualityData?.indicators) {
      nodes.push({
        key: 'dimension-edu',
        title: (
          <div className={styles.dimensionTitle}>
            <span className={styles.dimensionName}>
              <FileTextOutlined className={styles.dimensionIcon} style={{ color: '#52c41a' }} />
              三、教育质量（9项指标）
            </span>
            <div className={styles.dimensionStats}>
              {eduQualityData.summary.allCompliant === null ? (
                <Tag icon={<ExclamationCircleOutlined />} color="warning">
                  {eduQualityData.summary.compliantCount}/{eduQualityData.summary.totalCount} 项达标，{eduQualityData.summary.pendingCount} 项待填报
                </Tag>
              ) : eduQualityData.summary.allCompliant ? (
                <Tag icon={<CheckCircleOutlined />} color="success">
                  {eduQualityData.summary.compliantCount}/{eduQualityData.summary.totalCount} 项全部达标
                </Tag>
              ) : (
                <Tag icon={<CloseCircleOutlined />} color="error">
                  {eduQualityData.summary.compliantCount}/{eduQualityData.summary.totalCount} 项达标
                </Tag>
              )}
            </div>
          </div>
        ),
        children: eduQualityData.indicators.map(renderEduQualityIndicatorNode),
      });
    }

    // 四、社会认可度
    if (socialRecogData?.indicators) {
      nodes.push({
        key: 'dimension-social',
        title: (
          <div className={styles.dimensionTitle}>
            <span className={styles.dimensionName}>
              <HeartOutlined className={styles.dimensionIcon} style={{ color: '#eb2f96' }} />
              四、社会认可度（1项指标）
            </span>
            <div className={styles.dimensionStats}>
              {socialRecogData.summary.allCompliant === null ? (
                <Tag icon={<ExclamationCircleOutlined />} color="warning">
                  {socialRecogData.summary.compliantCount}/{socialRecogData.summary.totalCount} 项达标，{socialRecogData.summary.pendingCount} 项待填报
                </Tag>
              ) : socialRecogData.summary.allCompliant ? (
                <Tag icon={<CheckCircleOutlined />} color="success">
                  {socialRecogData.summary.compliantCount}/{socialRecogData.summary.totalCount} 项全部达标
                </Tag>
              ) : (
                <Tag icon={<CloseCircleOutlined />} color="error">
                  {socialRecogData.summary.compliantCount}/{socialRecogData.summary.totalCount} 项达标
                </Tag>
              )}
            </div>
          </div>
        ),
        children: socialRecogData.indicators.map(renderSocialRecogIndicatorNode),
      });
    }

    return nodes;
  }, [primaryData, juniorData, govData, eduQualityData, socialRecogData, loading]);

  // 计算总体汇总
  const overallSummary = useMemo(() => {
    const resourceCompliant = (primaryData?.summary?.compliantCvCount || 0) + (juniorData?.summary?.compliantCvCount || 0);
    const resourceTotal = (primaryData?.summary?.totalCvCount || 0) + (juniorData?.summary?.totalCvCount || 0);
    const govCompliant = govData?.summary?.compliantCount || 0;
    const govTotal = govData?.summary?.totalCount || 0;
    const eduCompliant = eduQualityData?.summary?.compliantCount || 0;
    const eduTotal = eduQualityData?.summary?.totalCount || 0;
    const socialCompliant = socialRecogData?.summary?.compliantCount || 0;
    const socialTotal = socialRecogData?.summary?.totalCount || 0;

    const totalCompliant = resourceCompliant + govCompliant + eduCompliant + socialCompliant;
    const totalIndicators = resourceTotal + govTotal + eduTotal + socialTotal;

    const pendingCount = (govData?.summary?.pendingCount || 0) +
      (eduQualityData?.summary?.pendingCount || 0) +
      (socialRecogData?.summary?.pendingCount || 0);

    const allCompliant = totalIndicators > 0 && totalCompliant === totalIndicators && pendingCount === 0;

    return {
      totalCompliant,
      totalIndicators,
      pendingCount,
      allCompliant,
    };
  }, [primaryData, juniorData, govData, eduQualityData, socialRecogData]);

  // 默认全部展开 - 当所有数据加载完成后展开
  const isAllDataLoaded = !loading && !govLoading && !eduQualityLoading && !socialRecogLoading;

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

  if (!projectId) {
    return <Empty description="请先选择项目" />;
  }

  const isLoading = loading || govLoading || eduQualityLoading || socialRecogLoading;

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
              <span className={styles.statValue} style={{ color: '#1890ff' }}>
                {overallSummary.totalCompliant}/{overallSummary.totalIndicators}
              </span>
              <span className={styles.statLabel}>指标达标</span>
            </div>
            <Divider type="vertical" style={{ height: 40 }} />
            <Tooltip title="7项差异系数达标（小学+初中）">
              <div className={styles.statItem}>
                <span className={styles.statValue} style={{ color: '#1890ff' }}>
                  {(primaryData?.summary?.compliantCvCount || 0) + (juniorData?.summary?.compliantCvCount || 0)}/
                  {(primaryData?.summary?.totalCvCount || 0) + (juniorData?.summary?.totalCvCount || 0)}
                </span>
                <span className={styles.statLabel}>差异系数</span>
              </div>
            </Tooltip>
            <Tooltip title="各学校7项指标达标率（至少6项达标，余项≥85%）">
              <div className={styles.statItem}>
                <span className={styles.statValue} style={{ color: '#52c41a' }}>
                  {(primaryData?.summary?.overallCompliance?.compliantSchools || 0) +
                    (juniorData?.summary?.overallCompliance?.compliantSchools || 0)}/
                  {(primaryData?.summary?.schoolCount || 0) + (juniorData?.summary?.schoolCount || 0)}
                </span>
                <span className={styles.statLabel}>学校达标</span>
              </div>
            </Tooltip>
            <div className={styles.statItem}>
              <span className={styles.statValue} style={{ color: '#722ed1' }}>
                {govData?.summary?.compliantCount || 0}/{govData?.summary?.totalCount || 0}
              </span>
              <span className={styles.statLabel}>政府保障</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statValue} style={{ color: '#52c41a' }}>
                {eduQualityData?.summary?.compliantCount || 0}/{eduQualityData?.summary?.totalCount || 0}
              </span>
              <span className={styles.statLabel}>教育质量</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statValue} style={{ color: '#eb2f96' }}>
                {socialRecogData?.summary?.compliantCount || 0}/{socialRecogData?.summary?.totalCount || 0}
              </span>
              <span className={styles.statLabel}>社会认可</span>
            </div>
          </div>
          <div className={`${styles.summaryLevel} ${overallSummary.allCompliant ? styles.excellence : styles.nonCompliant}`}>
            <span className={styles.levelLabel}>综合判定</span>
            <span className={`${styles.levelValue} ${overallSummary.allCompliant ? styles.excellence : styles.nonCompliant}`}>
              {overallSummary.pendingCount > 0
                ? '待完善'
                : overallSummary.allCompliant
                ? '全部达标'
                : '未全部达标'}
            </span>
            {overallSummary.pendingCount > 0 && (
              <Tag color="warning" style={{ marginTop: 4 }}>
                {overallSummary.pendingCount} 项待填报
              </Tag>
            )}
          </div>
        </div>
      </Card>

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

      {/* 学校详情弹窗 */}
      <SchoolDetailModal
        visible={schoolModalVisible}
        onClose={() => setSchoolModalVisible(false)}
        primaryData={primaryData}
        juniorData={juniorData}
        defaultTab={schoolModalTab}
      />

      {/* 指标详情弹窗 */}
      <IndicatorDetailModal
        visible={indicatorDetailVisible}
        onClose={() => setIndicatorDetailVisible(false)}
        indicator={selectedIndicator}
      />
    </div>
  );
};

export default BalancedIndicatorSummary;
