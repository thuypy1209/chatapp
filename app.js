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
var flappyRouter = require('./routers/flappy');
var marioRouter = require('./routers/mario');
var authRouter = require('./routers/auth');
var authUtils = require('./utils/auth');
var settingsUtils = require('./utils/settings');
var emojiUtils = require('./utils/emoji');
var helmet = require('helmet');

var app = express();

// Bật trust proxy để Express và express-rate-limit nhận diện đúng IP client khi chạy sau Render/Nginx
app.set('trust proxy', 1);

// Cấu hình HTTP Security Headers với Helmet (Chống Clickjacking, MIME-sniffing, XSS)
app.use(helmet({
    contentSecurityPolicy: false, // Để iframe YouTube, audio và script Mario chạy mượt mà
    crossOriginEmbedderPolicy: false
}));

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
    res.locals.gameOverCard = settingsUtils.getGameCardSetting();
    res.locals.siteBrand = settingsUtils.getBrandSetting();
    res.locals.getEmojiForName = emojiUtils.getEmojiForName;
    res.locals.currentPath = req.originalUrl || req.path || '';
    next();
});
// Thêm vào app.js (trước các router khác)
app.get('/ping', function(req, res) {
    res.status(200).send('pong');
});
// API công khai để client đồng bộ cài đặt nhạc theo thời gian thực
app.get('/api/music-setting', function(req, res) {
    res.json(settingsUtils.getMusicSetting());
});

// API công khai để client đồng bộ cài đặt text thiệp Game Over
app.get('/api/game-card', function(req, res) {
    res.json({ success: true, card: settingsUtils.getGameCardSetting() });
});

// API công khai để client đồng bộ tiêu đề & icon thương hiệu website
app.get('/api/brand-setting', function(req, res) {
    res.json({ success: true, brand: settingsUtils.getBrandSetting() });
});


// API stream file âm thanh lưu vĩnh viễn trên MongoDB Atlas (hỗ trợ HTTP Range requests cho iOS/Messenger)
var TrackAudio = require('./schemas/TrackAudio');
var fs = require('fs');
var path = require('path');

function streamAudioBuffer(req, res, buffer, contentType) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Accept-Ranges', 'bytes');
    var totalSize = buffer.length;
    var range = req.headers.range;

    if (range) {
        var parts = range.replace(/bytes=/, "").split("-");
        var start = parseInt(parts[0], 10);
        var end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
        if (isNaN(start)) start = 0;
        if (isNaN(end) || end >= totalSize) end = totalSize - 1;
        if (start >= totalSize || start > end) {
            res.writeHead(416, { 'Content-Range': `bytes */${totalSize}` });
            return res.end();
        }
        var chunksize = (end - start) + 1;

        res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${totalSize}`,
            'Content-Length': chunksize,
            'Content-Type': contentType || 'audio/mpeg',
            'Cache-Control': 'public, max-age=86400'
        });
        res.end(buffer.slice(start, end + 1));
    } else {
        res.writeHead(200, {
            'Content-Length': totalSize,
            'Content-Type': contentType || 'audio/mpeg',
            'Cache-Control': 'public, max-age=86400'
        });
        res.end(buffer);
    }
}

app.get(['/api/track-audio/:id', '/api/track-audio/:id.mp3'], async function(req, res) {
    try {
        var rawId = req.params.id ? req.params.id.replace(/\.[^/.]+$/, "") : "";
        var bufferToSend = null;
        var contentTypeToSend = 'audio/mpeg';

        if (rawId && mongoose.Types.ObjectId.isValid(rawId)) {
            var doc = await TrackAudio.findById(rawId);
            if (doc && doc.data && doc.data.length > 0) {
                bufferToSend = doc.data;
                contentTypeToSend = doc.contentType || 'audio/mpeg';
            }
        }

        // Nếu không tìm thấy file trong MongoDB Atlas, tự động nạp file MP3 mặc định hệ thống thay vì redirect 302
        if (!bufferToSend) {
            var fallbackPath = path.join(__dirname, 'public', 'audio', 'graduation-nct-dream.mp3');
            if (fs.existsSync(fallbackPath)) {
                bufferToSend = fs.readFileSync(fallbackPath);
            }
        }

        if (bufferToSend) {
            return streamAudioBuffer(req, res, bufferToSend, contentTypeToSend);
        }

        res.status(404).send('Audio file not found');
    } catch (err) {
        console.error('Lỗi stream track-audio:', err);
        try {
            var fallbackPath = path.join(__dirname, 'public', 'audio', 'graduation-nct-dream.mp3');
            if (fs.existsSync(fallbackPath)) {
                var fbBuffer = fs.readFileSync(fallbackPath);
                return streamAudioBuffer(req, res, fbBuffer, 'audio/mpeg');
            }
        } catch (_) {}
        res.status(500).send('Internal Server Error');
    }
});

// Đăng ký các đường dẫn (Routes)
app.use('/auth', authRouter); // Đăng nhập / Kiểm tra tên
app.use('/', indexRouter); // Trang chính 
app.use('/chat', chatRouter); // Chat 
app.use('/admin', adminRouter); // Trang quản trị CRUD
app.use('/flappy', flappyRouter); // Chơi Flappy Bird & Chat
app.use('/mario', flappyRouter); // Đường dẫn tương thích ngược cũ

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