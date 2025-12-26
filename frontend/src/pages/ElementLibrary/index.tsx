import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button, Input, Tag, Modal, Form, message, Popconfirm, Spin, Empty } from 'antd';
import {
  ArrowLeftOutlined,
  PlusOutlined,
  DatabaseOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  AppstoreOutlined,
  EyeOutlined,
  CloseOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import * as toolService from '../../services/toolService';
import type { ElementLibrary as ElementLibraryType, Element } from '../../services/toolService';
import { useUserPermissions } from '../../stores/authStore';
import styles from './index.module.css';

const { Search } = Input;

// 统计数据类型
interface ElementLibraryStats {
  total: number;
  published: number;
  draft: number;
  elementCount: number;
}

const ElementLibrary: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const permissions = useUserPermissions();
  const [loading, setLoading] = useState(true);
  const [libraries, setLibraries] = useState<ElementLibraryType[]>([]);
  const [filteredLibraries, setFilteredLibraries] = useState<ElementLibraryType[]>([]);
  const [stats, setStats] = useState<ElementLibraryStats>({ total: 0, published: 0, draft: 0, elementCount: 0 });
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [selectedLibrary, setSelectedLibrary] = useState<ElementLibraryType | null>(null);
  const [selectedLibraryElements, setSelectedLibraryElements] = useState<Element[]>([]);
  const [form] = Form.useForm();

  // 检测项目类型
  const projectType = useMemo(() => {
    if (location.pathname.includes('/home/kindergarten')) {
      return 'preschool';
    }
    return 'balanced';
  }, [location.pathname]);

  // 判断是否为学前教育要素库
  const isPreschoolElementLibrary = useCallback((library: ElementLibraryType) => {
    const keywords = ['学前教育', '普及普惠', '幼儿园', '学前双普'];
    const searchText = `${library.name} ${library.description || ''}`;
    return keywords.some(keyword => searchText.includes(keyword));
  }, []);

  // 动态基础路径
  const basePath = useMemo(() => {
    return projectType === 'preschool' ? '/home/kindergarten' : '/home/balanced';
  }, [projectType]);

  // 动态页面标题
  const pageTitle = useMemo(() => {
    return projectType === 'preschool' ? '学前教育评估要素库' : '评估要素库主页';
  }, [projectType]);

  // 加载要素库列表
  const loadLibraries = useCallback(async () => {
    try {
      setLoading(true);
      const data = await toolService.getElementLibraries();

      // 根据项目类型过滤
      const typeFilteredData = data.filter(library => {
        if (projectType === 'preschool') {
          return isPreschoolElementLibrary(library);
        } else {
          return !isPreschoolElementLibrary(library);
        }
      });

      setLibraries(typeFilteredData);
      setFilteredLibraries(typeFilteredData);

      // 计算统计数据
      const totalElements = typeFilteredData.reduce((sum, lib) => sum + (lib.elementCount || 0), 0);
      setStats({
        total: typeFilteredData.length,
        published: typeFilteredData.filter(lib => lib.status === 'published').length,
        draft: typeFilteredData.filter(lib => lib.status === 'draft').length,
        elementCount: totalElements,
      });
    } catch (error) {
      console.error('加载要素库列表失败:', error);
      message.error('加载要素库列表失败');
    } finally {
      setLoading(false);
    }
  }, [projectType, isPreschoolElementLibrary]);

  useEffect(() => {
    loadLibraries();
  }, [loadLibraries]);

  // 搜索
  const handleSearch = (value: string) => {
    if (value) {
      setFilteredLibraries(libraries.filter(lib =>
        lib.name.includes(value) || lib.description.includes(value)
      ));
    } else {
      setFilteredLibraries(libraries);
    }
  };

  // 创建要素库
  const handleCreate = async (values: { name: string; description: string }) => {
    try {
      await toolService.createElementLibrary({
        name: values.name,
        description: values.description || '',
      });
      setCreateModalVisible(false);
      form.resetFields();
      message.success('创建成功');
      loadLibraries();
    } catch (error) {
      console.error('创建要素库失败:', error);
      message.error('创建要素库失败');
    }
  };

  // 查看基础信息
  const handleShowInfo = async (library: ElementLibraryType) => {
    setSelectedLibrary(library);
    setInfoModalVisible(true);

    // 加载要素库详情（包含要素）
    try {
      const detail = await toolService.getElementLibrary(library.id);
      setSelectedLibraryElements(detail.elements || []);
    } catch (error) {
      console.error('加载要素库详情失败:', error);
      setSelectedLibraryElements([]);
    }
  };

  // 发布要素库
  const handlePublish = async (libraryId: string) => {
    try {
      await toolService.updateElementLibrary(libraryId, { status: 'published' });
      message.success('发布成功');
      loadLibraries();
    } catch (error) {
      console.error('发布失败:', error);
      message.error('发布失败');
    }
  };

  // 取消发布
  const handleUnpublish = async (libraryId: string) => {
    try {
      await toolService.updateElementLibrary(libraryId, { status: 'draft' });
      message.success('已取消发布');
      loadLibraries();
    } catch (error) {
      console.error('取消发布失败:', error);
      message.error('取消发布失败');
    }
  };

  // 删除要素库
  const handleDelete = async (libraryId: string) => {
    try {
      await toolService.deleteElementLibrary(libraryId);
      message.success('删除成功');
      loadLibraries();
    } catch (error) {
      console.error('删除失败:', error);
      message.error('删除失败');
    }
  };

  return (
    <div className={styles.elementLibraryPage}>
      <div className={styles.pageHeader}>
        <span className={styles.backBtn} onClick={() => navigate(basePath)}>
          <ArrowLeftOutlined /> 返回
        </span>
        <h1 className={styles.pageTitle}>{pageTitle}</h1>
      </div>

      <div className={styles.statsCards}>
        <div className={styles.statCard}>
          <div className={styles.statInfo}>
            <div className={styles.statLabel}>要素库总数</div>
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
            <div className={styles.statLabel}>未发布</div>
            <div className={styles.statValue} style={{ color: '#fa8c16' }}>{stats.draft}</div>
          </div>
          <FileTextOutlined className={styles.statIcon} style={{ color: '#fa8c16' }} />
        </div>
        <div className={styles.statCard}>
          <div className={styles.statInfo}>
            <div className={styles.statLabel}>要素总数</div>
            <div className={styles.statValue} style={{ color: '#722ed1' }}>{stats.elementCount}</div>
          </div>
          <AppstoreOutlined className={styles.statIcon} style={{ color: '#722ed1' }} />
        </div>
      </div>

      <div className={styles.listHeader}>
        <h3>评估要素库列表</h3>
        <div className={styles.listActions}>
          <Search
            placeholder="搜索要素库..."
            onSearch={handleSearch}
            style={{ width: 200 }}
            allowClear
          />
          {permissions.canManageSystem && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
              新建要素库
            </Button>
          )}
        </div>
      </div>

      <Spin spinning={loading}>
        {filteredLibraries.length === 0 && !loading ? (
          <Empty description="暂无要素库" />
        ) : (
          <div className={styles.libraryList}>
            {filteredLibraries.map((library, index) => (
              <div key={library.id} className={`${styles.listCard} ${index === 0 ? '' : index === 1 ? styles.purple : styles.orange}`}>
                <div className={styles.listCardHeader}>
                  <div>
                    <span className={styles.listCardTitle} onClick={() => navigate(`/home/balanced/elements/${library.id}`)}>
                      {library.name}
                    </span>
                    <Tag color={library.status === 'published' ? 'blue' : 'default'} style={{ marginLeft: 8 }}>
                      {library.status === 'published' ? '已发布' : '未发布'}
                    </Tag>
                    <span style={{ marginLeft: 8, color: '#666' }}>{library.elementCount || 0} 个要素</span>
                  </div>
                  <div className={styles.listCardMeta}>
                    <div>创建人: {library.createdBy}</div>
                    <div>创建时间: {library.createdAt}</div>
                    <div>变更人: {library.updatedBy}</div>
                    <div>变更时间: {library.updatedAt}</div>
                  </div>
                </div>
                <div className={styles.listCardDesc}>{library.description}</div>
                <div className={styles.listCardActions}>
                  <span className={styles.actionBtn} onClick={() => handleShowInfo(library)}>
                    <EyeOutlined /> 基础信息
                  </span>
                  {permissions.canManageSystem && (
                    library.status === 'published' ? (
                      <Popconfirm
                        title="取消发布"
                        description="确定要取消发布该要素库吗？取消后将无法在项目中使用。"
                        onConfirm={() => handleUnpublish(library.id)}
                        okText="确定"
                        cancelText="取消"
                      >
                        <span className={styles.actionBtn}>
                          <CloseOutlined /> 取消发布
                        </span>
                      </Popconfirm>
                    ) : (
                      <>
                        <span className={styles.actionBtn} onClick={() => navigate(`/home/balanced/elements/${library.id}/edit`)}>
                          编辑要素
                        </span>
                        <Popconfirm
                          title="发布要素库"
                          description="确定要发布该要素库吗？发布后可在项目中使用。"
                          onConfirm={() => handlePublish(library.id)}
                          okText="确定"
                          cancelText="取消"
                        >
                          <span className={styles.actionBtn}>
                            <CheckCircleOutlined /> 发布
                          </span>
                        </Popconfirm>
                        <Popconfirm
                          title="删除要素库"
                          description="确定要删除该要素库吗？此操作不可恢复。"
                          onConfirm={() => handleDelete(library.id)}
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

      <Modal
        title="新建评估要素库"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        footer={null}
        width={480}
      >
        <p style={{ color: '#666', marginBottom: 24 }}>创建一个新的评估要素库，用于管理评估过程中的数据要素</p>
        <Form form={form} onFinish={handleCreate} layout="vertical">
          <Form.Item
            label="要素库名称"
            name="name"
            rules={[{ required: true, message: '请输入要素库名称' }]}
          >
            <Input placeholder="请输入要素库名称" />
          </Form.Item>
          <Form.Item label="要素库描述" name="description">
            <Input.TextArea placeholder="请输入要素库的描述信息" rows={4} />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Button style={{ marginRight: 8 }} onClick={() => setCreateModalVisible(false)}>
              取消
            </Button>
            <Button type="primary" htmlType="submit">
              创建
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="基础信息"
        open={infoModalVisible}
        onCancel={() => setInfoModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setInfoModalVisible(false)}>关闭</Button>
        ]}
        width={560}
      >
        {selectedLibrary && (
          <div className={styles.infoModalContent}>
            <div className={styles.infoHeader}>
              <h3>{selectedLibrary.name}</h3>
              <Tag color={selectedLibrary.status === 'published' ? 'blue' : 'default'}>
                {selectedLibrary.status === 'published' ? '已发布' : '未发布'}
              </Tag>
            </div>
            <div className={styles.infoMeta}>
              创建人: {selectedLibrary.createdBy} &nbsp;&nbsp;
              创建时间: {selectedLibrary.createdAt} &nbsp;&nbsp;
              变更人: {selectedLibrary.updatedBy} &nbsp;&nbsp;
              变更时间: {selectedLibrary.updatedAt}
            </div>
            <p className={styles.infoDesc}>{selectedLibrary.description}</p>
            <h4>数据要素（最近5个）</h4>
            <div className={styles.elementList}>
              {selectedLibraryElements.length === 0 ? (
                <Empty description="暂无要素" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                selectedLibraryElements.slice(0, 5).map(el => (
                  <div key={el.id} className={styles.elementItem}>
                    <span className={styles.elementCode}>{el.code}</span>
                    <span className={styles.elementName}>{el.name}</span>
                    <Tag>{el.elementType}</Tag>
                    <Tag>{el.dataType}</Tag>
                  </div>
                ))
              )}
            </div>
            <p style={{ color: '#1890ff', textAlign: 'center', marginTop: 16 }}>
              共 {selectedLibrary.elementCount || 0} 个要素，显示最近 5 个
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ElementLibrary;
