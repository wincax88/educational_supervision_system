import React, { useState } from 'react';
import { Button, Input, Tag, Modal, Form, Select, Upload, message } from 'antd';
import {
  ArrowLeftOutlined,
  PlusOutlined,
  DatabaseOutlined,
  CheckCircleOutlined,
  EditOutlined,
  AimOutlined,
  BarChartOutlined,
  EyeOutlined,
  FileTextOutlined,
  UploadOutlined,
  DeleteOutlined,
  DownloadOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { indicatorSystems, indicatorSystemStats, IndicatorSystem } from '../../mock/data';
import './index.css';

const { Search } = Input;

const IndicatorLibrary: React.FC = () => {
  const navigate = useNavigate();
  const [systems, setSystems] = useState(indicatorSystems);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [editInfoModalVisible, setEditInfoModalVisible] = useState(false);
  const [currentSystem, setCurrentSystem] = useState<IndicatorSystem | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();

  const handleSearch = (value: string) => {
    filterSystems(value, statusFilter);
  };

  const handleStatusFilter = (value: string) => {
    setStatusFilter(value);
    filterSystems('', value);
  };

  const filterSystems = (searchValue: string, status: string) => {
    let filtered = indicatorSystems;
    if (searchValue) {
      filtered = filtered.filter(sys =>
        sys.name.includes(searchValue) || sys.description.includes(searchValue)
      );
    }
    if (status !== 'all') {
      filtered = filtered.filter(sys => sys.status === status);
    }
    setSystems(filtered);
  };

  const handleCreate = (values: any) => {
    const newSystem: IndicatorSystem = {
      id: String(systems.length + 1),
      name: values.name,
      type: values.type,
      target: values.target,
      tags: values.keywords ? values.keywords.split(/[,，\s]+/) : [],
      description: values.description || '',
      indicatorCount: 0,
      attachments: [],
      status: 'draft' as const,
      createdBy: 'admin',
      createdAt: new Date().toISOString().split('T')[0],
      updatedBy: 'admin',
      updatedAt: new Date().toISOString().split('T')[0],
    };
    setSystems([newSystem, ...systems]);
    setCreateModalVisible(false);
    form.resetFields();
    message.success('创建成功');
  };

  const handleViewInfo = (system: IndicatorSystem) => {
    setCurrentSystem(system);
    setInfoModalVisible(true);
  };

  const handleEditInfo = () => {
    if (currentSystem) {
      editForm.setFieldsValue({
        name: currentSystem.name,
        type: currentSystem.type,
        target: currentSystem.target,
        keywords: currentSystem.tags.join(','),
        description: currentSystem.description,
      });
      setInfoModalVisible(false);
      setEditInfoModalVisible(true);
    }
  };

  const handleSaveInfo = (values: any) => {
    if (currentSystem) {
      const updatedSystem = {
        ...currentSystem,
        name: values.name,
        type: values.type,
        target: values.target,
        tags: values.keywords ? values.keywords.split(/[,，\s]+/) : [],
        description: values.description || '',
        updatedAt: new Date().toISOString().split('T')[0],
        updatedBy: 'admin',
      };
      setSystems(systems.map(sys => sys.id === currentSystem.id ? updatedSystem : sys));
      setCurrentSystem(updatedSystem);
      setEditInfoModalVisible(false);
      message.success('保存成功');
    }
  };

  const handleEditIndicators = (system: IndicatorSystem) => {
    navigate(`/home/balanced/indicators/${system.id}/edit`);
  };

  const getStatusTag = (status: string) => {
    switch (status) {
      case 'published':
        return <Tag color="green">已发布</Tag>;
      case 'editing':
        return <Tag color="orange">编辑中</Tag>;
      default:
        return <Tag>草稿</Tag>;
    }
  };

  return (
    <div className="indicator-library-page">
      <div className="page-header">
        <span className="back-btn" onClick={() => navigate('/home/balanced')}>
          <ArrowLeftOutlined /> 返回
        </span>
        <h1 className="page-title">评估指标体系库主页</h1>
      </div>

      <div className="stats-section">
        <h3>指标体系概况</h3>
        <div className="stats-cards">
          <div className="stat-card">
            <div className="stat-info">
              <div className="stat-label">体系总数</div>
              <div className="stat-value">{indicatorSystemStats.total}</div>
            </div>
            <DatabaseOutlined className="stat-icon" style={{ color: '#1890ff' }} />
          </div>
          <div className="stat-card">
            <div className="stat-info">
              <div className="stat-label">已发布</div>
              <div className="stat-value" style={{ color: '#52c41a' }}>{indicatorSystemStats.published}</div>
            </div>
            <CheckCircleOutlined className="stat-icon" style={{ color: '#52c41a' }} />
          </div>
          <div className="stat-card">
            <div className="stat-info">
              <div className="stat-label">编辑中</div>
              <div className="stat-value" style={{ color: '#fa8c16' }}>{indicatorSystemStats.editing}</div>
            </div>
            <EditOutlined className="stat-icon" style={{ color: '#fa8c16' }} />
          </div>
          <div className="stat-card">
            <div className="stat-info">
              <div className="stat-label">达标类</div>
              <div className="stat-value" style={{ color: '#1890ff' }}>{indicatorSystemStats.standard}</div>
            </div>
            <AimOutlined className="stat-icon" style={{ color: '#1890ff' }} />
          </div>
          <div className="stat-card">
            <div className="stat-info">
              <div className="stat-label">评分类</div>
              <div className="stat-value" style={{ color: '#722ed1' }}>{indicatorSystemStats.scoring}</div>
            </div>
            <BarChartOutlined className="stat-icon" style={{ color: '#722ed1' }} />
          </div>
        </div>
      </div>

      <div className="list-header">
        <h3>评估指标体系列表</h3>
        <div className="list-actions">
          <Select
            value={statusFilter}
            onChange={handleStatusFilter}
            style={{ width: 120 }}
          >
            <Select.Option value="all">全部状态</Select.Option>
            <Select.Option value="published">已发布</Select.Option>
            <Select.Option value="editing">编辑中</Select.Option>
            <Select.Option value="draft">草稿</Select.Option>
          </Select>
          <Search
            placeholder="搜索指标体系"
            onSearch={handleSearch}
            style={{ width: 200 }}
            allowClear
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
            创建评估指标体系
          </Button>
        </div>
      </div>

      <div className="system-list">
        {systems.map(system => (
          <div key={system.id} className="system-card">
            <div className="system-card-header">
              <div className="system-main-info">
                <span className="system-name">{system.name}</span>
                <Tag color={system.type === '达标类' ? 'blue' : 'purple'}>{system.type}</Tag>
                <Tag color="cyan">评估对象: {system.target}</Tag>
              </div>
              <div className="system-stats">
                <span>指标数: {system.indicatorCount}</span>
                {getStatusTag(system.status)}
              </div>
            </div>
            <div className="system-tags">
              {system.tags.map(tag => (
                <Tag key={tag} color="blue">{tag}</Tag>
              ))}
            </div>
            <p className="system-desc">{system.description}</p>
            {system.attachments.length > 0 && (
              <div className="system-attachments">
                {system.attachments.map(att => (
                  <Tag key={att.name} icon={<FileTextOutlined />} color="orange">
                    {att.name} ({att.size})
                  </Tag>
                ))}
              </div>
            )}
            <div className="system-meta">
              创建时间: {system.createdAt} &nbsp;&nbsp;
              创建人: {system.createdBy} &nbsp;&nbsp;
              更新时间: {system.updatedAt} &nbsp;&nbsp;
              更新人: {system.updatedBy}
            </div>
            <div className="system-actions">
              <span className="action-btn" onClick={() => handleViewInfo(system)}>
                <EyeOutlined /> 基础信息
              </span>
              <span className="action-btn" onClick={() => handleEditIndicators(system)}>
                <EditOutlined /> 编辑指标
              </span>
              {system.status === 'published' ? (
                <span className="action-btn">取消发布</span>
              ) : (
                <>
                  <span className="action-btn">发布</span>
                  <span className="action-btn danger">
                    <DeleteOutlined /> 删除
                  </span>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 创建指标体系弹窗 */}
      <Modal
        title="指标体系信息管理"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        footer={null}
        width={560}
      >
        <p style={{ color: '#666', marginBottom: 24 }}>创建新的评估指标体系</p>
        <Form form={form} onFinish={handleCreate} layout="vertical">
          <Form.Item
            label="名称"
            name="name"
            rules={[{ required: true, message: '请输入评估指标体系名称' }]}
          >
            <Input placeholder="请输入评估指标体系名称" />
          </Form.Item>
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item
              label="指标体系类型"
              name="type"
              rules={[{ required: true, message: '请选择类型' }]}
              style={{ flex: 1 }}
            >
              <Select placeholder="请选择类型">
                <Select.Option value="达标类">达标类</Select.Option>
                <Select.Option value="评分类">评分类</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item
              label="评估对象"
              name="target"
              rules={[{ required: true, message: '请输入评估对象' }]}
              style={{ flex: 1 }}
            >
              <Input placeholder="如：区县、学校等" />
            </Form.Item>
          </div>
          <Form.Item label="关键字" name="keywords">
            <Input placeholder="用逗号、分号、|或空格分割" />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea placeholder="请输入指标体系描述" rows={3} />
          </Form.Item>
          <Form.Item label="附件" name="attachments">
            <Upload.Dragger>
              <p className="ant-upload-drag-icon">
                <UploadOutlined />
              </p>
              <p className="ant-upload-text">点击上传附件</p>
              <p className="ant-upload-hint">支持PDF、Word、Excel等格式</p>
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

      {/* 基础信息查看弹窗 */}
      <Modal
        open={infoModalVisible}
        onCancel={() => setInfoModalVisible(false)}
        footer={null}
        width={700}
        closeIcon={<CloseOutlined />}
        className="info-modal"
      >
        {currentSystem && (
          <div className="info-modal-content">
            <div className="info-modal-header">
              <h2 className="info-modal-title">{currentSystem.name}</h2>
              <Tag color="green" className="info-status-tag">
                <CheckCircleOutlined /> {currentSystem.status === 'published' ? '已发布' : currentSystem.status === 'editing' ? '编辑中' : '草稿'}
              </Tag>
            </div>
            <div className="info-modal-meta">
              创建时间: {currentSystem.createdAt} | 创建人: {currentSystem.createdBy} | 更新时间: {currentSystem.updatedAt} | 更新人: {currentSystem.updatedBy}
            </div>
            <div className="info-modal-tags">
              <Tag color="orange">{currentSystem.type}</Tag>
              <Tag color="cyan">评估对象: {currentSystem.target}</Tag>
              <Tag>指标数: {currentSystem.indicatorCount}</Tag>
            </div>
            <div className="info-modal-keywords">
              {currentSystem.tags.map(tag => (
                <Tag key={tag} color="blue">{tag}</Tag>
              ))}
            </div>
            <p className="info-modal-desc">{currentSystem.description}</p>

            <div className="info-modal-attachments">
              <h4>附件 ({currentSystem.attachments.length})</h4>
              <div className="attachment-list">
                {currentSystem.attachments.map(att => (
                  <div key={att.name} className="attachment-item">
                    <div className="attachment-info">
                      <FileTextOutlined className="attachment-icon" />
                      <span className="attachment-name">{att.name}</span>
                      <span className="attachment-size">({att.size})</span>
                    </div>
                    <Button type="link" icon={<DownloadOutlined />}>下载</Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="info-modal-footer">
              <Button onClick={() => setInfoModalVisible(false)}>关闭</Button>
              <Button type="primary" icon={<EditOutlined />} onClick={handleEditInfo}>编辑</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* 基础信息编辑弹窗 */}
      <Modal
        title="指标体系信息管理"
        open={editInfoModalVisible}
        onCancel={() => setEditInfoModalVisible(false)}
        footer={null}
        width={600}
        className="edit-info-modal"
      >
        <p style={{ color: '#666', marginBottom: 24 }}>编辑指标体系的基本信息</p>
        <Form form={editForm} onFinish={handleSaveInfo} layout="vertical">
          <Form.Item
            label="名称"
            name="name"
            rules={[{ required: true, message: '请输入名称' }]}
          >
            <Input placeholder="请输入评估指标体系名称" />
          </Form.Item>
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item
              label="指标体系类型"
              name="type"
              rules={[{ required: true, message: '请选择类型' }]}
              style={{ flex: 1 }}
            >
              <Select placeholder="请选择类型">
                <Select.Option value="达标类">达标类</Select.Option>
                <Select.Option value="评分类">评分类</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item
              label="评估对象"
              name="target"
              rules={[{ required: true, message: '请输入评估对象' }]}
              style={{ flex: 1 }}
            >
              <Input placeholder="如：区县、学校等" />
            </Form.Item>
          </div>
          <Form.Item label="关键字" name="keywords">
            <Input placeholder="用逗号分隔多个关键字" />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea placeholder="请输入指标体系描述" rows={4} />
          </Form.Item>
          <Form.Item label="附件">
            <Upload.Dragger className="attachment-uploader">
              <p className="ant-upload-drag-icon">
                <UploadOutlined />
              </p>
              <p className="ant-upload-text">点击上传附件</p>
              <p className="ant-upload-hint">支持PDF、Word、Excel等格式</p>
            </Upload.Dragger>
            {currentSystem && currentSystem.attachments.length > 0 && (
              <div className="uploaded-attachments">
                {currentSystem.attachments.map(att => (
                  <div key={att.name} className="uploaded-attachment-item">
                    <div className="uploaded-attachment-info">
                      <FileTextOutlined />
                      <span>{att.name}</span>
                      <span className="file-size">{att.size}</span>
                    </div>
                    <CloseOutlined className="remove-btn" />
                  </div>
                ))}
              </div>
            )}
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Button style={{ marginRight: 8 }} onClick={() => setEditInfoModalVisible(false)}>
              取消
            </Button>
            <Button type="primary" htmlType="submit">
              保存
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default IndicatorLibrary;
