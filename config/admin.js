/**
 * Cấu hình tham số quản trị viên mặc định (Đọc an toàn từ biến môi trường .env)
 */
module.exports = {
    ADMIN_USERNAME: process.env.ADMIN_USERNAME || 'admin',
    ADMIN_SECRET: process.env.ADMIN_SECRET || 'ChatFlex@SecretKey2026#SuperMario_ProtectedDefault'
};
