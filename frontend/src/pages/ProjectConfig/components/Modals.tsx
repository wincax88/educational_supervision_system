/**
 * 项目配置页面弹窗组件集合
 */

import React, { useState, useCallback } from 'react';
import { Modal, Form, Input, Select, Button, Upload, Table, Space, Tag, Checkbox, message, Alert, Spin } from 'antd';
import type { FormInstance, UploadFile } from 'antd';
import {
  SearchOutlined,
  UploadOutlined,
  FileTextOutlined,
  FileExcelOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import * as XLSX from 'xlsx';
import type { ColumnsType } from 'antd/es/table';
import type {
  Personnel,
  ImportRecord,
  ImportStatus,
  SampleDataConfig,
  RoleInfo,
  ImportStatusInfo,
  PersonnelFormValues,
  SampleFormValues,
  TeacherFormValues,
} from '../types';
import type { ImportFilter } from '../hooks';
import styles from '../index.module.css';

// 角色定义（新角色体系）
// | 角色 | 代码 | 职责 | 权限范围 |
// | 项目管理员 | project_admin | 项目配置和管理 | 配置项目、管理人员、查看进度、生成报表 |
// | 数据采集员 | data_collector | 数据填报和采集 | 填报所属区县内所有学校的数据 |
// | 项目评估专家 | project_expert | 项目评审和评估 | 审核提交的数据、评审评估结果 |

// 获取角色显示名和描述
const getRoleInfo = (role: string): RoleInfo => {
  const roleMap: Record<string, RoleInfo> = {
    // 新角色体系
    'project_admin': { name: '项目管理员', desc: '项目配置和管理，配置项目、管理人员、查看进度' },
    'data_collector': { name: '数据采集员', desc: '数据填报和采集，填报所属区县内所有学校的数据' },
    'project_expert': { name: '项目评估专家', desc: '数据审核和评估，审核提交的数据、评审评估结果' },
    // 保留旧角色兼容
    'system_admin': { name: '系统管理员', desc: '省级/国家级，创建/维护工具模板、项目全局配置' },
    'city_admin': { name: '市级管理员', desc: '市级，查看区县进度，不可编辑数据' },
    'district_admin': { name: '区县管理员', desc: '区县，审核本区县所有学校数据、退回修改' },
    'district_reporter': { name: '区县填报员', desc: '区县，填报区县级采集工具数据' },
    'school_reporter': { name: '学校填报员', desc: '学校，仅编辑本校原始要素' },
  };
  return roleMap[role] || { name: role, desc: '' };
};

// 获取导入状态信息
const getImportStatusInfo = (status: ImportStatus): ImportStatusInfo => {
  const statusMap: Record<ImportStatus, ImportStatusInfo> = {
    'confirmed': { text: '已确认', color: 'success', icon: '✓' },
    'new': { text: '新用户', color: 'processing', icon: '⊕' },
    'name_conflict': { text: '重名冲突', color: 'warning', icon: '⚠' },
    'id_conflict': { text: '身份证冲突', color: 'warning', icon: '⚠' },
    'phone_conflict': { text: '手机冲突', color: 'warning', icon: '⚠' },
  };
  return statusMap[status];
};

// ==================== 添加人员弹窗 ====================

interface SystemUserOption {
  phone: string;
  name?: string;
  roles: string[];  // 支持多角色
  status: string;
}

// 可选组织类型
interface AvailableOrganization {
  id: string;
  name: string;
  type: 'district' | 'school';
  districtName?: string;  // 学校所属区县名称
}

// 区县选项（用于数据采集员选择负责区县）
interface DistrictOption {
  id: string;
  name: string;
}

interface AddPersonModalProps {
  visible: boolean;
  onCancel: () => void;
  onSubmit: (values: PersonnelFormValues) => void;
  onBatchSubmit?: (users: SystemUserOption[], role: string, districtId?: string) => void;  // 批量添加
  form: FormInstance;
  userList?: SystemUserOption[];
  loadingUsers?: boolean;
  presetRole?: string;  // 预设角色（从角色标题行点击时传入）
  availableOrganizations?: AvailableOrganization[];  // 可选的组织列表（来自填报学校配置）
  availableDistricts?: DistrictOption[];  // 可选的区县列表（数据采集员使用）
}

// 系统角色到人员角色的映射（一对一，保持一致）
const systemRoleToPersonnelRole: Record<string, string> = {
  // 新角色映射
  project_admin: 'project_admin',
  data_collector: 'data_collector',
  project_expert: 'project_expert',
  // 保留旧角色兼容
  admin: 'system_admin',
  city_admin: 'city_admin',
  district_admin: 'district_admin',
  school_reporter: 'school_reporter',
};

// 人员角色到系统角色的映射（用于筛选）
const personnelRoleToSystemRoles: Record<string, string[]> = {
  // 新角色映射
  project_admin: ['project_admin', 'admin'],
  data_collector: ['data_collector'],
  project_expert: ['project_expert'],
  // 保留旧角色兼容
  system_admin: ['admin'],
  city_admin: ['city_admin'],
  district_admin: ['district_admin'],
  school_reporter: ['school_reporter'],
};

// 人员配置角色显示名称
const roleDisplayNames: Record<string, string> = {
  // 新角色体系
  project_admin: '项目管理员',
  data_collector: '数据采集员',
  project_expert: '项目评估专家',
  // 保留旧角色兼容
  system_admin: '系统管理员',
  city_admin: '市级管理员',
  district_admin: '区县管理员',
  district_reporter: '区县填报员',
  school_reporter: '学校填报员',
};

// 系统角色显示名称（用于下拉选项）
const systemRoleDisplayNames: Record<string, string> = {
  // 新角色体系
  project_admin: '项目管理员',
  data_collector: '数据采集员',
  project_expert: '项目评估专家',
  // 保留旧角色兼容
  admin: '系统管理员',
  city_admin: '市级管理员',
  district_admin: '区县管理员',
  school_reporter: '学校填报员',
};

// 获取用户角色的显示文本
const getUserRoleDisplay = (roles: string[]): string => {
  if (!roles || roles.length === 0) return '';
  return roles.map(r => systemRoleDisplayNames[r] || r).join('、');
};

export const AddPersonModal: React.FC<AddPersonModalProps> = ({
  visible,
  onCancel,
  onSubmit,
  onBatchSubmit,
  form,
  userList = [],
  loadingUsers = false,
  presetRole,
  availableOrganizations = [],
  availableDistricts = [],
}) => {
  const [selectMode, setSelectMode] = React.useState<'select' | 'manual'>('select');
  const [selectedUsers, setSelectedUsers] = React.useState<string[]>([]);
  const [selectedRole, setSelectedRole] = React.useState<string>(presetRole || '');
  const [selectedDistrictId, setSelectedDistrictId] = React.useState<string>('');

  // 根据预设角色过滤可选组织
  const filteredOrganizations = React.useMemo(() => {
    if (!presetRole || availableOrganizations.length === 0) return [];

    // 区县填报员只能选区县
    if (presetRole === 'district_reporter') {
      return availableOrganizations.filter(org => org.type === 'district');
    }
    // 学校填报员只能选学校
    if (presetRole === 'school_reporter') {
      return availableOrganizations.filter(org => org.type === 'school');
    }
    // 其他角色不限制
    return [];
  }, [presetRole, availableOrganizations]);

  // 重置状态
  React.useEffect(() => {
    if (visible) {
      setSelectedUsers([]);
      setSelectedDistrictId('');
      if (presetRole) {
        setSelectMode('select');
        setSelectedRole(presetRole);
        form.setFieldsValue({ role: presetRole });
      }
    }
  }, [visible, presetRole, form]);

  // 过滤出可用的账号（状态为 active，且匹配角色）
  const filteredUsers = React.useMemo(() => {
    let users = userList.filter(u => u.status === 'active');

    // 如果有预设角色，按角色筛选
    if (presetRole) {
      const allowedSystemRoles = personnelRoleToSystemRoles[presetRole] || [];
      if (allowedSystemRoles.length > 0) {
        // 检查用户的任意角色是否在允许的角色列表中
        users = users.filter(u => (u.roles || []).some(r => allowedSystemRoles.includes(r)));
      }
    }

    return users;
  }, [userList, presetRole]);

  // 处理批量选择确认
  const handleBatchConfirm = () => {
    if (selectedUsers.length === 0) {
      return;
    }
    // 数据采集员必须选择负责的区县
    if (presetRole === 'data_collector' && !selectedDistrictId) {
      message.warning('请选择负责的区县');
      return;
    }
    const selectedUserObjects = filteredUsers.filter(u => selectedUsers.includes(u.phone));
    if (onBatchSubmit && presetRole) {
      onBatchSubmit(selectedUserObjects, presetRole, selectedDistrictId || undefined);
    }
  };

  // 重置表单和模式
  const handleCancel = () => {
    setSelectMode('select');
    setSelectedUsers([]);
    setSelectedDistrictId('');
    setSelectedRole('');
    onCancel();
  };

  // 弹窗标题
  const modalTitle = presetRole
    ? `添加${roleDisplayNames[presetRole] || '人员'}`
    : '添加人员';

  return (
    <Modal
      title={modalTitle}
      open={visible}
      onCancel={handleCancel}
      footer={presetRole ? [
        <Button key="cancel" onClick={handleCancel}>取消</Button>,
        <Button
          key="submit"
          type="primary"
          onClick={handleBatchConfirm}
          disabled={selectedUsers.length === 0}
        >
          确定添加 {selectedUsers.length > 0 && `(${selectedUsers.length}人)`}
        </Button>,
      ] : null}
      width={560}
    >
      {presetRole ? (
        // 从角色标题行点击进入：直接显示多选账号列表
        <>
          <p className={styles.modalSubtitle}>
            {presetRole === 'expert'
              ? '从专家库中选择要添加的评估专家（支持多选）'
              : `从已有账号中选择要添加的${roleDisplayNames[presetRole] || '人员'}（支持多选）`
            }
          </p>
          <Select
            mode="multiple"
            placeholder={presetRole === 'expert' ? '请选择专家（可多选）' : '请选择账号（可多选）'}
            showSearch
            loading={loadingUsers}
            filterOption={(input, option) =>
              (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
            }
            options={filteredUsers.map(u => ({
              value: u.phone,
              // 专家直接显示用户名，其他角色显示用户名和角色
              label: presetRole === 'expert'
                ? (u.name || u.phone)
                : `${u.name || u.phone}（${getUserRoleDisplay(u.roles)}）`,
            }))}
            value={selectedUsers}
            onChange={setSelectedUsers}
            style={{ width: '100%' }}
            maxTagCount="responsive"
          />
          {/* 数据采集员需要选择负责的区县 */}
          {presetRole === 'data_collector' && availableDistricts.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ marginBottom: 8, color: '#666' }}>
                选择负责的区县 <span style={{ color: '#ff4d4f' }}>*</span>
              </div>
              <Select
                placeholder="请选择负责的区县"
                showSearch
                filterOption={(input, option) =>
                  (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
                }
                options={availableDistricts.map(d => ({
                  value: d.id,
                  label: d.name,
                }))}
                value={selectedDistrictId || undefined}
                onChange={setSelectedDistrictId}
                style={{ width: '100%' }}
              />
              <p style={{ color: '#999', marginTop: 4, fontSize: 12 }}>
                数据采集员将可以填报该区县内所有学校的数据
              </p>
            </div>
          )}
          {filteredUsers.length === 0 && !loadingUsers && (
            <p style={{ color: '#999', marginTop: 8, fontSize: 13 }}>
              {presetRole === 'expert'
                ? '暂无可用的专家账号，请先在专家账号管理中创建专家'
                : '暂无符合该角色的可用账号，请先在用户管理中创建对应角色的账号'
              }
            </p>
          )}
        </>
      ) : (
        // 从顶部添加人员按钮进入：显示完整表单
        <>
          <p className={styles.modalSubtitle}>从已有账号中选择或手动填写人员信息</p>

          {/* 切换模式 */}
          <div style={{ marginBottom: 16 }}>
            <Space>
              <Button
                type={selectMode === 'select' ? 'primary' : 'default'}
                onClick={() => setSelectMode('select')}
              >
                从账号选择
              </Button>
              <Button
                type={selectMode === 'manual' ? 'primary' : 'default'}
                onClick={() => setSelectMode('manual')}
              >
                手动填写
              </Button>
            </Space>
          </div>

          <Form form={form} onFinish={onSubmit} layout="vertical">
            {selectMode === 'select' && (
              <Form.Item label="选择已有账号">
                <Select
                  placeholder="请选择账号"
                  showSearch
                  loading={loadingUsers}
                  filterOption={(input, option) =>
                    (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
                  }
                  options={filteredUsers.map(u => ({
                    value: u.phone,
                    label: `${u.name || u.phone}（${getUserRoleDisplay(u.roles)}）`,
                  }))}
                  onChange={(phone: string) => {
                    const user = userList.find(u => u.phone === phone);
                    if (user) {
                      // 使用用户的第一个角色来映射人员角色
                      const firstRole = (user.roles || [])[0];
                      const personnelRole = systemRoleToPersonnelRole[firstRole] || 'data_collector';
                      form.setFieldsValue({
                        name: user.name || user.phone,
                        phone: user.phone,
                        role: personnelRole,
                      });
                    }
                  }}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            )}

            <Form.Item
              label="角色类型"
              name="role"
              rules={[{ required: true, message: '请选择角色类型' }]}
            >
              <Select
                placeholder="请选择角色类型"
                onChange={(value: string) => {
                  setSelectedRole(value);
                  // 如果不是数据采集员，清空区县选择
                  if (value !== 'data_collector') {
                    form.setFieldsValue({ districtId: undefined });
                  }
                }}
              >
                <Select.Option value="project_admin">项目管理员（项目配置和管理）</Select.Option>
                <Select.Option value="data_collector">数据采集员（按区县填报数据）</Select.Option>
                <Select.Option value="project_expert">项目评估专家（数据审核和评估）</Select.Option>
              </Select>
            </Form.Item>

            {/* 数据采集员需要选择负责的区县 */}
            {selectedRole === 'data_collector' && availableDistricts.length > 0 && (
              <Form.Item
                label="负责区县"
                name="districtId"
                rules={[{ required: true, message: '数据采集员必须选择负责的区县' }]}
              >
                <Select
                  placeholder="请选择负责的区县"
                  showSearch
                  filterOption={(input, option) =>
                    (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
                  }
                  options={availableDistricts.map(d => ({
                    value: d.id,
                    label: d.name,
                  }))}
                />
              </Form.Item>
            )}

            <Form.Item
              label="姓名"
              name="name"
              rules={[{ required: true, message: '请输入姓名' }]}
            >
              <Input placeholder="请输入姓名" />
            </Form.Item>
            <Form.Item
              label="单位"
              name="organization"
              rules={[{ required: true, message: filteredOrganizations.length > 0 ? '请选择单位' : '请输入单位' }]}
            >
              {filteredOrganizations.length > 0 ? (
                <Select
                  placeholder="请选择单位"
                  showSearch
                  filterOption={(input, option) =>
                    (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
                  }
                  options={filteredOrganizations.map(org => ({
                    value: org.name,
                    label: org.type === 'school' && org.districtName
                      ? `${org.name}（${org.districtName}）`
                      : org.name,
                  }))}
                />
              ) : (
                <Input placeholder="请输入单位" />
              )}
            </Form.Item>
            <Form.Item
              label="电话号码（登录账号）"
              name="phone"
              rules={[{ required: true, message: '请输入电话号码' }]}
            >
              <Input placeholder="请输入电话号码" />
            </Form.Item>
            <Form.Item label="身份证件号码" name="idCard">
              <Input placeholder="请输入身份证件号码" />
            </Form.Item>
            <Form.Item className={styles.formFooter}>
              <Button onClick={handleCancel}>取消</Button>
              <Button type="primary" htmlType="submit">确定</Button>
            </Form.Item>
          </Form>
        </>
      )}
    </Modal>
  );
};

// ==================== 导入人员弹窗 ====================

interface ImportModalProps {
  visible: boolean;
  step: 'upload' | 'preview';
  importData: ImportRecord[];
  filteredImportData: ImportRecord[];
  importStats: { total: number; confirmed: number; new: number; conflict: number };
  importFilter: ImportFilter;
  onFilterChange: (filter: ImportFilter) => void;
  onCancel: () => void;
  onLoadSample: () => void;
  onConfirm: () => void;
  onReset: () => void;
  onFileChange?: (file: File) => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  visible,
  step,
  importData,
  filteredImportData,
  importStats,
  importFilter,
  onFilterChange,
  onCancel,
  onLoadSample,
  onConfirm,
  onReset,
  onFileChange,
}) => {
  const importColumns: ColumnsType<ImportRecord> = [
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: ImportStatus) => {
        const info = getImportStatusInfo(status);
        return (
          <Tag color={info.color}>
            {info.icon} {info.text}
          </Tag>
        );
      },
    },
    { title: '角色', dataIndex: 'role', key: 'role', width: 100 },
    { title: '姓名', dataIndex: 'name', key: 'name', width: 80 },
    { title: '单位', dataIndex: 'organization', key: 'organization', width: 150 },
    {
      title: '电话',
      dataIndex: 'phone',
      key: 'phone',
      width: 120,
      render: (phone: any) => {
        // 如果 phone 是对象，提取 phone 属性或显示错误
        if (phone && typeof phone === 'object') {
          return phone.phone || phone.error || '-';
        }
        return phone || '-';
      },
    },
    { title: '身份证', dataIndex: 'idCard', key: 'idCard', width: 160 },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Space>
          {record.status !== 'confirmed' && record.status !== 'new' && (
            <Button type="link" size="small">修正</Button>
          )}
          <Button type="text" danger size="small">×</Button>
        </Space>
      ),
    },
  ];

  return (
    <Modal
      title="导入人员"
      open={visible}
      onCancel={onCancel}
      footer={step === 'preview' ? [
        <Button key="back" onClick={onReset}>重新导入</Button>,
        <Button key="cancel" onClick={onCancel}>取消</Button>,
        <Button key="submit" type="primary" onClick={onConfirm}>
          确认导入
        </Button>,
      ] : null}
      width={step === 'preview' ? 1000 : 700}
    >
      <p className={styles.modalSubtitle}>批量导入人员信息，系统会自动比对账号库和专家库</p>

      {step === 'upload' ? (
        <>
          {/* 导入说明 */}
          <div className={styles.importGuide}>
            <h4 className={styles.guideTitle}>导入说明</h4>
            <ul className={styles.guideList}>
              <li>Excel文件应包含以下字段：<strong>角色类型、姓名、单位、电话号码、身份证件号码</strong></li>
              <li>角色类型可选：<strong>系统管理员、市级管理员、区县管理员、学校填报员</strong></li>
              <li>系统会自动比对已有账号库</li>
              <li className={styles.guideItem}>
                <span className={styles.guideIcon}>✓</span>
                <strong>已确认</strong>：姓名、手机、单位、身份证全部一致
              </li>
              <li className={styles.guideItem}>
                <span className={styles.guideIconNew}>⊕</span>
                <strong>新用户</strong>：姓名、身份证、手机都找不到
              </li>
              <li className={styles.guideItem}>
                <span className={styles.guideIconWarn}>⚠</span>
                <strong>重名冲突</strong>：姓名一致，但手机、单位、身份证部分不一致
              </li>
              <li className={styles.guideItem}>
                <span className={styles.guideIconWarn}>⚠</span>
                <strong>身份证冲突</strong>：身份证一致，但姓名、手机、单位部分不一致
              </li>
              <li className={styles.guideItem}>
                <span className={styles.guideIconWarn}>⚠</span>
                <strong>手机冲突</strong>：手机一致，但姓名、身份证、单位部分不一致
              </li>
            </ul>
            <p className={styles.guideNote}>
              • 冲突记录需要人工修正确认；新用户可直接导入；已确认记录可再次修正
            </p>
          </div>

          {/* 下载模板 */}
          <div className={styles.templateSection}>
            <div className={styles.templateInfo}>
              <h4>下载导入模板</h4>
              <p>包含正确的字段格式和示例数据</p>
            </div>
            <Button icon={<UploadOutlined />}>下载模板</Button>
          </div>

          {/* 文件上传区域 */}
          <div className={styles.uploadSection}>
            <Upload.Dragger
              accept=".xlsx,.xls,.csv"
              showUploadList={false}
              beforeUpload={(file) => {
                if (onFileChange) {
                  onFileChange(file as unknown as File);
                }
                return false;
              }}
              className={styles.uploadDragger}
            >
              <p className={styles.uploadIcon}>📋</p>
              <p className={styles.uploadText}>点击选择Excel文件或拖拽文件到此处</p>
              <div className={styles.uploadButtons}>
                <Button icon={<UploadOutlined />}>选择文件</Button>
                <Button type="primary" icon={<FileTextOutlined />} onClick={(e) => {
                  e.stopPropagation();
                  onLoadSample();
                }}>加载示例数据</Button>
              </div>
              <p className={styles.uploadHint}>支持 .xlsx、.xls、.csv 格式，文件大小不超过5MB</p>
            </Upload.Dragger>
          </div>
        </>
      ) : (
        <>
          {/* 状态筛选 */}
          <div className={styles.importFilter}>
            <Space>
              <Tag
                color={importFilter === 'confirmed' ? 'success' : 'default'}
                className={styles.filterTag}
                onClick={() => onFilterChange(importFilter === 'confirmed' ? 'all' : 'confirmed')}
              >
                ✓ 已确认
              </Tag>
              <Tag
                color={importFilter === 'new' ? 'processing' : 'default'}
                className={styles.filterTag}
                onClick={() => onFilterChange(importFilter === 'new' ? 'all' : 'new')}
              >
                ⊕ 新用户
              </Tag>
              <Tag
                color={importFilter === 'conflict' ? 'warning' : 'default'}
                className={styles.filterTag}
                onClick={() => onFilterChange(importFilter === 'conflict' ? 'all' : 'conflict')}
              >
                ⚠ 信息冲突
              </Tag>
            </Space>
            <Input
              placeholder="搜索人员"
              prefix={<SearchOutlined />}
              style={{ width: 200 }}
            />
          </div>

          {/* 导入预览表格 */}
          <Table
            rowKey="id"
            columns={importColumns}
            dataSource={filteredImportData}
            pagination={false}
            size="small"
            scroll={{ y: 400 }}
          />

          {/* 统计信息 */}
          <div className={styles.importStats}>
            <span>共 {importStats.total} 条记录，</span>
            <span className={styles.statConfirmed}>{importStats.confirmed} 条已确认</span>
            <span className={styles.statNew}>{importStats.new} 条新用户</span>
            <span className={styles.statConflict}>{importStats.conflict} 条冲突</span>
          </div>
        </>
      )}
    </Modal>
  );
};

// ==================== 查看更多人员弹窗 ====================

interface MorePersonModalProps {
  visible: boolean;
  role: string;
  personnel: Personnel[];
  onCancel: () => void;
  onDeletePerson: (person: Personnel) => void;
}

export const MorePersonModal: React.FC<MorePersonModalProps> = ({
  visible,
  role,
  personnel,
  onCancel,
  onDeletePerson,
}) => {
  const personnelColumns: ColumnsType<Personnel> = [
    { title: '姓名', dataIndex: 'name', key: 'name', width: 100 },
    { title: '单位', dataIndex: 'organization', key: 'organization', width: 180 },
    {
      title: '电话号码',
      dataIndex: 'phone',
      key: 'phone',
      width: 140,
      render: (phone: any) => {
        // 如果 phone 是对象，提取 phone 属性或显示错误
        if (phone && typeof phone === 'object') {
          return phone.phone || phone.error || '-';
        }
        return phone || '-';
      },
    },
    { title: '身份证件号码', dataIndex: 'idCard', key: 'idCard', width: 180 },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_, record) => (
        <Button
          type="text"
          danger
          icon={<span>×</span>}
          onClick={() => onDeletePerson(record)}
        />
      ),
    },
  ];

  return (
    <Modal
      title={getRoleInfo(role).name}
      open={visible}
      onCancel={onCancel}
      footer={[
        <Button key="close" onClick={onCancel}>关闭</Button>
      ]}
      width={800}
    >
      <p className={styles.modalSubtitle}>查看和管理该角色的所有人员</p>
      <div className={styles.moreModalSearch}>
        <Input
          placeholder="搜索人员"
          prefix={<SearchOutlined />}
          style={{ width: 200 }}
        />
      </div>
      <Table
        rowKey="id"
        columns={personnelColumns}
        dataSource={personnel}
        pagination={{
          total: personnel.length,
          pageSize: 10,
          showTotal: (total, range) => `共 ${total} 条记录，第 ${range[0]} / ${range[1]} 页`,
        }}
        size="small"
      />
    </Modal>
  );
};

// ==================== 配置样本数据对象弹窗 ====================

interface SampleConfigModalProps {
  visible: boolean;
  config: SampleDataConfig;
  onChange: (config: SampleDataConfig) => void;
  onOk: () => void;
  onCancel: () => void;
}

export const SampleConfigModal: React.FC<SampleConfigModalProps> = ({
  visible,
  config,
  onChange,
  onOk,
  onCancel,
}) => {
  type SampleKey = keyof SampleDataConfig;

  type SampleNode = {
    key: SampleKey;
    label: string;
    desc: string;
    level: number;
    parent?: SampleKey;
    tagColor?: 'blue' | 'green' | 'orange';
  };

  const nodes: SampleNode[] = React.useMemo(() => ([
    { key: 'district', label: '区', desc: '表明需要采集区相关数据', level: 0, tagColor: 'blue' },
    { key: 'school', label: '校', desc: '表明需要采集校相关数据', level: 1, parent: 'district', tagColor: 'green' },
    { key: 'grade', label: '年级', desc: '表明需要采集年级相关数据', level: 2, parent: 'school' },
    { key: 'class', label: '班级', desc: '表明需要采集班级相关数据', level: 3, parent: 'grade' },
    { key: 'student', label: '学生', desc: '表明需要采集学生相关数据', level: 3, parent: 'grade' },
    { key: 'parent', label: '家长', desc: '表明需要采集家长相关数据', level: 3, parent: 'grade' },
    { key: 'department', label: '部门', desc: '表明需要采集部门相关数据', level: 2, parent: 'school' },
    { key: 'teacher', label: '教师', desc: '表明需要采集教师相关数据', level: 3, parent: 'department', tagColor: 'orange' },
  ]), []);

  const nodeByKey = React.useMemo(() => {
    const map = new Map<SampleKey, SampleNode>();
    nodes.forEach(n => map.set(n.key, n));
    return map;
  }, [nodes]);

  const descendantsByKey = React.useMemo(() => {
    const children = new Map<SampleKey, SampleKey[]>();
    nodes.forEach(n => {
      if (!n.parent) return;
      const arr = children.get(n.parent) || [];
      arr.push(n.key);
      children.set(n.parent, arr);
    });

    const memo = new Map<SampleKey, SampleKey[]>();
    const dfs = (k: SampleKey): SampleKey[] => {
      if (memo.has(k)) return memo.get(k)!;
      const direct = children.get(k) || [];
      const all = [...direct];
      direct.forEach(c => all.push(...dfs(c)));
      memo.set(k, all);
      return all;
    };

    const out = new Map<SampleKey, SampleKey[]>();
    (nodes.map(n => n.key) as SampleKey[]).forEach(k => out.set(k, dfs(k)));
    return out;
  }, [nodes]);

  const ensureParentsChecked = React.useCallback((next: SampleDataConfig, key: SampleKey) => {
    let cur = nodeByKey.get(key)?.parent;
    while (cur) {
      next = { ...next, [cur]: true };
      cur = nodeByKey.get(cur)?.parent;
    }
    return next;
  }, [nodeByKey]);

  const clearDescendants = React.useCallback((next: SampleDataConfig, key: SampleKey) => {
    const desc = descendantsByKey.get(key) || [];
    if (!desc.length) return next;
    const patch: Partial<SampleDataConfig> = {};
    desc.forEach(d => { patch[d] = false; });
    return { ...next, ...patch };
  }, [descendantsByKey]);

  const handleToggle = React.useCallback((key: SampleKey, checked: boolean) => {
    let next: SampleDataConfig = { ...config, [key]: checked };
    if (checked) {
      next = ensureParentsChecked(next, key);
    } else {
      next = clearDescendants(next, key);
    }
    onChange(next);
  }, [clearDescendants, config, ensureParentsChecked, onChange]);

  const renderBadgePrefix = (level: number) => {
    if (level <= 0) return null;
    return (
      <span className={styles.sampleLevelPrefix}>
        {'└'.repeat(level + 1)}
      </span>
    );
  };

  const renderLevelBadge = (node: SampleNode) => {
    const checked = config[node.key];
    return (
      <span className={styles.sampleLevelBadge}>
        {renderBadgePrefix(node.level)}
        <span className={checked ? styles.sampleLevelCheck : styles.sampleLevelCheckPlaceholder}>
          ✓
        </span>
        <Tag color={node.tagColor} className={styles.sampleLevelTag}>
          {node.label}
        </Tag>
      </span>
    );
  };

  const isNodeDisabled = (node: SampleNode) => {
    // 允许跨层级直接选择：点击子节点会自动补齐父级勾选
    return false;
  };

  return (
    <Modal
      title="配置样本数据对象"
      open={visible}
      onOk={onOk}
      onCancel={onCancel}
      okText="确定"
      cancelText="取消"
      width={520}
    >
      <p className={styles.modalSubtitle}>选择需要采集的数据对象层级，上级对象可能由下级对象计算得出。</p>
      <div className={styles.sampleConfigList}>
        {nodes.map(node => {
          const disabled = isNodeDisabled(node);
          return (
            <div
              key={node.key}
              className={styles.sampleConfigRow}
              style={{ marginLeft: node.level * 24 }}
            >
              <Checkbox
                checked={config[node.key]}
                disabled={disabled}
                onChange={e => handleToggle(node.key, e.target.checked)}
              />
              {renderLevelBadge(node)}
              <span className={styles.sampleConfigDesc}>{node.desc}</span>
            </div>
          );
        })}
      </div>
      <div className={styles.configTip}>
        💡 提示：可以跳过中间层级，如直接选择【校】和【学生】，表示不需要年级和班级的数据。
      </div>
    </Modal>
  );
};

// ==================== 添加样本弹窗 ====================

interface AddSampleModalProps {
  visible: boolean;
  onCancel: () => void;
  onSubmit: (values: SampleFormValues) => void;
  form: FormInstance;
}

export const AddSampleModal: React.FC<AddSampleModalProps> = ({
  visible,
  onCancel,
  onSubmit,
  form,
}) => (
  <Modal
    title="添加样本"
    open={visible}
    onCancel={onCancel}
    footer={null}
    width={400}
  >
    <p className={styles.modalSubtitle}>添加新的评估样本（区或学校）</p>
    <Form form={form} onFinish={onSubmit} layout="vertical">
      <Form.Item
        label="样本类型"
        name="type"
        rules={[{ required: true, message: '请选择样本类型' }]}
      >
        <Select placeholder="请选择">
          <Select.Option value="district">区</Select.Option>
          <Select.Option value="school">学校</Select.Option>
        </Select>
      </Form.Item>
      <Form.Item
        label="样本名称"
        name="name"
        rules={[{ required: true, message: '请输入样本名称' }]}
      >
        <Input placeholder="如：和平区" />
      </Form.Item>
      <Form.Item className={styles.formFooter}>
        <Button onClick={onCancel}>取消</Button>
        <Button type="primary" htmlType="submit">确定添加</Button>
      </Form.Item>
    </Form>
  </Modal>
);

// ==================== 添加教师样本弹窗 ====================

interface AddTeacherModalProps {
  visible: boolean;
  schoolName: string;
  onCancel: () => void;
  onSubmit: (values: TeacherFormValues) => void;
  form: FormInstance;
}

export const AddTeacherModal: React.FC<AddTeacherModalProps> = ({
  visible,
  schoolName,
  onCancel,
  onSubmit,
  form,
}) => (
  <Modal
    title="添加教师样本"
    open={visible}
    onCancel={onCancel}
    footer={null}
    width={400}
  >
    <p className={styles.modalSubtitle}>
      为 {schoolName} 添加具体人员
    </p>
    <Form form={form} onFinish={onSubmit} layout="vertical">
      <Form.Item
        label="姓名"
        name="name"
        rules={[{ required: true, message: '请输入姓名' }]}
      >
        <Input placeholder="请输入姓名" />
      </Form.Item>
      <Form.Item label="电话" name="phone">
        <Input placeholder="请输入电话号码" />
      </Form.Item>
      <Form.Item label="身份证号" name="idCard">
        <Input placeholder="请输入身份证号（选填）" />
      </Form.Item>
      <Form.Item className={styles.formFooter}>
        <Button onClick={onCancel}>取消</Button>
        <Button type="primary" htmlType="submit">确定添加</Button>
      </Form.Item>
    </Form>
  </Modal>
);

// ==================== 添加填报区县弹窗 ====================

interface AddSubmissionDistrictModalProps {
  visible: boolean;
  onCancel: () => void;
  onSubmit: (values: { name: string; code?: string }) => void;
  form: FormInstance;
}

export const AddSubmissionDistrictModal: React.FC<AddSubmissionDistrictModalProps> = ({
  visible,
  onCancel,
  onSubmit,
  form,
}) => (
  <Modal
    title="添加填报区县"
    open={visible}
    onCancel={onCancel}
    footer={null}
    width={400}
    destroyOnClose
  >
    <p className={styles.modalSubtitle}>添加需要参与填报的区县</p>
    <Form form={form} onFinish={onSubmit} layout="vertical">
      <Form.Item
        label="区县名称"
        name="name"
        rules={[{ required: true, message: '请输入区县名称' }]}
      >
        <Input placeholder="如：和平区" />
      </Form.Item>
      <Form.Item label="区县代码" name="code">
        <Input placeholder="可选，如：210102" />
      </Form.Item>
      <Form.Item className={styles.formFooter}>
        <Button onClick={onCancel}>取消</Button>
        <Button type="primary" htmlType="submit">确定添加</Button>
      </Form.Item>
    </Form>
  </Modal>
);

// ==================== 添加填报学校弹窗 ====================

interface AddSubmissionSchoolModalProps {
  visible: boolean;
  districtName: string;
  onCancel: () => void;
  onSubmit: (values: { name: string; code?: string; schoolType: string }) => void;
  form: FormInstance;
}

export const AddSubmissionSchoolModal: React.FC<AddSubmissionSchoolModalProps> = ({
  visible,
  districtName,
  onCancel,
  onSubmit,
  form,
}) => (
  <Modal
    title={`添加填报学校 - ${districtName}`}
    open={visible}
    onCancel={onCancel}
    footer={null}
    width={450}
    destroyOnClose
  >
    <p className={styles.modalSubtitle}>添加需要参与填报的学校</p>
    <Form form={form} onFinish={onSubmit} layout="vertical">
      <Form.Item
        label="学校名称"
        name="name"
        rules={[{ required: true, message: '请输入学校名称' }]}
      >
        <Input placeholder="请输入学校名称" />
      </Form.Item>
      <Form.Item label="学校代码" name="code">
        <Input placeholder="可选，如：2101020001" />
      </Form.Item>
      <Form.Item
        label="学校类型"
        name="schoolType"
        rules={[{ required: true, message: '请选择学校类型' }]}
        initialValue="小学"
      >
        <Select placeholder="请选择学校类型">
          <Select.Option value="小学">小学</Select.Option>
          <Select.Option value="初中">初中</Select.Option>
          <Select.Option value="九年一贯制">九年一贯制</Select.Option>
          <Select.Option value="完全中学">完全中学</Select.Option>
        </Select>
      </Form.Item>
      <Form.Item className={styles.formFooter}>
        <Button onClick={onCancel}>取消</Button>
        <Button type="primary" htmlType="submit">确定添加</Button>
      </Form.Item>
    </Form>
  </Modal>
);

// ==================== 导入填报学校弹窗 ====================

// Excel 解析后的原始行数据
interface ExcelSchoolRow {
  schoolCode: string;
  schoolName: string;
  districtCode: string;
  districtName: string;
  districtType?: string;
  schoolType: string;
  schoolNature?: string;  // 办学性质
  urbanRural?: string;    // 城乡类型
  address?: string;
  principal?: string;
  phone?: string;
  studentCount?: number;
  teacherCount?: number;
}

// 预览用的区县数据
interface PreviewDistrict {
  code: string;
  name: string;
  schools: ExcelSchoolRow[];
}

// 导入结果
interface ImportSchoolResult {
  success: number;
  failed: number;
  errors: string[];
}

interface ImportSubmissionSchoolModalProps {
  visible: boolean;
  onCancel: () => void;
  onImport: (districts: PreviewDistrict[]) => Promise<ImportSchoolResult>;
  existingDistricts?: Array<{ name: string; code?: string }>;
}

export const ImportSubmissionSchoolModal: React.FC<ImportSubmissionSchoolModalProps> = ({
  visible,
  onCancel,
  onImport,
  existingDistricts = [],
}) => {
  const [step, setStep] = useState<'upload' | 'preview'>('upload');
  const [parsedData, setParsedData] = useState<PreviewDistrict[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [expandedDistricts, setExpandedDistricts] = useState<string[]>([]);

  // 重置状态
  const resetState = useCallback(() => {
    setStep('upload');
    setParsedData([]);
    setParseError(null);
    setImporting(false);
    setExpandedDistricts([]);
  }, []);

  // 取消时重置
  const handleCancel = useCallback(() => {
    resetState();
    onCancel();
  }, [resetState, onCancel]);

  // 解析 Excel 文件
  const parseExcelFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

        if (jsonData.length === 0) {
          setParseError('Excel 文件为空或格式不正确');
          return;
        }

        // 检测列名并解析数据
        const rows: ExcelSchoolRow[] = jsonData.map((row) => {
          // 支持多种可能的列名
          const schoolCode = String(row['学校代码'] || row['schoolCode'] || '');
          const schoolName = String(row['学校名称'] || row['schoolName'] || '');
          const districtCode = String(row['区县代码'] || row['districtCode'] || '');
          const districtName = String(row['区县名称'] || row['districtName'] || '');
          const districtType = String(row['区县类型'] || row['districtType'] || '');
          const schoolType = String(row['学校类型'] || row['schoolType'] || '小学');
          const schoolNature = String(row['办学性质'] || row['schoolNature'] || '');
          const urbanRural = String(row['城乡类型'] || row['urbanRural'] || '');
          const address = String(row['地址'] || row['address'] || '');
          const principal = String(row['校长'] || row['principal'] || '');
          const phone = String(row['联系电话'] || row['phone'] || '');
          const studentCount = Number(row['学生数'] || row['studentCount'] || 0);
          const teacherCount = Number(row['教师数'] || row['teacherCount'] || 0);

          return {
            schoolCode,
            schoolName,
            districtCode,
            districtName,
            districtType,
            schoolType,
            schoolNature,
            urbanRural,
            address,
            principal,
            phone,
            studentCount,
            teacherCount,
          };
        }).filter(row => row.schoolName && row.districtName); // 过滤无效行

        if (rows.length === 0) {
          setParseError('未找到有效的学校数据，请确保Excel包含"学校名称"和"区县名称"列');
          return;
        }

        // 按区县分组
        const districtMap = new Map<string, PreviewDistrict>();
        rows.forEach(row => {
          const key = row.districtCode || row.districtName;
          if (!districtMap.has(key)) {
            districtMap.set(key, {
              code: row.districtCode,
              name: row.districtName,
              schools: [],
            });
          }
          districtMap.get(key)!.schools.push(row);
        });

        const districts = Array.from(districtMap.values());
        setParsedData(districts);
        setExpandedDistricts(districts.map(d => d.code || d.name)); // 默认全部展开
        setParseError(null);
        setStep('preview');
      } catch (err) {
        console.error('解析 Excel 失败:', err);
        setParseError('解析 Excel 文件失败，请检查文件格式');
      }
    };
    reader.onerror = () => {
      setParseError('读取文件失败');
    };
    reader.readAsBinaryString(file);
  }, []);

  // 处理文件上传
  const handleFileUpload = useCallback((file: UploadFile) => {
    if (file.originFileObj) {
      parseExcelFile(file.originFileObj);
    }
    return false; // 阻止自动上传
  }, [parseExcelFile]);

  // 执行导入
  const handleImport = useCallback(async () => {
    if (parsedData.length === 0) return;

    setImporting(true);
    try {
      const result = await onImport(parsedData);
      message.success(`导入成功：${result.success} 所学校`);
      if (result.failed > 0) {
        message.warning(`${result.failed} 条记录导入失败`);
      }
      handleCancel();
    } catch (err) {
      console.error('导入失败:', err);
      message.error('导入失败，请稍后重试');
    } finally {
      setImporting(false);
    }
  }, [parsedData, onImport, handleCancel]);

  // 检查区县是否已存在
  const isDistrictExisting = useCallback((districtName: string) => {
    return existingDistricts.some(d => d.name === districtName);
  }, [existingDistricts]);

  // 统计信息
  const stats = React.useMemo(() => {
    const totalDistricts = parsedData.length;
    const totalSchools = parsedData.reduce((sum, d) => sum + d.schools.length, 0);
    const newDistricts = parsedData.filter(d => !isDistrictExisting(d.name)).length;
    const existingDistrictsCount = totalDistricts - newDistricts;

    const schoolsByType: Record<string, number> = {};
    parsedData.forEach(d => {
      d.schools.forEach(s => {
        const type = s.schoolType || '其他';
        schoolsByType[type] = (schoolsByType[type] || 0) + 1;
      });
    });

    return { totalDistricts, totalSchools, newDistricts, existingDistrictsCount, schoolsByType };
  }, [parsedData, isDistrictExisting]);

  // 表格列定义
  const schoolColumns: ColumnsType<ExcelSchoolRow> = [
    { title: '学校代码', dataIndex: 'schoolCode', key: 'schoolCode', width: 120 },
    { title: '学校名称', dataIndex: 'schoolName', key: 'schoolName', width: 200 },
    {
      title: '学校类型',
      dataIndex: 'schoolType',
      key: 'schoolType',
      width: 100,
      render: (type: string) => {
        const colorMap: Record<string, string> = {
          '小学': 'blue',
          '初中': 'green',
          '九年一贯制': 'purple',
          '完全中学': 'orange',
        };
        return <Tag color={colorMap[type] || 'default'}>{type}</Tag>;
      },
    },
    { title: '办学性质', dataIndex: 'schoolNature', key: 'schoolNature', width: 80 },
    { title: '城乡类型', dataIndex: 'urbanRural', key: 'urbanRural', width: 80 },
    { title: '学生数', dataIndex: 'studentCount', key: 'studentCount', width: 80, align: 'right' },
    { title: '教师数', dataIndex: 'teacherCount', key: 'teacherCount', width: 80, align: 'right' },
  ];

  return (
    <Modal
      title="批量导入填报学校"
      open={visible}
      onCancel={handleCancel}
      footer={step === 'preview' ? [
        <Button key="back" onClick={resetState}>重新选择</Button>,
        <Button key="cancel" onClick={handleCancel}>取消</Button>,
        <Button
          key="submit"
          type="primary"
          loading={importing}
          onClick={handleImport}
          disabled={parsedData.length === 0}
        >
          确认导入 ({stats.totalSchools} 所学校)
        </Button>,
      ] : null}
      width={step === 'preview' ? 1000 : 600}
      destroyOnClose
    >
      {step === 'upload' ? (
        <>
          {/* 导入说明 */}
          <div className={styles.importGuide}>
            <h4 className={styles.guideTitle}>导入说明</h4>
            <ul className={styles.guideList}>
              <li>Excel文件应包含以下字段（按顺序）：</li>
              <li style={{ marginLeft: 16 }}>
                <strong>必填</strong>：学校代码、学校名称、区县代码、区县名称、学校类型
              </li>
              <li style={{ marginLeft: 16 }}>
                <strong>可选</strong>：区县类型、办学性质、城乡类型、地址、校长、联系电话、学生数、教师数
              </li>
              <li>学校类型可选：<strong>小学、初中、九年一贯制、完全中学</strong></li>
              <li>系统会自动识别并按区县分组</li>
              <li>已存在的区县将添加新学校，不会删除现有数据</li>
            </ul>
          </div>

          {parseError && (
            <Alert
              type="error"
              message={parseError}
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

          {/* 文件上传区域 */}
          <div className={styles.uploadSection}>
            <Upload.Dragger
              accept=".xlsx,.xls"
              showUploadList={false}
              beforeUpload={(file) => {
                handleFileUpload({ originFileObj: file } as UploadFile);
                return false;
              }}
              className={styles.uploadDragger}
            >
              <p className={styles.uploadIcon}><FileExcelOutlined style={{ fontSize: 48, color: '#52c41a' }} /></p>
              <p className={styles.uploadText}>点击选择 Excel 文件或拖拽文件到此处</p>
              <p className={styles.uploadHint}>支持 .xlsx、.xls 格式</p>
            </Upload.Dragger>
          </div>
        </>
      ) : (
        <Spin spinning={importing}>
          {/* 统计信息 */}
          <Alert
            type="info"
            showIcon
            icon={<CheckCircleOutlined />}
            message={
              <Space split={<span style={{ color: '#d9d9d9' }}>|</span>}>
                <span>共 <strong>{stats.totalDistricts}</strong> 个区县</span>
                <span>共 <strong>{stats.totalSchools}</strong> 所学校</span>
                {stats.newDistricts > 0 && (
                  <span style={{ color: '#52c41a' }}>新增区县 {stats.newDistricts} 个</span>
                )}
                {stats.existingDistrictsCount > 0 && (
                  <span style={{ color: '#faad14' }}>已有区县 {stats.existingDistrictsCount} 个</span>
                )}
              </Space>
            }
            style={{ marginBottom: 16 }}
          />

          {/* 学校类型分布 */}
          <div style={{ marginBottom: 16 }}>
            <span style={{ marginRight: 8, color: '#666' }}>学校类型分布：</span>
            {Object.entries(stats.schoolsByType).map(([type, count]) => {
              const colorMap: Record<string, string> = {
                '小学': 'blue',
                '初中': 'green',
                '九年一贯制': 'purple',
                '完全中学': 'orange',
              };
              return (
                <Tag key={type} color={colorMap[type] || 'default'}>
                  {type}: {count}
                </Tag>
              );
            })}
          </div>

          {/* 区县和学校预览 */}
          <div style={{ maxHeight: 400, overflow: 'auto' }}>
            {parsedData.map(district => (
              <div key={district.code || district.name} style={{ marginBottom: 16 }}>
                <div
                  style={{
                    padding: '8px 12px',
                    background: '#fafafa',
                    borderRadius: 4,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    const key = district.code || district.name;
                    setExpandedDistricts(prev =>
                      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
                    );
                  }}
                >
                  <Space>
                    <span style={{ fontWeight: 500 }}>{district.name}</span>
                    {district.code && <span style={{ color: '#999' }}>({district.code})</span>}
                    <Tag>{district.schools.length} 所学校</Tag>
                    {isDistrictExisting(district.name) ? (
                      <Tag color="warning" icon={<ExclamationCircleOutlined />}>已存在</Tag>
                    ) : (
                      <Tag color="success" icon={<CheckCircleOutlined />}>新增</Tag>
                    )}
                  </Space>
                  <span style={{ color: '#999' }}>
                    {expandedDistricts.includes(district.code || district.name) ? '收起' : '展开'}
                  </span>
                </div>
                {expandedDistricts.includes(district.code || district.name) && (
                  <Table
                    rowKey="schoolCode"
                    columns={schoolColumns}
                    dataSource={district.schools}
                    pagination={false}
                    size="small"
                    style={{ marginTop: 8 }}
                  />
                )}
              </div>
            ))}
          </div>
        </Spin>
      )}
    </Modal>
  );
};
