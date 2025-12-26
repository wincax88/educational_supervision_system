/**
 * 历年对比页面
 * 展示项目历年数据对比分析
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, Row, Col, Select, Spin, Table, Empty } from 'antd';
import type { TableColumnsType } from 'antd';
import {
  LineChartOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import * as reportService from '../../../services/reportService';
import type { ComparisonData } from '../../../services/reportService';
import styles from './index.module.css';

const Comparison: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [comparison, setComparison] = useState<ComparisonData | null>(null);
  const [assessmentType, setAssessmentType] = useState<string | undefined>(undefined);

  // 加载对比数据
  const loadComparison = useCallback(async () => {
    setLoading(true);
    try {
      const data = await reportService.getComparison({ assessmentType });
      setComparison(data);
    } catch (error) {
      console.error('加载对比数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, [assessmentType]);

  useEffect(() => {
    loadComparison();
  }, [loadComparison]);

  // 年度趋势折线图配置
  const getYearlyTrendOption = () => {
    if (!comparison?.yearlyComparison || comparison.yearlyComparison.length === 0) {
      return {};
    }

    // 按年份分组数据
    const yearMap = new Map<number, { balanced: number; preschool: number }>();
    comparison.yearlyComparison.forEach(item => {
      const year = Number(item.year);
      if (!yearMap.has(year)) {
        yearMap.set(year, { balanced: 0, preschool: 0 });
      }
      const entry = yearMap.get(year)!;
      if (item.assessmentType === '优质均衡') {
        entry.balanced = item.approvalRate || 0;
      } else if (item.assessmentType === '普及普惠') {
        entry.preschool = item.approvalRate || 0;
      }
    });

    const years = Array.from(yearMap.keys()).sort();
    const balancedData = years.map(y => yearMap.get(y)?.balanced || 0);
    const preschoolData = years.map(y => yearMap.get(y)?.preschool || 0);

    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: unknown[]) => {
          let result = `${(params[0] as { name: string }).name}年<br/>`;
          (params as Array<{ seriesName: string; value: number; color: string }>).forEach(p => {
            result += `${p.seriesName}: ${p.value?.toFixed(1) || 0}%<br/>`;
          });
          return result;
        },
      },
      legend: {
        data: ['优质均衡', '普及普惠'],
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: years.map(String),
      },
      yAxis: {
        type: 'value',
        max: 100,
        axisLabel: {
          formatter: '{value}%',
        },
      },
      series: [
        {
          name: '优质均衡',
          type: 'line',
          data: balancedData,
          smooth: true,
          itemStyle: { color: '#13c2c2' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(19, 194, 194, 0.3)' },
                { offset: 1, color: 'rgba(19, 194, 194, 0.05)' },
              ],
            },
          },
        },
        {
          name: '普及普惠',
          type: 'line',
          data: preschoolData,
          smooth: true,
          itemStyle: { color: '#722ed1' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(114, 46, 209, 0.3)' },
                { offset: 1, color: 'rgba(114, 46, 209, 0.05)' },
              ],
            },
          },
        },
      ],
    };
  };

  // 年度项目数量柱状图配置
  const getProjectCountOption = () => {
    if (!comparison?.yearlyComparison || comparison.yearlyComparison.length === 0) {
      return {};
    }

    // 按年份分组
    const yearMap = new Map<number, { balanced: number; preschool: number }>();
    comparison.yearlyComparison.forEach(item => {
      const year = Number(item.year);
      if (!yearMap.has(year)) {
        yearMap.set(year, { balanced: 0, preschool: 0 });
      }
      const entry = yearMap.get(year)!;
      if (item.assessmentType === '优质均衡') {
        entry.balanced = item.projectCount || 0;
      } else if (item.assessmentType === '普及普惠') {
        entry.preschool = item.projectCount || 0;
      }
    });

    const years = Array.from(yearMap.keys()).sort();
    const balancedData = years.map(y => yearMap.get(y)?.balanced || 0);
    const preschoolData = years.map(y => yearMap.get(y)?.preschool || 0);

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow',
        },
      },
      legend: {
        data: ['优质均衡', '普及普惠'],
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: years.map(String),
      },
      yAxis: {
        type: 'value',
      },
      series: [
        {
          name: '优质均衡',
          type: 'bar',
          stack: 'total',
          data: balancedData,
          itemStyle: { color: '#13c2c2' },
        },
        {
          name: '普及普惠',
          type: 'bar',
          stack: 'total',
          data: preschoolData,
          itemStyle: { color: '#722ed1' },
        },
      ],
    };
  };

  // 区县对比表格列
  const districtColumns: TableColumnsType<ComparisonData['districtComparison'][0]> = [
    {
      title: '区县',
      dataIndex: 'districtName',
      key: 'districtName',
      width: 120,
    },
    {
      title: '年度',
      dataIndex: 'year',
      key: 'year',
      width: 80,
      render: (year: number) => String(year),
    },
    {
      title: '填报数',
      dataIndex: 'submissionCount',
      key: 'submissionCount',
      width: 100,
      align: 'center',
    },
    {
      title: '已通过',
      dataIndex: 'approvedCount',
      key: 'approvedCount',
      width: 100,
      align: 'center',
      render: (val: number) => <span style={{ color: '#52c41a' }}>{val}</span>,
    },
    {
      title: '通过率',
      dataIndex: 'approvalRate',
      key: 'approvalRate',
      width: 100,
      render: (rate: number) => `${rate?.toFixed(1) || 0}%`,
    },
  ];

  // 年度统计表格列
  const yearlyColumns: TableColumnsType<ComparisonData['yearlyComparison'][0]> = [
    {
      title: '年度',
      dataIndex: 'year',
      key: 'year',
      width: 80,
      render: (year: number) => String(year),
    },
    {
      title: '评估类型',
      dataIndex: 'assessmentType',
      key: 'assessmentType',
      width: 100,
    },
    {
      title: '项目数',
      dataIndex: 'projectCount',
      key: 'projectCount',
      width: 80,
      align: 'center',
    },
    {
      title: '填报数',
      dataIndex: 'submissionCount',
      key: 'submissionCount',
      width: 100,
      align: 'center',
    },
    {
      title: '已通过',
      dataIndex: 'approvedCount',
      key: 'approvedCount',
      width: 100,
      align: 'center',
      render: (val: number) => <span style={{ color: '#52c41a' }}>{val}</span>,
    },
    {
      title: '通过率',
      dataIndex: 'approvalRate',
      key: 'approvalRate',
      width: 100,
      render: (rate: number) => `${rate?.toFixed(1) || 0}%`,
    },
  ];

  return (
    <div className={styles.comparisonPage}>
      {/* 页面标题 */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>
            <LineChartOutlined style={{ marginRight: 8, color: '#1890ff' }} />
            历年对比
          </h1>
          <p className={styles.pageSubtitle}>评估项目历年数据趋势分析</p>
        </div>
        <Select
          placeholder="评估类型"
          allowClear
          style={{ width: 140 }}
          value={assessmentType}
          onChange={setAssessmentType}
          options={[
            { value: '优质均衡', label: '优质均衡' },
            { value: '普及普惠', label: '普及普惠' },
          ]}
        />
      </div>

      <Spin spinning={loading}>
        {/* 图表区域 */}
        <Row gutter={16} className={styles.chartsRow}>
          <Col span={12}>
            <Card title="年度通过率趋势" className={styles.chartCard}>
              {comparison?.yearlyComparison && comparison.yearlyComparison.length > 0 ? (
                <ReactECharts
                  option={getYearlyTrendOption()}
                  style={{ height: 300 }}
                  notMerge
                />
              ) : (
                <Empty description="暂无数据" style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }} />
              )}
            </Card>
          </Col>
          <Col span={12}>
            <Card title="年度项目数量" className={styles.chartCard}>
              {comparison?.yearlyComparison && comparison.yearlyComparison.length > 0 ? (
                <ReactECharts
                  option={getProjectCountOption()}
                  style={{ height: 300 }}
                  notMerge
                />
              ) : (
                <Empty description="暂无数据" style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }} />
              )}
            </Card>
          </Col>
        </Row>

        {/* 数据表格 */}
        <Row gutter={16}>
          <Col span={12}>
            <Card title="年度统计明细" className={styles.tableCard}>
              {comparison?.yearlyComparison && comparison.yearlyComparison.length > 0 ? (
                <Table
                  dataSource={comparison.yearlyComparison}
                  columns={yearlyColumns}
                  rowKey={(record) => `${record.year}-${record.assessmentType}`}
                  pagination={false}
                  size="small"
                  scroll={{ y: 300 }}
                />
              ) : (
                <Empty description="暂无数据" />
              )}
            </Card>
          </Col>
          <Col span={12}>
            <Card title="区县历年对比" className={styles.tableCard}>
              {comparison?.districtComparison && comparison.districtComparison.length > 0 ? (
                <Table
                  dataSource={comparison.districtComparison}
                  columns={districtColumns}
                  rowKey={(record) => `${record.districtId}-${record.year}`}
                  pagination={false}
                  size="small"
                  scroll={{ y: 300 }}
                />
              ) : (
                <Empty description="暂无数据" />
              )}
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  );
};

export default Comparison;
