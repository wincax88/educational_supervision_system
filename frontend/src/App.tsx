import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import MainLayout from './layouts/MainLayout';
import Login from './pages/Login';
import Home from './pages/Home';
import Project from './pages/Project';
import ElementLibrary from './pages/ElementLibrary';
import ToolLibrary from './pages/ToolLibrary';
import FormToolEdit from './pages/FormToolEdit';
import IndicatorLibrary from './pages/IndicatorLibrary';
import IndicatorEdit from './pages/IndicatorEdit';
import IndicatorTreeEdit from './pages/IndicatorTreeEdit';
import DataEntry from './pages/DataEntry';
import DataEntryForm from './pages/DataEntryForm';
import ProjectConfig from './pages/ProjectConfig';
import ProjectIndicatorSystem from './pages/ProjectIndicatorSystem';
import ProjectElements from './pages/ProjectElements';
import ProjectDataTools from './pages/ProjectDataTools';
import DistrictManagement from './pages/DistrictManagement';
import SchoolManagement from './pages/SchoolManagement';
import CVAnalysis from './pages/CVAnalysis';
import ComplianceStats from './pages/ComplianceStats';
import CollectorDashboard from './pages/CollectorDashboard';
import ExpertDashboard from './pages/ExpertDashboard';
import ExpertProjectDetail from './pages/ExpertProjectDetail';
import ExpertDistrictDetail from './pages/ExpertDistrictDetail';
import UserManagement from './pages/UserManagement';
import ExpertAccountManagement from './pages/ExpertAccountManagement';
import DistrictDashboard from './pages/DistrictDashboard';
import DistrictProjectList from './pages/DistrictDashboard/DistrictProjectList';
import ProjectDetail from './pages/ProjectDetail';
import DistrictListPage from './pages/ProjectDetail/DistrictListPage';
import SubmissionDetail from './pages/SubmissionDetail';
import Reports from './pages/Reports';
import ReportDetail from './pages/Reports/Detail';
import ReportStatistics from './pages/Reports/Statistics';
import ReportRankings from './pages/Reports/Rankings';
import ReportAlerts from './pages/Reports/Alerts';
import ReportComparison from './pages/Reports/Comparison';
import ProtectedRoute from './components/ProtectedRoute';
import './styles/global.css';

const App: React.FC = () => {
  return (
    <ConfigProvider locale={zhCN}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Navigate to="/home" replace />} />

            {/* 管理员和项目管理员可访问的路由 */}
            <Route path="home" element={
              <ProtectedRoute requiredPermission="canManageProjects">
                <Home />
              </ProtectedRoute>
            } />
            <Route path="home/balanced" element={
              <ProtectedRoute requiredPermission="canManageProjects">
                <Project />
              </ProtectedRoute>
            } />
            <Route path="home/balanced/elements" element={
              <ProtectedRoute requiredPermission="canManageProjects">
                <ElementLibrary />
              </ProtectedRoute>
            } />
            <Route path="home/balanced/elements/:id/edit" element={
              <ProtectedRoute requiredPermission="canManageProjects">
                <IndicatorEdit />
              </ProtectedRoute>
            } />
            <Route path="home/balanced/tools" element={
              <ProtectedRoute requiredPermission="canManageProjects">
                <ToolLibrary />
              </ProtectedRoute>
            } />
            <Route path="home/balanced/tools/:id/edit" element={
              <ProtectedRoute requiredPermission="canManageProjects">
                <FormToolEdit />
              </ProtectedRoute>
            } />
            <Route path="home/balanced/indicators" element={
              <ProtectedRoute requiredPermission="canManageProjects">
                <IndicatorLibrary />
              </ProtectedRoute>
            } />
            <Route path="home/balanced/indicators/:id/edit" element={
              <ProtectedRoute requiredPermission="canManageProjects">
                <IndicatorEdit />
              </ProtectedRoute>
            } />
            <Route path="home/balanced/indicators/:id/tree" element={
              <ProtectedRoute requiredPermission="canManageProjects">
                <IndicatorTreeEdit />
              </ProtectedRoute>
            } />
            <Route path="home/balanced/entry" element={
              <ProtectedRoute requiredPermission="canManageProjects">
                <DataEntry />
              </ProtectedRoute>
            } />
            <Route path="home/balanced/entry/:projectId/form/:formId" element={<DataEntryForm />} />
            <Route path="home/balanced/project/:projectId/config" element={
              <ProtectedRoute requiredPermission="canConfigProject">
                <ProjectConfig />
              </ProtectedRoute>
            } />
            <Route path="home/balanced/project/:projectId/indicator-system" element={
              <ProtectedRoute requiredPermission="canConfigProject">
                <ProjectIndicatorSystem />
              </ProtectedRoute>
            } />
            <Route path="home/balanced/project/:projectId/elements" element={
              <ProtectedRoute requiredPermission="canConfigProject">
                <ProjectElements />
              </ProtectedRoute>
            } />
            <Route path="home/balanced/project/:projectId/data-tools" element={
              <ProtectedRoute requiredPermission="canConfigProject">
                <ProjectDataTools />
              </ProtectedRoute>
            } />
            <Route path="home/balanced/project/:projectId/detail" element={
              <ProtectedRoute requiredPermission="canManageProjects">
                <DistrictListPage />
              </ProtectedRoute>
            } />
            <Route path="home/balanced/project/:projectId/district/:districtId" element={
              <ProtectedRoute requiredPermission="canManageProjects">
                <ProjectDetail />
              </ProtectedRoute>
            } />
            <Route path="home/balanced/project/:projectId/cv-analysis" element={<CVAnalysis />} />
            <Route path="home/balanced/project/:projectId/compliance" element={<ComplianceStats />} />

            {/* 学前教育普及普惠路由 */}
            <Route path="home/kindergarten" element={
              <ProtectedRoute requiredPermission="canManageProjects">
                <Project />
              </ProtectedRoute>
            } />
            <Route path="home/kindergarten/indicators" element={
              <ProtectedRoute requiredPermission="canManageProjects">
                <IndicatorLibrary />
              </ProtectedRoute>
            } />
            <Route path="home/kindergarten/indicators/:id/edit" element={
              <ProtectedRoute requiredPermission="canManageProjects">
                <IndicatorEdit />
              </ProtectedRoute>
            } />
            <Route path="home/kindergarten/indicators/:id/tree" element={
              <ProtectedRoute requiredPermission="canManageProjects">
                <IndicatorTreeEdit />
              </ProtectedRoute>
            } />
            <Route path="home/kindergarten/elements" element={
              <ProtectedRoute requiredPermission="canManageProjects">
                <ElementLibrary />
              </ProtectedRoute>
            } />
            <Route path="home/kindergarten/elements/:id/edit" element={
              <ProtectedRoute requiredPermission="canManageProjects">
                <IndicatorEdit />
              </ProtectedRoute>
            } />
            <Route path="home/kindergarten/tools" element={
              <ProtectedRoute requiredPermission="canManageProjects">
                <ToolLibrary />
              </ProtectedRoute>
            } />
            <Route path="home/kindergarten/tools/:id/edit" element={
              <ProtectedRoute requiredPermission="canManageProjects">
                <FormToolEdit />
              </ProtectedRoute>
            } />
            <Route path="home/kindergarten/entry" element={
              <ProtectedRoute requiredPermission="canManageProjects">
                <DataEntry />
              </ProtectedRoute>
            } />
            <Route path="home/kindergarten/entry/:projectId/form/:formId" element={<DataEntryForm />} />
            <Route path="home/kindergarten/project/:projectId/config" element={
              <ProtectedRoute requiredPermission="canConfigProject">
                <ProjectConfig />
              </ProtectedRoute>
            } />
            <Route path="home/kindergarten/project/:projectId/indicator-system" element={
              <ProtectedRoute requiredPermission="canConfigProject">
                <ProjectIndicatorSystem />
              </ProtectedRoute>
            } />
            <Route path="home/kindergarten/project/:projectId/elements" element={
              <ProtectedRoute requiredPermission="canConfigProject">
                <ProjectElements />
              </ProtectedRoute>
            } />
            <Route path="home/kindergarten/project/:projectId/data-tools" element={
              <ProtectedRoute requiredPermission="canConfigProject">
                <ProjectDataTools />
              </ProtectedRoute>
            } />
            <Route path="home/kindergarten/project/:projectId/detail" element={
              <ProtectedRoute requiredPermission="canManageProjects">
                <DistrictListPage />
              </ProtectedRoute>
            } />
            <Route path="home/kindergarten/project/:projectId/district/:districtId" element={
              <ProtectedRoute requiredPermission="canManageProjects">
                <ProjectDetail />
              </ProtectedRoute>
            } />
            <Route path="home/kindergarten/project/:projectId/cv-analysis" element={<CVAnalysis />} />
            <Route path="home/kindergarten/project/:projectId/compliance" element={<ComplianceStats />} />

            {/* 系统管理路由 - 仅管理员 */}
            <Route path="home/system/districts" element={
              <ProtectedRoute requiredPermission="canManageSystem">
                <DistrictManagement />
              </ProtectedRoute>
            } />
            <Route path="home/system/schools" element={
              <ProtectedRoute requiredPermission="canManageSystem">
                <SchoolManagement />
              </ProtectedRoute>
            } />
            <Route path="system" element={
              <ProtectedRoute requiredPermission="canManageSystem">
                <div style={{ padding: 24 }}>系统配置页面（开发中）</div>
              </ProtectedRoute>
            } />
            <Route path="users" element={<Navigate to="/users/school-account" replace />} />
            <Route path="users/school-account" element={
              <ProtectedRoute requiredPermission="canManageSystem">
                <UserManagement />
              </ProtectedRoute>
            } />
            <Route path="users/expert-account" element={
              <ProtectedRoute requiredPermission="canManageSystem">
                <ExpertAccountManagement />
              </ProtectedRoute>
            } />

            {/* 区县管理员专用路由 */}
            <Route path="district" element={
              <ProtectedRoute requiredPermission="canManageProjects">
                <DistrictProjectList />
              </ProtectedRoute>
            } />
            <Route path="district/:projectId" element={
              <ProtectedRoute requiredPermission="canManageProjects">
                <DistrictDashboard />
              </ProtectedRoute>
            } />

            {/* 数据采集员专用路由 */}
            <Route path="collector" element={
              <ProtectedRoute requiredPermission="canCollectData">
                <CollectorDashboard />
              </ProtectedRoute>
            } />
            <Route path="collector/:projectId" element={
              <ProtectedRoute requiredPermission="canCollectData">
                <CollectorDashboard />
              </ProtectedRoute>
            } />

            {/* 专家评审专用路由 */}
            <Route path="expert" element={
              <ProtectedRoute requiredPermission="canReviewData">
                <ExpertDashboard />
              </ProtectedRoute>
            } />
            <Route path="expert/projects/:projectId" element={
              <ProtectedRoute requiredPermission="canReviewData">
                <ExpertProjectDetail />
              </ProtectedRoute>
            } />
            <Route path="expert/projects/:projectId/districts/:districtId" element={
              <ProtectedRoute requiredPermission="canReviewData">
                <ExpertDistrictDetail />
              </ProtectedRoute>
            } />

            {/* 填报记录详情查看路由 - 支持通过 submissionId 查看 */}
            <Route path="data-entry/:id" element={
              <ProtectedRoute>
                <SubmissionDetail />
              </ProtectedRoute>
            } />

            {/* 报告决策者专用路由 */}
            <Route path="reports" element={
              <ProtectedRoute requiredPermission="canViewReports">
                <Reports />
              </ProtectedRoute>
            } />
            <Route path="reports/statistics" element={
              <ProtectedRoute requiredPermission="canViewReports">
                <ReportStatistics />
              </ProtectedRoute>
            } />
            <Route path="reports/rankings" element={
              <ProtectedRoute requiredPermission="canViewReports">
                <ReportRankings />
              </ProtectedRoute>
            } />
            <Route path="reports/alerts" element={
              <ProtectedRoute requiredPermission="canViewReports">
                <ReportAlerts />
              </ProtectedRoute>
            } />
            <Route path="reports/comparison" element={
              <ProtectedRoute requiredPermission="canViewReports">
                <ReportComparison />
              </ProtectedRoute>
            } />
            <Route path="reports/:projectId" element={
              <ProtectedRoute requiredPermission="canViewReports">
                <ReportDetail />
              </ProtectedRoute>
            } />

            {/* 通用工具编辑路由 - 支持从项目配置页直接跳转 */}
            <Route path="form-tool/:id" element={
              <ProtectedRoute requiredPermission="canManageProjects">
                <FormToolEdit />
              </ProtectedRoute>
            } />
            <Route path="form-tool/:id/edit" element={
              <ProtectedRoute requiredPermission="canManageProjects">
                <FormToolEdit />
              </ProtectedRoute>
            } />
          </Route>
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
};

export default App;
