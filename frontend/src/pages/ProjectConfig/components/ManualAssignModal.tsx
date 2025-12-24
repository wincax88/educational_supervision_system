/**
 * 手动分配审核任务弹窗
 */

import React, { useState } from 'react';
import {
  Modal,
  Form,
  Select,
  Space,
  Tag,
  message,
  Alert,
} from 'antd';
import {
  UserOutlined,
  TeamOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import type { PendingSubmission } from '../../../services/reviewAssignmentService';
import * as reviewAssignmentService from '../../../services/reviewAssignmentService';
import type { Personnel } from '../types';
import styles from '../index.module.css';

interface ManualAssignModalProps {
  visible: boolean;
  projectId: string;
  selectedSubmissions: PendingSubmission[];
  experts: Personnel[];
  onClose: () => void;
  onSuccess: () => void;
}

const ManualAssignModal: React.FC<ManualAssignModalProps> = ({
  visible,
  projectId,
  selectedSubmissions,
  experts,
  onClose,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  // 处理分配
  const handleAssign = async (values: { reviewerId: string }) => {
    if (!values.reviewerId) {
      message.warning('请选择审核专家');
      return;
    }

    if (selectedSubmissions.length === 0) {
      message.warning('请选择要分配的填报记录');
      return;
    }

    setLoading(true);
    try {
      const submissionIds = selectedSubmissions.map(s => s.submissionId);
      const result = await reviewAssignmentService.assignReviews(projectId, {
        submissionIds,
        reviewerId: values.reviewerId,
      });
      message.success(`成功分配 ${result.assigned} 条审核任务`);
      form.resetFields();
      onSuccess();
    } catch (error) {
      message.error('分配失败');
    } finally {
      setLoading(false);
    }
  };

  // 关闭弹窗
  const handleClose = () => {
    form.resetFields();
    onClose();
  };

  // 获取选中的专家信息
  const selectedReviewerId = Form.useWatch('reviewerId', form);
  const selectedExpert = experts.find(e => e.id === selectedReviewerId);

  return (
    <Modal
      title={
        <Space>
          <TeamOutlined style={{ color: '#1890ff' }} />
          分配审核任务
        </Space>
      }
      open={visible}
      onCancel={handleClose}
      onOk={() => form.submit()}
      okText="确认分配"
      cancelText="取消"
      confirmLoading={loading}
      width={560}
    >
      <Alert
        message={`已选择 ${selectedSubmissions.length} 条待审核的填报记录`}
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      {/* 已选择的填报记录列表 */}
      <div className={styles.selectedSubmissionList}>
        {selectedSubmissions.slice(0, 5).map(s => (
          <div key={s.submissionId} className={styles.selectedSubmissionItem}>
            <Space>
              <FileTextOutlined style={{ color: '#1890ff' }} />
              <span>{s.toolName}</span>
              <Tag>{s.submitterName || '未知'}</Tag>
              <span style={{ color: '#999' }}>({s.submitterOrg || '-'})</span>
            </Space>
          </div>
        ))}
        {selectedSubmissions.length > 5 && (
          <div className={styles.selectedSubmissionMore}>
            ... 等共 {selectedSubmissions.length} 条记录
          </div>
        )}
      </div>

      <Form form={form} onFinish={handleAssign} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item
          name="reviewerId"
          label="选择审核专家"
          rules={[{ required: true, message: '请选择审核专家' }]}
        >
          <Select
            placeholder="请选择要分配的审核专家"
            showSearch
            optionFilterProp="children"
          >
            {experts.map(expert => (
              <Select.Option key={expert.id} value={expert.id}>
                <Space>
                  <UserOutlined />
                  {expert.name}
                  <span style={{ color: '#999' }}>({expert.organization})</span>
                </Space>
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        {selectedExpert && (
          <Alert
            message={
              <Space>
                <span>将分配给：</span>
                <strong>{selectedExpert.name}</strong>
                <span style={{ color: '#666' }}>({selectedExpert.organization})</span>
              </Space>
            }
            type="success"
            showIcon
            icon={<UserOutlined />}
          />
        )}
      </Form>
    </Modal>
  );
};

export default ManualAssignModal;
