import { HttpRespone } from "@/interface";
import http from "@/service/httpService";

export interface PaginationResponse<T> {
  total: number; // 总记录数
  rows?: T[]; // 数据列表
}

export interface GetSchoolReporterListParams {
  areaCode?: string;
  operateTimeEnd?: string;
  operateTimeStart?: string;
  operatorName?: string;
  pageNum?: number;
  pageSize?: number;
  reporterName?: string;
  reporterPhone?: string;
  schoolCode?: string;
}

export interface School {
  areaCode: string;
  areaNm: string;
  schoolCode: string;
  schoolNm: string;
  schoolType: string;
}

export interface UpdateSchoolReporterByPhoneParams {
  key?: string;
  reporterName: string;
  reporterPhone: string;
  schools: School[];
}

export interface SchoolReporter {
  areaCode: string;
  areaNm: string;
  id?: number;
  reporterName: string;
  reporterPhone: string;
  schoolCode: string;
  schoolNm: string;
  schoolType: string;
}

export interface GetOrgUserListParams {
  realName?: string;
  phoneNumber?: string;
}

export const schoolReporterApi = {
  // 删除学校报告人
  deleteSchoolReporter: (id: string) => {
    return http.request({
      url: `/ped/schoolReporter/${id}`,
      method: "delete",
    });
  },
  // 根据手机号查询学校报告人
  getSchoolReporterDetailByPhone: (
    phone: string
  ): Promise<HttpRespone<SchoolReporterDetail>> => {
    return http.request({
      url: `/ped/schoolReporter/detailByPhone/${phone}`,
      method: "get",
    });
  },

  // 根据学校编码查询报告人明细列表
  getSchoolReporterDetails: (schoolCode: string) => {
    return http.request({
      url: `/ped/schoolReporter/details/${schoolCode}`,
      method: "get",
    });
  },

  // 下载结果数据
  downloadResultData: (importKey: string) => {
    return http.request({
      url: `/ped/schoolReporter/downloadResultData?importKey=${importKey}`,
      method: "get",
      responseType: "blob",
    });
  },

  // 导出学校报告人数据
  exportSchoolReporter: (params: GetSchoolReporterListParams) => {
    return http.request({
      url: "/ped/schoolReporter/export",
      method: "get",
      params,
      responseType: "blob",
    });
  },

  // 导入学校报告人数据
  importSchoolReporterData: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return http.request({
      url: "/ped/schoolReporter/importData",
      method: "post",
      data: formData,
      timeout: 10 * 60 * 1000, // 10分钟超时
    });
  },

  // 下载导入模板  responseType: 'blob'
  downloadImportTemplate: () => {
    return http.request({
      url: "/ped/schoolReporter/importTemplate",
      method: "get",
      responseType: "blob",
    });
  },

  // 查询学校报告人列表
  getSchoolReporterList: (
    params: GetSchoolReporterListParams
  ): Promise<HttpRespone<PaginationResponse<AccountData>>> => {
    return http.request({
      url: "/ped/schoolReporter/list",
      method: "get",
      params,
    });
  },

  // 获取学校报告人学校下拉列表
  getSchoolReporterSchoolOptions: (): Promise<
    HttpRespone<SchoolReporterSchoolOptions[]>
  > => {
    return http.request({
      url: "/ped/schoolReporter/schoolOptions",
      method: "get",
    });
  },

  // 根据学校代码查询教师信息列表
  getSchoolReporterTeachers: (schoolCode: string) => {
    return http.request({
      url: `/ped/schoolReporter/teachers/${schoolCode}`,
      method: "get",
    });
  },

  // 修改学校报告人
  updateSchoolReporterByPhone: (data: UpdateSchoolReporterByPhoneParams) => {
    return http.request({
      url: "/ped/schoolReporter/updateByPhone",
      method: "put",
      data,
    });
  },

  // 新增学校报告人
  addSchoolReporter: (data: SchoolReporter) => {
    return http.request({
      url: "/ped/schoolReporter",
      method: "post",
      data,
    });
  },

  // 根据导入结果key查询导入结果数据
  getImportResultData: (importKey: string): Promise<HttpRespone<ImportResultData>> => {
    return http.request({
      url: `/ped/schoolReporter/importResultData?importKey=${importKey}`,
      method: "get",
    });
  },

  // 查询组织用户列表
  getOrgUserList: (params: GetOrgUserListParams) => {
    return http.request({
      url: "/ttc/orgUser/list",
      method: "post",
      data: params,
    });
  },
};

export interface OrgUser {

  owner: string;
  userId: string;
  userCode: string;
  name: string;
  realName: string;
  userStatus: string;
  phoneNumber: string;
}

export interface SchoolReporterSchoolOptions {
  value: string;
  label: string;
  areaCode: string;
  areaNm: string;
  schoolType: string;
  editable: boolean;
}

export interface SchoolReporterDetail {
  key: string;
  reporterName: string;
  reporterPhone: string;
  schools: School[];
}

export interface AccountData {
  editable: boolean;
  id: string;
  areaCode: string;
  areaNm: string;
  schoolCode: string;
  schoolNm: string;
  schoolType: string;
  schoolTypeName: string;
  reporterName: string;
  reporterPhone: string;
  createBy: string;
  createTime: string;
}

export interface ImportResultData {
  result: boolean;
  total: number;
  successCount: number;
  skipCount: number;
  failureCount: number;
}
