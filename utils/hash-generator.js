var bcrypt = require('bcryptjs');

// Lấy mật khẩu từ đối số dòng lệnh
var password = process.argv[2] || 'admin123';
var saltRounds = 10;

console.log('--------------------------------------------------');
console.log('🔐 CÔNG CỤ TẠO CHUỖI MÃ HÓA BCRYPT CHO CHATAPP');
console.log('--------------------------------------------------');
console.log('Mật khẩu gốc:      ', password);

var hash = bcrypt.hashSync(password, saltRounds);

console.log('Chuỗi Bcrypt Hash: ', hash);
console.log('--------------------------------------------------');
console.log('👉 Bạn có thể dán chuỗi hash trên vào biến ADMIN_HASH trong file config/admin.js');
console.log('--------------------------------------------------');
