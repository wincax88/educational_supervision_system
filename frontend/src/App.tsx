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
import IndicatorLibrary from './pages/IndicatorLibrary';
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
            <Route path="home/balanced/elements/:id" element={<ElementLibrary />} />
            <Route path="home/balanced/tools" element={<ToolLibrary />} />
            <Route path="home/balanced/tools/:id/edit" element={<ToolLibrary />} />
            <Route path="home/balanced/indicators" element={<IndicatorLibrary />} />
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
