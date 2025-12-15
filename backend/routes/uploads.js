// 佐证资料上传路由

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 确保上传目录存在
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 配置 multer 存储
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // 按日期分目录存储
    const dateDir = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const destDir = path.join(uploadDir, dateDir);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    cb(null, destDir);
  },
  filename: (req, file, cb) => {
    // 生成唯一文件名
    const uniqueId = Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueId}${ext}`);
  },
});

// 文件类型过滤
const fileFilter = (req, file, cb) => {
  // 允许的文件类型
  const allowedTypes = [
    // 文档
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    // 图片
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    // 压缩文件
    'application/zip',
    'application/x-rar-compressed',
    'application/x-7z-compressed',
    // 文本
    'text/plain',
    'text/csv',
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`不支持的文件类型: ${file.mimetype}`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
});

module.exports = (db) => {
  // 获取填报的佐证资料列表
  router.get('/submissions/:submissionId/materials', async (req, res) => {
    const { submissionId } = req.params;

    try {
      const result = await db.query(`
        SELECT
          m.*,
          sm.code as "materialCode",
          sm.name as "materialName",
          sm.file_types as "allowedTypes",
          sm.max_size as "maxSize"
        FROM submission_materials m
        LEFT JOIN supporting_materials sm ON m.material_config_id = sm.id
        WHERE m.submission_id = $1
        ORDER BY m.created_at DESC
      `, [submissionId]);

      res.json({ code: 0, data: result.rows });
    } catch (error) {
      console.error('获取佐证资料失败:', error);
      res.status(500).json({ code: 500, message: '获取佐证资料失败' });
    }
  });

  // 上传佐证资料
  router.post('/submissions/:submissionId/materials', upload.single('file'), async (req, res) => {
    const { submissionId } = req.params;
    const { materialConfigId, indicatorId, description } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ code: 400, message: '请选择要上传的文件' });
    }

    try {
      // 验证填报记录存在（程序层面引用验证）
      const submissionResult = await db.query('SELECT id FROM submissions WHERE id = $1', [submissionId]);
      if (!submissionResult.rows[0]) {
        // 删除已上传的文件
        fs.unlinkSync(file.path);
        return res.status(404).json({ code: 404, message: '填报记录不存在' });
      }

      // 如果指定了资料配置，验证文件类型和大小
      if (materialConfigId) {
        const configResult = await db.query('SELECT * FROM supporting_materials WHERE id = $1', [materialConfigId]);
        const config = configResult.rows[0];
        if (config) {
          // 验证文件类型
          const allowedTypes = config.file_types.split(',').map((t) => t.trim().toLowerCase());
          const fileExt = path.extname(file.originalname).toLowerCase().slice(1);
          if (!allowedTypes.includes(fileExt) && !allowedTypes.includes('*')) {
            fs.unlinkSync(file.path);
            return res.status(400).json({
              code: 400,
              message: `不支持的文件类型，允许: ${config.file_types}`,
            });
          }

          // 验证文件大小
          const maxSizeMatch = config.max_size.match(/(\d+)(MB|KB|GB)?/i);
          if (maxSizeMatch) {
            let maxBytes = parseInt(maxSizeMatch[1]);
            const unit = (maxSizeMatch[2] || 'MB').toUpperCase();
            if (unit === 'KB') maxBytes *= 1024;
            else if (unit === 'MB') maxBytes *= 1024 * 1024;
            else if (unit === 'GB') maxBytes *= 1024 * 1024 * 1024;

            if (file.size > maxBytes) {
              fs.unlinkSync(file.path);
              return res.status(400).json({
                code: 400,
                message: `文件大小超过限制，最大: ${config.max_size}`,
              });
            }
          }
        }
      }

      const id = Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
      const now = new Date().toISOString();

      // 构建相对路径用于存储
      const relativePath = path.relative(uploadDir, file.path);

      await db.query(`
        INSERT INTO submission_materials (
          id, submission_id, material_config_id, indicator_id,
          file_name, file_path, file_size, file_type, description,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        id,
        submissionId,
        materialConfigId || null,
        indicatorId || null,
        file.originalname,
        relativePath,
        file.size,
        file.mimetype,
        description || null,
        now,
        now
      ]);

      res.json({
        code: 0,
        data: {
          id,
          fileName: file.originalname,
          fileSize: file.size,
          fileType: file.mimetype,
        },
        message: '上传成功',
      });
    } catch (error) {
      console.error('上传佐证资料失败:', error);
      // 清理上传的文件
      if (file && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      res.status(500).json({ code: 500, message: '上传佐证资料失败' });
    }
  });

  // 删除佐证资料
  router.delete('/materials/:id', async (req, res) => {
    const { id } = req.params;

    try {
      const materialResult = await db.query('SELECT * FROM submission_materials WHERE id = $1', [id]);
      const material = materialResult.rows[0];
      if (!material) {
        return res.status(404).json({ code: 404, message: '资料不存在' });
      }

      // 删除文件
      const filePath = path.join(uploadDir, material.file_path);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      // 删除数据库记录
      await db.query('DELETE FROM submission_materials WHERE id = $1', [id]);

      res.json({ code: 0, message: '删除成功' });
    } catch (error) {
      console.error('删除佐证资料失败:', error);
      res.status(500).json({ code: 500, message: '删除佐证资料失败' });
    }
  });

  // 下载佐证资料
  router.get('/materials/:id/download', async (req, res) => {
    const { id } = req.params;

    try {
      const materialResult = await db.query('SELECT * FROM submission_materials WHERE id = $1', [id]);
      const material = materialResult.rows[0];
      if (!material) {
        return res.status(404).json({ code: 404, message: '资料不存在' });
      }

      const filePath = path.join(uploadDir, material.file_path);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ code: 404, message: '文件不存在' });
      }

      res.download(filePath, material.file_name);
    } catch (error) {
      console.error('下载佐证资料失败:', error);
      res.status(500).json({ code: 500, message: '下载佐证资料失败' });
    }
  });

  // 获取数据指标的佐证资料要求
  router.get('/data-indicators/:indicatorId/material-requirements', async (req, res) => {
    const { indicatorId } = req.params;

    try {
      const result = await db.query(`
        SELECT * FROM supporting_materials
        WHERE indicator_id = $1
        ORDER BY code
      `, [indicatorId]);

      res.json({ code: 0, data: result.rows });
    } catch (error) {
      console.error('获取佐证资料要求失败:', error);
      res.status(500).json({ code: 500, message: '获取佐证资料要求失败' });
    }
  });

  // 获取工具表单的佐证资料要求（通过字段映射）
  router.get('/tools/:toolId/material-requirements', async (req, res) => {
    const { toolId } = req.params;

    try {
      // 获取工具的字段映射中关联的数据指标
      const mappingsResult = await db.query(`
        SELECT DISTINCT fm.target_id as "indicatorId"
        FROM field_mappings fm
        WHERE fm.tool_id = $1 AND fm.mapping_type = 'data_indicator'
      `, [toolId]);

      const mappings = mappingsResult.rows;

      if (mappings.length === 0) {
        return res.json({ code: 0, data: [] });
      }

      // 获取这些数据指标的佐证资料要求
      const indicatorIds = mappings.map((m) => m.indicatorId);

      const materialsResult = await db.query(`
        SELECT
          sm.*,
          di.name as "indicatorName",
          di.code as "indicatorCode"
        FROM supporting_materials sm
        JOIN data_indicators di ON sm.indicator_id = di.id
        WHERE sm.indicator_id = ANY($1)
        ORDER BY di.code, sm.code
      `, [indicatorIds]);

      const materials = materialsResult.rows;

      // 按指标分组
      const grouped = {};
      materials.forEach((m) => {
        if (!grouped[m.indicator_id]) {
          grouped[m.indicator_id] = {
            indicatorId: m.indicator_id,
            indicatorName: m.indicatorName,
            indicatorCode: m.indicatorCode,
            materials: [],
          };
        }
        grouped[m.indicator_id].materials.push({
          id: m.id,
          code: m.code,
          name: m.name,
          fileTypes: m.file_types,
          maxSize: m.max_size,
          description: m.description,
          required: m.required,
        });
      });

      res.json({ code: 0, data: Object.values(grouped) });
    } catch (error) {
      console.error('获取工具佐证资料要求失败:', error);
      res.status(500).json({ code: 500, message: '获取工具佐证资料要求失败' });
    }
  });

  return router;
};
