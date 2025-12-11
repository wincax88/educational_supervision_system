const express = require('express');
const router = express.Router();

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
router.get('/districts', (req, res) => {
  try {
    const { type, keyword } = req.query;

    let sql = `
      SELECT d.id, d.code, d.name, d.type, d.parent_code as parentCode,
             d.sort_order as sortOrder, d.created_at as createdAt, d.updated_at as updatedAt,
             (SELECT COUNT(*) FROM schools WHERE district_id = d.id AND status = 'active') as schoolCount
      FROM districts d
      WHERE 1=1
    `;
    const params = [];

    if (type) {
      sql += ' AND d.type = ?';
      params.push(type);
    }

    if (keyword) {
      sql += ' AND (d.name LIKE ? OR d.code LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    sql += ' ORDER BY d.sort_order ASC, d.code ASC';

    const districts = db.prepare(sql).all(...params);

    res.json({ code: 200, data: districts });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取单个区县详情
router.get('/districts/:id', (req, res) => {
  try {
    const district = db.prepare(`
      SELECT d.id, d.code, d.name, d.type, d.parent_code as parentCode,
             d.sort_order as sortOrder, d.created_at as createdAt, d.updated_at as updatedAt
      FROM districts d WHERE d.id = ?
    `).get(req.params.id);

    if (!district) {
      return res.status(404).json({ code: 404, message: '区县不存在' });
    }

    // 获取区县下的学校统计
    const stats = db.prepare(`
      SELECT
        COUNT(*) as totalSchools,
        SUM(CASE WHEN school_type = '小学' THEN 1 ELSE 0 END) as primarySchools,
        SUM(CASE WHEN school_type = '初中' THEN 1 ELSE 0 END) as middleSchools,
        SUM(CASE WHEN school_type = '九年一贯制' THEN 1 ELSE 0 END) as nineYearSchools,
        SUM(student_count) as totalStudents,
        SUM(teacher_count) as totalTeachers
      FROM schools
      WHERE district_id = ? AND status = 'active'
    `).get(req.params.id);

    district.statistics = stats;

    res.json({ code: 200, data: district });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 创建区县
router.post('/districts', (req, res) => {
  try {
    const { code, name, type, parentCode, sortOrder } = req.body;

    if (!code || !name) {
      return res.status(400).json({ code: 400, message: '区县代码和名称不能为空' });
    }

    // 检查代码是否已存在
    const existing = db.prepare('SELECT id FROM districts WHERE code = ?').get(code);
    if (existing) {
      return res.status(400).json({ code: 400, message: '区县代码已存在' });
    }

    const id = generateId();
    const timestamp = now();

    db.prepare(`
      INSERT INTO districts (id, code, name, type, parent_code, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, code, name, type || '市辖区', parentCode || '210100', sortOrder || 0, timestamp, timestamp);

    res.json({ code: 200, data: { id }, message: '创建成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 更新区县
router.put('/districts/:id', (req, res) => {
  try {
    const { code, name, type, parentCode, sortOrder } = req.body;
    const { id } = req.params;

    const existing = db.prepare('SELECT id FROM districts WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ code: 404, message: '区县不存在' });
    }

    // 检查新代码是否与其他记录冲突
    if (code) {
      const codeConflict = db.prepare('SELECT id FROM districts WHERE code = ? AND id != ?').get(code, id);
      if (codeConflict) {
        return res.status(400).json({ code: 400, message: '区县代码已被使用' });
      }
    }

    const timestamp = now();

    db.prepare(`
      UPDATE districts
      SET code = COALESCE(?, code),
          name = COALESCE(?, name),
          type = COALESCE(?, type),
          parent_code = COALESCE(?, parent_code),
          sort_order = COALESCE(?, sort_order),
          updated_at = ?
      WHERE id = ?
    `).run(code, name, type, parentCode, sortOrder, timestamp, id);

    res.json({ code: 200, message: '更新成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 删除区县
router.delete('/districts/:id', (req, res) => {
  try {
    const { id } = req.params;

    // 检查是否有关联的学校
    const schoolCount = db.prepare('SELECT COUNT(*) as count FROM schools WHERE district_id = ?').get(id);
    if (schoolCount.count > 0) {
      return res.status(400).json({ code: 400, message: `该区县下有 ${schoolCount.count} 所学校，无法删除` });
    }

    const result = db.prepare('DELETE FROM districts WHERE id = ?').run(id);

    if (result.changes === 0) {
      return res.status(404).json({ code: 404, message: '区县不存在' });
    }

    res.json({ code: 200, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取区县下的学校列表
router.get('/districts/:id/schools', (req, res) => {
  try {
    const { id } = req.params;
    const { schoolType, urbanRural, keyword, status } = req.query;

    let sql = `
      SELECT id, code, name, school_type as schoolType, school_category as schoolCategory,
             urban_rural as urbanRural, address, principal, contact_phone as contactPhone,
             student_count as studentCount, teacher_count as teacherCount, status,
             created_at as createdAt, updated_at as updatedAt
      FROM schools
      WHERE district_id = ?
    `;
    const params = [id];

    if (schoolType) {
      sql += ' AND school_type = ?';
      params.push(schoolType);
    }

    if (urbanRural) {
      sql += ' AND urban_rural = ?';
      params.push(urbanRural);
    }

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    } else {
      sql += " AND status = 'active'";
    }

    if (keyword) {
      sql += ' AND (name LIKE ? OR code LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    sql += ' ORDER BY school_type, name';

    const schools = db.prepare(sql).all(...params);

    res.json({ code: 200, data: schools });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取区县统计汇总
router.get('/districts/:id/statistics', (req, res) => {
  try {
    const { id } = req.params;

    const district = db.prepare('SELECT id, name FROM districts WHERE id = ?').get(id);
    if (!district) {
      return res.status(404).json({ code: 404, message: '区县不存在' });
    }

    // 学校类型统计
    const schoolTypeStats = db.prepare(`
      SELECT school_type as type, COUNT(*) as count,
             SUM(student_count) as students, SUM(teacher_count) as teachers
      FROM schools
      WHERE district_id = ? AND status = 'active'
      GROUP BY school_type
    `).all(id);

    // 城乡分布统计
    const urbanRuralStats = db.prepare(`
      SELECT urban_rural as type, COUNT(*) as count
      FROM schools
      WHERE district_id = ? AND status = 'active'
      GROUP BY urban_rural
    `).all(id);

    // 办学性质统计
    const categoryStats = db.prepare(`
      SELECT school_category as type, COUNT(*) as count
      FROM schools
      WHERE district_id = ? AND status = 'active'
      GROUP BY school_category
    `).all(id);

    // 总体统计
    const totalStats = db.prepare(`
      SELECT
        COUNT(*) as totalSchools,
        SUM(student_count) as totalStudents,
        SUM(teacher_count) as totalTeachers,
        ROUND(CAST(SUM(student_count) AS FLOAT) / NULLIF(SUM(teacher_count), 0), 2) as avgStudentTeacherRatio
      FROM schools
      WHERE district_id = ? AND status = 'active'
    `).get(id);

    res.json({
      code: 200,
      data: {
        district,
        total: totalStats,
        bySchoolType: schoolTypeStats,
        byUrbanRural: urbanRuralStats,
        byCategory: categoryStats
      }
    });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取所有区县的汇总统计（用于全市统计）
router.get('/districts-summary', (req, res) => {
  try {
    const summary = db.prepare(`
      SELECT
        d.id, d.code, d.name, d.type,
        COUNT(s.id) as schoolCount,
        SUM(CASE WHEN s.school_type = '小学' THEN 1 ELSE 0 END) as primarySchoolCount,
        SUM(CASE WHEN s.school_type = '初中' THEN 1 ELSE 0 END) as middleSchoolCount,
        SUM(s.student_count) as studentCount,
        SUM(s.teacher_count) as teacherCount
      FROM districts d
      LEFT JOIN schools s ON d.id = s.district_id AND s.status = 'active'
      GROUP BY d.id
      ORDER BY d.sort_order
    `).all();

    // 全市汇总
    const cityTotal = db.prepare(`
      SELECT
        COUNT(DISTINCT d.id) as districtCount,
        COUNT(s.id) as schoolCount,
        SUM(s.student_count) as studentCount,
        SUM(s.teacher_count) as teacherCount
      FROM districts d
      LEFT JOIN schools s ON d.id = s.district_id AND s.status = 'active'
    `).get();

    res.json({
      code: 200,
      data: {
        cityTotal,
        districts: summary
      }
    });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

module.exports = { router, setDb };
