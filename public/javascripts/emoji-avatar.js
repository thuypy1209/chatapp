/**
 * ChatFlex - Emoji & Image Avatar dễ thương
 * Tự động gán hình con vật / emoji động vật đáng yêu cho người dùng
 */
(function () {
    'use strict';

    // Danh sách 100% Con Vật (Animals) siêu đáng yêu
    var CUTE_EMOJIS = [
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

    // Tự động cập nhật các phần tử avatar khi trang tải xong
    document.addEventListener('DOMContentLoaded', function () {
        var emojiEl = document.getElementById('nav-user-emoji');
        var nameEl  = document.getElementById('nav-username-display');

        if (emojiEl && nameEl && window.IS_ADMIN !== true) {
            // Nếu đã có thẻ <img> hình con vật bên trong thì giữ nguyên hình ảnh
            var hasImg = emojiEl.querySelector('img');
            if (!hasImg) {
                var username = nameEl.textContent.trim();
                emojiEl.textContent = getEmojiForName(username);
            }
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
