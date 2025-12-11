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
  ApartmentOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { indicatorSystems, indicatorSystemStats, IndicatorSystem } from '../../mock/data';
import styles from './index.module.css';

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

  const handleEditTree = (system: IndicatorSystem) => {
    navigate(`/home/balanced/indicators/${system.id}/tree`);
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
    <div className={styles.indicatorLibraryPage}>
      <div className={styles.pageHeader}>
        <span className={styles.backBtn} onClick={() => navigate('/home/balanced')}>
          <ArrowLeftOutlined /> 返回
        </span>
        <h1 className={styles.pageTitle}>评估指标体系库主页</h1>
      </div>

      <div className={styles.statsSection}>
        <h3>指标体系概况</h3>
        <div className={styles.statsCards}>
          <div className={styles.statCard}>
            <div className={styles.statInfo}>
              <div className={styles.statLabel}>体系总数</div>
              <div className={styles.statValue}>{indicatorSystemStats.total}</div>
            </div>
            <DatabaseOutlined className={styles.statIcon} style={{ color: '#1890ff' }} />
          </div>
          <div className={styles.statCard}>
            <div className={styles.statInfo}>
              <div className={styles.statLabel}>已发布</div>
              <div className={styles.statValue} style={{ color: '#52c41a' }}>{indicatorSystemStats.published}</div>
            </div>
            <CheckCircleOutlined className={styles.statIcon} style={{ color: '#52c41a' }} />
          </div>
          <div className={styles.statCard}>
            <div className={styles.statInfo}>
              <div className={styles.statLabel}>编辑中</div>
              <div className={styles.statValue} style={{ color: '#fa8c16' }}>{indicatorSystemStats.editing}</div>
            </div>
            <EditOutlined className={styles.statIcon} style={{ color: '#fa8c16' }} />
          </div>
          <div className={styles.statCard}>
            <div className={styles.statInfo}>
              <div className={styles.statLabel}>达标类</div>
              <div className={styles.statValue} style={{ color: '#1890ff' }}>{indicatorSystemStats.standard}</div>
            </div>
            <AimOutlined className={styles.statIcon} style={{ color: '#1890ff' }} />
          </div>
          <div className={styles.statCard}>
            <div className={styles.statInfo}>
              <div className={styles.statLabel}>评分类</div>
              <div className={styles.statValue} style={{ color: '#722ed1' }}>{indicatorSystemStats.scoring}</div>
            </div>
            <BarChartOutlined className={styles.statIcon} style={{ color: '#722ed1' }} />
          </div>
        </div>
      </div>

      <div className={styles.listHeader}>
        <h3>评估指标体系列表</h3>
        <div className={styles.listActions}>
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

      <div className={styles.systemList}>
        {systems.map(system => (
          <div key={system.id} className={styles.systemCard}>
            <div className={styles.systemCardHeader}>
              <div className={styles.systemMainInfo}>
                <span className={styles.systemName}>{system.name}</span>
                <Tag color={system.type === '达标类' ? 'blue' : 'purple'}>{system.type}</Tag>
                <Tag color="cyan">评估对象: {system.target}</Tag>
              </div>
              <div className={styles.systemStats}>
                <span>指标数: {system.indicatorCount}</span>
                {getStatusTag(system.status)}
              </div>
            </div>
            <div className={styles.systemTags}>
              {system.tags.map(tag => (
                <Tag key={tag} color="blue">{tag}</Tag>
              ))}
            </div>
            <p className={styles.systemDesc}>{system.description}</p>
            {system.attachments.length > 0 && (
              <div className={styles.systemAttachments}>
                {system.attachments.map(att => (
                  <Tag key={att.name} icon={<FileTextOutlined />} color="orange">
                    {att.name} ({att.size})
                  </Tag>
                ))}
              </div>
            )}
            <div className={styles.systemMeta}>
              创建时间: {system.createdAt} &nbsp;&nbsp;
              创建人: {system.createdBy} &nbsp;&nbsp;
              更新时间: {system.updatedAt} &nbsp;&nbsp;
              更新人: {system.updatedBy}
            </div>
            <div className={styles.systemActions}>
              <span className={styles.actionBtn} onClick={() => handleViewInfo(system)}>
                <EyeOutlined /> 基础信息
              </span>
              <span className={styles.actionBtn} onClick={() => handleEditTree(system)}>
                <ApartmentOutlined /> 编辑指标
              </span>
              {system.status === 'published' ? (
                <span className={styles.actionBtn}>取消发布</span>
              ) : (
                <>
                  <span className={styles.actionBtn}>发布</span>
                  <span className={`${styles.actionBtn} ${styles.danger}`}>
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
        className={styles.infoModal}
      >
        {currentSystem && (
          <div className={styles.infoModalContent}>
            <div className={styles.infoModalHeader}>
              <h2 className={styles.infoModalTitle}>{currentSystem.name}</h2>
              <Tag color="green" className={styles.infoStatusTag}>
                <CheckCircleOutlined /> {currentSystem.status === 'published' ? '已发布' : currentSystem.status === 'editing' ? '编辑中' : '草稿'}
              </Tag>
            </div>
            <div className={styles.infoModalMeta}>
              创建时间: {currentSystem.createdAt} | 创建人: {currentSystem.createdBy} | 更新时间: {currentSystem.updatedAt} | 更新人: {currentSystem.updatedBy}
            </div>
            <div className={styles.infoModalTags}>
              <Tag color="orange">{currentSystem.type}</Tag>
              <Tag color="cyan">评估对象: {currentSystem.target}</Tag>
              <Tag>指标数: {currentSystem.indicatorCount}</Tag>
            </div>
            <div className={styles.infoModalKeywords}>
              {currentSystem.tags.map(tag => (
                <Tag key={tag} color="blue">{tag}</Tag>
              ))}
            </div>
            <p className={styles.infoModalDesc}>{currentSystem.description}</p>

            <div className={styles.infoModalAttachments}>
              <h4>附件 ({currentSystem.attachments.length})</h4>
              <div className={styles.attachmentList}>
                {currentSystem.attachments.map(att => (
                  <div key={att.name} className={styles.attachmentItem}>
                    <div className={styles.attachmentInfo}>
                      <FileTextOutlined className={styles.attachmentIcon} />
                      <span className={styles.attachmentName}>{att.name}</span>
                      <span className={styles.attachmentSize}>({att.size})</span>
                    </div>
                    <Button type="link" icon={<DownloadOutlined />}>下载</Button>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.infoModalFooter}>
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
        className={styles.editInfoModal}
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
            <Upload.Dragger className={styles.attachmentUploader}>
              <p className="ant-upload-drag-icon">
                <UploadOutlined />
              </p>
              <p className="ant-upload-text">点击上传附件</p>
              <p className="ant-upload-hint">支持PDF、Word、Excel等格式</p>
            </Upload.Dragger>
            {currentSystem && currentSystem.attachments.length > 0 && (
              <div className={styles.uploadedAttachments}>
                {currentSystem.attachments.map(att => (
                  <div key={att.name} className={styles.uploadedAttachmentItem}>
                    <div className={styles.uploadedAttachmentInfo}>
                      <FileTextOutlined />
                      <span>{att.name}</span>
                      <span className={styles.fileSize}>{att.size}</span>
                    </div>
                    <CloseOutlined className={styles.removeBtn} />
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
