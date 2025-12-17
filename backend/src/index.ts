/**
 * 应用入口
 * Educational Supervision System Backend
 */

import { createApp } from './app';
import db from './database/db';
import { injectDatabase } from './routes';

const PORT = process.env.PORT || 3001;

// 数据库连接状态
let dbConnected = false;

/**
 * 初始化数据库连接
 */
async function initDatabase(): Promise<boolean> {
  try {
    dbConnected = await db.testConnection();

    if (dbConnected) {
      console.log('Database connected successfully');

      // 启动时自检/补齐关键字段，避免因缺列导致 API 500
      await db.ensureSchema();

      // 注入数据库模块到路由
      injectDatabase(db);
    } else {
      console.error('Database connection failed');
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Database initialization error:', message);
  }

  return dbConnected;
}

/**
 * 启动服务器
 */
async function startServer(): Promise<void> {
  // 初始化数据库连接
  await initDatabase();

  // 创建应用实例
  const app = createApp(dbConnected ? db : undefined);

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
    console.log('  GET  /api/users');
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
