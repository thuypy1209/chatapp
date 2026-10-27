const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { 
        type: String, 
        required: true, 
        unique: true, 
        trim: true 
    },
    isAdmin: { 
        type: Boolean, 
        default: false 
    },
    lastActive: {
        type: Date,
        default: Date.now
    },
    lastPage: {
        type: String,
        default: 'Phòng Chat'
    },
    visitCount: {
        type: Number,
        default: 1
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    }
});

module.exports = mongoose.model('User', userSchema);
