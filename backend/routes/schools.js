const express = require('express');
const router = express.Router();
const { validateEnum, SCHOOL_TYPE, SCHOOL_CATEGORY, URBAN_RURAL_TYPE } = require('../constants/enums');

// 数据库连接将在index.js中注入
let db = null;

const setDb = (database) => {
  db = database;
};

// 生成UUID
const generateId = () => 's-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
const now = () => new Date().toISOString().split('T')[0];

// ==================== 学校管理 CRUD ====================

// 获取学校列表
router.get('/schools', async (req, res) => {
  try {
    const { districtId, schoolType, schoolCategory, urbanRural, status, keyword, page, pageSize } = req.query;

    let countSql = 'SELECT COUNT(*) as total FROM schools s WHERE 1=1';
    let sql = `
      SELECT s.id, s.code, s.name, s.district_id as "districtId",
             s.school_type as "schoolType", s.school_category as "schoolCategory",
             s.urban_rural as "urbanRural", s.address, s.principal,
             s.contact_phone as "contactPhone", s.student_count as "studentCount",
             s.teacher_count as "teacherCount", s.status,
             s.created_at as "createdAt", s.updated_at as "updatedAt",
             d.name as "districtName"
      FROM schools s
      LEFT JOIN districts d ON s.district_id = d.id
      WHERE 1=1
    `;
    const params = [];
    const countParams = [];
    let paramIndex = 1;
    let countParamIndex = 1;

    if (districtId) {
      sql += ` AND s.district_id = $${paramIndex++}`;
      countSql += ` AND s.district_id = $${countParamIndex++}`;
      params.push(districtId);
      countParams.push(districtId);
    }

    if (schoolType) {
      sql += ` AND s.school_type = $${paramIndex++}`;
      countSql += ` AND s.school_type = $${countParamIndex++}`;
      params.push(schoolType);
      countParams.push(schoolType);
    }

    if (schoolCategory) {
      sql += ` AND s.school_category = $${paramIndex++}`;
      countSql += ` AND s.school_category = $${countParamIndex++}`;
      params.push(schoolCategory);
      countParams.push(schoolCategory);
    }

    if (urbanRural) {
      sql += ` AND s.urban_rural = $${paramIndex++}`;
      countSql += ` AND s.urban_rural = $${countParamIndex++}`;
      params.push(urbanRural);
      countParams.push(urbanRural);
    }

    if (status) {
      sql += ` AND s.status = $${paramIndex++}`;
      countSql += ` AND s.status = $${countParamIndex++}`;
      params.push(status);
      countParams.push(status);
    }

    if (keyword) {
      sql += ` AND (s.name LIKE $${paramIndex++} OR s.code LIKE $${paramIndex++} OR s.principal LIKE $${paramIndex++})`;
      countSql += ` AND (s.name LIKE $${countParamIndex++} OR s.code LIKE $${countParamIndex++} OR s.principal LIKE $${countParamIndex++})`;
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
      countParams.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    // 获取总数
    const countResult = await db.query(countSql, countParams);
    const total = parseInt(countResult.rows[0].total);

    sql += ' ORDER BY d.sort_order, s.school_type, s.name';

    // 分页
    if (page && pageSize) {
      const offset = (parseInt(page) - 1) * parseInt(pageSize);
      sql += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
      params.push(parseInt(pageSize), offset);
    }

    const result = await db.query(sql, params);

    res.json({
      code: 200,
      data: {
        list: result.rows,
        total,
        page: page ? parseInt(page) : 1,
        pageSize: pageSize ? parseInt(pageSize) : total
      }
    });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取单个学校详情
router.get('/schools/:id', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT s.id, s.code, s.name, s.district_id as "districtId",
             s.school_type as "schoolType", s.school_category as "schoolCategory",
             s.urban_rural as "urbanRural", s.address, s.principal,
             s.contact_phone as "contactPhone", s.student_count as "studentCount",
             s.teacher_count as "teacherCount", s.status,
             s.created_at as "createdAt", s.updated_at as "updatedAt",
             d.name as "districtName", d.code as "districtCode"
      FROM schools s
      LEFT JOIN districts d ON s.district_id = d.id
      WHERE s.id = $1
    `, [req.params.id]);

    const school = result.rows[0];

    if (!school) {
      return res.status(404).json({ code: 404, message: '学校不存在' });
    }

    // 计算派生数据
    if (school.studentCount && school.teacherCount) {
      school.studentTeacherRatio = (school.studentCount / school.teacherCount).toFixed(2);
    }

    res.json({ code: 200, data: school });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 创建学校
router.post('/schools', async (req, res) => {
  try {
    const {
      code, name, districtId, schoolType, schoolCategory,
      urbanRural, address, principal, contactPhone,
      studentCount, teacherCount
    } = req.body;

    // 验证必填字段
    if (!code || !name || !districtId || !schoolType) {
      return res.status(400).json({ code: 400, message: '学校代码、名称、所属区县和学校类型不能为空' });
    }

    // 程序层面枚举验证（替代数据库CHECK约束）
    try {
      validateEnum('SCHOOL_TYPE', schoolType, 'schoolType');
      if (schoolCategory) validateEnum('SCHOOL_CATEGORY', schoolCategory, 'schoolCategory');
      if (urbanRural) validateEnum('URBAN_RURAL_TYPE', urbanRural, 'urbanRural');
    } catch (e) {
      return res.status(400).json({ code: 400, message: e.message });
    }

    // 检查代码是否已存在
    const existingResult = await db.query('SELECT id FROM schools WHERE code = $1', [code]);
    if (existingResult.rows[0]) {
      return res.status(400).json({ code: 400, message: '学校代码已存在' });
    }

    // 验证区县是否存在（程序层面引用验证，替代外键）
    const districtResult = await db.query('SELECT id FROM districts WHERE id = $1', [districtId]);
    if (!districtResult.rows[0]) {
      return res.status(400).json({ code: 400, message: '所属区县不存在' });
    }

    const id = generateId();
    const timestamp = now();

    // 使用 Supabase Data API，避免 exec_sql 对 INSERT 报错
    const { data, error } = await db
      .from('schools')
      .insert({
        id,
        code,
        name,
        district_id: districtId,
        school_type: schoolType,
        school_category: schoolCategory || '公办',
        urban_rural: urbanRural || '城区',
        address: address || '',
        principal: principal || '',
        contact_phone: contactPhone || '',
        student_count: studentCount || 0,
        teacher_count: teacherCount || 0,
        status: 'active',
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

// 更新学校
router.put('/schools/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      code, name, districtId, schoolType, schoolCategory,
      urbanRural, address, principal, contactPhone,
      studentCount, teacherCount, status
    } = req.body;

    const existingResult = await db.query('SELECT id FROM schools WHERE id = $1', [id]);
    if (!existingResult.rows[0]) {
      return res.status(404).json({ code: 404, message: '学校不存在' });
    }

    // 程序层面枚举验证
    try {
      if (schoolType) validateEnum('SCHOOL_TYPE', schoolType, 'schoolType');
      if (schoolCategory) validateEnum('SCHOOL_CATEGORY', schoolCategory, 'schoolCategory');
      if (urbanRural) validateEnum('URBAN_RURAL_TYPE', urbanRural, 'urbanRural');
    } catch (e) {
      return res.status(400).json({ code: 400, message: e.message });
    }

    // 检查代码冲突
    if (code) {
      const codeConflictResult = await db.query('SELECT id FROM schools WHERE code = $1 AND id != $2', [code, id]);
      if (codeConflictResult.rows[0]) {
        return res.status(400).json({ code: 400, message: '学校代码已被使用' });
      }
    }

    // 验证区县（程序层面引用验证）
    if (districtId) {
      const districtResult = await db.query('SELECT id FROM districts WHERE id = $1', [districtId]);
      if (!districtResult.rows[0]) {
        return res.status(400).json({ code: 400, message: '所属区县不存在' });
      }
    }

    const timestamp = now();

    // 使用 Supabase Data API，避免 exec_sql 对 UPDATE 报错
    const updates = {
      ...(code !== undefined ? { code } : {}),
      ...(name !== undefined ? { name } : {}),
      ...(districtId !== undefined ? { district_id: districtId } : {}),
      ...(schoolType !== undefined ? { school_type: schoolType } : {}),
      ...(schoolCategory !== undefined ? { school_category: schoolCategory } : {}),
      ...(urbanRural !== undefined ? { urban_rural: urbanRural } : {}),
      ...(address !== undefined ? { address } : {}),
      ...(principal !== undefined ? { principal } : {}),
      ...(contactPhone !== undefined ? { contact_phone: contactPhone } : {}),
      ...(studentCount !== undefined ? { student_count: studentCount } : {}),
      ...(teacherCount !== undefined ? { teacher_count: teacherCount } : {}),
      ...(status !== undefined ? { status } : {}),
      updated_at: timestamp,
    };

    const { data, error } = await db
      .from('schools')
      .update(updates)
      .eq('id', id)
      .select('id');

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ code: 404, message: '学校不存在' });
    }

    return res.json({ code: 200, message: '更新成功' });
  } catch (error) {
    return res.status(500).json({ code: 500, message: error.message });
  }
});

// 删除学校
router.delete('/schools/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // 检查是否有关联的填报记录（程序层面引用检查，替代外键）
    const submissionCountResult = await db.query('SELECT COUNT(*) as count FROM submissions WHERE school_id = $1', [id]);
    const submissionCount = parseInt(submissionCountResult.rows[0].count);
    if (submissionCount > 0) {
      return res.status(400).json({ code: 400, message: `该学校有 ${submissionCount} 条填报记录，无法删除` });
    }

    const { data, error } = await db
      .from('schools')
      .delete()
      .eq('id', id)
      .select('id');

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ code: 404, message: '学校不存在' });
    }

    return res.json({ code: 200, message: '删除成功' });
  } catch (error) {
    return res.status(500).json({ code: 500, message: error.message });
  }
});

// 批量导入学校
router.post('/schools/import', async (req, res) => {
  try {
    const { schools } = req.body;

    if (!schools || !Array.isArray(schools) || schools.length === 0) {
      return res.status(400).json({ code: 400, message: '请提供学校数据' });
    }

    const timestamp = now();
    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    // Supabase Data API 不支持跨多步原子事务；原实现的 db.transaction 也非真正事务
    // 这里改为逐条校验 + 插入，避免 exec_sql 对写操作报错
    for (const school of schools) {
      try {
        // 验证必填字段
        if (!school.code || !school.name || !school.districtId || !school.schoolType) {
          results.failed++;
          results.errors.push({ code: school.code, error: '缺少必填字段' });
          continue;
        }

        // 程序层面枚举验证
        try {
          validateEnum('SCHOOL_TYPE', school.schoolType, 'schoolType');
          if (school.schoolCategory) validateEnum('SCHOOL_CATEGORY', school.schoolCategory, 'schoolCategory');
          if (school.urbanRural) validateEnum('URBAN_RURAL_TYPE', school.urbanRural, 'urbanRural');
        } catch (e) {
          results.failed++;
          results.errors.push({ code: school.code, error: e.message });
          continue;
        }

        // 检查代码是否已存在
        const { data: existing, error: existErr } = await db
          .from('schools')
          .select('id')
          .eq('code', school.code)
          .maybeSingle();
        if (existErr) throw existErr;
        if (existing) {
          results.failed++;
          results.errors.push({ code: school.code, error: '学校代码已存在' });
          continue;
        }

        // 验证区县（支持ID或代码）
        const { data: district, error: districtErr } = await db
          .from('districts')
          .select('id')
          .or(`id.eq.${school.districtId},code.eq.${school.districtId}`)
          .maybeSingle();
        if (districtErr) throw districtErr;
        if (!district) {
          results.failed++;
          results.errors.push({ code: school.code, error: '所属区县不存在' });
          continue;
        }

        const id = generateId();
        const { error: insErr } = await db
          .from('schools')
          .insert({
            id,
            code: school.code,
            name: school.name,
            district_id: district.id,
            school_type: school.schoolType,
            school_category: school.schoolCategory || '公办',
            urban_rural: school.urbanRural || '城区',
            address: school.address || '',
            principal: school.principal || '',
            contact_phone: school.contactPhone || '',
            student_count: school.studentCount || 0,
            teacher_count: school.teacherCount || 0,
            status: 'active',
            created_at: timestamp,
            updated_at: timestamp,
          });
        if (insErr) throw insErr;

        results.success++;
      } catch (err) {
        results.failed++;
        results.errors.push({ code: school.code, error: err.message });
      }
    }

    res.json({
      code: 200,
      data: results,
      message: `导入完成：成功 ${results.success} 条，失败 ${results.failed} 条`
    });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取学校的达标情况
// 注意：/schools/:id/indicator-data 路由已移至 statistics.js，返回完整的学校+指标数据结构
router.get('/schools/:id/compliance', async (req, res) => {
  try {
    const { id } = req.params;
    const { projectId } = req.query;

    if (!projectId) {
      return res.status(400).json({ code: 400, message: '请提供项目ID' });
    }

    const schoolResult = await db.query(`
      SELECT s.id, s.name, s.school_type as "schoolType", d.name as "districtName"
      FROM schools s
      LEFT JOIN districts d ON s.district_id = d.id
      WHERE s.id = $1
    `, [id]);

    const school = schoolResult.rows[0];

    if (!school) {
      return res.status(404).json({ code: 404, message: '学校不存在' });
    }

    // 根据学校类型构建指标过滤条件
    // 小学: 只统计 -D1 后缀或名称包含（小学）的指标
    // 初中: 只统计 -D2 后缀或名称包含（初中）的指标
    // 九年一贯制/完全中学: 统计所有指标
    let indicatorFilter = '';
    if (school.schoolType === '小学') {
      indicatorFilter = " AND (di.code LIKE '%-D1' OR di.name LIKE '%（小学）%' OR (di.code NOT LIKE '%-D1' AND di.code NOT LIKE '%-D2' AND di.name NOT LIKE '%（小学）%' AND di.name NOT LIKE '%（初中）%'))";
    } else if (school.schoolType === '初中') {
      indicatorFilter = " AND (di.code LIKE '%-D2' OR di.name LIKE '%（初中）%' OR (di.code NOT LIKE '%-D1' AND di.code NOT LIKE '%-D2' AND di.name NOT LIKE '%（小学）%' AND di.name NOT LIKE '%（初中）%'))";
    }
    // 九年一贯制和完全中学统计所有指标，不添加过滤条件

    // 统计达标情况
    const statsResult = await db.query(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN sid.is_compliant = 1 THEN 1 ELSE 0 END) as compliant,
        SUM(CASE WHEN sid.is_compliant = 0 THEN 1 ELSE 0 END) as "nonCompliant",
        SUM(CASE WHEN sid.is_compliant IS NULL THEN 1 ELSE 0 END) as pending
      FROM school_indicator_data sid
      JOIN data_indicators di ON sid.data_indicator_id = di.id
      WHERE sid.school_id = $1 AND sid.project_id = $2${indicatorFilter}
    `, [id, projectId]);

    const stats = statsResult.rows[0];

    // 获取未达标指标详情
    const nonCompliantResult = await db.query(`
      SELECT sid.data_indicator_id as "indicatorId", sid.value,
             di.code, di.name, di.threshold
      FROM school_indicator_data sid
      JOIN data_indicators di ON sid.data_indicator_id = di.id
      WHERE sid.school_id = $1 AND sid.project_id = $2 AND sid.is_compliant = 0${indicatorFilter}
    `, [id, projectId]);

    res.json({
      code: 200,
      data: {
        school,
        statistics: stats,
        complianceRate: parseInt(stats.total) > 0
          ? ((parseInt(stats.compliant) / parseInt(stats.total)) * 100).toFixed(2)
          : null,
        nonCompliantIndicators: nonCompliantResult.rows
      }
    });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取学校类型枚举
router.get('/school-types', (req, res) => {
  res.json({
    code: 200,
    data: SCHOOL_TYPE.map(value => ({ value, label: value }))
  });
});

// 获取城乡类型枚举
router.get('/urban-rural-types', (req, res) => {
  res.json({
    code: 200,
    data: URBAN_RURAL_TYPE.map(value => ({ value, label: value }))
  });
});

module.exports = { router, setDb };
