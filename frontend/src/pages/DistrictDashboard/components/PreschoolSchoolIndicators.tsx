/**
 * 普及普惠（幼儿园）学校指标组件
 *
 * 显示学前教育普及普惠督导评估的各幼儿园指标情况
 */
import React, { useState, useEffect } from 'react';
import { Table, Tag, Progress, Card, Row, Col, Statistic, Spin, Empty, Modal } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  MinusCircleOutlined,
} from '@ant-design/icons';
import {
  getDistrictSchoolsIndicatorSummary,
  getSchoolIndicatorDetail,
  SchoolIndicatorSummary,
  SchoolIndicatorDetail,
} from '../../../services/districtService';

interface PreschoolSchoolIndicatorsProps {
  districtId: string;
  projectId: string;
}

const PreschoolSchoolIndicators: React.FC<PreschoolSchoolIndicatorsProps> = ({
  districtId,
  projectId,
}) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{
    summary: {
      schoolCount: number;
      totalIndicators: number;
      totalCompliant: number;
      totalNonCompliant: number;
      avgComplianceRate: number | null;
    } | null;
    schools: SchoolIndicatorSummary[];
  }>({ summary: null, schools: [] });

  // 学校详情弹窗
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [schoolDetail, setSchoolDetail] = useState<SchoolIndicatorDetail | null>(null);

  // 加载数据（固定筛选幼儿园）
  useEffect(() => {
    if (!districtId || !projectId) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const result = await getDistrictSchoolsIndicatorSummary(districtId, projectId, '幼儿园');
        setData({
          summary: result.summary,
          schools: result.schools,
        });
      } catch (error) {
        console.error('加载数据失败:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [districtId, projectId]);

  // 查看学校详情
  const handleViewDetail = async (schoolId: string) => {
    setDetailModalVisible(true);
    setDetailLoading(true);

    try {
      const detail = await getSchoolIndicatorDetail(schoolId, projectId);
      setSchoolDetail(detail);
    } catch (error) {
      console.error('加载学校详情失败:', error);
      setSchoolDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  if (!projectId) {
    return <Empty description="请先选择项目" />;
  }

  // 学校列表列定义
  const columns: ColumnsType<SchoolIndicatorSummary> = [
    {
      title: '幼儿园名称',
      key: 'name',
      width: 200,
      fixed: 'left',
      render: (_, record) => record?.school?.name ?? '-',
    },
    {
      title: '办学性质',
      key: 'schoolCategory',
      width: 100,
      render: (_, record) => {
        const category = record?.school?.schoolCategory;
        if (!category) return '-';

        const colorMap: Record<string, string> = {
          '公办': 'green',
          '民办': 'blue',
        };

        return <Tag color={colorMap[category] || 'default'}>{category}</Tag>;
      },
    },
    {
      title: '城乡类型',
      key: 'urbanRural',
      width: 80,
      render: (_, record) => record?.school?.urbanRural ?? '-',
    },
    {
      title: '在园幼儿数',
      key: 'studentCount',
      width: 100,
      align: 'right',
      render: (_, record) => record?.school?.studentCount ?? '-',
    },
    {
      title: '教职工数',
      key: 'teacherCount',
      width: 100,
      align: 'right',
      render: (_, record) => record?.school?.teacherCount ?? '-',
    },
    {
      title: '指标统计',
      key: 'stats',
      width: 150,
      render: (_, record) => (
        <span>
          <Tag color="success">{record?.statistics?.compliant ?? 0} 达标</Tag>
          <Tag color="error">{record?.statistics?.nonCompliant ?? 0} 未达标</Tag>
        </span>
      ),
    },
    {
      title: '达标率',
      dataIndex: 'complianceRate',
      key: 'complianceRate',
      width: 180,
      render: (rate: number | null) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Progress
            percent={rate || 0}
            size="small"
            style={{ width: 100 }}
            strokeColor={
              (rate || 0) >= 90 ? '#52c41a' : (rate || 0) >= 70 ? '#faad14' : '#ff4d4f'
            }
            showInfo={false}
          />
          <span style={{ fontWeight: 500 }}>{rate !== null ? `${rate}%` : '-'}</span>
        </div>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      fixed: 'right',
      render: (_, record) => {
        const schoolId = record?.school?.id;
        if (!schoolId) return <span style={{ color: '#999' }}>-</span>;
        return <a onClick={() => handleViewDetail(schoolId)}>查看详情</a>;
      },
    },
  ];

  // 可展开行内容
  const expandedRowRender = (record: SchoolIndicatorSummary) => {
    if (!record?.nonCompliantIndicators || record.nonCompliantIndicators.length === 0) {
      return <div style={{ padding: 16, color: '#52c41a' }}>所有指标均达标</div>;
    }

    return (
      <div style={{ padding: '8px 16px', background: '#fafafa' }}>
        <div style={{ fontWeight: 500, marginBottom: 8 }}>未达标指标：</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {record.nonCompliantIndicators.map((indicator, index) => (
            <Tag key={index} color="error">
              {indicator.indicatorName}
              <span style={{ marginLeft: 4, opacity: 0.7 }}>
                (实际值: {indicator.value ?? indicator.text_value ?? '-'}, 阈值: {indicator.threshold})
              </span>
            </Tag>
          ))}
        </div>
      </div>
    );
  };

  // 学校详情指标列表列定义
  const detailColumns: ColumnsType<SchoolIndicatorDetail['indicators'][0]> = [
    {
      title: '指标代码',
      dataIndex: 'indicatorCode',
      key: 'indicatorCode',
      width: 120,
    },
    {
      title: '指标名称',
      dataIndex: 'indicatorName',
      key: 'indicatorName',
      width: 200,
    },
    {
      title: '实际值',
      key: 'value',
      width: 120,
      render: (_, record) => record.value ?? record.textValue ?? '-',
    },
    {
      title: '阈值',
      dataIndex: 'threshold',
      key: 'threshold',
      width: 100,
    },
    {
      title: '达标状态',
      dataIndex: 'isCompliant',
      key: 'isCompliant',
      width: 100,
      render: (status: number | null) => {
        if (status === 1) {
          return <Tag icon={<CheckCircleOutlined />} color="success">达标</Tag>;
        } else if (status === 0) {
          return <Tag icon={<CloseCircleOutlined />} color="error">未达标</Tag>;
        }
        return <Tag icon={<MinusCircleOutlined />} color="default">待评估</Tag>;
      },
    },
    {
      title: '采集时间',
      dataIndex: 'collectedAt',
      key: 'collectedAt',
      width: 120,
    },
  ];

  return (
    <div>
      {/* 汇总统计 */}
      {data.summary && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic title="幼儿园总数" value={data.summary.schoolCount} suffix="所" />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="指标总数"
                value={data.summary.totalIndicators}
                suffix="项"
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="达标/未达标"
                value={`${data.summary.totalCompliant} / ${data.summary.totalNonCompliant}`}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="平均达标率"
                value={data.summary.avgComplianceRate || 0}
                precision={2}
                suffix="%"
                styles={{
                  content: {
                    color:
                      (data.summary.avgComplianceRate || 0) >= 90
                        ? '#3f8600'
                        : (data.summary.avgComplianceRate || 0) >= 70
                        ? '#faad14'
                        : '#cf1322',
                  },
                }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* 幼儿园列表 */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Spin size="large" />
        </div>
      ) : data.schools.length > 0 ? (
        <Table
          columns={columns}
          dataSource={data.schools}
          rowKey={(record) => record?.school?.id || `row-${Math.random()}`}
          expandable={{
            expandedRowRender,
            rowExpandable: (record) => (record?.statistics?.total ?? 0) > 0,
          }}
          scroll={{ x: 1100 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 所幼儿园`,
          }}
        />
      ) : (
        <Empty description="暂无幼儿园数据" />
      )}

      {/* 幼儿园详情弹窗 */}
      <Modal
        title={
          schoolDetail?.school?.name
            ? `${schoolDetail.school.name} - 指标详情`
            : '指标详情'
        }
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false);
          setSchoolDetail(null);
        }}
        width={900}
        footer={null}
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin size="large" />
          </div>
        ) : schoolDetail?.school ? (
          <div>
            {/* 幼儿园基本信息 */}
            <Card size="small" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={6}>
                  <Statistic title="学校类型" value={schoolDetail.school.schoolType} />
                </Col>
                <Col span={6}>
                  <Statistic title="在园幼儿数" value={schoolDetail.school.studentCount} />
                </Col>
                <Col span={6}>
                  <Statistic title="教职工数" value={schoolDetail.school.teacherCount} />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="达标率"
                    value={schoolDetail.complianceRate || 0}
                    suffix="%"
                    styles={{
                      content: {
                        color:
                          (schoolDetail.complianceRate || 0) >= 90
                            ? '#3f8600'
                            : (schoolDetail.complianceRate || 0) >= 70
                            ? '#faad14'
                            : '#cf1322',
                      },
                    }}
                  />
                </Col>
              </Row>
            </Card>

            {/* 指标列表 */}
            <Table
              columns={detailColumns}
              dataSource={schoolDetail.indicators}
              rowKey="id"
              size="small"
              pagination={false}
              scroll={{ y: 400 }}
            />
          </div>
        ) : (
          <Empty description="暂无数据" />
        )}
      </Modal>
    </div>
  );
};

export default PreschoolSchoolIndicators;
