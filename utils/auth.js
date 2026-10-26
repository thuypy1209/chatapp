var crypto = require('crypto');
var bcrypt = require('bcryptjs');
var Admin = require('../schemas/Admin');

function getSecret() {
    return process.env.ADMIN_SECRET || 'ChatFlex@SecretKey2026#SuperMario_ProtectedDefault';
}

/**
 * Tự động tạo tài khoản Super Admin từ file .env nếu CSDL chưa có Admin nào
 */
async function seedSuperAdmin() {
    try {
        var adminCount = await Admin.countDocuments();
        var defaultUser = (process.env.ADMIN_USERNAME || 'admin').trim().toLowerCase();
        var defaultPass = process.env.ADMIN_PASSWORD || 'admin123456';

        if (adminCount === 0) {
            var hash = await Admin.hashPassword(defaultPass);
            await Admin.create({
                username: defaultUser,
                passwordHash: hash,
                fullName: 'Super Administrator',
                role: 'superadmin'
            });
            console.log(`🔐 Đã tự động khởi tạo Super Admin ban đầu: "${defaultUser}" từ .env`);
        }
    } catch (err) {
        console.error('Lỗi khi kiểm tra / khởi tạo Super Admin:', err);
    }
}

/**
 * Tạo token phiên quản trị có chữ ký số HMAC SHA-256 (tự chứa username)
 */
function generateAdminToken(username) {
    var cleanUser = (username || 'admin').trim().toLowerCase();
    var b64User = Buffer.from(cleanUser).toString('base64');
    var sig = crypto.createHmac('sha256', getSecret()).update(b64User).digest('hex');
    return b64User + '.' + sig;
}

/**
 * Xác thực token phiên quản trị (Chống timing attack)
 * Trả về username nếu hợp lệ, ngược lại trả về false
 */
function verifyAdminToken(token) {
    if (!token || typeof token !== 'string' || !token.includes('.')) return false;
    var parts = token.split('.');
    if (parts.length !== 2) return false;
    var b64User = parts[0];
    var sig = parts[1];
    var expectedSig = crypto.createHmac('sha256', getSecret()).update(b64User).digest('hex');
    if (sig.length !== expectedSig.length) return false;
    try {
        var match = crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig));
        if (!match) return false;
        var username = Buffer.from(b64User, 'base64').toString('utf8');
        return username;
    } catch (e) {
        return false;
    }
}

/**
 * Kiểm tra xem username có phải là tài khoản Admin trong MongoDB không
 */
async function isAdminUsername(name) {
    if (!name || typeof name !== 'string') return false;
    try {
        var cleanName = name.trim().toLowerCase();
        var admin = await Admin.findOne({ username: cleanName });
        return !!admin;
    } catch (e) {
        return false;
    }
}

/**
 * Lấy đối tượng Admin theo username
 */
async function getAdminByUsername(name) {
    if (!name || typeof name !== 'string') return null;
    try {
        return await Admin.findOne({ username: name.trim().toLowerCase() });
    } catch (e) {
        return null;
    }
}

/**
 * Kiểm tra mật khẩu quản trị viên với chuỗi băm Bcrypt trong MongoDB
 */
async function checkAdminPassword(username, password) {
    if (!username || !password || typeof password !== 'string') return false;
    try {
        var admin = await getAdminByUsername(username);
        if (!admin) return false;
        var isMatch = await admin.comparePassword(password);
        if (isMatch) {
            // Cập nhật thời gian đăng nhập gần nhất
            admin.lastLogin = new Date();
            await admin.save();
        }
        return isMatch;
    } catch (err) {
        console.error('Lỗi kiểm tra mật khẩu Admin:', err);
        return false;
    }
}

module.exports = {
    seedSuperAdmin: seedSuperAdmin,
    generateAdminToken: generateAdminToken,
    verifyAdminToken: verifyAdminToken,
    isAdminUsername: isAdminUsername,
    getAdminByUsername: getAdminByUsername,
    checkAdminPassword: checkAdminPassword
};
