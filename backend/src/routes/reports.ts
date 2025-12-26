/**
 * 评估报告路由
 * 为报告决策者角色提供报告查看功能
 */

import { Router, Request, Response } from 'express';
import { Database } from '../database/db';
import { verifyToken, roles, AuthenticatedRequest } from '../middleware/auth';

export const router = Router();

// 数据库连接将在 app.ts 中注入
let db: Database | null = null;

export const setDb = (database: Database): void => {
  db = database;
};

// ==================== 报告列表 ====================

/**
 * 获取评估报告列表
 * GET /api/reports
 * 权限：decision_maker, admin, project_admin
 */
router.get('/reports', verifyToken, roles.decisionMaker, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!db) {
      res.status(500).json({ code: 500, message: '数据库未连接' });
      return;
    }

    const { type, year, status, keyword, page = '1', pageSize = '10' } = req.query as {
      type?: string;
      year?: string;
      status?: string;
      keyword?: string;
      page?: string;
      pageSize?: string;
    };

    // 构建查询条件
    let sql = `
      SELECT
        p.id,
        p.name,
        p.description,
        p.assessment_type as "assessmentType",
        p.status,
        p.start_date as "startDate",
        p.end_date as "endDate",
        p.created_at as "createdAt",
        p.updated_at as "updatedAt",
        i.name as "indicatorSystemName",
        (SELECT COUNT(DISTINCT district_id) FROM project_samples WHERE project_id = p.id AND type = 'district') as "districtCount",
        (SELECT COUNT(*) FROM submissions WHERE project_id = p.id AND status = 'approved') as "approvedSubmissions",
        (SELECT COUNT(*) FROM submissions WHERE project_id = p.id) as "totalSubmissions"
      FROM projects p
      LEFT JOIN indicator_systems i ON p.indicator_system_id = i.id
      WHERE p.status IN ('评审中', '已完成')
    `;

    const params: unknown[] = [];
    let paramIndex = 1;

    // 按评估类型筛选
    if (type) {
      sql += ` AND p.assessment_type = $${paramIndex++}`;
      params.push(type);
    }

    // 按年度筛选
    if (year) {
      sql += ` AND EXTRACT(YEAR FROM p.start_date::date) = $${paramIndex++}`;
      params.push(parseInt(year));
    }

    // 按状态筛选
    if (status) {
      sql += ` AND p.status = $${paramIndex++}`;
      params.push(status);
    }

    // 按关键词搜索
    if (keyword) {
      sql += ` AND (p.name ILIKE $${paramIndex++} OR p.description ILIKE $${paramIndex++})`;
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    // 获取总数
    const countSql = sql.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM');
    const countResult = await db.query(countSql, params);
    const total = parseInt(String((countResult.rows[0] as Record<string, unknown>)?.total || '0'));

    // 分页
    const pageNum = Math.max(1, parseInt(page));
    const size = Math.min(50, Math.max(1, parseInt(pageSize)));
    const offset = (pageNum - 1) * size;

    sql += ` ORDER BY p.updated_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(size, offset);

    const result = await db.query(sql, params);

    res.json({
      code: 200,
      data: {
        list: result.rows,
        total,
        page: pageNum,
        pageSize: size,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('获取报告列表失败:', message);
    res.status(500).json({ code: 500, message });
  }
});

// ==================== 报告详情 ====================

/**
 * 获取项目评估报告详情
 * GET /api/reports/:projectId
 * 权限：decision_maker, admin, project_admin
 */
router.get('/reports/:projectId', verifyToken, roles.decisionMaker, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!db) {
      res.status(500).json({ code: 500, message: '数据库未连接' });
      return;
    }

    const { projectId } = req.params;

    // 获取项目基本信息
    const projectResult = await db.query(`
      SELECT
        p.id,
        p.name,
        p.description,
        p.assessment_type as "assessmentType",
        p.status,
        p.start_date as "startDate",
        p.end_date as "endDate",
        p.created_at as "createdAt",
        p.updated_at as "updatedAt",
        p.indicator_system_id as "indicatorSystemId",
        i.name as "indicatorSystemName"
      FROM projects p
      LEFT JOIN indicator_systems i ON p.indicator_system_id = i.id
      WHERE p.id = $1
    `, [projectId]);

    const project = projectResult.rows[0];
    if (!project) {
      res.status(404).json({ code: 404, message: '项目不存在' });
      return;
    }

    // 获取项目统计概览
    const summaryResult = await db.query(`
      SELECT
        (SELECT COUNT(DISTINCT district_id) FROM project_samples WHERE project_id = $1 AND type = 'district') as "totalDistricts",
        (SELECT COUNT(DISTINCT school_id) FROM project_samples WHERE project_id = $1 AND type = 'school') as "totalSchools",
        (SELECT COUNT(*) FROM submissions WHERE project_id = $1) as "totalSubmissions",
        (SELECT COUNT(*) FROM submissions WHERE project_id = $1 AND status = 'approved') as "approvedSubmissions",
        (SELECT COUNT(*) FROM submissions WHERE project_id = $1 AND status = 'submitted') as "pendingSubmissions",
        (SELECT COUNT(*) FROM submissions WHERE project_id = $1 AND status = 'rejected') as "rejectedSubmissions"
    `, [projectId]);

    const summary = summaryResult.rows[0] || {};

    // 获取区县数据汇总
    const districtsResult = await db.query(`
      SELECT
        d.id,
        d.name,
        d.code,
        (SELECT COUNT(*) FROM project_samples ps
         JOIN schools s ON ps.school_id = s.id
         WHERE ps.project_id = $1 AND s.district_id = d.id) as "schoolCount",
        (SELECT COUNT(*) FROM submissions sub
         JOIN project_samples ps ON sub.project_id = ps.project_id
         JOIN schools s ON ps.school_id = s.id
         WHERE sub.project_id = $1 AND s.district_id = d.id AND sub.status = 'approved') as "approvedCount"
      FROM districts d
      WHERE d.id IN (
        SELECT DISTINCT ps.district_id FROM project_samples ps WHERE ps.project_id = $1 AND ps.type = 'district'
      )
      ORDER BY d.code
    `, [projectId]);

    // 获取指标体系树（如果有关联）
    let indicators: unknown[] = [];
    const projectData = project as Record<string, unknown>;
    if (projectData.indicatorSystemId) {
      const indicatorsResult = await db.query(`
        SELECT
          id,
          name,
          code,
          parent_id as "parentId",
          level,
          weight,
          description,
          sort_order as "sortOrder"
        FROM indicators
        WHERE system_id = $1
        ORDER BY sort_order, code
      `, [projectData.indicatorSystemId]);
      indicators = indicatorsResult.rows;
    }

    // 获取专家评审意见（如果有）
    const expertCommentsResult = await db.query(`
      SELECT
        ra.id,
        pp.name as "expertName",
        ra.status as "reviewStatus",
        ra.created_at as "assignedAt",
        ra.updated_at as "reviewedAt"
      FROM review_assignments ra
      LEFT JOIN project_personnel pp ON ra.expert_id = pp.id
      WHERE ra.project_id = $1
      ORDER BY ra.updated_at DESC
    `, [projectId]);

    res.json({
      code: 200,
      data: {
        project,
        summary,
        districts: districtsResult.rows,
        indicators,
        expertReviews: expertCommentsResult.rows,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('获取报告详情失败:', message);
    res.status(500).json({ code: 500, message });
  }
});

// ==================== 统计数据 ====================

/**
 * 获取统计看板数据
 * GET /api/reports/statistics/overview
 * 权限：decision_maker, admin, project_admin
 */
router.get('/reports/statistics/overview', verifyToken, roles.decisionMaker, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!db) {
      res.status(500).json({ code: 500, message: '数据库未连接' });
      return;
    }

    // 项目统计
    const projectStatsResult = await db.query(`
      SELECT
        COUNT(*) as "totalProjects",
        SUM(CASE WHEN status = '已完成' THEN 1 ELSE 0 END) as "completedProjects",
        SUM(CASE WHEN status = '评审中' THEN 1 ELSE 0 END) as "reviewingProjects",
        SUM(CASE WHEN status = '填报中' THEN 1 ELSE 0 END) as "fillingProjects",
        SUM(CASE WHEN assessment_type = '优质均衡' THEN 1 ELSE 0 END) as "balancedProjects",
        SUM(CASE WHEN assessment_type = '普及普惠' THEN 1 ELSE 0 END) as "preschoolProjects"
      FROM projects
    `);

    // 按年度统计
    const yearlyStatsResult = await db.query(`
      SELECT
        EXTRACT(YEAR FROM start_date::date) as year,
        COUNT(*) as count,
        SUM(CASE WHEN status = '已完成' THEN 1 ELSE 0 END) as completed
      FROM projects
      WHERE start_date IS NOT NULL
      GROUP BY EXTRACT(YEAR FROM start_date::date)
      ORDER BY year DESC
      LIMIT 5
    `);

    // 填报完成率
    const submissionStatsResult = await db.query(`
      SELECT
        COUNT(*) as "totalSubmissions",
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as "approvedSubmissions",
        SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) as "pendingSubmissions",
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as "rejectedSubmissions"
      FROM submissions
    `);

    res.json({
      code: 200,
      data: {
        projectStats: projectStatsResult.rows[0] || {},
        yearlyStats: yearlyStatsResult.rows,
        submissionStats: submissionStatsResult.rows[0] || {},
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('获取统计数据失败:', message);
    res.status(500).json({ code: 500, message });
  }
});

// ==================== 区县排名 ====================

/**
 * 获取区县排名数据
 * GET /api/reports/rankings/districts
 * 权限：decision_maker, admin, project_admin
 */
router.get('/reports/rankings/districts', verifyToken, roles.decisionMaker, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!db) {
      res.status(500).json({ code: 500, message: '数据库未连接' });
      return;
    }

    const { projectId } = req.query as { projectId?: string };

    let sql = `
      SELECT
        d.id,
        d.name,
        d.code,
        COUNT(DISTINCT ps.school_id) as "schoolCount",
        COUNT(sub.id) as "submissionCount",
        SUM(CASE WHEN sub.status = 'approved' THEN 1 ELSE 0 END) as "approvedCount",
        ROUND(
          CAST(SUM(CASE WHEN sub.status = 'approved' THEN 1 ELSE 0 END) AS NUMERIC) * 100.0 /
          NULLIF(COUNT(sub.id), 0),
          2
        ) as "approvalRate"
      FROM districts d
      LEFT JOIN project_samples ps ON ps.district_id = d.id AND ps.type = 'district'
      LEFT JOIN submissions sub ON sub.project_id = ps.project_id
    `;

    const params: unknown[] = [];

    if (projectId) {
      sql += ` WHERE ps.project_id = $1`;
      params.push(projectId);
    }

    sql += `
      GROUP BY d.id, d.name, d.code
      HAVING COUNT(DISTINCT ps.school_id) > 0
      ORDER BY "approvalRate" DESC NULLS LAST, d.code
    `;

    const result = await db.query(sql, params);

    // 添加排名
    const rankings = result.rows.map((row, index) => ({
      ...row,
      rank: index + 1,
    }));

    res.json({
      code: 200,
      data: rankings,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('获取区县排名失败:', message);
    res.status(500).json({ code: 500, message });
  }
});

// ==================== 预警提醒 ====================

/**
 * 获取预警列表
 * GET /api/reports/alerts
 * 权限：decision_maker, admin, project_admin
 */
router.get('/reports/alerts', verifyToken, roles.decisionMaker, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!db) {
      res.status(500).json({ code: 500, message: '数据库未连接' });
      return;
    }

    // 获取进度落后的项目（评审中但完成率低于50%）
    const lowProgressProjectsResult = await db.query(`
      SELECT
        p.id,
        p.name,
        p.status,
        p.end_date as "endDate",
        COUNT(sub.id) as "totalSubmissions",
        SUM(CASE WHEN sub.status = 'approved' THEN 1 ELSE 0 END) as "approvedCount",
        ROUND(
          CAST(SUM(CASE WHEN sub.status = 'approved' THEN 1 ELSE 0 END) AS NUMERIC) * 100.0 /
          NULLIF(COUNT(sub.id), 0),
          2
        ) as "completionRate"
      FROM projects p
      LEFT JOIN submissions sub ON p.id = sub.project_id
      WHERE p.status IN ('填报中', '评审中')
      GROUP BY p.id, p.name, p.status, p.end_date
      HAVING COUNT(sub.id) > 0
        AND CAST(SUM(CASE WHEN sub.status = 'approved' THEN 1 ELSE 0 END) AS NUMERIC) * 100.0 / COUNT(sub.id) < 50
      ORDER BY "completionRate" ASC
      LIMIT 10
    `);

    // 获取即将到期的项目（7天内到期）
    const upcomingDeadlineResult = await db.query(`
      SELECT
        id,
        name,
        status,
        end_date as "endDate",
        EXTRACT(DAY FROM (end_date::date - CURRENT_DATE)) as "daysRemaining"
      FROM projects
      WHERE status IN ('配置中', '填报中', '评审中')
        AND end_date IS NOT NULL
        AND end_date::date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
      ORDER BY end_date ASC
      LIMIT 10
    `);

    // 获取驳回率高的区县（驳回率超过20%）
    const highRejectionDistrictsResult = await db.query(`
      SELECT
        d.id,
        d.name,
        d.code,
        COUNT(sub.id) as "totalSubmissions",
        SUM(CASE WHEN sub.status = 'rejected' THEN 1 ELSE 0 END) as "rejectedCount",
        ROUND(
          CAST(SUM(CASE WHEN sub.status = 'rejected' THEN 1 ELSE 0 END) AS NUMERIC) * 100.0 /
          NULLIF(COUNT(sub.id), 0),
          2
        ) as "rejectionRate"
      FROM districts d
      LEFT JOIN project_samples ps ON ps.district_id = d.id
      LEFT JOIN submissions sub ON sub.project_id = ps.project_id
      GROUP BY d.id, d.name, d.code
      HAVING COUNT(sub.id) >= 5
        AND CAST(SUM(CASE WHEN sub.status = 'rejected' THEN 1 ELSE 0 END) AS NUMERIC) * 100.0 / COUNT(sub.id) > 20
      ORDER BY "rejectionRate" DESC
      LIMIT 10
    `);

    // 获取长时间未更新的填报（超过7天未更新的待审核填报）
    const staleSubmissionsResult = await db.query(`
      SELECT
        sub.id,
        sub.submitter_name as "submitterName",
        sub.submitter_org as "submitterOrg",
        sub.status,
        sub.updated_at as "updatedAt",
        p.name as "projectName",
        EXTRACT(DAY FROM (CURRENT_TIMESTAMP - sub.updated_at::timestamp)) as "daysSinceUpdate"
      FROM submissions sub
      JOIN projects p ON sub.project_id = p.id
      WHERE sub.status = 'submitted'
        AND sub.updated_at IS NOT NULL
        AND sub.updated_at::timestamp < CURRENT_TIMESTAMP - INTERVAL '7 days'
      ORDER BY sub.updated_at ASC
      LIMIT 10
    `);

    res.json({
      code: 200,
      data: {
        lowProgressProjects: lowProgressProjectsResult.rows,
        upcomingDeadlines: upcomingDeadlineResult.rows,
        highRejectionDistricts: highRejectionDistrictsResult.rows,
        staleSubmissions: staleSubmissionsResult.rows,
        summary: {
          lowProgressCount: lowProgressProjectsResult.rows.length,
          upcomingDeadlineCount: upcomingDeadlineResult.rows.length,
          highRejectionCount: highRejectionDistrictsResult.rows.length,
          staleSubmissionCount: staleSubmissionsResult.rows.length,
        },
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('获取预警数据失败:', message);
    res.status(500).json({ code: 500, message });
  }
});

// ==================== 历年对比 ====================

/**
 * 获取项目历年对比数据
 * GET /api/reports/comparison
 * 权限：decision_maker, admin, project_admin
 */
router.get('/reports/comparison', verifyToken, roles.decisionMaker, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!db) {
      res.status(500).json({ code: 500, message: '数据库未连接' });
      return;
    }

    const { districtId, assessmentType } = req.query as { districtId?: string; assessmentType?: string };

    // 按年度统计项目完成情况
    let yearlyComparisonSql = `
      SELECT
        EXTRACT(YEAR FROM p.start_date::date) as year,
        p.assessment_type as "assessmentType",
        COUNT(DISTINCT p.id) as "projectCount",
        COUNT(sub.id) as "submissionCount",
        SUM(CASE WHEN sub.status = 'approved' THEN 1 ELSE 0 END) as "approvedCount",
        ROUND(
          CAST(SUM(CASE WHEN sub.status = 'approved' THEN 1 ELSE 0 END) AS NUMERIC) * 100.0 /
          NULLIF(COUNT(sub.id), 0),
          2
        ) as "approvalRate"
      FROM projects p
      LEFT JOIN submissions sub ON p.id = sub.project_id
      WHERE p.start_date IS NOT NULL
    `;

    const params: unknown[] = [];
    let paramIndex = 1;

    if (assessmentType) {
      yearlyComparisonSql += ` AND p.assessment_type = $${paramIndex++}`;
      params.push(assessmentType);
    }

    yearlyComparisonSql += `
      GROUP BY EXTRACT(YEAR FROM p.start_date::date), p.assessment_type
      ORDER BY year DESC, "assessmentType"
      LIMIT 20
    `;

    const yearlyComparisonResult = await db.query(yearlyComparisonSql, params);

    // 按区县统计历年数据
    let districtComparisonSql = `
      SELECT
        d.id as "districtId",
        d.name as "districtName",
        EXTRACT(YEAR FROM p.start_date::date) as year,
        COUNT(sub.id) as "submissionCount",
        SUM(CASE WHEN sub.status = 'approved' THEN 1 ELSE 0 END) as "approvedCount",
        ROUND(
          CAST(SUM(CASE WHEN sub.status = 'approved' THEN 1 ELSE 0 END) AS NUMERIC) * 100.0 /
          NULLIF(COUNT(sub.id), 0),
          2
        ) as "approvalRate"
      FROM districts d
      LEFT JOIN project_samples ps ON ps.district_id = d.id
      LEFT JOIN projects p ON ps.project_id = p.id
      LEFT JOIN submissions sub ON p.id = sub.project_id
      WHERE p.start_date IS NOT NULL
    `;

    const districtParams: unknown[] = [];
    let districtParamIndex = 1;

    if (districtId) {
      districtComparisonSql += ` AND d.id = $${districtParamIndex++}`;
      districtParams.push(districtId);
    }

    districtComparisonSql += `
      GROUP BY d.id, d.name, EXTRACT(YEAR FROM p.start_date::date)
      HAVING COUNT(sub.id) > 0
      ORDER BY d.name, year DESC
      LIMIT 50
    `;

    const districtComparisonResult = await db.query(districtComparisonSql, districtParams);

    res.json({
      code: 200,
      data: {
        yearlyComparison: yearlyComparisonResult.rows,
        districtComparison: districtComparisonResult.rows,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('获取对比数据失败:', message);
    res.status(500).json({ code: 500, message });
  }
});

// ==================== 导出报告 ====================

/**
 * 导出项目报告
 * GET /api/reports/:projectId/export
 * 权限：decision_maker, admin, project_admin
 * 参数：format=pdf|excel
 */
router.get('/reports/:projectId/export', verifyToken, roles.decisionMaker, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!db) {
      res.status(500).json({ code: 500, message: '数据库未连接' });
      return;
    }

    const { projectId } = req.params;
    const { format = 'excel' } = req.query as { format?: string };

    // 验证项目存在
    const projectResult = await db.query(`
      SELECT id, name, status FROM projects WHERE id = $1
    `, [projectId]);

    if (projectResult.rows.length === 0) {
      res.status(404).json({ code: 404, message: '项目不存在' });
      return;
    }

    // TODO: 实现实际的导出逻辑
    // 目前返回一个占位响应
    res.json({
      code: 200,
      message: `报告导出功能开发中（格式：${format}）`,
      data: {
        projectId,
        format,
        status: 'pending',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('导出报告失败:', message);
    res.status(500).json({ code: 500, message });
  }
});

export default { router, setDb };
