/**
 * ChatFlex - Emoji Avatar dễ thương
 * Tự động gán emoji ngẫu nhiên (ổn định theo tên) cho badge người dùng trên navbar và trong chat
 */
(function () {
    'use strict';

    var CUTE_EMOJIS = [
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

    // Tự động cập nhật các phần tử avatar khi trang tải xong
    document.addEventListener('DOMContentLoaded', function () {
        var emojiEl = document.getElementById('nav-user-emoji');
        var nameEl  = document.getElementById('nav-username-display');

        if (emojiEl && nameEl && window.IS_ADMIN !== true) {
            var username = nameEl.textContent.trim();
            emojiEl.textContent = getEmojiForName(username);
        }

        // Cập nhật tất cả các avatar user trong bảng quản trị nếu có
        var adminAvatars = document.querySelectorAll('.chat-user-avatar[data-name]');
        adminAvatars.forEach(function (el) {
            var uname = el.getAttribute('data-name');
            if (uname) {
                el.textContent = getEmojiForName(uname);
            }
        });
    });

    // Xuất ra phạm vi toàn cục để dùng trong chat.js và các script khác
    window.getEmojiForName = getEmojiForName;
    window.CUTE_EMOJIS = CUTE_EMOJIS;
})();
