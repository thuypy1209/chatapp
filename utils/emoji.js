/**
 * Tiện ích tạo Emoji Avatar dễ thương từ tên người dùng
 * Đảm bảo 100% là CON VẬT (Animals) siêu đáng yêu, không dùng biểu tượng hay đồ vật
 * Đồng bộ 100% giữa Server EJS và Client JavaScript
 */

const CUTE_EMOJIS = [
    '🐱', // Mèo con
    '🐶', // Cún con
    '🐰', // Thỏ trắng
    '🦊', // Cáo con
    '🐼', // Gấu trúc
    '🐨', // Koala
    '🐹', // Hamster
    '🐻', // Gấu nâu
    '🐯', // Hổ con
    '🦁', // Sư tử con
    '🐮', // Bò sữa
    '🐷', // Heo hồng
    '🐸', // Ếch xanh
    '🐵', // Khỉ con
    '🐧', // Chim cánh cụt
    '🐥', // Gà con
    '🦄', // Kỳ lân
    '🦭', // Hải cẩu
    '🐬', // Cá heo
    '🦔', // Nhím con
    '🐿️', // Sóc chuột
    '🦌', // Hươu sao
    '🐺', // Sói tuyết
    '🦉'  // Cú mèo
];

function getEmojiForName(name) {
    if (!name || typeof name !== 'string') return '🐱';
    var clean = name.trim().toLowerCase();
    var hash = 0;
    for (var i = 0; i < clean.length; i++) {
        hash = ((hash << 5) - hash) + clean.charCodeAt(i);
        hash |= 0;
    }
    return CUTE_EMOJIS[Math.abs(hash) % CUTE_EMOJIS.length];
}

module.exports = {
    CUTE_EMOJIS,
    getEmojiForName
};
