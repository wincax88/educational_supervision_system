/**
 * Supabase 数据库连接管理
 * 使用 @supabase/supabase-js 客户端
 */

require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

// Supabase 配置
const supabaseUrl = process.env.SUPABASE_URL || 'https://wckdsunsuqcoyvmfjkfq.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseKey) {
  console.warn('Warning: SUPABASE_KEY not set. Database operations will fail.');
}

// 创建 Supabase 客户端
const supabase = createClient(supabaseUrl, supabaseKey || '');

/**
 * 执行原生 SQL 查询
 * 使用 Supabase 的 rpc 功能执行 SQL
 * 需要先在 Supabase 中创建 exec_sql 函数
 * @param {string} sql - SQL 语句
 * @param {Array} params - 参数数组
 * @returns {Promise<{rows: Array, rowCount: number}>}
 */
async function query(sql, params = []) {
  // 将 $1, $2... 占位符替换为实际参数
  // 注意：同一个占位符在 SQL 中可能出现多次，必须全量替换；
  // 同时要避免把 $1 误替换到 $10 / $11 中（使用 (?!\\d) 负向前瞻）。
  let processedSql = sql;
  if (Array.isArray(params) && params.length > 0) {
    // 先从大到小替换，双保险避免 $1 影响 $10（即使 regex 已避免）
    for (let i = params.length; i >= 1; i--) {
      const value = formatValue(params[i - 1]);
      // 匹配字面量 $n（例如 $1），并确保后面不是数字，避免误伤 $10
      const re = new RegExp(`\\$${i}(?!\\d)`, 'g');
      processedSql = processedSql.replace(re, () => value);
    }
  }

  // Debug: 打印生成的 SQL
  console.log('Generated SQL:', processedSql);

  const { data, error } = await supabase.rpc('exec_sql', {
    query_text: processedSql
  });

  if (error) {
    // 如果 exec_sql 不存在，尝试直接使用 Supabase Data API
    console.error('SQL execution error:', error.message);
    throw new Error(`Database query failed: ${error.message}`);
  }

  return {
    rows: data || [],
    rowCount: data ? data.length : 0
  };
}

/**
 * 格式化 SQL 参数值
 * @param {any} value - 参数值
 * @returns {string}
 */
function formatValue(value) {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }
  if (Array.isArray(value)) {
    // 如果数组包含对象，视为 JSONB；否则视为 PostgreSQL 数组
    if (value.length > 0 && typeof value[0] === 'object') {
      return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
    }
    return `ARRAY[${value.map(v => formatValue(v)).join(',')}]`;
  }
  if (typeof value === 'object') {
    return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
  }
  // 字符串 - 转义单引号
  return `'${String(value).replace(/'/g, "''")}'`;
}

/**
 * 执行事务
 * Supabase 客户端不直接支持事务，使用 RPC 实现
 * @param {Function} callback - 事务回调函数
 * @returns {Promise<any>}
 */
async function transaction(callback) {
  // Supabase JS 客户端不直接支持事务
  // 在需要事务的地方，使用单个 RPC 调用或 Edge Function
  // 这里提供一个简化的实现，逐个执行操作
  const client = {
    query: async (sql, params) => query(sql, params)
  };

  try {
    const result = await callback(client);
    return result;
  } catch (error) {
    throw error;
  }
}

/**
 * 测试数据库连接
 * @returns {Promise<boolean>}
 */
async function testConnection() {
  try {
    const { error } = await supabase.from('districts').select('id').limit(1);
    if (error && error.code !== 'PGRST116') { // PGRST116 = table not found, which is ok for initial setup
      throw error;
    }
    console.log('Supabase connected successfully');
    return true;
  } catch (err) {
    console.error('Supabase connection failed:', err.message);
    return false;
  }
}

/**
 * 查询列是否存在（用于启动时自检/补齐缺失字段）
 * @param {string} tableName
 * @param {string} columnName
 * @param {string} schemaName
 * @returns {Promise<boolean>}
 */
async function columnExists(tableName, columnName, schemaName = 'public') {
  try {
    const result = await query(
      `
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = $1
          AND table_name = $2
          AND column_name = $3
        LIMIT 1
      `,
      [schemaName, tableName, columnName]
    );
    return (result.rows || []).length > 0;
  } catch (err) {
    // 某些环境可能限制访问 information_schema；交给调用方走兜底策略
    return false;
  }
}

/**
 * 查询表是否存在（用于启动时自检/缺表提示）
 * @param {string} tableName
 * @param {string} schemaName
 * @returns {Promise<boolean>}
 */
async function tableExists(tableName, schemaName = 'public') {
  try {
    const result = await query(
      `
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = $1
          AND table_name = $2
        LIMIT 1
      `,
      [schemaName, tableName]
    );
    return (result.rows || []).length > 0;
  } catch (err) {
    return false;
  }
}

/**
 * 启动时确保关键表结构存在（避免因缺列导致 API 500）
 * 注意：只做“安全且幂等”的修复（IF NOT EXISTS）。
 * @returns {Promise<void>}
 */
async function ensureSchema() {
  try {
    // 注意：当前仓库提供的 exec_sql() 只支持 SELECT（见 backend/database/supabase-setup.sql）
    // 因此这里仅做“检测 + 提示”，不在运行时执行 ALTER/DDL。
    const requiredColumns = [
      { table: 'projects', column: 'keywords' },
      { table: 'projects', column: 'is_published' },
      { table: 'elements', column: 'aggregation' },
      { table: 'project_data_tools', column: 'source_tool_id' }
    ];

    const missing = [];
    for (const c of requiredColumns) {
      const exists = await columnExists(c.table, c.column);
      if (!exists) missing.push(`${c.table}.${c.column}`);
    }

    if (missing.length > 0) {
      console.warn(
        `[db] Schema check: missing columns: ${missing.join(', ')}. ` +
        `请在 Supabase SQL Editor 执行 backend/database/fix-missing-columns.sql（脚本会尝试 NOTIFY pgrst, 'reload schema' 刷新 schema cache）。` +
        `若仍报 "schema cache" 相关错误，可手动执行：NOTIFY pgrst, 'reload schema';`
      );
    }
  } catch (err) {
    // 不阻断服务启动，但给出提示方便排查权限/连接问题
    console.warn('[db] ensureSchema failed:', err.message);
  }
}

/**
 * 关闭连接（Supabase 客户端不需要显式关闭）
 * @returns {Promise<void>}
 */
async function close() {
  // Supabase 客户端不需要显式关闭
  console.log('Supabase client cleanup complete');
}

// ==================== 表级别操作方法 ====================

/**
 * 通用表操作
 * @param {string} table - 表名
 * @returns {object} 表操作对象
 */
function from(table) {
  return supabase.from(table);
}

/**
 * 查询单条记录
 * @param {string} table - 表名
 * @param {string} id - 记录ID
 * @param {string} select - 选择字段
 * @returns {Promise<object|null>}
 */
async function findById(table, id, select = '*') {
  const { data, error } = await supabase
    .from(table)
    .select(select)
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }
  return data;
}

/**
 * 查询多条记录
 * @param {string} table - 表名
 * @param {object} filters - 过滤条件
 * @param {string} select - 选择字段
 * @returns {Promise<Array>}
 */
async function findAll(table, filters = {}, select = '*') {
  let query = supabase.from(table).select(select);

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      query = query.eq(key, value);
    }
  });

  const { data, error } = await query;

  if (error) {
    throw error;
  }
  return data || [];
}

/**
 * 插入记录
 * @param {string} table - 表名
 * @param {object} data - 数据
 * @returns {Promise<object>}
 */
async function insert(table, record) {
  const { data, error } = await supabase
    .from(table)
    .insert(record)
    .select()
    .single();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * 更新记录
 * @param {string} table - 表名
 * @param {string} id - 记录ID
 * @param {object} updates - 更新数据
 * @returns {Promise<object>}
 */
async function update(table, id, updates) {
  const { data, error } = await supabase
    .from(table)
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw error;
  }
  return data;
}

/**
 * 删除记录
 * @param {string} table - 表名
 * @param {string} id - 记录ID
 * @returns {Promise<boolean>}
 */
async function remove(table, id) {
  const { error } = await supabase
    .from(table)
    .delete()
    .eq('id', id);

  if (error) {
    throw error;
  }
  return true;
}

/**
 * 插入或更新记录 (upsert)
 * @param {string} table - 表名
 * @param {object} record - 数据
 * @param {string} conflictColumn - 冲突列
 * @returns {Promise<object>}
 */
async function upsert(table, record, conflictColumn = 'id') {
  const { data, error } = await supabase
    .from(table)
    .upsert(record, { onConflict: conflictColumn })
    .select()
    .single();

  if (error) {
    throw error;
  }
  return data;
}

module.exports = {
  // 原始查询
  query,
  transaction,
  testConnection,
  ensureSchema,
  tableExists,
  close,

  // Supabase 客户端
  supabase,
  from,

  // 便捷方法
  findById,
  findAll,
  insert,
  update,
  remove,
  upsert
};
