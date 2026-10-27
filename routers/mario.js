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

// GET /mario: Giao diện chính Vừa chơi Mario Vừa Chat
router.get('/', async function(req, res) {
    trackUserActivity(req, 'Game Mario');
    try {
        var mario = await getOrCreateMarioCharacter();
        var questions = [];
        if (mario) {
            questions = await Question.find({ characterId: mario._id, blockIndex: 0 });
        }

        res.render('user/MarioChat', {
            title: 'Super Mario Bros & Chat Trực Tuyến',
            character: mario,
            questions: questions
        });
    } catch (err) {
        console.error('Lỗi tải trang Mario:', err);
        res.render('user/MarioChat', {
            title: 'Super Mario Bros & Chat',
            character: { name: 'Super Mario', icon: '🍄' },
            questions: []
        });
    }
});

// POST /mario/message: Xử lý tin nhắn văn bản tự do người dùng gửi cho Mario
router.post('/message', function(req, res) {
    trackUserActivity(req, 'Chat Mario');
    var message = (req.body.message || '').trim().toLowerCase();

    var reply = '';

    if (!message) {
        reply = 'Bạn hãy nói gì đó với tôi nào! Yahoo!';
    } else if (message.includes('chào') || message.includes('hello') || message.includes('hi')) {
        reply = 'Xin chào bạn nha! Bạn đã sẵn sàng cùng tôi vượt qua các chướng ngại vật và khám phá vương quốc pixel chưa? ⭐⛏️';
    } else if (message.includes('bản mario') || message.includes('kết hợp') || message.includes('minecraft') || message.includes('mod') || message.includes('nào hay')) {
        reply = 'Có nhiều bản Mario kết hợp Minecraft cực đỉnh: 1. Bản "Minecraft: Super Mario Mash-up Pack" chính thức từ Nintendo & Mojang. 2. Map "Super Minecraft Maker" nổi tiếng tự build màn chơi bằng block. 3. Và đặc biệt là chế độ "Minecraft Edition" độc quyền đang chạy mượt mà ngay trên canvas bên cạnh bạn đó! Hãy vung Kiếm Kim Cương và chém Creeper nhé! 💎⚔️';
    } else if (message.includes('steve') || message.includes('creeper') || message.includes('kiếm')) {
        reply = 'Trong chế độ Minecraft Edition, Steve mang Kiếm Kim Cương sắc lẹm! Khi gặp Creeper xanh lá, hãy căn cú nhảy đạp hoặc chém chuẩn xác từ trên cao để nó nổ khói trắng mà bạn không bị mất tim nhé! 💥🗡️';
    } else if (message.includes('kim cương') || message.includes('diamond')) {
        reply = 'Viên Kim Cương Diamond 💎 sáng lấp lánh ẩn trong các Khối May Mắn Lucky Block vàng và bay lơ lửng trên không trung. Thu thập mỗi viên bạn sẽ được thưởng +200 điểm!';
    } else if (message.includes('nether') || message.includes('cổng') || message.includes('portal') || message.includes('ống cống')) {
        reply = 'Ống nước cổ điển đã được chuyển hóa thành Cổng Địa Ngục Nether Portal huyền bí làm từ đá Hắc Diệu Thạch Obsidian và luồng ánh sáng ma thuật tím xoáy lộng lẫy!';
    } else if (message.includes('nhảy') || message.includes('phím') || message.includes('điều khiển') || message.includes('chơi')) {
        reply = 'Rất dễ thôi! Dùng phím A/D hoặc Mũi tên Trái/Phải để chạy, Phím Cách (Space) hoặc W để nhảy! Nhấn Shift để phi nước đại nhé!';
    } else if (message.includes('goomba') || message.includes('quái') || message.includes('nấm nâu')) {
        reply = 'Cẩn thận mấy con nấm Goomba (hoặc Creeper ở bản Minecraft) nhé! Bạn chỉ cần căn chuẩn cú nhảy và giẫm bẹp lên đầu nó là được thưởng 200 điểm liền! 👞💥';
    } else if (message.includes('xu') || message.includes('tiền') || message.includes('coin') || message.includes('điểm')) {
        reply = 'Ting ting! Hãy đập đầu vào các khối hộp vàng [?] hoặc Lucky Block để mở khóa thật nhiều Kim Cương / xu vàng và tăng điểm số vù vù nhé!';
    } else if (message.includes('công chúa') || message.includes('peach') || message.includes('lâu đài') || message.includes('beacon')) {
        reply = 'Pháo đài đá và Cột Đèn Hiệu Beacon ánh sáng đang nằm ở cuối chặng đường bên phải! Vượt qua các vực thẳm là bạn sẽ đến đích an toàn! 🏰🚩';
    } else if (message.includes('giỏi') || message.includes('hay') || message.includes('đẹp')) {
        reply = 'Cảm ơn bạn rất nhiều! Đồ họa pixel kết hợp giữa thế giới Super Mario và khối vuông Minecraft nhìn bắt mắt đúng không? Chúc bạn có những phút giây thư giãn tuyệt vời! 🎉';
    } else if (message.includes('thua') || message.includes('chết') || message.includes('khó')) {
        reply = 'Đừng nản lòng bạn ơi! Thất bại là mẹ thành công! Nhấn nút [Chơi lại] hoặc phím R để làm lại một màn thật hoành tráng nhé! 💪';
    } else {
        var randomReplies = [
            'Thật thú vị! Hãy cùng Steve & Mario phiêu lưu tiếp nào! 🍄⛏️',
            'Tôi nghe rõ bạn nói rồi! Vừa chơi game pixel vừa trò chuyện vui thật đấy! ⭐',
            'Tuyệt vời! Đừng quên chú ý né vực sâu và các chướng ngại vật phía trước nha! 🏃‍♂️💨',
            'Haha, đúng là như vậy! Bạn đã thu thập được bao nhiêu viên Kim Cương / xu vàng rồi? 💎🪙'
        ];
        reply = randomReplies[Math.floor(Math.random() * randomReplies.length)];
    }

    res.json({
        success: true,
        reply: reply
    });
});

module.exports = router;
