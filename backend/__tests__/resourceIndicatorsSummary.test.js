/**
 * 区县管理员工作台 - 资源配置7项指标汇总（resource-indicators-summary）测试
 *
 * 重点覆盖：
 * - 没有 approved submission 时，不应回退成“全 0”；应回退到最新的 submitted/rejected（并带回 submissionStatus）
 * - 完全没有 submission 时，7 项指标应为 null（避免误导）
 */

const request = require('supertest');
const { createApp } = require('../app');

describe('GET /api/districts/:districtId/resource-indicators-summary', () => {
  it('should fallback to latest non-draft submission when approved is missing (e.g. rejected)', async () => {
    const projectId = 'p-001';
    const districtId = 'd-010';

    const formData = {
      primary_student_count: 1200,
      // L1
      primary_college_degree_teacher_count: 10,
      primary_bachelor_degree_teacher_count: 20,
      primary_master_degree_teacher_count: 0,
      primary_doctor_degree_teacher_count: 0,
      // L2
      primary_county_backbone_teacher_count: 15,
      // L3
      primary_pe_teacher_count: 3,
      primary_music_teacher_count: 2,
      primary_art_teacher_count: 1,
      // L4
      primary_teaching_auxiliary_area: 8421.05,
      // L5
      primary_sports_venue_area: 12000,
      // L6（万元）
      primary_teaching_equipment_value: 303.16,
      // L7
      primary_multimedia_classroom_count: 50,
    };

    const db = {
      query: jest.fn(async (sql) => {
        if (sql.includes('FROM districts') && sql.includes('WHERE id = $1')) {
          return { rows: [{ id: districtId, code: '210115', name: '辽中区' }], rowCount: 1 };
        }

        if (sql.includes('FROM schools s') && sql.includes('WHERE s.district_id = $1')) {
          return {
            rows: [{
              id: 's-010',
              code: '2101150002',
              name: '沈阳市辽中区城郊九年一贯制学校',
              schoolType: '九年一贯制',
              studentCount: 800,
              teacherCount: 50,
            }],
            rowCount: 1,
          };
        }

        if (sql.includes('FROM submissions s') && sql.includes("s.status IN ('approved', 'submitted', 'rejected')")) {
          return {
            rows: [{
              form_data: JSON.stringify(formData),
              submission_status: 'rejected',
              submitted_at: '2025-12-18T09:22:51.278Z',
            }],
            rowCount: 1,
          };
        }

        return { rows: [], rowCount: 0 };
      }),
    };

    const app = createApp(db);
    const res = await request(app)
      .get(`/api/districts/${districtId}/resource-indicators-summary?projectId=${projectId}&schoolType=${encodeURIComponent('小学')}`)
      .expect(200);

    expect(res.body.code).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.district.id).toBe(districtId);

    const school = res.body.data.schools[0];
    expect(school).toBeDefined();
    expect(school.id).toBe('s-010');
    expect(school.name).toContain('（小学部）');
    expect(school.submissionStatus).toBe('rejected');
    expect(school.studentCount).toBe(1200); // 应使用 submission 的 primary_student_count，而不是 schools.studentCount=800

    // L4 = 8421.05 / 1200 = 7.0175 -> 7.02
    expect(school.indicators.L4.value).toBe(7.02);
    // L6 = 303.16 * 10000 / 1200 = 2526.333... -> 2526.33
    expect(school.indicators.L6.value).toBe(2526.33);
  });

  it('should return null indicator values when there is no valid submission', async () => {
    const projectId = 'p-001';
    const districtId = 'd-010';

    const db = {
      query: jest.fn(async (sql) => {
        if (sql.includes('FROM districts') && sql.includes('WHERE id = $1')) {
          return { rows: [{ id: districtId, code: '210115', name: '辽中区' }], rowCount: 1 };
        }
        if (sql.includes('FROM schools s') && sql.includes('WHERE s.district_id = $1')) {
          return {
            rows: [{
              id: 's-011',
              code: '2101150003',
              name: '沈阳市辽中区茨榆坨中心小学',
              schoolType: '小学',
              studentCount: 450,
              teacherCount: 30,
            }],
            rowCount: 1,
          };
        }
        if (sql.includes('FROM submissions s') && sql.includes("s.status IN ('approved', 'submitted', 'rejected')")) {
          return { rows: [], rowCount: 0 };
        }
        return { rows: [], rowCount: 0 };
      }),
    };

    const app = createApp(db);
    const res = await request(app)
      .get(`/api/districts/${districtId}/resource-indicators-summary?projectId=${projectId}&schoolType=${encodeURIComponent('小学')}`)
      .expect(200);

    const school = res.body.data.schools[0];
    expect(school.submissionStatus).toBeNull();
    expect(school.indicators.L1.value).toBeNull();
    expect(school.indicators.L7.value).toBeNull();
    expect(school.isOverallCompliant).toBeNull(); // 无有效数据，综合判定应为 pending/null
  });

  it('should append （初中部） for 九年一贯制/完全中学 when schoolType=初中', async () => {
    const projectId = 'p-001';
    const districtId = 'd-010';

    const db = {
      query: jest.fn(async (sql) => {
        if (sql.includes('FROM districts') && sql.includes('WHERE id = $1')) {
          return { rows: [{ id: districtId, code: '210115', name: '辽中区' }], rowCount: 1 };
        }

        if (sql.includes('FROM schools s') && sql.includes('WHERE s.district_id = $1')) {
          return {
            rows: [{
              id: 's-020',
              code: '2101150099',
              name: '某完全中学',
              schoolType: '完全中学',
              studentCount: 1600,
              teacherCount: 100,
            }],
            rowCount: 1,
          };
        }

        if (sql.includes('FROM submissions s') && sql.includes("s.status IN ('approved', 'submitted', 'rejected')")) {
          return {
            rows: [{
              form_data: JSON.stringify({ junior_student_count: 1000, junior_bachelor_degree_teacher_count: 40 }),
              submission_status: 'submitted',
              submitted_at: '2025-12-18T09:22:51.278Z',
            }],
            rowCount: 1,
          };
        }

        return { rows: [], rowCount: 0 };
      }),
    };

    const app = createApp(db);
    const res = await request(app)
      .get(`/api/districts/${districtId}/resource-indicators-summary?projectId=${projectId}&schoolType=${encodeURIComponent('初中')}`)
      .expect(200);

    const school = res.body.data.schools[0];
    expect(school.schoolType).toBe('完全中学');
    expect(school.name).toBe('某完全中学（初中部）');
  });
});


