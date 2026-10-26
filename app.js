// Nạp cấu hình biến môi trường từ file .env
require('dotenv').config();

var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var mongoose = require('mongoose');

// Khai báo các router đã tạo
var chatRouter = require('./routers/chat');
var adminRouter = require('./routers/admin');
var indexRouter = require('./routers/index');
var marioRouter = require('./routers/mario');
var authRouter = require('./routers/auth');
var authUtils = require('./utils/auth');
var settingsUtils = require('./utils/settings');

var app = express();

// Kết nối MongoDB qua biến môi trường MONGODB_URI (Bảo mật tuyệt đối, không lộ credentials)
var mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ChatApp';

mongoose.connect(mongoURI)
    .then(async function() {
        console.log('✅ Đã kết nối thành công tới MongoDB an toàn qua biến môi trường (.env)!');
        // Tự động seed tài khoản Super Admin từ .env nếu chưa có tài khoản admin trong CSDL
        await authUtils.seedSuperAdmin();
    })
    .catch(function(err) {
        console.error('❌ Lỗi kết nối MongoDB:', err);
    });

// Cấu hình View Engine (sử dụng EJS)
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Cấu hình thư mục tĩnh để hiển thị file upload (ảnh, âm thanh)
app.use(express.static(path.join(__dirname, 'public')));

// Middleware gắn thông tin người dùng và cài đặt nhạc vào tất cả template EJS
app.use(function(req, res, next) {
    var adminUser = authUtils.verifyAdminToken(req.cookies.chat_admin_token);
    var isAdmin = !!adminUser;
    res.locals.currentUser = req.cookies.chat_user || null;
    res.locals.currentRole = isAdmin ? 'admin' : (req.cookies.chat_role || 'user');
    res.locals.isAdmin = isAdmin;
    res.locals.adminUsername = adminUser || 'Admin';
    res.locals.activeMusicSetting = settingsUtils.getMusicSetting();
    next();
});

// API công khai để client đồng bộ cài đặt nhạc theo thời gian thực
app.get('/api/music-setting', function(req, res) {
    res.json(settingsUtils.getMusicSetting());
});

// Đăng ký các đường dẫn (Routes)
app.use('/auth', authRouter); // Đăng nhập / Kiểm tra tên
app.use('/', indexRouter); // Trang chính 
app.use('/chat', chatRouter); // Chat 
app.use('/admin', adminRouter); // Trang quản trị CRUD
app.use('/mario', marioRouter); // Chơi Mario & Chat

// Bắt lỗi 404 và chuyển đến trang lỗi
app.use(function(req, res, next) {
    var err = new Error('Không tìm thấy trang (Not Found)');
    err.status = 404;
    next(err);
});

// Xử lý lỗi chung
app.use(function(err, req, res, next) {
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    res.status(err.status || 500);
    res.render('error');
});

module.exports = app;