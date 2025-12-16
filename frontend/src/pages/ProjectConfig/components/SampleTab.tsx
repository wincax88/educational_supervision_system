/**
 * 评估样本 Tab 组件
 */

import React from 'react';
import { Button, Tag, Checkbox, Select } from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  SettingOutlined,
  DownOutlined,
  RightOutlined,
  UserAddOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import type { DistrictSample, SampleDataConfig } from '../types';
import styles from '../index.module.css';

interface SampleTabProps {
  samples: DistrictSample[];
  sampleDataConfig: SampleDataConfig;
  expandedDistricts: string[];
  onToggleExpand: (districtId: string) => void;
  onConfigSample: () => void;
  onAddSample: () => void;
  onDeleteSample: (type: 'district' | 'school', id: string) => void;
  onDeleteTeacher: (schoolId: string, teacherId: string) => void;
  onAddTeacher: (schoolId: string) => void;
  onTeacherModeChange: (schoolId: string, mode: 'self' | 'assigned') => void;
  disabled?: boolean; // 是否禁用编辑（非配置中状态）
}

const SampleTab: React.FC<SampleTabProps> = ({
  samples,
  sampleDataConfig,
  expandedDistricts,
  onToggleExpand,
  onConfigSample,
  onAddSample,
  onDeleteSample,
  onDeleteTeacher,
  onAddTeacher,
  onTeacherModeChange,
  disabled = false,
}) => {
  return (
    <div className={styles.sampleTab}>
      {/* 样本配置标题行 */}
      <div className={styles.sampleHeader}>
        <h3 className={styles.sectionTitle}>评估样本配置</h3>
        <div className={styles.sampleActions}>
          <Button
            type="primary"
            icon={<SettingOutlined />}
            onClick={onConfigSample}
            disabled={disabled}
          >
            配置样本
          </Button>
          <Button
            icon={<PlusOutlined />}
            onClick={onAddSample}
            disabled={disabled}
          >
            添加样本
          </Button>
        </div>
      </div>

      {/* 当前数据对象配置 */}
      <div className={styles.dataConfigInfo}>
        <FileTextOutlined className={styles.configIcon} />
        <span className={styles.configLabel}>当前数据对象配置：</span>
        <div className={styles.configTags}>
          {sampleDataConfig.district && (
            <Tag color="blue" className={styles.levelTag}>
              <Checkbox checked disabled /> 区
            </Tag>
          )}
          {sampleDataConfig.school && (
            <Tag className={styles.levelTag}>
              <span className={styles.levelLine}>└─</span>
              <Checkbox checked disabled /> 校
            </Tag>
          )}
          {sampleDataConfig.teacher && (
            <Tag className={styles.levelTag}>
              <span className={styles.levelLine}>└─└─</span>
              <Checkbox checked disabled /> 教师
            </Tag>
          )}
        </div>
      </div>

      {/* 样本列表 */}
      <div className={styles.sampleList}>
        {samples.map(district => (
          <div key={district.id} className={styles.districtItem}>
            {/* 区县行 */}
            <div className={styles.districtRow}>
              <div className={styles.districtLeft}>
                <span
                  className={styles.expandIcon}
                  onClick={() => onToggleExpand(district.id)}
                >
                  {expandedDistricts.includes(district.id) ? <DownOutlined /> : <RightOutlined />}
                </span>
                <span className={styles.districtIcon}>🏛️</span>
                <span className={styles.districtName}>{district.name}</span>
                <Tag color="blue">区</Tag>
                <span className={styles.schoolCount}>({district.schools.length} 所学校)</span>
              </div>
              {!disabled && (
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => onDeleteSample('district', district.id)}
                >
                  删除
                </Button>
              )}
            </div>

            {/* 学校列表 */}
            {expandedDistricts.includes(district.id) && (
              <div className={styles.schoolList}>
                {district.schools.map(school => (
                  <div key={school.id} className={styles.schoolItem}>
                    {/* 学校行 */}
                    <div className={styles.schoolRow}>
                      <div className={styles.schoolLeft}>
                        <span className={styles.schoolIcon}>🏫</span>
                        <span className={styles.schoolName}>{school.name}</span>
                        <Tag color="green">校</Tag>
                      </div>
                      {!disabled && (
                        <Button
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => onDeleteSample('school', school.id)}
                        >
                          删除
                        </Button>
                      )}
                    </div>

                    {/* 教师样本区域 */}
                    <div className={styles.teacherSection}>
                      <div className={styles.teacherHeader}>
                        <span className={styles.teacherIcon}>👨‍🏫</span>
                        <span className={styles.teacherLabel}>教师样本</span>
                        <Select
                          value={school.teacherSampleMode}
                          onChange={(v) => onTeacherModeChange(school.id, v)}
                          size="small"
                          className={styles.teacherModeSelect}
                          disabled={disabled}
                        >
                          <Select.Option value="self">学校自行确定</Select.Option>
                          <Select.Option value="assigned">指定具体人员</Select.Option>
                        </Select>
                        {school.teacherSampleMode === 'assigned' && !disabled && (
                          <Button
                            type="link"
                            size="small"
                            icon={<UserAddOutlined />}
                            onClick={() => onAddTeacher(school.id)}
                          >
                            添加
                          </Button>
                        )}
                      </div>
                      {school.teacherSampleMode === 'assigned' && school.teachers.length > 0 && (
                        <div className={styles.teacherList}>
                          {school.teachers.map(teacher => (
                            <Tag
                              key={teacher.id}
                              closable={!disabled}
                              onClose={() => onDeleteTeacher(school.id, teacher.id)}
                              className={styles.teacherTag}
                            >
                              {teacher.name} ({teacher.phone})
                            </Tag>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SampleTab;
