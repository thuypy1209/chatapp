var express = require('express');
var router = express.Router();
var Question = require('../schemas/Question'); // Đường dẫn tới Schema Question
var Answer = require('../schemas/Answer');
var Image = require('../schemas/Image');
var Audio = require('../schemas/Audio');
var Character = require('../schemas/Character');

// Trang chủ: Hiển thị danh sách nhân vật để chọn trước khi chat
router.get('/', async function(req, res, next) {
    try {
        var allCharacters = await Character.find({});

        // 1. Tìm nhân vật được đánh dấu là mặc định
        var defaultCharacter = await Character.findOne({ isDefault: true });

        // Nếu không có ai được set isDefault, lấy đại nhân vật đầu tiên
        if (!defaultCharacter) {
            defaultCharacter = allCharacters.length > 0 ? allCharacters[0] : null;
        }

        if (!defaultCharacter) {
            return res.render('user/Chat', {
                title: 'Phòng Chat',
                character: null,
                allCharacters: [],
                questions: [],
                initialBotMessage: null
            });
        }

        var charId = defaultCharacter._id;

        // 2. Lấy câu hỏi mở đầu (ưu tiên isRoot: true hoặc blockIndex: 0)
        var firstQuestion = await Question.findOne({ characterId: charId, isRoot: true })
            .populate('answerId')
            .populate('imageId')
            .populate('audioId')
            .populate('nextQuestions');

        if (!firstQuestion) {
            firstQuestion = await Question.findOne({ characterId: charId, blockIndex: 0 })
                .populate('answerId')
                .populate('imageId')
                .populate('audioId')
                .populate('nextQuestions');
        }

        // 3. Lấy các câu hỏi tiếp theo/lựa chọn ban đầu
        var questions = firstQuestion ? firstQuestion.nextQuestions : [];
        if (!questions || questions.length === 0) {
            questions = await Question.find({ characterId: charId, blockIndex: 0 })
                .populate('answerId').populate('imageId').populate('audioId').populate('nextQuestions');
        }

        // 4. Render vào giao diện Chat
        res.render('user/Chat', { 
            title: `Trò chuyện cùng ${defaultCharacter.name}`,
            character: defaultCharacter, 
            allCharacters: allCharacters,
            questions: questions, 
            initialBotMessage: firstQuestion 
        });
    } catch (err) {
        console.log("Lỗi tải phòng chat mặc định:", err);
        res.render('user/Chat', { character: null, allCharacters: [], questions: [], initialBotMessage: null });
    }
});

// Trang chat riêng cho từng nhân vật (Truyền vào characterId trên URL)
router.get('/:characterId', async function(req, res, next) {
    try {
        var charId = req.params.characterId;
        var allCharacters = await Character.find({});
        var character = await Character.findById(charId);

        if (!character) {
            return res.redirect('/chat');
        }
        
        // 1. Lấy tất cả các câu hỏi ở khối đầu tiên (blockIndex: 0) làm các nút lựa chọn ban đầu
        var rootQuestions = await Question.find({ characterId: charId, blockIndex: 0 })
            .populate('answerId')
            .populate('imageId')
            .populate('audioId')
            .populate('nextQuestions');

        // Lấy đại diện câu hỏi đầu tiên của khối 0 để làm mốc hiển thị
        var firstQuestion = rootQuestions.length > 0 ? rootQuestions[0] : null;

        res.render('user/Chat', {
            title: `Trò chuyện với ${character.name}`, 
            character: character,
            allCharacters: allCharacters,
            initialBotMessage: firstQuestion,
            questions: rootQuestions
        });
    } catch (err) {
        console.log("Lỗi vào phòng chat nhân vật:", err);
        res.redirect('/chat');
    }
});

// Xử lý khi người dùng bấm vào một câu hỏi (gửi ngầm từ AJAX/Fetch)
router.post('/ask', async function(req, res, next) {
    var questionId = req.body.questionId;

    try {
        // 1. Tìm câu hỏi theo ID
        var q = await Question.findById(questionId)
            .populate('answerId')
            .populate('imageId')
            .populate('audioId')
            .populate('nextQuestions');

        if (!q) {
            return res.json({ error: "Không tìm thấy câu hỏi" });
        }

        // 2. Tìm câu trả lời liên kết (Answer)
        var ans = null;
        if (q.answerId) {
            ans = await Answer.findById(q.answerId);
        }

        // Trả về JSON cho phía giao diện (frontend)
        res.json({
            questionText: q.questionText, 
            answerText: ans ? ans.answerText : "Chưa có câu trả lời.",
            imageUrl: q.imageId ? q.imageId.imageUrl : null,
            audioUrl: q.audioId ? q.audioId.audioUrl : null,
            nextQuestions: q.nextQuestions || []
        });

    } catch (err) {
        console.log("Lỗi xử lý câu hỏi:", err);
        res.json({ error: "Có lỗi xảy ra phía server" });
    }
});

// Xử lý khi người dùng nhập văn bản tự do trong phòng chat
router.post('/text-message', async function(req, res) {
    try {
        var { message, characterId } = req.body;
        var cleanMsg = (message || '').trim();
        if (!cleanMsg) return res.json({ error: "Tin nhắn không được để trống" });

        var char = await Character.findById(characterId);
        var charName = char ? char.name : 'Bot';

        // 1. Thử tìm kiếm câu hỏi trong kịch bản khớp với câu người dùng gõ
        var escapedMsg = cleanMsg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        var matchedQ = await Question.findOne({
            characterId: characterId,
            questionText: { $regex: new RegExp(escapedMsg, 'i') }
        }).populate('answerId').populate('imageId').populate('audioId').populate('nextQuestions');

        if (matchedQ && matchedQ.answerId) {
            return res.json({
                isScenarioMatch: true,
                questionText: matchedQ.questionText,
                answerText: matchedQ.answerId.answerText,
                imageUrl: matchedQ.imageId ? matchedQ.imageId.imageUrl : null,
                audioUrl: matchedQ.audioId ? matchedQ.audioId.audioUrl : null,
                nextQuestions: matchedQ.nextQuestions || []
            });
        }

        // 2. Nếu không có câu hỏi khớp kịch bản, trả lời tự nhiên
        var reply = '';
        var lower = cleanMsg.toLowerCase();
        if (lower.includes('chào') || lower.includes('hello') || lower.includes('hi')) {
            reply = `Xin chào bạn! Mình là ${charName}. Rất vui được hỗ trợ bạn hôm nay! Bạn hãy xem các lựa chọn bên dưới để tiếp tục cuộc trò chuyện nhé!`;
        } else if (lower.includes('bạn là ai') || lower.includes('tên gì')) {
            reply = `Mình là ${charName}${char && char.description ? ' - ' + char.description : ''}. Rất hân hạnh được đồng hành cùng bạn!`;
        } else if (lower.includes('cảm ơn') || lower.includes('thanks')) {
            reply = `Không có chi nè! Hãy chọn các câu hỏi tiếp theo để mình giải đáp thêm nhé!`;
        } else if (lower.includes('tạm biệt') || lower.includes('bye')) {
            reply = `Tạm biệt bạn nhé! Chúc bạn một ngày thật tuyệt vời! Hẹn gặp lại bạn sớm!`;
        } else {
            var genericReplies = [
                `Cảm ơn bạn đã nhắn tin! Bạn có thể chọn các câu hỏi gợi ý bên dưới để chúng mình trao đổi cụ thể hơn nhé!`,
                `Mình đã hiểu ý bạn! Hãy bấm vào một trong các câu hỏi gợi ý bên dưới để tiếp tục khám phá kịch bản nha!`,
                `Câu hỏi rất thú vị! Để xem chi tiết các nội dung, bạn hãy bấm vào các lựa chọn bên dưới nhé!`
            ];
            reply = genericReplies[Math.floor(Math.random() * genericReplies.length)];
        }

        // Trả về câu trả lời và giữ các câu hỏi kịch bản khối 0 để người dùng tiếp tục
        var defaultQuestions = await Question.find({ characterId: characterId, blockIndex: 0 })
            .populate('answerId').populate('nextQuestions');

        return res.json({
            isScenarioMatch: false,
            answerText: reply,
            nextQuestions: defaultQuestions || []
        });

    } catch (err) {
        console.error("Lỗi text-message:", err);
        res.json({ error: "Có lỗi khi xử lý tin nhắn" });
    }
});

// Reset cuộc trò chuyện về khối đầu tiên
router.post('/reset', async function(req, res) {
    try {
        var { characterId } = req.body;
        var rootQuestions = await Question.find({ characterId: characterId, blockIndex: 0 })
            .populate('answerId').populate('imageId').populate('audioId').populate('nextQuestions');
        var firstQ = rootQuestions.length > 0 ? rootQuestions[0] : null;

        res.json({
            success: true,
            questions: rootQuestions,
            initialBotMessage: firstQ && firstQ.answerId ? firstQ.answerId.answerText : "Xin chào! Chúng ta hãy bắt đầu lại cuộc trò chuyện nhé!"
        });
    } catch (err) {
        res.json({ error: "Không thể làm mới cuộc trò chuyện" });
    }
});

module.exports = router;
