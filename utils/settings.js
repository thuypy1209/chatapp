const Setting = require('../schemas/Setting');

const DEFAULT_VERSIONS = [
    { id: "4EteI8yAsv0", title: "Graduation (Relaxing Piano)", artist: "Catiano Cover • Không bản quyền", badge: "🎹 Relaxing Piano", speed: 1.0, audioUrl: "/audio/bgm.mp3" },
    { id: "zuoSn3ObMz4", title: "Graduation (Special Video MV)", artist: "NCT DREAM • SM Entertainment", badge: "🎵 Bản MV", speed: 1.0, audioUrl: "/audio/graduation-nct-dream.mp3" },
    { id: "eF2qrRYiRuM", title: "Graduation (Piano Acoustic)", artist: "Piano Cover • Không bản quyền", badge: "🛡️ Piano Cover", speed: 0.9, audioUrl: "/audio/bgm.mp3" },
    { id: "EznbdoHi0Zs", title: "Graduation (Official Audio)", artist: "NCT DREAM • SM Entertainment", badge: "⭐ Official", speed: 1.0, audioUrl: "/audio/graduation-nct-dream.mp3" }
];

// Bộ nhớ đệm (In-memory cache) giúp truy vấn tức thì 0ms
let cachedMusicSetting = {
    versionIndex: 0,
    speed: 1.0,
    customAudioUrl: null,
    autoplayAll: true,
    versions: DEFAULT_VERSIONS,
    updatedAt: Date.now()
};

// Kho các câu Text Thiệp ngẫu nhiên (chỉ chứa các câu do người dùng tự thêm)
const DEFAULT_CARD_MESSAGES = [];

// Cài đặt mặc định cho Bức Thiệp Động Viên khi Game Over
const DEFAULT_GAME_CARD = {
    title: 'Thiệp Mời Tốt Nghiệp 💌',
    message: 'Thiệp mời tham dự\nLễ Tốt Nghiệp\nTrân trọng mời bạn yêu của tui đến tham dự cùng để lại kỷ niệm nhé\nVào ngày 16/11/2026 \nDự kiến thời gian: 11h-12h \nTại Nhà Hát Hoà Bình\n240 Đường 3/2 Phường Hoà Hưng TP Hồ Chí Minh \nSĐT: 0939923208 Yến',
    messages: [],
    isRandom: true,
    sender: 'Từ Hoàng Yến',
    buttonText: '🔄 Chơi lại ngay'
};

let cachedGameCardSetting = { ...DEFAULT_GAME_CARD };

// Cài đặt mặc định Tiêu đề & Logo Thương hiệu website
const DEFAULT_BRAND_SETTING = {
    brandTitle: 'Graduation',
    brandIcon: '',
    welcomeText: 'Cảm ơn bạn đã nhấn vào web để mình có cơ hội gửi bạn tấm thiệp nhằm mời bạn đến với lễ tốt nghiệp của mình',
    updatedAt: Date.now()
};

let cachedBrandSetting = { ...DEFAULT_BRAND_SETTING };

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

            // Gán audioUrl mặc định nếu dữ liệu cũ chưa có
            loadedVersions = loadedVersions.map(v => {
                if (!v.audioUrl) {
                    if (v.id === "zuoSn3ObMz4" || v.id === "EznbdoHi0Zs") {
                        v.audioUrl = "/audio/graduation-nct-dream.mp3";
                    } else if (v.id === "4EteI8yAsv0" || v.id === "eF2qrRYiRuM") {
                        v.audioUrl = "/audio/bgm.mp3";
                    }
                }
                return v;
            });

            cachedMusicSetting = { 
                ...cachedMusicSetting, 
                ...item.value, 
                autoplayAll: (item.value && item.value.autoplayAll !== undefined) ? Boolean(item.value.autoplayAll) : true,
                versions: loadedVersions,
                updatedAt: item.updatedAt ? new Date(item.updatedAt).getTime() : Date.now() 
            };
            console.log('Đã nạp cài đặt nhạc từ MongoDB:', cachedMusicSetting.versionIndex, 'bài:', cachedMusicSetting.versions.length);
        }

        // Nạp cài đặt bức thiệp game over từ MongoDB
        const cardItem = await Setting.findOne({ key: 'game_over_card' });
        if (cardItem && cardItem.value) {
            let cardVal = cardItem.value;
            let msgs = Array.isArray(cardVal.messages) ? cardVal.messages : [];
            // Lọc bỏ triệt để các câu mẫu Mario cũ nếu còn sót lại trong DB
            msgs = msgs.filter(m => typeof m === 'string' && m.trim() && !/Vương quốc Nấm|Mario|công chúa/i.test(m));
            let cardTitle = (cardVal.title && !/Tấm Thiệp Động Viên/i.test(cardVal.title)) ? cardVal.title : DEFAULT_GAME_CARD.title;
            let cardSender = (cardVal.sender && !/Vương Quốc Nấm/i.test(cardVal.sender)) ? cardVal.sender : DEFAULT_GAME_CARD.sender;

            cachedGameCardSetting = {
                ...DEFAULT_GAME_CARD,
                ...cardVal,
                title: cardTitle,
                sender: cardSender,
                messages: msgs,
                isRandom: (cardVal.isRandom !== undefined) ? !!cardVal.isRandom : true
            };
            console.log('Đã nạp cài đặt text thiệp Game Over từ MongoDB, số câu:', cachedGameCardSetting.messages.length, 'random:', cachedGameCardSetting.isRandom);
        }

        // Nạp cài đặt Tiêu đề & Logo thương hiệu từ MongoDB
        const brandItem = await Setting.findOne({ key: 'site_brand_setting' });
        if (brandItem && brandItem.value) {
            let bVal = brandItem.value;
            let title = (bVal.brandTitle && !/Phổi bạn không phải tôi/i.test(bVal.brandTitle)) ? bVal.brandTitle : DEFAULT_BRAND_SETTING.brandTitle;
            let icon = (bVal.brandIcon && bVal.brandIcon !== '🍄') ? bVal.brandIcon : '';
            let welcome = (bVal.welcomeText && !/Phổi bạn không phải tôi/i.test(bVal.welcomeText)) ? bVal.welcomeText : DEFAULT_BRAND_SETTING.welcomeText;

            cachedBrandSetting = {
                brandTitle: title,
                brandIcon: icon,
                welcomeText: welcome,
                updatedAt: brandItem.updatedAt ? new Date(brandItem.updatedAt).getTime() : Date.now()
            };
            console.log('Đã nạp cài đặt thương hiệu từ MongoDB:', cachedBrandSetting.brandIcon, cachedBrandSetting.brandTitle);
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

function getBrandSetting() {
    return cachedBrandSetting;
}

async function updateBrandSetting(newSetting) {
    cachedBrandSetting = {
        ...cachedBrandSetting,
        ...newSetting,
        updatedAt: Date.now()
    };
    try {
        await Setting.findOneAndUpdate(
            { key: 'site_brand_setting' },
            { key: 'site_brand_setting', value: cachedBrandSetting, updatedAt: new Date() },
            { upsert: true, returnDocument: 'after' }
        );
    } catch (e) {
        console.error('Lỗi lưu cài đặt thương hiệu vào MongoDB:', e);
    }
    return cachedBrandSetting;
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
    getBrandSetting,
    updateBrandSetting,
    DEFAULT_BRAND_SETTING,
    initSettings
};
