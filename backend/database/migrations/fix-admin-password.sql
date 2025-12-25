-- 修复 admin 账号密码
-- 将占位符 bcrypt hash 替换为正确的 '000000' 的 bcrypt hash

UPDATE sys_users
SET password = '$2b$10$.kzFXMpvCLWXPY6lANBeiurTI9cbG/1TSmgF.1CmwLHKeHdAYUyT6',
    updated_at = NOW()
WHERE phone = '13800000000'
  AND (password = '$2b$10$rQZ5E5Z5Z5Z5Z5Z5Z5Z5ZuJ5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z'
       OR password NOT LIKE '$2b$10$%');

-- 验证更新结果
SELECT phone, name, status, 
       CASE 
         WHEN password LIKE '$2b$10$%' THEN '已加密'
         ELSE '明文'
       END as password_type
FROM sys_users
WHERE phone = '13800000000';

