const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { generateId, nowISO } = require('../utils/helpers');
const { syncSurveyIndicators } = require('../services/surveySync');

// 辅助函数
const now = nowISO;

let db = null;

const setDb = (database) => {
  db = database;
};

// JWT 密钥（生产环境应从环境变量读取）
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// 问卷工具的标准Schema
const STANDARD_SURVEY_SCHEMA = {
  fields: [
    {
      id: 'respondent_type',
      label: '填报人身份',
      type: 'radio',
      required: true,
      readonly: false,
      options: [
        { value: 'parent', label: '家长' },
        { value: 'teacher', label: '教师' },
        { value: 'student', label: '学生' },
        { value: 'principal', label: '校长' },
        { value: 'other', label: '其他' }
      ],
      description: '用于识别填报人身份，由第三方问卷系统在问卷中设置'
    },
    {
      id: 'school_id',
      label: '学校ID',
      type: 'hidden',
      readonly: true,
      description: '从URL参数自动获取，用于识别问卷所属学校'
    },
    {
      id: 'school_name',
      label: '所属学校',
      type: 'text',
      readonly: true,
      description: '学校名称，在问卷中只读显示'
    },
    {
      id: 'total_sent',
      label: '问卷总数/发放总数',
      type: 'number',
      readonly: true,
      category: 'statistics',
      description: '问卷发放的总数量（由第三方系统统计后回调填充）'
    },
    {
      id: 'total_sent_to_parents',
      label: '发给家长的数量',
      type: 'number',
      readonly: true,
      category: 'statistics',
      description: '专门发给家长的问卷数量'
    },
    {
      id: 'total_valid',
      label: '回收有效问卷数',
      type: 'number',
      readonly: true,
      category: 'statistics',
      description: '回收的有效问卷总数'
    },
    {
      id: 'total_valid_from_parents',
      label: '家长有效问卷数',
      type: 'number',
      readonly: true,
      category: 'statistics',
      description: '来自家长的有效问卷数量'
    },
    {
      id: 'total_satisfied',
      label: '满意问卷数',
      type: 'number',
      readonly: true,
      category: 'statistics',
      description: '满意度达标的问卷数量'
    },
    {
      id: 'total_satisfied_from_parents',
      label: '家长满意问卷数',
      type: 'number',
      readonly: true,
      category: 'statistics',
      description: '来自家长的满意问卷数量'
    }
  ]
};

// ==================== 5.1.2 管理员创建问卷跳转链接 ====================

/**
 * POST /api/tools/:id/create-survey
 * 管理员创建采集工具后，跳转到第三方系统创建问卷内容（此时尚未关联具体项目）
 */
router.post('/tools/:id/create-survey', async (req, res) => {
  try {
    const { id: toolId } = req.params;
    const { action = 'create' } = req.body; // create | edit | view

    // 1. 获取工具信息
    const toolResult = await db.query(
      'SELECT * FROM data_tools WHERE id = $1',
      [toolId]
    );

    if (toolResult.rows.length === 0) {
      return res.status(404).json({ code: 404, message: '工具不存在' });
    }

    const tool = toolResult.rows[0];

    // 2. 验证工具类型
    if (tool.type !== '问卷') {
      return res.status(400).json({ code: 400, message: '工具类型不是问卷' });
    }

    // 3. 生成管理员JWT Token
    const adminToken = jwt.sign(
      {
        toolId,
        action,
        timestamp: Date.now(),
        exp: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60) // 90天有效期
      },
      JWT_SECRET
    );

    // 4. 构建跳转URL
    const surveyBaseUrl = process.env.SURVEY_BASE_URL || 'https://survey-test.f123.pub';
    const callbackUrl = `${process.env.APP_BASE_URL || 'http://localhost:3000'}/api/survey/callback`;

    const url = new URL(surveyBaseUrl);
    url.searchParams.append('action', action);
    url.searchParams.append('toolId', toolId);
    url.searchParams.append('toolName', encodeURIComponent(tool.name));
    url.searchParams.append('callback', callbackUrl);
    url.searchParams.append('token', adminToken);

    // 如果已有问卷ID，则添加到URL
    if (action !== 'create' && tool.external_survey_id) {
      url.searchParams.append('externalSurveyId', tool.external_survey_id);
    }

    res.json({
      code: 200,
      data: {
        url: url.toString(),
        externalSurveyId: tool.external_survey_id,
        externalSurveyUrl: tool.external_survey_url
      }
    });

  } catch (error) {
    console.error('创建问卷跳转链接失败:', error);
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ==================== 5.1.3 批量生成学校访问链接 ====================

/**
 * POST /api/tools/:id/generate-access-links
 * 为项目中的所有学校或指定学校批量生成访问链接
 */
router.post('/tools/:id/generate-access-links', async (req, res) => {
  try {
    const { id: toolId } = req.params;
    const {
      projectId,
      schoolIds,
      targetAudience,
      linkType = 'url',
      expiresIn = 7776000 // 默认90天（秒）
    } = req.body;

    // 1. 验证必填字段
    if (!projectId) {
      return res.status(400).json({ code: 400, message: '项目ID必填' });
    }
    if (!targetAudience) {
      return res.status(400).json({ code: 400, message: '目标受众必填' });
    }

    // 2. 获取工具信息
    const toolResult = await db.query(
      'SELECT * FROM data_tools WHERE id = $1',
      [toolId]
    );

    if (toolResult.rows.length === 0) {
      return res.status(404).json({ code: 404, message: '工具不存在' });
    }

    const tool = toolResult.rows[0];

    // 3. 验证工具类型和问卷ID
    if (tool.type !== '问卷') {
      return res.status(400).json({ code: 400, message: '工具类型不是问卷' });
    }
    if (!tool.external_survey_id || !tool.external_survey_url) {
      return res.status(400).json({ code: 400, message: '问卷尚未在第三方系统创建' });
    }

    // 4. 获取学校列表
    let schools = [];
    if (schoolIds && schoolIds.length > 0) {
      // 指定学校
      const placeholders = schoolIds.map((_, i) => `$${i + 2}`).join(',');
      const schoolResult = await db.query(
        `SELECT id, name, district_id FROM schools WHERE project_id = $1 AND id IN (${placeholders})`,
        [projectId, ...schoolIds]
      );
      schools = schoolResult.rows;
    } else {
      // 项目下所有学校
      const schoolResult = await db.query(
        'SELECT id, name, district_id FROM schools WHERE project_id = $1',
        [projectId]
      );
      schools = schoolResult.rows;
    }

    if (schools.length === 0) {
      return res.status(404).json({ code: 404, message: '未找到学校' });
    }

    // 5. 为每个学校生成访问链接
    const links = [];
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    for (const school of schools) {
      // 5.1 生成JWT Token
      const linkId = generateId();
      const schoolToken = jwt.sign(
        {
          toolId,
          externalSurveyId: tool.external_survey_id,
          projectId,
          schoolId: school.id,
          districtId: school.district_id,
          targetAudience,
          linkId,
          timestamp: Date.now(),
          exp: Math.floor(Date.now() / 1000) + expiresIn
        },
        JWT_SECRET
      );

      // 5.2 构建访问URL
      const accessUrl = new URL(tool.external_survey_url);
      accessUrl.searchParams.append('projectId', projectId);
      accessUrl.searchParams.append('schoolId', school.id);
      accessUrl.searchParams.append('schoolName', school.name);
      if (school.district_id) {
        accessUrl.searchParams.append('districtId', school.district_id);
      }
      accessUrl.searchParams.append('targetAudience', targetAudience);
      accessUrl.searchParams.append('token', schoolToken);

      // 5.3 保存到数据库
      await db.query(`
        INSERT INTO survey_access_links (
          id, tool_id, project_id, school_id, district_id,
          access_url, access_token, target_audience, link_type,
          is_active, expires_at, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (tool_id, project_id, school_id, target_audience)
        DO UPDATE SET
          access_url = EXCLUDED.access_url,
          access_token = EXCLUDED.access_token,
          link_type = EXCLUDED.link_type,
          expires_at = EXCLUDED.expires_at,
          is_active = true,
          updated_at = EXCLUDED.updated_at
      `, [
        linkId,
        toolId,
        projectId,
        school.id,
        school.district_id,
        accessUrl.toString(),
        schoolToken,
        targetAudience,
        linkType,
        true,
        expiresAt,
        now(),
        now()
      ]);

      links.push({
        schoolId: school.id,
        schoolName: school.name,
        districtId: school.district_id,
        accessUrl: accessUrl.toString(),
        expiresAt
      });
    }

    res.json({
      code: 200,
      data: {
        total: schools.length,
        generated: links.length,
        links
      }
    });

  } catch (error) {
    console.error('批量生成学校访问链接失败:', error);
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ==================== 5.1.4 更新工具的第三方问卷信息 ====================

/**
 * PUT /api/tools/:id/survey-info
 * 更新工具的第三方问卷信息
 */
router.put('/tools/:id/survey-info', async (req, res) => {
  try {
    const { id: toolId } = req.params;
    const { externalSurveyId, externalSurveyUrl } = req.body;

    // 更新工具信息
    await db.query(`
      UPDATE data_tools
      SET external_survey_id = $1,
          external_survey_url = $2,
          updated_at = $3
      WHERE id = $4
    `, [externalSurveyId, externalSurveyUrl, now(), toolId]);

    res.json({
      code: 200,
      message: '问卷信息已更新',
      data: { externalSurveyId, externalSurveyUrl }
    });

  } catch (error) {
    console.error('更新问卷信息失败:', error);
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ==================== 5.2.1 接收第三方回调（推送详细问卷数据，核心接口）====================

/**
 * POST /api/survey/callback
 * 接收第三方系统的问卷数据回调
 */
router.post('/survey/callback', async (req, res) => {
  try {
    // 1. 验证JWT Token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ code: 401, message: '未提供认证令牌' });
    }

    const token = authHeader.substring(7);
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return res.status(401).json({ code: 401, message: 'Token无效或已过期' });
    }

    const {
      toolId,
      projectId,
      schoolId,
      districtId,
      externalSurveyId,
      externalSurveyUrl,
      targetAudience,
      responses = [],
      summary = {},
      collectedAt,
      action
    } = req.body;

    // 2. 场景一：问卷创建/发布回调（首次回调）
    if (action === 'created' || action === 'published') {
      if (!externalSurveyId || !externalSurveyUrl) {
        return res.status(400).json({ code: 400, message: '缺少问卷ID或URL' });
      }

      // 更新工具信息
      await db.query(`
        UPDATE data_tools
        SET external_survey_id = $1,
            external_survey_url = $2,
            updated_at = $3
        WHERE id = $4
      `, [externalSurveyId, externalSurveyUrl, now(), toolId]);

      return res.json({
        code: 200,
        message: '问卷信息已保存'
      });
    }

    // 3. 场景二：问卷数据同步回调
    if (!projectId || !schoolId) {
      return res.status(400).json({ code: 400, message: '缺少项目ID或学校ID' });
    }

    // 4. 验证token与请求body的一致性
    if (decoded.toolId !== toolId || decoded.projectId !== projectId || decoded.schoolId !== schoolId) {
      return res.status(403).json({ code: 403, message: 'Token与请求数据不匹配' });
    }

    // 5. 验证学校存在性
    const schoolResult = await db.query(
      'SELECT id, district_id FROM schools WHERE id = $1',
      [schoolId]
    );
    if (schoolResult.rows.length === 0) {
      return res.status(404).json({ code: 404, message: '学校不存在' });
    }

    // 6. 处理问卷响应数据
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // 6.1 获取工具信息和满意度配置
      const toolResult = await client.query(
        'SELECT * FROM data_tools WHERE id = $1',
        [toolId]
      );

      if (toolResult.rows.length === 0) {
        throw new Error('工具不存在');
      }

      const tool = toolResult.rows[0];
      const satisfactionConfig = tool.satisfaction_config || {
        scale: 5,
        minScore: 4.0,
        calculationMethod: 'threshold'
      };

      let responsesInserted = 0;
      let responsesUpdated = 0;

      // 6.2 存储每份问卷的详细数据到 survey_responses 表
      for (const response of responses) {
        // 验证必填字段
        if (!response.responseId) {
          throw new Error('响应ID缺失');
        }
        if (!response.respondentType || !['parent', 'teacher', 'student', 'principal', 'other'].includes(response.respondentType)) {
          throw new Error(`respondentType 无效: ${response.respondentType}`);
        }
        if (response.totalScore === null || response.totalScore === undefined) {
          throw new Error('totalScore 缺失');
        }
        if (typeof response.isValid !== 'boolean') {
          throw new Error('isValid 必须是布尔值');
        }

        const result = await client.query(`
          INSERT INTO survey_responses (
            id, tool_id, project_id, school_id, district_id,
            external_response_id, external_survey_id, respondent_type,
            total_score, is_valid, submitted_at, raw_data,
            created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          ON CONFLICT (external_response_id)
          WHERE external_response_id IS NOT NULL
          DO UPDATE SET
            total_score = EXCLUDED.total_score,
            is_valid = EXCLUDED.is_valid,
            raw_data = EXCLUDED.raw_data,
            updated_at = EXCLUDED.updated_at
          RETURNING (xmax = 0) AS inserted
        `, [
          generateId(),
          toolId,
          response.projectId || projectId,
          response.schoolId || schoolId,
          districtId,
          response.responseId,
          response.externalSurveyId || externalSurveyId,
          response.respondentType,
          response.totalScore,
          response.isValid,
          response.submittedAt || collectedAt,
          JSON.stringify(response.rawData || {}),
          now(),
          now()
        ]);

        if (result.rows[0].inserted) {
          responsesInserted++;
        } else {
          responsesUpdated++;
        }
      }

      // 6.3 基于 survey_responses 计算统计汇总
      const minScore = satisfactionConfig.minScore || 4.0;
      const statsResult = await client.query(`
        SELECT
          COUNT(*) FILTER (WHERE is_valid = true) as total_valid,
          COUNT(*) FILTER (WHERE is_valid = true AND respondent_type = 'parent') as total_valid_from_parents,
          COUNT(*) FILTER (WHERE is_valid = true AND total_score >= $1) as total_satisfied,
          COUNT(*) FILTER (WHERE is_valid = true AND total_score >= $1 AND respondent_type = 'parent') as total_satisfied_from_parents,
          COUNT(*) FILTER (WHERE respondent_type = 'parent') as total_sent_to_parents
        FROM survey_responses
        WHERE tool_id = $2 AND project_id = $3 AND school_id = $4
      `, [minScore, toolId, projectId, schoolId]);

      const statistics = statsResult.rows[0];

      // 6.4 更新 survey_statistics 表（汇总缓存）
      await client.query(`
        INSERT INTO survey_statistics (
          id, tool_id, project_id, school_id, district_id,
          total_sent, total_sent_to_parents,
          total_valid, total_valid_from_parents,
          total_satisfied, total_satisfied_from_parents,
          source, external_survey_id, collected_at,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        ON CONFLICT (tool_id, project_id, school_id)
        WHERE project_id IS NOT NULL AND school_id IS NOT NULL
        DO UPDATE SET
          total_sent = EXCLUDED.total_sent,
          total_sent_to_parents = EXCLUDED.total_sent_to_parents,
          total_valid = EXCLUDED.total_valid,
          total_valid_from_parents = EXCLUDED.total_valid_from_parents,
          total_satisfied = EXCLUDED.total_satisfied,
          total_satisfied_from_parents = EXCLUDED.total_satisfied_from_parents,
          collected_at = EXCLUDED.collected_at,
          updated_at = EXCLUDED.updated_at
      `, [
        generateId(),
        toolId,
        projectId,
        schoolId,
        districtId,
        summary.totalSent || statistics.total_valid,
        parseInt(statistics.total_sent_to_parents),
        parseInt(statistics.total_valid),
        parseInt(statistics.total_valid_from_parents),
        parseInt(statistics.total_satisfied),
        parseInt(statistics.total_satisfied_from_parents),
        'external',
        externalSurveyId,
        collectedAt || now(),
        now(),
        now()
      ]);

      // 6.5 同步到指标系统
      const indicatorResult = await syncSurveyIndicators(
        client,
        projectId,
        schoolId,
        toolId,
        {
          total_sent: summary.totalSent || parseInt(statistics.total_valid),
          total_sent_to_parents: parseInt(statistics.total_sent_to_parents),
          total_valid: parseInt(statistics.total_valid),
          total_valid_from_parents: parseInt(statistics.total_valid_from_parents),
          total_satisfied: parseInt(statistics.total_satisfied),
          total_satisfied_from_parents: parseInt(statistics.total_satisfied_from_parents)
        },
        collectedAt || now()
      );

      await client.query('COMMIT');

      res.json({
        code: 200,
        message: '问卷数据已接收并处理',
        data: {
          schoolId,
          responsesProcessed: responses.length,
          responsesInserted,
          responsesUpdated,
          statisticsCalculated: {
            totalValid: parseInt(statistics.total_valid),
            totalSatisfied: parseInt(statistics.total_satisfied),
            satisfactionRate: statistics.total_valid > 0
              ? (statistics.total_satisfied / statistics.total_valid * 100).toFixed(2)
              : 0
          },
          indicatorsUpdated: indicatorResult.indicatorsUpdated,
          synced: true
        }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('处理问卷回调失败:', error);
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ==================== 5.2.3 查询问卷统计数据 ====================

/**
 * GET /api/survey/statistics
 * 查询问卷统计数据
 */
router.get('/survey/statistics', async (req, res) => {
  try {
    const { toolId, projectId, schoolId, districtId } = req.query;

    if (!toolId) {
      return res.status(400).json({ code: 400, message: '工具ID必填' });
    }

    let sql = `
      SELECT s.*, t.name as tool_name
      FROM survey_statistics s
      LEFT JOIN data_tools t ON s.tool_id = t.id
      WHERE s.tool_id = $1
    `;
    const params = [toolId];
    let paramIndex = 2;

    if (projectId) {
      sql += ` AND s.project_id = $${paramIndex++}`;
      params.push(projectId);
    }
    if (schoolId) {
      sql += ` AND s.school_id = $${paramIndex++}`;
      params.push(schoolId);
    }
    if (districtId) {
      sql += ` AND s.district_id = $${paramIndex++}`;
      params.push(districtId);
    }

    sql += ' ORDER BY s.collected_at DESC';

    const result = await db.query(sql, params);

    res.json({
      code: 200,
      data: result.rows
    });

  } catch (error) {
    console.error('查询问卷统计数据失败:', error);
    res.status(500).json({ code: 500, message: error.message });
  }
});

// ==================== 工具辅助方法 ====================

/**
 * 获取问卷工具的标准Schema
 */
function getStandardSurveySchema() {
  return STANDARD_SURVEY_SCHEMA;
}

module.exports = {
  router,
  setDb,
  getStandardSurveySchema
};
