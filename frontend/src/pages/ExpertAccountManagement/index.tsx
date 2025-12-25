import React, { useEffect, useState } from 'react';
import { Button, Form, Input, Modal, Select, Space, Table, Tag, message, Card } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, KeyOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import { createUser, deleteUser, getUsers, SystemUser, updateUser } from '../../services/userService';
import styles from './index.module.css';

const { Search } = Input;

const statusTag = (status: SystemUser['status']) => {
  if (status === 'active') return <Tag color="green">启用</Tag>;
  return <Tag color="default">停用</Tag>;
};

// 专家专业领域选项
const expertiseOptions = [
  { label: '教育督导', value: '教育督导' },
  { label: '学校管理', value: '学校管理' },
  { label: '教育教学', value: '教育教学' },
  { label: '课程设计', value: '课程设计' },
  { label: '师资培训', value: '师资培训' },
  { label: '教育评估', value: '教育评估' },
];

const ExpertAccountManagement: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [experts, setExperts] = useState<SystemUser[]>([]);
  const [keyword, setKeyword] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [current, setCurrent] = useState<SystemUser | null>(null);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [pwdForm] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      // 只获取专家角色的用户
      const list = await getUsers({ role: 'project_expert', keyword });
      setExperts(list);
    } catch (e: unknown) {
      message.error((e as Error).message || '加载专家列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const handleSearch = (value: string) => {
    setKeyword(value);
    setTimeout(() => load(), 0);
  };

  const openEdit = (u: SystemUser) => {
    setCurrent(u);
    editForm.setFieldsValue({
      name: u.name,
      organization: u.organization,
      status: u.status,
    });
    setEditOpen(true);
  };

  const openResetPassword = (u: SystemUser) => {
    setCurrent(u);
    pwdForm.resetFields();
    setPwdOpen(true);
  };

  const onCreate = async (values: {
    phone: string;
    password: string;
    name?: string;
    organization?: string;
    status?: SystemUser['status'];
  }) => {
    try {
      // 专家角色固定为 project_expert
      await createUser({ ...values, roles: ['project_expert'] });
      message.success('创建成功');
      setCreateOpen(false);
      createForm.resetFields();
      load();
    } catch (e: unknown) {
      message.error((e as Error).message || '创建失败');
    }
  };

  const onSaveEdit = async (values: {
    name?: string;
    organization?: string;
    status: SystemUser['status'];
  }) => {
    if (!current) return;
    try {
      await updateUser(current.phone, values);
      message.success('保存成功');
      setEditOpen(false);
      editForm.resetFields();
      setCurrent(null);
      load();
    } catch (e: unknown) {
      message.error((e as Error).message || '保存失败');
    }
  };

  const onResetPassword = async (values: { password: string }) => {
    if (!current) return;
    try {
      await updateUser(current.phone, { password: values.password });
      message.success('密码已重置');
      setPwdOpen(false);
      pwdForm.resetFields();
      setCurrent(null);
    } catch (e: unknown) {
      message.error((e as Error).message || '重置失败');
    }
  };

  const onDelete = (u: SystemUser) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除专家账号 "${u.name || u.phone}" 吗？`,
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteUser(u.phone);
          message.success('删除成功');
          load();
        } catch (e: unknown) {
          message.error((e as Error).message || '删除失败');
        }
      },
    });
  };


  const columns: ColumnsType<SystemUser> = [
    { title: '手机号', dataIndex: 'phone', key: 'phone', width: 130 },
    {
      title: '专家名称',
      dataIndex: 'name',
      key: 'name',
      width: 120,
      render: (name: string) => <span style={{ fontWeight: 500 }}>{name || '-'}</span>,
    },
    { title: '所属单位', dataIndex: 'organization', key: 'organization', width: 150 },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (s: SystemUser['status']) => statusTag(s),
    },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 150 },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_: unknown, record: SystemUser) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>
            编辑
          </Button>
          <Button type="link" size="small" icon={<KeyOutlined />} onClick={() => openResetPassword(record)}>
            重置密码
          </Button>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => onDelete(record)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <ArrowLeftOutlined className={styles.backBtn} onClick={() => navigate(-1)} />
        <h2 className={styles.pageTitle}>专家账号管理</h2>
      </div>

      <Card>
        <div className={styles.toolbar}>
          <div className={styles.filters}>
            <Search
              placeholder="搜索手机号/专家名称/单位"
              allowClear
              onSearch={handleSearch}
              style={{ width: 280 }}
            />
          </div>
          <div className={styles.actions}>
            <Button onClick={load}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
              新增专家
            </Button>
          </div>
        </div>

        <Table
          columns={columns}
          dataSource={experts}
          rowKey="phone"
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true, showQuickJumper: true }}
          scroll={{ x: 950 }}
        />
      </Card>

      {/* 新增专家 */}
      <Modal
        title="新增专家账号"
        open={createOpen}
        onCancel={() => {
          setCreateOpen(false);
          createForm.resetFields();
        }}
        footer={null}
        width={560}
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={onCreate}
          initialValues={{ status: 'active' }}
        >
          <Form.Item
            name="phone"
            label="手机号"
            rules={[
              { required: true, message: '请输入手机号' },
              { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号' }
            ]}
          >
            <Input placeholder="请输入11位手机号" maxLength={11} />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: '请输入密码' }, { min: 6, message: '密码至少 6 位' }]}
          >
            <Input.Password placeholder="请输入密码（至少6位）" />
          </Form.Item>
          <Form.Item name="name" label="专家名称" rules={[{ required: true, message: '请输入专家名称' }]}>
            <Input placeholder="请输入专家名称" />
          </Form.Item>
          <Form.Item name="organization" label="所属单位">
            <Input placeholder="请输入所属单位" />
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true, message: '请选择状态' }]}>
            <Select options={[{ label: '启用', value: 'active' }, { label: '停用', value: 'inactive' }]} />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => { setCreateOpen(false); createForm.resetFields(); }}>取消</Button>
              <Button type="primary" htmlType="submit">确认</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑专家 */}
      <Modal
        title={current ? `编辑专家：${current.name || current.phone}` : '编辑专家'}
        open={editOpen}
        onCancel={() => {
          setEditOpen(false);
          editForm.resetFields();
          setCurrent(null);
        }}
        footer={null}
        width={560}
      >
        <Form form={editForm} layout="vertical" onFinish={onSaveEdit}>
          <Form.Item name="name" label="专家名称">
            <Input placeholder="请输入专家名称" />
          </Form.Item>
          <Form.Item name="organization" label="所属单位">
            <Input placeholder="请输入所属单位" />
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true, message: '请选择状态' }]}>
            <Select options={[{ label: '启用', value: 'active' }, { label: '停用', value: 'inactive' }]} />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => { setEditOpen(false); editForm.resetFields(); setCurrent(null); }}>取消</Button>
              <Button type="primary" htmlType="submit">保存</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 重置密码 */}
      <Modal
        title={current ? `重置密码：${current.name || current.phone}` : '重置密码'}
        open={pwdOpen}
        onCancel={() => {
          setPwdOpen(false);
          pwdForm.resetFields();
          setCurrent(null);
        }}
        footer={null}
      >
        <Form form={pwdForm} layout="vertical" onFinish={onResetPassword}>
          <Form.Item
            name="password"
            label="新密码"
            rules={[{ required: true, message: '请输入新密码' }, { min: 2, message: '密码至少 2 位' }]}
          >
            <Input.Password placeholder="请输入新密码" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => { setPwdOpen(false); pwdForm.resetFields(); setCurrent(null); }}>取消</Button>
              <Button type="primary" htmlType="submit">确认</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ExpertAccountManagement;
