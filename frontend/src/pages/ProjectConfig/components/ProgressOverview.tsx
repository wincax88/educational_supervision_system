/**
 * 填报进度概览组件
 * 在项目配置页面显示填报进度的可视化看板
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Row,
  Col,
  Progress,
  Statistic,
  Tag,
  Spin,
  Empty,
  Tooltip,
} from 'antd';
import {
  FileTextOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  EditOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import * as submissionService from '../../../services/submissionService';
import type { SubmissionStats } from '../../../services/submissionService';
import styles from './ProgressOverview.module.css';

interface ProgressOverviewProps {
  projectId: string;
  projectStatus: string;
}

const ProgressOverview: React.FC<ProgressOverviewProps> = ({
  projectId,
  projectStatus,
}) => {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<SubmissionStats | null>(null);

  // 加载统计数据
  const loadStats = useCallback(async () => {
    if (!projectId || projectStatus === '配置中') return;

    setLoading(true);
    try {
      const data = await submissionService.getProjectStats(projectId);
      setStats(data);
    } catch (error) {
      console.error('加载统计数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId, projectStatus]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // 配置中状态不显示
  if (projectStatus === '配置中') {
    return null;
  }

  // 计算各项百分比
  const getPercentage = (value: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
  };

  // 获取提交率（已提交 + 已通过 + 已驳回）
  const getSubmitRate = () => {
    if (!stats || stats.total === 0) return 0;
    return getPercentage(stats.submitted + stats.approved + stats.rejected, stats.total);
  };

  // 获取通过率
  const getApproveRate = () => {
    if (!stats || stats.total === 0) return 0;
    return getPercentage(stats.approved, stats.total);
  };

  // 获取审核完成率（已通过 + 已驳回）
  const getReviewRate = () => {
    if (!stats) return 0;
    const reviewed = stats.approved + stats.rejected;
    const submitted = stats.submitted + reviewed;
    if (submitted === 0) return 0;
    return getPercentage(reviewed, submitted);
  };

  if (loading) {
    return (
      <Card className={styles.progressCard}>
        <div className={styles.loadingContainer}>
          <Spin size="small" />
          <span>加载进度数据...</span>
        </div>
      </Card>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <Card className={styles.progressCard} size="small">
      <div className={styles.cardHeader}>
        <TeamOutlined className={styles.headerIcon} />
        <span className={styles.headerTitle}>填报进度概览</span>
        <Tag color={projectStatus === '填报中' ? 'processing' : projectStatus === '评审中' ? 'warning' : 'success'}>
          {projectStatus}
        </Tag>
      </div>

      <Row gutter={16} className={styles.statsRow}>
        {/* 总体进度 */}
        <Col span={8}>
          <div className={styles.progressItem}>
            <div className={styles.progressHeader}>
              <span className={styles.progressLabel}>提交进度</span>
              <span className={styles.progressValue}>{getSubmitRate()}%</span>
            </div>
            <Progress
              percent={getSubmitRate()}
              status={getSubmitRate() === 100 ? 'success' : 'active'}
              strokeColor={{
                '0%': '#1890ff',
                '100%': '#52c41a',
              }}
              size="small"
            />
            <div className={styles.progressHint}>
              已提交 {stats.submitted + stats.approved + stats.rejected} / 总计 {stats.total}
            </div>
          </div>
        </Col>

        {/* 审核进度 */}
        <Col span={8}>
          <div className={styles.progressItem}>
            <div className={styles.progressHeader}>
              <span className={styles.progressLabel}>审核进度</span>
              <span className={styles.progressValue}>{getReviewRate()}%</span>
            </div>
            <Progress
              percent={getReviewRate()}
              status={getReviewRate() === 100 ? 'success' : 'active'}
              strokeColor="#722ed1"
              size="small"
            />
            <div className={styles.progressHint}>
              已审核 {stats.approved + stats.rejected} / 待审核 {stats.submitted}
            </div>
          </div>
        </Col>

        {/* 通过率 */}
        <Col span={8}>
          <div className={styles.progressItem}>
            <div className={styles.progressHeader}>
              <span className={styles.progressLabel}>通过率</span>
              <span className={styles.progressValue}>{getApproveRate()}%</span>
            </div>
            <Progress
              percent={getApproveRate()}
              status="normal"
              strokeColor="#52c41a"
              size="small"
            />
            <div className={styles.progressHint}>
              已通过 {stats.approved} / 总计 {stats.total}
            </div>
          </div>
        </Col>
      </Row>

      {/* 状态分布 */}
      <div className={styles.statusDistribution}>
        <Tooltip title="草稿：尚未提交的填报记录">
          <div className={styles.statusItem}>
            <EditOutlined className={styles.statusIcon} style={{ color: '#999' }} />
            <span className={styles.statusCount}>{stats.draft}</span>
            <span className={styles.statusLabel}>草稿</span>
          </div>
        </Tooltip>

        <Tooltip title="待审核：已提交等待审核的记录">
          <div className={styles.statusItem}>
            <ClockCircleOutlined className={styles.statusIcon} style={{ color: '#1890ff' }} />
            <span className={styles.statusCount} style={{ color: '#1890ff' }}>{stats.submitted}</span>
            <span className={styles.statusLabel}>待审核</span>
          </div>
        </Tooltip>

        <Tooltip title="已通过：审核通过的记录">
          <div className={styles.statusItem}>
            <CheckCircleOutlined className={styles.statusIcon} style={{ color: '#52c41a' }} />
            <span className={styles.statusCount} style={{ color: '#52c41a' }}>{stats.approved}</span>
            <span className={styles.statusLabel}>已通过</span>
          </div>
        </Tooltip>

        <Tooltip title="已驳回：审核未通过需修改的记录">
          <div className={styles.statusItem}>
            <CloseCircleOutlined className={styles.statusIcon} style={{ color: '#ff4d4f' }} />
            <span className={styles.statusCount} style={{ color: '#ff4d4f' }}>{stats.rejected}</span>
            <span className={styles.statusLabel}>已驳回</span>
          </div>
        </Tooltip>

        <Tooltip title="填报总数">
          <div className={styles.statusItem}>
            <FileTextOutlined className={styles.statusIcon} style={{ color: '#333' }} />
            <span className={styles.statusCount}>{stats.total}</span>
            <span className={styles.statusLabel}>总计</span>
          </div>
        </Tooltip>
      </div>
    </Card>
  );
};

export default ProgressOverview;
