var express = require('express');
var router = express.Router();
var Character = require('../schemas/Character');
var Question = require('../schemas/Question');
var User = require('../schemas/User');

function trackUserActivity(req, pageName) {
    try {
        var username = req.cookies.chat_user;
        if (username) {
            var escaped = username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            User.updateOne(
                { username: { $regex: new RegExp('^' + escaped + '$', 'i') } },
                { $set: { lastActive: new Date(), lastPage: pageName || 'Game Mario' }, $inc: { visitCount: 1 } }
            ).catch(function() {});
        }
    } catch(e) {}
}

// Đảm bảo có nhân vật Mario sẵn trong hệ thống
async function getOrCreateMarioCharacter() {
    try {
        var mario = await Character.findOne({ name: 'Super Mario' });
        if (!mario) {
            mario = await Character.create({
                name: 'Super Mario',
                icon: '🍄',
                description: 'Hiệp sĩ thợ sửa ống nước dũng cảm từ Vương quốc Nấm!',
                avatarUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png', // Hoặc icon mặc định
                isDefault: false
            });

            // Tạo một vài câu hỏi mẫu để người chơi có thể bấm hỏi ngay
            var sampleQuestions = [
                { text: 'Làm thế nào để điều khiển Mario nhảy cao?', answer: 'Bạn hãy nhấn phím Cách (Space) hoặc Mũi tên Lên (W) để nhảy! Giữ phím Shift để chạy nhanh hơn!' },
                { text: 'Mục tiêu của màn chơi 1-1 là gì?', answer: 'Mục tiêu là vượt qua các chướng ngại vật, né hoặc giẫm bẹp Goomba, thu thập tiền xu và chạm đỉnh cột cờ ở cuối lâu đài!' },
                { text: 'Làm sao để tiêu diệt Goomba?', answer: 'Hãy nhảy thật chuẩn và tiếp đất ngay trên đầu của Goomba để giẫm bẹp nó (+200 điểm)!' },
                { text: 'Bí kíp kiếm nhiều điểm số?', answer: 'Đập đầu vào tất cả các khối hộp dấu hỏi (?) màu vàng lấp lánh để nhặt xu và không bỏ lỡ các đồng xu bay lơ lửng trên không trung nhé!' }
            ];

            for (var i = 0; i < sampleQuestions.length; i++) {
                var q = sampleQuestions[i];
                await Question.create({
                    characterId: mario._id,
                    questionText: q.text,
                    blockIndex: 0
                });
            }
        }
        return mario;
    } catch (err) {
        console.error('Lỗi khởi tạo nhân vật Mario:', err);
        return null;
    }
}

// GET /flappy (hoặc /mario): Giao diện chính Vừa chơi Flappy Cat Vừa Chat
router.get('/', async function(req, res) {
    trackUserActivity(req, 'Game Flappy Cat');
    try {
        var mario = await getOrCreateMarioCharacter();
        var questions = [];
        if (mario) {
            questions = await Question.find({ characterId: mario._id, blockIndex: 0 });
        }

        res.render('user/FlappyChat', {
            title: 'Flappy Bangboo: Cuộc Phiêu Lưu Trên Không 🚀',
            character: mario,
            questions: questions
        });
    } catch (err) {
        console.error('Lỗi tải trang Flappy:', err);
        res.render('user/FlappyChat', {
            title: 'Flappy Bangboo: Cuộc Phiêu Lưu Trên Không 🚀',
            character: { name: 'Bangboo (ZZZ)', icon: '🚀' },
            questions: []
        });
    }
});

// POST /flappy/message (hoặc /mario/message): Xử lý tin nhắn văn bản tự do người dùng gửi cho Bangboo (Zenless Zone Zero)
router.post('/message', function(req, res) {
    trackUserActivity(req, 'Chat Bangboo ZZZ');
    var message = (req.body.message || '').trim().toLowerCase();

    var reply = '';

    if (!message) {
        reply = 'Eh-nah! Bạn hãy gửi tin nhắn trò chuyện với Bangboo nào! 🚀🤖';
    } else if (message.includes('chào') || message.includes('hello') || message.includes('hi')) {
        reply = 'Eh-nah! Xin chào bạn nha! Tôi là chú Bangboo lái xe mô tô cực ngầu từ New Eridu trong Zenless Zone Zero đây! Bạn đã sẵn sàng cùng tôi bay lượn qua các cột ống nước chưa? 🚀🕶️✨';
    } else if (message.includes('bangboo') || message.includes('zzz') || message.includes('zenless') || message.includes('loại nào')) {
        reply = 'Eh-nah! Trong Zenless Zone Zero có rất nhiều Bangboo dễ thương như Eous, Amillion, Safety, Avocaboo... Còn tôi là Bangboo Phi Công chuyên lái xe mô tô phân khối lớn, đội kính bảo hộ và đeo khăn choàng lụa xanh siêu tốc độ! 🏍️💨';
    } else if (message.includes('bay') || message.includes('rơi') || message.includes('chơi') || message.includes('cách') || message.includes('điều khiển')) {
        reply = 'Mẹo bay chuẩn ZZZ: Trọng lực đã được điều chỉnh cực kỳ êm ái, bồng bềnh! Bạn chỉ cần nhấp nhẹ chuột hoặc phím Space với nhịp độ thư thái, Bangboo sẽ lướt mượt mà qua giữa các khe ống nước rộng rãi! Đừng bấm quá vội vàng nha! 🌟🎈';
    } else if (message.includes('ống') || message.includes('ống nước') || message.includes('pipe') || message.includes('khe')) {
        reply = 'Khe hở giữa các cột ống nước đã được nới rộng lên 155px rất thoáng! Mỗi lần bạn đưa Bangboo bay qua một cặp ống an toàn, sẽ có tiếng "ting" vui tai và bạn ghi được +1 điểm! 🏆✨';
    } else if (message.includes('new eridu') || message.includes('hollow') || message.includes('proxy')) {
        reply = 'New Eridu là ốc đảo văn minh cuối cùng sau thảm họa Hollows! Là Bangboo, chúng tôi luôn đồng hành cùng các Proxy tài ba để giải cứu thế giới và khám phá những điều kỳ diệu! 🏙️⚡';
    } else if (message.includes('kỷ lục') || message.includes('điểm cao') || message.includes('score')) {
        reply = 'Kỷ lục bay của Bangboo được lưu tự động trên máy bạn! Với độ rơi êm ái mới này, bạn hoàn toàn có thể chinh phục mốc 20–30 điểm một cách dễ dàng! Cố lên nhé! 🥇🎉';
    } else if (message.includes('thua') || message.includes('chết') || message.includes('đụng') || message.includes('ngã')) {
        reply = 'Eh-nah! Đừng nản lòng nhé! Va chạm một lần chỉ là tai nạn giao thông nhỏ thôi mà! Bấm ra ngoài tấm thiệp hoặc nhấn phím [R] là Bangboo lại nổ máy vít ga vào đường đua mới ngay! 🌸💖';
    } else {
        reply = 'Eh-nah! Tôi đang tập trung quan sát đường bay phía trước nè! Nhịp chân ga Space thật đều đặn để chúng mình lập kỷ lục mới hôm nay nhé! 🚀🤖✨';
    }

    res.json({
        success: true,
        reply: reply,
        hero: 'Bangboo (Zenless Zone Zero)'
    });
});

module.exports = router;
