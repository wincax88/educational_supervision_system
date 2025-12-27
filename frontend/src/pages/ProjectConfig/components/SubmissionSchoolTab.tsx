/**
 * 评估对象配置 Tab 组件
 * 显示已选择的评估对象列表
 */

import React, { useMemo } from 'react';
import {
  Button,
  Tag,
  Card,
  Row,
  Col,
  Statistic,
  Empty,
  Spin,
  Space,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  UploadOutlined,
  BankOutlined,
  HomeOutlined,
} from '@ant-design/icons';
import type { SubmissionDistrict } from '../hooks/useSubmissionSchools';
import styles from '../index.module.css';

// 学校类型对应的标签颜色
const SCHOOL_TYPE_COLORS: Record<string, string> = {
  '幼儿园': 'magenta',
  '小学': 'blue',
  '初中': 'green',
  '九年一贯制': 'purple',
  '完全中学': 'orange',
};

interface SubmissionSchoolTabProps {
  // 已选数据
  districts: SubmissionDistrict[];
  statistics: {
    totalDistricts: number;
    totalSchools: number;
    schoolsByType: Record<string, number>;
  };
  // 回调函数
  onSelectSchool: () => void;
  onDeleteSchool: (schoolId: string) => void;
  onImport: () => void;
  onCreateSchool: () => void;
  disabled?: boolean;
  loading?: boolean;
}

const SubmissionSchoolTab: React.FC<SubmissionSchoolTabProps> = ({
  districts,
  statistics,
  onSelectSchool,
  onDeleteSchool,
  onImport,
  onCreateSchool,
  disabled = false,
  loading = false,
}) => {
  // 渲染学校类型分布
  const renderSchoolTypeStats = useMemo(() => {
    const types = ['幼儿园', '小学', '初中', '九年一贯制', '完全中学'];
    return types.map(type => {
      const count = statistics.schoolsByType[type] || 0;
      if (count === 0) return null;
      return (
        <Tag key={type} color={SCHOOL_TYPE_COLORS[type]}>
          {type}: {count}
        </Tag>
      );
    }).filter(Boolean);
  }, [statistics.schoolsByType]);

  // 渲染空状态
  const renderEmpty = () => (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description="暂未添加评估对象"
    >
      {!disabled && (
        <Button type="primary" icon={<PlusOutlined />} onClick={onSelectSchool}>
          选择学校
        </Button>
      )}
    </Empty>
  );

  return (
    <Spin spinning={loading}>
      <div className={styles.submissionSchoolTab}>
        {/* 统计信息和操作按钮 */}
        <Card size="small" className={styles.statsCard} style={{ marginBottom: 16 }}>
          <Row gutter={24} align="middle">
            <Col span={4}>
              <Statistic
                title="区县数量"
                value={statistics.totalDistricts}
                suffix="个"
                prefix={<BankOutlined />}
              />
            </Col>
            <Col span={4}>
              <Statistic
                title="学校数量"
                value={statistics.totalSchools}
                suffix="所"
                prefix={<HomeOutlined />}
              />
            </Col>
            <Col span={8}>
              <div style={{ paddingTop: 8 }}>
                <div style={{ marginBottom: 8, color: '#666', fontSize: 12 }}>学校类型分布</div>
                <div>
                  {renderSchoolTypeStats.length > 0
                    ? renderSchoolTypeStats
                    : <span style={{ color: '#999' }}>暂无数据</span>}
                </div>
              </div>
            </Col>
            <Col span={8}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                {!disabled && (
                  <Space>
                    <Button type="primary" icon={<PlusOutlined />} onClick={onSelectSchool}>
                      选择学校
                    </Button>
                    <Button icon={<PlusOutlined />} onClick={onCreateSchool}>
                      新增学校
                    </Button>
                    <Button icon={<UploadOutlined />} onClick={onImport}>
                      批量导入
                    </Button>
                  </Space>
                )}
              </div>
            </Col>
          </Row>
        </Card>

        {/* 已选学校列表 */}
        <Card title="已添加的评估对象" size="small">
          <div style={{ maxHeight: 500, overflow: 'auto' }}>
            {districts.length === 0 ? (
              renderEmpty()
            ) : (
              <div className={styles.selectedSchoolList}>
                {districts.map(district => (
                  <div key={district.id} className={styles.selectedDistrictGroup}>
                    <div className={styles.selectedDistrictHeader}>
                      <BankOutlined style={{ color: '#1890ff', marginRight: 8 }} />
                      <span style={{ fontWeight: 500 }}>{district.name}</span>
                      <span style={{ color: '#999', marginLeft: 8 }}>
                        ({district.schools.length} 所)
                      </span>
                    </div>
                    <div className={styles.selectedSchoolItems}>
                      {district.schools.map(school => (
                        <div key={school.id} className={styles.selectedSchoolItem}>
                          <div className={styles.schoolInfo}>
                            <HomeOutlined style={{ color: '#52c41a', marginRight: 8 }} />
                            <span>{school.name}</span>
                            {school.code && (
                              <span style={{ color: '#999', fontSize: 12, marginLeft: 8 }}>
                                ({school.code})
                              </span>
                            )}
                            <Tag
                              color={SCHOOL_TYPE_COLORS[school.schoolType] || 'default'}
                              style={{ marginLeft: 8 }}
                            >
                              {school.schoolType}
                            </Tag>
                          </div>
                          {!disabled && (
                            <Button
                              type="text"
                              danger
                              size="small"
                              icon={<DeleteOutlined />}
                              onClick={() => onDeleteSchool(school.id)}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </Spin>
  );
};

export default SubmissionSchoolTab;
