import React, { useState, useEffect, useMemo } from 'react';
import { Button, Tag, Modal, Form, Input, Select, message, Radio } from 'antd';
import {
  ArrowLeftOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  FileTextOutlined,
  SaveOutlined,
  LinkOutlined,
  FormOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import styles from './index.module.css';
import { dataTools, DataTool, formSchemas } from '../../mock/data';

// 扁平化的表单字段项（用于选择器）
interface FlattenedField {
  id: string;
  label: string;
  type: string;
  path: string; // 完整路径，如 "分组名 > 字段名"
}

// 要素类型
type ElementType = '基础要素' | '派生要素';

// 数据类型
type DataType = '文本' | '数字' | '日期' | '时间' | '逻辑' | '数组' | '文件';

// 要素接口
interface Element {
  id: string;
  code: string;
  name: string;
  elementType: ElementType;
  dataType: DataType;
  formula?: string; // 派生要素的计算公式
  toolId?: string; // 关联的数据采集工具ID
  fieldId?: string; // 关联的表单控件ID
  fieldLabel?: string; // 关联的表单控件标签（用于显示）
}

// 要素库接口
interface ElementLibrary {
  id: string;
  name: string;
  description: string;
  status: '未发布' | '已发布';
  elementCount: number;
  elements: Element[];
}

// 优质均衡评估要素库 - 根据Excel表格计算需求自动生成
const mockElementLibrary: ElementLibrary = {
  id: '1',
  name: '义务教育优质均衡发展评估要素库',
  description: '用于义务教育优质均衡发展县（市、区）评估的数据要素，涵盖基本情况、资源配置、政府保障、教育质量、社会认可度等维度。',
  status: '未发布',
  elementCount: 120,
  elements: [
    // ========== 表1: 基本情况 - 自然情况 ==========
    { id: 'L1_01', code: 'L1_01', name: '人口总数（万人）', elementType: '基础要素', dataType: '数字', toolId: '9', fieldId: 'total_population', fieldLabel: '一、基础信息 > 人口总数' },
    { id: 'L1_02', code: 'L1_02', name: '农业人口数（万人）', elementType: '基础要素', dataType: '数字', toolId: '9', fieldId: 'agricultural_population', fieldLabel: '一、基础信息 > 农业人口数' },
    { id: 'L1_03', code: 'L1_03', name: '乡镇数（个）', elementType: '基础要素', dataType: '数字', toolId: '9', fieldId: 'township_count', fieldLabel: '一、基础信息 > 乡镇数' },
    { id: 'L1_04', code: 'L1_04', name: '行政村数（个）', elementType: '基础要素', dataType: '数字', toolId: '9', fieldId: 'village_count', fieldLabel: '一、基础信息 > 行政村数' },
    // 表1: 经济情况
    { id: 'L1_05', code: 'L1_05', name: '年人均国内生产总值（元）', elementType: '基础要素', dataType: '数字', toolId: '9', fieldId: 'gdp_per_capita', fieldLabel: '一、基础信息 > 年人均国内生产总值' },
    { id: 'L1_06', code: 'L1_06', name: '年人均地方财政收入（元）', elementType: '基础要素', dataType: '数字', toolId: '9', fieldId: 'fiscal_revenue_per_capita', fieldLabel: '一、基础信息 > 年人均地方财政收入' },
    { id: 'L1_07', code: 'L1_07', name: '农民年人均纯收入（元）', elementType: '基础要素', dataType: '数字', toolId: '9', fieldId: 'farmer_income_per_capita', fieldLabel: '一、基础信息 > 农民年人均纯收入' },
    { id: 'L1_08', code: 'L1_08', name: '城镇居民年人均可支配收入（元）', elementType: '基础要素', dataType: '数字', toolId: '9', fieldId: 'urban_income_per_capita', fieldLabel: '一、基础信息 > 城镇居民年人均可支配收入' },
    // 表1: 学校数
    { id: 'L1_09', code: 'L1_09', name: '小学数（所）', elementType: '基础要素', dataType: '数字', toolId: '9', fieldId: 'primary_school_count', fieldLabel: '一、基础信息 > 普通小学' },
    { id: 'L1_10', code: 'L1_10', name: '九年一贯制学校数（所）', elementType: '基础要素', dataType: '数字', toolId: '9', fieldId: 'nine_year_school_count', fieldLabel: '一、基础信息 > 九年一贯制学校' },
    { id: 'L1_11', code: 'L1_11', name: '初中数（所）', elementType: '基础要素', dataType: '数字', toolId: '9', fieldId: 'junior_high_count', fieldLabel: '一、基础信息 > 独立初中' },
    { id: 'L1_12', code: 'L1_12', name: '完全中学数（所）', elementType: '基础要素', dataType: '数字', toolId: '9', fieldId: 'complete_high_school_count', fieldLabel: '一、基础信息 > 完全中学' },
    { id: 'L1_13', code: 'L1_13', name: '十二年一贯制学校数（所）', elementType: '基础要素', dataType: '数字', toolId: '9', fieldId: 'twelve_year_school_count', fieldLabel: '一、基础信息 > 十二年一贯制学校' },
    { id: 'L1_14', code: 'L1_14', name: '特殊教育学校数（所）', elementType: '基础要素', dataType: '数字', toolId: '9', fieldId: 'special_education_school_count', fieldLabel: '一、基础信息 > 特殊教育学校' },
    { id: 'L1_15', code: 'L1_15', name: '小学教学点数（个）', elementType: '基础要素', dataType: '数字', toolId: '9', fieldId: 'primary_teaching_point_count', fieldLabel: '一、基础信息 > 小学教学点数' },
    { id: 'L1_16', code: 'L1_16', name: '50人及以上教学点数（个）', elementType: '基础要素', dataType: '数字', toolId: '9', fieldId: 'primary_teaching_point_50_plus', fieldLabel: '一、基础信息 > 50人及以上小学教学点数' },
    // 表1: 教学班数、学生数、教职工数
    { id: 'L1_17', code: 'L1_17', name: '小学教学班数（个）', elementType: '基础要素', dataType: '数字', toolId: '9', fieldId: 'primary_class_count', fieldLabel: '一、基础信息 > 小学教学班数' },
    { id: 'L1_18', code: 'L1_18', name: '初中教学班数（个）', elementType: '基础要素', dataType: '数字', toolId: '9', fieldId: 'junior_class_count', fieldLabel: '一、基础信息 > 初中教学班数' },
    { id: 'L1_19', code: 'L1_19', name: '小学在校学生数（人）', elementType: '基础要素', dataType: '数字', toolId: '9', fieldId: 'primary_student_count', fieldLabel: '一、基础信息 > 小学在校学生数' },
    { id: 'L1_20', code: 'L1_20', name: '初中在校学生数（人）', elementType: '基础要素', dataType: '数字', toolId: '9', fieldId: 'junior_student_count', fieldLabel: '一、基础信息 > 初中在校学生数' },
    { id: 'L1_21', code: 'L1_21', name: '小学教职工合计（人）', elementType: '基础要素', dataType: '数字', toolId: '9', fieldId: 'primary_staff_count', fieldLabel: '一、基础信息 > 小学教职工数' },
    { id: 'L1_22', code: 'L1_22', name: '小学专任教师数（人）', elementType: '基础要素', dataType: '数字', toolId: '9', fieldId: 'primary_teacher_count', fieldLabel: '一、基础信息 > 小学专任教师数' },
    { id: 'L1_23', code: 'L1_23', name: '初中教职工合计（人）', elementType: '基础要素', dataType: '数字', toolId: '9', fieldId: 'junior_staff_count', fieldLabel: '一、基础信息 > 初中教职工数' },
    { id: 'L1_24', code: 'L1_24', name: '初中专任教师数（人）', elementType: '基础要素', dataType: '数字', toolId: '9', fieldId: 'junior_teacher_count', fieldLabel: '一、基础信息 > 初中专任教师数' },

    // ========== 表2: 资源配置 - 学校级采集 ==========
    { id: 'R2_01', code: 'R2_01', name: '学校在校生数', elementType: '基础要素', dataType: '数字', toolId: '8', fieldId: 'student_count', fieldLabel: '二、资源配置 > 学生人数（在校人数）' },
    // 原始数组数据
    { id: 'R2_A01', code: 'R2_A01', name: '各年级在校人数数组', elementType: '基础要素', dataType: '数组', toolId: '8', fieldId: 'grade_student_list', fieldLabel: '四、教育质量 > 各年级在校人数' },
    { id: 'R2_A02', code: 'R2_A02', name: '班级人数数组', elementType: '基础要素', dataType: '数组', toolId: '8', fieldId: 'class_student_list', fieldLabel: '三、政府保障 > 班级人数' },
    // 由数组派生的计数
    { id: 'R2_02', code: 'R2_02', name: '学校年级数', elementType: '派生要素', dataType: '数字', formula: 'COUNT(R2_A01)' },
    { id: 'R2_03', code: 'R2_03', name: '学校班级数', elementType: '派生要素', dataType: '数字', formula: 'COUNT(R2_A02)' },
    { id: 'R2_04', code: 'R2_04', name: '高于规定学历教师数', elementType: '基础要素', dataType: '数字', toolId: '8', fieldId: 'master_degree_teacher_count', fieldLabel: '二、资源配置 > 硕士研究生毕业学历教师人数' },
    { id: 'R2_05', code: 'R2_05', name: '县级及以上骨干教师数', elementType: '基础要素', dataType: '数字', toolId: '8', fieldId: 'county_backbone_teacher_count', fieldLabel: '二、资源配置 > 县级及以上骨干教师人数' },
    { id: 'R2_06', code: 'R2_06', name: '体育艺术专任教师数', elementType: '基础要素', dataType: '数字', toolId: '8', fieldId: 'pe_teacher_count', fieldLabel: '二、资源配置 > 体育专任教师人数' },
    { id: 'R2_07', code: 'R2_07', name: '教学及辅助用房面积（㎡）', elementType: '基础要素', dataType: '数字', toolId: '8', fieldId: 'teaching_auxiliary_area', fieldLabel: '二、资源配置 > 教学及辅助用房总面积' },
    { id: 'R2_08', code: 'R2_08', name: '体育运动场馆面积（㎡）', elementType: '基础要素', dataType: '数字', toolId: '8', fieldId: 'sports_field_area', fieldLabel: '二、资源配置 > 运动场地面积' },
    { id: 'R2_09', code: 'R2_09', name: '教学仪器设备值（元）', elementType: '基础要素', dataType: '数字', toolId: '8', fieldId: 'teaching_equipment_value', fieldLabel: '二、资源配置 > 教学仪器设备资产值（账面原值）' },
    { id: 'R2_10', code: 'R2_10', name: '网络多媒体教室数（间）', elementType: '基础要素', dataType: '数字', toolId: '8', fieldId: 'multimedia_classroom_count', fieldLabel: '二、资源配置 > 网络多媒体教室间数' },

    // 资源配置 - 派生指标
    { id: 'R2_D01', code: 'R2_D01', name: '每百名学生拥有高于规定学历教师数', elementType: '派生要素', dataType: '数字', formula: '(R2_04 / R2_01) * 100' },
    { id: 'R2_D02', code: 'R2_D02', name: '每百名学生拥有县级及以上骨干教师数', elementType: '派生要素', dataType: '数字', formula: '(R2_05 / R2_01) * 100' },
    { id: 'R2_D03', code: 'R2_D03', name: '每百名学生拥有体育艺术专任教师数', elementType: '派生要素', dataType: '数字', formula: '(R2_06 / R2_01) * 100' },
    { id: 'R2_D04', code: 'R2_D04', name: '生均教学及辅助用房面积（㎡）', elementType: '派生要素', dataType: '数字', formula: 'R2_07 / R2_01' },
    { id: 'R2_D05', code: 'R2_D05', name: '生均体育运动场馆面积（㎡）', elementType: '派生要素', dataType: '数字', formula: 'R2_08 / R2_01' },
    { id: 'R2_D06', code: 'R2_D06', name: '生均教学仪器设备值（元）', elementType: '派生要素', dataType: '数字', formula: 'R2_09 / R2_01' },
    { id: 'R2_D07', code: 'R2_D07', name: '每百名学生拥有网络多媒体教室数', elementType: '派生要素', dataType: '数字', formula: '(R2_10 / R2_01) * 100' },

    // ========== 表4: 政府保障程度 ==========
    // 4.3 音乐美术专用教室
    { id: 'G4_01', code: 'G4_01', name: '音乐专用教室数（间）', elementType: '基础要素', dataType: '数字', toolId: '8', fieldId: 'music_classroom_list', fieldLabel: '三、政府保障 > 音乐教室面积' },
    { id: 'G4_02', code: 'G4_02', name: '美术专用教室数（间）', elementType: '基础要素', dataType: '数字', toolId: '8', fieldId: 'art_classroom_list', fieldLabel: '三、政府保障 > 美术教室面积' },
    { id: 'G4_03', code: 'G4_03', name: '音乐教室面积1（㎡）', elementType: '基础要素', dataType: '数字', toolId: '8', fieldId: 'music_classroom_list.music_room_area', fieldLabel: '三、政府保障 > 音乐教室面积 > 教室面积' },
    { id: 'G4_04', code: 'G4_04', name: '美术教室面积1（㎡）', elementType: '基础要素', dataType: '数字', toolId: '8', fieldId: 'art_classroom_list.art_room_area', fieldLabel: '三、政府保障 > 美术教室面积 > 教室面积' },
    // 4.4 学校规模
    { id: 'G4_05', code: 'G4_05', name: '全校中小学生数', elementType: '基础要素', dataType: '数字', toolId: '8', fieldId: 'student_count', fieldLabel: '二、资源配置 > 学生人数（在校人数）' },
    { id: 'G4_06', code: 'G4_06', name: '超过2000人的小学数', elementType: '派生要素', dataType: '数字', formula: 'COUNT(G4_05 > 2000 AND 学校类型=小学)' },
    { id: 'G4_07', code: 'G4_07', name: '超过2000人的初中数', elementType: '派生要素', dataType: '数字', formula: 'COUNT(G4_05 > 2000 AND 学校类型=初中)' },
    // 4.5 班额
    { id: 'G4_08', code: 'G4_08', name: '最大班额学生数', elementType: '基础要素', dataType: '数字', toolId: '8', fieldId: 'class_student_list.class_student_count', fieldLabel: '三、政府保障 > 班级人数 > 人数' },
    { id: 'G4_09', code: 'G4_09', name: '超过45人的小学班级数', elementType: '基础要素', dataType: '数字', toolId: '8', fieldId: 'class_student_list', fieldLabel: '三、政府保障 > 班级人数' },
    { id: 'G4_10', code: 'G4_10', name: '超过50人的初中班级数', elementType: '基础要素', dataType: '数字', toolId: '8', fieldId: 'class_student_list', fieldLabel: '三、政府保障 > 班级人数' },
    // 4.6 小规模学校公用经费
    // 原始数组数据（学校级）
    { id: 'G4_A01', code: 'G4_A01', name: '各学校在校生数数组', elementType: '基础要素', dataType: '数组', toolId: '8', fieldId: 'student_count', fieldLabel: '二、资源配置 > 学生人数（在校人数）' },
    { id: 'G4_A02', code: 'G4_A02', name: '各学校公用经费数组', elementType: '基础要素', dataType: '数组', toolId: '8', fieldId: 'public_funding', fieldLabel: '三、政府保障 > 学校公用经费' },
    // 条件求和派生
    { id: 'G4_11', code: 'G4_11', name: '不足100人学校学生数', elementType: '派生要素', dataType: '数字', formula: 'SUMIF(G4_A01, "<100")' },
    { id: 'G4_12', code: 'G4_12', name: '不足100人学校公用经费（元）', elementType: '派生要素', dataType: '数字', formula: 'SUMIF(G4_A02, G4_A01, "<100")' },
    // 4.7 特殊教育
    { id: 'G4_13', code: 'G4_13', name: '特殊教育学校公用经费（万元）', elementType: '基础要素', dataType: '数字', toolId: '9' },
    { id: 'G4_14', code: 'G4_14', name: '特殊教育学生数（人）', elementType: '基础要素', dataType: '数字', toolId: '9' },
    { id: 'G4_D01', code: 'G4_D01', name: '特殊教育生均公用经费（元）', elementType: '派生要素', dataType: '数字', formula: '(G4_13 * 10000) / G4_14' },
    // 4.8 教师工资
    { id: 'G4_15', code: 'G4_15', name: '义务教育教师年平均工资收入（元）', elementType: '基础要素', dataType: '数字', toolId: '9', fieldId: 'teacher_avg_salary', fieldLabel: '二、政府保障程度 > 上年度义务教育学校教师年平均工资收入水平' },
    { id: 'G4_16', code: 'G4_16', name: '当地公务员年平均工资收入（元）', elementType: '基础要素', dataType: '数字', toolId: '9', fieldId: 'civil_servant_avg_salary', fieldLabel: '二、政府保障程度 > 上年度公务员年平均工资收入水平' },
    // 4.9 教师培训
    // 原始数组数据（学校级）
    { id: 'G4_A03', code: 'G4_A03', name: '各学校完成培训教师数数组', elementType: '基础要素', dataType: '数组', toolId: '8', fieldId: 'trained_teacher_count', fieldLabel: '二、资源配置 > 近5年培训满360学时专任教师人数' },
    // 汇总派生
    { id: 'G4_17', code: 'G4_17', name: '完成360学时培训的教师数', elementType: '派生要素', dataType: '数字', formula: 'SUM(G4_A03)' },
    { id: 'G4_18', code: 'G4_18', name: '全县教师总数', elementType: '派生要素', dataType: '数字', formula: 'L1_22 + L1_24' },
    { id: 'G4_D02', code: 'G4_D02', name: '教师培训完成率（%）', elementType: '派生要素', dataType: '数字', formula: '(G4_17 / G4_18) * 100' },
    // 4.11 教师交流轮岗
    { id: 'G4_19', code: 'G4_19', name: '符合交流轮岗条件教师总数', elementType: '基础要素', dataType: '数字', toolId: '9', fieldId: 'exchange_eligible_teacher_count', fieldLabel: '二、政府保障程度 > 符合交流轮岗条件教师总数' },
    { id: 'G4_20', code: 'G4_20', name: '上一年度交流轮岗教师数', elementType: '基础要素', dataType: '数字', toolId: '9', fieldId: 'actual_exchange_teacher_count', fieldLabel: '二、政府保障程度 > 实际交流轮岗教师数' },
    { id: 'G4_21', code: 'G4_21', name: '交流轮岗的骨干教师数', elementType: '基础要素', dataType: '数字', toolId: '9', fieldId: 'actual_exchange_backbone_count', fieldLabel: '二、政府保障程度 > 实际交流骨干教师数量' },
    { id: 'G4_D03', code: 'G4_D03', name: '交流轮岗教师比例（%）', elementType: '派生要素', dataType: '数字', formula: '(G4_20 / G4_19) * 100' },
    { id: 'G4_D04', code: 'G4_D04', name: '骨干教师占交流轮岗教师比例（%）', elementType: '派生要素', dataType: '数字', formula: '(G4_21 / G4_20) * 100' },
    // 4.12 教师资格证
    // 原始数组数据（学校级）
    { id: 'G4_A04', code: 'G4_A04', name: '各学校专任教师总人数数组', elementType: '基础要素', dataType: '数组', toolId: '8', fieldId: 'full_time_teacher_count', fieldLabel: '二、资源配置 > 专任教师总人数' },
    { id: 'G4_A05', code: 'G4_A05', name: '各学校持有教师资格证的专任教师人数数组', elementType: '基础要素', dataType: '数组', toolId: '8', fieldId: 'certified_teacher_count', fieldLabel: '二、资源配置 > 持有教师资格证的专任教师人数' },
    // 汇总派生
    { id: 'G4_22', code: 'G4_22', name: '在岗专任教师总数', elementType: '派生要素', dataType: '数字', formula: 'SUM(G4_A04)' },
    { id: 'G4_23', code: 'G4_23', name: '持有教师资格证的专任教师数', elementType: '派生要素', dataType: '数字', formula: 'SUM(G4_A05)' },
    { id: 'G4_D05', code: 'G4_D05', name: '教师资格证持证上岗率（%）', elementType: '派生要素', dataType: '数字', formula: '(G4_23 / G4_22) * 100' },
    // 4.13 就近划片入学
    { id: 'G4_24', code: 'G4_24', name: '城镇区公办小学就近划片入学比例（%）', elementType: '基础要素', dataType: '数字', toolId: '9', fieldId: 'primary_nearby_enrollment_rate', fieldLabel: '二、政府保障程度 > 小学就近划片入学比例' },
    { id: 'G4_25', code: 'G4_25', name: '城镇区公办初中就近划片入学比例（%）', elementType: '基础要素', dataType: '数字', toolId: '9', fieldId: 'junior_nearby_enrollment_rate', fieldLabel: '二、政府保障程度 > 初中就近划片入学比例' },
    // 4.14 优质高中招生
    { id: 'G4_26', code: 'G4_26', name: '优质高中招生名额总数', elementType: '基础要素', dataType: '数字', toolId: '9', fieldId: 'quality_high_school_enrollment_plan', fieldLabel: '二、政府保障程度 > 优质高中招生计划总人数' },
    { id: 'G4_27', code: 'G4_27', name: '分配名额数', elementType: '基础要素', dataType: '数字', toolId: '9', fieldId: 'quality_high_school_quota_allocation', fieldLabel: '二、政府保障程度 > 优质高中招生分配指标数' },
    { id: 'G4_28', code: 'G4_28', name: '分配农村学校名额数', elementType: '基础要素', dataType: '数字', toolId: '9', fieldId: 'quality_high_school_rural_quota', fieldLabel: '二、政府保障程度 > 优质高中招生向农村学校分配指标数' },
    { id: 'G4_D06', code: 'G4_D06', name: '优质高中名额分配比例（%）', elementType: '派生要素', dataType: '数字', formula: '(G4_27 / G4_26) * 100' },
    { id: 'G4_D07', code: 'G4_D07', name: '农村学校分配名额占比（%）', elementType: '派生要素', dataType: '数字', formula: '(G4_28 / G4_27) * 100' },
    // 4.15 随迁子女
    { id: 'G4_29', code: 'G4_29', name: '符合条件的随迁子女总数', elementType: '基础要素', dataType: '数字', toolId: '9', fieldId: 'eligible_migrant_children_count', fieldLabel: '二、政府保障程度 > 符合条件的随迁子女总人数' },
    { id: 'G4_30', code: 'G4_30', name: '在公办学校就读的随迁子女数', elementType: '基础要素', dataType: '数字', toolId: '9', fieldId: 'migrant_in_public_school_count', fieldLabel: '二、政府保障程度 > 在县域内公办学校就读的随迁子女人数' },
    { id: 'G4_31', code: 'G4_31', name: '在政府购买服务民办学校就读的随迁子女数', elementType: '基础要素', dataType: '数字', toolId: '9', fieldId: 'migrant_in_private_school_count', fieldLabel: '二、政府保障程度 > 在政府购买服务的县域内民办学校就读的随迁子女人数' },
    { id: 'G4_D08', code: 'G4_D08', name: '随迁子女就读比例（%）', elementType: '派生要素', dataType: '数字', formula: '((G4_30 + G4_31) / G4_29) * 100' },

    // ========== 表5: 教育质量 ==========
    // 5.1 初中三年巩固率
    // 原始数组数据（学校级）
    { id: 'Q5_A01', code: 'Q5_A01', name: '各学校毕业学生人数数组', elementType: '基础要素', dataType: '数组', toolId: '8', fieldId: 'graduate_count', fieldLabel: '四、巩固率 > 毕业学生人数' },
    { id: 'Q5_A02', code: 'Q5_A02', name: '各学校毕业年级三年前初一时在校学生人数数组', elementType: '基础要素', dataType: '数组', toolId: '8', fieldId: 'grade7_student_count_3years_ago', fieldLabel: '四、巩固率 > 毕业年级三年前初一时在校学生人数' },
    { id: 'Q5_A03', code: 'Q5_A03', name: '各学校毕业年级三年转入学生人数数组', elementType: '基础要素', dataType: '数组', toolId: '8', fieldId: 'transfer_in_count_3years', fieldLabel: '四、巩固率 > 毕业年级三年转入学生人数' },
    { id: 'Q5_A04', code: 'Q5_A04', name: '各学校毕业年级三年死亡学生人数数组', elementType: '基础要素', dataType: '数组', toolId: '8', fieldId: 'deceased_count_3years', fieldLabel: '四、巩固率 > 毕业年级三年死亡学生人数' },
    { id: 'Q5_A05', code: 'Q5_A05', name: '各学校毕业年级三年转出学生人数数组', elementType: '基础要素', dataType: '数组', toolId: '8', fieldId: 'transfer_out_count_3years', fieldLabel: '四、巩固率 > 毕业年级三年转出学生人数' },
    // 汇总派生
    { id: 'Q5_01', code: 'Q5_01', name: '初中毕业班学生数', elementType: '派生要素', dataType: '数字', formula: 'SUM(Q5_A01)' },
    { id: 'Q5_02', code: 'Q5_02', name: '三年前该年级入学学生数', elementType: '派生要素', dataType: '数字', formula: 'SUM(Q5_A02)' },
    { id: 'Q5_03', code: 'Q5_03', name: '毕业年级三年转入学生数', elementType: '派生要素', dataType: '数字', formula: 'SUM(Q5_A03)' },
    { id: 'Q5_04', code: 'Q5_04', name: '死亡学生数', elementType: '派生要素', dataType: '数字', formula: 'SUM(Q5_A04)' },
    { id: 'Q5_05', code: 'Q5_05', name: '转出学生数', elementType: '派生要素', dataType: '数字', formula: 'SUM(Q5_A05)' },
    { id: 'Q5_D01', code: 'Q5_D01', name: '初中三年巩固率（%）', elementType: '派生要素', dataType: '数字', formula: '(Q5_01 / (Q5_02 + Q5_03 - Q5_04 - Q5_05)) * 100' },
    // 5.2 残疾儿童入学率
    { id: 'Q5_06', code: 'Q5_06', name: '全县残疾儿童少年总数', elementType: '基础要素', dataType: '数字', toolId: '9', fieldId: 'disabled_children_population', fieldLabel: '三、教育质量 > 适龄残疾儿童少年人口总数' },
    { id: 'Q5_07', code: 'Q5_07', name: '残疾儿童少年入学数', elementType: '基础要素', dataType: '数字', toolId: '9', fieldId: 'disabled_children_enrollment', fieldLabel: '三、教育质量 > 适龄残疾儿童少年入学总人数' },
    // 原始数组数据（学校级）
    { id: 'Q5_A08', code: 'Q5_A08', name: '各学校特殊教育班在校生人数数组', elementType: '基础要素', dataType: '数组', toolId: '8', fieldId: 'special_education_student_count', fieldLabel: '一、基础信息 > 残疾儿童、少年特殊教育班在校生人数' },
    // 汇总派生
    { id: 'Q5_08', code: 'Q5_08', name: '在特殊教育学校就读残疾学生数', elementType: '派生要素', dataType: '数字', formula: 'SUM(Q5_A08)' },
    { id: 'Q5_D02', code: 'Q5_D02', name: '残疾儿童少年入学率（%）', elementType: '派生要素', dataType: '数字', formula: '(Q5_07 / Q5_06) * 100' },
    { id: 'Q5_D03', code: 'Q5_D03', name: '特教学校就读占比（%）', elementType: '派生要素', dataType: '数字', formula: '(Q5_08 / Q5_07) * 100' },
    // 5.4 教师培训经费
    // 原始数组数据（学校级）
    { id: 'Q5_A06', code: 'Q5_A06', name: '各学校公用经费总数数组', elementType: '基础要素', dataType: '数组', toolId: '8', fieldId: 'public_funding_total', fieldLabel: '三、政府保障 > 校公用经费总数' },
    { id: 'Q5_A07', code: 'Q5_A07', name: '各学校教师培训经费数组', elementType: '基础要素', dataType: '数组', toolId: '8', fieldId: 'teacher_training_funding', fieldLabel: '三、政府保障 > 上年度教师培训经费决算总额' },
    // 汇总派生
    { id: 'Q5_09', code: 'Q5_09', name: '学校年度公用经费总额（万元）', elementType: '派生要素', dataType: '数字', formula: 'SUM(Q5_A06)' },
    { id: 'Q5_10', code: 'Q5_10', name: '教师培训经费安排（万元）', elementType: '派生要素', dataType: '数字', formula: 'SUM(Q5_A07)' },
    { id: 'Q5_D04', code: 'Q5_D04', name: '教师培训经费占比（%）', elementType: '派生要素', dataType: '数字', formula: '(Q5_10 / Q5_09) * 100' },
    // 5.9 质量监测
    { id: 'Q5_11', code: 'Q5_11', name: '语文学业水平等级', elementType: '基础要素', dataType: '文本', toolId: '9', fieldId: 'chinese_achievement_level', fieldLabel: '三、教育质量 > 国家义务教育质量监测语文学业水平' },
    { id: 'Q5_12', code: 'Q5_12', name: '语文校际差异率', elementType: '基础要素', dataType: '数字', toolId: '9', fieldId: 'chinese_difference_rate', fieldLabel: '三、教育质量 > 语文校际差异率' },
    { id: 'Q5_13', code: 'Q5_13', name: '数学学业水平等级', elementType: '基础要素', dataType: '文本', toolId: '9', fieldId: 'math_achievement_level', fieldLabel: '三、教育质量 > 国家义务教育质量监测数学学业水平' },
    { id: 'Q5_14', code: 'Q5_14', name: '数学校际差异率', elementType: '基础要素', dataType: '数字', toolId: '9', fieldId: 'math_difference_rate', fieldLabel: '三、教育质量 > 数学校际差异率' },
    { id: 'Q5_15', code: 'Q5_15', name: '科学学业水平等级', elementType: '基础要素', dataType: '文本', toolId: '9', fieldId: 'science_achievement_level', fieldLabel: '三、教育质量 > 国家义务教育质量监测科学学业水平' },
    { id: 'Q5_16', code: 'Q5_16', name: '科学校际差异率', elementType: '基础要素', dataType: '数字', toolId: '9', fieldId: 'science_difference_rate', fieldLabel: '三、教育质量 > 科学校际差异率' },
    { id: 'Q5_17', code: 'Q5_17', name: '体育学业水平等级', elementType: '基础要素', dataType: '文本', toolId: '9', fieldId: 'pe_achievement_level', fieldLabel: '三、教育质量 > 国家义务教育质量监测体育学业水平' },
    { id: 'Q5_18', code: 'Q5_18', name: '体育校际差异率', elementType: '基础要素', dataType: '数字', toolId: '9', fieldId: 'pe_difference_rate', fieldLabel: '三、教育质量 > 体育校际差异率' },
    { id: 'Q5_19', code: 'Q5_19', name: '艺术学业水平等级', elementType: '基础要素', dataType: '文本', toolId: '9', fieldId: 'art_achievement_level', fieldLabel: '三、教育质量 > 国家义务教育质量监测艺术学业水平' },
    { id: 'Q5_20', code: 'Q5_20', name: '艺术校际差异率', elementType: '基础要素', dataType: '数字', toolId: '9', fieldId: 'art_difference_rate', fieldLabel: '三、教育质量 > 艺术校际差异率' },
    { id: 'Q5_21', code: 'Q5_21', name: '德育学业水平等级', elementType: '基础要素', dataType: '文本', toolId: '9', fieldId: 'moral_achievement_level', fieldLabel: '三、教育质量 > 国家义务教育质量监测德育学业水平' },
    { id: 'Q5_22', code: 'Q5_22', name: '德育校际差异率', elementType: '基础要素', dataType: '数字', toolId: '9', fieldId: 'moral_difference_rate', fieldLabel: '三、教育质量 > 德育校际差异率' },

    // ========== 表6: 社会认可度 ==========
    { id: 'S6_01', code: 'S6_01', name: '问卷总数', elementType: '基础要素', dataType: '数字', toolId: '9' },
    { id: 'S6_02', code: 'S6_02', name: '回收有效问卷数', elementType: '基础要素', dataType: '数字', toolId: '9' },
    { id: 'S6_03', code: 'S6_03', name: '满意问卷数', elementType: '基础要素', dataType: '数字', toolId: '9' },
    { id: 'S6_04', code: 'S6_04', name: '实地走访人数', elementType: '基础要素', dataType: '数字', toolId: '9' },
    { id: 'S6_05', code: 'S6_05', name: '实地走访满意人数', elementType: '基础要素', dataType: '数字', toolId: '9' },
    { id: 'S6_D01', code: 'S6_D01', name: '问卷调查综合满意度（%）', elementType: '派生要素', dataType: '数字', formula: '(S6_03 / S6_02) * 100' },
    { id: 'S6_D02', code: 'S6_D02', name: '实地走访满意度（%）', elementType: '派生要素', dataType: '数字', formula: '(S6_05 / S6_04) * 100' },

    // ========== 表3: 校际均衡差异系数（派生指标）==========
    { id: 'B3_D01', code: 'B3_D01', name: '小学高学历教师差异系数', elementType: '派生要素', dataType: '数字', formula: 'STDEV(R2_D01_小学) / AVG(R2_D01_小学)' },
    { id: 'B3_D02', code: 'B3_D02', name: '小学骨干教师差异系数', elementType: '派生要素', dataType: '数字', formula: 'STDEV(R2_D02_小学) / AVG(R2_D02_小学)' },
    { id: 'B3_D03', code: 'B3_D03', name: '小学体艺教师差异系数', elementType: '派生要素', dataType: '数字', formula: 'STDEV(R2_D03_小学) / AVG(R2_D03_小学)' },
    { id: 'B3_D04', code: 'B3_D04', name: '小学生均教学用房差异系数', elementType: '派生要素', dataType: '数字', formula: 'STDEV(R2_D04_小学) / AVG(R2_D04_小学)' },
    { id: 'B3_D05', code: 'B3_D05', name: '小学生均运动场馆差异系数', elementType: '派生要素', dataType: '数字', formula: 'STDEV(R2_D05_小学) / AVG(R2_D05_小学)' },
    { id: 'B3_D06', code: 'B3_D06', name: '小学生均仪器设备差异系数', elementType: '派生要素', dataType: '数字', formula: 'STDEV(R2_D06_小学) / AVG(R2_D06_小学)' },
    { id: 'B3_D07', code: 'B3_D07', name: '小学多媒体教室差异系数', elementType: '派生要素', dataType: '数字', formula: 'STDEV(R2_D07_小学) / AVG(R2_D07_小学)' },
    { id: 'B3_D08', code: 'B3_D08', name: '初中高学历教师差异系数', elementType: '派生要素', dataType: '数字', formula: 'STDEV(R2_D01_初中) / AVG(R2_D01_初中)' },
    { id: 'B3_D09', code: 'B3_D09', name: '初中骨干教师差异系数', elementType: '派生要素', dataType: '数字', formula: 'STDEV(R2_D02_初中) / AVG(R2_D02_初中)' },
    { id: 'B3_D10', code: 'B3_D10', name: '初中体艺教师差异系数', elementType: '派生要素', dataType: '数字', formula: 'STDEV(R2_D03_初中) / AVG(R2_D03_初中)' },
    { id: 'B3_D11', code: 'B3_D11', name: '初中生均教学用房差异系数', elementType: '派生要素', dataType: '数字', formula: 'STDEV(R2_D04_初中) / AVG(R2_D04_初中)' },
    { id: 'B3_D12', code: 'B3_D12', name: '初中生均运动场馆差异系数', elementType: '派生要素', dataType: '数字', formula: 'STDEV(R2_D05_初中) / AVG(R2_D05_初中)' },
    { id: 'B3_D13', code: 'B3_D13', name: '初中生均仪器设备差异系数', elementType: '派生要素', dataType: '数字', formula: 'STDEV(R2_D06_初中) / AVG(R2_D06_初中)' },
    { id: 'B3_D14', code: 'B3_D14', name: '初中多媒体教室差异系数', elementType: '派生要素', dataType: '数字', formula: 'STDEV(R2_D07_初中) / AVG(R2_D07_初中)' },
  ],
};

// 递归扁平化表单字段
const flattenFormFields = (fields: any[], parentPath: string = ''): FlattenedField[] => {
  const result: FlattenedField[] = [];

  fields.forEach(field => {
    const currentPath = parentPath ? `${parentPath} > ${field.label}` : field.label;

    // 跳过分组和分割线，只添加实际输入控件
    if (field.type !== 'group' && field.type !== 'divider') {
      result.push({
        id: field.id,
        label: field.label,
        type: field.type,
        path: currentPath,
      });
    }

    // 处理分组的子字段
    if (field.type === 'group' && field.children) {
      result.push(...flattenFormFields(field.children, field.label));
    }

    // 处理动态列表的子字段
    if (field.type === 'dynamicList') {
      const listFields = field.dynamicListFields || field.fields || [];
      listFields.forEach((childField: any) => {
        result.push({
          id: `${field.id}.${childField.id}`,
          label: childField.label,
          type: childField.type,
          path: `${currentPath} > ${childField.label}`,
        });
      });
    }
  });

  return result;
};

const IndicatorEdit: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [library, setLibrary] = useState<ElementLibrary | null>(null);
  const [selectedElement, setSelectedElement] = useState<Element | null>(null);

  // 弹窗状态
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);

  // 筛选状态: 'all' | 'unlinked' | 'linked'
  const [filterType, setFilterType] = useState<'all' | 'unlinked' | 'linked'>('all');

  const [addForm] = Form.useForm();
  const [editForm] = Form.useForm();

  // 监听要素类型变化
  const [addFormElementType, setAddFormElementType] = useState<ElementType>('基础要素');
  const [editFormElementType, setEditFormElementType] = useState<ElementType>('基础要素');

  // 监听选中的工具变化（用于级联选择控件）
  const [addFormToolId, setAddFormToolId] = useState<string | undefined>();
  const [editFormToolId, setEditFormToolId] = useState<string | undefined>();

  // 根据选中的工具获取可用的字段列表
  const addFormFields = useMemo(() => {
    if (!addFormToolId) return [];
    const schema = formSchemas[addFormToolId];
    return schema ? flattenFormFields(schema) : [];
  }, [addFormToolId]);

  const editFormFields = useMemo(() => {
    if (!editFormToolId) return [];
    const schema = formSchemas[editFormToolId];
    return schema ? flattenFormFields(schema) : [];
  }, [editFormToolId]);

  // 根据筛选条件过滤要素列表
  const filteredElements = useMemo(() => {
    if (!library) return [];
    return library.elements.filter(element => {
      if (filterType === 'all') return true;
      // 未关联：基础要素且有toolId但没有fieldId
      const isUnlinked = element.elementType === '基础要素' && element.toolId && !element.fieldId;
      if (filterType === 'unlinked') return isUnlinked;
      // 已关联：基础要素且有fieldId，或者派生要素
      if (filterType === 'linked') return !isUnlinked;
      return true;
    });
  }, [library, filterType]);

  // 统计未关联要素数量
  const unlinkedCount = useMemo(() => {
    if (!library) return 0;
    return library.elements.filter(el =>
      el.elementType === '基础要素' && el.toolId && !el.fieldId
    ).length;
  }, [library]);

  useEffect(() => {
    // 加载要素库数据
    if (id) {
      setLibrary(mockElementLibrary);
    }
  }, [id]);

  const handleSelectElement = (element: Element) => {
    setSelectedElement(element);
  };

  const handleAddElement = () => {
    addForm.resetFields();
    setAddFormElementType('基础要素');
    setAddFormToolId(undefined);
    setAddModalVisible(true);
  };

  const handleSaveAdd = (values: any) => {
    if (!library) return;

    // 获取选中字段的标签
    let fieldLabel: string | undefined;
    if (values.fieldId && addFormToolId) {
      const field = addFormFields.find(f => f.id === values.fieldId);
      fieldLabel = field?.path;
    }

    const newElement: Element = {
      id: `${Date.now()}`,
      code: values.code,
      name: values.name,
      elementType: values.elementType,
      dataType: values.dataType,
      formula: values.elementType === '派生要素' ? values.formula : undefined,
      toolId: values.elementType === '基础要素' ? values.toolId : undefined,
      fieldId: values.elementType === '基础要素' ? values.fieldId : undefined,
      fieldLabel: values.elementType === '基础要素' ? fieldLabel : undefined,
    };

    const updatedLibrary = {
      ...library,
      elements: [...library.elements, newElement],
      elementCount: library.elementCount + 1,
    };

    setLibrary(updatedLibrary);
    setAddModalVisible(false);
    setAddFormToolId(undefined);
    message.success('添加成功');
  };

  const handleEditElement = (element: Element) => {
    setSelectedElement(element);
    setEditFormElementType(element.elementType);
    setEditFormToolId(element.toolId);
    editForm.setFieldsValue({
      code: element.code,
      name: element.name,
      elementType: element.elementType,
      dataType: element.dataType,
      formula: element.formula,
      toolId: element.toolId,
      fieldId: element.fieldId,
    });
    setEditModalVisible(true);
  };

  const handleSaveEdit = (values: any) => {
    if (!library || !selectedElement) return;

    // 获取选中字段的标签
    let fieldLabel: string | undefined;
    if (values.fieldId && editFormToolId) {
      const field = editFormFields.find(f => f.id === values.fieldId);
      fieldLabel = field?.path;
    }

    const updatedElements = library.elements.map(el => {
      if (el.id === selectedElement.id) {
        return {
          ...el,
          code: values.code,
          name: values.name,
          elementType: values.elementType,
          dataType: values.dataType,
          formula: values.elementType === '派生要素' ? values.formula : undefined,
          toolId: values.elementType === '基础要素' ? values.toolId : undefined,
          fieldId: values.elementType === '基础要素' ? values.fieldId : undefined,
          fieldLabel: values.elementType === '基础要素' ? fieldLabel : undefined,
        };
      }
      return el;
    });

    const updatedElement = updatedElements.find(el => el.id === selectedElement.id);
    setLibrary({ ...library, elements: updatedElements });
    setSelectedElement(updatedElement || null);
    setEditModalVisible(false);
    setEditFormToolId(undefined);
    message.success('保存成功');
  };

  const handleDeleteElement = (elementId: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除该要素吗？删除后无法恢复。',
      okText: '确定',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: () => {
        if (!library) return;

        const updatedElements = library.elements.filter(el => el.id !== elementId);
        setLibrary({
          ...library,
          elements: updatedElements,
          elementCount: updatedElements.length,
        });

        if (selectedElement?.id === elementId) {
          setSelectedElement(null);
        }

        message.success('删除成功');
      },
    });
  };

  const handleSaveLibrary = () => {
    message.success('要素库保存成功');
  };

  // 智能匹配要素名称和表单字段
  const matchElementToField = (elementName: string, fields: FlattenedField[]): FlattenedField | null => {
    // 清理要素名称（去除单位等）
    const cleanName = elementName
      .replace(/（[^）]*）/g, '') // 去除括号内容如（万人）、（元）
      .replace(/\([^)]*\)/g, '')  // 去除英文括号内容
      .trim();

    // 策略1: 精确匹配
    const exactMatch = fields.find(f => f.label === elementName || f.label === cleanName);
    if (exactMatch) return exactMatch;

    // 策略2: 字段标签包含要素名
    const fieldContainsElement = fields.find(f =>
      f.label.includes(cleanName) || cleanName.includes(f.label)
    );
    if (fieldContainsElement) return fieldContainsElement;

    // 策略3: 关键词匹配（至少3个字符的公共子串）
    for (const field of fields) {
      const fieldLabel = field.label;
      // 检查是否有足够长的公共子串
      for (let len = Math.min(cleanName.length, fieldLabel.length); len >= 3; len--) {
        for (let i = 0; i <= cleanName.length - len; i++) {
          const substr = cleanName.substring(i, i + len);
          if (fieldLabel.includes(substr)) {
            return field;
          }
        }
      }
    }

    return null;
  };

  // 自动关联要素到表单控件
  const handleAutoLink = () => {
    if (!library) return;

    let linkedCount = 0;
    let alreadyLinkedCount = 0;
    let noMatchCount = 0;

    const updatedElements = library.elements.map(element => {
      // 只处理基础要素且有toolId的
      if (element.elementType !== '基础要素' || !element.toolId) {
        return element;
      }

      // 已经关联的跳过
      if (element.fieldId) {
        alreadyLinkedCount++;
        return element;
      }

      // 获取该工具的表单字段
      const schema = formSchemas[element.toolId];
      if (!schema) {
        noMatchCount++;
        return element;
      }

      const fields = flattenFormFields(schema);
      const matchedField = matchElementToField(element.name, fields);

      if (matchedField) {
        linkedCount++;
        return {
          ...element,
          fieldId: matchedField.id,
          fieldLabel: matchedField.path,
        };
      } else {
        noMatchCount++;
        return element;
      }
    });

    setLibrary({ ...library, elements: updatedElements });

    // 更新选中的要素（如果有的话）
    if (selectedElement) {
      const updated = updatedElements.find(el => el.id === selectedElement.id);
      if (updated) setSelectedElement(updated);
    }

    message.success(
      `自动关联完成：成功关联 ${linkedCount} 个，已关联 ${alreadyLinkedCount} 个，未匹配 ${noMatchCount} 个`
    );
  };

  if (!library) {
    return <div className={styles.elementEditPage}>加载中...</div>;
  }

  return (
    <div className={styles.elementEditPage}>
      {/* 页面头部 */}
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <span className={styles.backBtn} onClick={() => navigate(-1)}>
            <ArrowLeftOutlined /> 返回
          </span>
          <h1 className={styles.pageTitle}>编辑评估要素</h1>
        </div>
        <Button type="primary" icon={<SaveOutlined />} onClick={handleSaveLibrary}>
          保存要素库
        </Button>
      </div>

      {/* 要素库信息卡片 */}
      <div className={styles.libraryInfoCard}>
        <div className={styles.libraryInfoHeader}>
          <div className={styles.libraryInfoLeft}>
            <span className={styles.libraryName}>{library.name}</span>
            <Tag className={styles.statusTag}>{library.status}</Tag>
          </div>
          <span className={styles.elementCount}>{library.elementCount}个要素</span>
        </div>
        <p className={styles.libraryDescription}>{library.description}</p>
      </div>

      {/* 主内容区域 */}
      <div className={styles.mainContent}>
        {/* 左侧要素列表 */}
        <div className={styles.elementListSection}>
          <div className={styles.sectionHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <h3 style={{ margin: 0 }}>要素列表</h3>
              <Radio.Group
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                size="small"
                optionType="button"
                buttonStyle="solid"
              >
                <Radio.Button value="all">全部</Radio.Button>
                <Radio.Button value="unlinked">
                  未关联 {unlinkedCount > 0 && <span style={{ color: '#faad14' }}>({unlinkedCount})</span>}
                </Radio.Button>
                <Radio.Button value="linked">已关联</Radio.Button>
              </Radio.Group>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button icon={<ThunderboltOutlined />} onClick={handleAutoLink}>
                自动关联
              </Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAddElement}>
                添加要素
              </Button>
            </div>
          </div>

          <div className={styles.elementList}>
            {filteredElements.map(element => {
              // 判断是否为未关联的基础要素
              const isUnlinked = element.elementType === '基础要素' && element.toolId && !element.fieldId;
              return (
              <div
                key={element.id}
                className={`${styles.elementItem} ${selectedElement?.id === element.id ? styles.selected : ''} ${isUnlinked ? styles.unlinkedElement : ''}`}
                onClick={() => handleSelectElement(element)}
              >
                <div className={styles.elementMain}>
                  <Tag className={styles.elementCode}>{element.code}</Tag>
                  <span className={styles.elementName}>{element.name}</span>
                  <Tag
                    className={`${styles.elementTypeTag} ${element.elementType === '派生要素' ? styles.derived : styles.base}`}
                  >
                    {element.elementType}
                  </Tag>
                  <span className={styles.elementDataType}># {element.dataType}</span>
                  {element.elementType === '基础要素' && element.toolId && (
                    <LinkOutlined
                      className={element.fieldId ? styles.linkedIcon : styles.unlinkedIcon}
                      title={element.fieldId ? `已关联: ${element.fieldLabel}` : '未关联表单控件'}
                    />
                  )}
                </div>
                {element.fieldLabel && (
                  <div className={styles.elementFieldLink}>
                    <FormOutlined />
                    <span>{element.fieldLabel}</span>
                  </div>
                )}
                {element.formula && (
                  <div className={styles.elementFormula}>
                    <FileTextOutlined />
                    <span>{element.formula}</span>
                  </div>
                )}
                <div className={styles.elementActions}>
                  <EditOutlined
                    className={styles.actionIcon}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditElement(element);
                    }}
                  />
                  <DeleteOutlined
                    className={`${styles.actionIcon} ${styles.danger}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteElement(element.id);
                    }}
                  />
                </div>
              </div>
            );
            })}

            {filteredElements.length === 0 && (
              <div className={styles.emptyState}>
                {library.elements.length === 0
                  ? '暂无要素，请点击"添加要素"开始创建'
                  : filterType === 'unlinked'
                    ? '没有未关联的要素'
                    : filterType === 'linked'
                      ? '没有已关联的要素'
                      : '暂无要素'}
              </div>
            )}
          </div>
        </div>

        {/* 右侧要素属性面板 */}
        <div className={styles.elementPropertiesSection}>
          <h3>要素属性</h3>
          {selectedElement ? (
            <div className={styles.propertiesContent}>
              <div className={styles.propertyItem}>
                <label>要素编码</label>
                <span className={styles.propertyValue}>{selectedElement.code}</span>
              </div>
              <div className={styles.propertyItem}>
                <label>要素名称</label>
                <span className={styles.propertyValue}>{selectedElement.name}</span>
              </div>
              <div className={styles.propertyItem}>
                <label>要素类型</label>
                <Tag
                  className={`${styles.elementTypeTag} ${selectedElement.elementType === '派生要素' ? styles.derived : styles.base}`}
                >
                  {selectedElement.elementType}
                </Tag>
              </div>
              <div className={styles.propertyItem}>
                <label>数据类型</label>
                <span className={styles.propertyValue}>{selectedElement.dataType}</span>
              </div>
              {selectedElement.formula && (
                <div className={styles.propertyItem}>
                  <label>计算公式</label>
                  <div className={styles.formulaDisplay}>{selectedElement.formula}</div>
                </div>
              )}
              <div className={styles.propertyItem}>
                <label>关联采集工具</label>
                {selectedElement.toolId ? (
                  <div className={styles.toolLinkDisplay}>
                    <LinkOutlined className={styles.toolLinkIcon} />
                    <span className={styles.toolLinkName}>
                      {dataTools.find(t => t.id === selectedElement.toolId)?.name || '未知工具'}
                    </span>
                  </div>
                ) : (
                  <span className={styles.noToolLink}>未关联</span>
                )}
              </div>
              {selectedElement.toolId && (
                <div className={styles.propertyItem}>
                  <label>关联表单控件</label>
                  {selectedElement.fieldId ? (
                    <div className={styles.fieldLinkDisplay}>
                      <FormOutlined className={styles.fieldLinkIcon} />
                      <span className={styles.fieldLinkName}>
                        {selectedElement.fieldLabel || selectedElement.fieldId}
                      </span>
                    </div>
                  ) : (
                    <span className={styles.noToolLink}>未关联控件</span>
                  )}
                </div>
              )}

              <div className={styles.propertiesActions}>
                <Button
                  block
                  icon={<EditOutlined />}
                  onClick={() => handleEditElement(selectedElement)}
                >
                  编辑要素
                </Button>
                <Button
                  block
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleDeleteElement(selectedElement.id)}
                >
                  删除要素
                </Button>
              </div>
            </div>
          ) : (
            <div className={styles.emptyProperties}>
              <FileTextOutlined className={styles.emptyIcon} />
              <span>选择一个要素查看详情</span>
            </div>
          )}
        </div>
      </div>

      {/* 添加要素弹窗 */}
      <Modal
        title="添加要素"
        open={addModalVisible}
        onCancel={() => setAddModalVisible(false)}
        footer={null}
        width={500}
        className={styles.elementModal}
      >
        <p className={styles.modalSubtitle}>创建一个新的评估要素</p>
        <Form form={addForm} onFinish={handleSaveAdd} layout="vertical">
          <div className={styles.formRowInline}>
            <Form.Item
              label="要素编码"
              name="code"
              rules={[{ required: true, message: '请输入要素编码' }]}
              className={styles.formItemHalf}
            >
              <Input placeholder="如：E001" />
            </Form.Item>
            <Form.Item
              label="要素名称"
              name="name"
              rules={[{ required: true, message: '请输入要素名称' }]}
              className={styles.formItemHalf}
            >
              <Input placeholder="如：学生总数" />
            </Form.Item>
          </div>
          <div className={styles.formHint}>建议使用字母+数字组合</div>

          <div className={styles.formRowInline}>
            <Form.Item
              label="要素类型"
              name="elementType"
              rules={[{ required: true, message: '请选择要素类型' }]}
              initialValue="基础要素"
              className={styles.formItemHalf}
            >
              <Select onChange={(value) => setAddFormElementType(value as ElementType)}>
                <Select.Option value="基础要素">基础要素</Select.Option>
                <Select.Option value="派生要素">派生要素</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item
              label="数据类型"
              name="dataType"
              rules={[{ required: true, message: '请选择数据类型' }]}
              initialValue="文本"
              className={styles.formItemHalf}
            >
              <Select>
                <Select.Option value="文本">文本</Select.Option>
                <Select.Option value="数字">数字</Select.Option>
                <Select.Option value="日期">日期</Select.Option>
                <Select.Option value="时间">时间</Select.Option>
                <Select.Option value="逻辑">逻辑</Select.Option>
                <Select.Option value="数组">数组</Select.Option>
                <Select.Option value="文件">文件</Select.Option>
              </Select>
            </Form.Item>
          </div>
          <div className={styles.formHint}>
            {addFormElementType === '基础要素' ? '直接采集的数据' : '通过计算得出的数据'}
          </div>

          {addFormElementType === '派生要素' && (
            <>
              <Form.Item
                label="计算公式"
                name="formula"
                rules={[{ required: true, message: '请输入计算公式' }]}
              >
                <Input placeholder="如：E003 / E004（使用要素编码进行计算）" />
              </Form.Item>
              <div className={styles.formHint}>使用要素编码和运算符（+ - * /）编写公式，支持括号</div>
            </>
          )}

          {addFormElementType === '基础要素' && (
            <>
              <Form.Item
                label="关联采集工具"
                name="toolId"
              >
                <Select
                  placeholder="请选择数据采集工具"
                  allowClear
                  onChange={(value) => {
                    setAddFormToolId(value);
                    addForm.setFieldValue('fieldId', undefined);
                  }}
                >
                  {dataTools.map(tool => (
                    <Select.Option key={tool.id} value={tool.id}>
                      {tool.name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
              <div className={styles.formHint}>选择用于采集此要素数据的工具</div>

              {addFormToolId && addFormFields.length > 0 && (
                <>
                  <Form.Item
                    label="关联表单控件"
                    name="fieldId"
                  >
                    <Select placeholder="请选择表单控件" allowClear showSearch optionFilterProp="children">
                      {addFormFields.map(field => (
                        <Select.Option key={field.id} value={field.id}>
                          {field.path}
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                  <div className={styles.formHint}>选择工具表单中要关联的具体控件</div>
                </>
              )}
            </>
          )}

          <Form.Item style={{ marginBottom: 0, textAlign: 'right', marginTop: 24 }}>
            <Button style={{ marginRight: 8 }} onClick={() => setAddModalVisible(false)}>
              取消
            </Button>
            <Button type="primary" htmlType="submit">
              添加
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑要素弹窗 */}
      <Modal
        title="编辑要素"
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        footer={null}
        width={500}
        className={styles.elementModal}
      >
        <p className={styles.modalSubtitle}>修改评估要素的属性信息</p>
        <Form form={editForm} onFinish={handleSaveEdit} layout="vertical">
          <div className={styles.formRowInline}>
            <Form.Item
              label="要素编码"
              name="code"
              rules={[{ required: true, message: '请输入要素编码' }]}
              className={styles.formItemHalf}
            >
              <Input placeholder="如：E001" />
            </Form.Item>
            <Form.Item
              label="要素名称"
              name="name"
              rules={[{ required: true, message: '请输入要素名称' }]}
              className={styles.formItemHalf}
            >
              <Input placeholder="如：学生总数" />
            </Form.Item>
          </div>
          <div className={styles.formHint}>建议使用字母+数字组合</div>

          <div className={styles.formRowInline}>
            <Form.Item
              label="要素类型"
              name="elementType"
              rules={[{ required: true, message: '请选择要素类型' }]}
              className={styles.formItemHalf}
            >
              <Select onChange={(value) => setEditFormElementType(value as ElementType)}>
                <Select.Option value="基础要素">基础要素</Select.Option>
                <Select.Option value="派生要素">派生要素</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item
              label="数据类型"
              name="dataType"
              rules={[{ required: true, message: '请选择数据类型' }]}
              className={styles.formItemHalf}
            >
              <Select>
                <Select.Option value="文本">文本</Select.Option>
                <Select.Option value="数字">数字</Select.Option>
                <Select.Option value="日期">日期</Select.Option>
                <Select.Option value="时间">时间</Select.Option>
                <Select.Option value="逻辑">逻辑</Select.Option>
                <Select.Option value="数组">数组</Select.Option>
                <Select.Option value="文件">文件</Select.Option>
              </Select>
            </Form.Item>
          </div>
          <div className={styles.formHint}>
            {editFormElementType === '基础要素' ? '直接采集的数据' : '通过计算得出的数据'}
          </div>

          {editFormElementType === '派生要素' && (
            <>
              <Form.Item
                label="计算公式"
                name="formula"
                rules={[{ required: true, message: '请输入计算公式' }]}
              >
                <Input placeholder="如：E003 / E004（使用要素编码进行计算）" />
              </Form.Item>
              <div className={styles.formHint}>使用要素编码和运算符（+ - * /）编写公式，支持括号</div>
            </>
          )}

          {editFormElementType === '基础要素' && (
            <>
              <Form.Item
                label="关联采集工具"
                name="toolId"
              >
                <Select
                  placeholder="请选择数据采集工具"
                  allowClear
                  onChange={(value) => {
                    setEditFormToolId(value);
                    editForm.setFieldValue('fieldId', undefined);
                  }}
                >
                  {dataTools.map(tool => (
                    <Select.Option key={tool.id} value={tool.id}>
                      {tool.name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
              <div className={styles.formHint}>选择用于采集此要素数据的工具</div>

              {editFormToolId && editFormFields.length > 0 && (
                <>
                  <Form.Item
                    label="关联表单控件"
                    name="fieldId"
                  >
                    <Select placeholder="请选择表单控件" allowClear showSearch optionFilterProp="children">
                      {editFormFields.map(field => (
                        <Select.Option key={field.id} value={field.id}>
                          {field.path}
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                  <div className={styles.formHint}>选择工具表单中要关联的具体控件</div>
                </>
              )}
            </>
          )}

          <Form.Item style={{ marginBottom: 0, textAlign: 'right', marginTop: 24 }}>
            <Button style={{ marginRight: 8 }} onClick={() => setEditModalVisible(false)}>
              取消
            </Button>
            <Button type="primary" htmlType="submit">
              保存
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default IndicatorEdit;
