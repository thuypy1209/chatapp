/**
 * Tiện ích tạo Emoji Avatar dễ thương từ tên người dùng
 * Đảm bảo đồng bộ 100% giữa Server EJS và Client JavaScript
 */

const CUTE_EMOJIS = [
    '🐱', // Mèo con
    '🐰', // Thỏ trắng
    '🦊', // Cáo con
    '🐼', // Gấu trúc
    '🐨', // Koala
    '🐹', // Hamster
    '🐶', // Cún con
    '🐻', // Gấu nâu
    '🦄', // Kỳ lân
    '🌸', // Hoa anh đào
    '🍓', // Dâu tây
    '🍑', // Quả đào
    '🍒', // Cherry
    '🍄', // Nấm Mario
    '✨', // Ngôi sao lấp lánh
    '🐸', // Ếch con
    '🐧', // Cánh cụt
    '🐥', // Gà con
    '🎀', // Nơ hồng
    '🎈', // Bong bóng
    '🍭', // Kẹo mút
    '⭐', // Ngôi sao vàng
    '🌈', // Cầu vồng
    '🦋'  // Bướm xinh
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
