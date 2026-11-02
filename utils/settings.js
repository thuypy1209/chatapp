const Setting = require('../schemas/Setting');

const DEFAULT_VERSIONS = [
    { id: "4EteI8yAsv0", title: "Graduation (Relaxing Piano)", artist: "Catiano Cover • Không bản quyền", badge: "🎹 Relaxing Piano", speed: 1.0 },
    { id: "zuoSn3ObMz4", title: "Graduation (Special Video MV)", artist: "NCT DREAM • SM Entertainment", badge: "🎵 Bản MV", speed: 1.0 },
    { id: "eF2qrRYiRuM", title: "Graduation (Piano Acoustic)", artist: "Piano Cover • Không bản quyền", badge: "🛡️ Piano Cover", speed: 0.9 },
    { id: "EznbdoHi0Zs", title: "Graduation (Official Audio)", artist: "NCT DREAM • SM Entertainment", badge: "⭐ Official", speed: 1.0 }
];

// Bộ nhớ đệm (In-memory cache) giúp truy vấn tức thì 0ms
let cachedMusicSetting = {
    versionIndex: 0,
    speed: 1.0,
    customAudioUrl: null,
    versions: DEFAULT_VERSIONS,
    updatedAt: Date.now()
};

// Kho các câu Text Thiệp ngẫu nhiên động viên khi Game Over
const DEFAULT_CARD_MESSAGES = [
    "Đừng buồn vì một lần dừng bước nhé! Bạn đã chơi rất xuất sắc rồi. Nụ cười của bạn quý giá hơn bất kỳ điểm số nào trong game. Hãy hít một hơi thật sâu, mỉm cười và thử lại nào! 🌸✨💖",
    "Thất bại chỉ là một trạm dừng chân nhỏ trên hành trình chinh phục đỉnh cao thôi! Công chúa và Vương quốc Nấm vẫn luôn tin tưởng vào bạn. Cố lên nhé anh hùng! 🍄👑✨",
    "Game Over không phải là kết thúc, mà là cơ hội để bạn bắt đầu lại với nhiều kinh nghiệm hơn! Uống một ngụm nước ấm rồi bấm nút thử lại nào! ☕💪🌈",
    "Mỗi lần vấp ngã là một lần bạn nhảy cao hơn! Ngay cả Mario cũng phải rơi xuống hố hàng chục lần mới giải cứu được thế giới cơ mà. Bạn đỉnh nhất! 🌟🎮🔥",
    "Trời hôm nay có thể mưa, nhưng ngày mai nắng sẽ lại lên rực rỡ! Điểm số chỉ là tạm thời, phong độ của bạn mới là mãi mãi. Thử lại ngay thôi nào! ☀️🌻🎈",
    "Bạn đã né được bao nhiêu chướng ngại vật rồi đấy, siêu lắm luôn! Thêm một hiệp nữa để phá kỷ lục của chính mình nào người bạn dũng cảm! 🚀🎯🐾",
    "Hôm nay bạn đã làm rất tốt rồi! Hãy dành tặng cho bản thân một tràng pháo tay thật lớn nhé. Nhấn Chơi lại để tiếp tục tỏa sáng nha! 👏🧸💖",
    "Không có gì phải tiếc nuối cả, bạn đã có những pha xử lý đỉnh cao! Hít một hơi thật sâu, thả lỏng đôi bàn tay và cùng bứt phá kỷ lục mới nào! 🍀💫🍄",
    "Dù màn hình hiện Game Over, nhưng trong mắt mọi người bạn luôn là nhà vô địch! Hãy mỉm cười thật tươi rồi vào trận mới nha! 🏆😊✨",
    "Đừng để một thử thách nhỏ làm bạn chùn bước chứ! Lần này hãy nhảy thật chuẩn và chinh phục kỷ lục mới nào! 🐢💨💥"
];

// Cài đặt mặc định cho Bức Thiệp Động Viên khi Game Over
const DEFAULT_GAME_CARD = {
    title: 'Tấm Thiệp Động Viên 💌',
    message: DEFAULT_CARD_MESSAGES[0],
    messages: DEFAULT_CARD_MESSAGES,
    isRandom: true,
    sender: 'Từ Vương Quốc Nấm 🍄',
    buttonText: '🔄 Chơi lại ngay'
};

let cachedGameCardSetting = { ...DEFAULT_GAME_CARD };

async function initSettings() {
    try {
        const item = await Setting.findOne({ key: 'music_setting' });
        if (item && item.value) {
            let loadedVersions = (Array.isArray(item.value.versions) && item.value.versions.length > 0)
                ? item.value.versions
                : DEFAULT_VERSIONS;

            if (loadedVersions.some(v => v.id === "R234wY4tTes" || v.id === "wcrkltAbh_g")) {
                loadedVersions = DEFAULT_VERSIONS;
            }

            cachedMusicSetting = { 
                ...cachedMusicSetting, 
                ...item.value, 
                versions: loadedVersions,
                updatedAt: item.updatedAt ? new Date(item.updatedAt).getTime() : Date.now() 
            };
            console.log('Đã nạp cài đặt nhạc từ MongoDB:', cachedMusicSetting.versionIndex, 'bài:', cachedMusicSetting.versions.length);
        }

        // Nạp cài đặt bức thiệp game over từ MongoDB
        const cardItem = await Setting.findOne({ key: 'game_over_card' });
        if (cardItem && cardItem.value) {
            let cardVal = cardItem.value;
            let msgs = (Array.isArray(cardVal.messages) && cardVal.messages.length > 0)
                ? cardVal.messages
                : (cardVal.message ? [cardVal.message, ...DEFAULT_CARD_MESSAGES.slice(1)] : DEFAULT_CARD_MESSAGES);
            cachedGameCardSetting = {
                ...DEFAULT_GAME_CARD,
                ...cardVal,
                messages: msgs,
                isRandom: (cardVal.isRandom !== undefined) ? !!cardVal.isRandom : true
            };
            console.log('Đã nạp cài đặt text thiệp Game Over từ MongoDB, số câu:', cachedGameCardSetting.messages.length, 'random:', cachedGameCardSetting.isRandom);
        }
    } catch (e) {
        console.error('Lỗi nạp settings ban đầu:', e);
    }
}

function getMusicSetting() {
    return cachedMusicSetting;
}

function getGameCardSetting() {
    return cachedGameCardSetting;
}

function getRandomCardMessage() {
    const card = cachedGameCardSetting;
    if (!card.isRandom || !Array.isArray(card.messages) || card.messages.length === 0) {
        return card.message || DEFAULT_GAME_CARD.message;
    }
    const randomIndex = Math.floor(Math.random() * card.messages.length);
    return card.messages[randomIndex];
}

async function updateGameCardSetting(newSetting) {
    cachedGameCardSetting = {
        ...cachedGameCardSetting,
        ...newSetting,
        updatedAt: Date.now()
    };
    try {
        await Setting.findOneAndUpdate(
            { key: 'game_over_card' },
            { key: 'game_over_card', value: cachedGameCardSetting, updatedAt: new Date() },
            { upsert: true, returnDocument: 'after' }
        );
    } catch (e) {
        console.error('Lỗi lưu cài đặt text thiệp vào MongoDB:', e);
    }
    return cachedGameCardSetting;
}

async function updateMusicSetting(newSetting) {
    cachedMusicSetting = {
        ...cachedMusicSetting,
        ...newSetting,
        updatedAt: Date.now()
    };
    try {
        await Setting.findOneAndUpdate(
            { key: 'music_setting' },
            { key: 'music_setting', value: cachedMusicSetting, updatedAt: new Date() },
            { upsert: true, returnDocument: 'after' }
        );
    } catch (e) {
        console.error('Lỗi lưu settings vào MongoDB:', e);
    }
    return cachedMusicSetting;
}

// Khởi chạy nạp cài đặt
setTimeout(initSettings, 1500);

module.exports = {
    getMusicSetting,
    updateMusicSetting,
    getGameCardSetting,
    updateGameCardSetting,
    getRandomCardMessage,
    DEFAULT_CARD_MESSAGES,
    initSettings
};
