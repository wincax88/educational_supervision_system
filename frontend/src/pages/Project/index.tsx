import React, { useState } from 'react';
import { Button, Input, Select, Modal, Form, DatePicker, Upload, message } from 'antd';
import {
  ArrowLeftOutlined,
  PlusOutlined,
  UploadOutlined,
  DatabaseOutlined,
  AppstoreOutlined,
  ToolOutlined,
  FormOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { projects, projectStats, indicatorSystems } from '../../mock/data';
import './index.css';

const { Search } = Input;

const Project: React.FC = () => {
  const navigate = useNavigate();
  const [projectList, setProjectList] = useState(projects);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [form] = Form.useForm();

  const handleSearch = (value: string) => {
    if (value) {
      setProjectList(projects.filter(proj =>
        proj.name.includes(value) || proj.description.includes(value)
      ));
    } else {
      setProjectList(projects);
    }
  };

  const handleCreate = (values: any) => {
    const newProject = {
      id: String(projectList.length + 1),
      name: values.name,
      keywords: values.keywords ? values.keywords.split(/[,，\s]+/) : [],
      description: values.description || '',
      indicatorSystem: values.indicatorSystem,
      startDate: values.dates?.[0]?.format('YYYY-MM-DD') || '',
      endDate: values.dates?.[1]?.format('YYYY-MM-DD') || '',
      status: '配置中' as const,
    };
    setProjectList([newProject, ...projectList]);
    setCreateModalVisible(false);
    form.resetFields();
    message.success('创建成功');
  };

  return (
    <div className="project-page">
      <div className="page-header">
        <span className="back-btn" onClick={() => navigate('/home')}>
          <ArrowLeftOutlined /> 返回
        </span>
        <h1 className="page-title">评估项目主页</h1>
        <div className="header-actions">
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

      <div className="stats-section">
        <h3>本年度项目情况</h3>
        <div className="stats-cards">
          <div className="stat-card">
            <div className="stat-info">
              <div className="stat-label">配置中</div>
              <div className="stat-value" style={{ color: '#1890ff' }}>{projectStats.configuring}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-info">
              <div className="stat-label">填报中</div>
              <div className="stat-value" style={{ color: '#52c41a' }}>{projectStats.filling}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-info">
              <div className="stat-label">评审中</div>
              <div className="stat-value" style={{ color: '#fa8c16' }}>{projectStats.reviewing}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-info">
              <div className="stat-label">已中止</div>
              <div className="stat-value">{projectStats.stopped}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-info">
              <div className="stat-label">已完成</div>
              <div className="stat-value" style={{ color: '#722ed1' }}>{projectStats.completed}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="list-header">
        <h3>项目列表</h3>
        <div className="list-actions">
          <Select defaultValue="2025" style={{ width: 100 }}>
            <Select.Option value="2025">2025</Select.Option>
            <Select.Option value="2024">2024</Select.Option>
            <Select.Option value="2023">2023</Select.Option>
          </Select>
          <Search
            placeholder="搜索项目"
            onSearch={handleSearch}
            style={{ width: 200 }}
            allowClear
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
            创建项目
          </Button>
        </div>
      </div>

      <div className="project-list">
        {projectList.length === 0 ? (
          <div className="empty-state">
            <p>暂无项目数据</p>
          </div>
        ) : (
          projectList.map(project => (
            <div key={project.id} className="project-card">
              <div className="project-info">
                <h4>{project.name}</h4>
                <p>{project.description}</p>
                <div className="project-meta">
                  <span>指标体系: {project.indicatorSystem}</span>
                  <span>时间: {project.startDate} - {project.endDate}</span>
                  <span>状态: {project.status}</span>
                </div>
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
            name="indicatorSystem"
            rules={[{ required: true, message: '请选择评估指标体系' }]}
          >
            <Select placeholder="选择评估指标体系">
              {indicatorSystems.filter(s => s.status === 'published').map(sys => (
                <Select.Option key={sys.id} value={sys.name}>{sys.name}</Select.Option>
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
          <Form.Item label="项目附件" name="attachments">
            <Upload.Dragger>
              <p className="ant-upload-drag-icon">
                <UploadOutlined />
              </p>
              <p className="ant-upload-text">点击上传附件</p>
              <p className="ant-upload-hint">支持多个文件上传</p>
            </Upload.Dragger>
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Button style={{ marginRight: 8 }} onClick={() => setCreateModalVisible(false)}>
              取消
            </Button>
            <Button type="primary" htmlType="submit">
              确定
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Project;
