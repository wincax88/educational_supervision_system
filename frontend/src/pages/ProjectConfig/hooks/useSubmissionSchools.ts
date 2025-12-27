/**
 * 评估对象管理 Hook
 * 用于管理项目配置中的评估对象（从系统学校中选择）
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { message, Modal } from 'antd';
import * as sampleService from '../../../services/sampleService';
import * as schoolService from '../../../services/schoolService';
import * as districtService from '../../../services/districtService';

// 系统学校类型
export interface SystemSchool {
  id: string;
  code: string;
  name: string;
  districtId: string;
  districtName?: string;
  schoolType: string;
  schoolCategory?: string;
  urbanRural?: string;
}

// 系统区县类型（包含学校列表）
export interface SystemDistrict {
  id: string;
  code: string;
  name: string;
  schools: SystemSchool[];
}

// 已选学校类型
export interface SelectedSchool {
  id: string;
  systemSchoolId: string; // 关联的系统学校ID
  name: string;
  code?: string;
  schoolType: string;
  districtId: string;
  districtName: string;
}

// 填报学校类型（兼容旧接口）
export interface SubmissionSchool {
  id: string;
  name: string;
  code?: string;
  schoolType: string;
  parentId: string;
}

// 填报区县类型（包含学校列表，兼容旧接口）
export interface SubmissionDistrict {
  id: string;
  name: string;
  code?: string;
  schools: SubmissionSchool[];
}

// 区县表单值
export interface DistrictFormValues {
  name: string;
  code?: string;
}

// 学校表单值
export interface SchoolFormValues {
  name: string;
  code?: string;
  schoolType: string;
}

// 新增学校表单值（同步到系统）
export interface NewSchoolFormValues {
  name: string;
  code: string;
  districtId: string;
  schoolType: string;
  schoolCategory?: string;
  urbanRural?: string;
}

// 将 API 响应转换为前端树形结构
function convertApiToTree(apiSamples: sampleService.Sample[]): SubmissionDistrict[] {
  const districts: SubmissionDistrict[] = [];
  const districtMap = new Map<string, SubmissionDistrict>();

  // 展平树形结构
  const flatSamples: sampleService.Sample[] = [];
  const flatten = (samples: sampleService.Sample[]) => {
    samples.forEach(s => {
      flatSamples.push(s);
      if (s.children && s.children.length > 0) {
        flatten(s.children);
      }
    });
  };
  flatten(apiSamples);

  // 首先处理区县
  flatSamples
    .filter(s => s.type === 'district')
    .forEach(d => {
      const district: SubmissionDistrict = {
        id: d.id,
        name: d.name,
        code: d.code,
        schools: [],
      };
      districtMap.set(d.id, district);
      districts.push(district);
    });

  // 然后处理学校
  flatSamples
    .filter(s => s.type === 'school')
    .forEach(s => {
      const school: SubmissionSchool = {
        id: s.id,
        name: s.name,
        code: s.code,
        schoolType: s.schoolType || '小学',
        parentId: s.parentId || '',
      };

      // 添加到对应区县
      if (s.parentId && districtMap.has(s.parentId)) {
        districtMap.get(s.parentId)!.schools.push(school);
      }
    });

  return districts;
}

export function useSubmissionSchools(projectId?: string) {
  // 已选择的学校数据（项目关联的）
  const [districts, setDistricts] = useState<SubmissionDistrict[]>([]);
  const [expandedDistricts, setExpandedDistricts] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [schoolTypeFilter, setSchoolTypeFilter] = useState<string>('all');

  // 系统学校数据
  const [systemDistricts, setSystemDistricts] = useState<SystemDistrict[]>([]);
  const [systemLoading, setSystemLoading] = useState(false);
  const [systemSchoolKeyword, setSystemSchoolKeyword] = useState('');
  const [systemSchoolTypeFilter, setSystemSchoolTypeFilter] = useState<string>('all');

  // 加载项目已选学校数据
  const loadData = useCallback(async () => {
    if (!projectId) return;

    try {
      setLoading(true);
      const data = await sampleService.getSamples(projectId);

      // 将 API 数据转换为树形结构
      const treeData = convertApiToTree(data);

      setDistricts(treeData);

      // 默认展开所有区县
      if (treeData.length > 0 && expandedDistricts.length === 0) {
        setExpandedDistricts(treeData.map(d => d.id));
      }
    } catch (error) {
      console.error('加载评估对象数据失败:', error);
      message.error('加载评估对象数据失败');
    } finally {
      setLoading(false);
    }
  }, [projectId, expandedDistricts.length]);

  // 加载系统学校数据
  const loadSystemSchools = useCallback(async () => {
    try {
      setSystemLoading(true);

      // 获取所有区县
      const districtsData = await districtService.getDistricts();

      // 获取所有学校
      const schoolsResponse = await schoolService.getSchools({ pageSize: 9999 });
      const schoolsData = schoolsResponse.list || [];

      // 组装成树形结构
      const districtTree: SystemDistrict[] = districtsData.map(d => ({
        id: d.id,
        code: d.code,
        name: d.name,
        schools: schoolsData
          .filter(s => s.districtId === d.id)
          .map(s => ({
            id: s.id,
            code: s.code,
            name: s.name,
            districtId: s.districtId,
            districtName: d.name,
            schoolType: s.schoolType,
            schoolCategory: s.schoolCategory,
            urbanRural: s.urbanRural,
          })),
      }));

      setSystemDistricts(districtTree);
    } catch (error) {
      console.error('加载系统学校数据失败:', error);
      message.error('加载系统学校数据失败');
    } finally {
      setSystemLoading(false);
    }
  }, []);

  // 初始加载
  useEffect(() => {
    loadData();
    loadSystemSchools();
  }, [loadData, loadSystemSchools]);

  // 切换区县展开
  const toggleDistrictExpand = useCallback((districtId: string) => {
    setExpandedDistricts(prev =>
      prev.includes(districtId)
        ? prev.filter(id => id !== districtId)
        : [...prev, districtId]
    );
  }, []);

  // 获取已选学校ID列表（用于去重判断）
  const selectedSchoolCodes = useMemo(() => {
    const codes = new Set<string>();
    districts.forEach(d => {
      d.schools.forEach(s => {
        if (s.code) codes.add(s.code);
      });
    });
    return codes;
  }, [districts]);

  // 检查学校是否已选
  const isSchoolSelected = useCallback((schoolCode: string) => {
    return selectedSchoolCodes.has(schoolCode);
  }, [selectedSchoolCodes]);

  // 添加学校（从系统学校中选择）
  const addSchoolsFromSystem = useCallback(async (schools: SystemSchool[]) => {
    if (!projectId) return;

    try {
      // 过滤掉已选的学校（去重）
      const newSchools = schools.filter(s => !isSchoolSelected(s.code));

      if (newSchools.length === 0) {
        message.warning('所选学校均已添加');
        return;
      }

      // 按区县分组
      const schoolsByDistrict = new Map<string, SystemSchool[]>();
      newSchools.forEach(s => {
        const districtId = s.districtId;
        if (!schoolsByDistrict.has(districtId)) {
          schoolsByDistrict.set(districtId, []);
        }
        schoolsByDistrict.get(districtId)!.push(s);
      });

      // 逐个添加
      for (const [districtId, districtSchools] of schoolsByDistrict) {
        // 检查区县是否已存在
        const district = systemDistricts.find(d => d.id === districtId);
        if (!district) continue;

        let sampleDistrictId = districts.find(d => d.name === district.name)?.id;

        // 如果区县不存在，先创建
        if (!sampleDistrictId) {
          const result = await sampleService.addDistrictSample(projectId, {
            name: district.name,
            code: district.code,
          });
          sampleDistrictId = result.id;
        }

        // 添加学校
        for (const school of districtSchools) {
          await sampleService.addSchoolSample(projectId, {
            parentId: sampleDistrictId,
            name: school.name,
            code: school.code,
            schoolType: school.schoolType,
            teacherSampleMode: 'self',
          });
        }
      }

      message.success(`成功添加 ${newSchools.length} 所学校`);
      loadData();
    } catch (error) {
      console.error('添加学校失败:', error);
      message.error('添加学校失败');
    }
  }, [projectId, isSchoolSelected, systemDistricts, districts, loadData]);

  // 添加区县（旧接口，保留兼容）
  const addDistrict = useCallback(async (values: DistrictFormValues) => {
    if (!projectId) return;

    try {
      await sampleService.addDistrictSample(projectId, {
        name: values.name,
        code: values.code,
      });
      message.success('区县添加成功');
      loadData();
    } catch (error) {
      console.error('添加区县失败:', error);
      message.error('添加区县失败');
    }
  }, [projectId, loadData]);

  // 添加学校（旧接口，保留兼容）
  const addSchool = useCallback(async (districtId: string, values: SchoolFormValues) => {
    if (!projectId) return;

    try {
      await sampleService.addSchoolSample(projectId, {
        parentId: districtId,
        name: values.name,
        code: values.code,
        schoolType: values.schoolType,
        teacherSampleMode: 'self',
      });
      message.success('学校添加成功');
      loadData();
    } catch (error) {
      console.error('添加学校失败:', error);
      message.error('添加学校失败');
    }
  }, [projectId, loadData]);

  // 新增学校到系统并添加到项目
  const createAndAddSchool = useCallback(async (values: NewSchoolFormValues) => {
    if (!projectId) return;

    try {
      // 1. 先在系统中创建学校
      const createResult = await schoolService.createSchool({
        code: values.code,
        name: values.name,
        districtId: values.districtId,
        schoolType: values.schoolType,
        schoolCategory: values.schoolCategory,
        urbanRural: values.urbanRural,
      });

      // 2. 获取新创建学校的完整信息
      const newSchool = await schoolService.getSchool(createResult.id);
      const district = systemDistricts.find(d => d.id === values.districtId);

      // 3. 添加到项目评估对象中
      let sampleDistrictId = districts.find(d => d.name === district?.name)?.id;

      // 如果区县不存在，先创建
      if (!sampleDistrictId && district) {
        const result = await sampleService.addDistrictSample(projectId, {
          name: district.name,
          code: district.code,
        });
        sampleDistrictId = result.id;
      }

      if (sampleDistrictId) {
        await sampleService.addSchoolSample(projectId, {
          parentId: sampleDistrictId,
          name: newSchool.name,
          code: newSchool.code,
          schoolType: newSchool.schoolType,
          teacherSampleMode: 'self',
        });
      }

      message.success('学校创建并添加成功');

      // 刷新数据
      loadSystemSchools();
      loadData();
    } catch (error: any) {
      console.error('创建学校失败:', error);
      message.error(error.message || '创建学校失败');
    }
  }, [projectId, systemDistricts, districts, loadData, loadSystemSchools]);

  // 删除区县
  const deleteDistrict = useCallback((districtId: string) => {
    if (!projectId) return;

    const district = districts.find(d => d.id === districtId);
    const schoolCount = district?.schools.length || 0;

    Modal.confirm({
      title: '确认删除区县',
      content: schoolCount > 0
        ? `删除区县将同时删除其下 ${schoolCount} 所学校，确定要删除吗？`
        : '确定要删除该区县吗？',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await sampleService.deleteSample(projectId, districtId);
          message.success('删除成功');
          loadData();
        } catch (error) {
          console.error('删除区县失败:', error);
          message.error('删除区县失败');
        }
      },
    });
  }, [projectId, districts, loadData]);

  // 删除学校
  const deleteSchool = useCallback((schoolId: string) => {
    if (!projectId) return;

    // 找到学校所属的区县
    const parentDistrict = districts.find(d => d.schools.some(s => s.id === schoolId));
    const isLastSchoolInDistrict = parentDistrict && parentDistrict.schools.length === 1;

    Modal.confirm({
      title: '确认删除学校',
      content: isLastSchoolInDistrict
        ? '这是该区县下的最后一所学校，删除后区县也将被移除，确定要删除吗？'
        : '确定要删除该学校吗？',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await sampleService.deleteSample(projectId, schoolId);

          // 如果是区县下最后一所学校，同时删除区县
          if (isLastSchoolInDistrict && parentDistrict) {
            await sampleService.deleteSample(projectId, parentDistrict.id);
            message.success('学校及空区县已删除');
          } else {
            message.success('删除成功');
          }

          loadData();
        } catch (error) {
          console.error('删除学校失败:', error);
          message.error('删除学校失败');
        }
      },
    });
  }, [projectId, districts, loadData]);

  // 批量删除学校（不弹确认框）
  const deleteSchoolDirect = useCallback(async (schoolId: string) => {
    if (!projectId) return;

    try {
      await sampleService.deleteSample(projectId, schoolId);
      loadData();
    } catch (error) {
      console.error('删除学校失败:', error);
      throw error;
    }
  }, [projectId, loadData]);

  // 按学校类型筛选后的区县数据
  const filteredDistricts = useMemo(() => {
    if (schoolTypeFilter === 'all') {
      return districts;
    }

    return districts.map(district => ({
      ...district,
      schools: district.schools.filter(school => school.schoolType === schoolTypeFilter),
    })).filter(district => district.schools.length > 0 || schoolTypeFilter === 'all');
  }, [districts, schoolTypeFilter]);

  // 筛选后的系统学校数据
  const filteredSystemDistricts = useMemo(() => {
    let result = systemDistricts;

    // 按学校类型筛选
    if (systemSchoolTypeFilter !== 'all') {
      result = result.map(d => ({
        ...d,
        schools: d.schools.filter(s => s.schoolType === systemSchoolTypeFilter),
      })).filter(d => d.schools.length > 0);
    }

    // 按关键字筛选
    if (systemSchoolKeyword.trim()) {
      const keyword = systemSchoolKeyword.trim().toLowerCase();
      result = result.map(d => ({
        ...d,
        schools: d.schools.filter(s =>
          s.name.toLowerCase().includes(keyword) ||
          s.code.toLowerCase().includes(keyword)
        ),
      })).filter(d => d.schools.length > 0);
    }

    return result;
  }, [systemDistricts, systemSchoolTypeFilter, systemSchoolKeyword]);

  // 获取所有区县（供填报账号Tab使用）
  const getAllDistricts = useCallback(() => {
    return districts.map(d => ({
      id: d.id,
      name: d.name,
      code: d.code,
    }));
  }, [districts]);

  // 获取所有学校（供填报账号Tab使用）
  const getAllSchools = useCallback(() => {
    return districts.flatMap(d =>
      d.schools.map(s => ({
        id: s.id,
        name: s.name,
        code: s.code,
        schoolType: s.schoolType,
        districtId: d.id,
        districtName: d.name,
      }))
    );
  }, [districts]);

  // 统计信息
  const statistics = useMemo(() => {
    const totalDistricts = districts.length;
    const totalSchools = districts.reduce((sum, d) => sum + d.schools.length, 0);
    const schoolsByType = districts.reduce((acc, d) => {
      d.schools.forEach(s => {
        acc[s.schoolType] = (acc[s.schoolType] || 0) + 1;
      });
      return acc;
    }, {} as Record<string, number>);

    return {
      totalDistricts,
      totalSchools,
      schoolsByType,
    };
  }, [districts]);

  // 根据区县ID获取区县名称
  const getDistrictById = useCallback((districtId: string) => {
    return districts.find(d => d.id === districtId);
  }, [districts]);

  // 批量导入学校（从Excel解析后的数据）
  const importSchools = useCallback(async (
    importDistricts: Array<{
      code: string;
      name: string;
      schools: Array<{
        schoolCode: string;
        schoolName: string;
        schoolType: string;
      }>;
    }>
  ): Promise<{ success: number; failed: number; errors: string[] }> => {
    if (!projectId) {
      return { success: 0, failed: 0, errors: ['项目ID不存在'] };
    }

    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    // 逐个处理区县及其学校
    for (const importDistrict of importDistricts) {
      try {
        // 检查区县是否已存在
        let districtId = districts.find(d => d.name === importDistrict.name)?.id;

        // 如果不存在，创建新区县
        if (!districtId) {
          const result = await sampleService.addDistrictSample(projectId, {
            name: importDistrict.name,
            code: importDistrict.code,
          });
          districtId = result.id;
        }

        // 添加学校（去重）
        for (const school of importDistrict.schools) {
          // 检查是否已存在
          if (isSchoolSelected(school.schoolCode)) {
            continue; // 跳过已存在的
          }

          try {
            await sampleService.addSchoolSample(projectId, {
              parentId: districtId,
              name: school.schoolName,
              code: school.schoolCode,
              schoolType: school.schoolType,
              teacherSampleMode: 'self',
            });
            success++;
          } catch (err) {
            failed++;
            errors.push(`学校 "${school.schoolName}" 导入失败`);
            console.error(`添加学校失败: ${school.schoolName}`, err);
          }
        }
      } catch (err) {
        failed += importDistrict.schools.length;
        errors.push(`区县 "${importDistrict.name}" 及其下属学校导入失败`);
        console.error(`处理区县失败: ${importDistrict.name}`, err);
      }
    }

    // 刷新数据
    await loadData();

    return { success, failed, errors };
  }, [projectId, districts, loadData, isSchoolSelected]);

  return {
    // 已选数据
    districts,
    filteredDistricts,
    expandedDistricts,
    loading,
    schoolTypeFilter,
    setSchoolTypeFilter,
    toggleDistrictExpand,

    // 系统学校数据
    systemDistricts,
    filteredSystemDistricts,
    systemLoading,
    systemSchoolKeyword,
    setSystemSchoolKeyword,
    systemSchoolTypeFilter,
    setSystemSchoolTypeFilter,
    loadSystemSchools,

    // 选择相关
    isSchoolSelected,
    addSchoolsFromSystem,
    createAndAddSchool,

    // 旧接口（兼容）
    addDistrict,
    addSchool,
    deleteDistrict,
    deleteSchool,
    deleteSchoolDirect,

    // 工具方法
    getAllDistricts,
    getAllSchools,
    getDistrictById,
    statistics,
    loadData,
    importSchools,
  };
}
