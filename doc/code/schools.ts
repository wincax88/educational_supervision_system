import { HttpRespone } from '@/interface'
import http from '@/service/httpService'

export interface PaginationResponse<T> {
    total: number; // 总记录数
    rows?: T[]; // 数据列表
}

export interface School {
    id?: number
    areaCode: string
    areaNm: string
    areaType: string
    businessType: string
    parentSchoolCode: string
    parentSchoolNm: string
    schoolCode: string
    schoolNm: string
    schoolType: string
}

export interface GetAllSchoolParams {
    areaCode?: string // 区县编码
    areaNm?: string // 区县名称
    enabledStatus?: string // 启用状态（0：启用，1：禁用）
    schoolCode?: string // 学校编码
    schoolNm?: string // 学校名称
    schoolType?: string // 学校类型
}

export interface GetSchoolListParams {
    areaCode?: string // 区县编码
    areaNm?: string // 区县名称
    enabledStatus?: string // 启用状态（0：启用，1：禁用）
    schoolCode?: string // 学校编码
    schoolNm?: string // 学校名称
    schoolType?: string // 学校类型
    pageNum?: number
    pageSize?: number
}


export const schoolApi = {
    // 修改学校
     updateSchool: (data: School) => {
        return http.request({
            url: '/ped/school',
            method: 'put',
            data,
        })
    },

    // 新增学校
    addSchool: (data: School) => {
        return http.request({
            url: '/ped/school',
            method: 'post',
            data,
        })
    },

    // 查询学校
    getSchool: (id: number) => {
        return http.request({
            url: `/ped/school/${id}`,
            method: 'get',
        })
    },

    // 删除学校
    deleteSchool: (id: string) => {
        return http.request({
            url: `/ped/school/${id}`,
            method: 'delete',
        })
    },

    // 查询所有学校
    getAllSchool: (params: GetAllSchoolParams) => {
        return http.request({
            url: '/ped/school/all',
            method: 'get',
            params,
        })
    },

    // 批量新增学校
    batchAddSchool: (data: { schools: School[] }) => {
        return http.request({
            url: '/ped/school/batch',
            method: 'post',
            data: data,
        })
    },

    // 获取学校下拉列表
    getSchoolOptions: () => {
        return http.request({
            url: '/ped/school/options',
            method: 'get',
        })
    },

    // 修改学校启用状态 启用状态（0：启用，1：禁用）
    updateSchoolStatus: (id: string, enabledStatus: number) => {
        return http.request({
            url: `/ped/school/status/${id}?enabledStatus=${enabledStatus}`,
            method: 'put',
        })
    },

    // 获取学校树
    getSchoolTree: (): Promise<HttpRespone<SchoolNode[]>> => {
        return http.request({
            url: '/ped/school/tree',
            method: 'get',
        })
    },

    // 查询学校列表
    getSchoolList: (params: GetSchoolListParams): Promise<HttpRespone<PaginationResponse<SchoolData>>> => {
        return http.request({
            url: '/ped/school/list',
            method: 'get',
            params,
        })
    },

    // 导出学校列表
    exportSchoolList: (params: GetSchoolListParams): Promise<HttpRespone<void>> => {
        return http.request({
            url: `/ped/school/export`,
            method: 'get',
            params,
            responseType: 'blob',
        })
    },

    // 获取学校下拉列表树
    getSchoolOptionsTree: (grades: string): Promise<HttpRespone<SchoolNode[]>> => {
        return http.request({
            url: `/ped/school/optionsTree?grades=${grades}`,
            method: 'get',
        })
    },
}

export interface SchoolNode {
    value: string;
    label: string;
    areaCode: string;
    areaNm: string;
    isDisabled: boolean;
    type: string;
    schoolType: string;
    areaType: string;
    businessType: string;
    parentValue: string;
    parent: string;
    parentName: string;
    schoolOperationType: string;
    schoolOperationTypeGroup: string;
    children: SchoolNode[];
}

export interface SchoolData {
    id: string;
    districtAreaCode: string;
    districtAreaName: string;
    schoolNo: string;
    schoolName: string;
    operatorName: string;
    createTime: string;
    enabledStatus: number;
    parentSchoolCode: string;
    parentSchoolNm: string;
    schoolType: string;
  }