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
import './styles/global.css';

const App: React.FC = () => {
  return (
    <ConfigProvider locale={zhCN}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Navigate to="/home" replace />} />
            <Route path="home" element={<Home />} />
            <Route path="home/balanced" element={<Project />} />
            <Route path="home/balanced/elements" element={<ElementLibrary />} />
            <Route path="home/balanced/elements/:id/edit" element={<IndicatorEdit />} />
            <Route path="home/balanced/tools" element={<ToolLibrary />} />
            <Route path="home/balanced/tools/:id/edit" element={<FormToolEdit />} />
            <Route path="home/balanced/indicators" element={<IndicatorLibrary />} />
            <Route path="home/balanced/indicators/:id/edit" element={<IndicatorEdit />} />
            <Route path="home/balanced/indicators/:id/tree" element={<IndicatorTreeEdit />} />
            <Route path="home/balanced/entry" element={<DataEntry />} />
            <Route path="home/balanced/entry/:projectId/form/:formId" element={<DataEntryForm />} />
            <Route path="home/balanced/project/:projectId/config" element={<ProjectConfig />} />
            <Route path="home/kindergarten" element={<Project />} />
            <Route path="system" element={<div style={{ padding: 24 }}>系统配置页面（开发中）</div>} />
            <Route path="users" element={<div style={{ padding: 24 }}>用户管理页面（开发中）</div>} />
          </Route>
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
};

export default App;
