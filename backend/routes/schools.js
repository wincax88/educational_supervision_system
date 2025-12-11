const express = require('express');
const router = express.Router();

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
router.get('/schools', (req, res) => {
  try {
    const { districtId, schoolType, schoolCategory, urbanRural, status, keyword, page, pageSize } = req.query;

    let countSql = 'SELECT COUNT(*) as total FROM schools s WHERE 1=1';
    let sql = `
      SELECT s.id, s.code, s.name, s.district_id as districtId,
             s.school_type as schoolType, s.school_category as schoolCategory,
             s.urban_rural as urbanRural, s.address, s.principal,
             s.contact_phone as contactPhone, s.student_count as studentCount,
             s.teacher_count as teacherCount, s.status,
             s.created_at as createdAt, s.updated_at as updatedAt,
             d.name as districtName
      FROM schools s
      LEFT JOIN districts d ON s.district_id = d.id
      WHERE 1=1
    `;
    const params = [];

    if (districtId) {
      sql += ' AND s.district_id = ?';
      countSql += ' AND s.district_id = ?';
      params.push(districtId);
    }

    if (schoolType) {
      sql += ' AND s.school_type = ?';
      countSql += ' AND s.school_type = ?';
      params.push(schoolType);
    }

    if (schoolCategory) {
      sql += ' AND s.school_category = ?';
      countSql += ' AND s.school_category = ?';
      params.push(schoolCategory);
    }

    if (urbanRural) {
      sql += ' AND s.urban_rural = ?';
      countSql += ' AND s.urban_rural = ?';
      params.push(urbanRural);
    }

    if (status) {
      sql += ' AND s.status = ?';
      countSql += ' AND s.status = ?';
      params.push(status);
    }

    if (keyword) {
      sql += ' AND (s.name LIKE ? OR s.code LIKE ? OR s.principal LIKE ?)';
      countSql += ' AND (s.name LIKE ? OR s.code LIKE ? OR s.principal LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    // 获取总数
    const total = db.prepare(countSql).get(...params).total;

    sql += ' ORDER BY d.sort_order, s.school_type, s.name';

    // 分页
    if (page && pageSize) {
      const offset = (parseInt(page) - 1) * parseInt(pageSize);
      sql += ' LIMIT ? OFFSET ?';
      params.push(parseInt(pageSize), offset);
    }

    const schools = db.prepare(sql).all(...params);

    res.json({
      code: 200,
      data: {
        list: schools,
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
router.get('/schools/:id', (req, res) => {
  try {
    const school = db.prepare(`
      SELECT s.id, s.code, s.name, s.district_id as districtId,
             s.school_type as schoolType, s.school_category as schoolCategory,
             s.urban_rural as urbanRural, s.address, s.principal,
             s.contact_phone as contactPhone, s.student_count as studentCount,
             s.teacher_count as teacherCount, s.status,
             s.created_at as createdAt, s.updated_at as updatedAt,
             d.name as districtName, d.code as districtCode
      FROM schools s
      LEFT JOIN districts d ON s.district_id = d.id
      WHERE s.id = ?
    `).get(req.params.id);

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
router.post('/schools', (req, res) => {
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

    // 检查代码是否已存在
    const existing = db.prepare('SELECT id FROM schools WHERE code = ?').get(code);
    if (existing) {
      return res.status(400).json({ code: 400, message: '学校代码已存在' });
    }

    // 验证区县是否存在
    const district = db.prepare('SELECT id FROM districts WHERE id = ?').get(districtId);
    if (!district) {
      return res.status(400).json({ code: 400, message: '所属区县不存在' });
    }

    const id = generateId();
    const timestamp = now();

    db.prepare(`
      INSERT INTO schools
      (id, code, name, district_id, school_type, school_category, urban_rural,
       address, principal, contact_phone, student_count, teacher_count, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
    `).run(
      id, code, name, districtId, schoolType,
      schoolCategory || '公办', urbanRural || '城区',
      address || '', principal || '', contactPhone || '',
      studentCount || 0, teacherCount || 0,
      timestamp, timestamp
    );

    res.json({ code: 200, data: { id }, message: '创建成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 更新学校
router.put('/schools/:id', (req, res) => {
  try {
    const { id } = req.params;
    const {
      code, name, districtId, schoolType, schoolCategory,
      urbanRural, address, principal, contactPhone,
      studentCount, teacherCount, status
    } = req.body;

    const existing = db.prepare('SELECT id FROM schools WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ code: 404, message: '学校不存在' });
    }

    // 检查代码冲突
    if (code) {
      const codeConflict = db.prepare('SELECT id FROM schools WHERE code = ? AND id != ?').get(code, id);
      if (codeConflict) {
        return res.status(400).json({ code: 400, message: '学校代码已被使用' });
      }
    }

    // 验证区县
    if (districtId) {
      const district = db.prepare('SELECT id FROM districts WHERE id = ?').get(districtId);
      if (!district) {
        return res.status(400).json({ code: 400, message: '所属区县不存在' });
      }
    }

    const timestamp = now();

    db.prepare(`
      UPDATE schools SET
        code = COALESCE(?, code),
        name = COALESCE(?, name),
        district_id = COALESCE(?, district_id),
        school_type = COALESCE(?, school_type),
        school_category = COALESCE(?, school_category),
        urban_rural = COALESCE(?, urban_rural),
        address = COALESCE(?, address),
        principal = COALESCE(?, principal),
        contact_phone = COALESCE(?, contact_phone),
        student_count = COALESCE(?, student_count),
        teacher_count = COALESCE(?, teacher_count),
        status = COALESCE(?, status),
        updated_at = ?
      WHERE id = ?
    `).run(
      code, name, districtId, schoolType, schoolCategory,
      urbanRural, address, principal, contactPhone,
      studentCount, teacherCount, status, timestamp, id
    );

    res.json({ code: 200, message: '更新成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 删除学校
router.delete('/schools/:id', (req, res) => {
  try {
    const { id } = req.params;

    // 检查是否有关联的填报记录
    const submissionCount = db.prepare('SELECT COUNT(*) as count FROM submissions WHERE school_id = ?').get(id);
    if (submissionCount && submissionCount.count > 0) {
      return res.status(400).json({ code: 400, message: `该学校有 ${submissionCount.count} 条填报记录，无法删除` });
    }

    const result = db.prepare('DELETE FROM schools WHERE id = ?').run(id);

    if (result.changes === 0) {
      return res.status(404).json({ code: 404, message: '学校不存在' });
    }

    res.json({ code: 200, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 批量导入学校
router.post('/schools/import', (req, res) => {
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

    const insertStmt = db.prepare(`
      INSERT INTO schools
      (id, code, name, district_id, school_type, school_category, urban_rural,
       address, principal, contact_phone, student_count, teacher_count, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
    `);

    const checkCodeStmt = db.prepare('SELECT id FROM schools WHERE code = ?');
    const checkDistrictStmt = db.prepare('SELECT id FROM districts WHERE id = ? OR code = ?');

    // 使用事务批量插入
    const insertMany = db.transaction((schoolList) => {
      for (const school of schoolList) {
        try {
          // 验证必填字段
          if (!school.code || !school.name || !school.districtId || !school.schoolType) {
            results.failed++;
            results.errors.push({ code: school.code, error: '缺少必填字段' });
            continue;
          }

          // 检查代码是否已存在
          if (checkCodeStmt.get(school.code)) {
            results.failed++;
            results.errors.push({ code: school.code, error: '学校代码已存在' });
            continue;
          }

          // 验证区县（支持ID或代码）
          const district = checkDistrictStmt.get(school.districtId, school.districtId);
          if (!district) {
            results.failed++;
            results.errors.push({ code: school.code, error: '所属区县不存在' });
            continue;
          }

          const id = generateId();
          insertStmt.run(
            id, school.code, school.name, district.id,
            school.schoolType, school.schoolCategory || '公办',
            school.urbanRural || '城区', school.address || '',
            school.principal || '', school.contactPhone || '',
            school.studentCount || 0, school.teacherCount || 0,
            timestamp, timestamp
          );

          results.success++;
        } catch (err) {
          results.failed++;
          results.errors.push({ code: school.code, error: err.message });
        }
      }
    });

    insertMany(schools);

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
router.get('/schools/:id/indicator-data', (req, res) => {
  try {
    const { id } = req.params;
    const { projectId } = req.query;

    if (!projectId) {
      return res.status(400).json({ code: 400, message: '请提供项目ID' });
    }

    const data = db.prepare(`
      SELECT sid.id, sid.data_indicator_id as dataIndicatorId,
             sid.value, sid.text_value as textValue, sid.is_compliant as isCompliant,
             sid.collected_at as collectedAt,
             di.code as indicatorCode, di.name as indicatorName, di.threshold
      FROM school_indicator_data sid
      JOIN data_indicators di ON sid.data_indicator_id = di.id
      WHERE sid.school_id = ? AND sid.project_id = ?
      ORDER BY di.code
    `).all(id, projectId);

    res.json({ code: 200, data });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取学校的达标情况
router.get('/schools/:id/compliance', (req, res) => {
  try {
    const { id } = req.params;
    const { projectId } = req.query;

    if (!projectId) {
      return res.status(400).json({ code: 400, message: '请提供项目ID' });
    }

    const school = db.prepare(`
      SELECT s.id, s.name, s.school_type as schoolType, d.name as districtName
      FROM schools s
      LEFT JOIN districts d ON s.district_id = d.id
      WHERE s.id = ?
    `).get(id);

    if (!school) {
      return res.status(404).json({ code: 404, message: '学校不存在' });
    }

    // 统计达标情况
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN is_compliant = 1 THEN 1 ELSE 0 END) as compliant,
        SUM(CASE WHEN is_compliant = 0 THEN 1 ELSE 0 END) as nonCompliant,
        SUM(CASE WHEN is_compliant IS NULL THEN 1 ELSE 0 END) as pending
      FROM school_indicator_data
      WHERE school_id = ? AND project_id = ?
    `).get(id, projectId);

    // 获取未达标指标详情
    const nonCompliantIndicators = db.prepare(`
      SELECT sid.data_indicator_id as indicatorId, sid.value,
             di.code, di.name, di.threshold
      FROM school_indicator_data sid
      JOIN data_indicators di ON sid.data_indicator_id = di.id
      WHERE sid.school_id = ? AND sid.project_id = ? AND sid.is_compliant = 0
    `).all(id, projectId);

    res.json({
      code: 200,
      data: {
        school,
        statistics: stats,
        complianceRate: stats.total > 0
          ? ((stats.compliant / stats.total) * 100).toFixed(2)
          : null,
        nonCompliantIndicators
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
    data: [
      { value: '小学', label: '小学' },
      { value: '初中', label: '初中' },
      { value: '九年一贯制', label: '九年一贯制' },
      { value: '完全中学', label: '完全中学' }
    ]
  });
});

// 获取城乡类型枚举
router.get('/urban-rural-types', (req, res) => {
  res.json({
    code: 200,
    data: [
      { value: '城区', label: '城区' },
      { value: '镇区', label: '镇区' },
      { value: '乡村', label: '乡村' }
    ]
  });
});

module.exports = { router, setDb };
