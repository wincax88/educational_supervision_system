/**
 * 佐证材料数据诊断脚本
 *
 * 用于检查：
 * 1. 模板表 supporting_materials 中的数据
 * 2. 项目表 project_supporting_materials 中的数据
 * 3. 指标体系与佐证材料的对应关系
 *
 * 使用方法：
 * node backend/scripts/check-supporting-materials.js [systemId] [projectId]
 */

require('dotenv').config();

const db = require('../database/db');

async function main() {
  const args = process.argv.slice(2);
  const systemId = args[0];
  const projectId = args[1];

  console.log('\n========================================');
  console.log('佐证材料数据诊断工具');
  console.log('========================================\n');

  try {
    // 1. 检查所有指标体系
    console.log('📋 指标体系列表：\n');
    const { data: systems, error: sysErr } = await db.from('indicator_systems')
      .select('id, name, type, indicator_count')
      .order('created_at', { ascending: false });

    if (sysErr) {
      console.error('查询指标体系失败:', sysErr.message);
      return;
    }

    if (!systems || systems.length === 0) {
      console.log('暂无指标体系');
      return;
    }

    console.log('ID\t\t\t\t\t指标数\t类型\t\t名称');
    console.log('-'.repeat(100));
    systems.forEach(sys => {
      console.log(`${sys.id}\t${sys.indicator_count || 0}\t${sys.type || '-'}\t\t${sys.name}`);
    });

    // 2. 检查模板表中的佐证材料总数
    console.log('\n📊 模板佐证材料统计：\n');
    const { data: templateMaterials, error: tmErr } = await db.from('supporting_materials')
      .select('id, indicator_id, name');

    if (tmErr) {
      console.error('查询模板佐证材料失败:', tmErr.message);
    } else {
      console.log(`模板表 supporting_materials 总记录数: ${templateMaterials?.length || 0}`);
    }

    // 3. 按指标体系统计佐证材料
    console.log('\n📈 各指标体系的佐证材料数量：\n');

    for (const sys of systems) {
      // 获取该体系下所有指标
      const { data: indicators } = await db.from('indicators')
        .select('id')
        .eq('system_id', sys.id);

      const indicatorIds = (indicators || []).map(i => i.id);

      if (indicatorIds.length === 0) {
        console.log(`  ${sys.name}: 0 个指标, 0 个佐证材料`);
        continue;
      }

      // 获取这些指标的佐证材料
      const { data: materials } = await db.from('supporting_materials')
        .select('id, name, indicator_id')
        .in('indicator_id', indicatorIds);

      console.log(`  ${sys.name}:`);
      console.log(`    - 指标数: ${indicatorIds.length}`);
      console.log(`    - 佐证材料数: ${materials?.length || 0}`);

      // 如果指定了 systemId，显示详细信息
      if (systemId && sys.id === systemId && materials && materials.length > 0) {
        console.log('    - 佐证材料列表:');
        materials.forEach(m => {
          console.log(`      * ${m.name} (ID: ${m.id})`);
        });
      }
    }

    // 4. 检查项目级佐证材料
    console.log('\n📁 项目级佐证材料统计：\n');

    // 获取所有项目
    const { data: projects, error: projErr } = await db.from('projects')
      .select('id, name, status')
      .order('created_at', { ascending: false })
      .limit(10);

    if (projErr) {
      console.error('查询项目失败:', projErr.message);
    } else if (!projects || projects.length === 0) {
      console.log('暂无项目');
    } else {
      console.log('最近 10 个项目的佐证材料情况：\n');

      for (const proj of projects) {
        // 获取项目级佐证材料
        const { data: projMaterials } = await db.from('project_supporting_materials')
          .select('id, name')
          .eq('project_id', proj.id);

        // 获取项目级数据指标
        const { data: projDataIndicators } = await db.from('project_data_indicators')
          .select('id')
          .eq('project_id', proj.id);

        console.log(`  ${proj.name} (${proj.status || '未知状态'}):`);
        console.log(`    - 数据指标数: ${projDataIndicators?.length || 0}`);
        console.log(`    - 佐证材料数: ${projMaterials?.length || 0}`);

        // 如果指定了 projectId，显示详细信息
        if (projectId && proj.id === projectId && projMaterials && projMaterials.length > 0) {
          console.log('    - 佐证材料列表:');
          projMaterials.forEach(m => {
            console.log(`      * ${m.name} (ID: ${m.id})`);
          });
        }
      }
    }

    // 5. 检查特定指标体系（如果指定）
    if (systemId) {
      console.log(`\n🔍 指定指标体系详细检查 (ID: ${systemId})：\n`);

      const { data: targetSystem } = await db.from('indicator_systems')
        .select('*')
        .eq('id', systemId)
        .single();

      if (!targetSystem) {
        console.log('未找到指定的指标体系');
      } else {
        console.log(`指标体系: ${targetSystem.name}`);

        // 获取叶子指标
        const { data: leafIndicators } = await db.from('indicators')
          .select('id, code, name, is_leaf')
          .eq('system_id', systemId)
          .eq('is_leaf', 1);

        console.log(`叶子指标数: ${leafIndicators?.length || 0}`);

        // 检查每个叶子指标的佐证材料
        let hasAnyMaterial = false;
        for (const leaf of (leafIndicators || [])) {
          const { data: leafMaterials } = await db.from('supporting_materials')
            .select('id, code, name')
            .eq('indicator_id', leaf.id);

          if (leafMaterials && leafMaterials.length > 0) {
            hasAnyMaterial = true;
            console.log(`\n  指标 ${leaf.code} ${leaf.name}:`);
            leafMaterials.forEach(m => {
              console.log(`    - ${m.code}: ${m.name}`);
            });
          }
        }

        if (!hasAnyMaterial) {
          console.log('\n⚠️  该指标体系的叶子指标均无佐证材料数据！');
          console.log('这可能是导致项目复制后佐证材料为空的原因。');
        }
      }
    }

    // 6. 检查特定项目（如果指定）
    if (projectId) {
      console.log(`\n🔍 指定项目详细检查 (ID: ${projectId})：\n`);

      const { data: targetProject } = await db.from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (!targetProject) {
        console.log('未找到指定的项目');
      } else {
        console.log(`项目: ${targetProject.name}`);

        // 获取项目指标体系
        const { data: projSystem } = await db.from('project_indicator_systems')
          .select('id, name')
          .eq('project_id', projectId)
          .single();

        if (projSystem) {
          console.log(`项目指标体系: ${projSystem.name}`);

          // 获取项目叶子指标
          const { data: projLeafIndicators } = await db.from('project_indicators')
            .select('id, code, name')
            .eq('project_id', projectId)
            .eq('is_leaf', 1);

          console.log(`项目叶子指标数: ${projLeafIndicators?.length || 0}`);

          // 检查每个叶子指标的佐证材料
          let hasAnyProjMaterial = false;
          for (const leaf of (projLeafIndicators || [])) {
            const { data: leafMaterials } = await db.from('project_supporting_materials')
              .select('id, code, name')
              .eq('indicator_id', leaf.id);

            if (leafMaterials && leafMaterials.length > 0) {
              hasAnyProjMaterial = true;
              console.log(`\n  指标 ${leaf.code} ${leaf.name}:`);
              leafMaterials.forEach(m => {
                console.log(`    - ${m.code}: ${m.name}`);
              });
            }
          }

          if (!hasAnyProjMaterial) {
            console.log('\n⚠️  该项目的叶子指标均无佐证材料数据！');
          }
        } else {
          console.log('项目暂无指标体系');
        }
      }
    }

    console.log('\n========================================');
    console.log('诊断完成');
    console.log('========================================\n');

  } catch (error) {
    console.error('诊断过程出错:', error.message);
  }

  process.exit(0);
}

main();
