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
    } catch (e) {
        console.error('Lỗi nạp settings ban đầu:', e);
    }
}

function getMusicSetting() {
    return cachedMusicSetting;
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
    initSettings
};
