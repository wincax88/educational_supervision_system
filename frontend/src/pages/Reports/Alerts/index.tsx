/**
 * 预警提醒页面
 * 展示各类预警信息
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, Row, Col, Table, Tag, Badge, Spin, Empty, Progress } from 'antd';
import type { TableColumnsType } from 'antd';
import {
  WarningOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import * as reportService from '../../../services/reportService';
import type { AlertsData } from '../../../services/reportService';
import styles from './index.module.css';

const Alerts: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState<AlertsData | null>(null);

  // 加载预警数据
  const loadAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await reportService.getAlerts();
      setAlerts(data);
    } catch (error) {
      console.error('加载预警数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  // 格式化日期
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return dateStr.split('T')[0];
  };

  // 进度落后项目表格列
  const lowProgressColumns: TableColumnsType<AlertsData['lowProgressProjects'][0]> = [
    {
      title: '项目名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record) => (
        <a onClick={() => navigate(`/reports/${record.id}`)}>{name}</a>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => <Tag color="warning">{status}</Tag>,
    },
    {
      title: '完成率',
      dataIndex: 'completionRate',
      key: 'completionRate',
      width: 150,
      render: (rate: number) => (
        <Progress
          percent={rate || 0}
          size="small"
          strokeColor="#ff4d4f"
          format={(p) => `${p?.toFixed(1)}%`}
        />
      ),
    },
    {
      title: '截止日期',
      dataIndex: 'endDate',
      key: 'endDate',
      width: 120,
      render: formatDate,
    },
  ];

  // 即将到期项目表格列
  const deadlineColumns: TableColumnsType<AlertsData['upcomingDeadlines'][0]> = [
    {
      title: '项目名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record) => (
        <a onClick={() => navigate(`/reports/${record.id}`)}>{name}</a>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => <Tag color="processing">{status}</Tag>,
    },
    {
      title: '截止日期',
      dataIndex: 'endDate',
      key: 'endDate',
      width: 120,
      render: formatDate,
    },
    {
      title: '剩余天数',
      dataIndex: 'daysRemaining',
      key: 'daysRemaining',
      width: 100,
      render: (days: number) => (
        <Tag color={days <= 3 ? 'error' : 'warning'}>
          {days} 天
        </Tag>
      ),
    },
  ];

  // 高驳回率区县表格列
  const rejectionColumns: TableColumnsType<AlertsData['highRejectionDistricts'][0]> = [
    {
      title: '区县名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '区县代码',
      dataIndex: 'code',
      key: 'code',
      width: 100,
    },
    {
      title: '填报总数',
      dataIndex: 'totalSubmissions',
      key: 'totalSubmissions',
      width: 100,
      align: 'center',
    },
    {
      title: '驳回数',
      dataIndex: 'rejectedCount',
      key: 'rejectedCount',
      width: 80,
      align: 'center',
      render: (val: number) => <span style={{ color: '#ff4d4f' }}>{val}</span>,
    },
    {
      title: '驳回率',
      dataIndex: 'rejectionRate',
      key: 'rejectionRate',
      width: 100,
      render: (rate: number) => (
        <Tag color="error">{rate?.toFixed(1)}%</Tag>
      ),
    },
  ];

  // 滞留填报表格列
  const staleColumns: TableColumnsType<AlertsData['staleSubmissions'][0]> = [
    {
      title: '项目名称',
      dataIndex: 'projectName',
      key: 'projectName',
    },
    {
      title: '提交人',
      dataIndex: 'submitterName',
      key: 'submitterName',
      width: 100,
    },
    {
      title: '所属单位',
      dataIndex: 'submitterOrg',
      key: 'submitterOrg',
      width: 150,
    },
    {
      title: '最后更新',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 120,
      render: formatDate,
    },
    {
      title: '滞留天数',
      dataIndex: 'daysSinceUpdate',
      key: 'daysSinceUpdate',
      width: 100,
      render: (days: number) => (
        <Tag color={days >= 14 ? 'error' : 'warning'}>
          {Math.floor(days)} 天
        </Tag>
      ),
    },
  ];

  const summary = alerts?.summary || {
    lowProgressCount: 0,
    upcomingDeadlineCount: 0,
    highRejectionCount: 0,
    staleSubmissionCount: 0,
  };

  const totalAlerts = summary.lowProgressCount + summary.upcomingDeadlineCount +
    summary.highRejectionCount + summary.staleSubmissionCount;

  return (
    <div className={styles.alertsPage}>
      {/* 页面标题 */}
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>
          <WarningOutlined style={{ marginRight: 8, color: '#fa8c16' }} />
          预警提醒
        </h1>
        <p className={styles.pageSubtitle}>
          当前共有 <strong>{totalAlerts}</strong> 条预警信息需要关注
        </p>
      </div>

      <Spin spinning={loading}>
        {/* 预警统计卡片 */}
        <Row gutter={16} className={styles.statsRow}>
          <Col span={6}>
            <Card className={styles.alertCard}>
              <div className={styles.alertStat}>
                <Badge count={summary.lowProgressCount} overflowCount={99}>
                  <div className={styles.alertIcon} style={{ background: '#fff1f0' }}>
                    <ExclamationCircleOutlined style={{ color: '#ff4d4f', fontSize: 24 }} />
                  </div>
                </Badge>
                <div className={styles.alertInfo}>
                  <span className={styles.alertLabel}>进度落后</span>
                  <span className={styles.alertDesc}>完成率低于50%的项目</span>
                </div>
              </div>
            </Card>
          </Col>
          <Col span={6}>
            <Card className={styles.alertCard}>
              <div className={styles.alertStat}>
                <Badge count={summary.upcomingDeadlineCount} overflowCount={99}>
                  <div className={styles.alertIcon} style={{ background: '#fff7e6' }}>
                    <ClockCircleOutlined style={{ color: '#fa8c16', fontSize: 24 }} />
                  </div>
                </Badge>
                <div className={styles.alertInfo}>
                  <span className={styles.alertLabel}>即将到期</span>
                  <span className={styles.alertDesc}>7天内到期的项目</span>
                </div>
              </div>
            </Card>
          </Col>
          <Col span={6}>
            <Card className={styles.alertCard}>
              <div className={styles.alertStat}>
                <Badge count={summary.highRejectionCount} overflowCount={99}>
                  <div className={styles.alertIcon} style={{ background: '#fff2e8' }}>
                    <CloseCircleOutlined style={{ color: '#fa541c', fontSize: 24 }} />
                  </div>
                </Badge>
                <div className={styles.alertInfo}>
                  <span className={styles.alertLabel}>高驳回率</span>
                  <span className={styles.alertDesc}>驳回率超过20%的区县</span>
                </div>
              </div>
            </Card>
          </Col>
          <Col span={6}>
            <Card className={styles.alertCard}>
              <div className={styles.alertStat}>
                <Badge count={summary.staleSubmissionCount} overflowCount={99}>
                  <div className={styles.alertIcon} style={{ background: '#e6f7ff' }}>
                    <WarningOutlined style={{ color: '#1890ff', fontSize: 24 }} />
                  </div>
                </Badge>
                <div className={styles.alertInfo}>
                  <span className={styles.alertLabel}>待审滞留</span>
                  <span className={styles.alertDesc}>超过7天未处理的填报</span>
                </div>
              </div>
            </Card>
          </Col>
        </Row>

        {/* 预警详情 */}
        <Row gutter={16}>
          <Col span={12}>
            <Card
              title={
                <span>
                  <ExclamationCircleOutlined style={{ color: '#ff4d4f', marginRight: 8 }} />
                  进度落后项目
                </span>
              }
              className={styles.detailCard}
            >
              {alerts?.lowProgressProjects && alerts.lowProgressProjects.length > 0 ? (
                <Table
                  dataSource={alerts.lowProgressProjects}
                  columns={lowProgressColumns}
                  rowKey="id"
                  pagination={false}
                  size="small"
                />
              ) : (
                <Empty description="暂无进度落后的项目" />
              )}
            </Card>
          </Col>
          <Col span={12}>
            <Card
              title={
                <span>
                  <ClockCircleOutlined style={{ color: '#fa8c16', marginRight: 8 }} />
                  即将到期项目
                </span>
              }
              className={styles.detailCard}
            >
              {alerts?.upcomingDeadlines && alerts.upcomingDeadlines.length > 0 ? (
                <Table
                  dataSource={alerts.upcomingDeadlines}
                  columns={deadlineColumns}
                  rowKey="id"
                  pagination={false}
                  size="small"
                />
              ) : (
                <Empty description="暂无即将到期的项目" />
              )}
            </Card>
          </Col>
        </Row>

        <Row gutter={16} style={{ marginTop: 16 }}>
          <Col span={12}>
            <Card
              title={
                <span>
                  <CloseCircleOutlined style={{ color: '#fa541c', marginRight: 8 }} />
                  高驳回率区县
                </span>
              }
              className={styles.detailCard}
            >
              {alerts?.highRejectionDistricts && alerts.highRejectionDistricts.length > 0 ? (
                <Table
                  dataSource={alerts.highRejectionDistricts}
                  columns={rejectionColumns}
                  rowKey="id"
                  pagination={false}
                  size="small"
                />
              ) : (
                <Empty description="暂无高驳回率的区县" />
              )}
            </Card>
          </Col>
          <Col span={12}>
            <Card
              title={
                <span>
                  <WarningOutlined style={{ color: '#1890ff', marginRight: 8 }} />
                  待审滞留填报
                </span>
              }
              className={styles.detailCard}
            >
              {alerts?.staleSubmissions && alerts.staleSubmissions.length > 0 ? (
                <Table
                  dataSource={alerts.staleSubmissions}
                  columns={staleColumns}
                  rowKey="id"
                  pagination={false}
                  size="small"
                />
              ) : (
                <Empty description="暂无滞留的填报" />
              )}
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  );
};

export default Alerts;
