/**
 * ChatFlex - Retro Music & Money Control Center
 * Bài hát: "Graduation" - NCT DREAM & Danh sách bài hát hệ thống
 * Tự động đồng bộ toàn hệ thống: Khi Admin đổi nhạc, tất cả người dùng đang online sẽ đổi nhạc theo thời gian thực!
 * Hỗ trợ Autoplay liên tục: Tự động phát khi vào web và tự động chuyển sang bài tiếp theo khi hết bài!
 */

(function () {
    'use strict';

    // Danh sách các bài hát mặc định hệ thống NCT DREAM - "Graduation"
    const DEFAULT_MUSIC_VERSIONS = [
        {
            id: "4EteI8yAsv0",
            title: "Graduation (Relaxing Piano)",
            artist: "Catiano Cover • Không bản quyền",
            badge: "🎹 Relaxing Piano",
            desc: "Bản Piano acoustic nhẹ nhàng phù hợp làm nhạc nền chơi game và trò chuyện",
            speed: 1.0,
            audioUrl: "/audio/bgm.mp3"
        },
        {
            id: "zuoSn3ObMz4",
            title: "Graduation (Special Video MV)",
            artist: "NCT DREAM • SM Entertainment",
            badge: "🎵 Bản MV",
            desc: "Bản Special Video chính thức của NCT DREAM từ Winter Special Mini Album 'Candy'",
            speed: 1.0,
            audioUrl: "/audio/graduation-nct-dream.mp3"
        },
        {
            id: "eF2qrRYiRuM",
            title: "Graduation (Piano Acoustic)",
            artist: "Piano Cover • Không bản quyền",
            badge: "🛡️ Piano Cover",
            desc: "Bản độc tấu Piano êm dịu, không chứa giọng hát gốc, 100% an toàn không bị gắn cờ bản quyền",
            speed: 0.9,
            audioUrl: "/audio/bgm.mp3"
        },
        {
            id: "EznbdoHi0Zs",
            title: "Graduation (Official Audio)",
            artist: "NCT DREAM • SM Entertainment",
            badge: "⭐ Official",
            desc: "Bản nhạc gốc chuẩn chất lượng cao phát hành bởi SM Entertainment",
            speed: 1.0,
            audioUrl: "/audio/graduation-nct-dream.mp3"
        }
    ];

    // Cài đặt ban đầu từ máy chủ (được truyền qua window.SERVER_MUSIC_SETTING)
    const serverSetting = (window.SERVER_MUSIC_SETTING && typeof window.SERVER_MUSIC_SETTING === 'object') ? window.SERVER_MUSIC_SETTING : {};

    // Tự động dọn dẹp các link cũ hỏng nếu có lưu trong trình duyệt
    let storedVersions = null;
    try {
        storedVersions = JSON.parse(localStorage.getItem('chatflex_music_versions'));
        if (Array.isArray(storedVersions) && storedVersions.some(v => v.id === "R234wY4tTes" || v.id === "wcrkltAbh_g")) {
            localStorage.removeItem('chatflex_music_versions');
            storedVersions = null;
        }
    } catch (e) {
        storedVersions = null;
    }

    // Ưu tiên dữ liệu mới nhất từ server nếu có
    const MUSIC_VERSIONS = (serverSetting.versions && Array.isArray(serverSetting.versions) && serverSetting.versions.length > 0)
        ? serverSetting.versions
        : (storedVersions || DEFAULT_MUSIC_VERSIONS);
    try {
        localStorage.setItem('chatflex_music_versions', JSON.stringify(MUSIC_VERSIONS));
    } catch (_) {}

    // Kiểm tra quyền Admin (được truyền từ server qua window.IS_ADMIN)
    const isAdmin = Boolean(window.IS_ADMIN);
    
    let currentVersionIndex = (typeof serverSetting.versionIndex === 'number' && MUSIC_VERSIONS[serverSetting.versionIndex]) ? serverSetting.versionIndex : 0;
    let currentSpeed = serverSetting.speed || 1.0;
    let activeCustomAudioUrl = serverSetting.customAudioUrl || null;
    let lastSettingTimestamp = serverSetting.updatedAt || Date.now();
    let isAutoplayAll = (serverSetting.autoplayAll !== undefined) ? Boolean(serverSetting.autoplayAll) : true;

    let ytPlayer = null;
    let isPlaying = false;
    let isUserPaused = false;
    let toggleLock = false;
    let isMuted = false;
    let volumeLevel = 75; // 0 - 100
    let isPlayerReady = false;
    let hasUserInteracted = false;
    let pendingPlay = false;
    let localAudio = null;

    // Tự động phát hiện môi trường Facebook Messenger, Instagram, TikTok WebView
    const isFBInApp = /FBAN|FBAV|Messenger|Instagram|Line/i.test(navigator.userAgent);
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const DEFAULT_NATIVE_BGM = '/audio/graduation-nct-dream.mp3';
    let isNativeAudioActive = Boolean(activeCustomAudioUrl) || isFBInApp;

    // --- 1. Tạo Giao diện Music Player Widget nổi ---
    function createPlayerUI() {
        if (document.getElementById('chatflex-music-widget')) return;

        const currentVer = MUSIC_VERSIONS[currentVersionIndex] || DEFAULT_MUSIC_VERSIONS[0];
        const cardWidth = isAdmin ? '375px' : '360px';

        const widget = document.createElement('div');
        widget.id = 'chatflex-music-widget';
        widget.innerHTML = `
            <!-- Nút đĩa than thu nhỏ khi Widget đóng (Mặc định luôn thu nhỏ gọn gàng) -->
            <button id="music-min-disc" type="button" title="Mở Trình phát nhạc & Mưa tiền" style="
                display: flex;
                width: 52px;
                height: 52px;
                border-radius: 50%;
                background: radial-gradient(circle, #f43f5e 20%, #1e293b 21%, #0f172a 70%, #f472b6 100%);
                border: 3px solid #fbcfe8;
                box-shadow: 0 6px 18px rgba(244, 63, 94, 0.35);
                cursor: pointer;
                position: relative;
                align-items: center;
                justify-content: center;
                transition: transform 0.2s ease;
            ">
                <span style="font-size: 22px;">💿</span>
                <span id="min-disc-note" style="position: absolute; top: -6px; right: -4px; background: #db2777; color: #fff; font-size: 11px; font-weight: bold; padding: 2px 5px; border-radius: 10px; border: 1.5px solid #fff;">🎵</span>
            </button>

            <!-- Bảng điều khiển mở rộng (Mặc định ẩn, bấm đĩa than để mở) -->
            <div id="music-full-card" style="
                display: none;
                background: rgba(255, 255, 255, 0.96);
                backdrop-filter: blur(14px);
                -webkit-backdrop-filter: blur(14px);
                border: 2px solid #fbcfe8;
                border-radius: 20px;
                box-shadow: 0 10px 32px rgba(219, 39, 119, 0.18), 0 2px 8px rgba(0,0,0,0.06);
                padding: 14px 16px;
                flex-direction: column;
                gap: 10px;
                width: ${cardWidth};
                max-width: calc(100vw - 28px);
                transition: all 0.25s ease;
            ">
                <!-- Thông báo chuyển nhạc trực tiếp từ Admin hoặc Autoplay -->
                <div id="music-sync-toast" style="display: none; background: #ecfdf5; border: 1px solid #a7f3d0; color: #047857; font-size: 11px; font-weight: 700; padding: 4px 8px; border-radius: 8px; text-align: center; animation: fadeIn 0.2s ease;">
                    ✨ Admin vừa đổi bản nhạc!
                </div>

                <!-- Hàng 1: Đĩa than + Thông tin bài hát + Nút thu nhỏ -->
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
                    <div style="display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0;">
                        <!-- Đĩa than xoay tròn khi phát nhạc -->
                        <div id="vinyl-disc" style="
                            width: 44px;
                            height: 44px;
                            border-radius: 50%;
                            background: radial-gradient(circle, #ec4899 22%, #0f172a 24%, #1e293b 72%, #f472b6 100%);
                            border: 2px solid #fbcfe8;
                            box-shadow: 0 3px 10px rgba(0,0,0,0.2);
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            font-size: 18px;
                            flex-shrink: 0;
                            animation: spinVinyl 3.5s linear infinite paused;
                        ">
                            🌸
                        </div>

                        <!-- Tên bài hát & Nghệ sĩ -->
                        <div style="flex: 1; min-width: 0;">
                            <div style="display: flex; align-items: center; gap: 5px; min-width: 0; margin-bottom: 3px;">
                                <span id="music-track-title" style="font-size: 13px; font-weight: 800; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1 1 auto; min-width: 0;" title="${currentVer.title}">${currentVer.title}</span>
                                <span id="equalizer-bars" style="display: none; align-items: flex-end; gap: 2.5px; height: 13px; flex-shrink: 0;">
                                    <span class="eq-bar" style="width: 2.5px; height: 6px; background: #db2777; border-radius: 1px; animation: eqAnim 0.6s infinite ease-in-out alternate;"></span>
                                    <span class="eq-bar" style="width: 2.5px; height: 13px; background: #f43f5e; border-radius: 1px; animation: eqAnim 0.4s infinite ease-in-out alternate 0.15s;"></span>
                                    <span class="eq-bar" style="width: 2.5px; height: 8px; background: #fb7185; border-radius: 1px; animation: eqAnim 0.7s infinite ease-in-out alternate 0.3s;"></span>
                                </span>
                            </div>
                            <div id="music-track-artist" style="font-size: 11px; color: #047857; font-weight: 700; display: flex; align-items: center; gap: 4px;">
                                <span style="background: #ecfdf5; border: 1px solid #a7f3d0; padding: 1.5px 7px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px;">${currentVer.badge || '🎵 MP3 Audio'}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Nút thu nhỏ -->
                    <button id="btn-minimize-music" type="button" title="Thu nhỏ" style="
                        background: #fdf2f8;
                        border: 1px solid #fbcfe8;
                        color: #db2777;
                        width: 26px;
                        height: 26px;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 14px;
                        font-weight: bold;
                        cursor: pointer;
                        flex-shrink: 0;
                        line-height: 1;
                        padding: 0;
                        transition: all 0.15s ease;
                    ">
                        —
                    </button>
                </div>

                <!-- PHẦN DÀNH RIÊNG CHO ADMIN: Chọn phiên bản tránh bản quyền & nạp file nhạc -->
                ${isAdmin ? `
                <div id="admin-music-panel" style="background: #fff7ed; border: 1.5px dashed #fb923c; border-radius: 12px; padding: 8px 10px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11px; font-weight: 800; color: #c2410c; margin-bottom: 5px;">
                        <span>⚙️ Quản trị nhạc (Chỉ Admin thấy):</span>
                        <span id="version-badge-note" style="color: #047857; font-weight: 700;">Đồng bộ toàn web</span>
                    </div>

                    <!-- Menu chọn phiên bản -->
                    <select id="music-version-select" style="
                        width: 100%;
                        padding: 6px 8px;
                        border: 1.5px solid #fdba74;
                        border-radius: 8px;
                        font-size: 11px;
                        font-weight: 600;
                        color: #1e293b;
                        background: #ffffff;
                        outline: none;
                        cursor: pointer;
                        margin-bottom: 6px;
                    ">
                        ${MUSIC_VERSIONS.map((v, i) => `<option value="${i}" ${currentVersionIndex === i ? 'selected' : ''}>${v.badge || '🎵'} ${v.title}</option>`).join('')}
                    </select>

                    <!-- Liên kết đến trang quản trị nhạc -->
                    <a href="/admin#music-management" style="
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 5px;
                        color: #c2410c;
                        font-size: 11px;
                        font-weight: 700;
                        padding: 4px 8px;
                        border-radius: 6px;
                        background: #ffedd5;
                        border: 1px dashed #fb923c;
                        text-decoration: none;
                        width: 100%;
                    " title="Mở trang quản trị để thêm/sửa/xóa phiên bản nhạc">
                        ⚙️ Quản lý danh sách nhạc → Trang Admin
                    </a>
                </div>
                ` : ''}

                <!-- Hàng điều khiển Playback: Prev, Play/Pause, Next, Autoplay, Âm lượng -->
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; background: #fdf2f8; padding: 6px 10px; border-radius: 12px; border: 1px solid #fce7f3;">
                    <!-- Cụm nút Playback -->
                    <div style="display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
                        <!-- Nút Bài trước -->
                        <button id="btn-prev-music" type="button" title="Bài trước đó (⏮)" style="
                            background: #ffffff;
                            color: #db2777;
                            border: 1px solid #fbcfe8;
                            width: 28px;
                            height: 28px;
                            border-radius: 8px;
                            font-size: 11px;
                            font-weight: bold;
                            cursor: pointer;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
                            transition: all 0.15s ease;
                        ">
                            ⏮
                        </button>

                        <!-- Nút Play/Pause lớn -->
                        <button id="btn-play-pause-music" type="button" style="
                            background: #db2777;
                            color: #ffffff;
                            border: none;
                            padding: 5px 12px;
                            border-radius: 8px;
                            font-size: 12px;
                            font-weight: 800;
                            cursor: pointer;
                            display: flex;
                            align-items: center;
                            gap: 5px;
                            box-shadow: 0 2px 8px rgba(219, 39, 119, 0.3);
                            transition: transform 0.1s ease, background 0.15s ease;
                            flex-shrink: 0;
                        ">
                            <span id="play-pause-icon" style="font-size: 11px; letter-spacing: -0.5px;">▶</span> <span id="play-pause-text">Phát</span>
                        </button>

                        <!-- Nút Bài tiếp theo -->
                        <button id="btn-next-music" type="button" title="Bài tiếp theo (⏭)" style="
                            background: #ffffff;
                            color: #db2777;
                            border: 1px solid #fbcfe8;
                            width: 28px;
                            height: 28px;
                            border-radius: 8px;
                            font-size: 11px;
                            font-weight: bold;
                            cursor: pointer;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
                            transition: all 0.15s ease;
                        ">
                            ⏭
                        </button>

                        <!-- Nút Bật/Tắt chế độ tự động phát tiếp (Autoplay Playlist) -->
                        <button id="btn-toggle-autoplay-widget" type="button" title="Tự động phát tiếp toàn bộ danh sách khi hết bài" style="
                            background: ${isAutoplayAll ? '#ecfdf5' : '#f8fafc'};
                            color: ${isAutoplayAll ? '#047857' : '#94a3b8'};
                            border: 1px solid ${isAutoplayAll ? '#a7f3d0' : '#e2e8f0'};
                            height: 28px;
                            padding: 0 7px;
                            border-radius: 8px;
                            font-size: 11px;
                            font-weight: 800;
                            cursor: pointer;
                            display: flex;
                            align-items: center;
                            gap: 3px;
                            transition: all 0.15s ease;
                        ">
                            <span id="widget-autoplay-icon">${isAutoplayAll ? '🔁' : '🔂'}</span>
                            <span id="widget-autoplay-text" style="font-size: 10.5px;">${isAutoplayAll ? 'Auto' : '1 bài'}</span>
                        </button>
                    </div>

                    <!-- Âm lượng: Thiết kế chạm vuốt mượt mà trên điện thoại -->
                    <div id="music-volume-box" style="display: flex; align-items: center; gap: 3px; flex: 1; justify-content: flex-end; touch-action: none; -webkit-tap-highlight-color: transparent;">
                        <button id="btn-toggle-mute" type="button" style="background: none; border: none; font-size: 14px; cursor: pointer; color: #64748b; padding: 2px; display: flex; align-items: center; justify-content: center; touch-action: manipulation;" title="Bật/Tắt tiếng">
                            🔊
                        </button>
                        <div id="music-slider-touch-wrapper" style="position: relative; display: flex; align-items: center; height: 28px; padding: 0 2px; cursor: pointer; touch-action: none;">
                            <input type="range" id="music-volume-slider" min="0" max="100" value="75" style="
                                width: 68px;
                                height: 24px;
                                cursor: pointer;
                                touch-action: none;
                                -webkit-tap-highlight-color: transparent;
                            ">
                        </div>
                    </div>

                    ${isAdmin ? `
                    <!-- Tùy chỉnh tốc độ (Chỉ Admin thấy) -->
                    <div style="display: none; align-items: center; gap: 2px;">
                        <button type="button" class="btn-speed-pill ${currentSpeed === 0.9 ? 'active' : ''}" data-speed="0.9" title="Tốc độ 0.9x">0.9x</button>
                        <button type="button" class="btn-speed-pill ${currentSpeed === 1.0 ? 'active' : ''}" data-speed="1.0" title="Tốc độ 1.0x">1.0x</button>
                    </div>
                    ` : ''}
                </div>

                <!-- Hàng công cụ Mưa tiền xu & tiền giấy -->
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; border-top: 1.5px dashed #fbcfe8; padding-top: 10px; margin-top: 2px;">
                    <!-- Bật/Tắt mưa tiền -->
                    <button id="btn-toggle-money-rain" type="button" style="
                        background: ${(window.IS_CHAT_OR_GAME_PAGE || window.location.pathname.includes('/chat') || window.location.pathname.includes('/flappy') || window.location.pathname.includes('/mario')) ? '#fef2f2' : '#ecfdf5'};
                        border: 1px solid ${(window.IS_CHAT_OR_GAME_PAGE || window.location.pathname.includes('/chat') || window.location.pathname.includes('/flappy') || window.location.pathname.includes('/mario')) ? '#fca5a5' : '#a7f3d0'};
                        color: ${(window.IS_CHAT_OR_GAME_PAGE || window.location.pathname.includes('/chat') || window.location.pathname.includes('/flappy') || window.location.pathname.includes('/mario')) ? '#dc2626' : '#047857'};
                        padding: 6px 10px;
                        border-radius: 8px;
                        font-size: 12px;
                        font-weight: 700;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        gap: 5px;
                        flex: 1;
                        justify-content: center;
                        transition: all 0.15s ease;
                    ">
                        <span id="money-status-icon">${(window.IS_CHAT_OR_GAME_PAGE || window.location.pathname.includes('/chat') || window.location.pathname.includes('/flappy') || window.location.pathname.includes('/mario')) ? '⏹️' : '💸'}</span> 
                        <span id="money-status-text">Mưa tiền: ${(window.IS_CHAT_OR_GAME_PAGE || window.location.pathname.includes('/chat') || window.location.pathname.includes('/flappy') || window.location.pathname.includes('/mario')) ? 'Tắt' : 'Bật'}</span>
                    </button>

                    <!-- Nút Bắn tung tiền bùng nổ -->
                    <button id="btn-burst-money" type="button" style="
                        background: #fef08a;
                        border: 1px solid #facc15;
                        color: #854d0e;
                        padding: 6px 12px;
                        border-radius: 8px;
                        font-size: 12px;
                        font-weight: 800;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        gap: 5px;
                        box-shadow: 0 2px 6px rgba(250, 204, 21, 0.25);
                        flex-shrink: 0;
                        transition: transform 0.15s ease;
                    ">
                        🎉 Tung tiền!
                    </button>
                </div>
            </div>

            <!-- Khung nhúng YouTube ẩn để phát nhạc (Dự phòng cho các link YouTube không có file MP3) -->
            <div id="yt-hidden-container" style="position: fixed; bottom: 0; right: 0; width: 200px; height: 200px; opacity: 0.001; pointer-events: none; z-index: -10; overflow: hidden;">
                <div id="yt-player-element"></div>
            </div>
        `;

        // CSS Định vị Widget ở góc dưới bên phải màn hình
        widget.style.position = 'fixed';
        widget.style.bottom = '58px';
        widget.style.right = '18px';
        widget.style.zIndex = '999';

        const style = document.createElement('style');
        style.textContent = `
            @keyframes spinVinyl {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
            @keyframes eqAnim {
                0% { height: 3px; }
                100% { height: 13px; }
            }
            #music-min-disc:hover {
                transform: scale(1.08);
            }
            #btn-play-pause-music:hover {
                background: #be185d !important;
            }
            #btn-prev-music:hover, #btn-next-music:hover {
                background: #fdf2f8 !important;
                border-color: #db2777 !important;
            }
            #btn-burst-money:hover {
                transform: translateY(-1px);
                background: #fde047 !important;
            }
            .btn-speed-pill:hover {
                border-color: #db2777 !important;
            }

            /* Thanh trượt âm lượng mượt mà trên điện thoại & máy tính */
            #music-volume-slider {
                -webkit-appearance: none;
                appearance: none;
                width: 68px;
                height: 24px;
                background: transparent;
                cursor: pointer;
                touch-action: none !important;
                user-select: none;
                -webkit-user-select: none;
                outline: none;
                margin: 0;
                padding: 0;
                -webkit-tap-highlight-color: transparent;
            }
            #music-volume-slider::-webkit-slider-runnable-track {
                width: 100%;
                height: 7px;
                border-radius: 999px;
                background: var(--vol-track, linear-gradient(to right, #db2777 0%, #db2777 75%, #e2e8f0 75%, #e2e8f0 100%));
                cursor: pointer;
                border: none;
            }
            #music-volume-slider::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 18px;
                height: 18px;
                border-radius: 50%;
                background: #db2777;
                border: 2px solid #ffffff;
                box-shadow: 0 1px 6px rgba(219, 39, 119, 0.5);
                cursor: grab;
                margin-top: -5.5px;
                transition: transform 0.1s ease;
            }
            #music-volume-slider:active::-webkit-slider-thumb {
                transform: scale(1.2);
                cursor: grabbing;
            }
            #music-volume-slider::-moz-range-track {
                width: 100%;
                height: 7px;
                border-radius: 999px;
                background: var(--vol-track, linear-gradient(to right, #db2777 0%, #db2777 75%, #e2e8f0 75%, #e2e8f0 100%));
                border: none;
            }
            #music-volume-slider::-moz-range-thumb {
                width: 18px;
                height: 18px;
                border-radius: 50%;
                background: #db2777;
                border: 2px solid #ffffff;
                box-shadow: 0 1px 6px rgba(219, 39, 119, 0.5);
                border: none;
            }
            @media (max-width: 640px) {
                #chatflex-music-widget {
                    bottom: 84px !important;
                    right: 12px !important;
                }
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(widget);

        attachEventListeners();
    }

    // --- 2. Cập nhật giao diện nút Autoplay trên Widget ---
    function updateAutoplayWidgetUI() {
        const btn = document.getElementById('btn-toggle-autoplay-widget');
        const icon = document.getElementById('widget-autoplay-icon');
        const text = document.getElementById('widget-autoplay-text');
        if (!btn) return;

        if (isAutoplayAll) {
            btn.style.background = '#ecfdf5';
            btn.style.color = '#047857';
            btn.style.borderColor = '#a7f3d0';
            btn.title = 'Đang BẬT Autoplay: Tự phát tiếp toàn bộ danh sách khi hết bài';
            if (icon) icon.innerText = '🔁';
            if (text) text.innerText = 'Auto';
        } else {
            btn.style.background = '#f8fafc';
            btn.style.color = '#64748b';
            btn.style.borderColor = '#cbd5e1';
            btn.title = 'Đang TẮT Autoplay: Chỉ phát lặp lại 1 bài hiện tại';
            if (icon) icon.innerText = '🔂';
            if (text) text.innerText = '1 bài';
        }
    }

    // --- 3. Hàm phát bài hát trung tâm (Hỗ trợ Autoplay liên tục) ---
    function playTrackAtIndex(idx, autoStart = true, reason = 'auto') {
        if (!MUSIC_VERSIONS || MUSIC_VERSIONS.length === 0) return;

        // Chuẩn hóa chỉ số xoay vòng
        const total = MUSIC_VERSIONS.length;
        idx = ((idx % total) + total) % total;
        currentVersionIndex = idx;
        const track = MUSIC_VERSIONS[idx];
        if (!track) return;

        console.log(`[MusicPlayer] 🎵 Đang nạp bài [${idx + 1}/${total}]: "${track.title}" (Lý do: ${reason}, Autoplay: ${isAutoplayAll})`);

        // Cập nhật thông tin trên Widget
        const trackTitle = document.getElementById('music-track-title');
        const trackArtist = document.getElementById('music-track-artist');
        const versionSelect = document.getElementById('music-version-select');
        const versionBadgeNote = document.getElementById('version-badge-note');

        if (trackTitle) {
            trackTitle.innerText = track.title || 'Graduation';
            trackTitle.title = track.title || 'Graduation';
        }
        if (trackArtist) {
            trackArtist.innerHTML = `<span style="background: #ecfdf5; border: 1px solid #a7f3d0; padding: 1.5px 7px; border-radius: 6px; color: #047857; display: inline-flex; align-items: center; gap: 4px;">${track.badge || '🎵 MP3 Audio'}</span>`;
        }
        if (versionSelect) {
            versionSelect.value = idx;
        }
        if (versionBadgeNote) {
            versionBadgeNote.innerText = (idx === 3) ? 'Bản gốc' : 'Không vi phạm Content ID';
            versionBadgeNote.style.color = (idx === 3) ? '#dc2626' : '#047857';
        }

        if (typeof track.speed === 'number') {
            currentSpeed = track.speed;
        }

        // Ưu tiên cao nhất: Phát file âm thanh HTML5 Audio Native
        const hasTrackAudio = Boolean(track.audioUrl || activeCustomAudioUrl);
        const targetAudioSrc = activeCustomAudioUrl || track.audioUrl || DEFAULT_NATIVE_BGM;

        if (hasTrackAudio || isNativeAudioActive || isFBInApp) {
            // Tạm dừng YouTube iframe nếu đang phát
            if (ytPlayer && isPlayerReady && typeof ytPlayer.pauseVideo === 'function') {
                try { ytPlayer.pauseVideo(); } catch(_) {}
            }

            if (!localAudio) {
                localAudio = new Audio();
                localAudio.preload = 'auto';
            }

            try { localAudio.pause(); } catch(_) {}

            localAudio.src = targetAudioSrc;
            localAudio.currentTime = 0;
            localAudio.playbackRate = currentSpeed;
            localAudio.volume = isMuted ? 0 : (volumeLevel / 100);
            localAudio.muted = isMuted;
            // Khi bật Autoplay All thì loop = false để kích hoạt onended chuyển bài tiếp
            localAudio.loop = !isAutoplayAll;

            // Xử lý khi bài hát kết thúc -> Tự động chuyển bài tiếp theo ngay
            localAudio.onended = function () {
                console.log('[MusicPlayer] 🏁 Hết bài:', track.title, '| Autoplay:', isAutoplayAll);
                if (isAutoplayAll) {
                    playTrackAtIndex(currentVersionIndex + 1, true, 'autoplay-ended');
                } else {
                    updateUIState(false);
                }
            };

            // Xử lý khi bài hát bị lỗi tải file -> Tự động bỏ qua sang bài kế tiếp
            localAudio.onerror = function (e) {
                console.warn('[MusicPlayer] ⚠️ File âm thanh lỗi:', targetAudioSrc, e);
                if (isAutoplayAll && MUSIC_VERSIONS.length > 1) {
                    setTimeout(() => {
                        playTrackAtIndex(currentVersionIndex + 1, true, 'autoplay-error-skip');
                    }, 800);
                }
            };

            if (autoStart && !isUserPaused) {
                isPlaying = true;
                localAudio.play().then(() => {
                    updateUIState(true);
                }).catch(err => {
                    console.warn('[MusicPlayer] Chờ người dùng chạm màn hình để phát âm thanh:', err.message);
                });
            }
        }
        // Trường hợp bài chỉ có ID YouTube mà không có file MP3
        else if (track.id) {
            if (localAudio) {
                try { localAudio.pause(); } catch(_) {}
            }

            if (ytPlayer && isPlayerReady) {
                if (autoStart && !isUserPaused) {
                    isPlaying = true;
                    if (typeof ytPlayer.loadVideoById === 'function') {
                        ytPlayer.loadVideoById({
                            videoId: track.id,
                            startSeconds: 0
                        });
                        ytPlayer.setPlaybackRate(currentSpeed);
                        ytPlayer.playVideo();
                        updateUIState(true);
                    }
                } else if (typeof ytPlayer.cueVideoById === 'function') {
                    ytPlayer.cueVideoById({
                        videoId: track.id,
                        startSeconds: 0
                    });
                    ytPlayer.setPlaybackRate(currentSpeed);
                }
            }
        }

        // Hiển thị thông báo nhẹ nhàng khi tự động phát tiếp
        if (reason === 'autoplay-ended' || reason === 'autoplay-error-skip') {
            const toast = document.getElementById('music-sync-toast');
            if (toast) {
                toast.innerText = `🔁 Tự động phát tiếp [${idx + 1}/${total}]: ${track.title}`;
                toast.style.display = 'block';
                setTimeout(() => { toast.style.display = 'none'; }, 3500);
            }
        }
    }

    // Các hàm chuyển bài tiện ích
    function playNextTrack(autoStart = true) {
        playTrackAtIndex(currentVersionIndex + 1, autoStart, 'manual-next');
    }

    function playPrevTrack(autoStart = true) {
        playTrackAtIndex(currentVersionIndex - 1, autoStart, 'manual-prev');
    }

    // Đảo trạng thái Autoplay trên Widget
    function toggleAutoplayMode() {
        isAutoplayAll = !isAutoplayAll;
        if (localAudio) {
            localAudio.loop = !isAutoplayAll;
        }
        updateAutoplayWidgetUI();

        const toast = document.getElementById('music-sync-toast');
        if (toast) {
            toast.innerText = isAutoplayAll ? '🔁 Đã BẬT tự động phát tất cả các bài!' : '🔂 Đã chuyển sang phát lặp 1 bài!';
            toast.style.display = 'block';
            setTimeout(() => { toast.style.display = 'none'; }, 3000);
        }

        // Nếu là Admin, gửi cập nhật lên server để đồng bộ cho toàn hệ thống
        if (isAdmin) {
            fetch('/admin/music-autoplay', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ autoplayAll: isAutoplayAll })
            }).catch(() => {});
        }
    }

    // --- 4. Gán sự kiện cho các nút điều khiển ---
    function attachEventListeners() {
        const fullCard = document.getElementById('music-full-card');
        const minDisc = document.getElementById('music-min-disc');
        const btnMinimize = document.getElementById('btn-minimize-music');
        const btnPlayPause = document.getElementById('btn-play-pause-music');
        const btnPrev = document.getElementById('btn-prev-music');
        const btnNext = document.getElementById('btn-next-music');
        const btnAutoplayWidget = document.getElementById('btn-toggle-autoplay-widget');
        const btnMute = document.getElementById('btn-toggle-mute');
        const volSlider = document.getElementById('music-volume-slider');
        const touchWrapper = document.getElementById('music-slider-touch-wrapper');
        const btnToggleMoney = document.getElementById('btn-toggle-money-rain');
        const btnBurstMoney = document.getElementById('btn-burst-money');

        // Hàm cập nhật màu nền thanh trượt và icon loa
        function updateSliderVisual(val) {
            const pct = Math.max(0, Math.min(100, Math.round(val)));
            if (volSlider) {
                volSlider.value = pct;
                volSlider.style.setProperty('--vol-track', `linear-gradient(to right, #db2777 0%, #db2777 ${pct}%, #e2e8f0 ${pct}%, #e2e8f0 100%)`);
            }
            if (btnMute) {
                btnMute.innerText = (pct === 0) ? '🔇' : '🔊';
            }
        }

        updateSliderVisual(volumeLevel);
        updateAutoplayWidgetUI();

        // Tính âm lượng từ vị trí chạm/kéo trên màn hình
        function setVolumeFromClientX(clientX) {
            const el = touchWrapper || volSlider;
            if (!el) return;
            const rect = el.getBoundingClientRect();
            if (rect.width <= 0) return;
            const offsetX = Math.max(0, Math.min(rect.width, clientX - rect.left));
            const newVol = Math.round((offsetX / rect.width) * 100);
            volumeLevel = newVol;
            isMuted = (newVol === 0);
            updateSliderVisual(newVol);
            setMusicVolume(newVol);
        }

        // Thu nhỏ / Phóng to Widget
        btnMinimize.addEventListener('click', () => {
            fullCard.style.display = 'none';
            minDisc.style.display = 'flex';
        });

        minDisc.addEventListener('click', () => {
            minDisc.style.display = 'none';
            fullCard.style.display = 'flex';
        });

        // Bật / Tạm dừng Nhạc
        btnPlayPause.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleMusic();
        });

        // Nút Bài trước / Bài sau
        if (btnPrev) {
            btnPrev.addEventListener('click', (e) => {
                e.stopPropagation();
                playPrevTrack(true);
            });
        }
        if (btnNext) {
            btnNext.addEventListener('click', (e) => {
                e.stopPropagation();
                playNextTrack(true);
            });
        }

        // Nút Toggle Autoplay trên Widget
        if (btnAutoplayWidget) {
            btnAutoplayWidget.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleAutoplayMode();
            });
        }

        // Sự kiện input âm lượng (Desktop & Mobile)
        if (volSlider) {
            volSlider.addEventListener('input', (e) => {
                volumeLevel = parseInt(e.target.value, 10);
                isMuted = (volumeLevel === 0);
                updateSliderVisual(volumeLevel);
                setMusicVolume(volumeLevel);
            });
            volSlider.addEventListener('change', (e) => {
                volumeLevel = parseInt(e.target.value, 10);
                isMuted = (volumeLevel === 0);
                updateSliderVisual(volumeLevel);
                setMusicVolume(volumeLevel);
            });
        }

        // Chạm vuốt & kéo mượt mà trên cảm ứng Safari iOS / Chrome Mobile
        let isDraggingVol = false;
        const dragTarget = touchWrapper || volSlider;
        if (dragTarget) {
            dragTarget.addEventListener('touchstart', (e) => {
                if (!e.touches || !e.touches[0]) return;
                isDraggingVol = true;
                setVolumeFromClientX(e.touches[0].clientX);
                if (e.cancelable) e.preventDefault();
            }, { passive: false });

            window.addEventListener('touchmove', (e) => {
                if (!isDraggingVol || !e.touches || !e.touches[0]) return;
                setVolumeFromClientX(e.touches[0].clientX);
                if (e.cancelable) e.preventDefault();
            }, { passive: false });

            const stopTouchDrag = () => { isDraggingVol = false; };
            window.addEventListener('touchend', stopTouchDrag);
            window.addEventListener('touchcancel', stopTouchDrag);

            dragTarget.addEventListener('pointerdown', (e) => {
                try { dragTarget.setPointerCapture(e.pointerId); } catch (_) {}
                isDraggingVol = true;
                setVolumeFromClientX(e.clientX);
            });
            dragTarget.addEventListener('pointermove', (e) => {
                if (isDraggingVol && (e.buttons === 1 || e.pointerType === 'touch')) {
                    setVolumeFromClientX(e.clientX);
                }
            });
            dragTarget.addEventListener('pointerup', () => { isDraggingVol = false; });
            dragTarget.addEventListener('pointercancel', () => { isDraggingVol = false; });
        }

        // Nút tắt tiếng (Mute)
        btnMute.addEventListener('click', () => {
            isMuted = !isMuted;
            if (isMuted) {
                updateSliderVisual(0);
                setMusicVolume(0);
            } else {
                const restoreVol = (volumeLevel > 0) ? volumeLevel : 75;
                volumeLevel = restoreVol;
                updateSliderVisual(restoreVol);
                setMusicVolume(restoreVol);
            }
        });

        // CÁC SỰ KIỆN DÀNH CHO ADMIN
        if (isAdmin) {
            const versionSelect = document.getElementById('music-version-select');
            const speedButtons = document.querySelectorAll('.btn-speed-pill');

            // Đổi phiên bản nhạc (Admin) -> Gửi lên Server lưu cho mọi người
            if (versionSelect) {
                versionSelect.addEventListener('change', (e) => {
                    const idx = parseInt(e.target.value, 10);
                    const targetSpeed = (MUSIC_VERSIONS[idx] && typeof MUSIC_VERSIONS[idx].speed === 'number') ? MUSIC_VERSIONS[idx].speed : currentSpeed;
                    adminSaveMusicVersion(idx, targetSpeed);
                });
            }

            // Chỉnh tốc độ (Admin) -> Lưu lên Server
            speedButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    const speed = parseFloat(btn.getAttribute('data-speed'));
                    currentSpeed = speed;
                    adminSaveMusicVersion(currentVersionIndex, speed);

                    speedButtons.forEach(b => {
                        b.classList.remove('active');
                        b.style.background = '#fff';
                        b.style.color = '#1e293b';
                        b.style.borderColor = '#fbcfe8';
                    });
                    btn.classList.add('active');
                    btn.style.background = '#db2777';
                    btn.style.color = '#fff';
                    btn.style.borderColor = '#db2777';
                });
            });
        }

        // Bật / Tắt mưa tiền
        btnToggleMoney.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!window.moneyRainInstance && typeof MoneyRainEngine === 'function') {
                window.moneyRainInstance = new MoneyRainEngine();
            }
            if (window.moneyRainInstance) {
                const active = window.moneyRainInstance.toggle();
                const icon = document.getElementById('money-status-icon');
                const text = document.getElementById('money-status-text');
                if (active) {
                    if (icon) icon.innerText = '💸';
                    if (text) text.innerText = 'Mưa tiền: Bật';
                    btnToggleMoney.style.background = '#ecfdf5';
                    btnToggleMoney.style.color = '#047857';
                    btnToggleMoney.style.borderColor = '#a7f3d0';
                } else {
                    if (icon) icon.innerText = '⏹️';
                    if (text) text.innerText = 'Mưa tiền: Tắt';
                    btnToggleMoney.style.background = '#fef2f2';
                    btnToggleMoney.style.color = '#dc2626';
                    btnToggleMoney.style.borderColor = '#fca5a5';
                }
            }
        });

        // Bắn tung tiền bùng nổ
        let isBurstCoolingDown = false;
        let burstSpamClickCount = 0;
        let burstResetTimer = null;

        btnBurstMoney.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!window.moneyRainInstance && typeof MoneyRainEngine === 'function') {
                window.moneyRainInstance = new MoneyRainEngine();
            }
            if (!window.moneyRainInstance) return;

            if (isBurstCoolingDown) {
                btnBurstMoney.style.transform = 'scale(0.95)';
                setTimeout(() => { btnBurstMoney.style.transform = 'none'; }, 100);
                return;
            }

            burstSpamClickCount++;
            clearTimeout(burstResetTimer);
            burstResetTimer = setTimeout(() => {
                burstSpamClickCount = 0;
            }, 2500);

            const rect = btnBurstMoney.getBoundingClientRect();
            window.moneyRainInstance.burstAt(rect.left + rect.width / 2, rect.top, 25, true);

            const isSpamming = burstSpamClickCount >= 3;
            const cooldownTime = isSpamming ? 1500 : 500;

            isBurstCoolingDown = true;
            btnBurstMoney.style.pointerEvents = 'none';
            btnBurstMoney.style.opacity = '0.65';
            btnBurstMoney.style.transform = 'scale(0.95)';
            const originalText = '🎉 Tung tiền!';

            if (isSpamming) {
                btnBurstMoney.innerText = '⏳ Chờ tí...';
            }

            setTimeout(() => {
                isBurstCoolingDown = false;
                btnBurstMoney.style.pointerEvents = 'auto';
                btnBurstMoney.style.opacity = '1';
                btnBurstMoney.style.transform = 'none';
                btnBurstMoney.innerText = originalText;
            }, cooldownTime);
        });

        // Bắt đầu mở tiếng và phát ngay khi có bất kỳ tương tác nào (Chạm, lướt, bấm phím)
        let unlocked = false;
        const unlockAndPlay = () => {
            if (isUserPaused) return;
            hasUserInteracted = true;
            unlocked = true;

            if (localAudio) {
                localAudio.muted = isMuted;
                localAudio.volume = isMuted ? 0 : (volumeLevel / 100);
                localAudio.play().then(() => {
                    updateUIState(true);
                    isPlaying = true;
                }).catch((e) => {
                    console.warn('[MusicPlayer] Lỗi unlock localAudio:', e);
                });
            } else if (ytPlayer && isPlayerReady) {
                try {
                    if (typeof ytPlayer.unMute === 'function') ytPlayer.unMute();
                    if (typeof ytPlayer.setVolume === 'function') ytPlayer.setVolume(volumeLevel > 0 ? volumeLevel : 75);
                    if (typeof ytPlayer.playVideo === 'function') ytPlayer.playVideo();
                    updateUIState(true);
                    isPlaying = true;
                } catch(_) {}
            } else {
                playTrackAtIndex(currentVersionIndex, true, 'unlock');
            }

            // Mở khóa Web Audio context
            try {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (AudioCtx) {
                    if (!window._globalAudioCtx) window._globalAudioCtx = new AudioCtx();
                    if (window._globalAudioCtx.state === 'suspended') {
                        window._globalAudioCtx.resume();
                    }
                }
            } catch (_) {}

            const hint = document.getElementById('music-mobile-hint');
            if (hint && hint.parentNode) hint.parentNode.removeChild(hint);
        };

        // Lắng nghe tương tác đầu tiên để unlock audio
        ['click', 'touchstart', 'touchend', 'pointerup', 'scroll'].forEach(evt => {
            window.addEventListener(evt, () => {
                if (!unlocked || !isPlaying) unlockAndPlay();
            }, { capture: true, passive: true });
        });
        document.addEventListener('keydown', () => {
            if (!unlocked || !isPlaying) unlockAndPlay();
        }, { capture: true });

        // Hiển thị pill nhắc chạm nhẹ trên Mobile nếu sau 2s chưa có tương tác
        if (isMobileUA || isFBInApp) {
            setTimeout(() => {
                if (!unlocked && !isPlaying) {
                    const hint = document.createElement('div');
                    hint.id = 'music-mobile-hint';
                    hint.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#db2777;color:#fff;padding:10px 22px;border-radius:999px;font-size:13px;font-weight:800;z-index:9999;box-shadow:0 4px 18px rgba(219,39,119,0.5);cursor:pointer;animation:pulse 1.2s infinite;display:flex;align-items:center;gap:6px;white-space:nowrap;user-select:none;';
                    hint.innerHTML = '🎵 Chạm vào màn hình để bật âm thanh';
                    const triggerHintPlay = (ev) => {
                        if (ev && ev.stopPropagation) ev.stopPropagation();
                        unlockAndPlay();
                        if (hint.parentNode) hint.parentNode.removeChild(hint);
                    };
                    hint.addEventListener('click', triggerHintPlay);
                    hint.addEventListener('touchend', triggerHintPlay);
                    document.body.appendChild(hint);
                    setTimeout(() => { if (hint.parentNode) hint.remove(); }, 10000);
                }
            }, 2000);
        }

        // Khởi động đồng bộ thời gian thực từ server
        startRealtimeSync();
    }

    // --- 5. Admin lưu cài đặt nhạc lên Server ---
    function adminSaveMusicVersion(idx, speed) {
        currentVersionIndex = idx;
        currentSpeed = speed;
        activeCustomAudioUrl = null;

        playTrackAtIndex(idx, true, 'admin-local-change');

        fetch('/admin/music-setting', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ versionIndex: idx, speed: speed })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success && data.setting) {
                lastSettingTimestamp = data.setting.updatedAt || Date.now();
                console.log('✓ Admin đã lưu cài đặt nhạc mới cho toàn hệ thống:', data.setting);
            }
        })
        .catch(err => {
            console.error('Lỗi khi Admin lưu cài đặt nhạc:', err);
        });
    }

    // --- 6. Đồng bộ thời gian thực từ server (Polling an toàn không đè Autoplay) ---
    function startRealtimeSync() {
        setInterval(() => {
            fetch('/api/music-setting')
                .then(res => res.json())
                .then(data => {
                    if (!data) return;

                    // 1. Đồng bộ danh sách bài hát nếu Admin thêm/sửa/xóa bài trên trang quản trị
                    if (Array.isArray(data.versions) && data.versions.length > 0) {
                        const isListDifferent = (data.versions.length !== MUSIC_VERSIONS.length) ||
                            data.versions.some((v, idx) => !MUSIC_VERSIONS[idx] || v.id !== MUSIC_VERSIONS[idx].id || v.title !== MUSIC_VERSIONS[idx].title || v.audioUrl !== MUSIC_VERSIONS[idx].audioUrl);
                        
                        if (isListDifferent) {
                            MUSIC_VERSIONS.length = 0;
                            MUSIC_VERSIONS.push(...data.versions);
                            try {
                                localStorage.setItem('chatflex_music_versions', JSON.stringify(MUSIC_VERSIONS));
                            } catch (_) {}
                            
                            const versionSelect = document.getElementById('music-version-select');
                            if (versionSelect) {
                                versionSelect.innerHTML = MUSIC_VERSIONS.map((v, i) => `<option value="${i}" ${currentVersionIndex === i ? 'selected' : ''}>${v.badge || '🎵'} ${v.title}</option>`).join('');
                            }
                        }
                    }

                    // 2. Đồng bộ chế độ Autoplay All nếu có thay đổi từ Admin
                    if (typeof data.autoplayAll === 'boolean' && data.autoplayAll !== isAutoplayAll) {
                        isAutoplayAll = data.autoplayAll;
                        if (localAudio) {
                            localAudio.loop = !isAutoplayAll;
                        }
                        updateAutoplayWidgetUI();
                    }

                    // 3. CHỈ KHI NÀO ADMIN THẬT SỰ BẤM ĐỔI BÀI TRÊN SERVER (updatedAt mới hơn)
                    // THÌ MỚI ĐỔI BÀI THEO ADMIN. TUYỆT ĐỐI KHÔNG ĐÈ KHI CLIENT ĐANG TỰ PHÁT TIẾP!
                    const serverTimestamp = data.updatedAt ? new Date(data.updatedAt).getTime() : 0;
                    const localTimestamp = (typeof lastSettingTimestamp === 'number') ? lastSettingTimestamp : new Date(lastSettingTimestamp).getTime();

                    if (serverTimestamp > localTimestamp) {
                        console.log('⚡ Admin vừa cập nhật bài hát mới trên server:', data);
                        lastSettingTimestamp = serverTimestamp;
                        activeCustomAudioUrl = data.customAudioUrl || null;

                        if (typeof data.versionIndex === 'number' && MUSIC_VERSIONS[data.versionIndex]) {
                            playTrackAtIndex(data.versionIndex, isPlaying && !isUserPaused, 'admin-sync');
                        }

                        const toast = document.getElementById('music-sync-toast');
                        if (toast) {
                            toast.innerText = '✨ Admin vừa đổi bản nhạc!';
                            toast.style.display = 'block';
                            setTimeout(() => { toast.style.display = 'none'; }, 3500);
                        }
                    }

                    // 4. Đồng bộ tiêu đề thương hiệu website thời gian thực
                    fetch('/api/brand-setting')
                        .then(r => r.json())
                        .then(bData => {
                            if (bData && bData.brand) {
                                const brand = bData.brand;
                                const navBrand = document.querySelector('.navbar-brand');
                                const navBrandIcon = document.querySelector('.navbar-brand .brand-icon');
                                const navBrandText = document.querySelector('.navbar-brand .brand-text');
                                const targetIcon = (brand.brandIcon && brand.brandIcon.trim()) ? brand.brandIcon.trim() : '';

                                if (targetIcon) {
                                    if (navBrandIcon) {
                                        navBrandIcon.textContent = targetIcon;
                                        navBrandIcon.style.display = 'inline-block';
                                    } else if (navBrand && navBrandText) {
                                        const newIcon = document.createElement('span');
                                        newIcon.className = 'brand-icon';
                                        newIcon.textContent = targetIcon;
                                        navBrand.insertBefore(newIcon, navBrandText);
                                    }
                                } else if (navBrandIcon) {
                                    navBrandIcon.style.display = 'none';
                                    navBrandIcon.textContent = '';
                                }

                                if (navBrandText && brand.brandTitle && navBrandText.textContent.trim() !== brand.brandTitle.trim()) {
                                    navBrandText.textContent = brand.brandTitle.trim();
                                }
                            }
                        })
                        .catch(() => {});
                })
                .catch(() => {});
        }, 3500);
    }

    // --- 7. Tích hợp YouTube IFrame Player API (Dự phòng cho video YouTube thuần) ---
    function loadYouTubeAPI() {
        if (window.YT && window.YT.Player) {
            initYouTubePlayer();
            return;
        }

        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

        window.onYouTubeIframeAPIReady = function () {
            initYouTubePlayer();
        };
    }

    function initYouTubePlayer() {
        try {
            const currentTrack = MUSIC_VERSIONS[currentVersionIndex] || DEFAULT_MUSIC_VERSIONS[0];
            const defaultVideoId = currentTrack.id || '4EteI8yAsv0';

            ytPlayer = new window.YT.Player('yt-player-element', {
                height: '200',
                width: '200',
                videoId: defaultVideoId,
                playerVars: {
                    autoplay: 0,
                    controls: 0,
                    loop: 0, // Không đặt loop = 1 để kích hoạt sự kiện ENDED
                    modestbranding: 1,
                    rel: 0,
                    origin: window.location.origin,
                    playsinline: 1,
                    enablejsapi: 1
                },
                events: {
                    onReady: (event) => {
                        isPlayerReady = true;
                        try {
                            if (typeof event.target.unMute === 'function') event.target.unMute();
                            event.target.setVolume(volumeLevel > 0 ? volumeLevel : 75);
                            event.target.setPlaybackRate(currentSpeed || 1.0);
                        } catch(_) {}
                    },
                    onStateChange: (event) => {
                        if (event.data === window.YT.PlayerState.PLAYING) {
                            if (isUserPaused) {
                                if (ytPlayer && typeof ytPlayer.pauseVideo === 'function') {
                                    ytPlayer.pauseVideo();
                                }
                                updateUIState(false);
                            } else {
                                updateUIState(true);
                            }
                        } else if (event.data === window.YT.PlayerState.PAUSED) {
                            updateUIState(false);
                        } else if (event.data === window.YT.PlayerState.ENDED) {
                            console.log('[MusicPlayer] Video YouTube kết thúc, isAutoplayAll =', isAutoplayAll);
                            if (isAutoplayAll) {
                                playTrackAtIndex(currentVersionIndex + 1, true, 'autoplay-ended');
                            } else {
                                updateUIState(false);
                            }
                        }
                    },
                    onError: (err) => {
                        console.warn('[MusicPlayer] Lỗi YouTube IFrame, bỏ qua hoặc chuyển tiếp:', err);
                        if (isAutoplayAll && MUSIC_VERSIONS.length > 1) {
                            setTimeout(() => {
                                playTrackAtIndex(currentVersionIndex + 1, true, 'autoplay-error-skip');
                            }, 800);
                        }
                    }
                }
            });
        } catch (e) {
            console.error('Lỗi khởi tạo YouTube player:', e);
        }
    }

    // --- 8. Các hàm điều khiển Âm nhạc cơ bản ---
    function playMusic() {
        isUserPaused = false;
        if (localAudio && localAudio.src) {
            localAudio.play().then(() => {
                updateUIState(true);
            }).catch(() => {
                playTrackAtIndex(currentVersionIndex, true, 'playMusic-fallback');
            });
            return;
        }
        playTrackAtIndex(currentVersionIndex, true, 'playMusic');
    }

    function pauseMusic() {
        isUserPaused = true;
        if (ytPlayer && isPlayerReady && typeof ytPlayer.pauseVideo === 'function') {
            try { ytPlayer.pauseVideo(); } catch(_) {}
        }
        if (localAudio) {
            try { localAudio.pause(); } catch(_) {}
        }
        updateUIState(false);
    }

    function toggleMusic() {
        if (toggleLock) return;
        toggleLock = true;
        setTimeout(() => { toggleLock = false; }, 300);

        if (isPlaying) {
            pauseMusic();
        } else {
            playMusic();
        }
    }

    function setMusicVolume(val) {
        const clampedVal = Math.max(0, Math.min(100, Math.round(val)));
        if (ytPlayer && isPlayerReady) {
            try {
                if (clampedVal === 0) {
                    if (typeof ytPlayer.mute === 'function') ytPlayer.mute();
                } else {
                    if (typeof ytPlayer.unMute === 'function') ytPlayer.unMute();
                    if (typeof ytPlayer.setVolume === 'function') ytPlayer.setVolume(clampedVal);
                }
            } catch (err) {
                console.warn('[MusicPlayer] ytPlayer volume error:', err);
            }
        }
        if (localAudio) {
            try {
                localAudio.volume = clampedVal / 100;
                localAudio.muted = (clampedVal === 0);
            } catch (err) {
                console.warn('[MusicPlayer] localAudio volume error:', err);
            }
        }
    }

    // Cập nhật giao diện khi trạng thái phát/dừng thay đổi
    function updateUIState(playing) {
        isPlaying = playing;
        const disc = document.getElementById('vinyl-disc');
        const minDisc = document.getElementById('music-min-disc');
        const eqBars = document.getElementById('equalizer-bars');
        const playIcon = document.getElementById('play-pause-icon');
        const playText = document.getElementById('play-pause-text');

        if (playing) {
            if (disc) disc.style.animationPlayState = 'running';
            if (minDisc) minDisc.style.animation = 'spinVinyl 3.5s linear infinite';
            if (eqBars) eqBars.style.display = 'flex';
            if (playIcon) playIcon.innerText = '❚❚';
            if (playText) playText.innerText = 'Tạm dừng';
        } else {
            if (disc) disc.style.animationPlayState = 'paused';
            if (minDisc) minDisc.style.animation = 'none';
            if (eqBars) eqBars.style.display = 'none';
            if (playIcon) playIcon.innerText = '▶';
            if (playText) playText.innerText = 'Phát';
        }
    }

    // Khởi tạo
    function init() {
        createPlayerUI();
        // Nạp và phát bài được chọn ngay lập tức
        playTrackAtIndex(currentVersionIndex, true, 'init');
        // Tải YouTube API dự phòng
        loadYouTubeAPI();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Export API toàn cục để tiện kiểm tra hoặc tương tác từ console / script khác
    window.chatflexMusicPlayer = {
        playTrack: playTrackAtIndex,
        nextTrack: playNextTrack,
        prevTrack: playPrevTrack,
        togglePlay: toggleMusic,
        play: playMusic,
        pause: pauseMusic,
        toggleAutoplay: toggleAutoplayMode,
        setVolume: setMusicVolume,
        getVersions: () => MUSIC_VERSIONS,
        getCurrentIndex: () => currentVersionIndex,
        isAutoplay: () => isAutoplayAll
    };

})();
