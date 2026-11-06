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
            title: 'Flappy Cat: Cuộc Phiêu Lưu Trên Không 🚀',
            character: mario,
            questions: questions
        });
    } catch (err) {
        console.error('Lỗi tải trang Flappy:', err);
        res.render('user/FlappyChat', {
            title: 'Flappy Cat: Cuộc Phiêu Lưu Trên Không 🚀',
            character: { name: 'Mèo Mô Tô', icon: '🚀' },
            questions: []
        });
    }
});

// POST /mario/message: Xử lý tin nhắn văn bản tự do người dùng gửi cho Mèo Phi Công Flappy Cat
router.post('/message', function(req, res) {
    trackUserActivity(req, 'Chat Flappy Cat');
    var message = (req.body.message || '').trim().toLowerCase();

    var reply = '';

    if (!message) {
        reply = 'Meo meo! Bạn hãy nói gì đó với Mèo Phi Công nào! 🚀🐾';
    } else if (message.includes('chào') || message.includes('hello') || message.includes('hi')) {
        reply = 'Meo meo! Xin chào bạn nha! Bạn đã sẵn sàng điều khiển chiếc xe mô tô cùng tôi nẹt pô bay qua các cột ống nước xanh retro chưa? Nhấn Space hoặc chạm màn hình để bay nhé! 🚀🐱';
    } else if (message.includes('bay') || message.includes('chơi') || message.includes('cách') || message.includes('điều khiển')) {
        reply = 'Mẹo bay đỉnh cao: Mỗi lần bạn chạm màn hình hoặc bấm phím Space, xe mô tô sẽ nẹt pô bay vút lên! Đừng bấm quá liên tục kẻo đụng trần, hãy nhấp nhả nhịp nhàng theo hình sin để lách chuẩn qua khe hở giữa hai ống nước nha! 💨⭐';
    } else if (message.includes('ống') || message.includes('ống nước') || message.includes('pipe') || message.includes('khe')) {
        reply = 'Các cột ống nước xanh Flappy Bird có độ cao ngẫu nhiên! Khi bạn bay qua được 1 cặp ống, hệ thống sẽ phát âm thanh "ting" và bạn nhận được ngay +1 điểm! Vượt qua càng nhiều ống điểm càng cao! 🏆✨';
    } else if (message.includes('mèo') || message.includes('xe') || message.includes('mô tô') || message.includes('kính') || message.includes('khăn')) {
        reply = 'Chiếc xe mô tô phân khối lớn của tôi được trang bị kính phi công chống gió và khăn choàng lụa xanh bay phần phật trong gió! Mỗi lần vút lên đều có khói pô trắng xả ra cực ngầu luôn đó! 🏍️🕶️✨';
    } else if (message.includes('kỷ lục') || message.includes('điểm cao') || message.includes('score')) {
        reply = 'Kỷ lục Flappy Cat được lưu tự động trên máy của bạn! Cố gắng bay qua từ 10 đến 20 ống nước là bạn đã lọt top phi công siêu đẳng rồi đó! Cố lên nha! 🥇🌟';
    } else if (message.includes('thua') || message.includes('chết') || message.includes('đụng') || message.includes('ngã')) {
        reply = 'Đừng buồn khi một lần dừng bước nhé! Ngay cả phi công cừ khôi nhất cũng phải va ống nước hàng chục lần mới thành tài cơ mà! Bấm ra ngoài thiệp hoặc bấm phím [R] là chúng mình vào ngay lượt bay mới! 🌸💖';
    } else {
        reply = 'Meo meo! Tôi đang tập trung giữ tay lái mô tô nè! Cố gắng nhấp nhả Space đều tay để chúng ta cùng nhau phá kỷ lục điểm số hôm nay nhé! Cố lên bạn ơi! 🚀🐾✨';
    }

    res.json({
        success: true,
        reply: reply,
        hero: 'Mèo Mô Tô'
    });
});

module.exports = router;
