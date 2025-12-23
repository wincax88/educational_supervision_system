/**
 * 学校指标入口组件
 *
 * 根据项目的评估类型（assessmentType）选择渲染对应的学校指标组件：
 * - 普及普惠：PreschoolSchoolIndicators（幼儿园）
 * - 优质均衡：BalancedSchoolIndicators（小学、初中等）
 */
import React from 'react';
import { Empty } from 'antd';
import PreschoolSchoolIndicators from './PreschoolSchoolIndicators';
import BalancedSchoolIndicators from './BalancedSchoolIndicators';

interface SchoolIndicatorsProps {
  districtId: string;
  projectId: string;
  assessmentType?: '普及普惠' | '优质均衡';
}

const SchoolIndicators: React.FC<SchoolIndicatorsProps> = ({
  districtId,
  projectId,
  assessmentType,
}) => {
  if (!projectId) {
    return <Empty description="请先选择项目" />;
  }

  // 根据评估类型选择对应的组件
  if (assessmentType === '普及普惠') {
    return (
      <PreschoolSchoolIndicators
        districtId={districtId}
        projectId={projectId}
      />
    );
  }

  // 默认显示优质均衡学校指标
  return (
    <BalancedSchoolIndicators
      districtId={districtId}
      projectId={projectId}
    />
  );
};

export default SchoolIndicators;
