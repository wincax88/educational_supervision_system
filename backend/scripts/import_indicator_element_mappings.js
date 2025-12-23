/**
 * Import indicator-element mappings (dataIndicator.code -> element.code) into DB table `data_indicator_elements`.
 *
 * Source of truth:
 * - `doc/义务教育优质均衡要素列表.json` top-level `indicatorElementMappings`
 *
 * Why:
 * - UI "auto link" by name is heuristic and unstable.
 * - This script performs deterministic linking by codes, then persists to DB.
 *
 * Usage:
 *   node backend/scripts/import_indicator_element_mappings.js --system-id 1 --library-id <elementLibraryId> --dry-run
 *   node backend/scripts/import_indicator_element_mappings.js --system-id 1 --library-id <elementLibraryId> --apply --force
 *
 * Notes:
 * - By default it ONLY replaces existing `mapping_type='primary'` rows for each mapped data_indicator_id.
 * - It leaves `mapping_type='reference'` rows untouched.
 */
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const db = require('../database/db');

function nowIso() {
  return new Date().toISOString();
}

function usageAndExit(code = 1, msg) {
  if (msg) console.error(msg);
  console.error(`
Usage:
  node backend/scripts/import_indicator_element_mappings.js \\
    --system-id <indicatorSystemId> \\
    --library-id <elementLibraryId> \\
    [--source <pathToElementLibraryJson>] \\
    [--apply] [--dry-run] [--force]

Examples:
  node backend/scripts/import_indicator_element_mappings.js --system-id 1 --library-id <LIB_ID> --dry-run
  node backend/scripts/import_indicator_element_mappings.js --system-id 1 --library-id <LIB_ID> --apply --force

Flags:
  --system-id   Required. 指标体系 ID（indicator_systems.id）。
  --library-id  Required. 要素库 ID（element_libraries.id），用于避免 elements.code 跨库歧义。
  --source      Optional. Defaults to repo doc/义务教育优质均衡要素列表.json
  --dry-run     Optional. Default true if --apply not provided. Only validate and print actions.
  --apply       Optional. Actually write to DB.
  --force       Optional. If existing primary mapping differs, overwrite it. Without this, conflicts abort.
`);
  process.exit(code);
}

function parseArgs(argv) {
  const args = {
    systemId: null,
    libraryId: null,
    source: null,
    apply: false,
    dryRun: true,
    force: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--system-id') args.systemId = argv[++i];
    else if (a === '--library-id') args.libraryId = argv[++i];
    else if (a === '--source') args.source = argv[++i];
    else if (a === '--apply') args.apply = true;
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--force') args.force = true;
    else if (a === '--help' || a === '-h') usageAndExit(0);
    else usageAndExit(1, `Unknown arg: ${a}`);
  }

  if (args.apply) args.dryRun = false;
  return args;
}

function loadJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

function genId() {
  return `die_${crypto.randomUUID()}`;
}

async function assertSystemExists(systemId) {
  const { data, error } = await db.from('indicator_systems').select('id, name').eq('id', systemId).limit(1);
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error(`indicator_systems not found: ${systemId}`);
  }
  return data[0];
}

async function assertLibraryExists(libraryId) {
  const { data, error } = await db.from('element_libraries').select('id, name').eq('id', libraryId).limit(1);
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error(`element_libraries not found: ${libraryId}`);
  }
  return data[0];
}

async function getDataIndicatorIdsByCode(systemId, codes) {
  // Use SQL via rpc (SELECT only) to avoid relying on PostgREST join syntax.
  // Assumption: data_indicators.code is not globally unique across systems, so we constrain by indicators.system_id.
  const uniq = Array.from(new Set(codes));
  if (uniq.length === 0) return new Map();

  const codeList = uniq.map((_, idx) => `$${idx + 2}`).join(',');
  const sql = `
    SELECT di.id, di.code
    FROM data_indicators di
    JOIN indicators i ON di.indicator_id = i.id
    WHERE i.system_id = $1
      AND di.code IN (${codeList})
  `;
  const result = await db.query(sql, [systemId, ...uniq]);
  const map = new Map();
  (result.rows || []).forEach(r => map.set(r.code, r.id));
  return map;
}

async function getElementIdsByCode(libraryId, codes) {
  const uniq = Array.from(new Set(codes));
  if (uniq.length === 0) return new Map();

  const codeList = uniq.map((_, idx) => `$${idx + 2}`).join(',');
  const sql = `
    SELECT e.id, e.code
    FROM elements e
    WHERE e.library_id = $1
      AND e.code IN (${codeList})
  `;
  const result = await db.query(sql, [libraryId, ...uniq]);
  const map = new Map();
  (result.rows || []).forEach(r => map.set(r.code, r.id));
  return map;
}

async function getExistingPrimaryMappings(systemId) {
  const sql = `
    SELECT di.id as "dataIndicatorId", di.code as "dataIndicatorCode",
           e.id as "elementId", e.code as "elementCode"
    FROM data_indicator_elements die
    JOIN data_indicators di ON die.data_indicator_id = di.id
    JOIN indicators i ON di.indicator_id = i.id
    JOIN elements e ON die.element_id = e.id
    WHERE i.system_id = $1
      AND die.mapping_type = 'primary'
  `;
  const result = await db.query(sql, [systemId]);
  const map = new Map();
  (result.rows || []).forEach(r => map.set(r.dataIndicatorId, r));
  return map;
}

async function deletePrimaryMappingsForDataIndicator(dataIndicatorId) {
  const { error } = await db
    .from('data_indicator_elements')
    .delete()
    .eq('data_indicator_id', dataIndicatorId)
    .eq('mapping_type', 'primary');
  if (error) throw error;
}

async function insertPrimaryMapping({ dataIndicatorId, elementId, createdBy }) {
  const ts = nowIso();
  const record = {
    id: genId(),
    data_indicator_id: dataIndicatorId,
    element_id: elementId,
    mapping_type: 'primary',
    description: '',
    created_by: createdBy || 'import-script',
    created_at: ts,
    updated_at: ts,
  };
  const { error } = await db.from('data_indicator_elements').insert(record);
  if (error) throw error;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.systemId) usageAndExit(1, 'Missing --system-id');
  if (!args.libraryId) usageAndExit(1, 'Missing --library-id');

  const defaultSource = path.resolve(__dirname, '../../doc/义务教育优质均衡要素列表.json');
  const sourcePath = args.source ? path.resolve(process.cwd(), args.source) : defaultSource;

  const system = await assertSystemExists(args.systemId);
  const library = await assertLibraryExists(args.libraryId);

  const doc = loadJson(sourcePath);
  const indicatorElementMappings = doc && doc.indicatorElementMappings;
  if (!indicatorElementMappings || typeof indicatorElementMappings !== 'object') {
    throw new Error(`No top-level indicatorElementMappings found in ${sourcePath}`);
  }

  // Support both nested structure (indicatorElementMappings.dataIndicators) and flat structure
  const mappings = indicatorElementMappings.dataIndicators || indicatorElementMappings;
  if (!mappings || typeof mappings !== 'object') {
    throw new Error(`No dataIndicators mappings found in indicatorElementMappings`);
  }

  const mappingEntries = Object.entries(mappings)
    .filter(([k, v]) => typeof k === 'string' && typeof v === 'string')
    .map(([dataIndicatorCode, elementCode]) => ({ dataIndicatorCode, elementCode }));

  if (mappingEntries.length === 0) {
    console.log('No mappings to import (indicatorElementMappings is empty).');
    return;
  }

  // Resolve IDs
  const diCodeList = mappingEntries.map(m => m.dataIndicatorCode);
  const elCodeList = mappingEntries.map(m => m.elementCode);

  const [diIdByCode, elIdByCode, existingPrimaryByDiId] = await Promise.all([
    getDataIndicatorIdsByCode(args.systemId, diCodeList),
    getElementIdsByCode(args.libraryId, elCodeList),
    getExistingPrimaryMappings(args.systemId),
  ]);

  const missingDataIndicators = [];
  const missingElements = [];
  const resolved = [];

  for (const m of mappingEntries) {
    const diId = diIdByCode.get(m.dataIndicatorCode);
    const elId = elIdByCode.get(m.elementCode);
    if (!diId) missingDataIndicators.push(m.dataIndicatorCode);
    if (!elId) missingElements.push(m.elementCode);
    if (diId && elId) resolved.push({ ...m, dataIndicatorId: diId, elementId: elId });
  }

  if (missingDataIndicators.length > 0) {
    throw new Error(
      `Missing data_indicators in system ${args.systemId}: ${Array.from(new Set(missingDataIndicators)).join(', ')}`
    );
  }
  if (missingElements.length > 0) {
    throw new Error(
      `Missing elements in library ${args.libraryId}: ${Array.from(new Set(missingElements)).join(', ')}`
    );
  }

  // Compute actions & conflicts
  let toInsert = 0;
  let toReplace = 0;
  let skippedSame = 0;
  const conflicts = [];

  for (const r of resolved) {
    const existing = existingPrimaryByDiId.get(r.dataIndicatorId);
    if (!existing) {
      toInsert++;
      continue;
    }
    if (existing.elementId === r.elementId) {
      skippedSame++;
      continue;
    }
    // conflict: same di already has different primary element
    toReplace++;
    conflicts.push({
      dataIndicatorCode: r.dataIndicatorCode,
      dataIndicatorId: r.dataIndicatorId,
      currentElementCode: existing.elementCode,
      desiredElementCode: r.elementCode,
    });
  }

  console.log(`Source: ${sourcePath}`);
  console.log(`Indicator system: ${system.id} (${system.name})`);
  console.log(`Element library:  ${library.id} (${library.name})`);
  console.log(`Mappings in file: ${mappingEntries.length}`);
  console.log(`Resolved:         ${resolved.length}`);
  console.log(`Will insert:      ${toInsert}`);
  console.log(`Will replace:     ${toReplace}`);
  console.log(`Skip (same):      ${skippedSame}`);
  console.log(`Mode:             ${args.dryRun ? 'DRY-RUN' : 'APPLY'}`);

  if (conflicts.length > 0 && !args.force) {
    console.error('\nConflicts detected (existing primary mapping differs). Use --force to overwrite:');
    conflicts.slice(0, 50).forEach(c => {
      console.error(`- ${c.dataIndicatorCode}: ${c.currentElementCode} -> ${c.desiredElementCode}`);
    });
    if (conflicts.length > 50) console.error(`... and ${conflicts.length - 50} more`);
    process.exit(2);
  }

  if (args.dryRun) return;

  const createdBy = process.env.IMPORT_CREATED_BY || 'import-script';
  let applied = 0;

  for (const r of resolved) {
    const existing = existingPrimaryByDiId.get(r.dataIndicatorId);
    if (existing && existing.elementId === r.elementId) continue;

    // Replace primary mapping(s) for this data indicator
    await deletePrimaryMappingsForDataIndicator(r.dataIndicatorId);
    await insertPrimaryMapping({
      dataIndicatorId: r.dataIndicatorId,
      elementId: r.elementId,
      createdBy,
    });
    applied++;
  }

  console.log(`\nDone. Updated primary mappings for ${applied} data indicators.`);
}

main().catch(err => {
  console.error('[import_indicator_element_mappings] failed:', err.message);
  process.exit(1);
});


