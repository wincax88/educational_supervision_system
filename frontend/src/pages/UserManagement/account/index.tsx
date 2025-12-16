import React, { useEffect, useMemo, useState } from 'react';
import { Button, Form, Input, Modal, Select, Space, Table, Tag, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, KeyOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import styles from './index.module.css';
import { createUser, deleteUser, getUsers, roleOptions, SystemUser, updateUser, ScopeItem } from '../../../services/userService';
import { getDistricts, District } from '../../../services/districtService';
import { getSchools, School } from '../../../services/schoolService';

const { Search } = Input;

const statusTag = (status: SystemUser['status']) => {
  if (status === 'active') return <Tag color="green">启用</Tag>;
  return <Tag color="default">停用</Tag>;
};

const roleTagColor: Record<SystemUser['role'], string> = {
  admin: 'red',
  project_manager: 'blue',
  collector: 'green',
  expert: 'orange',
  decision_maker: 'purple',
};

// 构建带分组的选项
interface ScopeOption {
  value: string;
  label: string;
  type: 'city' | 'district' | 'school';
  id: string;
  name: string;
}

const AccountManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [filters, setFilters] = useState<{ keyword: string; role: string; status: string }>({
    keyword: '',
    role: '',
    status: '',
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [current, setCurrent] = useState<SystemUser | null>(null);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [pwdForm] = Form.useForm();

  // 区县和学校数据
  const [districts, setDistricts] = useState<District[]>([]);
  const [schools, setSchools] = useState<School[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const list = await getUsers({
        keyword: filters.keyword,
        role: (filters.role as any) || '',
        status: (filters.status as any) || '',
      });
      setUsers(list);
    } catch (e: unknown) {
      message.error((e as Error).message || '加载用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    loadDistricts();
    loadSchools();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.role, filters.status]);

  const loadDistricts = async () => {
    try {
      const list = await getDistricts();
      setDistricts(list);
    } catch (e) {
      console.error('加载区县列表失败', e);
    }
  };

  const loadSchools = async () => {
    try {
      const response = await getSchools({ pageSize: 1000 });
      setSchools(response.list);
    } catch (e) {
      console.error('加载学校列表失败', e);
    }
  };

  const roleSelectOptions = useMemo(() => roleOptions, []);

  // 构建数据范围多选选项（带分组）
  const scopeOptions = useMemo(() => {
    const options: { label: string; options: ScopeOption[] }[] = [
      {
        label: '市级',
        options: [
          { value: 'city:shenyang', label: '沈阳市', type: 'city', id: 'shenyang', name: '沈阳市' },
        ],
      },
      {
        label: '区县',
        options: districts.map(d => ({
          value: `district:${d.id}`,
          label: d.name,
          type: 'district' as const,
          id: d.id,
          name: d.name,
        })),
      },
      {
        label: '学校',
        options: schools.map(s => ({
          value: `school:${s.id}`,
          label: s.name,
          type: 'school' as const,
          id: s.id,
          name: s.name,
        })),
      },
    ];
    return options;
  }, [districts, schools]);

  // 将选中的值转换为 ScopeItem 数组
  const valuesToScopes = (values: string[]): ScopeItem[] => {
    return values.map(v => {
      const [type, id] = v.split(':');
      let name = '';
      if (type === 'city') {
        name = '沈阳市';
      } else if (type === 'district') {
        name = districts.find(d => d.id === id)?.name || '';
      } else if (type === 'school') {
        name = schools.find(s => s.id === id)?.name || '';
      }
      return { type: type as ScopeItem['type'], id, name };
    });
  };

  // 将 ScopeItem 数组转换为选中的值
  const scopesToValues = (scopes: ScopeItem[]): string[] => {
    return scopes?.map(s => `${s.type}:${s.id}`) || [];
  };

  const handleSearch = (value: string) => {
    setFilters(prev => ({ ...prev, keyword: value }));
    setTimeout(() => load(), 0);
  };

  const openEdit = (u: SystemUser) => {
    setCurrent(u);
    editForm.setFieldsValue({
      role: u.role,
      roleName: u.roleName,
      status: u.status,
      scopes: scopesToValues(u.scopes),
    });
    setEditOpen(true);
  };

  const openResetPassword = (u: SystemUser) => {
    setCurrent(u);
    pwdForm.resetFields();
    setPwdOpen(true);
  };

  const onCreate = async (values: {
    username: string;
    password: string;
    role: SystemUser['role'];
    roleName?: string;
    status?: SystemUser['status'];
    scopes?: string[];
  }) => {
    try {
      const { scopes: scopeValues, ...rest } = values;
      const scopes = scopeValues ? valuesToScopes(scopeValues) : [];
      await createUser({ ...rest, scopes });
      message.success('创建成功');
      setCreateOpen(false);
      createForm.resetFields();
      load();
    } catch (e: unknown) {
      message.error((e as Error).message || '创建失败');
    }
  };

  const onSaveEdit = async (values: {
    role: SystemUser['role'];
    roleName: string;
    status: SystemUser['status'];
    scopes?: string[];
  }) => {
    if (!current) return;
    try {
      const { scopes: scopeValues, ...rest } = values;
      const scopes = scopeValues ? valuesToScopes(scopeValues) : [];
      await updateUser(current.username, { ...rest, scopes });
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
      await updateUser(current.username, { password: values.password });
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
      content: `确定要删除用户 "${u.username}" 吗？`,
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteUser(u.username);
          message.success('删除成功');
          load();
        } catch (e: unknown) {
          message.error((e as Error).message || '删除失败');
        }
      },
    });
  };

  // 渲染数据范围标签
  const renderScopes = (scopes: ScopeItem[]) => {
    if (!scopes || scopes.length === 0) return '-';

    const typeColors: Record<string, string> = {
      city: 'purple',
      district: 'blue',
      school: 'green',
    };

    // 最多显示3个，超出显示 +N
    const displayScopes = scopes.slice(0, 3);
    const remaining = scopes.length - 3;

    return (
      <Space size={[0, 4]} wrap>
        {displayScopes.map((s, i) => (
          <Tag key={i} color={typeColors[s.type] || 'default'}>{s.name}</Tag>
        ))}
        {remaining > 0 && <Tag>+{remaining}</Tag>}
      </Space>
    );
  };

  const columns: ColumnsType<SystemUser> = [
    { title: '用户名', dataIndex: 'username', key: 'username', width: 120 },
    {
      title: '角色',
      dataIndex: 'roleName',
      key: 'roleName',
      width: 120,
      render: (_: unknown, record: SystemUser) => (
        <Tag color={roleTagColor[record.role] || 'default'}>{record.roleName}</Tag>
      ),
    },
    {
      title: '数据范围',
      dataIndex: 'scopes',
      key: 'scopes',
      width: 280,
      render: (scopes: ScopeItem[]) => renderScopes(scopes),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (s: SystemUser['status']) => statusTag(s),
    },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 120 },
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
    <div className={styles.accountManagement}>
      <div className={styles.listSection}>
        <div className={styles.listHeader}>
          <h3>账号列表</h3>
          <div className={styles.filters}>
            <Select
              style={{ width: 160 }}
              placeholder="角色筛选"
              allowClear
              value={filters.role || undefined}
              options={roleSelectOptions}
              onChange={(v) => setFilters(prev => ({ ...prev, role: v || '' }))}
            />
            <Select
              style={{ width: 120 }}
              placeholder="状态筛选"
              allowClear
              value={filters.status || undefined}
              options={[
                { label: '启用', value: 'active' },
                { label: '停用', value: 'inactive' },
              ]}
              onChange={(v) => setFilters(prev => ({ ...prev, status: v || '' }))}
            />
            <Search
              placeholder="搜索用户名/角色名称"
              allowClear
              onSearch={handleSearch}
              style={{ width: 260 }}
            />
          </div>
          <div className={styles.actions}>
            <Button onClick={load}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
              新增账号
            </Button>
          </div>
        </div>

        <Table
          columns={columns}
          dataSource={users}
          rowKey="username"
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true, showQuickJumper: true }}
          scroll={{ x: 980 }}
        />
      </div>

      {/* 新增账号 */}
      <Modal
        title="新增账号"
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
          initialValues={{ status: 'active', role: 'project_manager' }}
        >
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input placeholder="请输入用户名" />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: '请输入密码' }, { min: 2, message: '密码至少 2 位' }]}
          >
            <Input.Password placeholder="请输入密码" />
          </Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true, message: '请选择角色' }]}>
            <Select options={roleSelectOptions} />
          </Form.Item>
          <Form.Item name="roleName" label="角色名称（可选）">
            <Input placeholder="不填则使用默认角色名称" />
          </Form.Item>
          <Form.Item name="scopes" label="数据范围" rules={[{ required: true, message: '请选择数据范围' }]}>
            <Select
              mode="multiple"
              placeholder="请选择数据范围（可多选）"
              options={scopeOptions}
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
              }
              maxTagCount="responsive"
              style={{ width: '100%' }}
            />
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

      {/* 编辑账号 */}
      <Modal
        title={current ? `编辑账号：${current.username}` : '编辑账号'}
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
          <Form.Item name="role" label="角色" rules={[{ required: true, message: '请选择角色' }]}>
            <Select options={roleSelectOptions} />
          </Form.Item>
          <Form.Item name="roleName" label="角色名称" rules={[{ required: true, message: '请输入角色名称' }]}>
            <Input placeholder="请输入角色名称" />
          </Form.Item>
          <Form.Item name="scopes" label="数据范围" rules={[{ required: true, message: '请选择数据范围' }]}>
            <Select
              mode="multiple"
              placeholder="请选择数据范围（可多选）"
              options={scopeOptions}
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
              }
              maxTagCount="responsive"
              style={{ width: '100%' }}
            />
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
        title={current ? `重置密码：${current.username}` : '重置密码'}
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

export default AccountManagement;
