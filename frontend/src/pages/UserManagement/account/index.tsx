import React, { useEffect, useState } from 'react';
import { Button, Form, Input, Modal, Select, Space, Table, Tag, message, Upload, Alert } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, KeyOutlined, UploadOutlined, DownloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { UploadFile } from 'antd/es/upload';
import styles from './index.module.css';
import { createUser, deleteUser, getUsers, roleOptions, allRoleOptions, roleDisplayNames, SystemUser, updateUser, UserRole, importUsers, ImportUserData } from '../../../services/userService';

// 角色代码映射（CSV中使用的角色代码 -> 系统角色）
const roleCodeMap: Record<string, UserRole> = {
  admin: 'admin',
  project_admin: 'project_admin',
  data_collector: 'data_collector',
  project_expert: 'project_expert',
  decision_maker: 'decision_maker',
  // 中文映射
  '系统管理员': 'admin',
  '项目管理员': 'project_admin',
  '数据采集员': 'data_collector',
  '项目专家': 'project_expert',
  '决策者': 'decision_maker',
  // 旧角色兼容映射
  city_admin: 'project_admin',
  district_admin: 'project_admin',
  district_reporter: 'data_collector',
  school_reporter: 'data_collector',
  expert: 'project_expert',
  '市级管理员': 'project_admin',
  '区县管理员': 'project_admin',
  '区县填报员': 'data_collector',
  '学校填报员': 'data_collector',
  '评估专家': 'project_expert',
};

const { Search } = Input;

const statusTag = (status: SystemUser['status']) => {
  if (status === 'active') return <Tag color="green">启用</Tag>;
  return <Tag color="default">停用</Tag>;
};

const roleTagColor: Record<UserRole, string> = {
  admin: 'red',
  project_admin: 'purple',
  data_collector: 'blue',
  project_expert: 'gold',
  decision_maker: 'green',
};

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
  const [importErrors, setImportErrors] = useState<(string | { phone?: string; error: string })[]>([]);
  const [fileList, setFileList] = useState<UploadFile[]>([]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.role, filters.status]);


  const handleSearch = (value: string) => {
    setFilters(prev => ({ ...prev, keyword: value }));
    setTimeout(() => load(), 0);
  };

  const openEdit = (u: SystemUser) => {
    setCurrent(u);
    editForm.setFieldsValue({
      name: u.name,
      organization: u.organization,
      idCard: u.idCard,
      roles: u.roles,
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
    idCard?: string;
    roles: UserRole[];
    status?: SystemUser['status'];
  }) => {
    try {
      await createUser(values);
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
    idCard?: string;
    roles: UserRole[];
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
      content: `确定要删除用户 "${u.name || u.phone}" 吗？`,
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

  // 解析CSV文件
  const parseCSV = (text: string): ImportUserData[] => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim());
    const phoneIdx = headers.findIndex(h => h === '手机号' || h === 'phone');
    const passwordIdx = headers.findIndex(h => h === '密码' || h === 'password');
    const nameIdx = headers.findIndex(h => h === '姓名' || h === 'name');
    const organizationIdx = headers.findIndex(h => h === '单位' || h === '所属单位' || h === 'organization');
    const idCardIdx = headers.findIndex(h => h === '身份证号' || h === 'idCard' || h === 'id_card');
    const rolesIdx = headers.findIndex(h => h === '角色' || h === 'roles' || h === 'role');
    const statusIdx = headers.findIndex(h => h === '状态' || h === 'status');

    if (phoneIdx === -1 || passwordIdx === -1) {
      throw new Error('CSV文件必须包含"手机号"和"密码"列');
    }

    const result: ImportUserData[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      if (!values[phoneIdx] || !values[passwordIdx]) continue;

      // 解析角色
      let roles: UserRole[] = ['data_collector'];
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
        phone: values[phoneIdx],
        password: values[passwordIdx],
        name: nameIdx !== -1 ? values[nameIdx] : undefined,
        organization: organizationIdx !== -1 ? values[organizationIdx] : undefined,
        idCard: idCardIdx !== -1 ? values[idCardIdx] : undefined,
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
    const template = `手机号,密码,姓名,单位,角色,状态
13800000001,Pass@123456,张管理员,教育局,admin,active
13800000002,Pass@123456,李项目经理,实验中学,project_admin,active
13800000003,Pass@123456,王采集员,第一小学,data_collector,active
13800000004,Pass@123456,赵专家,教科院,project_expert,active
13800000005,Pass@123456,周局长,教育局,decision_maker,active`;
    const blob = new Blob(['\ufeff' + template], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'users_import_template.csv';
    link.click();
  };


  const columns: ColumnsType<SystemUser> = [
    { title: '手机号', dataIndex: 'phone', key: 'phone', width: 130 },
    { title: '姓名', dataIndex: 'name', key: 'name', width: 100 },
    { title: '所属单位', dataIndex: 'organization', key: 'organization', width: 150 },
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
              placeholder="搜索手机号/姓名/单位"
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
          rowKey="phone"
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
          initialValues={{ status: 'active', roles: ['data_collector'] }}
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
          <Form.Item name="name" label="姓名">
            <Input placeholder="请输入姓名" />
          </Form.Item>
          <Form.Item name="organization" label="所属单位">
            <Input placeholder="请输入所属单位" />
          </Form.Item>
          <Form.Item name="idCard" label="身份证号">
            <Input placeholder="请输入身份证号" maxLength={18} />
          </Form.Item>
          <Form.Item name="roles" label="角色" rules={[{ required: true, message: '请选择角色' }]}>
            <Select
              mode="multiple"
              placeholder="请选择角色（可多选）"
              options={roleOptions}
              maxTagCount="responsive"
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
        title={current ? `编辑账号：${current.name || current.phone}` : '编辑账号'}
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
          <Form.Item name="name" label="姓名">
            <Input placeholder="请输入姓名" />
          </Form.Item>
          <Form.Item name="organization" label="所属单位">
            <Input placeholder="请输入所属单位" />
          </Form.Item>
          <Form.Item name="idCard" label="身份证号">
            <Input placeholder="请输入身份证号" maxLength={18} />
          </Form.Item>
          <Form.Item name="roles" label="角色" rules={[{ required: true, message: '请选择角色' }]}>
            <Select
              mode="multiple"
              placeholder="请选择角色（可多选）"
              options={roleOptions}
              maxTagCount="responsive"
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
                <p style={{ margin: '4px 0' }}>文件必须包含以下列：<strong>手机号</strong>、<strong>密码</strong></p>
                <p style={{ margin: '4px 0' }}>可选列：<strong>姓名</strong>、<strong>单位</strong>、<strong>身份证号</strong>、<strong>角色</strong>（admin/project_admin/data_collector/project_expert/decision_maker）、<strong>状态</strong>（active/inactive）</p>
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
                  rowKey="phone"
                  pagination={false}
                  columns={[
                    { title: '手机号', dataIndex: 'phone', width: 120 },
                    { title: '姓名', dataIndex: 'name', width: 80 },
                    { title: '单位', dataIndex: 'organization', width: 100 },
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
                      width: 60,
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
                  {importErrors.slice(0, 5).map((err, i) => {
                    // 处理错误对象或字符串
                    const errorText = typeof err === 'string' 
                      ? err 
                      : err.phone 
                        ? `${err.phone}: ${err.error}` 
                        : err.error;
                    return <li key={i}>{errorText}</li>;
                  })}
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
