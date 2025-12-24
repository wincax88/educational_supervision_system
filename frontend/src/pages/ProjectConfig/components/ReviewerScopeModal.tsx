/**
 * 专家审核范围配置弹窗
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  Form,
  Radio,
  TreeSelect,
  Select,
  Space,
  Tag,
  message,
  Spin,
  Alert,
} from 'antd';
import {
  UserOutlined,
  SettingOutlined,
  ApartmentOutlined,
  BankOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import type { ScopeType, ReviewerScope } from '../../../services/reviewAssignmentService';
import * as reviewAssignmentService from '../../../services/reviewAssignmentService';
import * as sampleService from '../../../services/sampleService';
import * as projectToolService from '../../../services/projectToolService';
import type { Personnel } from '../types';
import type { Sample } from '../../../services/sampleService';
import type { ProjectTool } from '../../../services/projectToolService';
import styles from '../index.module.css';

interface ReviewerScopeModalProps {
  visible: boolean;
  projectId: string;
  reviewer: Personnel | null;
  onClose: () => void;
  onSuccess: () => void;
}

const ReviewerScopeModal: React.FC<ReviewerScopeModalProps> = ({
  visible,
  projectId,
  reviewer,
  onClose,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scopeType, setScopeType] = useState<ScopeType>('all');
  const [samples, setSamples] = useState<Sample[]>([]);
  const [tools, setTools] = useState<ProjectTool[]>([]);

  // 获取区县列表
  const districts = samples.filter(s => s.type === 'district');

  // 构建区县-学校树形结构
  const buildSchoolTree = useCallback(() => {
    const tree: any[] = [];
    districts.forEach(district => {
      const schools = samples.filter(s => s.type === 'school' && s.parentId === district.id);
      tree.push({
        value: district.id,
        title: district.name,
        icon: <ApartmentOutlined />,
        selectable: false,
        children: schools.map(school => ({
          value: school.id,
          title: school.name,
          icon: <BankOutlined />,
        })),
      });
    });
    // 添加没有区县的学校
    const orphanSchools = samples.filter(s => s.type === 'school' && !s.parentId);
    if (orphanSchools.length > 0) {
      tree.push({
        value: 'no-district',
        title: '未分配区县',
        selectable: false,
        children: orphanSchools.map(school => ({
          value: school.id,
          title: school.name,
          icon: <BankOutlined />,
        })),
      });
    }
    return tree;
  }, [districts, samples]);

  // 加载数据
  const loadData = useCallback(async () => {
    if (!visible || !reviewer) return;

    setLoading(true);
    try {
      const [sampleData, toolData, scopeData] = await Promise.all([
        sampleService.getSampleList(projectId).catch(() => []),
        projectToolService.getProjectTools(projectId).catch(() => []),
        reviewAssignmentService.getReviewerScopes(projectId, reviewer.id).catch(() => []),
      ]);

      setSamples(sampleData);
      setTools(toolData);

      // 设置表单初始值
      if (scopeData.length > 0) {
        const firstScope = scopeData[0];
        setScopeType(firstScope.scopeType);

        if (firstScope.scopeType === 'all') {
          form.setFieldsValue({ scopeType: 'all' });
        } else {
          const scopeIds = scopeData.map(s => s.scopeId).filter(Boolean);
          form.setFieldsValue({
            scopeType: firstScope.scopeType,
            scopeIds,
          });
        }
      } else {
        setScopeType('all');
        form.setFieldsValue({ scopeType: 'all', scopeIds: [] });
      }
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, [visible, reviewer, projectId, form]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 保存配置
  const handleSave = async (values: { scopeType: ScopeType; scopeIds?: string[] }) => {
    if (!reviewer) return;

    setSaving(true);
    try {
      let scopes: Array<{ scopeType: ScopeType; scopeId?: string }> = [];

      if (values.scopeType === 'all') {
        scopes = [{ scopeType: 'all' }];
      } else if (values.scopeIds && values.scopeIds.length > 0) {
        scopes = values.scopeIds.map(id => ({
          scopeType: values.scopeType,
          scopeId: id,
        }));
      }

      await reviewAssignmentService.setReviewerScopes(projectId, reviewer.id, scopes);
      message.success('审核范围配置成功');
      onSuccess();
    } catch (error) {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 关闭弹窗
  const handleClose = () => {
    form.resetFields();
    setScopeType('all');
    onClose();
  };

  // 范围类型变化
  const handleScopeTypeChange = (type: ScopeType) => {
    setScopeType(type);
    form.setFieldsValue({ scopeIds: [] });
  };

  if (!reviewer) return null;

  return (
    <Modal
      title={
        <Space>
          <SettingOutlined style={{ color: '#1890ff' }} />
          配置审核范围
        </Space>
      }
      open={visible}
      onCancel={handleClose}
      onOk={() => form.submit()}
      okText="保存配置"
      cancelText="取消"
      confirmLoading={saving}
      width={560}
    >
      <Spin spinning={loading}>
        <Alert
          message={
            <Space>
              <UserOutlined />
              <span>当前专家：</span>
              <strong>{reviewer.name}</strong>
              <span style={{ color: '#666' }}>({reviewer.organization})</span>
            </Space>
          }
          type="info"
          style={{ marginBottom: 16 }}
        />

        <Form form={form} onFinish={handleSave} layout="vertical">
          <Form.Item
            name="scopeType"
            label="审核范围类型"
            rules={[{ required: true, message: '请选择审核范围类型' }]}
          >
            <Radio.Group onChange={e => handleScopeTypeChange(e.target.value)}>
              <Radio.Button value="all">全部</Radio.Button>
              <Radio.Button value="district">指定区县</Radio.Button>
              <Radio.Button value="school">指定学校</Radio.Button>
              <Radio.Button value="tool">指定工具</Radio.Button>
            </Radio.Group>
          </Form.Item>

          {/* 区县选择 */}
          {scopeType === 'district' && (
            <Form.Item
              name="scopeIds"
              label="选择区县"
              rules={[{ required: true, message: '请选择区县' }]}
            >
              <Select
                mode="multiple"
                placeholder="请选择区县（可多选）"
                optionFilterProp="children"
                maxTagCount={3}
              >
                {districts.map(d => (
                  <Select.Option key={d.id} value={d.id}>
                    <Space>
                      <ApartmentOutlined style={{ color: '#1890ff' }} />
                      {d.name}
                    </Space>
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          )}

          {/* 学校选择 */}
          {scopeType === 'school' && (
            <Form.Item
              name="scopeIds"
              label="选择学校"
              rules={[{ required: true, message: '请选择学校' }]}
            >
              <TreeSelect
                multiple
                treeData={buildSchoolTree()}
                placeholder="请选择学校（可多选）"
                treeIcon
                showSearch
                treeNodeFilterProp="title"
                maxTagCount={3}
                style={{ width: '100%' }}
              />
            </Form.Item>
          )}

          {/* 工具选择 */}
          {scopeType === 'tool' && (
            <Form.Item
              name="scopeIds"
              label="选择采集工具"
              rules={[{ required: true, message: '请选择采集工具' }]}
            >
              <Select
                mode="multiple"
                placeholder="请选择采集工具（可多选）"
                optionFilterProp="children"
                maxTagCount={3}
              >
                {tools.map(t => (
                  <Select.Option key={t.toolId} value={t.toolId}>
                    <Space>
                      <FileTextOutlined style={{ color: '#1890ff' }} />
                      {t.toolName}
                      {t.toolType && <Tag>{t.toolType}</Tag>}
                    </Space>
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          )}

          {/* 全部范围说明 */}
          {scopeType === 'all' && (
            <Alert
              message="选择「全部」表示该专家可以审核项目中所有的填报记录"
              type="warning"
              showIcon
            />
          )}
        </Form>
      </Spin>
    </Modal>
  );
};

export default ReviewerScopeModal;
