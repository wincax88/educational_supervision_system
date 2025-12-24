/**
 * Express 应用模块（可用于测试）
 * 从 index.js 分离出来以便于单元测试
 */

const express = require('express');
const cors = require('cors');

// 中间件
const { loginRules } = require('./middleware/validate');

// 路由模块
const { router: indicatorRoutes, setDb: setIndicatorDb } = require('./routes/indicators');
const { router: toolRoutes, setDb: setToolDb } = require('./routes/tools');
const { router: submissionRoutes, setDb: setSubmissionDb } = require('./routes/submissions');
const { router: projectToolRoutes, setDb: setProjectToolDb } = require('./routes/projectTools');
const { router: districtRoutes, setDb: setDistrictDb } = require('./routes/districts');
const { router: schoolRoutes, setDb: setSchoolDb } = require('./routes/schools');
const { router: statisticsRoutes, setDb: setStatisticsDb } = require('./routes/statistics');
const { router: preschoolStatisticsRoutes, setDb: setPreschoolStatisticsDb } = require('./routes/preschool-statistics');
const { router: complianceRoutes, setDb: setComplianceDb } = require('./routes/compliance');
const { router: personnelRoutes, setDb: setPersonnelDb } = require('./routes/personnel');
const { router: samplesRoutes, setDb: setSamplesDb } = require('./routes/samples');
const { router: taskRoutes, setDb: setTaskDb } = require('./routes/tasks');
const { router: reviewAssignmentRoutes, setDb: setReviewAssignmentDb } = require('./routes/reviewAssignments');
const { router: userRoutes } = require('./routes/users');
const uploadsRouteFactory = require('./routes/uploads');
const userStore = require('./services/userStore');
const sessionStore = require('./services/sessionStore');

/**
 * 创建 Express 应用实例
 * @param {object} db - 数据库模块（可注入 mock）
 * @returns {Express.Application}
 */
function createApp(db) {
  const app = express();

  // 中间件
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  // 数据库连接状态
  let dbConnected = false;

  // 注入数据库到路由
  if (db) {
    setIndicatorDb(db);
    setToolDb(db);
    setSubmissionDb(db);
    setProjectToolDb(db);
    setDistrictDb(db);
    setSchoolDb(db);
    setStatisticsDb(db);
    setPreschoolStatisticsDb(db);
    setComplianceDb(db);
    setPersonnelDb(db);
    setSamplesDb(db);
    setTaskDb(db);
    setReviewAssignmentDb(db);
    dbConnected = true;
  }

  // API 路由
  app.use('/api', indicatorRoutes);
  app.use('/api', toolRoutes);
  app.use('/api', submissionRoutes);
  app.use('/api', projectToolRoutes);
  app.use('/api', districtRoutes);
  app.use('/api', schoolRoutes);
  app.use('/api', statisticsRoutes);
  app.use('/api/preschool-statistics', preschoolStatisticsRoutes);
  app.use('/api', complianceRoutes);
  app.use('/api', personnelRoutes);
  app.use('/api', samplesRoutes);
  app.use('/api', taskRoutes);
  app.use('/api', reviewAssignmentRoutes);
  app.use('/api', userRoutes);

  // 文件上传路由
  if (db) {
    app.use('/api', uploadsRouteFactory(db));
  }

  // 登录接口
  app.post('/api/login', loginRules, (req, res) => {
    const { username, password } = req.body;
    const user = userStore.verifyCredentials(username, password);
    if (user) {
      const roles = Array.isArray(user.roles) ? user.roles : [];
      const role = user.role || roles[0] || null;
      const roleNameMap = {
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
          roleName: (role && roleNameMap[role]) || user.roleName || '',
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
  app.get('/api/health', (req, res) => {
    res.json({
      code: 200,
      status: 'ok',
      database: dbConnected ? 'connected' : 'not connected',
      timestamp: new Date().toISOString(),
    });
  });

  // 统计数据
  app.get('/api/stats', async (req, res) => {
    if (!dbConnected || !db) {
      return res.json({ code: 200, data: {} });
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
    } catch (error) {
      res.status(500).json({ code: 500, message: error.message });
    }
  });

  // 错误处理中间件
  app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
      code: 500,
      message: err.message || 'Internal Server Error',
    });
  });

  // 404 处理
  app.use((req, res) => {
    res.status(404).json({
      code: 404,
      message: 'Not Found',
    });
  });

  return app;
}

module.exports = { createApp };
