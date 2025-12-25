/**
 * 人员管理 Hook
 */

import { useState, useCallback, useEffect } from 'react';
import { message, Modal } from 'antd';
import * as personnelService from '../../../services/personnelService';
import type { Personnel, ImportRecord, PersonnelFormValues } from '../types';

export type ImportFilter = 'all' | 'confirmed' | 'new' | 'conflict';

// 项目人员角色定义（新角色体系）
// | 角色 | 代码 | 职责 | 权限范围 |
// | 项目管理员 | project_admin | 项目配置和管理 | 配置项目、管理人员、查看进度、生成报表 |
// | 数据采集员 | data_collector | 数据填报和采集 | 填报所属区县内所有学校的数据 |
// | 项目评估专家 | project_expert | 项目评审和评估 | 审核提交的数据、评审评估结果 |

// 角色映射：后端角色 -> 前端角色key
const backendToFrontendRole: Record<string, string> = {
  project_admin: 'project_admin',
  data_collector: 'data_collector',
  project_expert: 'project_expert',
};

// 角色映射：前端角色key -> 后端角色
const frontendToBackendRole: Record<string, string> = {
  project_admin: 'project_admin',
  data_collector: 'data_collector',
  project_expert: 'project_expert',
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

      // 按角色分组（新角色体系）
      const grouped: Record<string, Personnel[]> = {
        project_admin: [],
        data_collector: [],
        project_expert: [],
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
          districtId: person.districtId,
          districtName: person.districtName,
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
      { id: '1', status: 'confirmed', role: 'data_collector', name: '王明', organization: '铁西区教育局', phone: '13900001001', idCard: '210100********1001', districtId: 'district_001' },
      { id: '2', status: 'name_conflict', role: 'data_collector', name: '李华', organization: '大东区教育局', phone: '13900009002', idCard: '210100********1002', districtId: 'district_002' },
      { id: '3', status: 'new', role: 'project_admin', name: '陈新', organization: '市教育局', phone: '13900009001', idCard: '210100********9001' },
      { id: '4', status: 'id_conflict', role: 'data_collector', name: '张丽丽', organization: '沈北新区教育局', phone: '13900001005', idCard: '210100********1005', districtId: 'district_003' },
      { id: '5', status: 'confirmed', role: 'project_expert', name: '张教授', organization: '市教育评估中心', phone: '13900002001', idCard: '210100********2001' },
    ];
    setImportData(mockImportData);
  }, []);

  // 解析导入文件（CSV/Excel）
  const parseImportFile = useCallback((file: File): Promise<boolean> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const lines = text.split('\n').filter(line => line.trim());

          if (lines.length < 2) {
            message.error('文件为空或格式不正确');
            resolve(false);
            return;
          }

          // 解析表头
          const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
          const roleIdx = headers.findIndex(h => h === '角色类型' || h === '角色' || h === 'role');
          const nameIdx = headers.findIndex(h => h === '姓名' || h === 'name');
          const orgIdx = headers.findIndex(h => h === '单位' || h === 'organization');
          const phoneIdx = headers.findIndex(h => h === '电话号码' || h === '电话' || h === 'phone');
          const idCardIdx = headers.findIndex(h => h === '身份证件号码' || h === '身份证' || h === 'idCard' || h === '身份证号');
          const districtIdIdx = headers.findIndex(h => h === '负责区县ID' || h === '区县ID' || h === 'districtId');

          if (nameIdx === -1) {
            message.error('CSV文件必须包含"姓名"列');
            resolve(false);
            return;
          }

          // 角色映射（支持新旧两套角色体系）
          const roleMap: Record<string, string> = {
            // 新角色体系（3角色）
            '项目管理员': 'project_admin',
            '数据采集员': 'data_collector',
            '项目评估专家': 'project_expert',
            'project_admin': 'project_admin',
            'data_collector': 'data_collector',
            'project_expert': 'project_expert',
            // 旧角色体系（兼容）
            '系统管理员': 'system_admin',
            '市级管理员': 'city_admin',
            '区县管理员': 'district_admin',
            '区县填报员': 'district_reporter',
            '学校填报员': 'school_reporter',
            'system_admin': 'system_admin',
            'city_admin': 'city_admin',
            'district_admin': 'district_admin',
            'district_reporter': 'district_reporter',
            'school_reporter': 'school_reporter',
          };

          // 解析数据行
          const records: ImportRecord[] = [];
          for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
            const name = nameIdx >= 0 ? values[nameIdx] : '';
            if (!name) continue;

            const roleStr = roleIdx >= 0 ? values[roleIdx] : '';
            const role = roleMap[roleStr] || 'data_collector'; // 默认为数据采集员

            records.push({
              id: String(i),
              status: 'new', // 默认为新用户，实际应该比对已有数据
              role,
              name,
              organization: orgIdx >= 0 ? values[orgIdx] : '',
              phone: phoneIdx >= 0 ? values[phoneIdx] : '',
              idCard: idCardIdx >= 0 ? values[idCardIdx] : '',
              districtId: districtIdIdx >= 0 ? values[districtIdIdx] : undefined,
            });
          }

          if (records.length === 0) {
            message.error('没有解析到有效数据');
            resolve(false);
            return;
          }

          setImportData(records);
          message.success(`成功解析 ${records.length} 条记录`);
          resolve(true);
        } catch (err) {
          console.error('解析文件失败:', err);
          message.error('解析文件失败');
          resolve(false);
        }
      };
      reader.onerror = () => {
        message.error('读取文件失败');
        resolve(false);
      };
      reader.readAsText(file, 'UTF-8');
    });
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
        role: (frontendToBackendRole[record.role] || record.role) as 'project_admin' | 'data_collector' | 'project_expert' | 'system_admin' | 'city_admin' | 'district_admin' | 'school_reporter',
        districtId: record.districtId,
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
    parseImportFile,
    confirmImport,
    clearImportData,
    filterPersonnel,
    loading,
    loadPersonnel,
  };
}
