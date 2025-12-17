/**
 * Express 应用模块（可用于测试）
 * 从 index.ts 分离出来以便于单元测试
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';

// 中间件
import { loginRules } from './middleware/validate';

// 路由模块
import {
  userRouter,
  districtRouter,
  indicatorRouter,
  toolRouter,
  submissionRouter,
  projectToolRouter,
  schoolRouter,
  statisticsRouter,
  complianceRouter,
  personnelRouter,
  samplesRouter,
  taskRouter,
  uploadsRouteFactory,
  injectDatabase,
} from './routes';

// 服务
import * as userStore from './services/userStore';
import * as sessionStore from './services/sessionStore';

// 类型
import { Database } from './database/db';

interface RoleNameMap {
  [key: string]: string;
}

/**
 * 创建 Express 应用实例
 * @param db - 数据库模块（可注入 mock）
 * @returns Express 应用实例
 */
export function createApp(db?: Database): Express {
  const app = express();

  // 中间件
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  // 数据库连接状态
  let dbConnected = false;

  // 注入数据库到路由
  if (db) {
    injectDatabase(db);
    dbConnected = true;
  }

  // API 路由
  app.use('/api', indicatorRouter);
  app.use('/api', toolRouter);
  app.use('/api', submissionRouter);
  app.use('/api', projectToolRouter);
  app.use('/api', districtRouter);
  app.use('/api', schoolRouter);
  app.use('/api', statisticsRouter);
  app.use('/api', complianceRouter);
  app.use('/api', personnelRouter);
  app.use('/api', samplesRouter);
  app.use('/api', taskRouter);
  app.use('/api', userRouter);

  // 文件上传路由
  if (db) {
    app.use('/api', uploadsRouteFactory(db));
  }

  // 登录接口
  app.post('/api/login', loginRules as express.RequestHandler[], (req: Request, res: Response): void => {
    const { username, password } = req.body;
    const user = userStore.verifyCredentials(username, password);
    if (user) {
      const roles = Array.isArray(user.roles) ? user.roles : [];
      const role = roles[0] || null;
      const roleNameMap: RoleNameMap = {
        admin: '系统管理员',
        city_admin: '市级管理员',
        district_admin: '区县管理员',
        school_reporter: '学校填报员',
        expert: '评估专家',
      };
      const ts = Date.now();
      sessionStore.setSession(ts, {
        username,
        roles,
        scopes: Array.isArray(user.scopes) ? user.scopes : [],
      });

      res.json({
        code: 200,
        data: {
          username,
          role,
          roles,
          scopes: Array.isArray(user.scopes) ? user.scopes : [],
          roleName: (role && roleNameMap[role]) || '',
          token: 'token-' + ts + '-' + (role || 'anonymous'),
        },
      });
    } else {
      res.status(401).json({
        code: 401,
        message: '用户名或密码错误',
      });
    }
  });

  // 健康检查
  app.get('/api/health', (req: Request, res: Response): void => {
    res.json({
      code: 200,
      status: 'ok',
      database: dbConnected ? 'connected' : 'not connected',
      timestamp: new Date().toISOString(),
    });
  });

  // 统计数据
  app.get('/api/stats', async (req: Request, res: Response): Promise<void> => {
    if (!dbConnected || !db) {
      res.json({ code: 200, data: {} });
      return;
    }

    try {
      const indicatorSystemStats = (await db.query(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published,
          SUM(CASE WHEN status = 'editing' THEN 1 ELSE 0 END) as editing,
          SUM(CASE WHEN type = '达标类' THEN 1 ELSE 0 END) as standard,
          SUM(CASE WHEN type = '评分类' THEN 1 ELSE 0 END) as scoring
        FROM indicator_systems
      `)).rows[0];

      const elementLibraryStats = (await db.query(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published,
          SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft,
          (SELECT COUNT(*) FROM elements) as elementcount
        FROM element_libraries
      `)).rows[0];

      const toolStats = (await db.query(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published,
          SUM(CASE WHEN status = 'editing' THEN 1 ELSE 0 END) as editing,
          SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft
        FROM data_tools
      `)).rows[0];

      const projectStats = (await db.query(`
        SELECT
          SUM(CASE WHEN status = '配置中' THEN 1 ELSE 0 END) as configuring,
          SUM(CASE WHEN status = '填报中' THEN 1 ELSE 0 END) as filling,
          SUM(CASE WHEN status = '评审中' THEN 1 ELSE 0 END) as reviewing,
          SUM(CASE WHEN status = '已中止' THEN 1 ELSE 0 END) as stopped,
          SUM(CASE WHEN status = '已完成' THEN 1 ELSE 0 END) as completed
        FROM projects
      `)).rows[0];

      res.json({
        code: 200,
        data: {
          indicatorSystemStats,
          elementLibraryStats,
          toolStats,
          projectStats,
        },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ code: 500, message });
    }
  });

  // 错误处理中间件
  app.use((err: Error, req: Request, res: Response, _next: NextFunction): void => {
    console.error('Error:', err);
    res.status(500).json({
      code: 500,
      message: err.message || 'Internal Server Error',
    });
  });

  // 404 处理
  app.use((req: Request, res: Response): void => {
    res.status(404).json({
      code: 404,
      message: 'Not Found',
    });
  });

  return app;
}

export default { createApp };
