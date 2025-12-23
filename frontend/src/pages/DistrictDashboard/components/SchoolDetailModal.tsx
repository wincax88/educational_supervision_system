/**
 * 学校详情弹窗组件
 *
 * 显示各学校7项资源配置指标的详细数据表格
 */
import React, { useState } from 'react';
import { Modal, Table, Tabs, Tag, Tooltip, Empty } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import type {
  ResourceIndicatorsSummary,
  SchoolResourceIndicators,
} from '../../../services/statisticsService';

interface SchoolDetailModalProps {
  visible: boolean;
  onClose: () => void;
  primaryData: ResourceIndicatorsSummary | null;
  juniorData: ResourceIndicatorsSummary | null;
  defaultTab?: 'primary' | 'junior';
}

const SchoolDetailModal: React.FC<SchoolDetailModalProps> = ({
  visible,
  onClose,
  primaryData,
  juniorData,
  defaultTab = 'primary',
}) => {
  const [activeTab, setActiveTab] = useState<string>(defaultTab);

  // 渲染指标值单元格
  const renderIndicatorCell = (
    indicator: { value: number | null; threshold: number; isCompliant: boolean | null } | undefined,
    unit: string
  ) => {
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

  // 渲染差异系数单元格
  const renderCVCell = (cvIndicator: { cv: number | null; isCompliant: boolean | null } | undefined, threshold: number) => {
    if (!cvIndicator || cvIndicator.cv === null) {
      return <span style={{ color: '#999' }}>-</span>;
    }
    const color = cvIndicator.isCompliant ? '#52c41a' : '#ff4d4f';
    const icon = cvIndicator.isCompliant ? <CheckCircleOutlined /> : <CloseCircleOutlined />;
    return (
      <Tooltip title={`标准: ≤${threshold}`}>
        <span style={{ color, fontWeight: 600 }}>
          {cvIndicator.cv.toFixed(4)} {icon}
        </span>
      </Tooltip>
    );
  };

  const renderTable = (data: ResourceIndicatorsSummary | null, schoolType: '小学' | '初中') => {
    if (!data?.schools || data.schools.length === 0) {
      return <Empty description={`暂无${schoolType}数据`} />;
    }

    // 获取差异系数数据
    const cvIndicators = data.summary?.cvIndicators || [];
    const getCVByCode = (code: string) => cvIndicators.find(cv => cv.code === code);
    const cvThreshold = schoolType === '小学' ? 0.50 : 0.45;

    return (
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
        summary={() => (
          <Table.Summary fixed>
            <Table.Summary.Row style={{ background: '#fafafa', fontWeight: 600 }}>
              <Table.Summary.Cell index={0} colSpan={1}>
                <Tooltip title={`差异系数标准：${schoolType}≤${cvThreshold}`}>
                  <span style={{ color: '#1890ff' }}>差异系数 (CV)</span>
                </Tooltip>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={1} align="right">
                <span style={{ color: '#999' }}>-</span>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={2} align="center">
                {renderCVCell(getCVByCode('L1'), cvThreshold)}
              </Table.Summary.Cell>
              <Table.Summary.Cell index={3} align="center">
                {renderCVCell(getCVByCode('L2'), cvThreshold)}
              </Table.Summary.Cell>
              <Table.Summary.Cell index={4} align="center">
                {renderCVCell(getCVByCode('L3'), cvThreshold)}
              </Table.Summary.Cell>
              <Table.Summary.Cell index={5} align="center">
                {renderCVCell(getCVByCode('L4'), cvThreshold)}
              </Table.Summary.Cell>
              <Table.Summary.Cell index={6} align="center">
                {renderCVCell(getCVByCode('L5'), cvThreshold)}
              </Table.Summary.Cell>
              <Table.Summary.Cell index={7} align="center">
                {renderCVCell(getCVByCode('L6'), cvThreshold)}
              </Table.Summary.Cell>
              <Table.Summary.Cell index={8} align="center">
                {renderCVCell(getCVByCode('L7'), cvThreshold)}
              </Table.Summary.Cell>
              <Table.Summary.Cell index={9} align="center">
                {data.summary?.allCvCompliant !== null && data.summary?.allCvCompliant !== undefined ? (
                  data.summary.allCvCompliant ? (
                    <Tag icon={<CheckCircleOutlined />} color="success">全部达标</Tag>
                  ) : (
                    <Tag icon={<CloseCircleOutlined />} color="error">
                      {data.summary.compliantCvCount}/{data.summary.totalCvCount}
                    </Tag>
                  )
                ) : (
                  <span style={{ color: '#999' }}>-</span>
                )}
              </Table.Summary.Cell>
            </Table.Summary.Row>
          </Table.Summary>
        )}
      />
    );
  };

  return (
    <Modal
      title="各学校7项资源配置指标详情"
      open={visible}
      onCancel={onClose}
      footer={null}
      width={1200}
      styles={{ body: { maxHeight: '70vh', overflow: 'auto' } }}
    >
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'primary',
            label: (
              <span>
                小学
                {primaryData?.summary?.overallCompliance && (
                  <Tag
                    color={primaryData.summary.overallCompliance.allSchoolsCompliant ? 'success' : 'error'}
                    style={{ marginLeft: 8 }}
                  >
                    {primaryData.summary.overallCompliance.compliantSchools}/{primaryData.summary.schoolCount}
                  </Tag>
                )}
              </span>
            ),
            children: renderTable(primaryData, '小学'),
          },
          {
            key: 'junior',
            label: (
              <span>
                初中
                {juniorData?.summary?.overallCompliance && (
                  <Tag
                    color={juniorData.summary.overallCompliance.allSchoolsCompliant ? 'success' : 'error'}
                    style={{ marginLeft: 8 }}
                  >
                    {juniorData.summary.overallCompliance.compliantSchools}/{juniorData.summary.schoolCount}
                  </Tag>
                )}
              </span>
            ),
            children: renderTable(juniorData, '初中'),
          },
        ]}
      />
    </Modal>
  );
};

export default SchoolDetailModal;
