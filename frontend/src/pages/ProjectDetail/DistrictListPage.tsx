import React, { useState, useEffect } from 'react';
import { Table, Tag, message, Spin, Button, Card, Row, Col, Progress, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ArrowLeftOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { getProject, Project } from '../../services/submissionService';
import { getDistricts, District, getDistrictSubmissions, getDistrictSelfSubmissions } from '../../services/districtService';
import { getDistrictComparison, DistrictComparisonItem } from '../../services/statisticsService';
import styles from './index.module.css';

interface DistrictSummary extends DistrictComparisonItem {
  schoolSubmissionStats?: {
    total: number;
    draft: number;
    submitted: number;
    approved: number;
    rejected: number;
  };
  districtSubmissionStats?: {
    total: number;
    draft: number;
    submitted: number;
    approved: number;
    rejected: number;
  };
}

const DistrictListPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [project, setProject] = useState<Project | null>(null);
  const [districtData, setDistrictData] = useState<DistrictSummary[]>([]);

  // 加载数据
  useEffect(() => {
    const loadData = async () => {
      if (!projectId) return;

      setLoading(true);
      try {
        // 并行加载项目信息、区县列表和区县对比数据
        const [projectData, districts, comparisonData] = await Promise.all([
          getProject(projectId),
          getDistricts(),
          getDistrictComparison(projectId).catch(() => [] as DistrictComparisonItem[]),
        ]);
        setProject(projectData);

        // 合并区县数据和对比数据
        const comparisonMap = new Map(comparisonData.map(c => [c.districtId, c]));

        // 为每个区县加载填报统计
        const districtSummaries: DistrictSummary[] = await Promise.all(
          districts.map(async (district) => {
            const comparison = comparisonMap.get(district.id) || {
              districtId: district.id,
              districtName: district.name,
              districtCode: district.code,
              schoolCount: 0,
              cvComposite: null,
              isCvCompliant: null,
              complianceRate: null,
              compliantCount: 0,
              totalIndicators: 0,
            };

            // 获取学校填报统计和区县填报统计
            let schoolSubmissionStats = { total: 0, draft: 0, submitted: 0, approved: 0, rejected: 0 };
            let districtSubmissionStats = { total: 0, draft: 0, submitted: 0, approved: 0, rejected: 0 };

            try {
              const [schoolSubs, districtSubs] = await Promise.all([
                getDistrictSubmissions(district.id, projectId).catch(() => ({ stats: schoolSubmissionStats })),
                getDistrictSelfSubmissions(district.id, projectId).catch(() => ({ stats: districtSubmissionStats })),
              ]);
              schoolSubmissionStats = schoolSubs.stats || schoolSubmissionStats;
              districtSubmissionStats = districtSubs.stats || districtSubmissionStats;
            } catch (e) {
              console.error('加载填报统计失败:', e);
            }

            return {
              ...comparison,
              districtName: district.name,
              schoolSubmissionStats,
              districtSubmissionStats,
            };
          })
        );

        setDistrictData(districtSummaries);
      } catch (error) {
        console.error('加载数据失败:', error);
        message.error('加载数据失败');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [projectId]);

  // 返回项目列表
  const handleBack = () => {
    navigate('/home/balanced');
  };

  // 查看区县详情
  const handleViewDistrict = (districtId: string) => {
    navigate(`/home/balanced/project/${projectId}/district/${districtId}`);
  };

  // 渲染填报进度
  const renderSubmissionProgress = (stats: { total: number; draft: number; submitted: number; approved: number; rejected: number } | undefined) => {
    if (!stats || stats.total === 0) {
      return <span style={{ color: '#999' }}>暂无数据</span>;
    }

    const approvedPercent = Math.round((stats.approved / stats.total) * 100);
    const pendingPercent = Math.round(((stats.submitted + stats.draft) / stats.total) * 100);

    return (
      <Tooltip title={`已通过: ${stats.approved} / 待审核: ${stats.submitted} / 草稿: ${stats.draft} / 已驳回: ${stats.rejected}`}>
        <div style={{ minWidth: 120 }}>
          <Progress
            percent={100}
            success={{ percent: approvedPercent }}
            strokeColor="#faad14"
            size="small"
            format={() => `${stats.approved}/${stats.total}`}
          />
        </div>
      </Tooltip>
    );
  };

  const columns: ColumnsType<DistrictSummary> = [
    {
      title: '区县名称',
      dataIndex: 'districtName',
      key: 'districtName',
      width: 120,
      fixed: 'left',
    },
    {
      title: '学校数',
      dataIndex: 'schoolCount',
      key: 'schoolCount',
      width: 80,
      align: 'center',
    },
    {
      title: '学校填报进度',
      key: 'schoolSubmission',
      width: 160,
      render: (_, record) => renderSubmissionProgress(record.schoolSubmissionStats),
    },
    {
      title: '区县填报进度',
      key: 'districtSubmission',
      width: 160,
      render: (_, record) => renderSubmissionProgress(record.districtSubmissionStats),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => handleViewDistrict(record.districtId)}
        >
          详情
        </Button>
      ),
    },
  ];

  // 计算汇总数据
  const summaryStats = {
    totalDistricts: districtData.length,
    totalSchools: districtData.reduce((sum, d) => sum + (d.schoolCount || 0), 0),
    totalSchoolSubmissions: districtData.reduce((sum, d) => sum + (d.schoolSubmissionStats?.total || 0), 0),
    approvedSchoolSubmissions: districtData.reduce((sum, d) => sum + (d.schoolSubmissionStats?.approved || 0), 0),
    totalDistrictSubmissions: districtData.reduce((sum, d) => sum + (d.districtSubmissionStats?.total || 0), 0),
    approvedDistrictSubmissions: districtData.reduce((sum, d) => sum + (d.districtSubmissionStats?.approved || 0), 0),
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={handleBack}
            className={styles.backButton}
          >
            返回
          </Button>
          <h1 className={styles.title}>
            {project?.name || '加载中...'}
            {project && (
              <Tag
                color={project.status === '填报中' ? 'processing' : project.status === '评审中' ? 'warning' : 'success'}
                className={styles.statusTag}
              >
                {project.status}
              </Tag>
            )}
          </h1>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Spin size="large" />
        </div>
      ) : (
        <>
          {/* 汇总卡片 */}
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <Card size="small">
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: '#666', fontSize: 12, marginBottom: 4 }}>区县数</div>
                  <div style={{ fontSize: 24, fontWeight: 600, color: '#1890ff' }}>{summaryStats.totalDistricts}</div>
                </div>
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: '#666', fontSize: 12, marginBottom: 4 }}>学校数</div>
                  <div style={{ fontSize: 24, fontWeight: 600, color: '#1890ff' }}>{summaryStats.totalSchools}</div>
                </div>
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: '#666', fontSize: 12, marginBottom: 4 }}>学校填报</div>
                  <div style={{ fontSize: 24, fontWeight: 600, color: '#52c41a' }}>
                    {summaryStats.approvedSchoolSubmissions}/{summaryStats.totalSchoolSubmissions}
                  </div>
                </div>
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: '#666', fontSize: 12, marginBottom: 4 }}>区县填报</div>
                  <div style={{ fontSize: 24, fontWeight: 600, color: '#52c41a' }}>
                    {summaryStats.approvedDistrictSubmissions}/{summaryStats.totalDistrictSubmissions}
                  </div>
                </div>
              </Card>
            </Col>
          </Row>

          {/* 区县列表 */}
          <Card title="区县填报情况">
            <Table
              columns={columns}
              dataSource={districtData}
              rowKey="districtId"
              scroll={{ x: 1000 }}
              pagination={false}
              size="middle"
            />
          </Card>
        </>
      )}
    </div>
  );
};

export default DistrictListPage;
