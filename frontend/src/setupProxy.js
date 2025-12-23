const { createProxyMiddleware } = require('http-proxy-middleware');

/**
 * CRA 开发代理：
 * - /api/blob/* 走 Vercel Dev（用于 Vercel Blob 的 handleUpload / del）
 * - /api/* 走后端服务器（Express API）
 *
 * 说明：
 * - `vercel dev` 默认端口常与 CRA(3000) 冲突，建议使用 3002：
 *   `vercel dev --listen 3002`
 * - 后端服务器默认运行在 3001 端口
 */
module.exports = function (app) {
  // Vercel Blob API 代理
  app.use(
    '/api/blob',
    createProxyMiddleware({
      target: process.env.REACT_APP_VERCEL_DEV_URL || 'http://localhost:3002',
      changeOrigin: true,
    }),
  );

  // 后端 Express API 代理
  app.use(
    '/api',
    createProxyMiddleware({
      target: process.env.REACT_APP_API_URL || 'http://localhost:3001',
      changeOrigin: true,
    }),
  );
};


