const express = require('express');
const router = express.Router();
const { projectRules, submissionRules, idParamRules } = require('../middleware/validate');
const { validateEnum } = require('../constants/enums');
const { deleteProject } = require('../services/cascadeService');
const { checkCompliance } = require('../services/statisticsService');
const {
  EXTENDED_FUNCTION_KEYWORDS,
  calculateDerivedValueForSample
} = require('../services/aggregationService');

let db = null;

const setDb = (database) => {
  db = database;
};

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
const now = () => new Date().toISOString();

function getValueByFieldId(dataObj, fieldId) {
  if (!dataObj || typeof dataObj !== 'object' || !fieldId) return undefined;

  // 优先尝试"原样 key"（很多表单会用带点号的 key 直接存储，而不是嵌套对象）
  if (Object.prototype.hasOwnProperty.call(dataObj, fieldId)) return dataObj[fieldId];

  // 再尝试 a.b.c 这种路径读取
  if (typeof fieldId !== 'string' || !fieldId.includes('.')) return undefined;
  const parts = fieldId.split('.').filter(Boolean);
  let cur = dataObj;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (cur === null || cur === undefined) return undefined;

    // 如果当前值是数组，提取数组中每个元素的剩余路径值并求和
    if (Array.isArray(cur)) {
      const remainingPath = parts.slice(i).join('.');
      let sum = 0;
      let hasValue = false;
      for (const item of cur) {
        const val = getValueByFieldId(item, remainingPath);
        if (typeof val === 'number' && !isNaN(val)) {
          sum += val;
          hasValue = true;
        }
      }
      return hasValue ? sum : undefined;
    }

    const isIndex = /^\d+$/.test(p);
    const key = isIndex ? Number(p) : p;
    cur = cur[key];
  }
  return cur;
}

function toIndicatorValue(raw) {
  if (raw === null || raw === undefined) return { value: null, textValue: null };

  if (typeof raw === 'number') {
    return { value: Number.isFinite(raw) ? raw : null, textValue: null };
  }

  if (typeof raw === 'string') {
    const s = raw.trim();
    if (!s) return { value: null, textValue: null };
    if (/^-?\d+(\.\d+)?$/.test(s)) return { value: parseFloat(s), textValue: null };
    return { value: null, textValue: s };
  }

  if (typeof raw === 'boolean') {
    return { value: null, textValue: raw ? 'true' : 'false' };
  }

  try {
    return { value: null, textValue: JSON.stringify(raw) };
  } catch {
    return { value: null, textValue: String(raw) };
  }
}

// 安全地计算公式（用元素值替换变量后 eval）
function evaluateFormula(formula, elementValues) {
  if (!formula) return null;

  // 提取公式中的所有变量 (E001, E002, D001 等)
  const varPattern = /[ED]\d{3}/g;
  const vars = formula.match(varPattern) || [];

  // 检查是否所有变量都有值
  for (const v of vars) {
    if (elementValues[v] === undefined || elementValues[v] === null) {
      return null; // 缺少必要变量，无法计算
    }
  }

  // 用实际值替换变量
  let expr = formula;
  for (const v of vars) {
    expr = expr.replace(new RegExp(v, 'g'), elementValues[v]);
  }

  // 安全计算表达式
  try {
    // 只允许数字、运算符、括号
    if (!/^[\d\s+\-*/().]+$/.test(expr)) {
      console.warn('[formula] unsafe expression:', expr);
      return null;
    }
    // eslint-disable-next-line no-eval
    const result = eval(expr);
    return Number.isFinite(result) ? Math.round(result * 10000) / 10000 : null;
  } catch (e) {
    console.warn('[formula] eval error:', e.message, 'expr:', expr);
    return null;
  }
}

async function syncSubmissionIndicators(submissionId) {
  const today = new Date().toISOString().split('T')[0];

  const subResult = await db.query(
    `
      SELECT id,
             project_id as "projectId",
             school_id as "schoolId",
             COALESCE(form_id, tool_id) as "toolId",
             data,
             COALESCE(approved_at, submitted_at, updated_at, created_at) as "collectedAt"
      FROM submissions
      WHERE id = $1
      LIMIT 1
    `,
    [submissionId]
  );
  const submission = subResult.rows[0];
  if (!submission?.projectId || !submission?.schoolId || !submission?.toolId) {
    return { written: 0, reason: 'submission缺少 projectId/schoolId/toolId' };
  }

  let dataObj = {};
  try {
    dataObj = submission.data ? JSON.parse(submission.data) : {};
  } catch {
    dataObj = {};
  }

  // ========== 方式1: 直接映射 (field -> data_indicator) ==========
  const directMappingsResult = await db.query(
    `
      SELECT field_id as "fieldId", target_id as "dataIndicatorId"
      FROM field_mappings
      WHERE tool_id = $1 AND mapping_type = 'data_indicator'
    `,
    [submission.toolId]
  );
  const directMappings = (directMappingsResult.rows || []).filter(m => m.fieldId && m.dataIndicatorId);

  // ========== 方式2: 元素映射 + 公式计算 (field -> element -> formula -> data_indicator) ==========
  // 2.1 获取元素映射 (field -> element)
  const elementMappingsResult = await db.query(
    `
      SELECT fm.field_id as "fieldId", fm.target_id as "elementId",
             el.code as "elementCode", el.name as "elementName"
      FROM field_mappings fm
      LEFT JOIN elements el ON fm.target_id = el.id
      WHERE fm.tool_id = $1 AND fm.mapping_type = 'element'
    `,
    [submission.toolId]
  );
  const elementMappings = (elementMappingsResult.rows || []).filter(m => m.fieldId && m.elementCode);

  // 2.2 从提交数据中提取元素值
  const elementValues = {};
  for (const em of elementMappings) {
    const raw = getValueByFieldId(dataObj, em.fieldId);
    const { value } = toIndicatorValue(raw);
    if (value !== null) {
      elementValues[em.elementCode] = value;
    }
  }

  // 2.3 获取项目关联的指标体系
  const projectResult = await db.query(
    `SELECT indicator_system_id as "indicatorSystemId" FROM projects WHERE id = $1`,
    [submission.projectId]
  );
  const indicatorSystemId = projectResult.rows[0]?.indicatorSystemId;

  // 2.4 获取数据指标及其关联的元素公式
  let formulaIndicators = [];
  if (indicatorSystemId && Object.keys(elementValues).length > 0) {
    const formulaResult = await db.query(
      `
        SELECT di.id as "dataIndicatorId", di.code as "indicatorCode", di.name as "indicatorName",
               di.threshold, el.formula, el.code as "elementCode"
        FROM data_indicators di
        JOIN indicators ind ON di.indicator_id = ind.id
        LEFT JOIN data_indicator_elements die ON di.id = die.data_indicator_id AND die.mapping_type = 'primary'
        LEFT JOIN elements el ON die.element_id = el.id
        WHERE ind.system_id = $1 AND el.formula IS NOT NULL
      `,
      [indicatorSystemId]
    );
    formulaIndicators = formulaResult.rows || [];
  }

  // 2.5 加载所有要素定义（用于扩展公式计算）
  let allElements = [];
  const elementsResult = await db.query(`
    SELECT e.code, e.name, e.element_type, e.data_type, e.formula, e.field_id
    FROM elements e
    WHERE e.library_id = (SELECT id FROM element_libraries WHERE name = '义务教育优质均衡要素库' LIMIT 1)
  `);
  if (elementsResult.rows) {
    allElements = elementsResult.rows.map(e => ({
      code: e.code,
      name: e.name,
      elementType: e.element_type,
      dataType: e.data_type,
      formula: e.formula,
      fieldId: e.field_id
    }));
  }

  // 2.6 构建扩展公式计算所需的样本数据（包含数组等复杂类型）
  const extendedSampleData = {};
  for (const em of elementMappings) {
    const raw = getValueByFieldId(dataObj, em.fieldId);
    // 对于扩展计算，保留原始值（包括数组）
    extendedSampleData[em.fieldId] = raw;
  }

  // 合并所有需要写入的记录
  const recordsToWrite = [];

  // 处理直接映射
  for (const m of directMappings) {
    const raw = getValueByFieldId(dataObj, m.fieldId);
    const { value, textValue } = toIndicatorValue(raw);
    if (value !== null || (textValue !== null && textValue !== '')) {
      recordsToWrite.push({
        dataIndicatorId: m.dataIndicatorId,
        value,
        textValue,
      });
    }
  }

  // 处理公式计算
  for (const fi of formulaIndicators) {
    if (!fi.formula) continue;

    // 检查公式是否包含扩展函数
    const hasExtendedFunction = EXTENDED_FUNCTION_KEYWORDS.some(keyword =>
      fi.formula.toUpperCase().includes(keyword)
    );

    let calculatedValue = null;
    if (hasExtendedFunction && allElements.length > 0) {
      // 使用扩展公式计算
      const calculatedCache = new Map();
      const result = calculateDerivedValueForSample(fi.elementCode, allElements, extendedSampleData, calculatedCache);
      // 对于布尔类型结果，转换为 1/0
      if (typeof result === 'boolean') {
        calculatedValue = result ? 1 : 0;
      } else if (typeof result === 'number' && Number.isFinite(result)) {
        calculatedValue = Math.round(result * 10000) / 10000;
      }
    } else {
      // 使用简单公式计算
      calculatedValue = evaluateFormula(fi.formula, elementValues);
    }

    if (calculatedValue !== null) {
      // 检查是否已被直接映射覆盖
      const existingIdx = recordsToWrite.findIndex(r => r.dataIndicatorId === fi.dataIndicatorId);
      if (existingIdx === -1) {
        recordsToWrite.push({
          dataIndicatorId: fi.dataIndicatorId,
          value: calculatedValue,
          textValue: null,
          threshold: fi.threshold,
        });
      }
    }
  }

  if (recordsToWrite.length === 0) {
    return { written: 0, reason: '未找到有效的指标映射或公式计算结果' };
  }

  // 获取所有相关指标的阈值
  const allIndicatorIds = Array.from(new Set(recordsToWrite.map(x => x.dataIndicatorId)));
  const thresholdsResult = await db.query(
    `SELECT id, threshold FROM data_indicators WHERE id = ANY($1)`,
    [allIndicatorIds]
  );
  const thresholdById = new Map((thresholdsResult.rows || []).map(r => [r.id, r.threshold]));

  // 获取已存在的记录
  const existingResult = await db.query(
    `
      SELECT id, data_indicator_id as "dataIndicatorId"
      FROM school_indicator_data
      WHERE project_id = $1 AND school_id = $2 AND data_indicator_id = ANY($3)
    `,
    [submission.projectId, submission.schoolId, allIndicatorIds]
  );
  const existingIdByIndicator = new Map((existingResult.rows || []).map(r => [r.dataIndicatorId, r.id]));

  // 构建最终记录
  const records = recordsToWrite.map(x => {
    const threshold = x.threshold || thresholdById.get(x.dataIndicatorId) || null;
    const compliant = threshold && x.value !== null ? checkCompliance(x.value, threshold) : null;
    return {
      id: existingIdByIndicator.get(x.dataIndicatorId) || ('sid-' + generateId()),
      project_id: submission.projectId,
      school_id: submission.schoolId,
      data_indicator_id: x.dataIndicatorId,
      value: x.value,
      text_value: x.textValue,
      is_compliant: compliant === null ? null : (compliant ? 1 : 0),
      submission_id: submission.id,
      collected_at: submission.collectedAt || today,
      created_at: today,
      updated_at: today,
    };
  });

  const BATCH_SIZE = 200;
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    // eslint-disable-next-line no-await-in-loop
    const { error } = await db
      .from('school_indicator_data')
      .upsert(records.slice(i, i + BATCH_SIZE), { onConflict: 'project_id,school_id,data_indicator_id' });
    if (error) throw error;
  }

  return { written: records.length, directMappings: directMappings.length, formulaCalculated: formulaIndicators.filter(fi => fi.formula && evaluateFormula(fi.formula, elementValues) !== null).length };
}

// ==================== 项目 CRUD ====================

// 获取项目列表
router.get('/projects', async (req, res) => {
  try {
    const { status, year, assessmentType } = req.query;
    let sql = `
      SELECT p.id, p.name, (to_jsonb(p)->>'keywords') as keywords, p.description, p.indicator_system_id as "indicatorSystemId",
             p.element_library_id as "elementLibraryId",
             p.start_date as "startDate", p.end_date as "endDate", p.status,
             COALESCE(p.assessment_type, '优质均衡') as "assessmentType",
             COALESCE((to_jsonb(p)->>'is_published')::boolean, false) as "isPublished",
             p.created_by as "createdBy", p.created_at as "createdAt", p.updated_at as "updatedAt",
             i.name as "indicatorSystemName",
             el.name as "elementLibraryName"
      FROM projects p
      LEFT JOIN indicator_systems i ON p.indicator_system_id = i.id
      LEFT JOIN element_libraries el ON p.element_library_id = el.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (status) {
      sql += ` AND p.status = $${paramIndex++}`;
      params.push(status);
    }

    if (year) {
      sql += ` AND EXTRACT(YEAR FROM p.start_date::date) = $${paramIndex++}`;
      params.push(year);
    }

    if (assessmentType) {
      sql += ` AND COALESCE(p.assessment_type, '优质均衡') = $${paramIndex++}`;
      params.push(assessmentType);
    }

    sql += ' ORDER BY p.created_at DESC';

    const result = await db.query(sql, params);
    const projects = result.rows.map(p => ({
      ...p,
      keywords: p.keywords ? JSON.parse(p.keywords) : []
    }));

    res.json({ code: 200, data: projects });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取单个项目
router.get('/projects/:id', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT p.id, p.name, (to_jsonb(p)->>'keywords') as keywords, p.description, p.indicator_system_id as "indicatorSystemId",
             p.element_library_id as "elementLibraryId",
             p.start_date as "startDate", p.end_date as "endDate", p.status,
             COALESCE(p.assessment_type, '优质均衡') as "assessmentType",
             COALESCE((to_jsonb(p)->>'is_published')::boolean, false) as "isPublished",
             p.created_by as "createdBy", p.created_at as "createdAt", p.updated_at as "updatedAt",
             i.name as "indicatorSystemName",
             el.name as "elementLibraryName"
      FROM projects p
      LEFT JOIN indicator_systems i ON p.indicator_system_id = i.id
      LEFT JOIN element_libraries el ON p.element_library_id = el.id
      WHERE p.id = $1
    `, [req.params.id]);

    const project = result.rows[0];

    if (!project) {
      return res.status(404).json({ code: 404, message: '项目不存在' });
    }

    project.keywords = project.keywords ? JSON.parse(project.keywords) : [];
    res.json({ code: 200, data: project });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 创建项目
router.post('/projects', projectRules.create, async (req, res) => {
  try {
    const { name, keywords, description, indicatorSystemId, elementLibraryId, startDate, endDate, assessmentType } = req.body;

    // 验证指标体系是否存在（程序层面引用验证）
    if (indicatorSystemId) {
      const systemResult = await db.query('SELECT id FROM indicator_systems WHERE id = $1', [indicatorSystemId]);
      if (!systemResult.rows[0]) {
        return res.status(400).json({ code: 400, message: '指标体系不存在' });
      }
    }

    // 验证要素库是否存在（程序层面引用验证）
    if (elementLibraryId) {
      const libraryResult = await db.query('SELECT id FROM element_libraries WHERE id = $1', [elementLibraryId]);
      if (!libraryResult.rows[0]) {
        return res.status(400).json({ code: 400, message: '要素库不存在' });
      }
    }

    const id = generateId();
    const timestamp = now().split('T')[0];

    const { data, error } = await db
      .from('projects')
      .insert({
        id,
        name,
        keywords: JSON.stringify(keywords || []),
        description,
        indicator_system_id: indicatorSystemId,
        element_library_id: elementLibraryId,
        start_date: startDate,
        end_date: endDate,
        assessment_type: assessmentType || '优质均衡',
        status: '配置中',
        created_by: 'admin',
        created_at: timestamp,
        updated_at: timestamp,
      })
      .select('id');

    if (error) throw error;
    return res.json({ code: 200, data: { id: data?.[0]?.id || id }, message: '创建成功' });
  } catch (error) {
    return res.status(500).json({ code: 500, message: error.message });
  }
});

// 更新项目
router.put('/projects/:id', async (req, res) => {
  try {
    const { name, keywords, description, indicatorSystemId, elementLibraryId, startDate, endDate, status, assessmentType } = req.body;

    // 程序层面枚举验证
    if (status) {
      try {
        validateEnum('PROJECT_STATUS', status, 'status');
      } catch (e) {
        return res.status(400).json({ code: 400, message: e.message });
      }
    }

    if (assessmentType) {
      try {
        validateEnum('ASSESSMENT_TYPE', assessmentType, 'assessmentType');
      } catch (e) {
        return res.status(400).json({ code: 400, message: e.message });
      }
    }

    // 验证指标体系是否存在（程序层面引用验证）
    if (indicatorSystemId) {
      const systemResult = await db.query('SELECT id FROM indicator_systems WHERE id = $1', [indicatorSystemId]);
      if (!systemResult.rows[0]) {
        return res.status(400).json({ code: 400, message: '指标体系不存在' });
      }
    }

    // 验证要素库是否存在（程序层面引用验证）
    if (elementLibraryId) {
      const libraryResult = await db.query('SELECT id FROM element_libraries WHERE id = $1', [elementLibraryId]);
      if (!libraryResult.rows[0]) {
        return res.status(400).json({ code: 400, message: '要素库不存在' });
      }
    }

    const timestamp = now().split('T')[0];

    const updates = {
      ...(name !== undefined ? { name } : {}),
      ...(keywords !== undefined ? { keywords: JSON.stringify(keywords || []) } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(indicatorSystemId !== undefined ? { indicator_system_id: indicatorSystemId } : {}),
      ...(elementLibraryId !== undefined ? { element_library_id: elementLibraryId } : {}),
      ...(startDate !== undefined ? { start_date: startDate } : {}),
      ...(endDate !== undefined ? { end_date: endDate } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(assessmentType !== undefined ? { assessment_type: assessmentType } : {}),
      updated_at: timestamp,
    };

    const { data, error } = await db
      .from('projects')
      .update(updates)
      .eq('id', req.params.id)
      .select('id');

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ code: 404, message: '项目不存在' });
    }

    return res.json({ code: 200, message: '更新成功' });
  } catch (error) {
    return res.status(500).json({ code: 500, message: error.message });
  }
});

// 启动填报
router.post('/projects/:id/start', async (req, res) => {
  try {
    // 检查项目当前状态
    const projectResult = await db.query(
      `SELECT status,
              COALESCE((to_jsonb(p)->>'is_published')::boolean, false) as is_published
         FROM projects p
        WHERE id = $1`,
      [req.params.id]
    );
    const project = projectResult.rows[0];
    if (!project) {
      return res.status(404).json({ code: 404, message: '项目不存在' });
    }
    if (!project.is_published) {
      return res.status(400).json({ code: 400, message: '只有已发布的项目可以启动填报' });
    }
    if (project.status !== '配置中') {
      return res.status(400).json({ code: 400, message: '只有配置中的项目可以启动填报' });
    }

    const timestamp = now().split('T')[0];
    const { data, error } = await db
      .from('projects')
      .update({ status: '填报中', updated_at: timestamp })
      .eq('id', req.params.id)
      .select('id');
    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ code: 404, message: '项目不存在' });
    }

    return res.json({ code: 200, message: '填报已启动' });
  } catch (error) {
    return res.status(500).json({ code: 500, message: error.message });
  }
});

// 中止项目
router.post('/projects/:id/stop', async (req, res) => {
  try {
    const projectResult = await db.query('SELECT status FROM projects WHERE id = $1', [req.params.id]);
    const project = projectResult.rows[0];
    if (!project) {
      return res.status(404).json({ code: 404, message: '项目不存在' });
    }
    if (project.status === '已完成' || project.status === '已中止') {
      return res.status(400).json({ code: 400, message: '已完成或已中止的项目无法再次中止' });
    }

    const timestamp = now().split('T')[0];
    const { data, error } = await db
      .from('projects')
      .update({ status: '已中止', updated_at: timestamp })
      .eq('id', req.params.id)
      .select('id');
    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ code: 404, message: '项目不存在' });
    }

    return res.json({ code: 200, message: '项目已中止' });
  } catch (error) {
    return res.status(500).json({ code: 500, message: error.message });
  }
});

// 进入评审
router.post('/projects/:id/review', async (req, res) => {
  try {
    const projectResult = await db.query('SELECT status FROM projects WHERE id = $1', [req.params.id]);
    const project = projectResult.rows[0];
    if (!project) {
      return res.status(404).json({ code: 404, message: '项目不存在' });
    }
    if (project.status !== '填报中') {
      return res.status(400).json({ code: 400, message: '只有填报中的项目可以进入评审' });
    }

    const timestamp = now().split('T')[0];
    const { data, error } = await db
      .from('projects')
      .update({ status: '评审中', updated_at: timestamp })
      .eq('id', req.params.id)
      .select('id');
    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ code: 404, message: '项目不存在' });
    }

    return res.json({ code: 200, message: '项目已进入评审阶段' });
  } catch (error) {
    return res.status(500).json({ code: 500, message: error.message });
  }
});

// 完成项目
router.post('/projects/:id/complete', async (req, res) => {
  try {
    const projectResult = await db.query('SELECT status FROM projects WHERE id = $1', [req.params.id]);
    const project = projectResult.rows[0];
    if (!project) {
      return res.status(404).json({ code: 404, message: '项目不存在' });
    }
    if (project.status !== '评审中') {
      return res.status(400).json({ code: 400, message: '只有评审中的项目可以完成' });
    }

    const timestamp = now().split('T')[0];
    const { data, error } = await db
      .from('projects')
      .update({ status: '已完成', updated_at: timestamp })
      .eq('id', req.params.id)
      .select('id');
    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ code: 404, message: '项目不存在' });
    }

    return res.json({ code: 200, message: '项目已完成' });
  } catch (error) {
    return res.status(500).json({ code: 500, message: error.message });
  }
});

// 重新启动项目（从已中止恢复到配置中）
router.post('/projects/:id/restart', async (req, res) => {
  try {
    const projectResult = await db.query('SELECT status FROM projects WHERE id = $1', [req.params.id]);
    const project = projectResult.rows[0];
    if (!project) {
      return res.status(404).json({ code: 404, message: '项目不存在' });
    }
    if (project.status !== '已中止') {
      return res.status(400).json({ code: 400, message: '只有已中止的项目可以重新启动' });
    }

    const timestamp = now().split('T')[0];
    const { data, error } = await db
      .from('projects')
      .update({ status: '配置中', updated_at: timestamp })
      .eq('id', req.params.id)
      .select('id');
    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ code: 404, message: '项目不存在' });
    }

    return res.json({ code: 200, message: '项目已重新启动' });
  } catch (error) {
    return res.status(500).json({ code: 500, message: error.message });
  }
});

// 发布项目
router.post('/projects/:id/publish', async (req, res) => {
  try {
    const projectResult = await db.query(
      `SELECT status,
              COALESCE((to_jsonb(p)->>'is_published')::boolean, false) as is_published
         FROM projects p
        WHERE id = $1`,
      [req.params.id]
    );
    const project = projectResult.rows[0];
    if (!project) {
      return res.status(404).json({ code: 404, message: '项目不存在' });
    }
    if (project.is_published) {
      return res.status(400).json({ code: 400, message: '项目已经是发布状态' });
    }

    const timestamp = now().split('T')[0];
    const { data, error } = await db
      .from('projects')
      .update({ is_published: true, updated_at: timestamp })
      .eq('id', req.params.id)
      .select('id');
    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ code: 404, message: '项目不存在' });
    }

    return res.json({ code: 200, message: '项目已发布' });
  } catch (error) {
    // Supabase/PostgREST：当数据库缺少列或 schema cache 未刷新时，会抛出类似：
    // "Could not find the 'is_published' column of 'projects' in the schema cache"
    const msg = String(error?.message || '');
    if (msg.includes("is_published") && msg.includes('projects') && msg.includes('schema cache')) {
      return res.status(500).json({
        code: 500,
        message:
          "数据库表 projects 缺少字段 is_published（或 PostgREST schema cache 未刷新）。请在 Supabase SQL Editor 执行 backend/database/fix-missing-columns.sql（至少包含：ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false;），然后执行：NOTIFY pgrst, 'reload schema'; 再重试。",
      });
    }
    return res.status(500).json({ code: 500, message: msg });
  }
});

// 取消发布项目
router.post('/projects/:id/unpublish', async (req, res) => {
  try {
    const projectResult = await db.query(
      `SELECT status,
              COALESCE((to_jsonb(p)->>'is_published')::boolean, false) as is_published
         FROM projects p
        WHERE id = $1`,
      [req.params.id]
    );
    const project = projectResult.rows[0];
    if (!project) {
      return res.status(404).json({ code: 404, message: '项目不存在' });
    }
    if (!project.is_published) {
      return res.status(400).json({ code: 400, message: '项目已经是未发布状态' });
    }
    // 只有配置中状态的项目可以取消发布
    if (project.status !== '配置中') {
      return res.status(400).json({ code: 400, message: '只有配置中的项目可以取消发布' });
    }

    const timestamp = now().split('T')[0];
    const { data, error } = await db
      .from('projects')
      .update({ is_published: false, updated_at: timestamp })
      .eq('id', req.params.id)
      .select('id');
    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ code: 404, message: '项目不存在' });
    }

    return res.json({ code: 200, message: '项目已取消发布' });
  } catch (error) {
    const msg = String(error?.message || '');
    if (msg.includes("is_published") && msg.includes('projects') && msg.includes('schema cache')) {
      return res.status(500).json({
        code: 500,
        message:
          "数据库表 projects 缺少字段 is_published（或 PostgREST schema cache 未刷新）。请在 Supabase SQL Editor 执行 backend/database/fix-missing-columns.sql（至少包含：ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false;），然后执行：NOTIFY pgrst, 'reload schema'; 再重试。",
      });
    }
    return res.status(500).json({ code: 500, message: msg });
  }
});

// 删除项目（使用级联删除服务）
router.delete('/projects/:id', async (req, res) => {
  try {
    const projectResult = await db.query('SELECT status FROM projects WHERE id = $1', [req.params.id]);
    const project = projectResult.rows[0];
    if (!project) {
      return res.status(404).json({ code: 404, message: '项目不存在' });
    }
    if (project.status !== '配置中') {
      return res.status(400).json({ code: 400, message: '只有配置中的项目可以删除' });
    }

    const result = await deleteProject(req.params.id);

    res.json({ code: 200, message: '删除成功', data: result.deleted });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ==================== 填报记录 CRUD ====================

// 获取填报记录列表
router.get('/submissions', async (req, res) => {
  try {
    const { projectId, formId, status, submitterOrg } = req.query;
    let sql = `
      SELECT s.id, s.project_id as "projectId",
             COALESCE(s.form_id, s.tool_id) as "formId",
             s.school_id as "schoolId",
             s.submitter_id as "submitterId", s.submitter_name as "submitterName",
             s.submitter_org as "submitterOrg", s.status, s.reject_reason as "rejectReason",
             s.created_at as "createdAt", s.updated_at as "updatedAt",
             s.submitted_at as "submittedAt", s.approved_at as "approvedAt",
             p.name as "projectName", t.name as "formName"
      FROM submissions s
      LEFT JOIN projects p ON s.project_id = p.id
      LEFT JOIN data_tools t ON COALESCE(s.form_id, s.tool_id) = t.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (projectId) {
      sql += ` AND s.project_id = $${paramIndex++}`;
      params.push(projectId);
    }
    if (formId) {
      sql += ` AND COALESCE(s.form_id, s.tool_id) = $${paramIndex++}`;
      params.push(formId);
    }
    if (status) {
      sql += ` AND s.status = $${paramIndex++}`;
      params.push(status);
    }
    if (submitterOrg) {
      sql += ` AND s.submitter_org LIKE $${paramIndex++}`;
      params.push(`%${submitterOrg}%`);
    }

    sql += ' ORDER BY s.updated_at DESC';

    const result = await db.query(sql, params);
    res.json({ code: 200, data: result.rows });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取项目下的填报记录
router.get('/projects/:projectId/submissions', async (req, res) => {
  try {
    const { districtId, schoolId, formId, status } = req.query;

    let sql = `
      SELECT s.id, s.project_id as "projectId",
             COALESCE(s.form_id, s.tool_id) as "formId",
             s.school_id as "schoolId",
             s.submitter_id as "submitterId", s.submitter_name as "submitterName",
             s.submitter_org as "submitterOrg", s.status, s.reject_reason as "rejectReason",
             s.created_at as "createdAt", s.updated_at as "updatedAt",
             s.submitted_at as "submittedAt", s.approved_at as "approvedAt",
             t.name as "formName",
             sc.name as "schoolName",
             d.name as "districtName"
      FROM submissions s
      LEFT JOIN data_tools t ON COALESCE(s.form_id, s.tool_id) = t.id
      LEFT JOIN schools sc ON s.school_id = sc.id
      LEFT JOIN districts d ON sc.district_id = d.id
      WHERE s.project_id = $1
    `;
    const params = [req.params.projectId];
    let paramIndex = 2;

    // 按区县过滤
    if (districtId) {
      sql += ` AND sc.district_id = $${paramIndex++}`;
      params.push(districtId);
    }

    // 按学校过滤
    if (schoolId) {
      sql += ` AND s.school_id = $${paramIndex++}`;
      params.push(schoolId);
    }

    // 按表单过滤
    if (formId) {
      sql += ` AND COALESCE(s.form_id, s.tool_id) = $${paramIndex++}`;
      params.push(formId);
    }

    // 按状态过滤
    if (status) {
      sql += ` AND s.status = $${paramIndex++}`;
      params.push(status);
    }

    sql += ' ORDER BY s.updated_at DESC';

    const result = await db.query(sql, params);
    res.json({ code: 200, data: result.rows });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取区县下所有学校的填报记录（区县管理员专用）
router.get('/districts/:districtId/submissions', async (req, res) => {
  try {
    const { districtId } = req.params;
    const { projectId, schoolId, formId, status } = req.query;

    // 验证区县存在
    const districtResult = await db.query('SELECT id, name FROM districts WHERE id = $1', [districtId]);
    if (!districtResult.rows[0]) {
      return res.status(404).json({ code: 404, message: '区县不存在' });
    }

    let sql = `
      SELECT s.id, s.project_id as "projectId",
             COALESCE(s.form_id, s.tool_id) as "formId",
             s.school_id as "schoolId",
             s.submitter_id as "submitterId", s.submitter_name as "submitterName",
             s.submitter_org as "submitterOrg", s.status, s.reject_reason as "rejectReason",
             s.created_at as "createdAt", s.updated_at as "updatedAt",
             s.submitted_at as "submittedAt", s.approved_at as "approvedAt",
             t.name as "formName",
             p.name as "projectName",
             sc.name as "schoolName", sc.code as "schoolCode",
             sc.school_type as "schoolType"
      FROM submissions s
      LEFT JOIN data_tools t ON COALESCE(s.form_id, s.tool_id) = t.id
      LEFT JOIN projects p ON s.project_id = p.id
      JOIN schools sc ON s.school_id = sc.id
      WHERE sc.district_id = $1
    `;
    const params = [districtId];
    let paramIndex = 2;

    // 按项目过滤（可选）
    if (projectId) {
      sql += ` AND s.project_id = $${paramIndex++}`;
      params.push(projectId);
    }

    // 按学校过滤
    if (schoolId) {
      sql += ` AND s.school_id = $${paramIndex++}`;
      params.push(schoolId);
    }

    // 按表单过滤
    if (formId) {
      sql += ` AND COALESCE(s.form_id, s.tool_id) = $${paramIndex++}`;
      params.push(formId);
    }

    // 按状态过滤
    if (status) {
      sql += ` AND s.status = $${paramIndex++}`;
      params.push(status);
    }

    sql += ' ORDER BY sc.name, s.updated_at DESC';

    const result = await db.query(sql, params);

    // 统计
    const stats = {
      total: result.rows.length,
      draft: result.rows.filter(r => r.status === 'draft').length,
      submitted: result.rows.filter(r => r.status === 'submitted').length,
      approved: result.rows.filter(r => r.status === 'approved').length,
      rejected: result.rows.filter(r => r.status === 'rejected').length
    };

    res.json({
      code: 200,
      data: {
        district: districtResult.rows[0],
        stats,
        submissions: result.rows
      }
    });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取区县自身填报记录（区县管理员专用：区县级工具 target='区县'）
router.get('/districts/:districtId/district-submissions', async (req, res) => {
  try {
    const { districtId } = req.params;
    const { projectId, formId, status, keyword } = req.query;

    // 验证区县存在
    const districtResult = await db.query('SELECT id, name FROM districts WHERE id = $1', [districtId]);
    const district = districtResult.rows[0];
    if (!district) {
      return res.status(404).json({ code: 404, message: '区县不存在' });
    }

    let sql = `
      SELECT s.id, s.project_id as "projectId",
             COALESCE(s.form_id, s.tool_id) as "formId",
             s.school_id as "schoolId",
             s.submitter_id as "submitterId", s.submitter_name as "submitterName",
             s.submitter_org as "submitterOrg", s.status, s.reject_reason as "rejectReason",
             s.created_at as "createdAt", s.updated_at as "updatedAt",
             s.submitted_at as "submittedAt", s.approved_at as "approvedAt",
             t.name as "formName", t.target as "formTarget",
             p.name as "projectName"
      FROM submissions s
      LEFT JOIN data_tools t ON COALESCE(s.form_id, s.tool_id) = t.id
      LEFT JOIN projects p ON s.project_id = p.id
      WHERE t.target = '区县'
        AND (s.submitter_org = $1 OR s.submitter_org LIKE $2)
    `;
    const params = [district.name, `%${district.name}%`];
    let paramIndex = 3;

    // 按项目过滤（可选）
    if (projectId) {
      sql += ` AND s.project_id = $${paramIndex++}`;
      params.push(projectId);
    }

    // 按表单过滤（可选）
    if (formId) {
      sql += ` AND COALESCE(s.form_id, s.tool_id) = $${paramIndex++}`;
      params.push(formId);
    }

    // 按状态过滤（可选）
    if (status) {
      sql += ` AND s.status = $${paramIndex++}`;
      params.push(status);
    }

    // 关键字（可选）：表单名/填报人/填报单位模糊匹配
    if (keyword) {
      sql += ` AND (t.name LIKE $${paramIndex++} OR s.submitter_name LIKE $${paramIndex++} OR s.submitter_org LIKE $${paramIndex++})`;
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    sql += ' ORDER BY s.updated_at DESC';

    const result = await db.query(sql, params);

    const stats = {
      total: result.rows.length,
      draft: result.rows.filter(r => r.status === 'draft').length,
      submitted: result.rows.filter(r => r.status === 'submitted').length,
      approved: result.rows.filter(r => r.status === 'approved').length,
      rejected: result.rows.filter(r => r.status === 'rejected').length
    };

    res.json({
      code: 200,
      data: {
        district,
        stats,
        submissions: result.rows
      }
    });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取单个填报记录（含数据）
router.get('/submissions/:id', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT s.id, s.project_id as "projectId",
             COALESCE(s.form_id, s.tool_id) as "formId",
             s.school_id as "schoolId",
             s.submitter_id as "submitterId", s.submitter_name as "submitterName",
             s.submitter_org as "submitterOrg", s.status, s.data, s.reject_reason as "rejectReason",
             s.created_at as "createdAt", s.updated_at as "updatedAt",
             s.submitted_at as "submittedAt", s.approved_at as "approvedAt",
             p.name as "projectName", t.name as "formName", t.schema
      FROM submissions s
      LEFT JOIN projects p ON s.project_id = p.id
      LEFT JOIN data_tools t ON COALESCE(s.form_id, s.tool_id) = t.id
      WHERE s.id = $1
    `, [req.params.id]);

    const submission = result.rows[0];

    if (!submission) {
      return res.status(404).json({ code: 404, message: '填报记录不存在' });
    }

    submission.data = submission.data ? JSON.parse(submission.data) : {};
    submission.schema = submission.schema ? JSON.parse(submission.schema) : [];

    res.json({ code: 200, data: submission });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 创建填报记录（草稿）
router.post('/submissions', async (req, res) => {
  try {
    const { projectId, formId, schoolId, submitterId, submitterName, submitterOrg, data } = req.body;

    // 验证项目是否存在（程序层面引用验证）
    const projectResult = await db.query('SELECT id FROM projects WHERE id = $1', [projectId]);
    if (!projectResult.rows[0]) {
      return res.status(400).json({ code: 400, message: '项目不存在' });
    }

    // 验证表单是否存在并获取目标类型（程序层面引用验证）
    const formResult = await db.query('SELECT id, target FROM data_tools WHERE id = $1', [formId]);
    if (!formResult.rows[0]) {
      return res.status(400).json({ code: 400, message: '表单不存在' });
    }
    const formTarget = formResult.rows[0].target; // '学校' | '区县' | 其他

    const id = generateId();
    const timestamp = now();

    // 兼容数据库 submissions.school_id 为 NOT NULL 的情况：
    // school_id 实际上是"填报主体ID"，可以是学校ID或区县样本ID
    let resolvedSchoolId = schoolId || null;

    // 区县级表单：尝试从 project_samples 或 districts 匹配区县
    if (!resolvedSchoolId && formTarget === '区县' && submitterOrg) {
      // 去掉常见后缀（如"教育局"、"教育和体育局"等）后的名称
      const orgNameVariants = [
        submitterOrg,
        submitterOrg.replace(/教育局$/, ''),
        submitterOrg.replace(/教育和体育局$/, ''),
        submitterOrg.replace(/教体局$/, ''),
      ].filter((v, i, arr) => arr.indexOf(v) === i); // 去重

      // 优先从 project_samples 匹配（项目配置的区县样本）
      for (const orgName of orgNameVariants) {
        const districtSample = await db.query(
          `SELECT id FROM project_samples WHERE project_id = $1 AND type = 'district' AND name = $2 LIMIT 1`,
          [projectId, orgName]
        );
        if (districtSample.rows?.[0]?.id) {
          resolvedSchoolId = districtSample.rows[0].id;
          break;
        }
      }

      // 如果精确匹配失败，尝试包含关系匹配（区县名称包含在 submitterOrg 中）
      if (!resolvedSchoolId) {
        const districtSampleLike = await db.query(
          `SELECT id FROM project_samples WHERE project_id = $1 AND type = 'district' AND $2 LIKE '%' || name || '%' LIMIT 1`,
          [projectId, submitterOrg]
        );
        if (districtSampleLike.rows?.[0]?.id) {
          resolvedSchoolId = districtSampleLike.rows[0].id;
        }
      }

      // 其次从 districts 表匹配
      if (!resolvedSchoolId) {
        for (const orgName of orgNameVariants) {
          const districtById = await db.query('SELECT id FROM districts WHERE name = $1 LIMIT 1', [orgName]);
          if (districtById.rows?.[0]?.id) {
            resolvedSchoolId = districtById.rows[0].id;
            break;
          }
        }
      }
    }

    // 学校级表单：尝试匹配学校
    if (!resolvedSchoolId && submitterId) {
      const schoolById = await db.query('SELECT id FROM schools WHERE id = $1 LIMIT 1', [submitterId]);
      if (schoolById.rows?.[0]?.id) resolvedSchoolId = schoolById.rows[0].id;
    }
    if (!resolvedSchoolId && submitterOrg) {
      // 尝试从 project_samples 匹配学校样本
      const schoolSample = await db.query(
        `SELECT id FROM project_samples WHERE project_id = $1 AND type = 'school' AND name = $2 LIMIT 1`,
        [projectId, submitterOrg]
      );
      if (schoolSample.rows?.[0]?.id) {
        resolvedSchoolId = schoolSample.rows[0].id;
      } else {
        // 其次从 schools 表匹配
        const schoolByName = await db.query('SELECT id FROM schools WHERE name = $1 LIMIT 2', [submitterOrg]);
        if ((schoolByName.rows || []).length === 1) resolvedSchoolId = schoolByName.rows[0].id;
      }
    }

    if (!resolvedSchoolId) {
      const targetType = formTarget === '区县' ? '区县' : '学校';
      return res.status(400).json({
        code: 400,
        message: `缺少填报主体：请确保 submitterOrg（${submitterOrg || '未提供'}）能匹配到项目中配置的${targetType}样本`,
      });
    }

    const { data: inserted, error } = await db
      .from('submissions')
      .insert({
        id,
        project_id: projectId,
        // 兼容不同库结构：部分库以 tool_id 作为“表单/采集工具”外键且为 NOT NULL
        // 约定：formId 即 data_tools.id，与 tool_id 同义
        tool_id: formId,
        form_id: formId,
        school_id: resolvedSchoolId,
        submitter_id: submitterId,
        submitter_name: submitterName,
        submitter_org: submitterOrg,
        status: 'draft',
        data: JSON.stringify(data || {}),
        created_at: timestamp,
        updated_at: timestamp,
      })
      .select('id');

    if (error) throw error;
    return res.json({ code: 200, data: { id: inserted?.[0]?.id || id }, message: '创建成功' });
  } catch (error) {
    return res.status(500).json({ code: 500, message: error.message });
  }
});

// 更新填报数据
router.put('/submissions/:id', async (req, res) => {
  try {
    const { data, submitterName, submitterOrg } = req.body;
    const timestamp = now();

    // 先查询当前记录的状态
    const { data: existing, error: fetchError } = await db
      .from('submissions')
      .select('id, status')
      .eq('id', req.params.id)
      .single();

    if (fetchError) throw fetchError;
    if (!existing) {
      return res.status(404).json({ code: 404, message: '填报记录不存在' });
    }

    // 只允许更新草稿状态或驳回状态的记录
    if (existing.status !== 'draft' && existing.status !== 'rejected') {
      return res.status(400).json({ code: 400, message: '只能更新草稿状态或驳回状态的填报记录' });
    }

    const { data: updated, error } = await db
      .from('submissions')
      .update({
        data: JSON.stringify(data || {}),
        submitter_name: submitterName,
        submitter_org: submitterOrg,
        updated_at: timestamp,
      })
      .eq('id', req.params.id)
      .in('status', ['draft', 'rejected'])
      .select('id');

    if (error) throw error;
    if (!updated || updated.length === 0) {
      return res.status(400).json({ code: 400, message: '更新失败' });
    }

    return res.json({ code: 200, message: '保存成功' });
  } catch (error) {
    return res.status(500).json({ code: 500, message: error.message });
  }
});

// 提交填报
router.post('/submissions/:id/submit', async (req, res) => {
  try {
    const timestamp = now();

    // 先获取提交记录信息，用于后续匹配任务
    const { data: submission, error: fetchError } = await db
      .from('submissions')
      .select('id, project_id, form_id, tool_id, school_id, status')
      .eq('id', req.params.id)
      .single();

    if (fetchError) throw fetchError;
    if (!submission) {
      return res.status(404).json({ code: 404, message: '填报记录不存在' });
    }
    if (submission.status !== 'draft' && submission.status !== 'rejected') {
      return res.status(400).json({ code: 400, message: '只能提交草稿或被驳回状态的填报记录' });
    }

    const wasRejected = submission.status === 'rejected';
    const toolId = submission.form_id || submission.tool_id;

    // 查询该工具是否需要审核
    let requireReview = true; // 默认需要审核
    if (toolId && submission.project_id) {
      const { data: toolConfig } = await db
        .from('project_tools')
        .select('require_review')
        .eq('project_id', submission.project_id)
        .eq('tool_id', toolId)
        .single();

      if (toolConfig && toolConfig.require_review === false) {
        requireReview = false;
      }
    }

    // 根据审核配置决定提交后状态
    // require_review=true: status='submitted' (待审核)
    // require_review=false: status='approved' (直接通过)
    const newStatus = requireReview ? 'submitted' : 'approved';
    const updateFields = {
      status: newStatus,
      submitted_at: timestamp,
      updated_at: timestamp,
    };
    if (!requireReview) {
      updateFields.approved_at = timestamp; // 免审核直接设置审核通过时间
    }

    // 更新提交状态
    const { error } = await db
      .from('submissions')
      .update(updateFields)
      .eq('id', req.params.id);

    if (error) throw error;

    // 同步更新关联任务的状态
    // - 如果是从被驳回状态重新提交：更新任务状态为 in_progress 或 completed
    // - 如果是免审核直接通过：任务状态设为 completed
    if (toolId && submission.project_id) {
      const taskStatus = requireReview
        ? (wasRejected ? 'in_progress' : undefined)  // 需要审核：被驳回重新提交才更新
        : 'completed';  // 免审核：直接完成

      if (taskStatus) {
        const taskUpdateFields = { status: taskStatus, updated_at: timestamp };
        if (taskStatus === 'completed') {
          taskUpdateFields.completed_at = timestamp;
        }

        // 方式1：通过 submission_id 匹配
        await db
          .from('tasks')
          .update(taskUpdateFields)
          .eq('submission_id', req.params.id);

        // 方式2：通过 project_id + tool_id + target_id(school_id) 匹配
        if (submission.school_id) {
          const targetStatuses = wasRejected ? ['rejected'] : ['pending', 'in_progress', 'rejected'];
          await db
            .from('tasks')
            .update(taskUpdateFields)
            .eq('project_id', submission.project_id)
            .eq('tool_id', toolId)
            .eq('target_id', submission.school_id)
            .in('status', targetStatuses);
        }
      }
    }

    // 提交后同步一次指标数据（有映射则写入 school_indicator_data）
    try {
      await syncSubmissionIndicators(req.params.id);
    } catch (e) {
      // 不阻断提交，但输出日志方便排查
      console.warn('[submission] sync indicators on submit failed:', e.message);
    }

    const message = requireReview ? '提交成功，等待审核' : '提交成功，已自动通过';
    return res.json({ code: 200, message, data: { status: newStatus, requireReview } });
  } catch (error) {
    return res.status(500).json({ code: 500, message: error.message });
  }
});

// 审核通过
router.post('/submissions/:id/approve', async (req, res) => {
  try {
    const timestamp = now();
    const { data, error } = await db
      .from('submissions')
      .update({ status: 'approved', approved_at: timestamp, updated_at: timestamp })
      .eq('id', req.params.id)
      .eq('status', 'submitted')
      .select('id');

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(400).json({ code: 400, message: '只能审核已提交状态的填报记录' });
    }

    // 审核通过后同步指标数据（写入 school_indicator_data，用于后续达标统计与详情回显）
    try {
      await syncSubmissionIndicators(req.params.id);
    } catch (e) {
      console.warn('[submission] sync indicators on approve failed:', e.message);
    }

    return res.json({ code: 200, message: '审核通过' });
  } catch (error) {
    return res.status(500).json({ code: 500, message: error.message });
  }
});

// 手动同步：将某条填报记录的数据按 field_mappings 回填到 school_indicator_data
router.post('/submissions/:id/sync-indicators', async (req, res) => {
  try {
    const out = await syncSubmissionIndicators(req.params.id);
    return res.json({ code: 200, data: out, message: '同步完成' });
  } catch (error) {
    return res.status(500).json({ code: 500, message: error.message });
  }
});

// 审核驳回
router.post('/submissions/:id/reject', async (req, res) => {
  try {
    const { reason } = req.body;
    const timestamp = now();

    // 先获取提交记录信息，用于后续匹配任务
    const { data: submission, error: fetchError } = await db
      .from('submissions')
      .select('id, project_id, form_id, tool_id, school_id, status')
      .eq('id', req.params.id)
      .single();

    if (fetchError) throw fetchError;
    if (!submission) {
      return res.status(404).json({ code: 404, message: '填报记录不存在' });
    }
    if (submission.status !== 'submitted') {
      return res.status(400).json({ code: 400, message: '只能驳回已提交状态的填报记录' });
    }

    // 更新提交状态为驳回
    const { error } = await db
      .from('submissions')
      .update({ status: 'rejected', reject_reason: reason || '', updated_at: timestamp })
      .eq('id', req.params.id);

    if (error) throw error;

    // 同步更新关联任务的状态为 rejected
    const toolId = submission.form_id || submission.tool_id;
    if (toolId && submission.project_id) {
      // 方式1：通过 submission_id 匹配
      await db
        .from('tasks')
        .update({ status: 'rejected', updated_at: timestamp })
        .eq('submission_id', req.params.id);

      // 方式2：通过 project_id + tool_id + target_id(school_id) 匹配
      if (submission.school_id) {
        await db
          .from('tasks')
          .update({ status: 'rejected', updated_at: timestamp })
          .eq('project_id', submission.project_id)
          .eq('tool_id', toolId)
          .eq('target_id', submission.school_id)
          .neq('status', 'rejected'); // 避免重复更新
      }
    }

    return res.json({ code: 200, message: '已驳回' });
  } catch (error) {
    return res.status(500).json({ code: 500, message: error.message });
  }
});

// 退回修改（将驳回的记录改回草稿状态）
router.post('/submissions/:id/revise', async (req, res) => {
  try {
    const timestamp = now();
    const { data, error } = await db
      .from('submissions')
      .update({ status: 'draft', reject_reason: null, updated_at: timestamp })
      .eq('id', req.params.id)
      .eq('status', 'rejected')
      .select('id');

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(400).json({ code: 400, message: '只能修改已驳回状态的填报记录' });
    }

    return res.json({ code: 200, message: '已退回修改' });
  } catch (error) {
    return res.status(500).json({ code: 500, message: error.message });
  }
});

// 删除填报记录
router.delete('/submissions/:id', async (req, res) => {
  try {
    const { data, error } = await db
      .from('submissions')
      .delete()
      .eq('id', req.params.id)
      .eq('status', 'draft')
      .select('id');

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(400).json({ code: 400, message: '只能删除草稿状态的填报记录' });
    }

    return res.json({ code: 200, message: '删除成功' });
  } catch (error) {
    return res.status(500).json({ code: 500, message: error.message });
  }
});

// ==================== 统计 ====================

// 获取填报统计
router.get('/projects/:projectId/stats', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft,
        SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) as submitted,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
      FROM submissions WHERE project_id = $1
    `, [req.params.projectId]);

    res.json({ code: 200, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取项目的指标映射汇总
router.get('/projects/:projectId/indicator-mapping-summary', async (req, res) => {
  try {
    const { projectId } = req.params;

    // 1. 获取项目信息和关联的指标体系
    const projectResult = await db.query(`
      SELECT p.id, p.name, p.indicator_system_id as "indicatorSystemId",
             i.name as "indicatorSystemName"
      FROM projects p
      LEFT JOIN indicator_systems i ON p.indicator_system_id = i.id
      WHERE p.id = $1
    `, [projectId]);

    const project = projectResult.rows[0];

    if (!project) {
      return res.status(404).json({ code: 404, message: '项目不存在' });
    }

    if (!project.indicatorSystemId) {
      return res.json({
        code: 200,
        data: {
          project,
          dataIndicators: [],
          stats: { total: 0, mapped: 0, unmapped: 0 },
        },
      });
    }

    // 2. 获取该指标体系下的所有数据指标
    const dataIndicatorsResult = await db.query(`
      SELECT di.id, di.code, di.name, di.threshold, di.description,
             ind.id as "indicatorId", ind.code as "indicatorCode", ind.name as "indicatorName"
      FROM data_indicators di
      JOIN indicators ind ON di.indicator_id = ind.id
      WHERE ind.system_id = $1
      ORDER BY di.code
    `, [project.indicatorSystemId]);

    const dataIndicators = dataIndicatorsResult.rows;

    // 3. 获取项目关联的所有工具及其字段映射
    const toolMappingsResult = await db.query(`
      SELECT fm.field_id as "fieldId", fm.mapping_type as "mappingType", fm.target_id as "targetId",
             dt.id as "toolId", dt.name as "toolName", dt.schema as "toolSchema"
      FROM project_tools pt
      JOIN data_tools dt ON pt.tool_id = dt.id
      LEFT JOIN field_mappings fm ON dt.id = fm.tool_id
      WHERE pt.project_id = $1 AND fm.mapping_type = 'data_indicator'
    `, [projectId]);

    const toolMappings = toolMappingsResult.rows;

    // 4. 构建映射查找表
    const mappingByTargetId = {};
    toolMappings.forEach(m => {
      if (m.targetId) {
        // 从 schema 中获取字段信息
        let fieldLabel = '';
        if (m.toolSchema) {
          try {
            const schema = JSON.parse(m.toolSchema);
            const findField = (fields, id) => {
              for (const f of fields) {
                if (f.id === m.fieldId) return f.label;
                if (f.children) {
                  const found = findField(f.children, id);
                  if (found) return found;
                }
              }
              return null;
            };
            fieldLabel = findField(schema, m.fieldId) || m.fieldId;
          } catch (e) {
            fieldLabel = m.fieldId;
          }
        }
        mappingByTargetId[m.targetId] = {
          toolId: m.toolId,
          toolName: m.toolName,
          fieldId: m.fieldId,
          fieldLabel: fieldLabel,
        };
      }
    });

    // 5. 合并数据指标和映射信息
    const result = dataIndicators.map(di => ({
      ...di,
      mapping: mappingByTargetId[di.id] || null,
      isMapped: !!mappingByTargetId[di.id],
    }));

    // 6. 统计
    const stats = {
      total: result.length,
      mapped: result.filter(r => r.isMapped).length,
      unmapped: result.filter(r => !r.isMapped).length,
    };

    res.json({
      code: 200,
      data: {
        project: {
          id: project.id,
          name: project.name,
          indicatorSystemId: project.indicatorSystemId,
          indicatorSystemName: project.indicatorSystemName,
        },
        dataIndicators: result,
        stats,
      },
    });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

module.exports = { router, setDb };
