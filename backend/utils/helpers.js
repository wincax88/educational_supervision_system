/**
 * 通用工具函数
 */

/**
 * 生成唯一ID
 * 格式：时间戳(36进制) + 随机字符串
 */
const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
};

/**
 * 获取当前日期（YYYY-MM-DD）
 */
const now = () => {
  return new Date().toISOString().split('T')[0];
};

/**
 * 获取当前时间戳（ISO格式）
 */
const nowISO = () => {
  return new Date().toISOString();
};

module.exports = {
  generateId,
  now,
  nowISO
};
