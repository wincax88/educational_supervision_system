/**
 * 人员管理 Hook
 */

import { useState, useCallback, useEffect } from 'react';
import { message, Modal } from 'antd';
import * as personnelService from '../../../services/personnelService';
import type { Personnel, ImportRecord, PersonnelFormValues } from '../types';

export type ImportFilter = 'all' | 'confirmed' | 'new' | 'conflict';

// 角色定义
// | 角色 | 所属层级 | 可操作的采集工具 | 权限范围 |
// | 系统管理员 | 省级/国家级 | 所有工具模板 | 创建/维护工具模板、项目全局配置 |
// | 市级管理员 | 市级 | 查看工具、汇总报表 | 查看区县进度，不可编辑数据 |
// | 区县管理员 | 区县 | 表单审核工具、Excel汇总模板 | 审核本区县所有学校数据、退回修改 |
// | 区县填报员 | 区县 | 在线表单、Excel填报模板 | 填报区县级采集工具数据 |
// | 学校填报员 | 学校 | 在线表单、Excel填报模板 | 仅编辑本校原始要素 |

// 角色映射：后端角色 -> 前端角色key（保持一致）
const backendToFrontendRole: Record<string, string> = {
  system_admin: 'system_admin',
  city_admin: 'city_admin',
  district_admin: 'district_admin',
  district_reporter: 'district_reporter',
  school_reporter: 'school_reporter',
};

// 角色映射：前端角色key -> 后端角色（保持一致）
const frontendToBackendRole: Record<string, string> = {
  system_admin: 'system_admin',
  city_admin: 'city_admin',
  district_admin: 'district_admin',
  district_reporter: 'district_reporter',
  school_reporter: 'school_reporter',
};

export function usePersonnel(projectId?: string) {
  const [personnel, setPersonnel] = useState<Record<string, Personnel[]>>({});
  const [personnelSearch, setPersonnelSearch] = useState('');
  const [importData, setImportData] = useState<ImportRecord[]>([]);
  const [importFilter, setImportFilter] = useState<ImportFilter>('all');
  const [loading, setLoading] = useState(false);

  // 加载人员数据
  const loadPersonnel = useCallback(async () => {
    if (!projectId) return;

    try {
      setLoading(true);
      const data = await personnelService.getPersonnel(projectId);

      // 按角色分组
      const grouped: Record<string, Personnel[]> = {
        system_admin: [],
        city_admin: [],
        district_admin: [],
        district_reporter: [],
        school_reporter: [],
      };

      data.forEach(person => {
        const frontendRole = backendToFrontendRole[person.role] || person.role;
        const mappedPerson: Personnel = {
          id: person.id,
          name: person.name,
          organization: person.organization,
          phone: person.phone,
          idCard: person.idCard,
          role: frontendRole,
        };

        if (!grouped[frontendRole]) {
          grouped[frontendRole] = [];
        }
        grouped[frontendRole].push(mappedPerson);
      });

      setPersonnel(grouped);
    } catch (error) {
      console.error('加载人员数据失败:', error);
      message.error('加载人员数据失败');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // 初始加载
  useEffect(() => {
    loadPersonnel();
  }, [loadPersonnel]);

  // 添加人员
  const addPerson = useCallback(async (values: PersonnelFormValues) => {
    if (!projectId) {
      message.error('项目ID不存在');
      return;
    }

    try {
      const backendRole = frontendToBackendRole[values.role] || values.role;

      await personnelService.addPersonnel(projectId, {
        name: values.name,
        organization: values.organization,
        phone: values.phone,
        idCard: values.idCard || '',
        role: backendRole as any,
      });

      message.success('添加成功');
      loadPersonnel();
    } catch (error) {
      console.error('添加人员失败:', error);
      message.error('添加人员失败');
    }
  }, [projectId, loadPersonnel]);

  // 删除人员
  const deletePerson = useCallback((person: Personnel) => {
    if (!projectId) return;

    Modal.confirm({
      title: '确认删除',
      content: `确定要删除 "${person.name}" 吗？`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await personnelService.deletePersonnel(projectId, person.id);
          message.success('删除成功');
          loadPersonnel();
        } catch (error) {
          console.error('删除人员失败:', error);
          message.error('删除人员失败');
        }
      },
    });
  }, [projectId, loadPersonnel]);

  // 加载示例导入数据（模拟文件解析后的预览）
  const loadSampleImportData = useCallback(() => {
    // 这里实际应该是解析上传的文件
    const mockImportData: ImportRecord[] = [
      { id: '1', status: 'confirmed', role: 'school_reporter', name: '王明', organization: '铁西区第一小学', phone: '13900001001', idCard: '210100********1001' },
      { id: '2', status: 'name_conflict', role: 'school_reporter', name: '李华', organization: '大东区实验中学', phone: '13900009002', idCard: '210100********1002' },
      { id: '3', status: 'new', role: 'district_admin', name: '陈新', organization: '铁西区教育局', phone: '13900009001', idCard: '210100********9001' },
      { id: '4', status: 'id_conflict', role: 'school_reporter', name: '张丽丽', organization: '沈北新区第二中学', phone: '13900001005', idCard: '210100********1005' },
      { id: '5', status: 'confirmed', role: 'city_admin', name: '张处长', organization: '沈阳市教育局', phone: '13900002001', idCard: '210100********2001' },
    ];
    setImportData(mockImportData);
  }, []);

  // 确认导入
  const confirmImport = useCallback(async () => {
    if (!projectId) return;

    const importableData = importData.filter(r => r.status === 'confirmed' || r.status === 'new');

    if (importableData.length === 0) {
      message.warning('没有可导入的数据');
      return;
    }

    try {
      const personnelToImport = importableData.map(record => ({
        name: record.name,
        organization: record.organization,
        phone: record.phone,
        idCard: record.idCard,
        role: (frontendToBackendRole[record.role] || record.role) as 'system_admin' | 'city_admin' | 'district_admin' | 'school_reporter',
      }));

      const result = await personnelService.importPersonnel(projectId, personnelToImport);
      message.success(`成功导入 ${result.success} 条记录`);

      if (result.failed > 0) {
        message.warning(`${result.failed} 条记录导入失败`);
      }

      setImportData([]);
      loadPersonnel();
    } catch (error) {
      console.error('导入失败:', error);
      message.error('导入失败');
    }
  }, [projectId, importData, loadPersonnel]);

  // 清空导入数据
  const clearImportData = useCallback(() => {
    setImportData([]);
  }, []);

  // 过滤人员
  const filterPersonnel = useCallback((role: string) => {
    const rolePersonnel = personnel[role] || [];
    if (!personnelSearch) return rolePersonnel;

    return rolePersonnel.filter(p =>
      p.name.includes(personnelSearch) ||
      p.organization.includes(personnelSearch) ||
      p.phone.includes(personnelSearch)
    );
  }, [personnel, personnelSearch]);

  // 过滤导入数据
  const filteredImportData = importData.filter(record => {
    if (importFilter === 'all') return true;
    if (importFilter === 'confirmed') return record.status === 'confirmed';
    if (importFilter === 'new') return record.status === 'new';
    if (importFilter === 'conflict') return ['name_conflict', 'id_conflict', 'phone_conflict'].includes(record.status);
    return true;
  });

  // 统计导入数据
  const importStats = {
    total: importData.length,
    confirmed: importData.filter(r => r.status === 'confirmed').length,
    new: importData.filter(r => r.status === 'new').length,
    conflict: importData.filter(r => ['name_conflict', 'id_conflict', 'phone_conflict'].includes(r.status)).length,
  };

  return {
    personnel,
    personnelSearch,
    setPersonnelSearch,
    importData,
    importFilter,
    setImportFilter,
    filteredImportData,
    importStats,
    addPerson,
    deletePerson,
    loadSampleImportData,
    confirmImport,
    clearImportData,
    filterPersonnel,
    loading,
    loadPersonnel,
  };
}
