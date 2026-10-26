const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema({
    imageUrl: { type: String, required: true },
    fileName: String
});

module.exports = mongoose.model('Image', imageSchema);