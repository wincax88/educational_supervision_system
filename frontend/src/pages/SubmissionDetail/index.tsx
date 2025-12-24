/**
 * 填报记录详情查看页面
 * 根据 submissionId 自动跳转到正确的表单页面
 */

import React, { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { Spin, message } from 'antd';
import * as submissionService from '../../services/submissionService';
import * as projectService from '../../services/projectService';
import type { Submission } from '../../services/submissionService';
import type { Project } from '../../services/projectService';

const SubmissionDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      if (!id) {
        setError('缺少提交记录ID');
        setLoading(false);
        return;
      }

      try {
        // 加载 submission 信息
        const submissionData = await submissionService.getSubmission(id);
        setSubmission(submissionData);

        // 加载项目信息以获取 assessmentType
        if (submissionData.projectId) {
          try {
            const projectData = await projectService.getById(submissionData.projectId);
            setProject(projectData);
          } catch (err) {
            console.error('加载项目信息失败:', err);
            // 如果获取项目信息失败，使用默认值
          }
        }
      } catch (err: any) {
        console.error('加载提交记录失败:', err);
        setError(err?.message || '加载提交记录失败');
        message.error('加载提交记录失败');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (error || !submission) {
    return <Navigate to="/login" replace />;
  }

  // 根据项目类型确定路由前缀
  const assessmentType = project?.assessmentType || '优质均衡';
  const routePrefix = assessmentType === '普及普惠' ? 'kindergarten' : 'balanced';

  // 构建正确的路由路径
  const targetPath = `/home/${routePrefix}/entry/${submission.projectId}/form/${submission.formId}?submissionId=${submission.id}`;

  return <Navigate to={targetPath} replace />;
};

export default SubmissionDetail;

