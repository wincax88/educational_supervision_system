import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button, Input, Tag, Modal, Form, Select, Upload, message, Spin, Empty, Popconfirm } from 'antd';
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
import { useNavigate, useLocation } from 'react-router-dom';
import * as indicatorService from '../../services/indicatorService';
import type { IndicatorSystem } from '../../services/indicatorService';
import { useUserPermissions } from '../../stores/authStore';
import styles from './index.module.css';

const { Search } = Input;

// 统计数据类型
interface IndicatorSystemStats {
  total: number;
  published: number;
  editing: number;
  standard: number;
  scoring: number;
}

const IndicatorLibrary: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const permissions = useUserPermissions();
  const [loading, setLoading] = useState(true);
  const [systems, setSystems] = useState<IndicatorSystem[]>([]);
  const [filteredSystems, setFilteredSystems] = useState<IndicatorSystem[]>([]);
  const [stats, setStats] = useState<IndicatorSystemStats>({ total: 0, published: 0, editing: 0, standard: 0, scoring: 0 });
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [editInfoModalVisible, setEditInfoModalVisible] = useState(false);
  const [currentSystem, setCurrentSystem] = useState<IndicatorSystem | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchValue, setSearchValue] = useState('');
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();

  // 检测项目类型
  const projectType = useMemo(() => {
    if (location.pathname.includes('/home/kindergarten')) {
      return 'preschool';
    }
    return 'balanced';
  }, [location.pathname]);

  // 判断是否为学前教育指标体系
  const isPreschoolIndicatorSystem = useCallback((system: IndicatorSystem) => {
    const keywords = ['学前教育', '普及普惠', '幼儿园', '学前双普'];
    const searchText = `${system.name} ${system.description || ''}`;
    return keywords.some(keyword => searchText.includes(keyword));
  }, []);

  // 动态基础路径
  const basePath = useMemo(() => {
    return projectType === 'preschool' ? '/home/kindergarten' : '/home/balanced';
  }, [projectType]);

  // 动态页面标题
  const pageTitle = useMemo(() => {
    return projectType === 'preschool' ? '学前教育评估指标体系库' : '评估指标体系库主页';
  }, [projectType]);

  // 加载指标体系列表
  const loadSystems = useCallback(async () => {
    try {
      setLoading(true);
      const data = await indicatorService.getIndicatorSystems();

      // 根据项目类型过滤
      const typeFilteredData = data.filter(system => {
        if (projectType === 'preschool') {
          return isPreschoolIndicatorSystem(system);
        } else {
          return !isPreschoolIndicatorSystem(system);
        }
      });

      setSystems(typeFilteredData);

      // 计算统计数据
      setStats({
        total: typeFilteredData.length,
        published: typeFilteredData.filter(sys => sys.status === 'published').length,
        editing: typeFilteredData.filter(sys => sys.status === 'editing' || sys.status === 'draft').length,
        standard: typeFilteredData.filter(sys => sys.type === '达标类').length,
        scoring: typeFilteredData.filter(sys => sys.type === '评分类').length,
      });

      // 应用筛选
      applyFilter(typeFilteredData, searchValue, statusFilter);
    } catch (error) {
      console.error('加载指标体系列表失败:', error);
      message.error('加载指标体系列表失败');
    } finally {
      setLoading(false);
    }
  }, [searchValue, statusFilter, projectType, isPreschoolIndicatorSystem]);

  useEffect(() => {
    loadSystems();
  }, [loadSystems]);

  // 应用筛选
  const applyFilter = (data: IndicatorSystem[], search: string, status: string) => {
    let filtered = data;
    if (search) {
      filtered = filtered.filter(sys =>
        sys.name.includes(search) || sys.description.includes(search)
      );
    }
    if (status !== 'all') {
      filtered = filtered.filter(sys => sys.status === status);
    }
    setFilteredSystems(filtered);
  };

  // 搜索
  const handleSearch = (value: string) => {
    setSearchValue(value);
    applyFilter(systems, value, statusFilter);
  };

  // 状态筛选
  const handleStatusFilter = (value: string) => {
    setStatusFilter(value);
    applyFilter(systems, searchValue, value);
  };

  // 创建指标体系
  const handleCreate = async (values: any) => {
    try {
      await indicatorService.createIndicatorSystem({
        name: values.name,
        type: values.type,
        target: values.target,
        tags: values.keywords ? values.keywords.split(/[,，\s]+/).filter(Boolean) : [],
        description: values.description || '',
      });
      setCreateModalVisible(false);
      form.resetFields();
      message.success('创建成功');
      loadSystems();
    } catch (error) {
      console.error('创建指标体系失败:', error);
      message.error('创建指标体系失败');
    }
  };

  // 查看基础信息
  const handleViewInfo = (system: IndicatorSystem) => {
    setCurrentSystem(system);
    setInfoModalVisible(true);
  };

  // 进入编辑模式
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

  // 保存编辑
  const handleSaveInfo = async (values: any) => {
    if (!currentSystem) return;

    try {
      await indicatorService.updateIndicatorSystem(currentSystem.id, {
        name: values.name,
        type: values.type,
        target: values.target,
        tags: values.keywords ? values.keywords.split(/[,，\s]+/).filter(Boolean) : [],
        description: values.description || '',
      });
      setEditInfoModalVisible(false);
      message.success('保存成功');
      loadSystems();
    } catch (error) {
      console.error('保存失败:', error);
      message.error('保存失败');
    }
  };

  // 发布指标体系
  const handlePublish = async (systemId: string) => {
    try {
      await indicatorService.updateIndicatorSystem(systemId, { status: 'published' });
      message.success('发布成功');
      loadSystems();
    } catch (error) {
      console.error('发布失败:', error);
      message.error('发布失败');
    }
  };

  // 取消发布
  const handleUnpublish = async (systemId: string) => {
    try {
      await indicatorService.updateIndicatorSystem(systemId, { status: 'draft' });
      message.success('已取消发布');
      loadSystems();
    } catch (error) {
      console.error('取消发布失败:', error);
      message.error('取消发布失败');
    }
  };

  // 删除指标体系
  const handleDelete = async (systemId: string) => {
    try {
      await indicatorService.deleteIndicatorSystem(systemId);
      message.success('删除成功');
      loadSystems();
    } catch (error) {
      console.error('删除失败:', error);
      message.error('删除失败');
    }
  };

  // 编辑指标树
  const handleEditTree = (system: IndicatorSystem) => {
    navigate(`${basePath}/indicators/${system.id}/tree`);
  };

  // 获取状态标签
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
        <span className={styles.backBtn} onClick={() => navigate(basePath)}>
          <ArrowLeftOutlined /> 返回
        </span>
        <h1 className={styles.pageTitle}>{pageTitle}</h1>
      </div>

      <div className={styles.statsSection}>
        <h3>指标体系概况</h3>
        <div className={styles.statsCards}>
          <div className={styles.statCard}>
            <div className={styles.statInfo}>
              <div className={styles.statLabel}>体系总数</div>
              <div className={styles.statValue}>{stats.total}</div>
            </div>
            <DatabaseOutlined className={styles.statIcon} style={{ color: '#1890ff' }} />
          </div>
          <div className={styles.statCard}>
            <div className={styles.statInfo}>
              <div className={styles.statLabel}>已发布</div>
              <div className={styles.statValue} style={{ color: '#52c41a' }}>{stats.published}</div>
            </div>
            <CheckCircleOutlined className={styles.statIcon} style={{ color: '#52c41a' }} />
          </div>
          <div className={styles.statCard}>
            <div className={styles.statInfo}>
              <div className={styles.statLabel}>编辑中</div>
              <div className={styles.statValue} style={{ color: '#fa8c16' }}>{stats.editing}</div>
            </div>
            <EditOutlined className={styles.statIcon} style={{ color: '#fa8c16' }} />
          </div>
          <div className={styles.statCard}>
            <div className={styles.statInfo}>
              <div className={styles.statLabel}>达标类</div>
              <div className={styles.statValue} style={{ color: '#1890ff' }}>{stats.standard}</div>
            </div>
            <AimOutlined className={styles.statIcon} style={{ color: '#1890ff' }} />
          </div>
          <div className={styles.statCard}>
            <div className={styles.statInfo}>
              <div className={styles.statLabel}>评分类</div>
              <div className={styles.statValue} style={{ color: '#722ed1' }}>{stats.scoring}</div>
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
          {permissions.canManageSystem && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
              创建评估指标体系
            </Button>
          )}
        </div>
      </div>

      <Spin spinning={loading}>
        {filteredSystems.length === 0 && !loading ? (
          <Empty description="暂无指标体系" />
        ) : (
          <div className={styles.systemList}>
            {filteredSystems.map(system => (
              <div key={system.id} className={styles.systemCard}>
                <div className={styles.systemCardHeader}>
                  <div className={styles.systemMainInfo}>
                    <span className={styles.systemName}>{system.name}</span>
                    <Tag color={system.type === '达标类' ? 'blue' : 'purple'}>{system.type}</Tag>
                    <Tag color="cyan">评估对象: {system.target}</Tag>
                  </div>
                  <div className={styles.systemStats}>
                    <span>指标数: {system.indicatorCount || 0}</span>
                    {getStatusTag(system.status)}
                  </div>
                </div>
                <div className={styles.systemTags}>
                  {system.tags.map(tag => (
                    <Tag key={tag} color="blue">{tag}</Tag>
                  ))}
                </div>
                <p className={styles.systemDesc}>{system.description}</p>
                {system.attachments && system.attachments.length > 0 && (
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
                  {permissions.canManageSystem && (
                    <span className={styles.actionBtn} onClick={() => handleEditTree(system)}>
                      <ApartmentOutlined /> 编辑指标
                    </span>
                  )}
                  {permissions.canManageSystem && (
                    system.status === 'published' ? (
                      <Popconfirm
                        title="取消发布"
                        description="确定要取消发布该指标体系吗？"
                        onConfirm={() => handleUnpublish(system.id)}
                        okText="确定"
                        cancelText="取消"
                      >
                        <span className={styles.actionBtn}>取消发布</span>
                      </Popconfirm>
                    ) : (
                      <>
                        <Popconfirm
                          title="发布指标体系"
                          description="确定要发布该指标体系吗？"
                          onConfirm={() => handlePublish(system.id)}
                          okText="确定"
                          cancelText="取消"
                        >
                          <span className={styles.actionBtn}>发布</span>
                        </Popconfirm>
                        <Popconfirm
                          title="删除指标体系"
                          description="确定要删除该指标体系吗？此操作不可恢复。"
                          onConfirm={() => handleDelete(system.id)}
                          okText="确定"
                          cancelText="取消"
                          okButtonProps={{ danger: true }}
                        >
                          <span className={`${styles.actionBtn} ${styles.danger}`}>
                            <DeleteOutlined /> 删除
                          </span>
                        </Popconfirm>
                      </>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Spin>

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
            <Input placeholder="用逗号、分号或空格分割" />
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
              <Tag>指标数: {currentSystem.indicatorCount || 0}</Tag>
            </div>
            <div className={styles.infoModalKeywords}>
              {currentSystem.tags.map(tag => (
                <Tag key={tag} color="blue">{tag}</Tag>
              ))}
            </div>
            <p className={styles.infoModalDesc}>{currentSystem.description}</p>

            <div className={styles.infoModalAttachments}>
              <h4>附件 ({currentSystem.attachments?.length || 0})</h4>
              <div className={styles.attachmentList}>
                {currentSystem.attachments && currentSystem.attachments.length > 0 ? (
                  currentSystem.attachments.map(att => (
                    <div key={att.name} className={styles.attachmentItem}>
                      <div className={styles.attachmentInfo}>
                        <FileTextOutlined className={styles.attachmentIcon} />
                        <span className={styles.attachmentName}>{att.name}</span>
                        <span className={styles.attachmentSize}>({att.size})</span>
                      </div>
                      <Button type="link" icon={<DownloadOutlined />}>下载</Button>
                    </div>
                  ))
                ) : (
                  <Empty description="暂无附件" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
              </div>
            </div>

            <div className={styles.infoModalFooter}>
              <Button onClick={() => setInfoModalVisible(false)}>关闭</Button>
              {permissions.canManageSystem && (
                <Button type="primary" icon={<EditOutlined />} onClick={handleEditInfo}>编辑</Button>
              )}
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
            {currentSystem && currentSystem.attachments && currentSystem.attachments.length > 0 && (
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
