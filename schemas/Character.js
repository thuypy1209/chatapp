var mongoose = require('mongoose');

var characterSchema = new mongoose.Schema({
    name: { type: String, required: true },       // Tên nhân vật (VD: Tư vấn bán hàng, Chuyên gia kỹ thuật...)
    avatarUrl: { type: String },                  // Ảnh đại diện nhân vật
    description: { type: String },                // Mô tả ngắn về nhân vật
    backgroudUrl: { type: String },               // Ảnh nền Khung chat
    audioUrl: { type: String },                   // Âm thanh
    scriptFilename: String,
    icon: { type: String, required: false },
    isDefault: { type: Boolean, default: false }
});

module.exports = mongoose.model('Character', characterSchema);  