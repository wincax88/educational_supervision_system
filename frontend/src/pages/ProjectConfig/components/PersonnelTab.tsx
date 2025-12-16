/**
 * 人员配置 Tab 组件
 */

import React from 'react';
import { Table, Button, Input, Tag, Space } from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  UploadOutlined,
  SearchOutlined,
  RightOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { Personnel, RoleInfo, ImportStatus } from '../types';
import styles from '../index.module.css';

interface PersonnelTabProps {
  personnel: Record<string, Personnel[]>;
  personnelSearch: string;
  onSearchChange: (value: string) => void;
  onAddPerson: () => void;
  onImport: () => void;
  onDeletePerson: (person: Personnel) => void;
  onOpenMore: (role: string) => void;
  filterPersonnel: (role: string) => Personnel[];
  disabled?: boolean; // 是否禁用编辑（只读模式）
}

// 获取角色显示名和描述
const getRoleInfo = (role: string): RoleInfo => {
  const roleMap: Record<string, RoleInfo> = {
    'system_admin': { name: '项目创建者/系统管理员', desc: '项目创建者，拥有本项目的所有权限' },
    'project_manager': { name: '项目管理员', desc: '项目管理者，拥有本项目的所有权限' },
    'data_collector': { name: '数据采集员', desc: '负责项目数据填报和采集' },
    'expert': { name: '评估专家', desc: '负责项目评审和评估' },
  };
  return roleMap[role] || { name: role, desc: '' };
};

const PersonnelTab: React.FC<PersonnelTabProps> = ({
  personnel,
  personnelSearch,
  onSearchChange,
  onAddPerson,
  onImport,
  onDeletePerson,
  onOpenMore,
  filterPersonnel,
  disabled = false,
}) => {
  // 人员表格列定义
  const personnelColumns: ColumnsType<Personnel> = [
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      width: 100,
      render: (name) => <span className={styles.personName}>{name}</span>
    },
    { title: '单位', dataIndex: 'organization', key: 'organization', width: 180 },
    { title: '电话号码', dataIndex: 'phone', key: 'phone', width: 140 },
    { title: '身份证件号码', dataIndex: 'idCard', key: 'idCard', width: 180 },
    ...(!disabled ? [{
      title: '操作',
      key: 'action',
      width: 80,
      render: (_: unknown, record: Personnel) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => onDeletePerson(record)}
        />
      ),
    }] : []),
  ];

  return (
    <div className={styles.personnelTab}>
      {/* 人员配置标题行 */}
      <div className={styles.personnelHeader}>
        <h3 className={styles.sectionTitle}>人员配置</h3>
        <div className={styles.personnelActions}>
          <Input
            placeholder="搜索人员"
            prefix={<SearchOutlined />}
            value={personnelSearch}
            onChange={e => onSearchChange(e.target.value)}
            className={styles.searchInput}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={onAddPerson}
            disabled={disabled}
          >
            添加人员
          </Button>
          <Button
            icon={<UploadOutlined />}
            onClick={onImport}
            disabled={disabled}
          >
            导入人员
          </Button>
        </div>
      </div>

      {/* 各角色人员列表 */}
      {['system_admin', 'project_manager', 'data_collector', 'expert'].map(role => {
        const roleInfo = getRoleInfo(role);
        const rolePersonnel = personnel[role] || [];
        const filteredPersonnel = filterPersonnel(role);

        return (
          <div key={role} className={styles.roleSection}>
            <div className={styles.roleTitleRow}>
              <div className={styles.roleTitle}>
                <span className={styles.roleName}>{roleInfo.name}</span>
                <span className={styles.roleDesc}>— {roleInfo.desc}</span>
              </div>
              <span className={styles.roleCount}>总人数：{rolePersonnel.length} 人</span>
            </div>
            <Table
              rowKey="id"
              columns={personnelColumns}
              dataSource={filteredPersonnel.slice(0, 3)}
              pagination={false}
              size="small"
              className={styles.personnelTable}
            />
            {rolePersonnel.length > 3 && (
              <div className={styles.moreLink}>
                <Button type="link" onClick={() => onOpenMore(role)}>
                  更多 <RightOutlined />
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default PersonnelTab;
