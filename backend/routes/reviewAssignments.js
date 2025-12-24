/**
 * 审核任务分配路由
 * 管理评审专家的审核任务分配
 */

const express = require('express');
const router = express.Router();

let db = null;

const setDb = (database) => {
  db = database;
};

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
const now = () => new Date().toISOString();

// ==================== 审核任务分配 API ====================

/**
 * 获取待分配的填报记录（status=submitted 且未分配审核任务）
 * GET /projects/:projectId/review-assignments/pending
 */
router.get('/projects/:projectId/review-assignments/pending', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { toolId, districtId, schoolId } = req.query;

    let sql = `
      SELECT
        s.id as "submissionId",
        s.form_id as "formId",
        s.submitter_name as "submitterName",
        s.submitter_org as "submitterOrg",
        s.submitted_at as "submittedAt",
        dt.name as "toolName",
        dt.id as "toolId",
        dt.target as "toolTarget",
        CASE
          WHEN ra.id IS NOT NULL THEN 'assigned'
          ELSE 'unassigned'
        END as "assignmentStatus",
        ra.reviewer_id as "currentReviewerId",
        pp.name as "currentReviewerName"
      FROM submissions s
      LEFT JOIN data_tools dt ON s.form_id = dt.id
      LEFT JOIN review_assignments ra ON s.id = ra.submission_id
      LEFT JOIN project_personnel pp ON ra.reviewer_id = pp.id
      WHERE s.project_id = $1
        AND s.status = 'submitted'
    `;
    const params = [projectId];
    let paramIndex = 2;

    if (toolId) {
      sql += ` AND s.form_id = $${paramIndex++}`;
      params.push(toolId);
    }

    sql += ' ORDER BY s.submitted_at DESC';

    const result = await db.query(sql, params);
    res.json({ code: 200, data: result.rows });
  } catch (error) {
    console.error('获取待分配审核任务失败:', error);
    res.status(500).json({ code: 500, message: error.message });
  }
});

/**
 * 获取已分配的审核任务列表
 * GET /projects/:projectId/review-assignments
 */
router.get('/projects/:projectId/review-assignments', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { reviewerId, status } = req.query;

    let sql = `
      SELECT
        ra.id,
        ra.project_id as "projectId",
        ra.submission_id as "submissionId",
        ra.reviewer_id as "reviewerId",
        ra.status,
        ra.assigned_at as "assignedAt",
        ra.reviewed_at as "reviewedAt",
        ra.review_result as "reviewResult",
        ra.review_comment as "reviewComment",
        s.submitter_name as "submitterName",
        s.submitter_org as "submitterOrg",
        s.submitted_at as "submittedAt",
        s.status as "submissionStatus",
        dt.name as "toolName",
        dt.id as "toolId",
        pp.name as "reviewerName",
        pp.organization as "reviewerOrg"
      FROM review_assignments ra
      LEFT JOIN submissions s ON ra.submission_id = s.id
      LEFT JOIN data_tools dt ON s.form_id = dt.id
      LEFT JOIN project_personnel pp ON ra.reviewer_id = pp.id
      WHERE ra.project_id = $1
    `;
    const params = [projectId];
    let paramIndex = 2;

    if (reviewerId) {
      sql += ` AND ra.reviewer_id = $${paramIndex++}`;
      params.push(reviewerId);
    }
    if (status) {
      sql += ` AND ra.status = $${paramIndex++}`;
      params.push(status);
    }

    sql += ' ORDER BY ra.assigned_at DESC';

    const result = await db.query(sql, params);
    res.json({ code: 200, data: result.rows });
  } catch (error) {
    console.error('获取审核任务列表失败:', error);
    res.status(500).json({ code: 500, message: error.message });
  }
});

/**
 * 获取审核统计
 * GET /projects/:projectId/review-assignments/stats
 */
router.get('/projects/:projectId/review-assignments/stats', async (req, res) => {
  try {
    const { projectId } = req.params;

    // 获取整体统计
    const statsResult = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM submissions WHERE project_id = $1 AND status = 'submitted') as "totalSubmitted",
        (SELECT COUNT(*) FROM review_assignments WHERE project_id = $1) as "totalAssigned",
        (SELECT COUNT(*) FROM review_assignments WHERE project_id = $1 AND status = 'pending') as pending,
        (SELECT COUNT(*) FROM review_assignments WHERE project_id = $1 AND status = 'completed') as completed,
        (SELECT COUNT(*) FROM review_assignments WHERE project_id = $1 AND review_result = 'approved') as approved,
        (SELECT COUNT(*) FROM review_assignments WHERE project_id = $1 AND review_result = 'rejected') as rejected
    `, [projectId]);

    const stats = statsResult.rows[0];
    const totalSubmitted = parseInt(stats.totalSubmitted) || 0;
    const totalAssigned = parseInt(stats.totalAssigned) || 0;

    // 获取按专家统计
    const byReviewerResult = await db.query(`
      SELECT
        ra.reviewer_id as "reviewerId",
        pp.name as "reviewerName",
        COUNT(*) as total,
        SUM(CASE WHEN ra.status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN ra.status = 'pending' THEN 1 ELSE 0 END) as pending
      FROM review_assignments ra
      LEFT JOIN project_personnel pp ON ra.reviewer_id = pp.id
      WHERE ra.project_id = $1
      GROUP BY ra.reviewer_id, pp.name
      ORDER BY total DESC
    `, [projectId]);

    res.json({
      code: 200,
      data: {
        total: totalAssigned,
        unassigned: totalSubmitted - totalAssigned,
        pending: parseInt(stats.pending) || 0,
        completed: parseInt(stats.completed) || 0,
        approved: parseInt(stats.approved) || 0,
        rejected: parseInt(stats.rejected) || 0,
        byReviewer: byReviewerResult.rows.map(r => ({
          reviewerId: r.reviewerId,
          reviewerName: r.reviewerName,
          total: parseInt(r.total) || 0,
          completed: parseInt(r.completed) || 0,
          pending: parseInt(r.pending) || 0,
        })),
      },
    });
  } catch (error) {
    console.error('获取审核统计失败:', error);
    res.status(500).json({ code: 500, message: error.message });
  }
});

/**
 * 手动分配审核任务
 * POST /projects/:projectId/review-assignments/assign
 */
router.post('/projects/:projectId/review-assignments/assign', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { submissionIds, reviewerId } = req.body;

    if (!submissionIds || submissionIds.length === 0) {
      return res.status(400).json({ code: 400, message: '请选择要分配的填报记录' });
    }
    if (!reviewerId) {
      return res.status(400).json({ code: 400, message: '请选择审核专家' });
    }

    const timestamp = now();
    let assignedCount = 0;

    // 逐个创建分配记录（避免重复分配）
    for (const submissionId of submissionIds) {
      // 检查是否已分配（使用 Supabase 客户端）
      const { data: existing } = await db.supabase
        .from('review_assignments')
        .select('id')
        .eq('submission_id', submissionId)
        .eq('reviewer_id', reviewerId)
        .limit(1);

      if (!existing || existing.length === 0) {
        const id = generateId();
        await db.supabase
          .from('review_assignments')
          .insert({
            id,
            project_id: projectId,
            submission_id: submissionId,
            reviewer_id: reviewerId,
            status: 'pending',
            assigned_at: timestamp,
            created_at: timestamp,
            updated_at: timestamp
          });
        assignedCount++;
      }
    }

    res.json({
      code: 200,
      data: { assigned: assignedCount },
      message: `成功分配 ${assignedCount} 条审核任务`,
    });
  } catch (error) {
    console.error('分配审核任务失败:', error);
    res.status(500).json({ code: 500, message: error.message });
  }
});

/**
 * 取消分配（删除审核任务）
 * DELETE /projects/:projectId/review-assignments/:id
 */
router.delete('/projects/:projectId/review-assignments/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // 只能删除 pending 状态的分配（使用 Supabase 客户端）
    const { data, error } = await db.supabase
      .from('review_assignments')
      .delete()
      .eq('id', id)
      .eq('status', 'pending')
      .select('id');

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      return res.status(400).json({ code: 400, message: '分配记录不存在或已完成审核' });
    }

    res.json({ code: 200, message: '取消分配成功' });
  } catch (error) {
    console.error('取消分配失败:', error);
    res.status(500).json({ code: 500, message: error.message });
  }
});

/**
 * 执行审核（通过/驳回）
 * POST /review-assignments/:id/review
 */
router.post('/review-assignments/:id/review', async (req, res) => {
  try {
    const { id } = req.params;
    const { result, comment } = req.body;

    if (!result || !['approved', 'rejected'].includes(result)) {
      return res.status(400).json({ code: 400, message: '审核结果无效' });
    }

    const timestamp = now();

    // 获取分配记录（使用 Supabase 客户端）
    const { data: assignments } = await db.supabase
      .from('review_assignments')
      .select('submission_id')
      .eq('id', id)
      .eq('status', 'pending')
      .limit(1);

    if (!assignments || assignments.length === 0) {
      return res.status(400).json({ code: 400, message: '审核任务不存在或已完成' });
    }

    const submissionId = assignments[0].submission_id;

    // 获取填报记录信息，用于后续更新任务状态
    const { data: submissionData } = await db.supabase
      .from('submissions')
      .select('project_id, tool_id, form_id, school_id, submitter_id')
      .eq('id', submissionId)
      .single();

    // 更新分配记录（使用 Supabase 客户端）
    await db.supabase
      .from('review_assignments')
      .update({
        status: 'completed',
        reviewed_at: timestamp,
        review_result: result,
        review_comment: comment || '',
        updated_at: timestamp
      })
      .eq('id', id);

    // 更新填报记录状态（使用 Supabase 客户端）
    if (result === 'approved') {
      await db.supabase
        .from('submissions')
        .update({
          status: 'approved',
          approved_at: timestamp,
          updated_at: timestamp
        })
        .eq('id', submissionId);

      // 审核通过后，同步更新关联任务的状态为 completed
      if (submissionData) {
        const toolId = submissionData.form_id || submissionData.tool_id;
        const taskUpdateFields = {
          status: 'completed',
          completed_at: timestamp,
          updated_at: timestamp
        };

        // 方式1：通过 submission_id 匹配
        const { data: updatedBySubmissionId } = await db.supabase
          .from('tasks')
          .update(taskUpdateFields)
          .eq('submission_id', submissionId)
          .select('id');

        // 方式2：通过 project_id + tool_id + assignee_id 匹配（利用唯一约束）
        // 这是最可靠的匹配方式，因为任务表有 (project_id, tool_id, assignee_id) 唯一约束
        if (submissionData.project_id && toolId && submissionData.submitter_id) {
          const { data: updatedByAssignee } = await db.supabase
            .from('tasks')
            .update({
              ...taskUpdateFields,
              submission_id: submissionId  // 同时更新 submission_id，建立关联
            })
            .eq('project_id', submissionData.project_id)
            .eq('tool_id', toolId)
            .eq('assignee_id', submissionData.submitter_id)
            .neq('status', 'completed')  // 只更新未完成的任务，避免重复更新
            .select('id');

          if (updatedByAssignee && updatedByAssignee.length > 0) {
            console.log(`[review] 通过方式2（assignee_id）更新了 ${updatedByAssignee.length} 个任务，submissionId: ${submissionId}`);
          }
        }

        // 方式3：通过 project_id + tool_id + target_id(school_id) 匹配（备用方案）
        let updatedByTarget = null;
        if (submissionData.project_id && toolId && submissionData.school_id) {
          const { data: updated } = await db.supabase
            .from('tasks')
            .update({
              ...taskUpdateFields,
              submission_id: submissionId  // 同时更新 submission_id，建立关联
            })
            .eq('project_id', submissionData.project_id)
            .eq('tool_id', toolId)
            .eq('target_id', submissionData.school_id)
            .neq('status', 'completed')  // 只更新未完成的任务，避免重复更新
            .select('id');

          updatedByTarget = updated;
          if (updatedByTarget && updatedByTarget.length > 0) {
            console.log(`[review] 通过方式3（target_id）更新了 ${updatedByTarget.length} 个任务，submissionId: ${submissionId}`);
          }
        }

        // 方式4：如果以上匹配都失败，尝试通过 submitter_org 查找匹配的学校样本，再匹配任务
        const noMatchYet = (!updatedBySubmissionId || updatedBySubmissionId.length === 0) &&
                           (!updatedByTarget || updatedByTarget.length === 0);
        if (noMatchYet && submissionData.project_id && toolId) {
          try {
            // 获取 submission 的 submitter_org
            const { data: fullSubmission } = await db.supabase
              .from('submissions')
              .select('submitter_org')
              .eq('id', submissionId)
              .single();

            if (fullSubmission?.submitter_org) {
              // 通过 submitter_org 查找匹配的 project_samples
              const matchResult = await db.query(`
                SELECT id FROM project_samples
                WHERE project_id = $1 AND name = $2 AND type = 'school'
                LIMIT 1
              `, [submissionData.project_id, fullSubmission.submitter_org]);

              if (matchResult.rows.length > 0) {
                const matchedSampleId = matchResult.rows[0].id;
                const { data: updatedByOrgMatch } = await db.supabase
                  .from('tasks')
                  .update({
                    ...taskUpdateFields,
                    submission_id: submissionId
                  })
                  .eq('project_id', submissionData.project_id)
                  .eq('tool_id', toolId)
                  .eq('target_id', matchedSampleId)
                  .neq('status', 'completed')
                  .select('id');

                if (updatedByOrgMatch && updatedByOrgMatch.length > 0) {
                  console.log(`[review] 通过方式4（submitter_org匹配）更新了 ${updatedByOrgMatch.length} 个任务，submissionId: ${submissionId}, matchedSampleId: ${matchedSampleId}`);
                  updatedByTarget = updatedByOrgMatch; // 标记为已匹配
                }
              }
            }
          } catch (e) {
            console.warn(`[review] 方式4匹配失败:`, e.message);
          }
        }

        // 如果所有方式都没匹配到，记录警告
        if ((!updatedBySubmissionId || updatedBySubmissionId.length === 0) &&
            (!updatedByTarget || updatedByTarget.length === 0)) {
          console.warn(`[review] 未找到匹配的任务，submissionId: ${submissionId}, projectId: ${submissionData.project_id}, toolId: ${toolId}, submitterId: ${submissionData.submitter_id}, schoolId: ${submissionData.school_id}`);
        }
      }
    } else {
      await db.supabase
        .from('submissions')
        .update({
          status: 'rejected',
          reject_reason: comment || '',
          updated_at: timestamp
        })
        .eq('id', submissionId);
    }

    res.json({ code: 200, message: result === 'approved' ? '审核通过' : '审核驳回' });
  } catch (error) {
    console.error('执行审核失败:', error);
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ==================== 专家审核范围配置 API ====================

/**
 * 获取专家的审核范围
 * GET /projects/:projectId/reviewers/:reviewerId/scopes
 */
router.get('/projects/:projectId/reviewers/:reviewerId/scopes', async (req, res) => {
  try {
    const { projectId, reviewerId } = req.params;

    const result = await db.query(`
      SELECT
        rs.id,
        rs.project_id as "projectId",
        rs.reviewer_id as "reviewerId",
        rs.scope_type as "scopeType",
        rs.scope_id as "scopeId",
        rs.created_at as "createdAt",
        CASE
          WHEN rs.scope_type = 'district' THEN (SELECT name FROM project_samples WHERE id = rs.scope_id AND type = 'district')
          WHEN rs.scope_type = 'school' THEN (SELECT name FROM project_samples WHERE id = rs.scope_id AND type = 'school')
          WHEN rs.scope_type = 'tool' THEN (SELECT name FROM data_tools WHERE id = rs.scope_id)
          ELSE NULL
        END as "scopeName"
      FROM reviewer_scopes rs
      WHERE rs.project_id = $1 AND rs.reviewer_id = $2
      ORDER BY rs.scope_type, rs.created_at
    `, [projectId, reviewerId]);

    res.json({ code: 200, data: result.rows });
  } catch (error) {
    console.error('获取专家审核范围失败:', error);
    res.status(500).json({ code: 500, message: error.message });
  }
});

/**
 * 设置专家的审核范围
 * POST /projects/:projectId/reviewers/:reviewerId/scopes
 */
router.post('/projects/:projectId/reviewers/:reviewerId/scopes', async (req, res) => {
  try {
    const { projectId, reviewerId } = req.params;
    const { scopes } = req.body;

    if (!scopes || !Array.isArray(scopes)) {
      return res.status(400).json({ code: 400, message: '范围配置无效' });
    }

    const timestamp = now();

    // 删除现有范围配置（使用 Supabase 客户端）
    await db.supabase
      .from('reviewer_scopes')
      .delete()
      .eq('project_id', projectId)
      .eq('reviewer_id', reviewerId);

    // 插入新的范围配置（使用 Supabase 客户端）
    for (const scope of scopes) {
      if (!scope.scopeType) continue;

      const id = generateId();
      await db.supabase
        .from('reviewer_scopes')
        .insert({
          id,
          project_id: projectId,
          reviewer_id: reviewerId,
          scope_type: scope.scopeType,
          scope_id: scope.scopeId || null,
          created_at: timestamp
        });
    }

    // 配置成功后，自动分配符合范围的待分配任务
    let autoAssignedCount = 0;
    try {
      // 查询所有待分配的填报记录（status=submitted 且完全没有分配审核任务）
      const pendingSubmissions = await db.query(`
        SELECT s.id as "submissionId", s.form_id as "formId", s.submitter_org as "submitterOrg"
        FROM submissions s
        LEFT JOIN review_assignments ra ON s.id = ra.submission_id
        WHERE s.project_id = $1
          AND s.status = 'submitted'
          AND ra.id IS NULL
      `, [projectId]);

      // 根据配置的范围匹配任务并分配
      for (const submission of pendingSubmissions.rows) {
        let shouldAssign = false;

        for (const scope of scopes) {
          if (!scope.scopeType) continue;

          if (scope.scopeType === 'all') {
            // 全部范围，直接分配
            shouldAssign = true;
            break;
          } else if (scope.scopeType === 'tool' && scope.scopeId) {
            // 工具范围：匹配 form_id
            if (submission.formId === scope.scopeId) {
              shouldAssign = true;
              break;
            }
          } else if (scope.scopeType === 'district' && scope.scopeId) {
            // 区县范围：匹配该区县及其下所有学校的提交
            // 1. 检查 submitter_org 是否直接匹配区县名称
            // 2. 检查 submitter_org 是否匹配该区县下的学校名称
            const districtMatch = await db.query(`
              SELECT ps.id 
              FROM project_samples ps
              WHERE ps.project_id = $1
                AND (
                  (ps.id = $2 AND ps.type = 'district' AND ps.name = $3)
                  OR (ps.type = 'school' AND ps.parent_id = $2 AND ps.name = $3)
                )
              LIMIT 1
            `, [projectId, scope.scopeId, submission.submitterOrg]);
            if (districtMatch.rows.length > 0) {
              shouldAssign = true;
              break;
            }
          } else if (scope.scopeType === 'school' && scope.scopeId) {
            // 学校范围：通过 project_samples 匹配 submitter_org
            const schoolMatch = await db.query(`
              SELECT id FROM project_samples 
              WHERE id = $1 AND type = 'school' 
                AND name = $2
                AND project_id = $3
              LIMIT 1
            `, [scope.scopeId, submission.submitterOrg, projectId]);
            if (schoolMatch.rows.length > 0) {
              shouldAssign = true;
              break;
            }
          }
        }

        // 如果匹配，创建审核任务分配记录
        if (shouldAssign) {
          // 检查是否已分配（避免重复）
          const { data: existing } = await db.supabase
            .from('review_assignments')
            .select('id')
            .eq('submission_id', submission.submissionId)
            .eq('reviewer_id', reviewerId)
            .limit(1);

          if (!existing || existing.length === 0) {
            const assignmentId = generateId();
            await db.supabase
              .from('review_assignments')
              .insert({
                id: assignmentId,
                project_id: projectId,
                submission_id: submission.submissionId,
                reviewer_id: reviewerId,
                status: 'pending',
                assigned_at: timestamp,
                created_at: timestamp,
                updated_at: timestamp
              });
            autoAssignedCount++;
          }
        }
      }
    } catch (assignError) {
      // 自动分配失败不影响配置成功，只记录错误
      console.error('自动分配审核任务失败:', assignError);
    }

    const message = autoAssignedCount > 0
      ? `审核范围配置成功，已自动分配 ${autoAssignedCount} 个待审核任务`
      : '审核范围配置成功';

    res.json({ code: 200, message, data: { autoAssignedCount } });
  } catch (error) {
    console.error('设置专家审核范围失败:', error);
    res.status(500).json({ code: 500, message: error.message });
  }
});

/**
 * 获取所有专家的审核范围（批量）
 * GET /projects/:projectId/reviewer-scopes
 */
router.get('/projects/:projectId/reviewer-scopes', async (req, res) => {
  try {
    const { projectId } = req.params;

    const result = await db.query(`
      SELECT
        rs.id,
        rs.project_id as "projectId",
        rs.reviewer_id as "reviewerId",
        rs.scope_type as "scopeType",
        rs.scope_id as "scopeId",
        rs.created_at as "createdAt",
        pp.name as "reviewerName",
        CASE
          WHEN rs.scope_type = 'district' THEN (SELECT name FROM project_samples WHERE id = rs.scope_id AND type = 'district')
          WHEN rs.scope_type = 'school' THEN (SELECT name FROM project_samples WHERE id = rs.scope_id AND type = 'school')
          WHEN rs.scope_type = 'tool' THEN (SELECT name FROM data_tools WHERE id = rs.scope_id)
          ELSE NULL
        END as "scopeName"
      FROM reviewer_scopes rs
      LEFT JOIN project_personnel pp ON rs.reviewer_id = pp.id
      WHERE rs.project_id = $1
      ORDER BY pp.name, rs.scope_type, rs.created_at
    `, [projectId]);

    res.json({ code: 200, data: result.rows });
  } catch (error) {
    console.error('获取所有专家审核范围失败:', error);
    res.status(500).json({ code: 500, message: error.message });
  }
});

module.exports = { router, setDb };
