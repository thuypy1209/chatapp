var express = require('express');
var router = express.Router();
var rateLimit = require('express-rate-limit');
var User = require('../schemas/User');
var authUtils = require('../utils/auth');

// Bảo mật chống Brute-Force: Giới hạn tối đa 20 lần thử đăng nhập trong 5 phút từ một địa chỉ IP
var loginLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 phút
    max: 20, // Tối đa 20 yêu cầu
    message: {
        success: false,
        error: 'Phát hiện quá nhiều yêu cầu đăng nhập từ IP của bạn! Vui lòng đợi 5 phút trước khi thử lại để đảm bảo an toàn.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// POST /auth/login: Xử lý nhập tên / đăng nhập (Bảo vệ bởi loginLimiter)
router.post('/login', loginLimiter, async function(req, res) {
    try {
        var username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
        var password = typeof req.body.password === 'string' ? req.body.password.trim() : '';

        if (!username) {
            return res.json({ success: false, error: 'Vui lòng nhập tên của bạn!' });
        }

        if (username.length < 2) {
            return res.json({ success: false, error: 'Tên phải có độ dài từ 2 ký tự trở lên!' });
        }

        // 1. Trường hợp người dùng nhập tên là Admin trong hệ thống
        var isAdmin = await authUtils.isAdminUsername(username);
        if (isAdmin) {
            if (!password) {
                return res.json({ 
                    success: false, 
                    requirePassword: true, 
                    error: 'Tài khoản Quản trị yêu cầu nhập mật khẩu để tiếp tục!' 
                });
            }

            var isPasswordCorrect = await authUtils.checkAdminPassword(username, password);
            if (isPasswordCorrect) {
                var adminObj = await authUtils.getAdminByUsername(username);
                var adminDisplayName = adminObj ? adminObj.username : username;
                // Tạo token phiên bảo mật có chữ ký số (httpOnly chống truy cập qua script)
                var token = authUtils.generateAdminToken(adminDisplayName);
                res.cookie('chat_admin_token', token, {
                    maxAge: 7 * 24 * 60 * 60 * 1000,
                    httpOnly: true, // Trình duyệt không thể đọc/sửa qua JS client
                    sameSite: 'lax'
                });
                res.cookie('chat_user', adminDisplayName, { maxAge: 7 * 24 * 60 * 60 * 1000, httpOnly: false });
                res.cookie('chat_role', 'admin', { maxAge: 7 * 24 * 60 * 60 * 1000, httpOnly: false });

                return res.json({ 
                    success: true, 
                    username: adminDisplayName, 
                    role: 'admin', 
                    isAdmin: true, 
                    redirect: '/admin' 
                });
            } else {
                // Trì hoãn nhẹ 400ms để chống hacker dùng bot dò mật khẩu (brute force)
                await new Promise(function(resolve) { setTimeout(resolve, 400); });
                return res.json({ 
                    success: false, 
                    requirePassword: true, 
                    error: 'Mật khẩu Quản trị không chính xác. Vui lòng thử lại!' 
                });
            }
        }

        // 2. Trường hợp người dùng bình thường: Kiểm tra trùng tên trong Database
        var escapedName = username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        var existingUser = await User.findOne({ 
            username: { $regex: new RegExp('^' + escapedName + '$', 'i') } 
        });

        // Nếu đã có cookie trùng với tên này hoặc người dùng xác nhận đăng nhập lại (allowRelogin)
        var currentCookieUser = req.cookies.chat_user;
        var isOwnUser = existingUser && currentCookieUser && currentCookieUser.toLowerCase() === username.toLowerCase();
        var confirmRelogin = req.body.allowRelogin === true;

        if (existingUser && (isOwnUser || confirmRelogin)) {
            existingUser.lastActive = new Date();
            existingUser.visitCount = (existingUser.visitCount || 1) + 1;
            await existingUser.save().catch(function() {});

            res.cookie('chat_user', existingUser.username, { maxAge: 7 * 24 * 60 * 60 * 1000, httpOnly: false });
            res.cookie('chat_role', 'user', { maxAge: 7 * 24 * 60 * 60 * 1000, httpOnly: false });
            return res.json({ 
                success: true, 
                username: existingUser.username, 
                role: 'user', 
                isAdmin: false,
                isRelogin: true 
            });
        }

        if (existingUser) {
            return res.json({ 
                success: false, 
                isExistingUser: true,
                existingUsername: existingUser.username,
                error: `Tên "${existingUser.username}" đã có trên hệ thống. Nếu đây là bạn, bạn có thể bấm "Tiếp tục vào với tên này" bên dưới!` 
            });
        }

        // Tạo User mới trong MongoDB để giữ tên không bị trùng
        var newUser = await User.create({
            username: username,
            isAdmin: false,
            lastActive: new Date(),
            lastPage: 'Phòng Chat',
            visitCount: 1
        });

        res.cookie('chat_user', newUser.username, { maxAge: 7 * 24 * 60 * 60 * 1000, httpOnly: false });
        res.cookie('chat_role', 'user', { maxAge: 7 * 24 * 60 * 60 * 1000, httpOnly: false });

        return res.json({ 
            success: true, 
            username: newUser.username, 
            role: 'user', 
            isAdmin: false 
        });

    } catch (err) {
        console.error('Lỗi auth login:', err);
        return res.json({ success: false, error: 'Có lỗi xảy ra phía server, vui lòng thử lại!' });
    }
});

// POST /auth/logout: Đăng xuất / Đổi tên
router.post('/logout', function(req, res) {
    res.clearCookie('chat_admin_token');
    res.clearCookie('chat_user');
    res.clearCookie('chat_role');
    res.json({ success: true });
});

// GET /auth/logout: Đăng xuất qua link URL
router.get('/logout', function(req, res) {
    res.clearCookie('chat_admin_token');
    res.clearCookie('chat_user');
    res.clearCookie('chat_role');
    res.redirect('/');
});

module.exports = router;
