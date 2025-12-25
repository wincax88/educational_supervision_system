/**
 * 优质均衡指标汇总组件 - 树形结构版（按指标体系层级渲染）
 *
 * 按照《义务教育优质均衡督导评估指标体系》结构显示：
 * - L1: 四大维度（资源配置、政府保障程度、教育质量、社会认可度）
 * - L2: 各维度下的具体指标项（如1.1区级资源配置综合评价、2.1规划布局等）
 * - 数据指标: 每个L2项下的dataIndicators，显示计算结果
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
  BankOutlined,
  BarChartOutlined,
  HeartOutlined,
  EyeOutlined,
  UploadOutlined,
  InfoCircleOutlined,
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

// 指标体系数据指标定义
interface DataIndicatorDef {
  id: string;
  code: string;
  name: string;
  threshold: string;
  apiCode?: string;  // 后端API返回的指标代码，如 G1, Q1
  unit?: string;
}

// 指标体系L2层级定义
interface L2IndicatorDef {
  id: string;
  code: string;
  name: string;
  dataIndicators: DataIndicatorDef[];
  supportingMaterials: { id: string; code: string; name: string }[];
}

// 指标体系L1层级定义
interface L1DimensionDef {
  id: string;
  code: string;
  name: string;
  children: L2IndicatorDef[];
}

// 指标体系结构定义（简化版，仅包含树形渲染所需信息）
const INDICATOR_SYSTEM: L1DimensionDef[] = [
  {
    id: 'SY-YZJH-1',
    code: '1',
    name: '资源配置（需计算差异系数）',
    children: [
      {
        id: 'SY-YZJH-1-1',
        code: '1.1',
        name: '区级资源配置综合评价',
        dataIndicators: [
          { id: 'SY-YZJH-1-1-D1', code: '1.1-D1', name: '【区】七项指标达标率', threshold: '= 100%', unit: '%' },
          { id: 'SY-YZJH-1-1-D2', code: '1.1-D2', name: '【区】小学校际差异系数', threshold: '<= 0.50' },
          { id: 'SY-YZJH-1-1-D3', code: '1.1-D3', name: '【区】初中校际差异系数', threshold: '<= 0.45' },
        ],
        supportingMaterials: [],
      },
    ],
  },
  {
    id: 'SY-YZJH-2',
    code: '2',
    name: '政府保障程度',
    children: [
      { id: 'SY-YZJH-2-1', code: '2.1', name: '县域内义务教育学校规划布局合理', dataIndicators: [], supportingMaterials: [{ id: 'SY-YZJH-2-1-M1', code: '2.1-M1', name: '规划布局佐证材料' }] },
      { id: 'SY-YZJH-2-2', code: '2.2', name: '城乡义务教育学校建设标准统一', dataIndicators: [
        { id: 'SY-YZJH-2-2-D1', code: '2.2-D1', name: '规定的小学生均公用经费标准', threshold: '>= 1150', unit: '元', apiCode: 'G2' },
        { id: 'SY-YZJH-2-2-D2', code: '2.2-D2', name: '规定的初中生均公用经费标准', threshold: '>= 1350', unit: '元', apiCode: 'G2' },
      ], supportingMaterials: [] },
      { id: 'SY-YZJH-2-3', code: '2.3', name: '每12个班级配备音乐、美术专用教室1间以上', dataIndicators: [
        { id: 'SY-YZJH-2-3-D1', code: '2.3-D1', name: '音乐、美术专用教室配置与面积达标', threshold: '达标', apiCode: 'G3' },
      ], supportingMaterials: [] },
      { id: 'SY-YZJH-2-4', code: '2.4', name: '学校规模控制达标', dataIndicators: [
        { id: 'SY-YZJH-2-4-D1', code: '2.4-D1', name: '超规模学校数（小学）', threshold: '= 0', unit: '所', apiCode: 'G4' },
        { id: 'SY-YZJH-2-4-D2', code: '2.4-D2', name: '超规模学校数（初中）', threshold: '= 0', unit: '所', apiCode: 'G4' },
        { id: 'SY-YZJH-2-4-D3', code: '2.4-D3', name: '超规模学校数（九/十二年一贯制）', threshold: '= 0', unit: '所', apiCode: 'G4' },
      ], supportingMaterials: [] },
      { id: 'SY-YZJH-2-5', code: '2.5', name: '班级学生数控制达标', dataIndicators: [
        { id: 'SY-YZJH-2-5-D1', code: '2.5-D1', name: '超45人小学班级数', threshold: '= 0', unit: '个', apiCode: 'G5' },
        { id: 'SY-YZJH-2-5-D2', code: '2.5-D2', name: '超50人初中班级数', threshold: '= 0', unit: '个', apiCode: 'G5' },
      ], supportingMaterials: [] },
      { id: 'SY-YZJH-2-6', code: '2.6', name: '不足100人的规模较小学校按不低于100人核定公用经费', dataIndicators: [
        { id: 'SY-YZJH-2-6-D1', code: '2.6-D1', name: '小规模学校公用经费核定达标', threshold: '达标', apiCode: 'G6' },
      ], supportingMaterials: [] },
      { id: 'SY-YZJH-2-7', code: '2.7', name: '特殊教育学校生均公用经费不低于8000元', dataIndicators: [
        { id: 'SY-YZJH-2-7-D1', code: '2.7-D1', name: '特殊教育学校生均公用经费', threshold: '>= 8000', unit: '元', apiCode: 'G7' },
      ], supportingMaterials: [] },
      { id: 'SY-YZJH-2-8', code: '2.8', name: '义务教育学校教师平均工资不低于当地公务员', dataIndicators: [
        { id: 'SY-YZJH-2-8-D1', code: '2.8-D1', name: '教师年平均工资收入不低于公务员', threshold: '达标', apiCode: 'G8' },
      ], supportingMaterials: [] },
      { id: 'SY-YZJH-2-9', code: '2.9', name: '教师5年360学时培训完成率达到100%', dataIndicators: [
        { id: 'SY-YZJH-2-9-D1', code: '2.9-D1', name: '教师5年360学时培训完成率', threshold: '>= 100%', unit: '%', apiCode: 'G9' },
      ], supportingMaterials: [] },
      { id: 'SY-YZJH-2-10', code: '2.10', name: '县级教育行政部门统筹分配各校教职工编制', dataIndicators: [], supportingMaterials: [{ id: 'SY-YZJH-2-10-M1', code: '2.10-M1', name: '编制与岗位统筹分配佐证材料' }] },
      { id: 'SY-YZJH-2-11', code: '2.11', name: '教师交流轮岗比例达标', dataIndicators: [
        { id: 'SY-YZJH-2-11-D1', code: '2.11-D1', name: '交流轮岗教师比例', threshold: '>= 10%', unit: '%', apiCode: 'G11' },
        { id: 'SY-YZJH-2-11-D2', code: '2.11-D2', name: '交流轮岗骨干教师比例', threshold: '>= 20%', unit: '%', apiCode: 'G11' },
      ], supportingMaterials: [] },
      { id: 'SY-YZJH-2-12', code: '2.12', name: '专任教师持证上岗率达到100%', dataIndicators: [
        { id: 'SY-YZJH-2-12-D1', code: '2.12-D1', name: '教师资格证持证上岗率', threshold: '>= 100%', unit: '%', apiCode: 'G12' },
      ], supportingMaterials: [] },
      { id: 'SY-YZJH-2-13', code: '2.13', name: '就近划片入学比例达标', dataIndicators: [
        { id: 'SY-YZJH-2-13-D1', code: '2.13-D1', name: '就近划片入学比例（小学）', threshold: '>= 100%', unit: '%', apiCode: 'G13' },
        { id: 'SY-YZJH-2-13-D2', code: '2.13-D2', name: '就近划片入学比例（初中）', threshold: '>= 95%', unit: '%', apiCode: 'G13' },
      ], supportingMaterials: [] },
      { id: 'SY-YZJH-2-14', code: '2.14', name: '优质高中招生名额分配比例不低于50%', dataIndicators: [
        { id: 'SY-YZJH-2-14-D1', code: '2.14-D1', name: '优质高中招生名额分配比例', threshold: '>= 50%', unit: '%', apiCode: 'G14' },
      ], supportingMaterials: [] },
      { id: 'SY-YZJH-2-15', code: '2.15', name: '留守儿童关爱体系健全，随迁子女就读比例≥85%', dataIndicators: [
        { id: 'SY-YZJH-2-15-D1', code: '2.15-D1', name: '随迁子女就读比例', threshold: '>= 85%', unit: '%', apiCode: 'G15' },
      ], supportingMaterials: [] },
    ],
  },
  {
    id: 'SY-YZJH-3',
    code: '3',
    name: '教育质量',
    children: [
      { id: 'SY-YZJH-3-1', code: '3.1', name: '初中三年巩固率达到95%以上', dataIndicators: [
        { id: 'SY-YZJH-3-1-D1', code: '3.1-D1', name: '初中三年巩固率', threshold: '>= 95%', unit: '%', apiCode: 'Q1' },
      ], supportingMaterials: [] },
      { id: 'SY-YZJH-3-2', code: '3.2', name: '残疾儿童少年入学率达到95%以上', dataIndicators: [
        { id: 'SY-YZJH-3-2-D1', code: '3.2-D1', name: '残疾儿童少年入学率', threshold: '>= 95%', unit: '%', apiCode: 'Q2' },
      ], supportingMaterials: [] },
      { id: 'SY-YZJH-3-3', code: '3.3', name: '所有学校制定章程，实现学校管理与教学信息化', dataIndicators: [], supportingMaterials: [{ id: 'SY-YZJH-3-3-M1', code: '3.3-M1', name: '学校章程与信息化材料' }] },
      { id: 'SY-YZJH-3-4', code: '3.4', name: '教师培训经费占公用经费预算不低于5%', dataIndicators: [
        { id: 'SY-YZJH-3-4-D1', code: '3.4-D1', name: '教师培训经费占公用经费预算比例', threshold: '>= 5%', unit: '%', apiCode: 'Q4' },
      ], supportingMaterials: [] },
      { id: 'SY-YZJH-3-5', code: '3.5', name: '教师能熟练运用信息化手段组织教学', dataIndicators: [], supportingMaterials: [{ id: 'SY-YZJH-3-5-M1', code: '3.5-M1', name: '信息化教学应用佐证' }] },
      { id: 'SY-YZJH-3-6', code: '3.6', name: '德育工作与校园文化建设达到良好以上', dataIndicators: [], supportingMaterials: [{ id: 'SY-YZJH-3-6-M1', code: '3.6-M1', name: '德育与校园文化建设佐证' }] },
      { id: 'SY-YZJH-3-7', code: '3.7', name: '课程开齐开足，教学秩序规范', dataIndicators: [], supportingMaterials: [{ id: 'SY-YZJH-3-7-M1', code: '3.7-M1', name: '课程实施与教学秩序佐证' }] },
      { id: 'SY-YZJH-3-8', code: '3.8', name: '无过重课业负担', dataIndicators: [], supportingMaterials: [{ id: 'SY-YZJH-3-8-M1', code: '3.8-M1', name: '作业管理与课业负担佐证' }] },
      { id: 'SY-YZJH-3-9', code: '3.9', name: '国家义务教育质量监测达标', dataIndicators: [
        { id: 'SY-YZJH-3-9-D1', code: '3.9-D1', name: '语文学业水平等级', threshold: '>= Ⅲ级', apiCode: 'Q9' },
        { id: 'SY-YZJH-3-9-D2', code: '3.9-D2', name: '语文校际差异率', threshold: '< 0.15', apiCode: 'Q9' },
        { id: 'SY-YZJH-3-9-D3', code: '3.9-D3', name: '数学学业水平等级', threshold: '>= Ⅲ级', apiCode: 'Q9' },
        { id: 'SY-YZJH-3-9-D4', code: '3.9-D4', name: '数学校际差异率', threshold: '< 0.15', apiCode: 'Q9' },
        { id: 'SY-YZJH-3-9-D5', code: '3.9-D5', name: '科学学业水平等级', threshold: '>= Ⅲ级', apiCode: 'Q9' },
        { id: 'SY-YZJH-3-9-D6', code: '3.9-D6', name: '科学校际差异率', threshold: '< 0.15', apiCode: 'Q9' },
        { id: 'SY-YZJH-3-9-D7', code: '3.9-D7', name: '体育学业水平等级', threshold: '>= Ⅲ级', apiCode: 'Q9' },
        { id: 'SY-YZJH-3-9-D8', code: '3.9-D8', name: '体育校际差异率', threshold: '< 0.15', apiCode: 'Q9' },
        { id: 'SY-YZJH-3-9-D9', code: '3.9-D9', name: '艺术学业水平等级', threshold: '>= Ⅲ级', apiCode: 'Q9' },
        { id: 'SY-YZJH-3-9-D10', code: '3.9-D10', name: '艺术校际差异率', threshold: '< 0.15', apiCode: 'Q9' },
        { id: 'SY-YZJH-3-9-D11', code: '3.9-D11', name: '德育学业水平等级', threshold: '>= Ⅲ级', apiCode: 'Q9' },
        { id: 'SY-YZJH-3-9-D12', code: '3.9-D12', name: '德育校际差异率', threshold: '< 0.15', apiCode: 'Q9' },
      ], supportingMaterials: [] },
    ],
  },
  {
    id: 'SY-YZJH-4',
    code: '4',
    name: '社会认可度',
    children: [
      { id: 'SY-YZJH-4-1', code: '4.1', name: '社会认可度达到85%以上', dataIndicators: [
        { id: 'SY-YZJH-4-1-D1', code: '4.1-D1', name: '问卷调查综合满意度', threshold: '>= 85%', unit: '%', apiCode: 'S1' },
        { id: 'SY-YZJH-4-1-D2', code: '4.1-D2', name: '实地走访满意度', threshold: '>= 85%', unit: '%', apiCode: 'S2' },
      ], supportingMaterials: [] },
    ],
  },
];

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

  // 获取维度图标
  const getDimensionIcon = (code: string) => {
    switch (code) {
      case '1': return <BarChartOutlined className={styles.dimensionIcon} style={{ color: '#1890ff' }} />;
      case '2': return <BankOutlined className={styles.dimensionIcon} style={{ color: '#722ed1' }} />;
      case '3': return <FileTextOutlined className={styles.dimensionIcon} style={{ color: '#52c41a' }} />;
      case '4': return <HeartOutlined className={styles.dimensionIcon} style={{ color: '#eb2f96' }} />;
      default: return <FolderOutlined />;
    }
  };

  // 显示指标详情
  const handleShowIndicatorDetail = (indicator: IndicatorDetail) => {
    setSelectedIndicator(indicator);
    setIndicatorDetailVisible(true);
  };

  // 渲染数据指标节点（带计算结果）
  const renderDataIndicatorNode = (
    indicator: DataIndicatorDef,
    value: string | number | null,
    isCompliant: boolean | null,
    displayValue?: string,
    apiIndicator?: GovernmentGuaranteeIndicator | EducationQualityIndicator | SocialRecognitionIndicator
  ): DataNode => {
    let statusTag;
    let valueClass = styles.indicatorValue;

    if (isCompliant === null) {
      statusTag = <Tag color="default">待填报</Tag>;
      valueClass += ` ${styles.pending}`;
    } else {
      statusTag = isCompliant ? (
        <Tag icon={<CheckCircleOutlined />} color="success">达标</Tag>
      ) : (
        <Tag icon={<CloseCircleOutlined />} color="error">未达标</Tag>
      );
      valueClass += isCompliant ? ` ${styles.compliant}` : ` ${styles.nonCompliant}`;
    }

    // 构建详情数据
    const detailData: IndicatorDetail = {
      code: indicator.code,
      name: indicator.name,
      type: 'data',
      threshold: indicator.threshold,
      value: value,
      displayValue: displayValue || (value !== null ? `${value}${indicator.unit || ''}` : null),
      isCompliant: isCompliant,
      unit: indicator.unit,
      // 从API指标中获取详细信息
      ...(apiIndicator && {
        details: (apiIndicator as any).details,
        dataSource: (apiIndicator as any).dataSource,
        formula: (apiIndicator as any).formula,
        description: (apiIndicator as any).description,
      }),
    };

    return {
      key: `data-${indicator.id}`,
      title: (
        <div className={styles.indicatorTitle}>
          <Tag color="blue" className={styles.typeTag}>数据指标</Tag>
          <span className={styles.indicatorCode}>{indicator.code}</span>
          <Tooltip title={indicator.name}>
            <span className={styles.indicatorName}>{indicator.name}</span>
          </Tooltip>
          <span className={valueClass}>
            {displayValue || (value !== null ? `${value}${indicator.unit || ''}` : '-')}
          </span>
          <span className={styles.indicatorThreshold}>{indicator.threshold}</span>
          <span className={styles.statusTag}>{statusTag}</span>
          <Tooltip title="查看数据来源和计算公式">
            <InfoCircleOutlined
              style={{ color: '#1890ff', cursor: 'pointer', marginLeft: 8 }}
              onClick={(e) => {
                e.stopPropagation();
                handleShowIndicatorDetail(detailData);
              }}
            />
          </Tooltip>
        </div>
      ),
      isLeaf: true,
    };
  };

  // 渲染佐证材料节点
  const renderMaterialNode = (
    material: { id: string; code: string; name: string },
    uploadStatus?: string,
    isCompliant?: boolean | null,
    dataSource?: 'district' | 'school_aggregate'
  ): DataNode => {
    // 根据数据来源确定说明文案
    const sourceDescription = dataSource === 'district'
      ? '由区县教育行政部门上传相关佐证材料'
      : '由各学校上传相关佐证材料，系统汇总统计上传情况';

    // 构建详情数据
    const detailData: IndicatorDetail = {
      code: material.code,
      name: material.name,
      type: 'material',
      threshold: '上传佐证材料',
      value: uploadStatus || null,
      displayValue: uploadStatus || '待上传',
      isCompliant: isCompliant ?? null,
      dataSource: dataSource || 'school_aggregate',
      formula: sourceDescription,
    };

    // 根据达标状态显示状态标签（与数据指标保持一致）
    let statusTag;
    let valueClass = styles.indicatorValue;

    if (isCompliant === null) {
      statusTag = <Tag color="default">待填报</Tag>;
      valueClass += ` ${styles.pending}`;
    } else {
      statusTag = isCompliant ? (
        <Tag icon={<CheckCircleOutlined />} color="success">达标</Tag>
      ) : (
        <Tag icon={<CloseCircleOutlined />} color="error">未达标</Tag>
      );
      valueClass += isCompliant ? ` ${styles.compliant}` : ` ${styles.nonCompliant}`;
    }

    return {
      key: `material-${material.id}`,
      title: (
        <div className={styles.indicatorTitle}>
          <Tag color="blue" className={styles.typeTag}>数据指标</Tag>
          <span className={styles.indicatorCode}>{material.code}</span>
          <Tooltip title={material.name}>
            <span className={styles.indicatorName}>{material.name}</span>
          </Tooltip>
          <span className={valueClass}>
            {uploadStatus || '待上传'}
          </span>
          <span className={styles.indicatorThreshold}>上传佐证材料</span>
          <span className={styles.statusTag}>{statusTag}</span>
          <Tooltip title="查看数据来源和计算公式">
            <InfoCircleOutlined
              style={{ color: '#1890ff', cursor: 'pointer', marginLeft: 8 }}
              onClick={(e) => {
                e.stopPropagation();
                handleShowIndicatorDetail(detailData);
              }}
            />
          </Tooltip>
        </div>
      ),
      isLeaf: true,
    };
  };

  // 构建树形数据 - 按指标体系结构渲染
  const treeData = useMemo((): DataNode[] => {
    const nodes: DataNode[] = [];

    // 创建API数据映射（按指标代码）
    const govIndicatorMap = new Map(govData?.indicators?.map(i => [i.code, i]) || []);
    const eduIndicatorMap = new Map(eduQualityData?.indicators?.map(i => [i.code, i]) || []);
    const socialIndicatorMap = new Map(socialRecogData?.indicators?.map(i => [i.code, i]) || []);

    // 遍历指标体系结构
    INDICATOR_SYSTEM.forEach((dimension, dimIndex) => {
      const dimensionChildren: DataNode[] = [];
      let dimensionCompliant = 0;
      let dimensionTotal = 0;
      let dimensionPending = 0;

      // 处理每个L2指标
      dimension.children.forEach((l2Indicator) => {
        const l2Children: DataNode[] = [];

        // 特殊处理：维度1（资源配置）的数据指标
        if (dimension.code === '1') {
          // 1.1-D1: 七项指标达标率
          if (l2Indicator.code === '1.1') {
            const totalSchools = (primaryData?.summary?.schoolCount || 0) + (juniorData?.summary?.schoolCount || 0);
            const compliantSchools = (primaryData?.summary?.overallCompliance?.compliantSchools || 0) +
              (juniorData?.summary?.overallCompliance?.compliantSchools || 0);
            const rate = totalSchools > 0 ? Math.round((compliantSchools / totalSchools) * 100) : null;

            // D1: 七项指标达标率
            // 构建详情数据 - 显示各学校达标情况
            const d1Details = {
              details: [
                { name: '小学达标学校数', displayValue: `${primaryData?.summary?.overallCompliance?.compliantSchools || 0}/${primaryData?.summary?.schoolCount || 0}`, value: primaryData?.summary?.overallCompliance?.compliantSchools || 0 },
                { name: '初中达标学校数', displayValue: `${juniorData?.summary?.overallCompliance?.compliantSchools || 0}/${juniorData?.summary?.schoolCount || 0}`, value: juniorData?.summary?.overallCompliance?.compliantSchools || 0 },
                { name: '总计', displayValue: `${compliantSchools}/${totalSchools}所`, value: compliantSchools, isCompliant: rate === 100 },
              ],
              dataSource: 'school_aggregate',
              formula: '统计所有学校7项资源配置指标达标情况（每所学校至少6项达标，且余项≥85%）',
            } as any;
            l2Children.push(renderDataIndicatorNode(
              l2Indicator.dataIndicators[0],
              rate,
              rate === 100 ? true : rate !== null ? false : null,
              rate !== null ? `${compliantSchools}/${totalSchools}所达标 (${rate}%)` : undefined,
              d1Details
            ));
            dimensionTotal++;
            if (rate === 100) dimensionCompliant++;
            else if (rate === null) dimensionPending++;

            // D2: 小学校际差异系数
            const primaryAllCompliant = primaryData?.summary?.allCompliant;
            const primaryCvIndicators = primaryData?.summary?.cvIndicators || [];
            const primaryCompliantCount = primaryCvIndicators.filter(cv => cv.isCompliant === true).length;
            const primaryTotalCv = primaryCvIndicators.length;
            // 找出最大的CV值（用于显示）
            let primaryMaxCv: number | null = null;
            if (primaryCvIndicators.length > 0) {
              const cvValues = primaryCvIndicators.filter(cv => cv.cv !== null).map(cv => cv.cv as number);
              if (cvValues.length > 0) {
                primaryMaxCv = Math.max(...cvValues);
              }
            }
            // 构建小学CV详情
            const d2Details = {
              details: primaryCvIndicators.map(cv => ({
                name: `${cv.code} - ${INDICATOR_SHORT_NAMES[cv.code] || cv.code}`,
                displayValue: cv.cv !== null ? cv.cv.toFixed(4) : '-',
                value: cv.cv,
                threshold: cv.threshold,
                isCompliant: cv.isCompliant,
              })),
              dataSource: 'system',
              formula: '差异系数(CV) = 标准差 / 平均值，小学CV需≤0.50',
            } as any;
            l2Children.push(renderDataIndicatorNode(
              l2Indicator.dataIndicators[1],
              primaryMaxCv,
              primaryAllCompliant ?? null,
              primaryTotalCv > 0
                ? `${primaryCompliantCount}/${primaryTotalCv}项达标${primaryMaxCv !== null ? ` (最大CV: ${primaryMaxCv.toFixed(4)})` : ''}`
                : undefined,
              d2Details
            ));
            dimensionTotal++;
            if (primaryAllCompliant) dimensionCompliant++;
            else if (primaryAllCompliant === null || primaryAllCompliant === undefined) dimensionPending++;

            // D3: 初中校际差异系数
            const juniorAllCompliant = juniorData?.summary?.allCompliant;
            const juniorCvIndicators = juniorData?.summary?.cvIndicators || [];
            const juniorCompliantCount = juniorCvIndicators.filter(cv => cv.isCompliant === true).length;
            const juniorTotalCv = juniorCvIndicators.length;
            // 找出最大的CV值（用于显示）
            let juniorMaxCv: number | null = null;
            if (juniorCvIndicators.length > 0) {
              const cvValues = juniorCvIndicators.filter(cv => cv.cv !== null).map(cv => cv.cv as number);
              if (cvValues.length > 0) {
                juniorMaxCv = Math.max(...cvValues);
              }
            }
            // 构建初中CV详情
            const d3Details = {
              details: juniorCvIndicators.map(cv => ({
                name: `${cv.code} - ${INDICATOR_SHORT_NAMES[cv.code] || cv.code}`,
                displayValue: cv.cv !== null ? cv.cv.toFixed(4) : '-',
                value: cv.cv,
                threshold: cv.threshold,
                isCompliant: cv.isCompliant,
              })),
              dataSource: 'system',
              formula: '差异系数(CV) = 标准差 / 平均值，初中CV需≤0.45',
            } as any;
            l2Children.push(renderDataIndicatorNode(
              l2Indicator.dataIndicators[2],
              juniorMaxCv,
              juniorAllCompliant ?? null,
              juniorTotalCv > 0
                ? `${juniorCompliantCount}/${juniorTotalCv}项达标${juniorMaxCv !== null ? ` (最大CV: ${juniorMaxCv.toFixed(4)})` : ''}`
                : undefined,
              d3Details
            ));
            dimensionTotal++;
            if (juniorAllCompliant) dimensionCompliant++;
            else if (juniorAllCompliant === null || juniorAllCompliant === undefined) dimensionPending++;

            // 添加查看学校详情按钮
            l2Children.push({
              key: 'resource-school-detail',
              title: (
                <div className={styles.indicatorTitle}>
                  <Button
                    type="link"
                    size="small"
                    icon={<EyeOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSchoolModalTab('primary');
                      setSchoolModalVisible(true);
                    }}
                  >
                    查看各学校7项指标详情
                  </Button>
                </div>
              ),
              isLeaf: true,
            });
          }
        }
        // 维度2（政府保障）、维度3（教育质量）、维度4（社会认可）
        else {
          // 处理数据指标
          l2Indicator.dataIndicators.forEach((dataInd) => {
            let apiIndicator;
            let displayValue: string | undefined;
            let value: number | string | null = null;
            let isCompliant: boolean | null = null;

            if (dimension.code === '2') {
              // 政府保障 - 根据apiCode查找
              const gCode = `G${l2Indicator.code.split('.')[1]}`;
              apiIndicator = govIndicatorMap.get(gCode);
            } else if (dimension.code === '3') {
              // 教育质量 - 根据apiCode查找
              const qCode = `Q${l2Indicator.code.split('.')[1]}`;
              apiIndicator = eduIndicatorMap.get(qCode);

              // 特殊处理 Q9（国家义务教育质量监测）的12个子指标
              if (qCode === 'Q9' && apiIndicator && apiIndicator.details && apiIndicator.details.length > 0) {
                // 从 dataInd.code 中提取指标编号，例如 "3.9-D1" -> 1
                const match = dataInd.code.match(/D(\d+)$/);
                if (match) {
                  const indicatorNum = parseInt(match[1], 10);
                  // 计算科目索引：D1/D2->0(语文), D3/D4->1(数学), D5/D6->2(科学), D7/D8->3(体育), D9/D10->4(艺术), D11/D12->5(德育)
                  const subjectIndex = Math.floor((indicatorNum - 1) / 2);
                  // 判断是学业水平等级（奇数）还是校际差异率（偶数）
                  const isLevel = indicatorNum % 2 === 1;

                  if (subjectIndex < apiIndicator.details.length) {
                    const detail = apiIndicator.details[subjectIndex];
                    // detail.value 格式为 "III级/12.35" 或 "待填报/待填报"
                    const parts = detail.value?.toString().split('/') || [];

                    if (isLevel) {
                      // 奇数：学业水平等级
                      displayValue = parts[0] || '待填报';
                      value = parts[0] || null;
                      // 从 detail.displayValue 中提取学业水平的达标状态
                      // displayValue 格式: "学业水平: III级, 差异率: 12.35"
                      if (displayValue !== '待填报') {
                        // 判断是否达标：需要 >= III级
                        const levelMatch = displayValue.match(/([IVX]+)级?/);
                        if (levelMatch) {
                          const levelStr = levelMatch[1];
                          const levelMapping: { [key: string]: number } = {
                            'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5
                          };
                          const levelNum = levelMapping[levelStr];
                          isCompliant = levelNum !== undefined && levelNum >= 3; // III级及以上达标
                        }
                      } else {
                        isCompliant = null;
                      }
                    } else {
                      // 偶数：校际差异率
                      displayValue = parts[1] || '待填报';
                      value = parts[1] ? parseFloat(parts[1]) : null;
                      // 判断是否达标：需要 < 0.15
                      if (displayValue !== '待填报' && value !== null) {
                        isCompliant = value < 0.15;
                      } else {
                        isCompliant = null;
                      }
                    }
                  }
                }
              }
            } else if (dimension.code === '4') {
              // 社会认可 - 根据apiCode查找
              const sCode = dataInd.apiCode || `S${l2Indicator.code.split('.')[1]}`;
              apiIndicator = socialIndicatorMap.get(sCode);
            }

            if (apiIndicator) {
              // 如果是Q9的子指标，使用解析后的值；否则使用原始值
              const finalDisplayValue = displayValue !== undefined ? displayValue : (apiIndicator.displayValue ?? undefined);
              const finalValue = value !== null ? value : apiIndicator.value;
              const finalIsCompliant = isCompliant !== null ? isCompliant : apiIndicator.isCompliant;

              l2Children.push(renderDataIndicatorNode(
                dataInd,
                finalValue,
                finalIsCompliant,
                finalDisplayValue,
                apiIndicator
              ));
              dimensionTotal++;
              if (finalIsCompliant === true) dimensionCompliant++;
              else if (finalIsCompliant === null) dimensionPending++;
            } else {
              // API未返回数据，显示待填报状态
              l2Children.push(renderDataIndicatorNode(dataInd, null, null, undefined, undefined));
              dimensionTotal++;
              dimensionPending++;
            }
          });

          // 处理佐证材料
          l2Indicator.supportingMaterials.forEach((material) => {
            // 查找对应的佐证材料上传状态
            let uploadStatus: string | undefined;
            let materialCompliant: boolean | null = null;
            let dataSourceType: 'district' | 'school_aggregate' = 'school_aggregate';

            if (dimension.code === '2') {
              // 政府保障程度 - 根据L2指标编码构造API Code
              const gCode = `G${l2Indicator.code.split('.')[1]}`;
              const apiIndicator = govIndicatorMap.get(gCode);
              if (apiIndicator) {
                uploadStatus = apiIndicator.displayValue ?? undefined;
                materialCompliant = apiIndicator.isCompliant;
                // G1和G10是区县级别的佐证材料
                dataSourceType = 'district';
                dimensionTotal++;
                if (apiIndicator.isCompliant === true) dimensionCompliant++;
                else if (apiIndicator.isCompliant === null) dimensionPending++;
              }
            } else if (dimension.code === '3') {
              // 教育质量 - 根据L2指标编码构造API Code
              const qCode = `Q${l2Indicator.code.split('.')[1]}`;
              const apiIndicator = eduIndicatorMap.get(qCode);
              if (apiIndicator) {
                uploadStatus = apiIndicator.displayValue ?? undefined;
                materialCompliant = apiIndicator.isCompliant;
                // Q3/Q5/Q6/Q7/Q8是学校级别的佐证材料
                dataSourceType = 'school_aggregate';
                dimensionTotal++;
                if (apiIndicator.isCompliant === true) dimensionCompliant++;
                else if (apiIndicator.isCompliant === null) dimensionPending++;
              }
            }
            l2Children.push(renderMaterialNode(material, uploadStatus, materialCompliant, dataSourceType));
          });
        }

        // 添加L2节点
        dimensionChildren.push({
          key: `l2-${l2Indicator.id}`,
          title: (
            <div className={styles.schoolTypeTitle}>
              <div className={styles.schoolTypeTitleContent}>
                <span className={styles.indicatorCode}>{l2Indicator.code}</span>
                <Tooltip title={l2Indicator.name}>
                  <span className={styles.schoolTypeName}>{l2Indicator.name}</span>
                </Tooltip>
              </div>
              {l2Children.length > 0 && (
                <Tag color="default">
                  {l2Indicator.dataIndicators.length > 0 ? `${l2Indicator.dataIndicators.length}项数据指标` : ''}
                  {l2Indicator.supportingMaterials.length > 0 ? `${l2Indicator.supportingMaterials.length}项佐证` : ''}
                </Tag>
              )}
            </div>
          ),
          children: l2Children.length > 0 ? l2Children : undefined,
          isLeaf: l2Children.length === 0,
        });
      });

      // 获取维度汇总数据
      let summaryTag;
      if (dimension.code === '1') {
        // 资源配置特殊处理
        const resourceDataLoaded = !loading && (primaryData !== null || juniorData !== null);
        if (!resourceDataLoaded) {
          summaryTag = <Tag color="default">加载中...</Tag>;
        } else {
          summaryTag = (
            <>
              <Tag color={dimensionPending > 0 ? 'warning' : dimensionCompliant === dimensionTotal ? 'success' : 'error'}>
                {dimensionCompliant}/{dimensionTotal}项达标
                {dimensionPending > 0 && `，${dimensionPending}项待计算`}
              </Tag>
            </>
          );
        }
      } else if (dimension.code === '2' && govData) {
        summaryTag = (
          <Tag icon={govData.summary.allCompliant ? <CheckCircleOutlined /> : govData.summary.allCompliant === null ? <ExclamationCircleOutlined /> : <CloseCircleOutlined />}
            color={govData.summary.allCompliant ? 'success' : govData.summary.allCompliant === null ? 'warning' : 'error'}>
            {govData.summary.compliantCount}/{govData.summary.totalCount}项达标
            {govData.summary.pendingCount > 0 && `，${govData.summary.pendingCount}项待填报`}
          </Tag>
        );
      } else if (dimension.code === '3' && eduQualityData) {
        summaryTag = (
          <Tag icon={eduQualityData.summary.allCompliant ? <CheckCircleOutlined /> : eduQualityData.summary.allCompliant === null ? <ExclamationCircleOutlined /> : <CloseCircleOutlined />}
            color={eduQualityData.summary.allCompliant ? 'success' : eduQualityData.summary.allCompliant === null ? 'warning' : 'error'}>
            {eduQualityData.summary.compliantCount}/{eduQualityData.summary.totalCount}项达标
            {eduQualityData.summary.pendingCount > 0 && `，${eduQualityData.summary.pendingCount}项待填报`}
          </Tag>
        );
      } else if (dimension.code === '4' && socialRecogData) {
        summaryTag = (
          <Tag icon={socialRecogData.summary.allCompliant ? <CheckCircleOutlined /> : socialRecogData.summary.allCompliant === null ? <ExclamationCircleOutlined /> : <CloseCircleOutlined />}
            color={socialRecogData.summary.allCompliant ? 'success' : socialRecogData.summary.allCompliant === null ? 'warning' : 'error'}>
            {socialRecogData.summary.compliantCount}/{socialRecogData.summary.totalCount}项达标
            {socialRecogData.summary.pendingCount > 0 && `，${socialRecogData.summary.pendingCount}项待填报`}
          </Tag>
        );
      } else {
        summaryTag = <Tag color="default">加载中...</Tag>;
      }

      // 添加L1维度节点
      nodes.push({
        key: `dimension-${dimension.code}`,
        title: (
          <div className={styles.dimensionTitle}>
            <span className={styles.dimensionName}>
              {getDimensionIcon(dimension.code)}
              {['一', '二', '三', '四'][dimIndex]}、{dimension.name}
            </span>
            <div className={styles.dimensionStats}>
              {summaryTag}
            </div>
          </div>
        ),
        children: dimensionChildren,
      });
    });

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
