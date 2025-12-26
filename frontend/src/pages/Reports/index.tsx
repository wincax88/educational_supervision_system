/**
 * 评估报告列表页面
 * 为报告决策者提供报告查看入口
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
  Empty,
  Spin,
  Select,
  Input,
  Progress,
} from 'antd';
import {
  ProjectOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  SearchOutlined,
  RightOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import * as reportService from '../../services/reportService';
import type { ReportItem, StatisticsOverview } from '../../services/reportService';
import styles from './index.module.css';

// 项目状态配置
const statusConfig: Record<string, { color: string; text: string }> = {
  '评审中': { color: 'warning', text: '评审中' },
  '已完成': { color: 'success', text: '已完成' },
};

// 评估类型配置
const assessmentTypeConfig: Record<string, { color: string; label: string }> = {
  '普及普惠': { color: '#722ed1', label: '普及普惠' },
  '优质均衡': { color: '#13c2c2', label: '优质均衡' },
};

const Reports: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [statistics, setStatistics] = useState<StatisticsOverview | null>(null);
  const [total, setTotal] = useState(0);

  // 筛选条件
  const [filters, setFilters] = useState({
    type: undefined as string | undefined,
    status: undefined as string | undefined,
    keyword: '',
  });

  // 加载报告列表
  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filters.type) params.type = filters.type;
      if (filters.status) params.status = filters.status;
      if (filters.keyword) params.keyword = filters.keyword;

      const response = await reportService.getReportList(params);
      setReports(response.list || []);
      setTotal(response.total || 0);
    } catch (error) {
      console.error('加载报告列表失败:', error);
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // 加载统计数据
  const loadStatistics = useCallback(async () => {
    try {
      const data = await reportService.getStatisticsOverview();
      setStatistics(data);
    } catch (error) {
      console.error('加载统计数据失败:', error);
    }
  }, []);

  useEffect(() => {
    loadReports();
    loadStatistics();
  }, [loadReports, loadStatistics]);

  // 进入报告详情
  const handleViewReport = (report: ReportItem) => {
    navigate(`/reports/${report.id}`);
  };

  // 格式化日期
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return dateStr.split('T')[0];
  };

  // 计算完成率
  const getCompletionRate = (approved: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((approved / total) * 100);
  };

  return (
    <div className={styles.reportsPage}>
      {/* 欢迎区域 */}
      <div className={styles.welcomeSection}>
        <h1 className={styles.welcomeTitle}>
          评估报告
        </h1>
        <p className={styles.welcomeSubtitle}>
          欢迎，{user?.name || '决策者'}。
          共有 <strong>{total}</strong> 个评估报告可供查看
        </p>
      </div>

      {/* 统计卡片 */}
      <Row gutter={16} className={styles.statsRow}>
        <Col span={6}>
          <Card className={styles.statCard}>
            <Statistic
              title="已完成项目"
              value={statistics?.projectStats?.completedProjects || 0}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
              suffix="个"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className={styles.statCard}>
            <Statistic
              title="评审中项目"
              value={statistics?.projectStats?.reviewingProjects || 0}
              valueStyle={{ color: '#fa8c16' }}
              prefix={<ClockCircleOutlined />}
              suffix="个"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className={styles.statCard}>
            <Statistic
              title="优质均衡"
              value={statistics?.projectStats?.balancedProjects || 0}
              valueStyle={{ color: '#13c2c2' }}
              prefix={<ProjectOutlined />}
              suffix="个"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className={styles.statCard}>
            <Statistic
              title="普及普惠"
              value={statistics?.projectStats?.preschoolProjects || 0}
              valueStyle={{ color: '#722ed1' }}
              prefix={<BarChartOutlined />}
              suffix="个"
            />
          </Card>
        </Col>
      </Row>

      {/* 筛选区域 */}
      <Card className={styles.filterCard}>
        <Space size={16} wrap>
          <Select
            placeholder="评估类型"
            allowClear
            style={{ width: 140 }}
            value={filters.type}
            onChange={(value) => setFilters({ ...filters, type: value })}
            options={[
              { value: '优质均衡', label: '优质均衡' },
              { value: '普及普惠', label: '普及普惠' },
            ]}
          />
          <Select
            placeholder="项目状态"
            allowClear
            style={{ width: 120 }}
            value={filters.status}
            onChange={(value) => setFilters({ ...filters, status: value })}
            options={[
              { value: '评审中', label: '评审中' },
              { value: '已完成', label: '已完成' },
            ]}
          />
          <Input.Search
            placeholder="搜索项目名称"
            allowClear
            style={{ width: 240 }}
            value={filters.keyword}
            onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
            onSearch={loadReports}
            enterButton={<SearchOutlined />}
          />
        </Space>
      </Card>

      {/* 报告列表 */}
      <Spin spinning={loading}>
        {reports.length > 0 ? (
          <div className={styles.reportList}>
            {reports.map((report) => {
              const statusInfo = statusConfig[report.status] || { color: 'default', text: report.status };
              const typeInfo = assessmentTypeConfig[report.assessmentType];
              const completionRate = getCompletionRate(report.approvedSubmissions, report.totalSubmissions);

              return (
                <Card
                  key={report.id}
                  className={styles.reportCard}
                  hoverable
                  onClick={() => handleViewReport(report)}
                >
                  <div className={styles.reportHeader}>
                    <div className={styles.reportTitle}>
                      <span className={styles.reportName}>{report.name}</span>
                      <Space size={8}>
                        <Tag color={statusInfo.color}>{statusInfo.text}</Tag>
                        {typeInfo && (
                          <Tag color={typeInfo.color}>{typeInfo.label}</Tag>
                        )}
                      </Space>
                    </div>
                    <Button
                      type="primary"
                      icon={<RightOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewReport(report);
                      }}
                    >
                      查看报告
                    </Button>
                  </div>

                  {report.description && (
                    <p className={styles.reportDesc}>{report.description}</p>
                  )}

                  <div className={styles.reportMeta}>
                    <span>
                      评估周期：{formatDate(report.startDate)} ~ {formatDate(report.endDate)}
                    </span>
                    {report.indicatorSystemName && (
                      <span style={{ marginLeft: 24 }}>
                        指标体系：{report.indicatorSystemName}
                      </span>
                    )}
                  </div>

                  {/* 数据统计 */}
                  <div className={styles.reportStats}>
                    <div className={styles.statsItems}>
                      <div className={styles.statsItem}>
                        <ProjectOutlined style={{ color: '#1890ff' }} />
                        <span className={styles.statsValue}>{report.districtCount}</span>
                        <span className={styles.statsLabel}>参评区县</span>
                      </div>
                      <div className={styles.statsItem}>
                        <FileTextOutlined style={{ color: '#52c41a' }} />
                        <span className={styles.statsValue}>{report.approvedSubmissions}</span>
                        <span className={styles.statsLabel}>已审核</span>
                      </div>
                      <div className={styles.statsItem}>
                        <ClockCircleOutlined style={{ color: '#fa8c16' }} />
                        <span className={styles.statsValue}>{report.totalSubmissions - report.approvedSubmissions}</span>
                        <span className={styles.statsLabel}>待审核</span>
                      </div>
                    </div>
                    <div className={styles.progressWrapper}>
                      <Progress
                        percent={completionRate}
                        size="small"
                        strokeColor={completionRate === 100 ? '#52c41a' : '#1890ff'}
                        format={(percent) => `${percent}%`}
                      />
                      <span className={styles.progressText}>评审进度</span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className={styles.emptyCard}>
            <Empty
              image={<FileTextOutlined style={{ fontSize: 64, color: '#ccc' }} />}
              description={
                <span style={{ color: '#999' }}>
                  暂无评估报告
                  <br />
                  评估项目完成后将在此显示
                </span>
              }
            />
          </Card>
        )}
      </Spin>
    </div>
  );
};

export default Reports;
