import React, { useState, useEffect } from 'react';
import { Card, Select, Table, Tag, Progress, Row, Col, Statistic, Space, message } from 'antd';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import { getCVSummary, getCVAnalysis, CVSummary, CVAnalysis } from '../../services/statisticsService';
import { getDistricts, District } from '../../services/districtService';
import styles from './index.module.css';

const CVAnalysisPage: React.FC = () => {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();

  const [districts, setDistricts] = useState<District[]>([]);
  const [summary, setSummary] = useState<CVSummary | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [districtAnalysis, setDistrictAnalysis] = useState<CVAnalysis | null>(null);
  const [schoolType, setSchoolType] = useState<string>('小学');
  const [loading, setLoading] = useState(false);

  // 加载区县列表
  useEffect(() => {
    getDistricts().then(setDistricts).catch(() => message.error('加载区县列表失败'));
  }, []);

  // 加载汇总数据
  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    getCVSummary(projectId, schoolType)
      .then(setSummary)
      .catch(() => message.error('加载统计数据失败'))
      .finally(() => setLoading(false));
  }, [projectId, schoolType]);

  // 加载区县详情
  useEffect(() => {
    if (!projectId || !selectedDistrict) {
      setDistrictAnalysis(null);
      return;
    }
    getCVAnalysis(projectId, selectedDistrict, schoolType)
      .then(setDistrictAnalysis)
      .catch(() => message.error('加载区县数据失败'));
  }, [projectId, selectedDistrict, schoolType]);

  const threshold = schoolType === '小学' ? 0.50 : 0.45;

  const getComplianceTag = (cv: number | null, isCompliant: boolean | null) => {
    if (cv === null || isCompliant === null) {
      return <Tag color="default">暂无数据</Tag>;
    }
    return isCompliant ? (
      <Tag color="success" icon={<CheckCircleOutlined />}>达标</Tag>
    ) : (
      <Tag color="error" icon={<CloseCircleOutlined />}>未达标</Tag>
    );
  };

  const columns: ColumnsType<CVSummary['districts'][0]> = [
    {
      title: '区县',
      dataIndex: 'districtName',
      key: 'districtName',
      width: 120,
    },
    {
      title: '学校数量',
      dataIndex: 'schoolCount',
      key: 'schoolCount',
      width: 100,
      render: (count: number) => `${count} 所`,
    },
    {
      title: '综合差异系数',
      dataIndex: 'cvComposite',
      key: 'cvComposite',
      width: 200,
      render: (cv: number | null) => {
        if (cv === null) return <span style={{ color: '#999' }}>-</span>;
        const percent = Math.min((cv / threshold) * 100, 100);
        const status = cv <= threshold ? 'success' : 'exception';
        return (
          <Space>
            <Progress
              percent={percent}
              size="small"
              status={status}
              format={() => cv.toFixed(4)}
              style={{ width: 120 }}
            />
          </Space>
        );
      },
    },
    {
      title: `阈值 (≤${threshold})`,
      key: 'threshold',
      width: 100,
      render: () => <span style={{ color: '#999' }}>{threshold}</span>,
    },
    {
      title: '达标状态',
      key: 'status',
      width: 100,
      render: (_: unknown, record: CVSummary['districts'][0]) =>
        getComplianceTag(record.cvComposite, record.isCompliant),
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      render: (_: unknown, record: CVSummary['districts'][0]) => (
        <a onClick={() => setSelectedDistrict(record.districtId)}>查看详情</a>
      ),
    },
  ];

  return (
    <div className={styles.cvAnalysisPage}>
      <div className={styles.pageHeader}>
        <span className={styles.backBtn} onClick={() => navigate(-1)}>
          <ArrowLeftOutlined /> 返回
        </span>
        <h2 className={styles.pageTitle}>差异系数分析</h2>
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
          <span style={{ marginLeft: 16 }}>查看区县：</span>
          <Select
            value={selectedDistrict || undefined}
            onChange={setSelectedDistrict}
            placeholder="选择区县查看详情"
            allowClear
            style={{ width: 180 }}
          >
            {districts.map(d => (
              <Select.Option key={d.id} value={d.id}>{d.name}</Select.Option>
            ))}
          </Select>
        </Space>
      </div>

      {/* 统计卡片 */}
      {summary && (
        <Row gutter={16} className={styles.statsRow}>
          <Col span={6}>
            <Card className={styles.statsCard}>
              <Statistic
                title="参评区县数"
                value={summary.cityTotal.districtCount}
                suffix="个"
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card className={styles.statsCard}>
              <Statistic
                title="达标区县数"
                value={summary.cityTotal.compliantCount}
                suffix="个"
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card className={styles.statsCard}>
              <Statistic
                title="达标率"
                value={summary.cityTotal.districtCount > 0
                  ? ((summary.cityTotal.compliantCount / summary.cityTotal.districtCount) * 100).toFixed(1)
                  : 0}
                suffix="%"
                valueStyle={{ color: '#1677ff' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card className={styles.statsCard}>
              <Statistic
                title="平均差异系数"
                value={summary.cityTotal.avgCV?.toFixed(4) || '-'}
                prefix={<BarChartOutlined />}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* 区县详情 */}
      {districtAnalysis && (
        <Card
          title={`${districtAnalysis.district.name} - ${schoolType} 差异系数详情`}
          className={styles.detailCard}
          extra={
            <Space>
              <span>学校数量：{districtAnalysis.schoolCount} 所</span>
              {getComplianceTag(districtAnalysis.cvComposite, districtAnalysis.isCompliant)}
            </Space>
          }
        >
          <Row gutter={[16, 16]}>
            <Col span={8}>
              <Card size="small" className={styles.cvCard}>
                <Statistic
                  title="综合差异系数"
                  value={districtAnalysis.cvComposite?.toFixed(4) || '-'}
                  valueStyle={{
                    color: districtAnalysis.isCompliant ? '#52c41a' : '#ff4d4f',
                    fontSize: 28
                  }}
                />
                <div className={styles.cvThreshold}>
                  阈值：≤ {districtAnalysis.threshold}
                </div>
                <Progress
                  percent={districtAnalysis.cvComposite
                    ? Math.min((districtAnalysis.cvComposite / districtAnalysis.threshold) * 100, 150)
                    : 0}
                  status={districtAnalysis.isCompliant ? 'success' : 'exception'}
                  showInfo={false}
                />
              </Card>
            </Col>
            <Col span={16}>
              <Card size="small" title="各项指标差异系数">
                <Table
                  size="small"
                  dataSource={Object.entries(districtAnalysis.cvIndicators).map(([key, value]) => ({
                    key,
                    name: value.name || key,
                    cv: value.cv,
                    mean: value.mean,
                    stdDev: value.stdDev,
                    count: value.count,
                  }))}
                  columns={[
                    { title: '指标', dataIndex: 'name', key: 'name' },
                    {
                      title: '差异系数',
                      dataIndex: 'cv',
                      key: 'cv',
                      render: (cv: number) => cv?.toFixed(4) || '-'
                    },
                    {
                      title: '均值',
                      dataIndex: 'mean',
                      key: 'mean',
                      render: (mean: number) => mean?.toFixed(2) || '-'
                    },
                    {
                      title: '标准差',
                      dataIndex: 'stdDev',
                      key: 'stdDev',
                      render: (sd: number) => sd?.toFixed(2) || '-'
                    },
                    { title: '样本数', dataIndex: 'count', key: 'count' },
                  ]}
                  pagination={false}
                />
              </Card>
            </Col>
          </Row>
        </Card>
      )}

      {/* 区县列表 */}
      <Card title="各区县差异系数汇总" className={styles.listCard}>
        <Table
          columns={columns}
          dataSource={summary?.districts || []}
          rowKey="districtId"
          loading={loading}
          pagination={false}
        />
      </Card>
    </div>
  );
};

export default CVAnalysisPage;
