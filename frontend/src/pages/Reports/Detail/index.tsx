/**
 * 评估报告详情页面
 * 展示单个项目的完整评估报告
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Tag,
  Button,
  Space,
  Statistic,
  Row,
  Col,
  Spin,
  Tabs,
  Table,
  Descriptions,
  Progress,
  message,
  Tree,
} from 'antd';
import type { TableColumnsType } from 'antd';
import type { DataNode } from 'antd/es/tree';
import {
  ArrowLeftOutlined,
  DownloadOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  TeamOutlined,
  BankOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import * as reportService from '../../../services/reportService';
import type { ReportDetail } from '../../../services/reportService';
import styles from './index.module.css';

// 项目状态配置
const statusConfig: Record<string, { color: string; text: string }> = {
  '评审中': { color: 'warning', text: '评审中' },
  '已完成': { color: 'success', text: '已完成' },
};

// 评估类型配置
const assessmentTypeConfig: Record<string, { color: string }> = {
  '普及普惠': { color: '#722ed1' },
  '优质均衡': { color: '#13c2c2' },
};

const ReportDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  // 加载报告详情
  const loadReport = useCallback(async () => {
    if (!projectId) return;

    setLoading(true);
    try {
      const data = await reportService.getReportDetail(projectId);
      setReport(data);
    } catch (error) {
      console.error('加载报告详情失败:', error);
      message.error('加载报告详情失败');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  // 导出报告
  const handleExport = async (format: 'pdf' | 'excel') => {
    if (!projectId) return;

    try {
      const result = await reportService.exportReport(projectId, format);
      message.info(result.message || '导出功能开发中');
    } catch (error) {
      message.error('导出失败');
    }
  };

  // 格式化日期
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return dateStr.split('T')[0];
  };

  // 计算完成率
  const getCompletionRate = () => {
    if (!report?.summary) return 0;
    const { approvedSubmissions, totalSubmissions } = report.summary;
    if (totalSubmissions === 0) return 0;
    return Math.round((approvedSubmissions / totalSubmissions) * 100);
  };

  // 构建指标树数据
  const buildIndicatorTree = (): DataNode[] => {
    if (!report?.indicators) return [];

    const map = new Map<string, DataNode>();
    const roots: DataNode[] = [];

    // 首先创建所有节点
    report.indicators.forEach((item) => {
      map.set(item.id, {
        key: item.id,
        title: `${item.code} ${item.name}`,
        children: [],
      });
    });

    // 构建树结构
    report.indicators.forEach((item) => {
      const node = map.get(item.id)!;
      if (item.parentId && map.has(item.parentId)) {
        map.get(item.parentId)!.children!.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  };

  // 区县表格列
  const districtColumns: TableColumnsType<ReportDetail['districts'][0]> = [
    {
      title: '序号',
      key: 'index',
      width: 60,
      render: (_, __, index) => index + 1,
    },
    {
      title: '区县代码',
      dataIndex: 'code',
      key: 'code',
      width: 100,
    },
    {
      title: '区县名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '学校数量',
      dataIndex: 'schoolCount',
      key: 'schoolCount',
      width: 100,
      align: 'center',
    },
    {
      title: '已审核',
      dataIndex: 'approvedCount',
      key: 'approvedCount',
      width: 100,
      align: 'center',
      render: (val: number) => (
        <span style={{ color: '#52c41a' }}>{val}</span>
      ),
    },
    {
      title: '完成率',
      key: 'rate',
      width: 120,
      render: (_, record) => {
        const rate = record.schoolCount > 0
          ? Math.round((record.approvedCount / record.schoolCount) * 100)
          : 0;
        return (
          <Progress
            percent={rate}
            size="small"
            strokeColor={rate === 100 ? '#52c41a' : '#1890ff'}
          />
        );
      },
    },
  ];

  // 专家评审表格列
  const expertColumns: TableColumnsType<ReportDetail['expertReviews'][0]> = [
    {
      title: '专家姓名',
      dataIndex: 'expertName',
      key: 'expertName',
    },
    {
      title: '评审状态',
      dataIndex: 'reviewStatus',
      key: 'reviewStatus',
      render: (status: string) => {
        const config: Record<string, { color: string; text: string }> = {
          pending: { color: 'default', text: '待评审' },
          in_progress: { color: 'processing', text: '评审中' },
          completed: { color: 'success', text: '已完成' },
        };
        const info = config[status] || { color: 'default', text: status };
        return <Tag color={info.color}>{info.text}</Tag>;
      },
    },
    {
      title: '分配时间',
      dataIndex: 'assignedAt',
      key: 'assignedAt',
      render: formatDate,
    },
    {
      title: '评审时间',
      dataIndex: 'reviewedAt',
      key: 'reviewedAt',
      render: formatDate,
    },
  ];

  if (loading) {
    return (
      <div className={styles.loadingWrapper}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (!report) {
    return (
      <div className={styles.errorWrapper}>
        <p>报告不存在或加载失败</p>
        <Button onClick={() => navigate('/reports')}>返回列表</Button>
      </div>
    );
  }

  const { project, summary } = report;
  const statusInfo = statusConfig[project.status] || { color: 'default', text: project.status };
  const typeColor = assessmentTypeConfig[project.assessmentType]?.color;

  return (
    <div className={styles.reportDetail}>
      {/* 头部 */}
      <div className={styles.header}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/reports')}
        >
          返回列表
        </Button>
        <Space>
          <Button
            icon={<FileExcelOutlined />}
            onClick={() => handleExport('excel')}
          >
            导出 Excel
          </Button>
          <Button
            type="primary"
            icon={<FilePdfOutlined />}
            onClick={() => handleExport('pdf')}
          >
            导出 PDF
          </Button>
        </Space>
      </div>

      {/* 项目信息卡片 */}
      <Card className={styles.projectCard}>
        <div className={styles.projectHeader}>
          <div>
            <h1 className={styles.projectName}>{project.name}</h1>
            <Space size={8}>
              <Tag color={statusInfo.color}>{statusInfo.text}</Tag>
              {project.assessmentType && (
                <Tag color={typeColor}>{project.assessmentType}</Tag>
              )}
            </Space>
          </div>
        </div>
        {project.description && (
          <p className={styles.projectDesc}>{project.description}</p>
        )}
        <div className={styles.projectMeta}>
          <span>评估周期：{formatDate(project.startDate)} ~ {formatDate(project.endDate)}</span>
          {project.indicatorSystemName && (
            <span style={{ marginLeft: 24 }}>指标体系：{project.indicatorSystemName}</span>
          )}
        </div>
      </Card>

      {/* 统计概览 */}
      <Row gutter={16} className={styles.statsRow}>
        <Col span={4}>
          <Card className={styles.statCard}>
            <Statistic
              title="参评区县"
              value={summary.totalDistricts}
              prefix={<BankOutlined />}
              suffix="个"
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card className={styles.statCard}>
            <Statistic
              title="参评学校"
              value={summary.totalSchools}
              prefix={<TeamOutlined />}
              suffix="所"
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card className={styles.statCard}>
            <Statistic
              title="已审核"
              value={summary.approvedSubmissions}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card className={styles.statCard}>
            <Statistic
              title="待审核"
              value={summary.pendingSubmissions}
              valueStyle={{ color: '#fa8c16' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card className={styles.statCard}>
            <Statistic
              title="已驳回"
              value={summary.rejectedSubmissions}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<CloseCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card className={styles.statCard}>
            <div className={styles.progressStat}>
              <span className={styles.progressLabel}>评审进度</span>
              <Progress
                type="circle"
                percent={getCompletionRate()}
                width={60}
                strokeColor={getCompletionRate() === 100 ? '#52c41a' : '#1890ff'}
              />
            </div>
          </Card>
        </Col>
      </Row>

      {/* 详情标签页 */}
      <Card className={styles.contentCard}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'overview',
              label: '概览',
              children: (
                <Descriptions bordered column={2}>
                  <Descriptions.Item label="项目名称">{project.name}</Descriptions.Item>
                  <Descriptions.Item label="评估类型">{project.assessmentType}</Descriptions.Item>
                  <Descriptions.Item label="项目状态">
                    <Tag color={statusInfo.color}>{statusInfo.text}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="指标体系">{project.indicatorSystemName || '-'}</Descriptions.Item>
                  <Descriptions.Item label="开始日期">{formatDate(project.startDate)}</Descriptions.Item>
                  <Descriptions.Item label="结束日期">{formatDate(project.endDate)}</Descriptions.Item>
                  <Descriptions.Item label="参评区县">{summary.totalDistricts} 个</Descriptions.Item>
                  <Descriptions.Item label="参评学校">{summary.totalSchools} 所</Descriptions.Item>
                  <Descriptions.Item label="填报总数">{summary.totalSubmissions}</Descriptions.Item>
                  <Descriptions.Item label="评审进度">{getCompletionRate()}%</Descriptions.Item>
                  <Descriptions.Item label="项目描述" span={2}>
                    {project.description || '-'}
                  </Descriptions.Item>
                </Descriptions>
              ),
            },
            {
              key: 'indicators',
              label: '指标体系',
              children: report.indicators.length > 0 ? (
                <Tree
                  showLine
                  defaultExpandAll
                  treeData={buildIndicatorTree()}
                />
              ) : (
                <div style={{ padding: 24, textAlign: 'center', color: '#999' }}>
                  暂无指标体系数据
                </div>
              ),
            },
            {
              key: 'districts',
              label: '区县数据',
              children: (
                <Table
                  dataSource={report.districts}
                  columns={districtColumns}
                  rowKey="id"
                  pagination={false}
                  size="middle"
                />
              ),
            },
            {
              key: 'experts',
              label: '专家评审',
              children: report.expertReviews.length > 0 ? (
                <Table
                  dataSource={report.expertReviews}
                  columns={expertColumns}
                  rowKey="id"
                  pagination={false}
                  size="middle"
                />
              ) : (
                <div style={{ padding: 24, textAlign: 'center', color: '#999' }}>
                  暂无专家评审记录
                </div>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
};

export default ReportDetailPage;
