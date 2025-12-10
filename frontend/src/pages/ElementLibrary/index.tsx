import React, { useState } from 'react';
import { Button, Input, Tag, Modal, Form, message } from 'antd';
import {
  ArrowLeftOutlined,
  PlusOutlined,
  DatabaseOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  AppstoreOutlined,
  EyeOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { elementLibraries, elementLibraryStats, elements } from '../../mock/data';
import './index.css';

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

  return (
    <div className="element-library-page">
      <div className="page-header">
        <span className="back-btn" onClick={() => navigate('/home/balanced')}>
          <ArrowLeftOutlined /> 返回
        </span>
        <h1 className="page-title">评估要素库主页</h1>
      </div>

      <div className="stats-cards">
        <div className="stat-card">
          <div className="stat-info">
            <div className="stat-label">要素库总数</div>
            <div className="stat-value">{elementLibraryStats.total}</div>
          </div>
          <DatabaseOutlined className="stat-icon" style={{ color: '#1890ff' }} />
        </div>
        <div className="stat-card">
          <div className="stat-info">
            <div className="stat-label">已发布</div>
            <div className="stat-value" style={{ color: '#52c41a' }}>{elementLibraryStats.published}</div>
          </div>
          <CheckCircleOutlined className="stat-icon" style={{ color: '#52c41a' }} />
        </div>
        <div className="stat-card">
          <div className="stat-info">
            <div className="stat-label">未发布</div>
            <div className="stat-value" style={{ color: '#fa8c16' }}>{elementLibraryStats.draft}</div>
          </div>
          <FileTextOutlined className="stat-icon" style={{ color: '#fa8c16' }} />
        </div>
        <div className="stat-card">
          <div className="stat-info">
            <div className="stat-label">要素总数</div>
            <div className="stat-value" style={{ color: '#722ed1' }}>{elementLibraryStats.elementCount}</div>
          </div>
          <AppstoreOutlined className="stat-icon" style={{ color: '#722ed1' }} />
        </div>
      </div>

      <div className="list-header">
        <h3>评估要素库列表</h3>
        <div className="list-actions">
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

      <div className="library-list">
        {libraries.map((library, index) => (
          <div key={library.id} className={`list-card ${index === 0 ? '' : index === 1 ? 'purple' : 'orange'}`}>
            <div className="list-card-header">
              <div>
                <span className="list-card-title" onClick={() => navigate(`/home/balanced/elements/${library.id}`)}>
                  {library.name}
                </span>
                <Tag color={library.status === 'published' ? 'blue' : 'default'} style={{ marginLeft: 8 }}>
                  {library.status === 'published' ? '已发布' : '未发布'}
                </Tag>
                <span style={{ marginLeft: 8, color: '#666' }}>{library.elementCount} 个要素</span>
              </div>
              <div className="list-card-meta">
                <div>创建人: {library.createdBy}</div>
                <div>创建时间: {library.createdAt}</div>
                <div>变更人: {library.updatedBy}</div>
                <div>变更时间: {library.updatedAt}</div>
              </div>
            </div>
            <div className="list-card-desc">{library.description}</div>
            <div className="list-card-actions">
              <span className="action-btn" onClick={() => handleShowInfo(library)}>
                <EyeOutlined /> 基础信息
              </span>
              {library.status === 'published' ? (
                <span className="action-btn">
                  <CloseOutlined /> 取消发布
                </span>
              ) : (
                <>
                  <span className="action-btn" onClick={() => navigate(`/home/balanced/elements/${library.id}/edit`)}>
                    编辑要素
                  </span>
                  <span className="action-btn">发布</span>
                  <span className="action-btn danger">删除</span>
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
          <div className="info-modal-content">
            <div className="info-header">
              <h3>{selectedLibrary.name}</h3>
              <Tag color={selectedLibrary.status === 'published' ? 'blue' : 'default'}>
                {selectedLibrary.status === 'published' ? '已发布' : '未发布'}
              </Tag>
            </div>
            <div className="info-meta">
              创建人: {selectedLibrary.createdBy} &nbsp;&nbsp;
              创建时间: {selectedLibrary.createdAt} &nbsp;&nbsp;
              变更人: {selectedLibrary.updatedBy} &nbsp;&nbsp;
              变更时间: {selectedLibrary.updatedAt}
            </div>
            <p className="info-desc">{selectedLibrary.description}</p>
            <h4>数据要素（最近5个）</h4>
            <div className="element-list">
              {elements.slice(0, 5).map(el => (
                <div key={el.id} className="element-item">
                  <span className="element-code">{el.code}</span>
                  <span className="element-name">{el.name}</span>
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
