const mongoose = require('mongoose');

const trackAudioSchema = new mongoose.Schema({
    filename: { type: String, required: true },
    contentType: { type: String, default: 'audio/mpeg' },
    size: { type: Number, default: 0 },
    data: { type: Buffer, required: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('TrackAudio', trackAudioSchema);
