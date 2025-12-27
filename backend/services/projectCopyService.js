/**
 * 项目模板复制服务
 * 将指标体系、要素库、采集工具从模板复制到项目级副本
 */

const db = require('../database/db');

// 生成唯一ID
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);

// 获取当前时间
const now = () => new Date().toISOString();

/**
 * 复制指标体系到项目
 * @param {string} projectId - 项目ID
 * @param {string} sourceSystemId - 源指标体系ID
 * @returns {Promise<object>} 复制后的项目指标体系
 */
async function copyIndicatorSystemToProject(projectId, sourceSystemId) {
  // 1. 获取源指标体系
  const { data: sourceSystem, error: sysErr } = await db.from('indicator_systems')
    .select('*')
    .eq('id', sourceSystemId)
    .single();

  if (sysErr || !sourceSystem) {
    throw new Error(`指标体系不存在: ${sourceSystemId}`);
  }

  // 2. 检查项目是否已有指标体系副本
  const { data: existing } = await db.from('project_indicator_systems')
    .select('id')
    .eq('project_id', projectId)
    .single();

  if (existing) {
    throw new Error('项目已存在指标体系副本，请先删除后再复制');
  }

  const timestamp = now();
  const newSystemId = generateId();

  // 3. 创建项目指标体系
  const { error: insertErr } = await db.from('project_indicator_systems').insert({
    id: newSystemId,
    project_id: projectId,
    name: sourceSystem.name,
    type: sourceSystem.type,
    target: sourceSystem.target,
    description: sourceSystem.description,
    tags: sourceSystem.tags,
    attachments: sourceSystem.attachments,
    indicator_count: sourceSystem.indicator_count || 0,
    created_at: timestamp,
    updated_at: timestamp
  });

  if (insertErr) {
    throw new Error(`创建项目指标体系失败: ${insertErr.message}`);
  }

  // 4. 复制指标树
  const indicatorIdMap = await deepCopyIndicators(projectId, newSystemId, sourceSystemId);

  // 5. 复制数据指标
  const dataIndicatorIdMap = await deepCopyDataIndicators(projectId, indicatorIdMap);

  // 6. 复制阈值标准
  await deepCopyThresholdStandards(projectId, dataIndicatorIdMap);

  // 7. 复制佐证资料
  const supportingMaterialIdMap = await deepCopySupportingMaterials(projectId, indicatorIdMap);

  return {
    id: newSystemId,
    name: sourceSystem.name,
    indicatorCount: Object.keys(indicatorIdMap).length,
    dataIndicatorCount: Object.keys(dataIndicatorIdMap).length,
    supportingMaterialCount: Object.keys(supportingMaterialIdMap).length
  };
}

/**
 * 深拷贝指标树
 * @param {string} projectId - 项目ID
 * @param {string} newSystemId - 新指标体系ID
 * @param {string} sourceSystemId - 源指标体系ID
 * @returns {Promise<object>} 旧ID到新ID的映射
 */
async function deepCopyIndicators(projectId, newSystemId, sourceSystemId) {
  // 获取源指标
  const { data: sourceIndicators, error } = await db.from('indicators')
    .select('*')
    .eq('system_id', sourceSystemId)
    .order('level', { ascending: true })
    .order('sort_order', { ascending: true });

  if (error) {
    throw new Error(`获取源指标失败: ${error.message}`);
  }

  if (!sourceIndicators || sourceIndicators.length === 0) {
    return {};
  }

  const timestamp = now();
  const idMap = {}; // 旧ID -> 新ID

  // 按层级顺序处理，确保父节点先创建
  for (const indicator of sourceIndicators) {
    const newId = generateId();
    idMap[indicator.id] = newId;

    const newIndicator = {
      id: newId,
      project_id: projectId,
      system_id: newSystemId,
      parent_id: indicator.parent_id ? idMap[indicator.parent_id] : null,
      code: indicator.code,
      name: indicator.name,
      description: indicator.description,
      level: indicator.level,
      is_leaf: indicator.is_leaf,
      weight: indicator.weight,
      sort_order: indicator.sort_order,
      created_at: timestamp,
      updated_at: timestamp
    };

    const { error: insertErr } = await db.from('project_indicators').insert(newIndicator);
    if (insertErr) {
      throw new Error(`复制指标失败: ${insertErr.message}`);
    }
  }

  return idMap;
}

/**
 * 深拷贝数据指标
 * @param {string} projectId - 项目ID
 * @param {object} indicatorIdMap - 指标ID映射
 * @returns {Promise<object>} 数据指标ID映射
 */
async function deepCopyDataIndicators(projectId, indicatorIdMap) {
  const oldIndicatorIds = Object.keys(indicatorIdMap);
  if (oldIndicatorIds.length === 0) {
    return {};
  }

  // 获取源数据指标
  const { data: sourceDataIndicators, error } = await db.from('data_indicators')
    .select('*')
    .in('indicator_id', oldIndicatorIds)
    .order('sort_order', { ascending: true });

  if (error) {
    throw new Error(`获取源数据指标失败: ${error.message}`);
  }

  if (!sourceDataIndicators || sourceDataIndicators.length === 0) {
    return {};
  }

  const timestamp = now();
  const idMap = {}; // 旧ID -> 新ID

  for (const dataIndicator of sourceDataIndicators) {
    const newId = generateId();
    idMap[dataIndicator.id] = newId;

    const newDataIndicator = {
      id: newId,
      project_id: projectId,
      indicator_id: indicatorIdMap[dataIndicator.indicator_id],
      code: dataIndicator.code,
      name: dataIndicator.name,
      threshold: dataIndicator.threshold,
      data_type: dataIndicator.data_type,
      unit: dataIndicator.unit,
      description: dataIndicator.description,
      data_source: dataIndicator.data_source,
      calculation_method: dataIndicator.calculation_method,
      collection_frequency: dataIndicator.collection_frequency,
      sort_order: dataIndicator.sort_order,
      created_at: timestamp,
      updated_at: timestamp
    };

    const { error: insertErr } = await db.from('project_data_indicators').insert(newDataIndicator);
    if (insertErr) {
      throw new Error(`复制数据指标失败: ${insertErr.message}`);
    }
  }

  return idMap;
}

/**
 * 深拷贝阈值标准
 * @param {string} projectId - 项目ID
 * @param {object} dataIndicatorIdMap - 数据指标ID映射
 */
async function deepCopyThresholdStandards(projectId, dataIndicatorIdMap) {
  const oldDataIndicatorIds = Object.keys(dataIndicatorIdMap);
  if (oldDataIndicatorIds.length === 0) {
    return;
  }

  // 获取源阈值标准
  const { data: sourceThresholds, error } = await db.from('threshold_standards')
    .select('*')
    .in('indicator_id', oldDataIndicatorIds);

  if (error) {
    throw new Error(`获取源阈值标准失败: ${error.message}`);
  }

  if (!sourceThresholds || sourceThresholds.length === 0) {
    return;
  }

  const timestamp = now();

  for (const threshold of sourceThresholds) {
    const newThreshold = {
      id: generateId(),
      project_id: projectId,
      indicator_id: dataIndicatorIdMap[threshold.indicator_id],
      institution_type: threshold.institution_type,
      threshold_operator: threshold.threshold_operator,
      threshold_value: threshold.threshold_value,
      unit: threshold.unit,
      source: threshold.source,
      effective_date: threshold.effective_date,
      expiry_date: threshold.expiry_date,
      created_at: timestamp,
      updated_at: timestamp
    };

    const { error: insertErr } = await db.from('project_threshold_standards').insert(newThreshold);
    if (insertErr) {
      throw new Error(`复制阈值标准失败: ${insertErr.message}`);
    }
  }
}

/**
 * 深拷贝佐证资料配置
 * @param {string} projectId - 项目ID
 * @param {object} indicatorIdMap - 指标ID映射
 * @returns {Promise<object>} 佐证资料ID映射
 */
async function deepCopySupportingMaterials(projectId, indicatorIdMap) {
  const oldIndicatorIds = Object.keys(indicatorIdMap);
  if (oldIndicatorIds.length === 0) {
    return {};
  }

  // 获取源佐证资料
  const { data: sourceMaterials, error } = await db.from('supporting_materials')
    .select('*')
    .in('indicator_id', oldIndicatorIds)
    .order('sort_order', { ascending: true });

  if (error) {
    throw new Error(`获取源佐证资料失败: ${error.message}`);
  }

  if (!sourceMaterials || sourceMaterials.length === 0) {
    return {};
  }

  const timestamp = now();
  const idMap = {}; // 旧ID -> 新ID

  for (const material of sourceMaterials) {
    const newId = generateId();
    idMap[material.id] = newId;

    const newMaterial = {
      id: newId,
      project_id: projectId,
      indicator_id: indicatorIdMap[material.indicator_id],
      code: material.code,
      name: material.name,
      file_types: material.file_types,
      max_size: material.max_size,
      required: material.required,
      description: material.description,
      sort_order: material.sort_order,
      created_at: timestamp,
      updated_at: timestamp
    };

    const { error: insertErr } = await db.from('project_supporting_materials').insert(newMaterial);
    if (insertErr) {
      throw new Error(`复制佐证资料失败: ${insertErr.message}`);
    }
  }

  return idMap;
}

/**
 * 复制要素库到项目
 * @param {string} projectId - 项目ID
 * @param {string} sourceLibraryId - 源要素库ID
 * @returns {Promise<object>} 复制后的项目要素库
 */
async function copyElementLibraryToProject(projectId, sourceLibraryId) {
  // 1. 获取源要素库
  const { data: sourceLibrary, error: libErr } = await db.from('element_libraries')
    .select('*')
    .eq('id', sourceLibraryId)
    .single();

  if (libErr || !sourceLibrary) {
    throw new Error(`要素库不存在: ${sourceLibraryId}`);
  }

  // 2. 检查项目是否已有要素库副本
  const { data: existing } = await db.from('project_element_libraries')
    .select('id')
    .eq('project_id', projectId)
    .single();

  if (existing) {
    throw new Error('项目已存在要素库副本，请先删除后再复制');
  }

  const timestamp = now();
  const newLibraryId = generateId();

  // 3. 创建项目要素库
  const { error: insertErr } = await db.from('project_element_libraries').insert({
    id: newLibraryId,
    project_id: projectId,
    name: sourceLibrary.name,
    description: sourceLibrary.description,
    element_count: sourceLibrary.element_count || 0,
    created_at: timestamp,
    updated_at: timestamp
  });

  if (insertErr) {
    throw new Error(`创建项目要素库失败: ${insertErr.message}`);
  }

  // 4. 复制要素
  const elementIdMap = await deepCopyElements(projectId, newLibraryId, sourceLibraryId);

  return {
    id: newLibraryId,
    name: sourceLibrary.name,
    elementCount: Object.keys(elementIdMap).length,
    elementIdMap // 返回映射，供后续关联使用
  };
}

/**
 * 深拷贝要素
 * @param {string} projectId - 项目ID
 * @param {string} newLibraryId - 新要素库ID
 * @param {string} sourceLibraryId - 源要素库ID
 * @returns {Promise<object>} 要素ID映射
 */
async function deepCopyElements(projectId, newLibraryId, sourceLibraryId) {
  // 获取源要素
  const { data: sourceElements, error } = await db.from('elements')
    .select('*')
    .eq('library_id', sourceLibraryId)
    .order('sort_order', { ascending: true });

  if (error) {
    throw new Error(`获取源要素失败: ${error.message}`);
  }

  if (!sourceElements || sourceElements.length === 0) {
    return {};
  }

  const timestamp = now();
  const idMap = {}; // 旧ID -> 新ID

  for (const element of sourceElements) {
    const newId = generateId();
    idMap[element.id] = newId;

    const newElement = {
      id: newId,
      project_id: projectId,
      library_id: newLibraryId,
      code: element.code,
      name: element.name,
      element_type: element.element_type,
      data_type: element.data_type,
      tool_id: null, // 工具关联需要后续重新映射
      field_id: element.field_id,
      field_label: element.field_label,
      formula: element.formula,
      collection_level: element.collection_level,
      calculation_level: element.calculation_level,
      data_source: element.data_source,
      aggregation: element.aggregation,
      sort_order: element.sort_order,
      created_at: timestamp,
      updated_at: timestamp
    };

    const { error: insertErr } = await db.from('project_elements').insert(newElement);
    if (insertErr) {
      throw new Error(`复制要素失败: ${insertErr.message}`);
    }
  }

  return idMap;
}

/**
 * 复制采集工具到项目
 * @param {string} projectId - 项目ID
 * @param {string} sourceToolId - 源采集工具ID
 * @returns {Promise<object>} 复制后的项目采集工具
 */
async function copyDataToolToProject(projectId, sourceToolId) {
  // 1. 获取源采集工具
  const { data: sourceTool, error: toolErr } = await db.from('data_tools')
    .select('*')
    .eq('id', sourceToolId)
    .single();

  if (toolErr || !sourceTool) {
    throw new Error(`采集工具不存在: ${sourceToolId}`);
  }

  const timestamp = now();
  const newToolId = generateId();

  // 2. 创建项目采集工具
  const { error: insertErr } = await db.from('project_data_tools').insert({
    id: newToolId,
    project_id: projectId,
    source_tool_id: sourceToolId, // 记录来源模板工具ID
    name: sourceTool.name,
    type: sourceTool.type,
    target: sourceTool.target,
    description: sourceTool.description,
    schema: sourceTool.schema,
    status: 'draft', // 副本初始状态为草稿
    sort_order: 0,
    is_required: 1,
    require_review: 1,
    created_at: timestamp,
    updated_at: timestamp
  });

  if (insertErr) {
    throw new Error(`创建项目采集工具失败: ${insertErr.message}`);
  }

  // 3. 复制字段映射（暂不关联到项目数据指标/要素，需要后续手动映射）
  await deepCopyFieldMappings(projectId, newToolId, sourceToolId);

  return {
    id: newToolId,
    name: sourceTool.name,
    type: sourceTool.type,
    sourceToolId: sourceToolId
  };
}

/**
 * 深拷贝字段映射
 * @param {string} projectId - 项目ID
 * @param {string} newToolId - 新工具ID
 * @param {string} sourceToolId - 源工具ID
 */
async function deepCopyFieldMappings(projectId, newToolId, sourceToolId) {
  // 获取源字段映射
  const { data: sourceMappings, error } = await db.from('field_mappings')
    .select('*')
    .eq('tool_id', sourceToolId);

  if (error) {
    throw new Error(`获取源字段映射失败: ${error.message}`);
  }

  if (!sourceMappings || sourceMappings.length === 0) {
    return;
  }

  const timestamp = now();

  for (const mapping of sourceMappings) {
    const newMapping = {
      id: generateId(),
      project_id: projectId,
      tool_id: newToolId,
      field_id: mapping.field_id,
      field_label: mapping.field_label,
      mapping_type: mapping.mapping_type,
      target_id: null, // 目标需要重新映射到项目级数据指标/要素
      created_at: timestamp,
      updated_at: timestamp
    };

    const { error: insertErr } = await db.from('project_field_mappings').insert(newMapping);
    if (insertErr) {
      throw new Error(`复制字段映射失败: ${insertErr.message}`);
    }
  }
}

/**
 * 复制数据指标-要素关联到项目
 * @param {string} projectId - 项目ID
 * @param {object} dataIndicatorIdMap - 数据指标ID映射
 * @param {object} elementIdMap - 要素ID映射
 */
async function copyDataIndicatorElementsToProject(projectId, dataIndicatorIdMap, elementIdMap) {
  const oldDataIndicatorIds = Object.keys(dataIndicatorIdMap);
  if (oldDataIndicatorIds.length === 0) {
    return;
  }

  // 获取源关联
  const { data: sourceAssociations, error } = await db.from('data_indicator_elements')
    .select('*')
    .in('data_indicator_id', oldDataIndicatorIds);

  if (error) {
    throw new Error(`获取源数据指标-要素关联失败: ${error.message}`);
  }

  if (!sourceAssociations || sourceAssociations.length === 0) {
    return;
  }

  const timestamp = now();

  for (const assoc of sourceAssociations) {
    // 只复制在要素映射中存在的关联
    if (!elementIdMap[assoc.element_id]) {
      continue;
    }

    const newAssoc = {
      id: generateId(),
      project_id: projectId,
      data_indicator_id: dataIndicatorIdMap[assoc.data_indicator_id],
      element_id: elementIdMap[assoc.element_id],
      mapping_type: assoc.mapping_type,
      description: assoc.description,
      created_at: timestamp,
      updated_at: timestamp
    };

    const { error: insertErr } = await db.from('project_data_indicator_elements').insert(newAssoc);
    if (insertErr) {
      // 忽略重复错误
      if (!insertErr.message.includes('duplicate')) {
        throw new Error(`复制数据指标-要素关联失败: ${insertErr.message}`);
      }
    }
  }
}

/**
 * 复制佐证资料-要素关联到项目
 * @param {string} projectId - 项目ID
 * @param {object} supportingMaterialIdMap - 佐证资料ID映射
 * @param {object} elementIdMap - 要素ID映射
 */
async function copySupportingMaterialElementsToProject(projectId, supportingMaterialIdMap, elementIdMap) {
  const oldMaterialIds = Object.keys(supportingMaterialIdMap);
  if (oldMaterialIds.length === 0) {
    return;
  }

  // 获取源关联
  const { data: sourceAssociations, error } = await db.from('supporting_material_elements')
    .select('*')
    .in('supporting_material_id', oldMaterialIds);

  if (error) {
    throw new Error(`获取源佐证资料-要素关联失败: ${error.message}`);
  }

  if (!sourceAssociations || sourceAssociations.length === 0) {
    return;
  }

  const timestamp = now();

  for (const assoc of sourceAssociations) {
    // 只复制在要素映射中存在的关联
    if (!elementIdMap[assoc.element_id]) {
      continue;
    }

    const newAssoc = {
      id: generateId(),
      project_id: projectId,
      supporting_material_id: supportingMaterialIdMap[assoc.supporting_material_id],
      element_id: elementIdMap[assoc.element_id],
      mapping_type: assoc.mapping_type,
      description: assoc.description,
      created_at: timestamp,
      updated_at: timestamp
    };

    const { error: insertErr } = await db.from('project_supporting_material_elements').insert(newAssoc);
    if (insertErr) {
      // 忽略重复错误
      if (!insertErr.message.includes('duplicate')) {
        throw new Error(`复制佐证资料-要素关联失败: ${insertErr.message}`);
      }
    }
  }
}

/**
 * 一键复制所有模板到项目
 * @param {string} projectId - 项目ID
 * @param {object} options - 选项
 * @param {string} options.indicatorSystemId - 指标体系ID
 * @param {string} options.elementLibraryId - 要素库ID
 * @param {string[]} options.toolIds - 采集工具ID列表
 * @returns {Promise<object>} 复制结果
 */
async function copyTemplatesToProject(projectId, options = {}) {
  const { indicatorSystemId, elementLibraryId, toolIds } = options;
  const result = {
    indicatorSystem: null,
    elementLibrary: null,
    tools: [],
    associations: {
      dataIndicatorElements: 0,
      supportingMaterialElements: 0
    }
  };

  let dataIndicatorIdMap = {};
  let supportingMaterialIdMap = {};
  let elementIdMap = {};

  // 1. 复制指标体系
  if (indicatorSystemId) {
    const systemResult = await copyIndicatorSystemToProject(projectId, indicatorSystemId);
    result.indicatorSystem = systemResult;

    // 获取数据指标映射（需要重新查询）
    const { data: oldDataIndicators } = await db.from('data_indicators')
      .select('id')
      .in('indicator_id', Object.keys(systemResult.indicatorIdMap || {}));

    const { data: newDataIndicators } = await db.from('project_data_indicators')
      .select('id, code')
      .eq('project_id', projectId);

    // 建立映射（通过 code 匹配）
    if (oldDataIndicators && newDataIndicators) {
      // 这里简化处理，实际应该保存 ID 映射
    }
  }

  // 2. 复制要素库
  if (elementLibraryId) {
    const libraryResult = await copyElementLibraryToProject(projectId, elementLibraryId);
    result.elementLibrary = libraryResult;
    elementIdMap = libraryResult.elementIdMap || {};
  }

  // 3. 复制采集工具
  if (toolIds && toolIds.length > 0) {
    for (const toolId of toolIds) {
      try {
        const toolResult = await copyDataToolToProject(projectId, toolId);
        result.tools.push(toolResult);
      } catch (err) {
        console.error(`复制工具 ${toolId} 失败:`, err.message);
        result.tools.push({ id: null, sourceToolId: toolId, error: err.message });
      }
    }
  }

  // 4. 复制关联关系（如果同时复制了指标体系和要素库）
  if (Object.keys(dataIndicatorIdMap).length > 0 && Object.keys(elementIdMap).length > 0) {
    await copyDataIndicatorElementsToProject(projectId, dataIndicatorIdMap, elementIdMap);
  }

  if (Object.keys(supportingMaterialIdMap).length > 0 && Object.keys(elementIdMap).length > 0) {
    await copySupportingMaterialElementsToProject(projectId, supportingMaterialIdMap, elementIdMap);
  }

  return result;
}

/**
 * 删除项目的指标体系副本
 * @param {string} projectId - 项目ID
 */
async function deleteProjectIndicatorSystem(projectId) {
  // 1. 删除关联
  await db.from('project_data_indicator_elements').delete().eq('project_id', projectId);
  await db.from('project_supporting_material_elements').delete().eq('project_id', projectId);

  // 2. 删除阈值标准
  await db.from('project_threshold_standards').delete().eq('project_id', projectId);

  // 3. 删除佐证资料
  await db.from('project_supporting_materials').delete().eq('project_id', projectId);

  // 4. 删除数据指标
  await db.from('project_data_indicators').delete().eq('project_id', projectId);

  // 5. 删除指标
  await db.from('project_indicators').delete().eq('project_id', projectId);

  // 6. 删除指标体系
  await db.from('project_indicator_systems').delete().eq('project_id', projectId);
}

/**
 * 删除项目的要素库副本
 * @param {string} projectId - 项目ID
 */
async function deleteProjectElementLibrary(projectId) {
  // 1. 删除关联
  await db.from('project_data_indicator_elements').delete().eq('project_id', projectId);
  await db.from('project_supporting_material_elements').delete().eq('project_id', projectId);

  // 2. 删除要素
  await db.from('project_elements').delete().eq('project_id', projectId);

  // 3. 删除要素库
  await db.from('project_element_libraries').delete().eq('project_id', projectId);
}

/**
 * 删除项目的采集工具副本
 * @param {string} projectId - 项目ID
 * @param {string} toolId - 工具ID（可选，不传则删除所有）
 */
async function deleteProjectDataTools(projectId, toolId = null) {
  let query = db.from('project_field_mappings').delete().eq('project_id', projectId);
  if (toolId) {
    query = query.eq('tool_id', toolId);
  }
  await query;

  query = db.from('project_data_tools').delete().eq('project_id', projectId);
  if (toolId) {
    query = query.eq('id', toolId);
  }
  await query;
}

/**
 * 根据来源工具ID删除项目采集工具副本
 * @param {string} projectId - 项目ID
 * @param {string} sourceToolId - 来源模板工具ID
 */
async function deleteProjectDataToolBySourceId(projectId, sourceToolId) {
  // 先查找对应的项目工具副本
  const { data: tools, error: findErr } = await db.from('project_data_tools')
    .select('id')
    .eq('project_id', projectId)
    .eq('source_tool_id', sourceToolId);

  if (findErr) {
    throw new Error(`查找项目工具副本失败: ${findErr.message}`);
  }

  if (!tools || tools.length === 0) {
    return; // 没有找到对应的副本，可能还没复制过
  }

  // 删除字段映射和工具副本
  for (const tool of tools) {
    await db.from('project_field_mappings').delete()
      .eq('project_id', projectId)
      .eq('tool_id', tool.id);

    await db.from('project_data_tools').delete()
      .eq('id', tool.id);
  }
}

module.exports = {
  copyIndicatorSystemToProject,
  copyElementLibraryToProject,
  copyDataToolToProject,
  copyTemplatesToProject,
  copyDataIndicatorElementsToProject,
  copySupportingMaterialElementsToProject,
  deleteProjectIndicatorSystem,
  deleteProjectElementLibrary,
  deleteProjectDataTools,
  deleteProjectDataToolBySourceId
};
