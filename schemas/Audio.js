const mongoose = require('mongoose');

const audioSchema = new mongoose.Schema({
    audioUrl: { type: String, required: true },
    fileName: String
});

module.exports = mongoose.model('Audio', audioSchema);