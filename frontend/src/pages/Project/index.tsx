import React, { useState, useEffect, useCallback } from 'react';
import { Button, Input, Select, Modal, Form, DatePicker, message, Spin, Tag, Popconfirm } from 'antd';
import {
  ArrowLeftOutlined,
  PlusOutlined,
  DatabaseOutlined,
  AppstoreOutlined,
  ToolOutlined,
  FormOutlined,
  SettingOutlined,
  DeleteOutlined,
  BarChartOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import * as projectService from '../../services/projectService';
import * as indicatorService from '../../services/indicatorService';
import type { Project } from '../../services/projectService';
import type { IndicatorSystem } from '../../services/indicatorService';
import { useUserPermissions } from '../../stores/authStore';
import styles from './index.module.css';

const { Search } = Input;

const ProjectPage: React.FC = () => {
  const navigate = useNavigate();
  const permissions = useUserPermissions();
  const [loading, setLoading] = useState(true);
  const [projectList, setProjectList] = useState<Project[]>([]);
  const [filteredList, setFilteredList] = useState<Project[]>([]);
  const [indicatorSystems, setIndicatorSystems] = useState<IndicatorSystem[]>([]);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [form] = Form.useForm();

  // 加载项目列表
  const loadProjects = useCallback(async () => {
    try {
      const data = await projectService.getProjects();
      setProjectList(data);
      setFilteredList(data);
    } catch (error) {
      console.error('加载项目列表失败:', error);
      message.error('加载项目列表失败');
    }
  }, []);

  // 加载指标体系列表
  const loadIndicatorSystems = useCallback(async () => {
    try {
      const data = await indicatorService.getIndicatorSystems();
      setIndicatorSystems(data.filter(s => s.status === 'published'));
    } catch (error) {
      console.error('加载指标体系失败:', error);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadProjects(), loadIndicatorSystems()]).finally(() => {
      setLoading(false);
    });
  }, [loadProjects, loadIndicatorSystems]);

  // 计算统计数据
  const projectStats = {
    configuring: projectList.filter(p => p.status === '配置中').length,
    filling: projectList.filter(p => p.status === '填报中').length,
    reviewing: projectList.filter(p => p.status === '评审中').length,
    stopped: projectList.filter(p => p.status === '已中止').length,
    completed: projectList.filter(p => p.status === '已完成').length,
  };

  const handleSearch = (value: string) => {
    if (value) {
      setFilteredList(projectList.filter(proj =>
        proj.name.includes(value) || (proj.description && proj.description.includes(value))
      ));
    } else {
      setFilteredList(projectList);
    }
  };

  const handleYearChange = (year: string) => {
    setSelectedYear(year);
  };

  const handleCreate = async (values: any) => {
    setSaving(true);
    try {
      const indicatorSystemIds: string[] = Array.isArray(values.indicatorSystemIds)
        ? values.indicatorSystemIds
        : (values.indicatorSystemIds ? [values.indicatorSystemIds] : []);
      const indicatorSystemId: string | undefined = indicatorSystemIds[0];

      const data = {
        name: values.name,
        keywords: values.keywords ? values.keywords.split(/[,，;；|\s]+/).filter(Boolean) : [],
        description: values.description || '',
        // 向后兼容：后端目前仍以 indicatorSystemId（单选）为主
        indicatorSystemId,
        // 预留：未来支持项目绑定多个指标体系时可直接启用
        indicatorSystemIds,
        startDate: values.startDate?.format('YYYY-MM-DD'),
        endDate: values.endDate?.format('YYYY-MM-DD'),
      };
      await projectService.createProject(data);
      message.success('创建成功');
      setCreateModalVisible(false);
      form.resetFields();
      await loadProjects();
    } catch (error: any) {
      message.error(error.message || '创建失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (project: Project) => {
    try {
      await projectService.deleteProject(project.id);
      message.success('删除成功');
      await loadProjects();
    } catch (error: any) {
      message.error(error.message || '删除失败');
    }
  };

  const getStatusTag = (status: string) => {
    const statusMap: Record<string, { color: string; text: string }> = {
      '配置中': { color: 'default', text: '配置中' },
      '填报中': { color: 'processing', text: '填报中' },
      '评审中': { color: 'warning', text: '评审中' },
      '已中止': { color: 'error', text: '已中止' },
      '已完成': { color: 'success', text: '已完成' },
    };
    const config = statusMap[status] || { color: 'default', text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  // 生成年份选项
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

  if (loading) {
    return (
      <div className={styles.projectPage}>
        <div className={styles.loadingContainer}>
          <Spin size="large" tip="加载中..." />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.projectPage}>
      <div className={styles.pageHeader}>
        <span className={styles.backBtn} onClick={() => navigate('/home')}>
          <ArrowLeftOutlined /> 返回
        </span>
        <h1 className={styles.pageTitle}>评估项目主页</h1>
        <div className={styles.headerActions}>
          <Button onClick={() => navigate('/home/balanced/indicators')}>
            <DatabaseOutlined /> 评估指标体系库
          </Button>
          <Button onClick={() => navigate('/home/balanced/elements')}>
            <AppstoreOutlined /> 评估要素库
          </Button>
          <Button onClick={() => navigate('/home/balanced/tools')}>
            <ToolOutlined /> 采集工具库
          </Button>
          <Button type="primary" onClick={() => navigate('/home/balanced/entry')}>
            <FormOutlined /> 数据填报
          </Button>
        </div>
      </div>

      <div className={styles.statsSection}>
        <h3>本年度项目情况</h3>
        <div className={styles.statsCards}>
          <div className={styles.statCard}>
            <div className={styles.statInfo}>
              <div className={styles.statLabel}>配置中</div>
              <div className={styles.statValue} style={{ color: '#1890ff' }}>{projectStats.configuring}</div>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statInfo}>
              <div className={styles.statLabel}>填报中</div>
              <div className={styles.statValue} style={{ color: '#52c41a' }}>{projectStats.filling}</div>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statInfo}>
              <div className={styles.statLabel}>评审中</div>
              <div className={styles.statValue} style={{ color: '#fa8c16' }}>{projectStats.reviewing}</div>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statInfo}>
              <div className={styles.statLabel}>已中止</div>
              <div className={styles.statValue}>{projectStats.stopped}</div>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statInfo}>
              <div className={styles.statLabel}>已完成</div>
              <div className={styles.statValue} style={{ color: '#722ed1' }}>{projectStats.completed}</div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.listHeader}>
        <h3>项目列表</h3>
        <div className={styles.listActions}>
          <Select value={selectedYear} style={{ width: 100 }} onChange={handleYearChange}>
            {yearOptions.map(year => (
              <Select.Option key={year} value={String(year)}>{year}</Select.Option>
            ))}
          </Select>
          <Search
            placeholder="搜索项目"
            onSearch={handleSearch}
            style={{ width: 200 }}
            allowClear
          />
          {permissions.canConfigProject && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
              创建项目
            </Button>
          )}
        </div>
      </div>

      <div className={styles.projectList}>
        {filteredList.length === 0 ? (
          <div className={styles.emptyState}>
            <p>暂无项目数据</p>
          </div>
        ) : (
          filteredList.map(project => (
            <div key={project.id} className={styles.projectCard}>
              <div className={styles.projectInfo}>
                <div className={styles.projectHeader}>
                  <h4>{project.name}</h4>
                  {getStatusTag(project.status)}
                </div>
                <p>{project.description || '暂无描述'}</p>
                <div className={styles.projectMeta}>
                  <span>时间: {project.startDate || '-'} ~ {project.endDate || '-'}</span>
                </div>
              </div>
              <div className={styles.projectActions}>
                {permissions.canConfigProject && (
                  <Button
                    type="primary"
                    icon={<SettingOutlined />}
                    onClick={() => navigate(`/home/balanced/project/${project.id}/config`)}
                  >
                    配置
                  </Button>
                )}
                {['填报中', '评审中', '已完成'].includes(project.status) && (
                  <>
                    <Button
                      icon={<BarChartOutlined />}
                      onClick={() => navigate(`/home/balanced/project/${project.id}/cv-analysis`)}
                    >
                      差异系数
                    </Button>
                    <Button
                      icon={<CheckCircleOutlined />}
                      onClick={() => navigate(`/home/balanced/project/${project.id}/compliance`)}
                    >
                      达标率
                    </Button>
                  </>
                )}
                {project.status === '配置中' && permissions.canConfigProject && (
                  <Popconfirm
                    title="确认删除"
                    description={`确定要删除项目 "${project.name}" 吗？`}
                    onConfirm={() => handleDelete(project)}
                    okText="删除"
                    cancelText="取消"
                  >
                    <Button danger icon={<DeleteOutlined />}>
                      删除
                    </Button>
                  </Popconfirm>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <Modal
        title="项目信息编辑"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        footer={null}
        width={560}
      >
        <p style={{ color: '#666', marginBottom: 24 }}>填写项目基本信息</p>
        <Form form={form} onFinish={handleCreate} layout="vertical">
          <Form.Item
            label="项目名称"
            name="name"
            rules={[{ required: true, message: '请输入项目名称' }]}
          >
            <Input placeholder="请输入项目名称" />
          </Form.Item>
          <Form.Item label="关键字" name="keywords">
            <Input placeholder="用逗号、分号、|或空格分割" />
          </Form.Item>
          <Form.Item label="项目描述" name="description">
            <Input.TextArea placeholder="请输入项目描述" rows={3} />
          </Form.Item>
          <Form.Item
            label="指标体系"
            name="indicatorSystemIds"
            rules={[
              {
                validator: async (_, v) => {
                  if (Array.isArray(v) && v.length > 0) return;
                  throw new Error('请选择评估指标体系');
                }
              }
            ]}
          >
            <Select
              mode="multiple"
              allowClear
              showSearch
              placeholder="选择评估指标体系（可多选）"
              optionFilterProp="children"
              maxTagCount="responsive"
            >
              {indicatorSystems.map(sys => (
                <Select.Option key={sys.id} value={sys.id}>{sys.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item label="开始时间" name="startDate" style={{ flex: 1 }}>
              <DatePicker style={{ width: '100%' }} placeholder="年 / 月 / 日" />
            </Form.Item>
            <Form.Item label="结束时间" name="endDate" style={{ flex: 1 }}>
              <DatePicker style={{ width: '100%' }} placeholder="年 / 月 / 日" />
            </Form.Item>
          </div>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Button style={{ marginRight: 8 }} onClick={() => setCreateModalVisible(false)}>
              取消
            </Button>
            <Button type="primary" htmlType="submit" loading={saving}>
              确定
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ProjectPage;
