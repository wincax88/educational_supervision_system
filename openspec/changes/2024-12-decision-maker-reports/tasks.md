# 报告决策者功能 - 实现任务清单

## Phase 1: 报告查看核心功能

### 1.1 后端 API 开发

- [ ] 创建 `backend/src/routes/reports.ts` 路由文件
- [ ] 实现 `GET /api/reports` - 获取报告列表
  - 支持分页、筛选（项目类型、年度、状态）
  - 只返回已完成评估的项目
- [ ] 实现 `GET /api/reports/:projectId` - 获取报告详情
  - 包含项目基本信息
  - 包含指标评估结果
  - 包含区县/学校数据汇总
- [ ] 实现 `GET /api/reports/:projectId/export` - 导出报告
  - 支持 format 参数（pdf/excel）
- [ ] 添加 decision_maker 角色权限校验

### 1.2 前端页面开发

- [ ] 创建 `frontend/src/pages/Reports/` 目录结构
  ```
  Reports/
  ├── index.tsx          # 报告列表页
  ├── Detail/
  │   └── index.tsx      # 报告详情页
  └── components/
      ├── ReportCard.tsx
      └── IndicatorTable.tsx
  ```

- [ ] 实现报告列表页面 `Reports/index.tsx`
  - 筛选条件：项目类型、年度
  - 报告卡片网格展示
  - 点击跳转详情

- [ ] 实现报告详情页面 `Reports/Detail/index.tsx`
  - Tab 切换：概览、指标详情、区县数据、专家意见
  - 导出按钮（PDF/Excel）

### 1.3 路由配置

- [ ] 更新 `frontend/src/App.tsx` 添加报告路由
  ```typescript
  <Route path="reports" element={<ReportList />} />
  <Route path="reports/:projectId" element={<ReportDetail />} />
  ```

- [ ] 确认 ProtectedRoute 权限配置 `canViewReports`

---

## Phase 2: 数据统计与可视化

### 2.1 后端统计 API

- [ ] 实现 `GET /api/reports/statistics` - 统计数据
  - 项目总数、已完成数
  - 整体达标率
  - 各类型项目分布

- [ ] 实现 `GET /api/reports/rankings` - 区县排名
  - 支持按指标筛选
  - 支持排序方式

### 2.2 前端统计页面

- [ ] 创建统计看板页面 `Reports/Statistics/index.tsx`
  - 统计卡片组件
  - 图表展示区域

- [ ] 创建区县排名页面 `Reports/Rankings/index.tsx`
  - 排名表格
  - 指标筛选

### 2.3 可视化组件

- [ ] 集成 ECharts 或 Ant Design Charts
- [ ] 实现雷达图组件 - 多维指标展示
- [ ] 实现柱状图组件 - 达标率对比
- [ ] 实现趋势图组件 - 历年数据对比

---

## Phase 3: 决策辅助功能

### 3.1 预警功能

- [ ] 实现不达标项目预警列表
- [ ] 添加预警通知组件

### 3.2 对比分析

- [ ] 实现历年数据对比功能
- [ ] 实现区县横向对比功能

### 3.3 整改跟踪（可选）

- [ ] 添加问题整改状态查看
- [ ] 整改进度展示

---

## 技术实现细节

### 数据聚合查询示例

```sql
-- 获取项目评估汇总数据
SELECT
  p.id,
  p.name,
  p.type,
  COUNT(DISTINCT d.district_id) as district_count,
  AVG(CASE WHEN cr.is_compliant THEN 1 ELSE 0 END) as compliance_rate
FROM projects p
LEFT JOIN project_data d ON p.id = d.project_id
LEFT JOIN compliance_results cr ON p.id = cr.project_id
WHERE p.status = 'completed'
GROUP BY p.id;
```

### 报告导出方案

- PDF 导出: 使用 puppeteer 或 pdfmake
- Excel 导出: 使用 exceljs 或 xlsx

### API 响应格式

```typescript
// GET /api/reports/:projectId
interface ReportDetail {
  project: {
    id: string;
    name: string;
    type: string;
    status: string;
    completedAt: string;
  };
  summary: {
    totalDistricts: number;
    totalSchools: number;
    complianceRate: number;
    avgScore: number;
  };
  indicators: Array<{
    id: string;
    name: string;
    score: number;
    isCompliant: boolean;
    details: any;
  }>;
  districts: Array<{
    id: string;
    name: string;
    score: number;
    rank: number;
  }>;
  expertComments: Array<{
    expertName: string;
    comment: string;
    createdAt: string;
  }>;
}
```

---

## 验收标准

### Phase 1 验收

- [ ] 决策者登录后能看到"评估报告"菜单
- [ ] 报告列表正确展示已完成的项目
- [ ] 点击报告卡片能查看详情
- [ ] 详情页各 Tab 正确切换
- [ ] 导出功能正常工作

### Phase 2 验收

- [ ] 统计看板数据准确
- [ ] 图表正确渲染
- [ ] 区县排名按指标筛选正常

### Phase 3 验收

- [ ] 预警列表正确展示
- [ ] 对比分析功能可用

---

## 开发顺序建议

1. 先完成后端 API 基础框架
2. 实现报告列表页面
3. 实现报告详情页面
4. 添加导出功能
5. 实现统计和排名功能
6. 添加可视化图表
7. 实现预警和对比功能
