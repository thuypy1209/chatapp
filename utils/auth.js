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
 * Tạo token phiên quản trị có chữ ký số HMAC SHA-256 kèm thời hạn hết hạn
 * Payload: JSON { u: username, exp: timestamp }
 * Mặc định hết hạn sau 7 ngày
 */
function generateAdminToken(username, expiresInMs) {
    var cleanUser = (username || 'admin').trim().toLowerCase();
    var exp = Date.now() + (expiresInMs || 7 * 24 * 60 * 60 * 1000);
    var payload = JSON.stringify({ u: cleanUser, exp: exp });
    var b64Payload = Buffer.from(payload).toString('base64');
    var sig = crypto.createHmac('sha256', getSecret()).update(b64Payload).digest('hex');
    return b64Payload + '.' + sig;
}

/**
 * Xác thực token phiên quản trị:
 * 1. Chống timing attack với crypto.timingSafeEqual
 * 2. Tự động kiểm tra thời hạn hết hạn (exp)
 * 3. Tương thích ngược với định dạng cũ nếu có
 */
function verifyAdminToken(token) {
    if (!token || typeof token !== 'string' || !token.includes('.')) return false;
    var parts = token.split('.');
    if (parts.length !== 2) return false;
    var b64Payload = parts[0];
    var sig = parts[1];
    var expectedSig = crypto.createHmac('sha256', getSecret()).update(b64Payload).digest('hex');
    if (sig.length !== expectedSig.length) return false;
    try {
        var match = crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig));
        if (!match) return false;
        var decoded = Buffer.from(b64Payload, 'base64').toString('utf8');
        // Kiểm tra nếu là payload JSON mới có exp
        if (decoded.startsWith('{') && decoded.endsWith('}')) {
            var data = JSON.parse(decoded);
            if (data.exp && Date.now() > data.exp) {
                // Token đã hết hạn!
                return false;
            }
            return data.u || false;
        }
        // Tương thích ngược: Chuỗi b64User cũ
        return decoded;
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
