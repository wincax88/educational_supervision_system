/**
 * 优质均衡学校指标组件
 *
 * 显示义务教育优质均衡发展督导评估的各学校指标情况
 * 包括：小学、初中、九年一贯制、完全中学
 */
import React, { useState, useEffect } from 'react';
import { Table, Tag, Progress, Select, Card, Row, Col, Statistic, Spin, Empty, Modal, Tabs } from 'antd';
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
import {
  getResourceIndicatorsSummary,
  SchoolResourceIndicators,
} from '../../../services/statisticsService';

interface BalancedSchoolIndicatorsProps {
  districtId: string;
  projectId: string;
}

const BalancedSchoolIndicators: React.FC<BalancedSchoolIndicatorsProps> = ({
  districtId,
  projectId,
}) => {
  const [loading, setLoading] = useState(false);
  const [schoolType, setSchoolType] = useState<string>('');
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
  // 资源配置数据（用于显示L1-L7达标情况）
  const [resourceData, setResourceData] = useState<Map<string, SchoolResourceIndicators>>(new Map());

  // 学校详情弹窗
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [schoolDetail, setSchoolDetail] = useState<SchoolIndicatorDetail | null>(null);
  const [primaryDetail, setPrimaryDetail] = useState<SchoolIndicatorDetail | null>(null);
  const [juniorDetail, setJuniorDetail] = useState<SchoolIndicatorDetail | null>(null);
  const [detailTabKey, setDetailTabKey] = useState<string>('primary');
  const [currentSchoolType, setCurrentSchoolType] = useState<string>('');

  // 学校类型选项
  const schoolTypeOptions = [
    { value: '小学', label: '小学' },
    { value: '初中', label: '初中' },
    { value: '九年一贯制', label: '九年一贯制' },
    { value: '完全中学', label: '完全中学' },
  ];

  // 加载数据
  useEffect(() => {
    if (!districtId || !projectId) return;

    const loadData = async () => {
      setLoading(true);
      try {
        // 并行加载指标数据和资源配置数据
        const [result, primaryResource, juniorResource] = await Promise.all([
          getDistrictSchoolsIndicatorSummary(districtId, projectId, schoolType || undefined),
          getResourceIndicatorsSummary(districtId, projectId, '小学').catch(() => null),
          getResourceIndicatorsSummary(districtId, projectId, '初中').catch(() => null),
        ]);

        setData({
          summary: result.summary,
          schools: result.schools,
        });

        // 合并资源配置数据到 Map
        const resMap = new Map<string, SchoolResourceIndicators>();

        if (primaryResource?.schools) {
          primaryResource.schools.forEach((s) => {
            const key = s.schoolType === '九年一贯制' || s.schoolType === '完全中学'
              ? `${s.id}-primary`
              : s.id;
            resMap.set(key, s);
          });
        }
        if (juniorResource?.schools) {
          juniorResource.schools.forEach((s) => {
            const key = s.schoolType === '九年一贯制' || s.schoolType === '完全中学'
              ? `${s.id}-junior`
              : s.id;
            resMap.set(key, s);
          });
        }
        setResourceData(resMap);
      } catch (error) {
        console.error('加载数据失败:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [districtId, projectId, schoolType]);

  // 查看学校详情
  const handleViewDetail = async (schoolId: string, schoolTypeName?: string) => {
    setDetailModalVisible(true);
    setDetailLoading(true);
    setCurrentSchoolType(schoolTypeName || '');
    setDetailTabKey('primary');

    try {
      const isIntegratedSchool = schoolTypeName === '九年一贯制' || schoolTypeName === '完全中学';

      if (isIntegratedSchool) {
        const [primaryData, juniorData] = await Promise.all([
          getSchoolIndicatorDetail(schoolId, projectId, 'primary'),
          getSchoolIndicatorDetail(schoolId, projectId, 'junior')
        ]);
        setPrimaryDetail(primaryData);
        setJuniorDetail(juniorData);
        setSchoolDetail(primaryData);
      } else {
        const detail = await getSchoolIndicatorDetail(schoolId, projectId);
        setSchoolDetail(detail);
        setPrimaryDetail(null);
        setJuniorDetail(null);
      }
    } catch (error) {
      console.error('加载学校详情失败:', error);
      setSchoolDetail(null);
      setPrimaryDetail(null);
      setJuniorDetail(null);
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
      title: '学校名称',
      key: 'name',
      width: 200,
      fixed: 'left',
      render: (_, record) => record?.school?.name ?? '-',
    },
    {
      title: '学校类型',
      key: 'schoolType',
      width: 120,
      render: (_, record) => {
        const type = record?.school?.schoolType;
        const sectionName = record?.school?.sectionName;
        if (!type) return '-';

        let displayType = type;
        if (sectionName && (type.includes('九年一贯制') || type.includes('完全中学'))) {
          displayType = sectionName;
        }

        const colorMap: Record<string, string> = {
          '小学': 'blue',
          '初中': 'green',
          '小学部': 'blue',
          '初中部': 'green',
          '九年一贯制': 'orange',
          '完全中学': 'purple',
        };

        return <Tag color={colorMap[displayType] || 'orange'}>{displayType}</Tag>;
      },
    },
    {
      title: '城乡类型',
      key: 'urbanRural',
      width: 80,
      render: (_, record) => record?.school?.urbanRural ?? '-',
    },
    {
      title: '资源配置达标',
      key: 'resourceCompliance',
      width: 120,
      align: 'center',
      render: (_, record) => {
        const schoolId = record?.school?.id;
        const sectionType = record?.school?.sectionType;
        if (!schoolId) return '-';

        const schoolTypeVal = record?.school?.schoolType;
        const isIntegratedSection = schoolTypeVal?.startsWith('九年一贯制') || schoolTypeVal?.startsWith('完全中学');
        const key = isIntegratedSection && sectionType ? `${schoolId}-${sectionType}` : schoolId;
        const resInfo = resourceData.get(key);

        if (!resInfo) {
          return <Tag color="default">暂无数据</Tag>;
        }

        const { compliantCount, totalCount, isOverallCompliant } = resInfo;
        if (totalCount === 0) {
          return <Tag color="default">暂无数据</Tag>;
        }

        return (
          <div>
            <Tag color={isOverallCompliant ? 'success' : isOverallCompliant === false ? 'error' : 'default'}>
              {isOverallCompliant ? '综合达标' : isOverallCompliant === false ? '综合未达标' : '待评估'}
            </Tag>
            <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
              {compliantCount}/{totalCount} 项
            </div>
          </div>
        );
      },
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
        const schoolTypeName = record?.school?.schoolType;
        const originalSchoolType = schoolTypeName?.includes('九年一贯制')
          ? '九年一贯制'
          : schoolTypeName?.includes('完全中学')
          ? '完全中学'
          : schoolTypeName;
        if (!schoolId) return <span style={{ color: '#999' }}>-</span>;
        return <a onClick={() => handleViewDetail(schoolId, originalSchoolType)}>查看详情</a>;
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

  // 渲染详情内容
  const renderDetailContent = (detail: SchoolIndicatorDetail, label: string) => (
    <div>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={6}>
            <Statistic title="学校类型" value={label} />
          </Col>
          <Col span={6}>
            <Statistic title="学生数" value={detail.school.studentCount} />
          </Col>
          <Col span={6}>
            <Statistic title="教师数" value={detail.school.teacherCount} />
          </Col>
          <Col span={6}>
            <Statistic
              title="达标率"
              value={detail.complianceRate || 0}
              suffix="%"
              styles={{
                content: {
                  color:
                    (detail.complianceRate || 0) >= 90
                      ? '#3f8600'
                      : (detail.complianceRate || 0) >= 70
                      ? '#faad14'
                      : '#cf1322',
                },
              }}
            />
          </Col>
        </Row>
      </Card>
      <Table
        columns={detailColumns}
        dataSource={detail.indicators}
        rowKey="id"
        size="small"
        pagination={false}
        scroll={{ y: 400 }}
      />
    </div>
  );

  return (
    <div>
      {/* 筛选条件 */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
        <span>学校类型：</span>
        <Select
          value={schoolType}
          onChange={setSchoolType}
          style={{ width: 120 }}
          allowClear
          placeholder="全部"
          options={schoolTypeOptions}
        />
      </div>

      {/* 汇总统计 */}
      {data.summary && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic title="学校总数" value={data.summary.schoolCount} suffix="所" />
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

      {/* 学校列表 */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Spin size="large" />
        </div>
      ) : data.schools.length > 0 ? (
        <Table
          columns={columns}
          dataSource={data.schools}
          rowKey={(record) => {
            const schoolId = record?.school?.id || '';
            const sectionType = record?.school?.sectionType || '';
            return sectionType ? `${schoolId}-${sectionType}` : schoolId || `row-${Math.random()}`;
          }}
          expandable={{
            expandedRowRender,
            rowExpandable: (record) => (record?.statistics?.total ?? 0) > 0,
          }}
          scroll={{ x: 1200 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 所学校`,
          }}
        />
      ) : (
        <Empty description="暂无学校数据" />
      )}

      {/* 学校详情弹窗 */}
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
          setPrimaryDetail(null);
          setJuniorDetail(null);
        }}
        width={900}
        footer={null}
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin size="large" />
          </div>
        ) : schoolDetail?.school ? (
          (() => {
            const isIntegratedSchool = currentSchoolType === '九年一贯制' || currentSchoolType === '完全中学';

            return isIntegratedSchool && primaryDetail && juniorDetail ? (
              <Tabs
                activeKey={detailTabKey}
                onChange={(key) => {
                  setDetailTabKey(key);
                  setSchoolDetail(key === 'primary' ? primaryDetail : juniorDetail);
                }}
                items={[
                  {
                    key: 'primary',
                    label: '小学部',
                    children: renderDetailContent(primaryDetail, '小学部'),
                  },
                  {
                    key: 'junior',
                    label: '初中部',
                    children: renderDetailContent(juniorDetail, '初中部'),
                  },
                ]}
              />
            ) : (
              renderDetailContent(schoolDetail, schoolDetail.school.schoolType)
            );
          })()
        ) : (
          <Empty description="暂无数据" />
        )}
      </Modal>
    </div>
  );
};

export default BalancedSchoolIndicators;
