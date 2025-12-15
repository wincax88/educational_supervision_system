const express = require('express');
const cors = require('cors');
const path = require('path');

// 数据库模块
const db = require('./database/db');

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
const { router: complianceRoutes, setDb: setComplianceDb } = require('./routes/compliance');
const uploadsRouteFactory = require('./routes/uploads');

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// 数据库连接状态
let dbConnected = false;

// 初始化数据库连接
async function initDatabase() {
  try {
    dbConnected = await db.testConnection();

    if (dbConnected) {
      console.log('Database connected successfully');

      // 注入数据库模块到路由（兼容旧路由模式）
      // 注意：路由文件需要逐步修改为直接使用 db 模块
      setIndicatorDb(db);
      setToolDb(db);
      setSubmissionDb(db);
      setProjectToolDb(db);
      setDistrictDb(db);
      setSchoolDb(db);
      setStatisticsDb(db);
      setComplianceDb(db);
    } else {
      console.error('Database connection failed');
    }
  } catch (error) {
    console.error('Database initialization error:', error.message);
  }

  return dbConnected;
}

// API 路由
app.use('/api', indicatorRoutes);
app.use('/api', toolRoutes);
app.use('/api', submissionRoutes);
app.use('/api', projectToolRoutes);
app.use('/api', districtRoutes);
app.use('/api', schoolRoutes);
app.use('/api', statisticsRoutes);
app.use('/api', complianceRoutes);
// 文件上传路由
app.use('/api', uploadsRouteFactory(db));

// 登录接口
app.post('/api/login', loginRules, (req, res) => {
  const { username, password } = req.body;

  // 预设用户
  const users = {
    'AAA': { password: 'BBB', role: 'admin', roleName: '系统管理员' },
    '111': { password: '222', role: 'project_manager', roleName: '项目管理员' },
    '333': { password: '444', role: 'collector', roleName: '数据采集员' },
    '555': { password: '666', role: 'expert', roleName: '项目评估专家' },
    '777': { password: '888', role: 'decision_maker', roleName: '报告决策者' },
  };

  const user = users[username];
  if (user && user.password === password) {
    res.json({
      code: 200,
      data: {
        username,
        role: user.role,
        roleName: user.roleName,
        token: 'token-' + Date.now(),
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
  if (!dbConnected) {
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

// 启动服务器
async function startServer() {
  // 初始化数据库连接
  await initDatabase();

  // 启动 HTTP 服务
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log('Available endpoints:');
    console.log('  GET  /api/health');
    console.log('  GET  /api/stats');
    console.log('  POST /api/login');
    console.log('  GET  /api/indicator-systems');
    console.log('  GET  /api/indicator-systems/:id/tree');
    console.log('  GET  /api/tools');
    console.log('  GET  /api/element-libraries');
    console.log('  GET  /api/projects');
    console.log('  GET  /api/submissions');
    console.log('  GET  /api/districts');
    console.log('  GET  /api/schools');
  });
}

// 启动服务器
startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

// 优雅关闭
process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  await db.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down...');
  await db.close();
  process.exit(0);
});
