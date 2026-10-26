var mongoose = require('mongoose');

var questionSchema = new mongoose.Schema({
    questionText: { type: String, required: true },
    answerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Answer' },
    imageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Image' },
    audioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Audio' },
    characterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Character' },
    nextQuestions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }],
    blockIndex: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Question', questionSchema);