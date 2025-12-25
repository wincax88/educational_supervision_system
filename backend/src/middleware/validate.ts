/**
 * 请求验证中间件
 * 使用 express-validator 进行输入验证
 * 枚举值从 constants/enums.ts 统一获取，避免硬编码
 */

import { body, param, query, validationResult, ValidationChain } from 'express-validator';
import { Request, Response, NextFunction, RequestHandler } from 'express';
import * as enums from '../constants/enums';

interface ValidationError {
  field: string;
  message: string;
  value: unknown;
}

/**
 * 验证结果处理中间件
 * 检查验证错误并返回标准化错误响应
 */
export const handleValidationErrors: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorList: ValidationError[] = errors.array().map((err: any) => ({
      field: err.path,
      message: err.msg,
      value: err.value
    }));
    res.status(400).json({
      code: 400,
      message: '输入验证失败',
      errors: errorList
    });
    return;
  }
  next();
};

/**
 * 通用验证规则
 */
export const commonRules = {
  // ID 验证 (UUID 或自定义格式)
  id: param('id')
    .trim()
    .notEmpty().withMessage('ID不能为空')
    .isLength({ max: 100 }).withMessage('ID长度不能超过100'),

  // 分页参数
  page: query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('页码必须是正整数')
    .toInt(),

  pageSize: query('pageSize')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('每页数量必须在1-100之间')
    .toInt(),

  // 搜索关键词
  keyword: query('keyword')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('搜索关键词不能超过100个字符')
    .escape(),

  // 状态筛选
  status: query('status')
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage('状态值过长'),
};

/**
 * 登录验证规则
 * 支持 phone 或 username 字段（向后兼容）
 */
export const loginRules: Array<ValidationChain | RequestHandler> = [
  body('phone')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 }).withMessage('手机号长度必须在1-50之间'),
  body('username')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 }).withMessage('用户名长度必须在1-50之间'),
  body('password')
    .notEmpty().withMessage('密码不能为空')
    .isLength({ min: 1, max: 100 }).withMessage('密码长度必须在1-100之间'),
  // 自定义验证：确保 phone 或 username 至少有一个
  body().custom((value) => {
    const phone = value.phone?.trim();
    const username = value.username?.trim();
    if (!phone && !username) {
      throw new Error('手机号或用户名至少需要提供一个');
    }
    return true;
  }),
  handleValidationErrors
];

/**
 * 指标体系验证规则
 */
export const indicatorSystemRules = {
  create: [
    body('name')
      .trim()
      .notEmpty().withMessage('名称不能为空')
      .isLength({ max: 200 }).withMessage('名称不能超过200个字符'),
    body('type')
      .trim()
      .notEmpty().withMessage('类型不能为空')
      .isIn([...enums.INDICATOR_SYSTEM_TYPE]).withMessage(`类型必须是${enums.INDICATOR_SYSTEM_TYPE.join('或')}`),
    body('target')
      .trim()
      .notEmpty().withMessage('评估对象不能为空')
      .isLength({ max: 100 }).withMessage('评估对象不能超过100个字符'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 2000 }).withMessage('描述不能超过2000个字符'),
    body('tags')
      .optional()
      .isArray().withMessage('标签必须是数组'),
    handleValidationErrors
  ] as Array<ValidationChain | RequestHandler>,
  update: [
    param('id')
      .trim()
      .notEmpty().withMessage('ID不能为空'),
    body('name')
      .optional()
      .trim()
      .isLength({ max: 200 }).withMessage('名称不能超过200个字符'),
    body('type')
      .optional()
      .trim()
      .isIn([...enums.INDICATOR_SYSTEM_TYPE]).withMessage(`类型必须是${enums.INDICATOR_SYSTEM_TYPE.join('或')}`),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 2000 }).withMessage('描述不能超过2000个字符'),
    handleValidationErrors
  ] as Array<ValidationChain | RequestHandler>
};

/**
 * 项目验证规则
 */
export const projectRules = {
  create: [
    body('name')
      .trim()
      .notEmpty().withMessage('项目名称不能为空')
      .isLength({ max: 200 }).withMessage('项目名称不能超过200个字符'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 2000 }).withMessage('描述不能超过2000个字符'),
    body('startDate')
      .optional()
      .isISO8601().withMessage('开始日期格式不正确'),
    body('endDate')
      .optional()
      .isISO8601().withMessage('结束日期格式不正确'),
    body('indicatorSystemId')
      .optional()
      .trim()
      .isLength({ max: 100 }).withMessage('指标体系ID格式不正确'),
    handleValidationErrors
  ] as Array<ValidationChain | RequestHandler>,
  update: [
    param('id')
      .trim()
      .notEmpty().withMessage('项目ID不能为空'),
    body('name')
      .optional()
      .trim()
      .isLength({ max: 200 }).withMessage('项目名称不能超过200个字符'),
    body('status')
      .optional()
      .isIn([...enums.PROJECT_STATUS])
      .withMessage(`无效的项目状态，允许值: ${enums.PROJECT_STATUS.join(', ')}`),
    handleValidationErrors
  ] as Array<ValidationChain | RequestHandler>
};

/**
 * 工具/表单验证规则
 */
export const toolRules = {
  create: [
    body('name')
      .trim()
      .notEmpty().withMessage('工具名称不能为空')
      .isLength({ max: 200 }).withMessage('名称不能超过200个字符'),
    body('type')
      .trim()
      .notEmpty().withMessage('类型不能为空')
      .isIn([...enums.DATA_TOOL_TYPE]).withMessage(`类型必须是${enums.DATA_TOOL_TYPE.join('或')}`),
    body('target')
      .optional()
      .trim()
      .isLength({ max: 100 }).withMessage('目标对象不能超过100个字符'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 2000 }).withMessage('描述不能超过2000个字符'),
    handleValidationErrors
  ] as Array<ValidationChain | RequestHandler>,
  updateSchema: [
    param('id')
      .trim()
      .notEmpty().withMessage('工具ID不能为空'),
    body('schema')
      .notEmpty().withMessage('表单Schema不能为空')
      .isObject().withMessage('Schema必须是对象'),
    body('schema.fields')
      .isArray().withMessage('字段配置必须是数组'),
    handleValidationErrors
  ] as Array<ValidationChain | RequestHandler>
};

/**
 * 要素库验证规则
 */
export const elementLibraryRules = {
  create: [
    body('name')
      .trim()
      .notEmpty().withMessage('要素库名称不能为空')
      .isLength({ max: 200 }).withMessage('名称不能超过200个字符'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 2000 }).withMessage('描述不能超过2000个字符'),
    handleValidationErrors
  ] as Array<ValidationChain | RequestHandler>
};

/**
 * 要素验证规则
 */
export const elementRules = {
  create: [
    body('code')
      .trim()
      .notEmpty().withMessage('要素编码不能为空')
      .isLength({ max: 50 }).withMessage('编码不能超过50个字符')
      .matches(/^[A-Za-z0-9_-]+$/).withMessage('编码只能包含字母、数字、下划线和连字符'),
    body('name')
      .trim()
      .notEmpty().withMessage('要素名称不能为空')
      .isLength({ max: 200 }).withMessage('名称不能超过200个字符'),
    body('elementType')
      .trim()
      .notEmpty().withMessage('要素类型不能为空')
      .isIn([...enums.ELEMENT_TYPE]).withMessage(`类型必须是${enums.ELEMENT_TYPE.join('或')}`),
    body('dataType')
      .trim()
      .notEmpty().withMessage('数据类型不能为空')
      .isIn([...enums.ELEMENT_DATA_TYPE])
      .withMessage(`无效的数据类型，允许值: ${enums.ELEMENT_DATA_TYPE.join(', ')}`),
    body('formula')
      .optional()
      .trim()
      .isLength({ max: 1000 }).withMessage('公式不能超过1000个字符'),
    handleValidationErrors
  ] as Array<ValidationChain | RequestHandler>
};

/**
 * 填报记录验证规则
 */
export const submissionRules = {
  create: [
    body('projectId')
      .trim()
      .notEmpty().withMessage('项目ID不能为空'),
    body('formId')
      .trim()
      .notEmpty().withMessage('表单ID不能为空'),
    body('data')
      .optional()
      .isObject().withMessage('填报数据必须是对象'),
    handleValidationErrors
  ] as Array<ValidationChain | RequestHandler>,
  reject: [
    param('id')
      .trim()
      .notEmpty().withMessage('填报记录ID不能为空'),
    body('reason')
      .trim()
      .notEmpty().withMessage('驳回原因不能为空')
      .isLength({ max: 500 }).withMessage('驳回原因不能超过500个字符'),
    handleValidationErrors
  ] as Array<ValidationChain | RequestHandler>
};

/**
 * 区县验证规则
 */
export const districtRules = {
  create: [
    body('code')
      .trim()
      .notEmpty().withMessage('区县代码不能为空')
      .isLength({ min: 6, max: 12 }).withMessage('区县代码长度必须在6-12位'),
    body('name')
      .trim()
      .notEmpty().withMessage('区县名称不能为空')
      .isLength({ max: 100 }).withMessage('名称不能超过100个字符'),
    body('type')
      .optional()
      .isIn([...enums.DISTRICT_TYPE]).withMessage(`无效的区县类型，允许值: ${enums.DISTRICT_TYPE.join(', ')}`),
    handleValidationErrors
  ] as Array<ValidationChain | RequestHandler>
};

/**
 * 学校验证规则
 */
export const schoolRules = {
  create: [
    body('code')
      .trim()
      .notEmpty().withMessage('学校代码不能为空')
      .isLength({ max: 20 }).withMessage('学校代码不能超过20位'),
    body('name')
      .trim()
      .notEmpty().withMessage('学校名称不能为空')
      .isLength({ max: 200 }).withMessage('名称不能超过200个字符'),
    body('districtId')
      .trim()
      .notEmpty().withMessage('所属区县不能为空'),
    body('schoolType')
      .trim()
      .notEmpty().withMessage('学校类型不能为空')
      .isIn([...enums.SCHOOL_TYPE]).withMessage(`无效的学校类型，允许值: ${enums.SCHOOL_TYPE.join(', ')}`),
    body('schoolCategory')
      .optional()
      .isIn([...enums.SCHOOL_CATEGORY]).withMessage(`办学性质必须是${enums.SCHOOL_CATEGORY.join('或')}`),
    body('urbanRural')
      .optional()
      .isIn([...enums.URBAN_RURAL_TYPE]).withMessage(`无效的城乡类型，允许值: ${enums.URBAN_RURAL_TYPE.join(', ')}`),
    body('studentCount')
      .optional()
      .isInt({ min: 0 }).withMessage('学生数必须是非负整数'),
    body('teacherCount')
      .optional()
      .isInt({ min: 0 }).withMessage('教师数必须是非负整数'),
    handleValidationErrors
  ] as Array<ValidationChain | RequestHandler>,
  update: [
    param('id')
      .trim()
      .notEmpty().withMessage('学校ID不能为空'),
    body('name')
      .optional()
      .trim()
      .isLength({ max: 200 }).withMessage('名称不能超过200个字符'),
    body('schoolType')
      .optional()
      .isIn([...enums.SCHOOL_TYPE]).withMessage(`无效的学校类型，允许值: ${enums.SCHOOL_TYPE.join(', ')}`),
    body('studentCount')
      .optional()
      .isInt({ min: 0 }).withMessage('学生数必须是非负整数'),
    body('teacherCount')
      .optional()
      .isInt({ min: 0 }).withMessage('教师数必须是非负整数'),
    handleValidationErrors
  ] as Array<ValidationChain | RequestHandler>
};

/**
 * 文件上传验证规则
 */
export const uploadRules = {
  material: [
    body('submissionId')
      .trim()
      .notEmpty().withMessage('填报记录ID不能为空'),
    body('indicatorId')
      .optional()
      .trim(),
    handleValidationErrors
  ] as Array<ValidationChain | RequestHandler>
};

/**
 * 列表查询通用验证
 */
export const listQueryRules: Array<ValidationChain | RequestHandler> = [
  commonRules.page,
  commonRules.pageSize,
  commonRules.keyword,
  commonRules.status,
  handleValidationErrors
];

/**
 * ID参数验证
 */
export const idParamRules: Array<ValidationChain | RequestHandler> = [
  commonRules.id,
  handleValidationErrors
];

export default {
  handleValidationErrors,
  commonRules,
  loginRules,
  indicatorSystemRules,
  projectRules,
  toolRules,
  elementLibraryRules,
  elementRules,
  submissionRules,
  districtRules,
  schoolRules,
  uploadRules,
  listQueryRules,
  idParamRules
};
