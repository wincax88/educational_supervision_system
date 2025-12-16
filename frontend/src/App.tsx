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
import DistrictManagement from './pages/DistrictManagement';
import SchoolManagement from './pages/SchoolManagement';
import CVAnalysis from './pages/CVAnalysis';
import ComplianceStats from './pages/ComplianceStats';
import CollectorDashboard from './pages/CollectorDashboard';
import ExpertDashboard from './pages/ExpertDashboard';
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
            <Route path="home/balanced/project/:projectId/cv-analysis" element={<CVAnalysis />} />
            <Route path="home/balanced/project/:projectId/compliance" element={<ComplianceStats />} />
            <Route path="home/kindergarten" element={
              <ProtectedRoute requiredPermission="canManageProjects">
                <Project />
              </ProtectedRoute>
            } />

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
            <Route path="users" element={
              <ProtectedRoute requiredPermission="canManageSystem">
                <div style={{ padding: 24 }}>用户管理页面（开发中）</div>
              </ProtectedRoute>
            } />

            {/* 数据采集员专用路由 */}
            <Route path="collector" element={
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

            {/* 报告决策者专用路由 */}
            <Route path="reports" element={
              <ProtectedRoute requiredPermission="canViewReports">
                <div style={{ padding: 24 }}>评估报告页面（开发中）</div>
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
