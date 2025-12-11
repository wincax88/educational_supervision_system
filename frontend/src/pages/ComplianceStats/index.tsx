import React, { useState, useEffect } from 'react';
import { Card, Select, Table, Tag, Progress, Row, Col, Statistic, Space, message } from 'antd';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import {
  getComplianceSummary,
  getComplianceByCategory,
  getDistrictComparison,
  ComplianceStats,
  CategoryCompliance,
  DistrictComparisonItem,
} from '../../services/statisticsService';
import { getDistricts, District } from '../../services/districtService';
import styles from './index.module.css';

const ComplianceStatsPage: React.FC = () => {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();

  const [districts, setDistricts] = useState<District[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [schoolType, setSchoolType] = useState<string>('小学');
  const [overallStats, setOverallStats] = useState<ComplianceStats | null>(null);
  const [categoryStats, setCategoryStats] = useState<CategoryCompliance[]>([]);
  const [districtComparison, setDistrictComparison] = useState<DistrictComparisonItem[]>([]);
  const [loading, setLoading] = useState(false);

  // 加载区县列表
  useEffect(() => {
    getDistricts().then(setDistricts).catch(() => message.error('加载区县列表失败'));
  }, []);

  // 加载统计数据
  useEffect(() => {
    if (!projectId) return;
    setLoading(true);

    Promise.all([
      getComplianceSummary(projectId, { districtId: selectedDistrict }),
      getComplianceByCategory(projectId, selectedDistrict),
      getDistrictComparison(projectId, schoolType),
    ])
      .then(([overall, categories, comparison]) => {
        setOverallStats(overall);
        setCategoryStats(categories);
        setDistrictComparison(comparison);
      })
      .catch(() => message.error('加载统计数据失败'))
      .finally(() => setLoading(false));
  }, [projectId, selectedDistrict, schoolType]);

  const getComplianceColor = (rate: number | null) => {
    if (rate === null) return '#999';
    if (rate >= 95) return '#52c41a';
    if (rate >= 80) return '#faad14';
    return '#ff4d4f';
  };

  const districtColumns: ColumnsType<DistrictComparisonItem> = [
    {
      title: '排名',
      key: 'rank',
      width: 60,
      render: (_: unknown, __: unknown, index: number) => index + 1,
    },
    {
      title: '区县',
      dataIndex: 'districtName',
      key: 'districtName',
      width: 100,
    },
    {
      title: '学校数',
      dataIndex: 'schoolCount',
      key: 'schoolCount',
      width: 80,
      render: (count: number) => `${count} 所`,
    },
    {
      title: '差异系数',
      dataIndex: 'cvComposite',
      key: 'cvComposite',
      width: 100,
      render: (cv: number | null, record: DistrictComparisonItem) => (
        <Space>
          <span>{cv?.toFixed(4) || '-'}</span>
          {record.isCvCompliant === true && (
            <CheckCircleOutlined style={{ color: '#52c41a' }} />
          )}
          {record.isCvCompliant === false && (
            <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
          )}
        </Space>
      ),
    },
    {
      title: '达标率',
      dataIndex: 'complianceRate',
      key: 'complianceRate',
      width: 150,
      render: (rate: number | null) => (
        <Progress
          percent={rate || 0}
          size="small"
          strokeColor={getComplianceColor(rate)}
          format={(p) => `${p?.toFixed(1)}%`}
        />
      ),
    },
    {
      title: '达标/总数',
      key: 'compliantCount',
      width: 100,
      render: (_: unknown, record: DistrictComparisonItem) => (
        <span style={{ color: '#666' }}>
          {record.compliantCount}/{record.totalIndicators}
        </span>
      ),
    },
    {
      title: '状态',
      key: 'status',
      width: 100,
      render: (_: unknown, record: DistrictComparisonItem) => {
        const rate = record.complianceRate;
        if (rate === null) return <Tag color="default">暂无数据</Tag>;
        if (rate >= 95) return <Tag color="success" icon={<CheckCircleOutlined />}>优秀</Tag>;
        if (rate >= 80) return <Tag color="warning" icon={<ExclamationCircleOutlined />}>良好</Tag>;
        return <Tag color="error" icon={<CloseCircleOutlined />}>待改进</Tag>;
      },
    },
  ];

  return (
    <div className={styles.compliancePage}>
      <div className={styles.pageHeader}>
        <span className={styles.backBtn} onClick={() => navigate(-1)}>
          <ArrowLeftOutlined /> 返回
        </span>
        <h2 className={styles.pageTitle}>达标率统计</h2>
      </div>

      {/* 筛选条件 */}
      <div className={styles.filterSection}>
        <Space>
          <span>学校类型：</span>
          <Select
            value={schoolType}
            onChange={setSchoolType}
            style={{ width: 120 }}
          >
            <Select.Option value="小学">小学</Select.Option>
            <Select.Option value="初中">初中</Select.Option>
          </Select>
          <span style={{ marginLeft: 16 }}>筛选区县：</span>
          <Select
            value={selectedDistrict || undefined}
            onChange={setSelectedDistrict}
            placeholder="全市"
            allowClear
            style={{ width: 180 }}
          >
            {districts.map(d => (
              <Select.Option key={d.id} value={d.id}>{d.name}</Select.Option>
            ))}
          </Select>
        </Space>
      </div>

      {/* 总体统计 */}
      {overallStats && (
        <Row gutter={16} className={styles.statsRow}>
          <Col span={6}>
            <Card className={styles.statsCard}>
              <Statistic
                title="总指标项"
                value={overallStats.total}
                suffix="项"
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card className={styles.statsCard}>
              <Statistic
                title="达标项"
                value={overallStats.compliant}
                suffix="项"
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card className={styles.statsCard}>
              <Statistic
                title="未达标项"
                value={overallStats.nonCompliant}
                suffix="项"
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card className={styles.statsCard}>
              <Statistic
                title="综合达标率"
                value={overallStats.complianceRate?.toFixed(1) || '-'}
                suffix="%"
                valueStyle={{ color: getComplianceColor(overallStats.complianceRate) }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* 各维度达标率 */}
      <Card title="各维度达标率" className={styles.categoryCard}>
        <Row gutter={16}>
          {categoryStats.map(cat => (
            <Col span={6} key={cat.categoryId}>
              <Card size="small" className={styles.catCard}>
                <div className={styles.catName}>{cat.categoryName}</div>
                <Progress
                  type="circle"
                  percent={cat.complianceRate || 0}
                  size={100}
                  strokeColor={getComplianceColor(cat.complianceRate)}
                  format={(p) => (
                    <div className={styles.circleContent}>
                      <div className={styles.circlePercent}>{p?.toFixed(0)}%</div>
                      <div className={styles.circleLabel}>{cat.compliant}/{cat.total}</div>
                    </div>
                  )}
                />
              </Card>
            </Col>
          ))}
          {categoryStats.length === 0 && (
            <Col span={24}>
              <div style={{ textAlign: 'center', color: '#999', padding: 40 }}>
                暂无数据
              </div>
            </Col>
          )}
        </Row>
      </Card>

      {/* 区县对比 */}
      <Card title="区县达标情况对比" className={styles.listCard}>
        <Table
          columns={districtColumns}
          dataSource={districtComparison}
          rowKey="districtId"
          loading={loading}
          pagination={false}
        />
      </Card>
    </div>
  );
};

export default ComplianceStatsPage;
