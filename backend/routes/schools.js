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

    await db.query(`
      INSERT INTO schools
      (id, code, name, district_id, school_type, school_category, urban_rural,
       address, principal, contact_phone, student_count, teacher_count, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'active', $13, $14)
    `, [
      id, code, name, districtId, schoolType,
      schoolCategory || '公办', urbanRural || '城区',
      address || '', principal || '', contactPhone || '',
      studentCount || 0, teacherCount || 0,
      timestamp, timestamp
    ]);

    res.json({ code: 200, data: { id }, message: '创建成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
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

    await db.query(`
      UPDATE schools SET
        code = COALESCE($1, code),
        name = COALESCE($2, name),
        district_id = COALESCE($3, district_id),
        school_type = COALESCE($4, school_type),
        school_category = COALESCE($5, school_category),
        urban_rural = COALESCE($6, urban_rural),
        address = COALESCE($7, address),
        principal = COALESCE($8, principal),
        contact_phone = COALESCE($9, contact_phone),
        student_count = COALESCE($10, student_count),
        teacher_count = COALESCE($11, teacher_count),
        status = COALESCE($12, status),
        updated_at = $13
      WHERE id = $14
    `, [
      code, name, districtId, schoolType, schoolCategory,
      urbanRural, address, principal, contactPhone,
      studentCount, teacherCount, status, timestamp, id
    ]);

    res.json({ code: 200, message: '更新成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
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

    const result = await db.query('DELETE FROM schools WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ code: 404, message: '学校不存在' });
    }

    res.json({ code: 200, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
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

    // 使用事务批量插入
    await db.transaction(async (client) => {
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
          const existingResult = await client.query('SELECT id FROM schools WHERE code = $1', [school.code]);
          if (existingResult.rows[0]) {
            results.failed++;
            results.errors.push({ code: school.code, error: '学校代码已存在' });
            continue;
          }

          // 验证区县（支持ID或代码）（程序层面引用验证）
          const districtResult = await client.query(
            'SELECT id FROM districts WHERE id = $1 OR code = $1',
            [school.districtId]
          );
          if (!districtResult.rows[0]) {
            results.failed++;
            results.errors.push({ code: school.code, error: '所属区县不存在' });
            continue;
          }

          const id = generateId();
          await client.query(`
            INSERT INTO schools
            (id, code, name, district_id, school_type, school_category, urban_rural,
             address, principal, contact_phone, student_count, teacher_count, status, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'active', $13, $14)
          `, [
            id, school.code, school.name, districtResult.rows[0].id,
            school.schoolType, school.schoolCategory || '公办',
            school.urbanRural || '城区', school.address || '',
            school.principal || '', school.contactPhone || '',
            school.studentCount || 0, school.teacherCount || 0,
            timestamp, timestamp
          ]);

          results.success++;
        } catch (err) {
          results.failed++;
          results.errors.push({ code: school.code, error: err.message });
        }
      }
    });

    res.json({
      code: 200,
      data: results,
      message: `导入完成：成功 ${results.success} 条，失败 ${results.failed} 条`
    });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取学校的指标数据
router.get('/schools/:id/indicator-data', async (req, res) => {
  try {
    const { id } = req.params;
    const { projectId } = req.query;

    if (!projectId) {
      return res.status(400).json({ code: 400, message: '请提供项目ID' });
    }

    const result = await db.query(`
      SELECT sid.id, sid.data_indicator_id as "dataIndicatorId",
             sid.value, sid.text_value as "textValue", sid.is_compliant as "isCompliant",
             sid.collected_at as "collectedAt",
             di.code as "indicatorCode", di.name as "indicatorName", di.threshold
      FROM school_indicator_data sid
      JOIN data_indicators di ON sid.data_indicator_id = di.id
      WHERE sid.school_id = $1 AND sid.project_id = $2
      ORDER BY di.code
    `, [id, projectId]);

    res.json({ code: 200, data: result.rows });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取学校的达标情况
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

    // 统计达标情况
    const statsResult = await db.query(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN is_compliant = 1 THEN 1 ELSE 0 END) as compliant,
        SUM(CASE WHEN is_compliant = 0 THEN 1 ELSE 0 END) as "nonCompliant",
        SUM(CASE WHEN is_compliant IS NULL THEN 1 ELSE 0 END) as pending
      FROM school_indicator_data
      WHERE school_id = $1 AND project_id = $2
    `, [id, projectId]);

    const stats = statsResult.rows[0];

    // 获取未达标指标详情
    const nonCompliantResult = await db.query(`
      SELECT sid.data_indicator_id as "indicatorId", sid.value,
             di.code, di.name, di.threshold
      FROM school_indicator_data sid
      JOIN data_indicators di ON sid.data_indicator_id = di.id
      WHERE sid.school_id = $1 AND sid.project_id = $2 AND sid.is_compliant = 0
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
