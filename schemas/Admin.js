const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminSchema = new mongoose.Schema({
    username: { 
        type: String, 
        required: true, 
        unique: true, 
        trim: true,
        lowercase: true
    },
    passwordHash: { 
        type: String, 
        required: true 
    },
    fullName: { 
        type: String, 
        default: 'Quản trị viên' 
    },
    role: { 
        type: String, 
        enum: ['superadmin', 'admin'], 
        default: 'admin' 
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    },
    lastLogin: { 
        type: Date 
    }
});

// Phương thức so sánh mật khẩu với chuỗi hash
adminSchema.methods.comparePassword = async function(candidatePassword) {
    if (!candidatePassword || !this.passwordHash) return false;
    return await bcrypt.compare(candidatePassword.trim(), this.passwordHash);
};

// Phương thức băm mật khẩu bằng Bcrypt (saltRounds = 10)
adminSchema.statics.hashPassword = async function(plainPassword) {
    return await bcrypt.hash(plainPassword.trim(), 10);
};

module.exports = mongoose.model('Admin', adminSchema);
