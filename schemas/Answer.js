var mongoose = require('mongoose');

var answerSchema = new mongoose.Schema({
    answerText: { type: String, required: true }
});

module.exports = mongoose.model('Answer', answerSchema);