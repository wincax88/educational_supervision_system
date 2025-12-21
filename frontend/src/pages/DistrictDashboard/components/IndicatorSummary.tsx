import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Table, Select, Spin, Empty, Tag, Tooltip, Collapse } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  QuestionCircleOutlined,
  FileTextOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import {
  getResourceIndicatorsSummary,
  ResourceIndicatorsSummary,
  CVIndicatorSummary,
  SchoolResourceIndicators,
  getGovernmentGuaranteeSummary,
  GovernmentGuaranteeResponse,
  GovernmentGuaranteeIndicator,
  getEducationQualitySummary,
  EducationQualityResponse,
  EducationQualityIndicator,
  getSocialRecognitionSummary,
  SocialRecognitionResponse,
  SocialRecognitionIndicator,
} from '../../../services/statisticsService';

interface IndicatorSummaryProps {
  districtId: string;
  projectId: string;
  refreshKey?: number;
}

// 指标代码到简称映射
const INDICATOR_SHORT_NAMES: Record<string, string> = {
  L1: '高学历教师',
  L2: '骨干教师',
  L3: '体艺教师',
  L4: '教学用房',
  L5: '体育场馆',
  L6: '教学设备',
  L7: '多媒体教室',
};

const IndicatorSummary: React.FC<IndicatorSummaryProps> = ({ districtId, projectId, refreshKey }) => {
  const [loading, setLoading] = useState(false);
  const [schoolType, setSchoolType] = useState<string>('小学');
  const [data, setData] = useState<ResourceIndicatorsSummary | null>(null);
  const [govData, setGovData] = useState<GovernmentGuaranteeResponse | null>(null);
  const [govLoading, setGovLoading] = useState(false);
  const [eduQualityData, setEduQualityData] = useState<EducationQualityResponse | null>(null);
  const [eduQualityLoading, setEduQualityLoading] = useState(false);
  const [socialRecogData, setSocialRecogData] = useState<SocialRecognitionResponse | null>(null);
  const [socialRecogLoading, setSocialRecogLoading] = useState(false);

  // 加载资源配置指标数据
  useEffect(() => {
    if (!districtId || !projectId) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const result = await getResourceIndicatorsSummary(districtId, projectId, schoolType);
        setData(result);
      } catch (error) {
        console.error('加载数据失败:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [districtId, projectId, schoolType, refreshKey]);

  // 加载政府保障程度指标数据
  useEffect(() => {
    if (!districtId || !projectId) return;

    const loadGovData = async () => {
      setGovLoading(true);
      try {
        const result = await getGovernmentGuaranteeSummary(districtId, projectId);
        setGovData(result);
      } catch (error) {
        console.error('加载政府保障程度数据失败:', error);
      } finally {
        setGovLoading(false);
      }
    };

    loadGovData();
  }, [districtId, projectId, refreshKey]);

  // 加载教育质量指标数据
  useEffect(() => {
    if (!districtId || !projectId) return;

    const loadEduQualityData = async () => {
      setEduQualityLoading(true);
      try {
        const result = await getEducationQualitySummary(districtId, projectId);
        setEduQualityData(result);
      } catch (error) {
        console.error('加载教育质量数据失败:', error);
      } finally {
        setEduQualityLoading(false);
      }
    };

    loadEduQualityData();
  }, [districtId, projectId, refreshKey]);

  // 加载社会认可度指标数据
  useEffect(() => {
    if (!districtId || !projectId) return;

    const loadSocialRecogData = async () => {
      setSocialRecogLoading(true);
      try {
        const result = await getSocialRecognitionSummary(districtId, projectId);
        setSocialRecogData(result);
      } catch (error) {
        console.error('加载社会认可度数据失败:', error);
      } finally {
        setSocialRecogLoading(false);
      }
    };

    loadSocialRecogData();
  }, [districtId, projectId, refreshKey]);

  if (!projectId) {
    return <Empty description="请先选择项目" />;
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <Spin size="large" />
      </div>
    );
  }

  // 渲染差异系数状态标签
  const renderCVStatus = (cv: CVIndicatorSummary) => {
    if (cv.cv === null) {
      // 有数据但不足2所学校时，显示"需2所学校"
      if (cv.count > 0 && cv.count < 2) {
        return <Tag color="warning">需2所学校</Tag>;
      }
      return <Tag color="default">暂无数据</Tag>;
    }
    return cv.isCompliant ? (
      <Tag icon={<CheckCircleOutlined />} color="success">达标</Tag>
    ) : (
      <Tag icon={<CloseCircleOutlined />} color="error">未达标</Tag>
    );
  };

  // 渲染指标值单元格
  const renderIndicatorCell = (indicator: { value: number | null; threshold: number; isCompliant: boolean | null } | undefined, unit: string) => {
    if (!indicator || indicator.value === null) {
      return <span style={{ color: '#999' }}>-</span>;
    }
    const color = indicator.isCompliant ? '#52c41a' : '#ff4d4f';
    const icon = indicator.isCompliant ? <CheckCircleOutlined /> : <CloseCircleOutlined />;
    return (
      <Tooltip title={`标准: ≥${indicator.threshold}${unit}`}>
        <span style={{ color }}>
          {indicator.value} {icon}
        </span>
      </Tooltip>
    );
  };

  // 学校指标表格列定义
  const columns: ColumnsType<SchoolResourceIndicators> = [
    {
      title: '学校名称',
      dataIndex: 'name',
      key: 'name',
      width: 180,
      fixed: 'left',
    },
    {
      title: '学生数',
      dataIndex: 'studentCount',
      key: 'studentCount',
      width: 80,
      align: 'right',
    },
    {
      title: (
        <Tooltip title="每百名学生拥有高学历教师数">
          L1高学历 <QuestionCircleOutlined style={{ fontSize: 12 }} />
        </Tooltip>
      ),
      key: 'L1',
      width: 100,
      align: 'center',
      render: (_, record) => renderIndicatorCell(record.indicators?.L1, '人'),
    },
    {
      title: (
        <Tooltip title="每百名学生拥有骨干教师数">
          L2骨干 <QuestionCircleOutlined style={{ fontSize: 12 }} />
        </Tooltip>
      ),
      key: 'L2',
      width: 100,
      align: 'center',
      render: (_, record) => renderIndicatorCell(record.indicators?.L2, '人'),
    },
    {
      title: (
        <Tooltip title="每百名学生拥有体艺教师数">
          L3体艺 <QuestionCircleOutlined style={{ fontSize: 12 }} />
        </Tooltip>
      ),
      key: 'L3',
      width: 100,
      align: 'center',
      render: (_, record) => renderIndicatorCell(record.indicators?.L3, '人'),
    },
    {
      title: (
        <Tooltip title="生均教学及辅助用房面积">
          L4用房 <QuestionCircleOutlined style={{ fontSize: 12 }} />
        </Tooltip>
      ),
      key: 'L4',
      width: 100,
      align: 'center',
      render: (_, record) => renderIndicatorCell(record.indicators?.L4, '㎡'),
    },
    {
      title: (
        <Tooltip title="生均体育运动场馆面积">
          L5体育馆 <QuestionCircleOutlined style={{ fontSize: 12 }} />
        </Tooltip>
      ),
      key: 'L5',
      width: 100,
      align: 'center',
      render: (_, record) => renderIndicatorCell(record.indicators?.L5, '㎡'),
    },
    {
      title: (
        <Tooltip title="生均教学仪器设备值">
          L6设备 <QuestionCircleOutlined style={{ fontSize: 12 }} />
        </Tooltip>
      ),
      key: 'L6',
      width: 100,
      align: 'center',
      render: (_, record) => renderIndicatorCell(record.indicators?.L6, '元'),
    },
    {
      title: (
        <Tooltip title="每百名学生拥有多媒体教室数">
          L7多媒体 <QuestionCircleOutlined style={{ fontSize: 12 }} />
        </Tooltip>
      ),
      key: 'L7',
      width: 100,
      align: 'center',
      render: (_, record) => renderIndicatorCell(record.indicators?.L7, '间'),
    },
    {
      title: (
        <Tooltip title="每所学校至少6项达标，余项不低于标准的85%">
          是否达标 <QuestionCircleOutlined style={{ fontSize: 12 }} />
        </Tooltip>
      ),
      key: 'overallCompliant',
      width: 100,
      align: 'center',
      fixed: 'right',
      render: (_, record) => {
        if (record.isOverallCompliant === null) {
          return <Tag color="default">暂无数据</Tag>;
        }
        return record.isOverallCompliant ? (
          <Tooltip title={record.overallComplianceMessage}>
            <Tag icon={<CheckCircleOutlined />} color="success">达标</Tag>
          </Tooltip>
        ) : (
          <Tooltip
            title={
              <div>
                <div>{record.overallComplianceMessage}</div>
                {record.overallComplianceDetails && record.overallComplianceDetails.length > 0 && (
                  <ul style={{ margin: '8px 0 0 0', paddingLeft: 16 }}>
                    {record.overallComplianceDetails.map((detail, idx) => (
                      <li key={idx} style={{ fontSize: 12 }}>{detail}</li>
                    ))}
                  </ul>
                )}
              </div>
            }
          >
            <Tag icon={<CloseCircleOutlined />} color="error">未达标</Tag>
          </Tooltip>
        );
      },
    },
  ];

  const cvThreshold = schoolType === '小学' ? 0.50 : 0.45;

  // 渲染政府保障程度指标状态
  const renderGovIndicatorStatus = (indicator: GovernmentGuaranteeIndicator) => {
    if (indicator.isCompliant === null) {
      return <Tag color="default">{indicator.displayValue || '待填报'}</Tag>;
    }
    return indicator.isCompliant ? (
      <Tag icon={<CheckCircleOutlined />} color="success">达标</Tag>
    ) : (
      <Tag icon={<CloseCircleOutlined />} color="error">未达标</Tag>
    );
  };

  // 渲染政府保障程度指标卡片
  const renderGovIndicatorCard = (indicator: GovernmentGuaranteeIndicator) => {
    const bgColor = indicator.isCompliant === null
      ? '#f5f5f5'
      : indicator.isCompliant
      ? '#f6ffed'
      : '#fff2f0';
    const borderColor = indicator.isCompliant === null
      ? '#d9d9d9'
      : indicator.isCompliant
      ? '#b7eb8f'
      : '#ffccc7';

    return (
      <Card
        size="small"
        style={{ background: bgColor, borderColor, height: '100%' }}
      >
        <div style={{ marginBottom: 8 }}>
          <Tooltip title={indicator.name}>
            <span style={{ fontSize: 13, color: '#6b7280', fontWeight: 500 }}>
              {indicator.code.replace('G', '')}. {indicator.shortName}
            </span>
          </Tooltip>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: indicator.isCompliant === null ? '#999' : indicator.isCompliant ? '#52c41a' : '#ff4d4f' }}>
            {indicator.displayValue || '-'}
          </span>
          {renderGovIndicatorStatus(indicator)}
        </div>
        {indicator.details && indicator.details.length > 0 && (
          <Collapse
            ghost
            size="small"
            items={[{
              key: '1',
              label: <span style={{ fontSize: 12, color: '#9ca3af' }}>查看详情</span>,
              children: (
                <div style={{ fontSize: 12 }}>
                  {indicator.details.map((detail, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ color: '#666' }}>{detail.name}:</span>
                      <span style={{
                        color: detail.isCompliant === null ? '#999' : detail.isCompliant ? '#52c41a' : '#ff4d4f',
                        fontWeight: 500
                      }}>
                        {detail.displayValue || '-'}
                      </span>
                    </div>
                  ))}
                </div>
              )
            }]}
          />
        )}
        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
          标准: {indicator.threshold}
        </div>
      </Card>
    );
  };

  // 渲染教育质量指标状态
  const renderEduQualityIndicatorStatus = (indicator: EducationQualityIndicator) => {
    if (indicator.isCompliant === null) {
      return <Tag color="default">{indicator.displayValue || '待填报'}</Tag>;
    }
    return indicator.isCompliant ? (
      <Tag icon={<CheckCircleOutlined />} color="success">达标</Tag>
    ) : (
      <Tag icon={<CloseCircleOutlined />} color="error">未达标</Tag>
    );
  };

  // 渲染教育质量指标卡片
  const renderEduQualityIndicatorCard = (indicator: EducationQualityIndicator) => {
    const bgColor = indicator.isCompliant === null
      ? '#f5f5f5'
      : indicator.isCompliant
      ? '#f6ffed'
      : '#fff2f0';
    const borderColor = indicator.isCompliant === null
      ? '#d9d9d9'
      : indicator.isCompliant
      ? '#b7eb8f'
      : '#ffccc7';

    // 佐证材料类指标特殊图标
    const isMaterialType = indicator.type === 'material';
    const isQualityMonitoring = indicator.type === 'quality_monitoring';

    return (
      <Card
        size="small"
        style={{ background: bgColor, borderColor, height: '100%' }}
      >
        <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
          {isMaterialType && <FileTextOutlined style={{ color: '#1890ff', fontSize: 12 }} />}
          <Tooltip title={indicator.name}>
            <span style={{ fontSize: 13, color: '#6b7280', fontWeight: 500 }}>
              {indicator.code.replace('Q', '')}. {indicator.shortName}
            </span>
          </Tooltip>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: indicator.isCompliant === null ? '#999' : indicator.isCompliant ? '#52c41a' : '#ff4d4f' }}>
            {indicator.displayValue || '-'}
          </span>
          {renderEduQualityIndicatorStatus(indicator)}
        </div>
        {indicator.details && indicator.details.length > 0 && (
          <Collapse
            ghost
            size="small"
            items={[{
              key: '1',
              label: <span style={{ fontSize: 12, color: '#9ca3af' }}>{isQualityMonitoring ? '各科目详情' : '查看详情'}</span>,
              children: (
                <div style={{ fontSize: 12 }}>
                  {indicator.details.map((detail, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ color: '#666' }}>{detail.name}:</span>
                      <span style={{
                        color: detail.isCompliant === null ? '#999' : detail.isCompliant ? '#52c41a' : '#ff4d4f',
                        fontWeight: 500
                      }}>
                        {detail.displayValue || '-'}
                      </span>
                    </div>
                  ))}
                </div>
              )
            }]}
          />
        )}
        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
          标准: {indicator.threshold}
        </div>
      </Card>
    );
  };

  // 渲染社会认可度指标状态
  const renderSocialRecogIndicatorStatus = (indicator: SocialRecognitionIndicator) => {
    if (indicator.isCompliant === null) {
      return <Tag color="default">{indicator.displayValue || '待填报'}</Tag>;
    }
    return indicator.isCompliant ? (
      <Tag icon={<CheckCircleOutlined />} color="success">达标</Tag>
    ) : (
      <Tag icon={<CloseCircleOutlined />} color="error">未达标</Tag>
    );
  };

  // 渲染社会认可度指标卡片
  const renderSocialRecogIndicatorCard = (indicator: SocialRecognitionIndicator) => {
    const bgColor = indicator.isCompliant === null
      ? '#f5f5f5'
      : indicator.isCompliant
      ? '#f6ffed'
      : '#fff2f0';
    const borderColor = indicator.isCompliant === null
      ? '#d9d9d9'
      : indicator.isCompliant
      ? '#b7eb8f'
      : '#ffccc7';

    return (
      <Card
        size="small"
        style={{ background: bgColor, borderColor, height: '100%' }}
      >
        <div style={{ marginBottom: 8 }}>
          <Tooltip title={indicator.name}>
            <span style={{ fontSize: 13, color: '#6b7280', fontWeight: 500 }}>
              {indicator.code.replace('S', '')}. {indicator.shortName}
            </span>
          </Tooltip>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: indicator.isCompliant === null ? '#999' : indicator.isCompliant ? '#52c41a' : '#ff4d4f' }}>
            {indicator.displayValue || '-'}
          </span>
          {renderSocialRecogIndicatorStatus(indicator)}
        </div>
        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
          标准: {indicator.threshold}
        </div>
      </Card>
    );
  };

  return (
    <div>
      {/* 筛选条件 */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
        <span>学校类型：</span>
        <Select
          value={schoolType}
          onChange={setSchoolType}
          style={{ width: 120 }}
          options={[
            { value: '小学', label: '小学' },
            { value: '初中', label: '初中' },
          ]}
        />
        <span style={{ marginLeft: 'auto', color: '#666' }}>
          差异系数达标标准：≤{cvThreshold}
        </span>
      </div>

      {/* 7项差异系数汇总卡片 */}
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>7项资源配置指标差异系数</span>
            {data?.summary && (
              <span style={{ fontSize: 14, fontWeight: 'normal' }}>
                {data.summary.allCompliant ? (
                  <Tag icon={<CheckCircleOutlined />} color="success">
                    {data.summary.compliantCvCount}/{data.summary.totalCvCount} 项达标
                  </Tag>
                ) : (
                  <Tag icon={<CloseCircleOutlined />} color="error">
                    {data.summary.compliantCvCount}/{data.summary.totalCvCount} 项达标
                  </Tag>
                )}
              </span>
            )}
          </div>
        }
        style={{ marginBottom: 24 }}
      >
        {data?.summary?.cvIndicators && data.summary.cvIndicators.length > 0 ? (
          <Row gutter={[16, 16]}>
            {data.summary.cvIndicators.map((cv) => (
              <Col span={6} key={cv.code}>
                <Card
                  size="small"
                  style={{
                    background: cv.isCompliant === null ? '#f5f5f5' : cv.isCompliant ? '#f6ffed' : '#fff2f0',
                    borderColor: cv.isCompliant === null ? '#d9d9d9' : cv.isCompliant ? '#b7eb8f' : '#ffccc7',
                  }}
                >
                  <div style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: 13, color: '#6b7280' }}>
                      {cv.code} {INDICATOR_SHORT_NAMES[cv.code]}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 24, fontWeight: 600 }}>
                      {cv.cv !== null ? cv.cv.toFixed(4) : '-'}
                    </span>
                    {renderCVStatus(cv)}
                  </div>
                  {cv.cv !== null ? (
                    <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 8 }}>
                      均值: {cv.mean?.toFixed(2) ?? '-'} | 标准差: {cv.stdDev?.toFixed(2) ?? '-'} | 样本: {cv.count}
                    </div>
                  ) : cv.count > 0 && (
                    <div style={{ fontSize: 12, color: '#faad14', marginTop: 8 }}>
                      已有 {cv.count} 所学校数据，均值: {cv.mean?.toFixed(2) ?? '-'}
                    </div>
                  )}
                </Card>
              </Col>
            ))}
            {/* 综合判定卡片 */}
            <Col span={6}>
              <Card
                size="small"
                style={{
                  background: data.summary.allCompliant === null
                    ? '#f5f5f5'
                    : data.summary.allCompliant
                    ? '#f6ffed'
                    : '#fff2f0',
                  borderColor: data.summary.allCompliant === null
                    ? '#d9d9d9'
                    : data.summary.allCompliant
                    ? '#b7eb8f'
                    : '#ffccc7',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                }}
              >
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>综合判定</div>
                  <div style={{ fontSize: 28, fontWeight: 600, marginBottom: 8 }}>
                    {data.summary.compliantCvCount}/{data.summary.totalCvCount}
                  </div>
                  {data.summary.allCompliant !== null && (
                    data.summary.allCompliant ? (
                      <Tag icon={<CheckCircleOutlined />} color="success" style={{ fontSize: 14, padding: '4px 12px' }}>
                        全部达标
                      </Tag>
                    ) : (
                      <Tag icon={<CloseCircleOutlined />} color="error" style={{ fontSize: 14, padding: '4px 12px' }}>
                        未全部达标
                      </Tag>
                    )
                  )}
                </div>
              </Card>
            </Col>
          </Row>
        ) : (
          <Empty description="暂无差异系数数据" />
        )}
      </Card>

      {/* 学校指标数据表格 */}
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>各学校7项资源配置指标</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {data?.summary?.overallCompliance && (
                <span style={{ fontSize: 14, fontWeight: 'normal' }}>
                  {data.summary.overallCompliance.allSchoolsCompliant ? (
                    <Tag icon={<CheckCircleOutlined />} color="success">
                      {data.summary.overallCompliance.compliantSchools}/{data.summary.schoolCount} 所学校达标
                    </Tag>
                  ) : (
                    <Tag icon={<CloseCircleOutlined />} color="error">
                      {data.summary.overallCompliance.compliantSchools}/{data.summary.schoolCount} 所学校达标
                    </Tag>
                  )}
                </span>
              )}
              <span style={{ fontSize: 14, fontWeight: 'normal', color: '#666' }}>
                共 {data?.schools?.length || 0} 所学校
              </span>
            </div>
          </div>
        }
        style={{ marginBottom: 24 }}
      >
        {data?.schools && data.schools.length > 0 ? (
          <Table
            columns={columns}
            dataSource={data.schools}
            rowKey="id"
            scroll={{ x: 1200 }}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 所学校`,
            }}
            size="middle"
          />
        ) : (
          <Empty description="暂无学校数据" />
        )}
      </Card>

      {/* 政府保障程度15项指标 */}
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>政府保障程度（15项指标）</span>
            {govData?.summary && (
              <span style={{ fontSize: 14, fontWeight: 'normal' }}>
                {govData.summary.allCompliant === null ? (
                  <Tag icon={<ExclamationCircleOutlined />} color="warning">
                    {govData.summary.compliantCount}/{govData.summary.totalCount} 项达标，{govData.summary.pendingCount} 项待填报
                  </Tag>
                ) : govData.summary.allCompliant ? (
                  <Tag icon={<CheckCircleOutlined />} color="success">
                    {govData.summary.compliantCount}/{govData.summary.totalCount} 项全部达标
                  </Tag>
                ) : (
                  <Tag icon={<CloseCircleOutlined />} color="error">
                    {govData.summary.compliantCount}/{govData.summary.totalCount} 项达标
                  </Tag>
                )}
              </span>
            )}
          </div>
        }
      >
        {govLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin />
          </div>
        ) : govData?.indicators && govData.indicators.length > 0 ? (
          <Row gutter={[16, 16]}>
            {govData.indicators.map((indicator) => (
              <Col xs={24} sm={12} md={8} lg={6} key={indicator.code}>
                {renderGovIndicatorCard(indicator)}
              </Col>
            ))}
            {/* 综合判定卡片 */}
            <Col xs={24} sm={12} md={8} lg={6}>
              <Card
                size="small"
                style={{
                  background: govData.summary.allCompliant === null
                    ? '#fffbe6'
                    : govData.summary.allCompliant
                    ? '#f6ffed'
                    : '#fff2f0',
                  borderColor: govData.summary.allCompliant === null
                    ? '#ffe58f'
                    : govData.summary.allCompliant
                    ? '#b7eb8f'
                    : '#ffccc7',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                }}
              >
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>综合判定</div>
                  <div style={{ fontSize: 32, fontWeight: 600, marginBottom: 8 }}>
                    {govData.summary.compliantCount}/{govData.summary.totalCount}
                  </div>
                  {govData.summary.pendingCount > 0 && (
                    <div style={{ fontSize: 12, color: '#faad14', marginBottom: 8 }}>
                      {govData.summary.pendingCount} 项待填报
                    </div>
                  )}
                  {govData.summary.allCompliant === null ? (
                    <Tag icon={<ExclamationCircleOutlined />} color="warning" style={{ fontSize: 14, padding: '4px 12px' }}>
                      待完善
                    </Tag>
                  ) : govData.summary.allCompliant ? (
                    <Tag icon={<CheckCircleOutlined />} color="success" style={{ fontSize: 14, padding: '4px 12px' }}>
                      全部达标
                    </Tag>
                  ) : (
                    <Tag icon={<CloseCircleOutlined />} color="error" style={{ fontSize: 14, padding: '4px 12px' }}>
                      未全部达标
                    </Tag>
                  )}
                </div>
              </Card>
            </Col>
          </Row>
        ) : (
          <Empty description="暂无政府保障程度数据" />
        )}
      </Card>

      {/* 教育质量指标 */}
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>教育质量（9项指标）</span>
            {eduQualityData?.summary && (
              <span style={{ fontSize: 14, fontWeight: 'normal' }}>
                {eduQualityData.summary.allCompliant === null ? (
                  <Tag icon={<ExclamationCircleOutlined />} color="warning">
                    {eduQualityData.summary.compliantCount}/{eduQualityData.summary.totalCount} 项达标，{eduQualityData.summary.pendingCount} 项待填报
                  </Tag>
                ) : eduQualityData.summary.allCompliant ? (
                  <Tag icon={<CheckCircleOutlined />} color="success">
                    {eduQualityData.summary.compliantCount}/{eduQualityData.summary.totalCount} 项全部达标
                  </Tag>
                ) : (
                  <Tag icon={<CloseCircleOutlined />} color="error">
                    {eduQualityData.summary.compliantCount}/{eduQualityData.summary.totalCount} 项达标
                  </Tag>
                )}
              </span>
            )}
          </div>
        }
        style={{ marginTop: 24 }}
      >
        {eduQualityLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin />
          </div>
        ) : eduQualityData?.indicators && eduQualityData.indicators.length > 0 ? (
          <Row gutter={[16, 16]}>
            {eduQualityData.indicators.map((indicator) => (
              <Col xs={24} sm={12} md={8} lg={6} key={indicator.code}>
                {renderEduQualityIndicatorCard(indicator)}
              </Col>
            ))}
            {/* 综合判定卡片 */}
            <Col xs={24} sm={12} md={8} lg={6}>
              <Card
                size="small"
                style={{
                  background: eduQualityData.summary.allCompliant === null
                    ? '#fffbe6'
                    : eduQualityData.summary.allCompliant
                    ? '#f6ffed'
                    : '#fff2f0',
                  borderColor: eduQualityData.summary.allCompliant === null
                    ? '#ffe58f'
                    : eduQualityData.summary.allCompliant
                    ? '#b7eb8f'
                    : '#ffccc7',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                }}
              >
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>综合判定</div>
                  <div style={{ fontSize: 32, fontWeight: 600, marginBottom: 8 }}>
                    {eduQualityData.summary.compliantCount}/{eduQualityData.summary.totalCount}
                  </div>
                  {eduQualityData.summary.pendingCount > 0 && (
                    <div style={{ fontSize: 12, color: '#faad14', marginBottom: 8 }}>
                      {eduQualityData.summary.pendingCount} 项待填报
                    </div>
                  )}
                  {eduQualityData.summary.allCompliant === null ? (
                    <Tag icon={<ExclamationCircleOutlined />} color="warning" style={{ fontSize: 14, padding: '4px 12px' }}>
                      待完善
                    </Tag>
                  ) : eduQualityData.summary.allCompliant ? (
                    <Tag icon={<CheckCircleOutlined />} color="success" style={{ fontSize: 14, padding: '4px 12px' }}>
                      全部达标
                    </Tag>
                  ) : (
                    <Tag icon={<CloseCircleOutlined />} color="error" style={{ fontSize: 14, padding: '4px 12px' }}>
                      未全部达标
                    </Tag>
                  )}
                </div>
              </Card>
            </Col>
          </Row>
        ) : (
          <Empty description="暂无教育质量数据" />
        )}
      </Card>

      {/* 社会认可度指标 */}
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>社会认可度（1项指标）</span>
            {socialRecogData?.summary && (
              <span style={{ fontSize: 14, fontWeight: 'normal' }}>
                {socialRecogData.summary.allCompliant === null ? (
                  <Tag icon={<ExclamationCircleOutlined />} color="warning">
                    {socialRecogData.summary.compliantCount}/{socialRecogData.summary.totalCount} 项达标，{socialRecogData.summary.pendingCount} 项待填报
                  </Tag>
                ) : socialRecogData.summary.allCompliant ? (
                  <Tag icon={<CheckCircleOutlined />} color="success">
                    {socialRecogData.summary.compliantCount}/{socialRecogData.summary.totalCount} 项全部达标
                  </Tag>
                ) : (
                  <Tag icon={<CloseCircleOutlined />} color="error">
                    {socialRecogData.summary.compliantCount}/{socialRecogData.summary.totalCount} 项达标
                  </Tag>
                )}
              </span>
            )}
          </div>
        }
        style={{ marginTop: 24 }}
      >
        {socialRecogLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin />
          </div>
        ) : socialRecogData?.indicators && socialRecogData.indicators.length > 0 ? (
          <Row gutter={[16, 16]}>
            {socialRecogData.indicators.map((indicator) => (
              <Col xs={24} sm={12} md={8} lg={6} key={indicator.code}>
                {renderSocialRecogIndicatorCard(indicator)}
              </Col>
            ))}
            {/* 综合判定卡片 */}
            <Col xs={24} sm={12} md={8} lg={6}>
              <Card
                size="small"
                style={{
                  background: socialRecogData.summary.allCompliant === null
                    ? '#fffbe6'
                    : socialRecogData.summary.allCompliant
                    ? '#f6ffed'
                    : '#fff2f0',
                  borderColor: socialRecogData.summary.allCompliant === null
                    ? '#ffe58f'
                    : socialRecogData.summary.allCompliant
                    ? '#b7eb8f'
                    : '#ffccc7',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                }}
              >
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>综合判定</div>
                  <div style={{ fontSize: 32, fontWeight: 600, marginBottom: 8 }}>
                    {socialRecogData.summary.compliantCount}/{socialRecogData.summary.totalCount}
                  </div>
                  {socialRecogData.summary.pendingCount > 0 && (
                    <div style={{ fontSize: 12, color: '#faad14', marginBottom: 8 }}>
                      {socialRecogData.summary.pendingCount} 项待填报
                    </div>
                  )}
                  {socialRecogData.summary.allCompliant === null ? (
                    <Tag icon={<ExclamationCircleOutlined />} color="warning" style={{ fontSize: 14, padding: '4px 12px' }}>
                      待完善
                    </Tag>
                  ) : socialRecogData.summary.allCompliant ? (
                    <Tag icon={<CheckCircleOutlined />} color="success" style={{ fontSize: 14, padding: '4px 12px' }}>
                      全部达标
                    </Tag>
                  ) : (
                    <Tag icon={<CloseCircleOutlined />} color="error" style={{ fontSize: 14, padding: '4px 12px' }}>
                      未全部达标
                    </Tag>
                  )}
                </div>
              </Card>
            </Col>
          </Row>
        ) : (
          <Empty description="暂无社会认可度数据" />
        )}
      </Card>
    </div>
  );
};

export default IndicatorSummary;
