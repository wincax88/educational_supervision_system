/**
 * 学前教育普及普惠督导评估统计API
 *
 * 功能：
 * 1. 区县层面的普及普惠水平统计（3项指标）
 * 2. 政府保障情况统计（11项指标）
 * 3. 幼儿园保教质量保障统计（6项指标）
 * 4. 分级达标判定（巩固/提高/创优"学前双普"）
 * 5. 幼儿园个体评估统计
 */

const express = require('express');
const router = express.Router();

// 数据库实例（通过 setDb 注入）
let db;

/**
 * 学前教育普及普惠指标配置
 *
 * 达标标准：
 * - 巩固"学前双普"：29项合格 + 7项基本合格 = 36项
 * - 提高"学前双普"：31项合格 + 5项基本合格 = 36项
 * - 创优"学前双普"：33项合格 + 3项基本合格 = 36项
 */
const PRESCHOOL_COMPLIANCE_CONFIG = {
  totalIndicators: 36, // 总指标数（二级指标数）
  levels: {
    consolidated: {  // 巩固
      name: '巩固"学前双普"',
      minCompliant: 29,
      maxBasicCompliant: 7
    },
    improved: {  // 提高
      name: '提高"学前双普"',
      minCompliant: 31,
      maxBasicCompliant: 5
    },
    excellence: {  // 创优
      name: '创优"学前双普"',
      minCompliant: 33,
      maxBasicCompliant: 3
    }
  }
};

/**
 * 普及普惠水平指标配置（3项）
 */
const UNIVERSALIZATION_INDICATORS = {
  '1.1-D1': {
    code: '1.1-D1',
    name: '学前三年毛入园率',
    threshold: 85,
    unit: '%',
    operator: '>='
  },
  '1.2-D1': {
    code: '1.2-D1',
    name: '普惠性幼儿园覆盖率',
    threshold: 80,
    unit: '%',
    operator: '>='
  },
  '1.3-D1': {
    code: '1.3-D1',
    name: '公办园在园幼儿占比',
    threshold: 50,
    unit: '%',
    operator: '>='
  }
};

/**
 * 辅助函数：判断指标是否达标
 */
function checkCompliance(value, threshold, operator = '>=') {
  if (value === null || value === undefined) {
    return null; // 未填报
  }

  switch (operator) {
    case '>=':
      return value >= threshold;
    case '>':
      return value > threshold;
    case '<=':
      return value <= threshold;
    case '<':
      return value < threshold;
    case '=':
    case '==':
      return value === threshold;
    default:
      return null;
  }
}

/**
 * 辅助函数：判定达标等级（合格/基本合格/不合格）
 *
 * @param {number} value - 指标值
 * @param {number} threshold - 达标阈值
 * @param {number} basicThreshold - 基本合格阈值（可选，默认为threshold的90%）
 * @param {string} operator - 比较运算符
 * @returns {string} 'compliant' | 'basic' | 'non-compliant' | 'pending'
 */
function determineComplianceLevel(value, threshold, operator = '>=', basicThreshold = null) {
  if (value === null || value === undefined) {
    return 'pending'; // 未填报
  }

  // 如果没有提供基本合格阈值，默认为达标阈值的90%
  if (basicThreshold === null) {
    if (operator === '>=' || operator === '>') {
      basicThreshold = threshold * 0.9;
    } else if (operator === '<=' || operator === '<') {
      basicThreshold = threshold * 1.1;
    } else if (operator === '=' || operator === '==') {
      // 对于等于操作，不设置基本合格
      basicThreshold = threshold;
    }
  }

  switch (operator) {
    case '>=':
      if (value >= threshold) return 'compliant';
      if (value >= basicThreshold) return 'basic';
      return 'non-compliant';

    case '>':
      if (value > threshold) return 'compliant';
      if (value >= basicThreshold) return 'basic';
      return 'non-compliant';

    case '<=':
      if (value <= threshold) return 'compliant';
      if (value <= basicThreshold) return 'basic';
      return 'non-compliant';

    case '<':
      if (value < threshold) return 'compliant';
      if (value <= basicThreshold) return 'basic';
      return 'non-compliant';

    case '=':
    case '==':
      return value === threshold ? 'compliant' : 'non-compliant';

    default:
      return 'pending';
  }
}

/**
 * 辅助函数：判定学前双普等级
 */
function determinePreschoolLevel(compliantCount, basicCount, nonCompliantCount) {
  const { levels } = PRESCHOOL_COMPLIANCE_CONFIG;

  // 创优：33项合格 + 3项基本合格
  if (compliantCount >= levels.excellence.minCompliant &&
      basicCount <= levels.excellence.maxBasicCompliant &&
      nonCompliantCount === 0) {
    return {
      level: 'excellence',
      name: levels.excellence.name,
      description: `${compliantCount}项合格 + ${basicCount}项基本合格，达到创优标准`
    };
  }

  // 提高：31项合格 + 5项基本合格
  if (compliantCount >= levels.improved.minCompliant &&
      basicCount <= levels.improved.maxBasicCompliant &&
      nonCompliantCount === 0) {
    return {
      level: 'improved',
      name: levels.improved.name,
      description: `${compliantCount}项合格 + ${basicCount}项基本合格，达到提高标准`
    };
  }

  // 巩固：29项合格 + 7项基本合格
  if (compliantCount >= levels.consolidated.minCompliant &&
      basicCount <= levels.consolidated.maxBasicCompliant &&
      nonCompliantCount === 0) {
    return {
      level: 'consolidated',
      name: levels.consolidated.name,
      description: `${compliantCount}项合格 + ${basicCount}项基本合格，达到巩固标准`
    };
  }

  // 未达标
  return {
    level: 'non-compliant',
    name: '未达标',
    description: `${compliantCount}项合格 + ${basicCount}项基本合格 + ${nonCompliantCount}项不合格，未达到巩固标准`
  };
}

/**
 * GET /api/preschool-statistics/districts/:districtId/universalization-summary
 *
 * 获取区县普及普惠水平指标汇总（3项指标）
 *
 * Query参数：
 * - projectId: 项目ID（必需）
 */
router.get('/districts/:districtId/universalization-summary', async (req, res) => {
  try {
    const { districtId } = req.params;
    const { projectId } = req.query;

    if (!projectId) {
      return res.status(400).json({ error: '缺少必需参数: projectId' });
    }

    // 获取区县信息（优先从 project_samples 查询，兼容 districts 表）
    let district = null;
    const projectSampleResult = await db.query(
      'SELECT id, code, name FROM project_samples WHERE id = $1 AND type = $2',
      [districtId, 'district']
    );
    if (projectSampleResult.rows.length > 0) {
      district = projectSampleResult.rows[0];
    } else {
      const districtResult = await db.query(
        'SELECT id, code, name FROM districts WHERE id = $1',
        [districtId]
      );
      district = districtResult.rows[0];
    }

    if (!district) {
      return res.status(404).json({ error: '区县不存在' });
    }

    // 获取区县最新填报数据
    // 通过 tasks 表的 submission_id 关联
    const submissionResult = await db.query(
      `SELECT s.id, s.data, s.status, s.submitted_at
       FROM submissions s
       WHERE s.project_id = $1
         AND s.id IN (
           SELECT t.submission_id
           FROM tasks t
           WHERE t.project_id = $1
             AND t.target_type = 'district'
             AND t.target_id = $2
             AND t.submission_id IS NOT NULL
         )
         AND s.status IN ('submitted', 'approved')
       ORDER BY s.submitted_at DESC
       LIMIT 1`,
      [projectId, districtId]
    );
    const submission = submissionResult.rows[0];

    if (!submission) {
      return res.json({
        district,
        indicators: [],
        summary: {
          totalCount: 3,
          compliantCount: 0,
          basicCount: 0,
          nonCompliantCount: 0,
          pendingCount: 3,
          allCompliant: false
        },
        message: '区县尚未填报数据'
      });
    }

    const submissionData = JSON.parse(submission.data || '{}');

    // 计算3项普及普惠指标
    const indicators = [];

    for (const [key, config] of Object.entries(UNIVERSALIZATION_INDICATORS)) {
      const value = submissionData[key] || null;
      const complianceLevel = determineComplianceLevel(
        value,
        config.threshold,
        config.operator
      );

      indicators.push({
        code: config.code,
        name: config.name,
        value,
        unit: config.unit,
        threshold: config.threshold,
        operator: config.operator,
        complianceLevel,
        isCompliant: complianceLevel === 'compliant',
        isBasic: complianceLevel === 'basic',
        isPending: complianceLevel === 'pending'
      });
    }

    // 统计
    const compliantCount = indicators.filter(i => i.complianceLevel === 'compliant').length;
    const basicCount = indicators.filter(i => i.complianceLevel === 'basic').length;
    const nonCompliantCount = indicators.filter(i => i.complianceLevel === 'non-compliant').length;
    const pendingCount = indicators.filter(i => i.complianceLevel === 'pending').length;

    res.json({
      district,
      submission: {
        id: submission.id,
        status: submission.status,
        submittedAt: submission.submitted_at
      },
      indicators,
      summary: {
        totalCount: indicators.length,
        compliantCount,
        basicCount,
        nonCompliantCount,
        pendingCount,
        allCompliant: compliantCount === indicators.length
      }
    });

  } catch (error) {
    console.error('获取普及普惠水平指标汇总失败:', error);
    res.status(500).json({ error: '获取普及普惠水平指标汇总失败', details: error.message });
  }
});

/**
 * GET /api/preschool-statistics/districts/:districtId/overall-compliance
 *
 * 获取区县学前教育普及普惠综合达标情况和等级判定
 *
 * Query参数：
 * - projectId: 项目ID（必需）
 */
router.get('/districts/:districtId/overall-compliance', async (req, res) => {
  try {
    const { districtId } = req.params;
    const { projectId } = req.query;

    if (!projectId) {
      return res.status(400).json({ error: '缺少必需参数: projectId' });
    }

    // 获取区县信息（优先从 project_samples 查询，兼容 districts 表）
    let district = null;
    const projectSampleResult = await db.query(
      'SELECT id, code, name FROM project_samples WHERE id = $1 AND type = $2',
      [districtId, 'district']
    );
    if (projectSampleResult.rows.length > 0) {
      district = projectSampleResult.rows[0];
    } else {
      const districtResult = await db.query(
        'SELECT id, code, name FROM districts WHERE id = $1',
        [districtId]
      );
      district = districtResult.rows[0];
    }

    if (!district) {
      return res.status(404).json({ error: '区县不存在' });
    }

    // 获取项目关联的指标体系
    const indicatorSystemResult = await db.query(
      `SELECT is_sys.*
       FROM indicator_systems is_sys
       INNER JOIN projects p ON p.indicator_system_id = is_sys.id
       WHERE p.id = $1`,
      [projectId]
    );
    const indicatorSystem = indicatorSystemResult.rows[0];

    if (!indicatorSystem) {
      return res.status(404).json({ error: '项目未关联指标体系' });
    }

    // 获取所有二级指标（末级指标）
    const leafIndicatorsResult = await db.query(
      `SELECT id, code, name, level
       FROM indicators
       WHERE system_id = $1 AND is_leaf = true
       ORDER BY code`,
      [indicatorSystem.id]
    );
    const leafIndicators = leafIndicatorsResult.rows;

    if (leafIndicators.length === 0) {
      return res.json({
        district,
        message: '指标体系中没有末级指标',
        complianceLevel: null
      });
    }

    // 获取区县最新填报数据
    // 通过 tasks 表的 submission_id 关联
    const submissionResult = await db.query(
      `SELECT s.id, s.data, s.status, s.submitted_at
       FROM submissions s
       WHERE s.project_id = $1
         AND s.id IN (
           SELECT t.submission_id
           FROM tasks t
           WHERE t.project_id = $1
             AND t.target_type = 'district'
             AND t.target_id = $2
             AND t.submission_id IS NOT NULL
         )
         AND s.status IN ('submitted', 'approved')
       ORDER BY s.submitted_at DESC
       LIMIT 1`,
      [projectId, districtId]
    );
    const submission = submissionResult.rows[0];

    if (!submission) {
      return res.json({
        district,
        indicators: leafIndicators.map(ind => ({
          code: ind.code,
          name: ind.name,
          complianceLevel: 'pending'
        })),
        summary: {
          totalCount: leafIndicators.length,
          compliantCount: 0,
          basicCount: 0,
          nonCompliantCount: 0,
          pendingCount: leafIndicators.length
        },
        complianceLevel: null,
        message: '区县尚未填报数据'
      });
    }

    const submissionData = JSON.parse(submission.data || '{}');

    // 评估每个指标的达标情况
    // 注意：这里需要根据具体的数据指标配置来判定
    // 简化处理：从submissionData中读取各指标的达标情况
    const indicatorEvaluations = [];
    let compliantCount = 0;
    let basicCount = 0;
    let nonCompliantCount = 0;
    let pendingCount = 0;

    for (const indicator of leafIndicators) {
      // 获取该指标的数据指标
      const dataIndicatorsResult = await db.query(
        'SELECT code, name, threshold FROM data_indicators WHERE indicator_id = $1',
        [indicator.id]
      );
      const dataIndicators = dataIndicatorsResult.rows;

      let indicatorCompliance = 'pending';

      if (dataIndicators.length > 0) {
        // 如果有数据指标，检查数据指标的达标情况
        const dataIndicatorCode = dataIndicators[0].code;
        const value = submissionData[dataIndicatorCode];

        if (value !== undefined && value !== null) {
          // 解析阈值并判定（简化处理）
          const threshold = dataIndicators[0].threshold;
          if (threshold) {
            // 解析阈值，例如 ">= 85%"
            const match = threshold.match(/(>=|>|<=|<|=)\s*([\d.]+)/);
            if (match) {
              const operator = match[1];
              const thresholdValue = parseFloat(match[2]);
              indicatorCompliance = determineComplianceLevel(
                parseFloat(value),
                thresholdValue,
                operator
              );
            }
          }
        }
      } else {
        // 如果没有数据指标，可能是纯佐证资料指标
        // 检查是否有佐证资料上传
        const hasMaterialsResult = await db.query(
          `SELECT COUNT(*) as count
           FROM submission_materials sm
           INNER JOIN supporting_materials m ON sm.material_id = m.id
           WHERE sm.submission_id = $1 AND m.indicator_id = $2`,
          [submission.id, indicator.id]
        );
        const hasMaterials = hasMaterialsResult.rows[0];

        if (hasMaterials && hasMaterials.count > 0) {
          indicatorCompliance = 'compliant'; // 简化：有佐证材料即视为合格
        }
      }

      indicatorEvaluations.push({
        code: indicator.code,
        name: indicator.name,
        complianceLevel: indicatorCompliance
      });

      // 统计
      if (indicatorCompliance === 'compliant') compliantCount++;
      else if (indicatorCompliance === 'basic') basicCount++;
      else if (indicatorCompliance === 'non-compliant') nonCompliantCount++;
      else pendingCount++;
    }

    // 判定学前双普等级
    const complianceLevel = determinePreschoolLevel(
      compliantCount,
      basicCount,
      nonCompliantCount
    );

    res.json({
      district,
      submission: {
        id: submission.id,
        status: submission.status,
        submittedAt: submission.submitted_at
      },
      indicators: indicatorEvaluations,
      summary: {
        totalCount: leafIndicators.length,
        compliantCount,
        basicCount,
        nonCompliantCount,
        pendingCount
      },
      complianceLevel,
      config: PRESCHOOL_COMPLIANCE_CONFIG
    });

  } catch (error) {
    console.error('获取综合达标情况失败:', error);
    res.status(500).json({ error: '获取综合达标情况失败', details: error.message });
  }
});

/**
 * GET /api/preschool-statistics/projects/:projectId/kindergarten-summary
 *
 * 获取项目下所有幼儿园的统计汇总
 */
router.get('/projects/:projectId/kindergarten-summary', async (req, res) => {
  try {
    const { projectId } = req.params;

    // 获取项目信息
    const projectResult = await db.query(
      'SELECT id, name, district_id FROM projects WHERE id = $1',
      [projectId]
    );
    const project = projectResult.rows[0];

    if (!project) {
      return res.status(404).json({ error: '项目不存在' });
    }

    // 获取项目所在区县的所有幼儿园
    const kindergartensResult = await db.query(
      `SELECT id, code, name, kindergarten_type, kindergarten_level,
              student_count, teacher_count, class_count, urban_rural
       FROM schools
       WHERE district_id = $1 AND school_type = '幼儿园' AND status = 'active'
       ORDER BY code`,
      [project.district_id]
    );
    const kindergartens = kindergartensResult.rows;

    // 统计汇总
    const summary = {
      total: kindergartens.length,
      byType: {
        public: kindergartens.filter(k => k.kindergarten_type === '公办').length,
        inclusivePrivate: kindergartens.filter(k => k.kindergarten_type === '普惠性民办').length,
        nonInclusivePrivate: kindergartens.filter(k => k.kindergarten_type === '非普惠性民办').length
      },
      byUrbanRural: {
        urban: kindergartens.filter(k => k.urban_rural === '城区').length,
        town: kindergartens.filter(k => k.urban_rural === '镇区').length,
        rural: kindergartens.filter(k => k.urban_rural === '乡村').length
      },
      students: {
        total: kindergartens.reduce((sum, k) => sum + (k.student_count || 0), 0),
        public: kindergartens
          .filter(k => k.kindergarten_type === '公办')
          .reduce((sum, k) => sum + (k.student_count || 0), 0),
        inclusivePrivate: kindergartens
          .filter(k => k.kindergarten_type === '普惠性民办')
          .reduce((sum, k) => sum + (k.student_count || 0), 0)
      },
      teachers: kindergartens.reduce((sum, k) => sum + (k.teacher_count || 0), 0),
      classes: kindergartens.reduce((sum, k) => sum + (k.class_count || 0), 0)
    };

    // 计算比率
    if (summary.students.total > 0) {
      summary.students.publicRatio =
        ((summary.students.public / summary.students.total) * 100).toFixed(2);
      summary.students.inclusiveCoverage =
        (((summary.students.public + summary.students.inclusivePrivate) / summary.students.total) * 100).toFixed(2);
    }

    res.json({
      project: {
        id: project.id,
        name: project.name
      },
      kindergartens,
      summary
    });

  } catch (error) {
    console.error('获取幼儿园汇总统计失败:', error);
    res.status(500).json({ error: '获取幼儿园汇总统计失败', details: error.message });
  }
});

/**
 * 设置数据库实例
 * @param {object} dbInstance - 数据库实例
 */
function setDb(dbInstance) {
  db = dbInstance;
}

module.exports = { router, setDb };
