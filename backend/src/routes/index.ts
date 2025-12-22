/**
 * 路由模块索引
 * 支持渐进式迁移：同时导出 TypeScript 和 JavaScript 路由
 */

import { Router } from 'express';
import { Database } from '../database/db';

// TypeScript 路由
export { router as userRouter } from './users';
import districtsModule from './districts';
export const districtRouter = districtsModule.router;
export const setDistrictDb = districtsModule.setDb;
export { router as blobRouter } from './blob';

// 导入 JavaScript 路由（临时兼容层，逐步迁移到 TypeScript）
// eslint-disable-next-line @typescript-eslint/no-var-requires
const indicatorsJs = require('../../routes/indicators');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const toolsJs = require('../../routes/tools');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const submissionsJs = require('../../routes/submissions');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const projectToolsJs = require('../../routes/projectTools');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const schoolsJs = require('../../routes/schools');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const statisticsJs = require('../../routes/statistics');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const complianceJs = require('../../routes/compliance');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const personnelJs = require('../../routes/personnel');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const samplesJs = require('../../routes/samples');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const tasksJs = require('../../routes/tasks');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const uploadsJs = require('../../routes/uploads');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const surveyJs = require('../../routes/survey');

// JavaScript 路由导出
export const indicatorRouter: Router = indicatorsJs.router;
export const setIndicatorDb: (db: Database) => void = indicatorsJs.setDb;

export const toolRouter: Router = toolsJs.router;
export const setToolDb: (db: Database) => void = toolsJs.setDb;

export const submissionRouter: Router = submissionsJs.router;
export const setSubmissionDb: (db: Database) => void = submissionsJs.setDb;

export const projectToolRouter: Router = projectToolsJs.router;
export const setProjectToolDb: (db: Database) => void = projectToolsJs.setDb;

export const schoolRouter: Router = schoolsJs.router;
export const setSchoolDb: (db: Database) => void = schoolsJs.setDb;

export const statisticsRouter: Router = statisticsJs.router;
export const setStatisticsDb: (db: Database) => void = statisticsJs.setDb;

export const complianceRouter: Router = complianceJs.router;
export const setComplianceDb: (db: Database) => void = complianceJs.setDb;

export const personnelRouter: Router = personnelJs.router;
export const setPersonnelDb: (db: Database) => void = personnelJs.setDb;

export const samplesRouter: Router = samplesJs.router;
export const setSamplesDb: (db: Database) => void = samplesJs.setDb;

export const taskRouter: Router = tasksJs.router;
export const setTaskDb: (db: Database) => void = tasksJs.setDb;

export const uploadsRouteFactory: (db: Database) => Router = uploadsJs;

export const surveyRouter: Router = surveyJs.router;
export const setSurveyDb: (db: Database) => void = surveyJs.setDb;

/**
 * 注入数据库到所有路由
 */
export function injectDatabase(db: Database): void {
  // TypeScript 路由
  setDistrictDb(db);

  // JavaScript 路由
  setIndicatorDb(db);
  setToolDb(db);
  setSubmissionDb(db);
  setProjectToolDb(db);
  setSchoolDb(db);
  setStatisticsDb(db);
  setComplianceDb(db);
  setPersonnelDb(db);
  setSamplesDb(db);
  setTaskDb(db);
  setSurveyDb(db);
}
