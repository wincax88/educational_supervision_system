/**
 * 恢复项目佐证材料脚本
 *
 * 用于修复已丢失佐证材料的项目：
 * 1. 从源指标体系模板中读取佐证材料
 * 2. 根据指标 code 匹配项目指标
 * 3. 复制佐证材料到项目
 *
 * 使用方法：
 * node backend/scripts/restore-supporting-materials.js <projectId>
 *
 * 示例：
 * node backend/scripts/restore-supporting-materials.js mjnrjgvq89kbn1t8h
 */

require('dotenv').config();

const db = require('../database/db');

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
const now = () => new Date().toISOString();

async function restoreSupportingMaterials(projectId) {
  console.log('\n========================================');
  console.log('恢复项目佐证材料');
  console.log('========================================\n');

  if (!projectId) {
    console.error('错误：请提供项目ID');
    console.log('使用方法: node backend/scripts/restore-supporting-materials.js <projectId>');
    process.exit(1);
  }

  console.log('项目ID:', projectId);

  try {
    // 1. 获取项目信息
    const { data: project, error: projErr } = await db.from('projects')
      .select('id, name, indicator_system_id')
      .eq('id', projectId)
      .single();

    if (projErr || !project) {
      console.error('错误：项目不存在');
      process.exit(1);
    }

    console.log('项目名称:', project.name);
    console.log('关联的指标体系ID:', project.indicator_system_id);

    if (!project.indicator_system_id) {
      console.error('错误：项目未关联指标体系');
      process.exit(1);
    }

    // 2. 获取项目指标（按 code 建立映射）
    const { data: projectIndicators } = await db.from('project_indicators')
      .select('id, code, name, is_leaf')
      .eq('project_id', projectId);

    if (!projectIndicators || projectIndicators.length === 0) {
      console.error('错误：项目没有指标数据');
      process.exit(1);
    }

    console.log('\n项目指标数:', projectIndicators.length);

    // 建立 code -> projectIndicatorId 的映射
    const projectIndicatorByCode = {};
    projectIndicators.forEach(ind => {
      projectIndicatorByCode[ind.code] = ind;
    });

    // 3. 获取源指标体系的指标和佐证材料
    const { data: sourceIndicators } = await db.from('indicators')
      .select('id, code, name')
      .eq('system_id', project.indicator_system_id);

    if (!sourceIndicators || sourceIndicators.length === 0) {
      console.error('错误：源指标体系没有指标数据');
      process.exit(1);
    }

    const sourceIndicatorIds = sourceIndicators.map(i => i.id);
    const sourceIndicatorCodeMap = {}; // id -> code
    sourceIndicators.forEach(i => { sourceIndicatorCodeMap[i.id] = i.code; });

    // 获取源佐证材料
    const { data: sourceMaterials } = await db.from('supporting_materials')
      .select('*')
      .in('indicator_id', sourceIndicatorIds)
      .order('sort_order', { ascending: true });

    console.log('源指标体系佐证材料数:', sourceMaterials?.length || 0);

    if (!sourceMaterials || sourceMaterials.length === 0) {
      console.log('源指标体系没有佐证材料，无需恢复');
      process.exit(0);
    }

    // 4. 检查项目现有佐证材料
    const projectIndicatorIds = projectIndicators.map(i => i.id);
    const { data: existingMaterials } = await db.from('project_supporting_materials')
      .select('id, indicator_id')
      .in('indicator_id', projectIndicatorIds);

    console.log('项目现有佐证材料数:', existingMaterials?.length || 0);

    // 5. 按 code 匹配并复制佐证材料
    const timestamp = now();
    let copiedCount = 0;
    let skippedCount = 0;

    // 按源指标 code 分组佐证材料
    const materialsByCode = {};
    sourceMaterials.forEach(m => {
      const code = sourceIndicatorCodeMap[m.indicator_id];
      if (code) {
        if (!materialsByCode[code]) {
          materialsByCode[code] = [];
        }
        materialsByCode[code].push(m);
      }
    });

    console.log('\n开始恢复佐证材料...\n');

    for (const [indicatorCode, materials] of Object.entries(materialsByCode)) {
      const projectIndicator = projectIndicatorByCode[indicatorCode];

      if (!projectIndicator) {
        console.log(`  跳过：指标 ${indicatorCode} 在项目中不存在`);
        skippedCount += materials.length;
        continue;
      }

      if (!projectIndicator.is_leaf) {
        console.log(`  跳过：指标 ${indicatorCode} 不是叶子节点`);
        skippedCount += materials.length;
        continue;
      }

      // 检查该指标是否已有佐证材料
      const hasExisting = (existingMaterials || []).some(
        m => m.indicator_id === projectIndicator.id
      );

      if (hasExisting) {
        console.log(`  跳过：指标 ${indicatorCode} 已有佐证材料`);
        skippedCount += materials.length;
        continue;
      }

      // 复制佐证材料
      for (let idx = 0; idx < materials.length; idx++) {
        const sourceMaterial = materials[idx];
        const newId = generateId();

        // 处理 max_size 字段（可能是字符串如 "20MB" 或数字）
        let maxSize = sourceMaterial.max_size;
        if (typeof maxSize === 'string') {
          // 尝试解析数字部分
          const match = maxSize.match(/^(\d+)/);
          maxSize = match ? parseInt(match[1], 10) : null;
        }

        const { error: insertErr } = await db.from('project_supporting_materials').insert({
          id: newId,
          project_id: projectId,
          indicator_id: projectIndicator.id,
          code: sourceMaterial.code || '',
          name: sourceMaterial.name,
          file_types: sourceMaterial.file_types || '',
          max_size: maxSize,
          description: sourceMaterial.description || '',
          required: sourceMaterial.required ? 1 : 0,
          sort_order: idx,
          created_at: timestamp,
          updated_at: timestamp
        });

        if (insertErr) {
          console.error(`  错误：复制佐证材料失败 - ${sourceMaterial.name}: ${insertErr.message}`);
        } else {
          console.log(`  ✓ 复制：${sourceMaterial.code} ${sourceMaterial.name} -> 指标 ${indicatorCode}`);
          copiedCount++;
        }
      }
    }

    console.log('\n========================================');
    console.log('恢复完成');
    console.log('========================================');
    console.log(`复制的佐证材料数: ${copiedCount}`);
    console.log(`跳过的佐证材料数: ${skippedCount}`);
    console.log('========================================\n');

  } catch (error) {
    console.error('恢复过程出错:', error.message);
    process.exit(1);
  }

  process.exit(0);
}

// 从命令行参数获取项目ID
const projectId = process.argv[2];
restoreSupportingMaterials(projectId);
