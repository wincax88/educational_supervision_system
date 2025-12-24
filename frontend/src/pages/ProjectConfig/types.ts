/**
 * 项目配置页面类型定义
 */

// 人员类型
export interface Personnel {
  id: string;
  name: string;
  organization: string;
  phone: string;
  idCard: string;
  role: string;
  districtId?: string;     // 关联区县ID（数据采集员使用）
  districtName?: string;   // 关联区县名称
}

// 样本数据对象配置
export interface SampleDataConfig {
  district: boolean;
  school: boolean;
  grade: boolean;
  class: boolean;
  student: boolean;
  parent: boolean;
  department: boolean;
  teacher: boolean;
}

// 教师样本
export interface TeacherSample {
  id: string;
  name: string;
  phone: string;
}

// 学校样本
export interface SchoolSample {
  id: string;
  name: string;
  type: 'school';
  teacherSampleMode: 'self' | 'assigned';
  teachers: TeacherSample[];
}

// 区县样本
export interface DistrictSample {
  id: string;
  name: string;
  type: 'district';
  schools: SchoolSample[];
}

// 导入人员记录状态
export type ImportStatus = 'confirmed' | 'new' | 'name_conflict' | 'id_conflict' | 'phone_conflict';

// 导入记录
export interface ImportRecord {
  id: string;
  status: ImportStatus;
  role: string;
  name: string;
  organization: string;
  phone: string;
  idCard: string;
  districtId?: string;  // 负责区县ID（数据采集员专用）
}

// 角色信息
export interface RoleInfo {
  name: string;
  desc: string;
}

// 导入状态信息
export interface ImportStatusInfo {
  text: string;
  color: string;
  icon: string;
}

// Tab 键值
export type TabKey = 'sample' | 'indicator' | 'data' | 'review' | 'personnel';

// 人员表单值
export interface PersonnelFormValues {
  role: string;
  name: string;
  organization: string;
  phone: string;
  idCard?: string;
  districtId?: string;   // 数据采集员关联的区县ID
}

// 样本表单值
export interface SampleFormValues {
  type: 'district' | 'school';
  name: string;
}

// 教师表单值
export interface TeacherFormValues {
  name: string;
  phone?: string;
  idCard?: string;
}
