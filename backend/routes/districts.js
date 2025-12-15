const express = require('express');
const router = express.Router();
const { validateEnum } = require('../constants/enums');

// 数据库连接将在index.js中注入
let db = null;

const setDb = (database) => {
  db = database;
};

// 生成UUID
const generateId = () => 'd-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
const now = () => new Date().toISOString().split('T')[0];

// ==================== 区县管理 CRUD ====================

// 获取区县列表
router.get('/districts', async (req, res) => {
  try {
    const { type, keyword } = req.query;

    let sql = `
      SELECT d.id, d.code, d.name, d.type, d.parent_code as "parentCode",
             d.sort_order as "sortOrder", d.created_at as "createdAt", d.updated_at as "updatedAt",
             (SELECT COUNT(*) FROM schools WHERE district_id = d.id AND status = 'active') as "schoolCount"
      FROM districts d
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (type) {
      sql += ` AND d.type = $${paramIndex++}`;
      params.push(type);
    }

    if (keyword) {
      sql += ` AND (d.name LIKE $${paramIndex++} OR d.code LIKE $${paramIndex++})`;
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    sql += ' ORDER BY d.sort_order ASC, d.code ASC';

    const result = await db.query(sql, params);

    res.json({ code: 200, data: result.rows });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取单个区县详情
router.get('/districts/:id', async (req, res) => {
  try {
    const districtResult = await db.query(`
      SELECT d.id, d.code, d.name, d.type, d.parent_code as "parentCode",
             d.sort_order as "sortOrder", d.created_at as "createdAt", d.updated_at as "updatedAt"
      FROM districts d WHERE d.id = $1
    `, [req.params.id]);

    const district = districtResult.rows[0];

    if (!district) {
      return res.status(404).json({ code: 404, message: '区县不存在' });
    }

    // 获取区县下的学校统计
    const statsResult = await db.query(`
      SELECT
        COUNT(*) as "totalSchools",
        SUM(CASE WHEN school_type = '小学' THEN 1 ELSE 0 END) as "primarySchools",
        SUM(CASE WHEN school_type = '初中' THEN 1 ELSE 0 END) as "middleSchools",
        SUM(CASE WHEN school_type = '九年一贯制' THEN 1 ELSE 0 END) as "nineYearSchools",
        SUM(student_count) as "totalStudents",
        SUM(teacher_count) as "totalTeachers"
      FROM schools
      WHERE district_id = $1 AND status = 'active'
    `, [req.params.id]);

    district.statistics = statsResult.rows[0];

    res.json({ code: 200, data: district });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 创建区县
router.post('/districts', async (req, res) => {
  try {
    const { code, name, type, parentCode, sortOrder } = req.body;

    if (!code || !name) {
      return res.status(400).json({ code: 400, message: '区县代码和名称不能为空' });
    }

    // 验证类型枚举
    if (type) {
      try {
        validateEnum('DISTRICT_TYPE', type, 'type');
      } catch (e) {
        return res.status(400).json({ code: 400, message: e.message });
      }
    }

    // 检查代码是否已存在
    const existingResult = await db.query('SELECT id FROM districts WHERE code = $1', [code]);
    if (existingResult.rows[0]) {
      return res.status(400).json({ code: 400, message: '区县代码已存在' });
    }

    const id = generateId();
    const timestamp = now();

    await db.query(`
      INSERT INTO districts (id, code, name, type, parent_code, sort_order, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [id, code, name, type || '市辖区', parentCode || '210100', sortOrder || 0, timestamp, timestamp]);

    res.json({ code: 200, data: { id }, message: '创建成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 更新区县
router.put('/districts/:id', async (req, res) => {
  try {
    const { code, name, type, parentCode, sortOrder } = req.body;
    const { id } = req.params;

    const existingResult = await db.query('SELECT id FROM districts WHERE id = $1', [id]);
    if (!existingResult.rows[0]) {
      return res.status(404).json({ code: 404, message: '区县不存在' });
    }

    // 验证类型枚举
    if (type) {
      try {
        validateEnum('DISTRICT_TYPE', type, 'type');
      } catch (e) {
        return res.status(400).json({ code: 400, message: e.message });
      }
    }

    // 检查新代码是否与其他记录冲突
    if (code) {
      const codeConflictResult = await db.query('SELECT id FROM districts WHERE code = $1 AND id != $2', [code, id]);
      if (codeConflictResult.rows[0]) {
        return res.status(400).json({ code: 400, message: '区县代码已被使用' });
      }
    }

    const timestamp = now();

    await db.query(`
      UPDATE districts
      SET code = COALESCE($1, code),
          name = COALESCE($2, name),
          type = COALESCE($3, type),
          parent_code = COALESCE($4, parent_code),
          sort_order = COALESCE($5, sort_order),
          updated_at = $6
      WHERE id = $7
    `, [code, name, type, parentCode, sortOrder, timestamp, id]);

    res.json({ code: 200, message: '更新成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 删除区县
router.delete('/districts/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // 检查是否有关联的学校（程序层面引用检查，替代外键）
    const schoolCountResult = await db.query('SELECT COUNT(*) as count FROM schools WHERE district_id = $1', [id]);
    if (parseInt(schoolCountResult.rows[0].count) > 0) {
      return res.status(400).json({ code: 400, message: `该区县下有 ${schoolCountResult.rows[0].count} 所学校，无法删除` });
    }

    const result = await db.query('DELETE FROM districts WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ code: 404, message: '区县不存在' });
    }

    res.json({ code: 200, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取区县下的学校列表
router.get('/districts/:id/schools', async (req, res) => {
  try {
    const { id } = req.params;
    const { schoolType, urbanRural, keyword, status } = req.query;

    let sql = `
      SELECT id, code, name, school_type as "schoolType", school_category as "schoolCategory",
             urban_rural as "urbanRural", address, principal, contact_phone as "contactPhone",
             student_count as "studentCount", teacher_count as "teacherCount", status,
             created_at as "createdAt", updated_at as "updatedAt"
      FROM schools
      WHERE district_id = $1
    `;
    const params = [id];
    let paramIndex = 2;

    if (schoolType) {
      sql += ` AND school_type = $${paramIndex++}`;
      params.push(schoolType);
    }

    if (urbanRural) {
      sql += ` AND urban_rural = $${paramIndex++}`;
      params.push(urbanRural);
    }

    if (status) {
      sql += ` AND status = $${paramIndex++}`;
      params.push(status);
    } else {
      sql += " AND status = 'active'";
    }

    if (keyword) {
      sql += ` AND (name LIKE $${paramIndex++} OR code LIKE $${paramIndex++})`;
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    sql += ' ORDER BY school_type, name';

    const result = await db.query(sql, params);

    res.json({ code: 200, data: result.rows });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取区县统计汇总
router.get('/districts/:id/statistics', async (req, res) => {
  try {
    const { id } = req.params;

    const districtResult = await db.query('SELECT id, name FROM districts WHERE id = $1', [id]);
    const district = districtResult.rows[0];
    if (!district) {
      return res.status(404).json({ code: 404, message: '区县不存在' });
    }

    // 学校类型统计
    const schoolTypeStatsResult = await db.query(`
      SELECT school_type as type, COUNT(*) as count,
             SUM(student_count) as students, SUM(teacher_count) as teachers
      FROM schools
      WHERE district_id = $1 AND status = 'active'
      GROUP BY school_type
    `, [id]);

    // 城乡分布统计
    const urbanRuralStatsResult = await db.query(`
      SELECT urban_rural as type, COUNT(*) as count
      FROM schools
      WHERE district_id = $1 AND status = 'active'
      GROUP BY urban_rural
    `, [id]);

    // 办学性质统计
    const categoryStatsResult = await db.query(`
      SELECT school_category as type, COUNT(*) as count
      FROM schools
      WHERE district_id = $1 AND status = 'active'
      GROUP BY school_category
    `, [id]);

    // 总体统计
    const totalStatsResult = await db.query(`
      SELECT
        COUNT(*) as "totalSchools",
        SUM(student_count) as "totalStudents",
        SUM(teacher_count) as "totalTeachers",
        ROUND(CAST(SUM(student_count) AS NUMERIC) / NULLIF(SUM(teacher_count), 0), 2) as "avgStudentTeacherRatio"
      FROM schools
      WHERE district_id = $1 AND status = 'active'
    `, [id]);

    res.json({
      code: 200,
      data: {
        district,
        total: totalStatsResult.rows[0],
        bySchoolType: schoolTypeStatsResult.rows,
        byUrbanRural: urbanRuralStatsResult.rows,
        byCategory: categoryStatsResult.rows
      }
    });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取所有区县的汇总统计（用于全市统计）
router.get('/districts-summary', async (req, res) => {
  try {
    const summaryResult = await db.query(`
      SELECT
        d.id, d.code, d.name, d.type,
        COUNT(s.id) as "schoolCount",
        SUM(CASE WHEN s.school_type = '小学' THEN 1 ELSE 0 END) as "primarySchoolCount",
        SUM(CASE WHEN s.school_type = '初中' THEN 1 ELSE 0 END) as "middleSchoolCount",
        SUM(s.student_count) as "studentCount",
        SUM(s.teacher_count) as "teacherCount"
      FROM districts d
      LEFT JOIN schools s ON d.id = s.district_id AND s.status = 'active'
      GROUP BY d.id, d.code, d.name, d.type
      ORDER BY d.sort_order
    `);

    // 全市汇总
    const cityTotalResult = await db.query(`
      SELECT
        COUNT(DISTINCT d.id) as "districtCount",
        COUNT(s.id) as "schoolCount",
        SUM(s.student_count) as "studentCount",
        SUM(s.teacher_count) as "teacherCount"
      FROM districts d
      LEFT JOIN schools s ON d.id = s.district_id AND s.status = 'active'
    `);

    res.json({
      code: 200,
      data: {
        cityTotal: cityTotalResult.rows[0],
        districts: summaryResult.rows
      }
    });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

module.exports = { router, setDb };
