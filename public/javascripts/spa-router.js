/**
 * ChatFlex - Seamless SPA / PJAX Router
 * Giữ trình phát nhạc (HTML5 Audio / YouTube Player / Music Widget) luôn luôn phát liên tục 100% không bị dừng hay ngắt quãng khi người dùng chuyển qua lại giữa các mục:
 * Trang chủ (/), Phòng Chat (/chat), Game Flappy Bangboo (/flappy), Trang Quản trị (/admin).
 */
(function () {
    'use strict';

    if (!window.history || !window.history.pushState || !window.fetch || !window.DOMParser) {
        console.warn('[SPARouter] Trình duyệt không hỗ trợ SPA Router, sử dụng điều hướng reload mặc định.');
        return;
    }

    const ROUTER_CONTAINER_ID = 'app-router-view';
    const PROGRESS_BAR_ID = 'spa-progress-bar';

    let isNavigating = false;

    // --- 1. Quản lý thanh tiến trình Pastel (Progress Bar) trên đỉnh màn hình ---
    function getProgressBar() {
        let bar = document.getElementById(PROGRESS_BAR_ID);
        if (!bar) {
            bar = document.createElement('div');
            bar.id = PROGRESS_BAR_ID;
            bar.style.cssText = 'position:fixed;top:0;left:0;width:0;height:3px;background:linear-gradient(90deg,#ec4899,#f43f5e,#8b5cf6);z-index:999999;transition:width 0.25s ease,opacity 0.3s ease;pointer-events:none;opacity:0;box-shadow:0 0 10px rgba(236,72,153,0.7);';
            document.body.appendChild(bar);
        }
        return bar;
    }

    function startProgress() {
        const bar = getProgressBar();
        bar.style.transition = 'width 0.25s ease, opacity 0.15s ease';
        bar.style.opacity = '1';
        bar.style.width = '35%';
        setTimeout(() => {
            if (isNavigating && bar.style.width === '35%') {
                bar.style.width = '75%';
            }
        }, 120);
    }

    function completeProgress() {
        const bar = getProgressBar();
        bar.style.width = '100%';
        setTimeout(() => {
            bar.style.opacity = '0';
            setTimeout(() => {
                bar.style.width = '0%';
            }, 300);
        }, 180);
    }

    // --- 2. Dọn dẹp tài nguyên trang cũ trước khi hoán đổi (Tránh tiêu tốn CPU/GPU) ---
    function cleanupCurrentPage() {
        // Thoát chế độ toàn màn hình nếu game đang mở fullscreen
        if (typeof window.exitFullscreenMario === 'function') {
            try { window.exitFullscreenMario(); } catch (e) {}
        }

        // Tạm dừng và hủy game Flappy loop để giải phóng GPU/CPU
        if (window.flappyInstance && typeof window.flappyInstance.destroy === 'function') {
            try { window.flappyInstance.destroy(); } catch (e) {}
        }
        if (window.marioInstance && typeof window.marioInstance.destroy === 'function') {
            try { window.marioInstance.destroy(); } catch (e) {}
        }
        window.flappyInstance = null;
        window.marioInstance = null;
        window.flappySideGameInstance = null;
        window.marioSideGameInstance = null;

        // Đóng các modal nổi (Game Over card, v.v.)
        const overlay = document.getElementById('game-card-modal-overlay');
        if (overlay) overlay.style.display = 'none';

        // Đóng hamburger menu trên điện thoại nếu đang mở
        const navbar = document.getElementById('main-navbar');
        if (navbar && navbar.classList.contains('menu-open')) {
            navbar.classList.remove('menu-open');
            const hamburgerBtn = document.getElementById('btn-nav-hamburger');
            if (hamburgerBtn) hamburgerBtn.classList.remove('is-active');
        }
    }

    // --- 3. Thực thi an toàn các đoạn script trong nội dung mới nạp ---
    async function executePageScripts(container) {
        const scripts = Array.from(container.querySelectorAll('script'));
        for (const oldScript of scripts) {
            const newScript = document.createElement('script');
            Array.from(oldScript.attributes).forEach(attr => {
                newScript.setAttribute(attr.name, attr.value);
            });

            if (oldScript.src) {
                // Nạp script bên ngoài tuần tự
                await new Promise((resolve) => {
                    newScript.onload = () => resolve();
                    newScript.onerror = () => resolve();
                    document.head.appendChild(newScript);
                });
            } else {
                newScript.textContent = oldScript.textContent;
                document.head.appendChild(newScript);
            }

            if (oldScript.parentNode) {
                oldScript.parentNode.removeChild(oldScript);
            }
        }
    }

    // --- 4. Kích hoạt logic tương ứng với từng trang sau khi DOM đã được nạp ---
    function initializeNewPage(pathname) {
        const path = pathname.toLowerCase();

        // 1. Đồng bộ active pill trên Navbar chính xác theo đường dẫn mới
        if (typeof window.highlightActivePage === 'function') {
            window.highlightActivePage(path);
        }

        // 2. Trang Game Flappy Bangboo
        if (path === '/flappy' || path.indexOf('/flappy') === 0 || path === '/mario' || path.indexOf('/mario') === 0) {
            document.body.classList.add('game-page-active');
            if (window.moneyRainInstance && typeof window.moneyRainInstance.toggle === 'function') {
                window.moneyRainInstance.toggle(false);
            }
            if (typeof window.initMarioApp === 'function') {
                setTimeout(window.initMarioApp, 40);
            }
        } else {
            document.body.classList.remove('game-page-active');
        }

        // 3. Trang Phòng Chat (/chat hoặc /chat/:id)
        if (path === '/chat' || path.indexOf('/chat') === 0) {
            const msgBox = document.getElementById('message-box');
            if (msgBox) {
                msgBox.scrollTop = msgBox.scrollHeight;
            }
            const chatInput = document.getElementById('chat-free-input');
            if (chatInput && window.innerWidth >= 768) {
                setTimeout(() => chatInput.focus(), 120);
            }
        }

        // 4. Trang Quản trị (/admin)
        if (path === '/admin' || path.indexOf('/admin') === 0) {
            if (typeof window.initAdminEnhancements === 'function') {
                window.initAdminEnhancements();
            }
            if (typeof window.renderMusicVersionsList === 'function') {
                window.renderMusicVersionsList();
            }
            if (typeof window.updateNowPlayingLabel === 'function') {
                window.updateNowPlayingLabel();
            }
            if (typeof window.loadCurrentMusicSetting === 'function') {
                window.loadCurrentMusicSetting();
            }
            if (typeof window.initCollapsibleSections === 'function') {
                window.initCollapsibleSections();
            }
        }
    }

    // --- 5. Hàm tải và chuyển trang chính (Seamless Navigation) ---
    async function navigateTo(url, pushToHistory = true) {
        if (isNavigating) return;

        let targetUrl;
        try {
            targetUrl = new URL(url, window.location.origin);
        } catch (e) {
            window.location.href = url;
            return;
        }

        // Nếu click vào đúng trang hiện tại thì chỉ cuộn lên đầu trang nhẹ nhàng
        if (targetUrl.pathname === window.location.pathname && targetUrl.search === window.location.search) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        const container = document.getElementById(ROUTER_CONTAINER_ID);
        if (!container) {
            window.location.href = url;
            return;
        }

        isNavigating = true;
        startProgress();

        // Hiệu ứng mờ dần nhẹ nhàng của container nội dung
        container.style.transition = 'opacity 0.12s ease';
        container.style.opacity = '0.35';

        try {
            const res = await fetch(targetUrl.href, {
                headers: {
                    'X-PJAX': 'true',
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });

            if (!res.ok) {
                throw new Error('HTTP ' + res.status);
            }

            const htmlText = await res.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlText, 'text/html');

            const newContentEl = doc.getElementById(ROUTER_CONTAINER_ID);
            if (!newContentEl) {
                // Không tìm thấy container router trong trang đích -> chuyển hướng chuẩn
                window.location.href = targetUrl.href;
                return;
            }

            // Dọn dẹp tài nguyên trang cũ
            cleanupCurrentPage();

            // Cập nhật tiêu đề trang
            if (doc.title) {
                document.title = doc.title;
            }

            // Đồng bộ class trên body
            if (doc.body && doc.body.className) {
                document.body.className = doc.body.className;
            } else {
                document.body.className = '';
            }

            // Thay thế nội dung HTML mới
            container.innerHTML = newContentEl.innerHTML;

            // Thực thi scripts trong nội dung mới
            await executePageScripts(container);

            // Cập nhật thanh địa chỉ URL trước khi kích hoạt logic trang mới
            if (pushToHistory) {
                window.history.pushState({ spa: true, url: targetUrl.href }, '', targetUrl.href);
            }

            // Kích hoạt logic trang mới và cập nhật trạng thái menu
            initializeNewPage(targetUrl.pathname);

            // Cuộn lên đầu trang
            window.scrollTo({ top: 0, behavior: 'instant' });

            // Khôi phục hiển thị rõ ràng của container
            container.style.opacity = '1';
            completeProgress();
        } catch (err) {
            console.error('[SPARouter] Chuyển trang gặp sự cố, chuyển tiếp qua trình duyệt:', err);
            completeProgress();
            window.location.href = targetUrl.href;
        } finally {
            isNavigating = false;
        }
    }

    // --- 6. Chặn các cú click vào thẻ <a> nội bộ để chuyển trang không ngắt nhạc ---
    document.addEventListener('click', function (e) {
        const link = e.target.closest('a');
        if (!link) return;

        // Bỏ qua nếu có phím bổ trợ (Ctrl/Cmd click mở tab mới)
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;

        // Bỏ qua nếu có target="_blank" hoặc thuộc tính download
        if (link.target && link.target !== '_self') return;
        if (link.hasAttribute('download')) return;

        // Bỏ qua nếu được đánh dấu không dùng pjax
        if (link.getAttribute('data-no-pjax') === 'true' || link.getAttribute('data-bypass-router') === 'true') return;

        const href = link.getAttribute('href');
        if (!href) return;

        // Bỏ qua hash links (#, #section), mailto:, tel:, javascript:
        if (href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) return;

        let linkUrl;
        try {
            linkUrl = new URL(href, window.location.origin);
        } catch (err) {
            return;
        }

        // Bỏ qua liên kết sang trang web khác
        if (linkUrl.origin !== window.location.origin) return;

        // Bỏ qua đăng xuất, API hoặc tải file
        const pathname = linkUrl.pathname.toLowerCase();
        if (pathname.startsWith('/auth/logout') || pathname.startsWith('/api/') || pathname.startsWith('/uploads/')) {
            return;
        }

        // Chặn reload toàn trang và chuyển bằng SPA Router
        e.preventDefault();
        navigateTo(linkUrl.href, true);
    });

    // --- 7. Bắt sự kiện nút Back / Forward trên trình duyệt (popstate) ---
    window.addEventListener('popstate', function () {
        navigateTo(window.location.href, false);
    });

    // Xuất hàm ra window để có thể gọi chủ động bất cứ khi nào
    window.spaNavigate = navigateTo;

    console.log('✓ [SPARouter] Kích hoạt chế độ chuyển trang liền mạch: Nhạc nền tiếp tục phát 100% khi qua mục khác!');
})();
