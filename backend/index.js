const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Mock data
const elementLibraries = [
  {
    id: '1',
    name: '义务教育优质均衡评估要素库',
    description: '用于义务教育优质均衡发展督导评估的基础数据要素和派生计算要素',
    elementCount: 15,
    status: 'published',
    createdBy: '张伟',
    createdAt: '2024-01-15',
    updatedBy: '张伟',
    updatedAt: '2024-03-20',
  },
];

const dataTools = [
  {
    id: '1',
    name: '学校基础数据采集表',
    type: '表单',
    target: '学校',
    description: '用于采集学校基本信息、办学条件、师资队伍等基础数据',
    status: 'published',
    createdBy: '张伟',
    createdAt: '2024-01-15',
  },
];

// API Routes
app.get('/api/element-libraries', (req, res) => {
  res.json({ code: 200, data: elementLibraries });
});

app.get('/api/data-tools', (req, res) => {
  res.json({ code: 200, data: dataTools });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  // Simple mock authentication
  res.json({
    code: 200,
    data: {
      username,
      role: 'admin',
      token: 'mock-token-' + Date.now(),
    },
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
