import React, { useState } from 'react';
import { Button, Input, Tag, Modal, Form, message, Popconfirm } from 'antd';
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
import { useNavigate } from 'react-router-dom';
import { elementLibraries, elementLibraryStats, elements } from '../../mock/data';
import styles from './index.module.css';

const { Search } = Input;

const ElementLibrary: React.FC = () => {
  const navigate = useNavigate();
  const [libraries, setLibraries] = useState(elementLibraries);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [selectedLibrary, setSelectedLibrary] = useState<typeof elementLibraries[0] | null>(null);
  const [form] = Form.useForm();

  const handleSearch = (value: string) => {
    if (value) {
      setLibraries(elementLibraries.filter(lib =>
        lib.name.includes(value) || lib.description.includes(value)
      ));
    } else {
      setLibraries(elementLibraries);
    }
  };

  const handleCreate = (values: { name: string; description: string }) => {
    const newLibrary = {
      id: String(libraries.length + 1),
      name: values.name,
      description: values.description || '',
      elementCount: 0,
      status: 'draft' as const,
      createdBy: 'admin',
      createdAt: new Date().toISOString().split('T')[0],
      updatedBy: 'admin',
      updatedAt: new Date().toISOString().split('T')[0],
    };
    setLibraries([newLibrary, ...libraries]);
    setCreateModalVisible(false);
    form.resetFields();
    message.success('创建成功');
  };

  const handleShowInfo = (library: typeof elementLibraries[0]) => {
    setSelectedLibrary(library);
    setInfoModalVisible(true);
  };

  // 发布要素库
  const handlePublish = (libraryId: string) => {
    setLibraries(prev => prev.map(lib =>
      lib.id === libraryId
        ? { ...lib, status: 'published' as const, updatedAt: new Date().toISOString().split('T')[0] }
        : lib
    ));
    message.success('发布成功');
  };

  // 取消发布
  const handleUnpublish = (libraryId: string) => {
    setLibraries(prev => prev.map(lib =>
      lib.id === libraryId
        ? { ...lib, status: 'draft' as const, updatedAt: new Date().toISOString().split('T')[0] }
        : lib
    ));
    message.success('已取消发布');
  };

  // 删除要素库
  const handleDelete = (libraryId: string) => {
    setLibraries(prev => prev.filter(lib => lib.id !== libraryId));
    message.success('删除成功');
  };

  return (
    <div className={styles.elementLibraryPage}>
      <div className={styles.pageHeader}>
        <span className={styles.backBtn} onClick={() => navigate('/home/balanced')}>
          <ArrowLeftOutlined /> 返回
        </span>
        <h1 className={styles.pageTitle}>评估要素库主页</h1>
      </div>

      <div className={styles.statsCards}>
        <div className={styles.statCard}>
          <div className={styles.statInfo}>
            <div className={styles.statLabel}>要素库总数</div>
            <div className={styles.statValue}>{elementLibraryStats.total}</div>
          </div>
          <DatabaseOutlined className={styles.statIcon} style={{ color: '#1890ff' }} />
        </div>
        <div className={styles.statCard}>
          <div className={styles.statInfo}>
            <div className={styles.statLabel}>已发布</div>
            <div className={styles.statValue} style={{ color: '#52c41a' }}>{elementLibraryStats.published}</div>
          </div>
          <CheckCircleOutlined className={styles.statIcon} style={{ color: '#52c41a' }} />
        </div>
        <div className={styles.statCard}>
          <div className={styles.statInfo}>
            <div className={styles.statLabel}>未发布</div>
            <div className={styles.statValue} style={{ color: '#fa8c16' }}>{elementLibraryStats.draft}</div>
          </div>
          <FileTextOutlined className={styles.statIcon} style={{ color: '#fa8c16' }} />
        </div>
        <div className={styles.statCard}>
          <div className={styles.statInfo}>
            <div className={styles.statLabel}>要素总数</div>
            <div className={styles.statValue} style={{ color: '#722ed1' }}>{elementLibraryStats.elementCount}</div>
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
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
            新建要素库
          </Button>
        </div>
      </div>

      <div className={styles.libraryList}>
        {libraries.map((library, index) => (
          <div key={library.id} className={`${styles.listCard} ${index === 0 ? '' : index === 1 ? styles.purple : styles.orange}`}>
            <div className={styles.listCardHeader}>
              <div>
                <span className={styles.listCardTitle} onClick={() => navigate(`/home/balanced/elements/${library.id}`)}>
                  {library.name}
                </span>
                <Tag color={library.status === 'published' ? 'blue' : 'default'} style={{ marginLeft: 8 }}>
                  {library.status === 'published' ? '已发布' : '未发布'}
                </Tag>
                <span style={{ marginLeft: 8, color: '#666' }}>{library.elementCount} 个要素</span>
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
              {library.status === 'published' ? (
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
              )}
            </div>
          </div>
        ))}
      </div>

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
              {elements.slice(0, 5).map(el => (
                <div key={el.id} className={styles.elementItem}>
                  <span className={styles.elementCode}>{el.code}</span>
                  <span className={styles.elementName}>{el.name}</span>
                  <Tag>{el.type}</Tag>
                  <Tag>{el.dataType}</Tag>
                </div>
              ))}
            </div>
            <p style={{ color: '#1890ff', textAlign: 'center', marginTop: 16 }}>
              共 {selectedLibrary.elementCount} 个要素，显示最近 5 个
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ElementLibrary;
