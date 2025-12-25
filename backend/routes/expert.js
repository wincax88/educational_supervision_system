const express = require('express');
const router = express.Router();

let db = null;

const setDb = (database) => {
  db = database;
};

// ==================== 专家端 API ====================

/**
 * 获取当前专家负责的项目列表
 * GET /api/expert/projects
 *
 * 基于 project_personnel 表，获取 role='project_expert' 的项目
 * 同时返回每个项目的审核统计数据
 */
router.get('/expert/projects', async (req, res) => {
  try {
    // 从请求头获取当前用户手机号（通过token解析）
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    let currentUserPhone = '';
    let currentUserName = '';

    // 解析 token 获取用户信息
    // Token 格式: token-{timestamp}-{role}-{base64EncodedPhone}
    if (token) {
      const parts = token.split('-');
      if (parts.length >= 4) {
        // 从 token 中解析 phone（Base64 解码）
        try {
          const encodedPhone = parts[3];
          currentUserPhone = Buffer.from(encodedPhone, 'base64').toString('utf-8');
        } catch (e) {
          console.error('[expert/projects] 解析 token 失败:', e);
        }

        // 尝试从 session 获取 name（可选，不强制）
        try {
          const sessionStore = require('../services/sessionStore');
          const ts = parseInt(parts[1], 10);
          const session = sessionStore.getSession(ts);
          if (session) {
            currentUserName = session.name || '';
          }
        } catch (e) {
          // Session 不存在也没关系，我们有 phone 就够了
        }
      }
    }

    if (!currentUserPhone && !currentUserName) {
      return res.status(401).json({ code: 401, message: '未登录或登录已过期' });
    }

    // 查询专家参与的项目列表（基于 project_personnel 表）
    // 通过 phone 或 name 匹配
    const projectsResult = await db.query(`
      SELECT DISTINCT
        p.id, p.name, p.description, p.status,
        p.assessment_type as "assessmentType",
        p.start_date as "startDate", p.end_date as "endDate",
        p.created_at as "createdAt"
      FROM projects p
      INNER JOIN project_personnel pp ON p.id = pp.project_id
      WHERE (pp.phone = $1 OR pp.name = $2)
        AND pp.role = 'project_expert'
        AND pp.status = 'active'
      ORDER BY p.created_at DESC
    `, [currentUserPhone, currentUserName]);

    const projects = projectsResult.rows;

    // 为每个项目获取审核统计
    const projectsWithStats = await Promise.all(projects.map(async (project) => {
      // 获取该项目的填报统计
      const statsResult = await db.query(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) as submitted,
          SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
          SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
        FROM submissions
        WHERE project_id = $1
      `, [project.id]);

      const stats = statsResult.rows[0];
      const total = parseInt(stats.total) || 0;
      const submitted = parseInt(stats.submitted) || 0;
      const approved = parseInt(stats.approved) || 0;
      const rejected = parseInt(stats.rejected) || 0;
      const completed = approved + rejected;
      const completionRate = total > 0 ? Math.round((completed / total) * 100 * 10) / 10 : 0;

      return {
        ...project,
        reviewStats: {
          total,
          submitted,
          approved,
          rejected,
          completed,
          completionRate
        }
      };
    }));

    // 计算汇总统计
    const summaryStats = projectsWithStats.reduce((acc, p) => {
      acc.totalProjects += 1;
      acc.totalSubmitted += p.reviewStats.submitted;
      acc.totalApproved += p.reviewStats.approved;
      acc.totalRejected += p.reviewStats.rejected;
      acc.totalCompleted += p.reviewStats.completed;
      acc.totalRecords += p.reviewStats.total;
      return acc;
    }, { totalProjects: 0, totalSubmitted: 0, totalApproved: 0, totalRejected: 0, totalCompleted: 0, totalRecords: 0 });

    summaryStats.overallCompletionRate = summaryStats.totalRecords > 0
      ? Math.round((summaryStats.totalCompleted / summaryStats.totalRecords) * 100 * 10) / 10
      : 0;

    res.json({
      code: 200,
      data: {
        projects: projectsWithStats,
        summary: summaryStats
      }
    });
  } catch (error) {
    console.error('获取专家项目列表失败:', error);
    res.status(500).json({ code: 500, message: error.message });
  }
});

/**
 * 获取项目详情（专家视角）
 * GET /api/expert/projects/:projectId
 */
router.get('/expert/projects/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;

    // 获取项目基本信息
    const projectResult = await db.query(`
      SELECT id, name, description, status,
             assessment_type as "assessmentType",
             start_date as "startDate", end_date as "endDate",
             created_at as "createdAt"
      FROM projects
      WHERE id = $1
    `, [projectId]);

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ code: 404, message: '项目不存在' });
    }

    const project = projectResult.rows[0];

    // 获取审核统计
    const statsResult = await db.query(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) as submitted,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
      FROM submissions
      WHERE project_id = $1
    `, [projectId]);

    const stats = statsResult.rows[0];
    const total = parseInt(stats.total) || 0;
    const submitted = parseInt(stats.submitted) || 0;
    const approved = parseInt(stats.approved) || 0;
    const rejected = parseInt(stats.rejected) || 0;
    const completed = approved + rejected;
    const completionRate = total > 0 ? Math.round((completed / total) * 100 * 10) / 10 : 0;

    res.json({
      code: 200,
      data: {
        ...project,
        reviewStats: {
          total,
          submitted,
          approved,
          rejected,
          completed,
          completionRate
        }
      }
    });
  } catch (error) {
    console.error('获取项目详情失败:', error);
    res.status(500).json({ code: 500, message: error.message });
  }
});

/**
 * 获取项目下按区县的审核统计
 * GET /api/expert/projects/:projectId/district-stats
 */
router.get('/expert/projects/:projectId/district-stats', async (req, res) => {
  try {
    const { projectId } = req.params;

    // 获取项目基本信息
    const projectResult = await db.query(`
      SELECT id, name, assessment_type as "assessmentType"
      FROM projects WHERE id = $1
    `, [projectId]);

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ code: 404, message: '项目不存在' });
    }

    const project = projectResult.rows[0];

    // 获取各区县的审核统计
    // 通过 submissions -> schools -> districts 关联
    const districtStatsResult = await db.query(`
      SELECT
        d.id as "districtId",
        d.name as "districtName",
        d.code as "districtCode",
        COUNT(DISTINCT sc.id) as "schoolCount",
        COUNT(s.id) as total,
        SUM(CASE WHEN s.status = 'draft' THEN 1 ELSE 0 END) as draft,
        SUM(CASE WHEN s.status = 'submitted' THEN 1 ELSE 0 END) as submitted,
        SUM(CASE WHEN s.status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN s.status = 'rejected' THEN 1 ELSE 0 END) as rejected
      FROM districts d
      LEFT JOIN schools sc ON sc.district_id = d.id
      LEFT JOIN submissions s ON s.school_id = sc.id AND s.project_id = $1
      GROUP BY d.id, d.name, d.code
      ORDER BY d.code
    `, [projectId]);

    // 处理统计数据
    const districts = districtStatsResult.rows.map(row => {
      const total = parseInt(row.total) || 0;
      const submitted = parseInt(row.submitted) || 0;
      const approved = parseInt(row.approved) || 0;
      const rejected = parseInt(row.rejected) || 0;
      const completed = approved + rejected;
      const completionRate = total > 0 ? Math.round((completed / total) * 100 * 10) / 10 : 0;

      return {
        districtId: row.districtId,
        districtName: row.districtName,
        districtCode: row.districtCode,
        schoolCount: parseInt(row.schoolCount) || 0,
        stats: {
          total,
          draft: parseInt(row.draft) || 0,
          submitted,
          approved,
          rejected,
          completed,
          completionRate
        }
      };
    });

    // 计算汇总
    const summary = districts.reduce((acc, d) => {
      acc.totalSchools += d.schoolCount;
      acc.totalRecords += d.stats.total;
      acc.totalSubmitted += d.stats.submitted;
      acc.totalApproved += d.stats.approved;
      acc.totalRejected += d.stats.rejected;
      return acc;
    }, { totalSchools: 0, totalRecords: 0, totalSubmitted: 0, totalApproved: 0, totalRejected: 0 });

    summary.totalCompleted = summary.totalApproved + summary.totalRejected;
    summary.overallCompletionRate = summary.totalRecords > 0
      ? Math.round((summary.totalCompleted / summary.totalRecords) * 100 * 10) / 10
      : 0;

    res.json({
      code: 200,
      data: {
        project,
        districts,
        summary
      }
    });
  } catch (error) {
    console.error('获取区县审核统计失败:', error);
    res.status(500).json({ code: 500, message: error.message });
  }
});

/**
 * 获取项目下的填报记录列表（支持区县筛选）
 * GET /api/expert/projects/:projectId/submissions
 */
router.get('/expert/projects/:projectId/submissions', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { districtId, formId, status, keyword } = req.query;

    let sql = `
      SELECT
        s.id, s.project_id as "projectId",
        COALESCE(s.form_id, s.tool_id) as "formId",
        s.school_id as "schoolId",
        s.submitter_id as "submitterId",
        s.submitter_name as "submitterName",
        s.submitter_org as "submitterOrg",
        s.status,
        s.reject_reason as "rejectReason",
        s.created_at as "createdAt",
        s.updated_at as "updatedAt",
        s.submitted_at as "submittedAt",
        s.approved_at as "approvedAt",
        t.name as "formName",
        t.target as "formTarget",
        sc.name as "schoolName",
        sc.code as "schoolCode",
        sc.school_type as "schoolType",
        d.id as "districtId",
        d.name as "districtName"
      FROM submissions s
      LEFT JOIN data_tools t ON COALESCE(s.form_id, s.tool_id) = t.id
      LEFT JOIN schools sc ON s.school_id = sc.id
      LEFT JOIN districts d ON sc.district_id = d.id
      WHERE s.project_id = $1
    `;

    const params = [projectId];
    let paramIndex = 2;

    // 按区县筛选
    if (districtId) {
      sql += ` AND d.id = $${paramIndex++}`;
      params.push(districtId);
    }

    // 按表单筛选
    if (formId) {
      sql += ` AND COALESCE(s.form_id, s.tool_id) = $${paramIndex++}`;
      params.push(formId);
    }

    // 按状态筛选
    if (status) {
      sql += ` AND s.status = $${paramIndex++}`;
      params.push(status);
    }

    // 关键词搜索
    if (keyword) {
      sql += ` AND (s.submitter_name ILIKE $${paramIndex} OR s.submitter_org ILIKE $${paramIndex} OR sc.name ILIKE $${paramIndex})`;
      params.push(`%${keyword}%`);
      paramIndex++;
    }

    sql += ' ORDER BY s.submitted_at DESC NULLS LAST, s.created_at DESC';

    const result = await db.query(sql, params);

    // 获取统计
    const statsResult = await db.query(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) as submitted,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
      FROM submissions
      WHERE project_id = $1
    `, [projectId]);

    const stats = statsResult.rows[0];

    res.json({
      code: 200,
      data: {
        submissions: result.rows,
        stats: {
          total: parseInt(stats.total) || 0,
          submitted: parseInt(stats.submitted) || 0,
          approved: parseInt(stats.approved) || 0,
          rejected: parseInt(stats.rejected) || 0
        }
      }
    });
  } catch (error) {
    console.error('获取项目填报记录失败:', error);
    res.status(500).json({ code: 500, message: error.message });
  }
});

/**
 * 获取项目下的表单/工具列表（用于筛选下拉）
 * GET /api/expert/projects/:projectId/forms
 */
router.get('/expert/projects/:projectId/forms', async (req, res) => {
  try {
    const { projectId } = req.params;

    // 获取项目关联的采集工具
    const result = await db.query(`
      SELECT DISTINCT
        t.id, t.name, t.target, t.type
      FROM data_tools t
      INNER JOIN project_tools pt ON t.id = pt.tool_id
      WHERE pt.project_id = $1
      ORDER BY t.name
    `, [projectId]);

    res.json({
      code: 200,
      data: result.rows
    });
  } catch (error) {
    console.error('获取项目表单列表失败:', error);
    res.status(500).json({ code: 500, message: error.message });
  }
});

/**
 * 获取项目下的区县列表（用于筛选下拉）
 * GET /api/expert/projects/:projectId/districts
 */
router.get('/expert/projects/:projectId/districts', async (req, res) => {
  try {
    const { projectId } = req.params;

    // 获取有填报记录的区县
    const result = await db.query(`
      SELECT DISTINCT
        d.id, d.name, d.code
      FROM districts d
      INNER JOIN schools sc ON sc.district_id = d.id
      INNER JOIN submissions s ON s.school_id = sc.id
      WHERE s.project_id = $1
      ORDER BY d.code
    `, [projectId]);

    res.json({
      code: 200,
      data: result.rows
    });
  } catch (error) {
    console.error('获取项目区县列表失败:', error);
    res.status(500).json({ code: 500, message: error.message });
  }
});

module.exports = { router, setDb };
