import React, { useEffect, useMemo, useState } from 'react';
import { Button, Form, Input, Modal, Select, Space, Table, Tag, message, Upload, Alert } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, KeyOutlined, UploadOutlined, DownloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { UploadFile } from 'antd/es/upload';
import styles from './index.module.css';
import { createUser, deleteUser, getUsers, roleOptions, allRoleOptions, roleDisplayNames, SystemUser, updateUser, ScopeItem, UserRole, importUsers, ImportUserData } from '../../../services/userService';
import { getDistricts, District } from '../../../services/districtService';
import { getSchools, School } from '../../../services/schoolService';

// 角色代码映射（CSV中使用的角色代码 -> 系统角色）
const roleCodeMap: Record<string, UserRole> = {
  admin: 'admin',
  city_admin: 'city_admin',
  district_admin: 'district_admin',
  district_reporter: 'district_reporter',
  school_reporter: 'school_reporter',
  expert: 'expert',
  // 中文映射
  '系统管理员': 'admin',
  '市级管理员': 'city_admin',
  '区县管理员': 'district_admin',
  '区县填报员': 'district_reporter',
  '学校填报员': 'school_reporter',
  '评估专家': 'expert',
  // 新角色体系兼容
  project_admin: 'admin',
  data_collector: 'district_reporter',
  project_expert: 'expert',
  '项目管理员': 'admin',
  '数据采集员': 'district_reporter',
  '项目评估专家': 'expert',
};

const { Search } = Input;

const statusTag = (status: SystemUser['status']) => {
  if (status === 'active') return <Tag color="green">启用</Tag>;
  return <Tag color="default">停用</Tag>;
};

const roleTagColor: Record<UserRole, string> = {
  admin: 'red',
  city_admin: 'purple',
  district_admin: 'blue',
  district_reporter: 'cyan',
  school_reporter: 'green',
  expert: 'gold',
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

  // 导入相关状态
  const [importOpen, setImportOpen] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importData, setImportData] = useState<ImportUserData[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [fileList, setFileList] = useState<UploadFile[]>([]);

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
      roles: u.roles,
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
    roles: UserRole[];
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
    roles: UserRole[];
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

  // 解析CSV文件
  const parseCSV = (text: string): ImportUserData[] => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim());
    const usernameIdx = headers.findIndex(h => h === '用户名' || h === 'username');
    const passwordIdx = headers.findIndex(h => h === '密码' || h === 'password');
    const rolesIdx = headers.findIndex(h => h === '角色' || h === 'roles' || h === 'role');
    const statusIdx = headers.findIndex(h => h === '状态' || h === 'status');

    if (usernameIdx === -1 || passwordIdx === -1) {
      throw new Error('CSV文件必须包含"用户名"和"密码"列');
    }

    const result: ImportUserData[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      if (!values[usernameIdx] || !values[passwordIdx]) continue;

      // 解析角色
      let roles: UserRole[] = ['school_reporter'];
      if (rolesIdx !== -1 && values[rolesIdx]) {
        const roleStr = values[rolesIdx];
        const mappedRole = roleCodeMap[roleStr];
        if (mappedRole) {
          roles = [mappedRole];
        }
      }

      // 解析状态
      let status: 'active' | 'inactive' = 'active';
      if (statusIdx !== -1 && values[statusIdx]) {
        const statusStr = values[statusIdx].toLowerCase();
        if (statusStr === 'inactive' || statusStr === '停用') {
          status = 'inactive';
        }
      }

      result.push({
        username: values[usernameIdx],
        password: values[passwordIdx],
        roles,
        status,
      });
    }

    return result;
  };

  // 处理文件上传
  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const data = parseCSV(text);
        if (data.length === 0) {
          setImportErrors(['CSV文件为空或格式不正确']);
          setImportData([]);
        } else {
          setImportData(data);
          setImportErrors([]);
        }
      } catch (err) {
        setImportErrors([(err as Error).message]);
        setImportData([]);
      }
    };
    reader.readAsText(file, 'UTF-8');
    return false; // 阻止自动上传
  };

  // 执行导入
  const handleImport = async () => {
    if (importData.length === 0) {
      message.warning('没有可导入的数据');
      return;
    }

    setImportLoading(true);
    try {
      const result = await importUsers(importData);
      if (result.success > 0) {
        message.success(`成功导入 ${result.success} 个账号`);
      }
      if (result.failed > 0) {
        setImportErrors(result.errors);
      } else {
        setImportOpen(false);
        setImportData([]);
        setFileList([]);
        setImportErrors([]);
      }
      load();
    } catch (e: unknown) {
      message.error((e as Error).message || '导入失败');
    } finally {
      setImportLoading(false);
    }
  };

  // 下载模板
  const downloadTemplate = () => {
    const template = `用户名,密码,角色,状态
admin_zhang,Pass@123456,admin,active
collector_wang,Pass@123456,school_reporter,active
expert_zhou,Pass@123456,expert,active`;
    const blob = new Blob(['\ufeff' + template], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'users_import_template.csv';
    link.click();
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
      dataIndex: 'roles',
      key: 'roles',
      width: 200,
      render: (roles: UserRole[]) => (
        <Space size={[0, 4]} wrap>
          {(roles || []).map(role => (
            <Tag key={role} color={roleTagColor[role] || 'default'}>
              {roleDisplayNames[role] || role}
            </Tag>
          ))}
        </Space>
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
              options={allRoleOptions}
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
            <Button icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>
              批量导入
            </Button>
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
          initialValues={{ status: 'active', roles: ['school_reporter'] }}
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
          <Form.Item name="roles" label="角色" rules={[{ required: true, message: '请选择角色' }]}>
            <Select
              mode="multiple"
              placeholder="请选择角色（可多选）"
              options={roleOptions}
              maxTagCount="responsive"
            />
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
          <Form.Item name="roles" label="角色" rules={[{ required: true, message: '请选择角色' }]}>
            <Select
              mode="multiple"
              placeholder="请选择角色（可多选）"
              options={roleOptions}
              maxTagCount="responsive"
            />
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

      {/* 批量导入 */}
      <Modal
        title="批量导入账号"
        open={importOpen}
        onCancel={() => {
          setImportOpen(false);
          setImportData([]);
          setFileList([]);
          setImportErrors([]);
        }}
        footer={null}
        width={640}
      >
        <div style={{ marginBottom: 16 }}>
          <Alert
            type="info"
            showIcon
            message="CSV文件格式说明"
            description={
              <div>
                <p style={{ margin: '4px 0' }}>文件必须包含以下列：<strong>用户名</strong>、<strong>密码</strong></p>
                <p style={{ margin: '4px 0' }}>可选列：<strong>角色</strong>（admin/school_reporter/expert等）、<strong>状态</strong>（active/inactive）</p>
                <Button
                  type="link"
                  size="small"
                  icon={<DownloadOutlined />}
                  onClick={downloadTemplate}
                  style={{ padding: 0 }}
                >
                  下载模板文件
                </Button>
              </div>
            }
          />
        </div>

        <Upload.Dragger
          accept=".csv"
          fileList={fileList}
          beforeUpload={(file) => {
            setFileList([file]);
            handleFileUpload(file);
            return false;
          }}
          onRemove={() => {
            setFileList([]);
            setImportData([]);
            setImportErrors([]);
          }}
          maxCount={1}
        >
          <p className="ant-upload-drag-icon">
            <UploadOutlined style={{ fontSize: 48, color: '#1890ff' }} />
          </p>
          <p className="ant-upload-text">点击或拖拽CSV文件到此处</p>
          <p className="ant-upload-hint">仅支持 .csv 格式文件</p>
        </Upload.Dragger>

        {importData.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <Alert
              type="success"
              showIcon
              message={`已解析 ${importData.length} 条账号数据`}
              description={
                <Table
                  size="small"
                  dataSource={importData.slice(0, 5)}
                  rowKey="username"
                  pagination={false}
                  columns={[
                    { title: '用户名', dataIndex: 'username', width: 120 },
                    {
                      title: '角色',
                      dataIndex: 'roles',
                      render: (roles: UserRole[]) => (
                        <Space>
                          {roles.map(r => (
                            <Tag key={r} color={roleTagColor[r]}>{roleDisplayNames[r]}</Tag>
                          ))}
                        </Space>
                      ),
                    },
                    {
                      title: '状态',
                      dataIndex: 'status',
                      width: 80,
                      render: (s: string) => statusTag(s as SystemUser['status']),
                    },
                  ]}
                />
              }
            />
            {importData.length > 5 && (
              <p style={{ color: '#999', marginTop: 8, fontSize: 12 }}>
                ... 还有 {importData.length - 5} 条数据未显示
              </p>
            )}
          </div>
        )}

        {importErrors.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <Alert
              type="error"
              showIcon
              message="导入错误"
              description={
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {importErrors.slice(0, 5).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                  {importErrors.length > 5 && <li>... 还有 {importErrors.length - 5} 条错误</li>}
                </ul>
              }
            />
          </div>
        )}

        <div style={{ marginTop: 24, textAlign: 'right' }}>
          <Space>
            <Button onClick={() => {
              setImportOpen(false);
              setImportData([]);
              setFileList([]);
              setImportErrors([]);
            }}>
              取消
            </Button>
            <Button
              type="primary"
              onClick={handleImport}
              loading={importLoading}
              disabled={importData.length === 0}
            >
              确认导入 ({importData.length})
            </Button>
          </Space>
        </div>
      </Modal>
    </div>
  );
};

export default AccountManagement;
