/**
 * ChatFlex - Retro Music & Money Control Center
 * Bài hát: "Graduation" - NCT DREAM
 * Tự động đồng bộ toàn hệ thống: Khi Admin đổi nhạc, tất cả người dùng đang online sẽ đổi nhạc theo thời gian thực!
 */

(function () {
    'use strict';

    // Danh sách các phiên bản nhạc NCT DREAM - "Graduation" (Đã kiểm tra 100% hoạt động trên YouTube)
    const DEFAULT_MUSIC_VERSIONS = [
        {
            id: "4EteI8yAsv0",
            title: "Graduation (Relaxing Piano)",
            artist: "Catiano Cover • Không bản quyền",
            badge: "🎹 Relaxing Piano",
            desc: "Bản Piano acoustic nhẹ nhàng phù hợp làm nhạc nền chơi game và trò chuyện",
            audioUrl: "/audio/bgm.mp3"
        },
        {
            id: "zuoSn3ObMz4",
            title: "Graduation (Special Video MV)",
            artist: "NCT DREAM • SM Entertainment",
            badge: "🎵 Bản MV",
            desc: "Bản Special Video chính thức của NCT DREAM từ Winter Special Mini Album 'Candy'",
            audioUrl: "/audio/graduation-nct-dream.mp3"
        },
        {
            id: "eF2qrRYiRuM",
            title: "Graduation (Piano Acoustic)",
            artist: "Piano Cover • Không bản quyền",
            badge: "🛡️ Piano Cover",
            desc: "Bản độc tấu Piano êm dịu, không chứa giọng hát gốc, 100% an toàn không bị gắn cờ bản quyền",
            audioUrl: "/audio/bgm.mp3"
        },
        {
            id: "EznbdoHi0Zs",
            title: "Graduation (Official Audio)",
            artist: "NCT DREAM • SM Entertainment",
            badge: "⭐ Official",
            desc: "Bản nhạc gốc chuẩn chất lượng cao phát hành bởi SM Entertainment",
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

    // Ưu tiên dữ liệu mới nhất từ server nếu có (đảm bảo điện thoại luôn cập nhật phiên bản mới nhất ngay khi mở)
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

    let ytPlayer = null;
    let isPlaying = false;
    let isUserPaused = false;
    let toggleLock = false;
    let isMuted = false;
    let volumeLevel = 75; // 0 - 100
    let isPlayerReady = false;
    let hasUserInteracted = false;
    let pendingPlay = false; // Chờ player ready rồi phát (khi người dùng click trước khi player load xong)
    let localAudio = null;

    // Tự động phát hiện môi trường Facebook Messenger, Instagram, TikTok WebView
    const isFBInApp = /FBAN|FBAV|Messenger|Instagram|Line/i.test(navigator.userAgent);
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const DEFAULT_NATIVE_BGM = '/audio/graduation-nct-dream.mp3';
    let isNativeAudioActive = Boolean(activeCustomAudioUrl) || isFBInApp;

    // Khởi tạo đối tượng HTML5 Audio (chạy độc lập, tương thích 100% với Messenger In-App Browser)
    function initNativeAudio(src) {
        const currentVer = (MUSIC_VERSIONS && MUSIC_VERSIONS[currentVersionIndex]) ? MUSIC_VERSIONS[currentVersionIndex] : null;
        const audioSrc = src || (currentVer && currentVer.audioUrl) || activeCustomAudioUrl || DEFAULT_NATIVE_BGM;
        if (!localAudio) {
            localAudio = new Audio(audioSrc);
            localAudio.loop = true;
            localAudio.preload = 'auto';
            localAudio.volume = volumeLevel / 100;
            localAudio.playbackRate = currentSpeed;
        } else if (localAudio.src !== audioSrc && !localAudio.src.endsWith(audioSrc)) {
            localAudio.src = audioSrc;
            localAudio.playbackRate = currentSpeed;
        }
        return localAudio;
    }

    // Tự động chuyển sang HTML5 Audio khi YouTube bị Messenger/trình duyệt chặn
    function fallbackToNativeAudio() {
        console.warn('[MusicPlayer] Chuyển đổi sang HTML5 Audio Native để đảm bảo phát được trên Messenger/Mobile');
        isNativeAudioActive = true;
        if (ytPlayer && typeof ytPlayer.pauseVideo === 'function') {
            try { ytPlayer.pauseVideo(); } catch(_) {}
        }
        const currentVer = MUSIC_VERSIONS[currentVersionIndex];
        const targetSrc = activeCustomAudioUrl || (currentVer && currentVer.audioUrl) || DEFAULT_NATIVE_BGM;
        initNativeAudio(targetSrc);
        playMusic();
    }

    // --- 1. Tạo Giao diện Music Player Widget nổi ---
    function createPlayerUI() {
        if (document.getElementById('chatflex-music-widget')) return;

        const currentVer = MUSIC_VERSIONS[currentVersionIndex];
        const cardWidth = isAdmin ? '365px' : '350px';

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
                <!-- Thông báo chuyển nhạc trực tiếp từ Admin -->
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
                                <span id="music-track-title" style="font-size: 13px; font-weight: 800; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1 1 auto; min-width: 0;" title="${activeCustomAudioUrl ? 'Nhạc tùy chỉnh' : currentVer.title}">${activeCustomAudioUrl ? 'Nhạc tùy chỉnh' : currentVer.title}</span>
                                <span id="equalizer-bars" style="display: none; align-items: flex-end; gap: 2.5px; height: 13px; flex-shrink: 0;">
                                    <span class="eq-bar" style="width: 2.5px; height: 6px; background: #db2777; border-radius: 1px; animation: eqAnim 0.6s infinite ease-in-out alternate;"></span>
                                    <span class="eq-bar" style="width: 2.5px; height: 13px; background: #f43f5e; border-radius: 1px; animation: eqAnim 0.4s infinite ease-in-out alternate 0.15s;"></span>
                                    <span class="eq-bar" style="width: 2.5px; height: 8px; background: #fb7185; border-radius: 1px; animation: eqAnim 0.7s infinite ease-in-out alternate 0.3s;"></span>
                                </span>
                            </div>
                            <div id="music-track-artist" style="font-size: 11px; color: #047857; font-weight: 700; display: flex; align-items: center; gap: 4px;">
                                <span style="background: #ecfdf5; border: 1px solid #a7f3d0; padding: 1.5px 7px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px;">${activeCustomAudioUrl ? '📁 File MP3 Admin' : currentVer.badge}</span>
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
                        ${MUSIC_VERSIONS.map((v, i) => `<option value="${i}" ${currentVersionIndex === i ? 'selected' : ''}>${v.badge} ${v.title}</option>`).join('')}
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
                        ⚙️ Quản lý phiên bản nhạc → Trang Admin
                    </a>
                </div>
                ` : ''}

                <!-- Hàng điều khiển Play/Pause + Âm lượng + Tốc độ (Tốc độ chỉ hiển thị nếu là Admin) -->
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; background: #fdf2f8; padding: 6px 12px; border-radius: 12px; border: 1px solid #fce7f3;">
                    <!-- Nút Play/Pause lớn -->
                    <button id="btn-play-pause-music" type="button" style="
                        background: #db2777;
                        color: #ffffff;
                        border: none;
                        padding: 6px 15px;
                        border-radius: 10px;
                        font-size: 12px;
                        font-weight: 800;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        box-shadow: 0 2px 8px rgba(219, 39, 119, 0.3);
                        transition: transform 0.1s ease, background 0.15s ease;
                        flex-shrink: 0;
                    ">
                        <span id="play-pause-icon" style="font-size: 11px; letter-spacing: -0.5px;">▶</span> <span id="play-pause-text">Phát</span>
                    </button>

                    <!-- Âm lượng: Thiết kế chạm vuốt mượt mà trên điện thoại -->
                    <div id="music-volume-box" style="display: flex; align-items: center; gap: 4px; flex: 1; justify-content: flex-end; touch-action: none; -webkit-tap-highlight-color: transparent;">
                        <button id="btn-toggle-mute" type="button" style="background: none; border: none; font-size: 15px; cursor: pointer; color: #64748b; padding: 4px; display: flex; align-items: center; justify-content: center; touch-action: manipulation;" title="Bật/Tắt tiếng">
                            🔊
                        </button>
                        <div id="music-slider-touch-wrapper" style="position: relative; display: flex; align-items: center; height: 32px; padding: 0 4px; cursor: pointer; touch-action: none;">
                            <input type="range" id="music-volume-slider" min="0" max="100" value="75" style="
                                width: 80px;
                                height: 28px;
                                cursor: pointer;
                                touch-action: none;
                                -webkit-tap-highlight-color: transparent;
                            ">
                        </div>
                    </div>

                    ${isAdmin ? `
                    <!-- Tùy chỉnh tốc độ (Chỉ Admin thấy) -->
                    <div style="display: flex; align-items: center; gap: 2px;">
                        <button type="button" class="btn-speed-pill ${currentSpeed === 0.9 ? 'active' : ''}" data-speed="0.9" title="Tốc độ 0.9x (Slowed chill)" style="background: ${currentSpeed === 0.9 ? '#db2777' : '#fff'}; color: ${currentSpeed === 0.9 ? '#fff' : '#1e293b'}; border: 1px solid ${currentSpeed === 0.9 ? '#db2777' : '#fbcfe8'}; font-size: 10px; font-weight: 700; padding: 3px 5px; border-radius: 5px; cursor: pointer;">0.9x</button>
                        <button type="button" class="btn-speed-pill ${currentSpeed === 1.0 ? 'active' : ''}" data-speed="1.0" title="Tốc độ 1.0x (Chuẩn)" style="background: ${currentSpeed === 1.0 ? '#db2777' : '#fff'}; color: ${currentSpeed === 1.0 ? '#fff' : '#1e293b'}; border: 1px solid ${currentSpeed === 1.0 ? '#db2777' : '#fbcfe8'}; font-size: 10px; font-weight: 700; padding: 3px 5px; border-radius: 5px; cursor: pointer;">1.0x</button>
                        <button type="button" class="btn-speed-pill ${currentSpeed === 1.05 ? 'active' : ''}" data-speed="1.05" title="Tốc độ 1.05x (Pitch-up)" style="background: ${currentSpeed === 1.05 ? '#db2777' : '#fff'}; color: ${currentSpeed === 1.05 ? '#fff' : '#1e293b'}; border: 1px solid ${currentSpeed === 1.05 ? '#db2777' : '#fbcfe8'}; font-size: 10px; font-weight: 700; padding: 3px 5px; border-radius: 5px; cursor: pointer;">1.05x</button>
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

            <!-- Khung nhúng YouTube ẩn để phát nhạc (Tối ưu cho cả Facebook Messenger & Safari iOS) -->
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
                width: 80px;
                height: 28px;
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
                height: 8px;
                border-radius: 999px;
                background: var(--vol-track, linear-gradient(to right, #db2777 0%, #db2777 75%, #e2e8f0 75%, #e2e8f0 100%));
                cursor: pointer;
                border: none;
            }
            #music-volume-slider::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 20px;
                height: 20px;
                border-radius: 50%;
                background: #db2777;
                border: 2px solid #ffffff;
                box-shadow: 0 1px 6px rgba(219, 39, 119, 0.5);
                cursor: grab;
                margin-top: -6px;
                transition: transform 0.1s ease;
            }
            #music-volume-slider:active::-webkit-slider-thumb {
                transform: scale(1.2);
                cursor: grabbing;
            }
            #music-volume-slider::-moz-range-track {
                width: 100%;
                height: 8px;
                border-radius: 999px;
                background: var(--vol-track, linear-gradient(to right, #db2777 0%, #db2777 75%, #e2e8f0 75%, #e2e8f0 100%));
                border: none;
            }
            #music-volume-slider::-moz-range-thumb {
                width: 20px;
                height: 20px;
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

    // --- 2. Gán sự kiện cho các nút điều khiển ---
    function attachEventListeners() {
        const fullCard = document.getElementById('music-full-card');
        const minDisc = document.getElementById('music-min-disc');
        const btnMinimize = document.getElementById('btn-minimize-music');
        const btnPlayPause = document.getElementById('btn-play-pause-music');
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

        // Cập nhật giao diện thanh âm lượng ban đầu
        updateSliderVisual(volumeLevel);

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

        // 1. Sự kiện input native (Desktop & Mobile)
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

        // 2. Chạm vuốt & kéo mượt mà trên cảm ứng Safari iOS / Chrome Mobile
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

            // Pointer Events
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

            // Đổi phiên bản nhạc tránh bản quyền (Admin) -> Gửi lên Server lưu cho mọi người
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

        // Bắn tung tiền bùng nổ (Có giới hạn số lần bấm & chống lag khi spam click)
        let isBurstCoolingDown = false;
        let burstSpamClickCount = 0;
        let burstResetTimer = null;

        btnBurstMoney.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!window.moneyRainInstance && typeof MoneyRainEngine === 'function') {
                window.moneyRainInstance = new MoneyRainEngine();
            }
            if (!window.moneyRainInstance) return;

            // Nếu đang trong thời gian hồi chiêu
            if (isBurstCoolingDown) {
                btnBurstMoney.style.transform = 'scale(0.95)';
                setTimeout(() => { btnBurstMoney.style.transform = 'none'; }, 100);
                return;
            }

            // Tăng đếm số lần bấm liên tiếp
            burstSpamClickCount++;
            clearTimeout(burstResetTimer);
            burstResetTimer = setTimeout(() => {
                burstSpamClickCount = 0;
            }, 2500);

            // Bắn tung hạt tiền - Truyền force = true để luôn bùng nổ tiền khắp màn hình
            const rect = btnBurstMoney.getBoundingClientRect();
            window.moneyRainInstance.burstAt(rect.left + rect.width / 2, rect.top, 25, true);

            // Cơ chế giới hạn:
            // - Bấm 1-2 lần: Cooldown 500ms
            // - Bấm từ lần 3 liên tiếp trở lên: Giới hạn hồi chiêu 1.5 giây để tránh giật lag
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

            const currentVer = (MUSIC_VERSIONS && MUSIC_VERSIONS[currentVersionIndex]) ? MUSIC_VERSIONS[currentVersionIndex] : null;
            const targetSrc = (currentVer && currentVer.audioUrl) || activeCustomAudioUrl || DEFAULT_NATIVE_BGM;

            // Kích hoạt ngay lập tức HTML5 Audio nếu trên Messenger hoặc Mobile hoặc bài có MP3
            if (isFBInApp || isNativeAudioActive || Boolean(currentVer && currentVer.audioUrl) || activeCustomAudioUrl) {
                const audio = initNativeAudio(targetSrc);
                audio.muted = false;
                audio.volume = volumeLevel / 100;
                audio.play().then(() => {
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
                playMusic();
            }

            // Mở khóa Web Audio context cho các hiệu ứng âm thanh
            try {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (AudioCtx) {
                    if (!window._globalAudioCtx) window._globalAudioCtx = new AudioCtx();
                    if (window._globalAudioCtx.state === 'suspended') {
                        window._globalAudioCtx.resume();
                    }
                }
            } catch (_) {}

            // Xóa nút hint nếu đang hiển thị
            const hint = document.getElementById('music-mobile-hint');
            if (hint && hint.parentNode) hint.parentNode.removeChild(hint);
        };

        // Lắng nghe ở mức window với capture để bắt ngay thao tác đầu tiên bất kể chạm vào đâu
        ['click', 'touchstart', 'touchend', 'pointerup', 'scroll'].forEach(evt => {
            window.addEventListener(evt, () => {
                if (!unlocked || !isPlaying) unlockAndPlay();
            }, { capture: true, passive: true });
        });
        document.addEventListener('keydown', () => {
            if (!unlocked || !isPlaying) unlockAndPlay();
        }, { capture: true });

        // Phát hiện nếu đang mở trong Messenger / Facebook In-App Browser hoặc Mobile
        const isFBInApp = /FBAN|FBAV|Messenger|Instagram|Line/i.test(navigator.userAgent);
        const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

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
                    // Tự ẩn sau 10s
                    setTimeout(() => { if (hint.parentNode) hint.remove(); }, 10000);
                }
            }, 2000);
        }

        // Khởi động chu kỳ đồng bộ thời gian thực cho tất cả người dùng
        startRealtimeSync();
    }

    // --- 3. Admin lưu cài đặt nhạc lên Server ---
    function adminSaveMusicVersion(idx, speed) {
        currentVersionIndex = idx;
        currentSpeed = speed;
        activeCustomAudioUrl = null;

        // Cập nhật giao diện cục bộ trước
        applyMusicSetting({
            versionIndex: idx,
            speed: speed,
            customAudioUrl: null
        });

        // Gửi lên server để lưu vào Database và đồng bộ cho tất cả khách
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

    // --- 4. Áp dụng cài đặt nhạc (áp dụng cho cả Admin lẫn Người dùng bình thường) ---
    function applyMusicSetting(setting, showToast = false) {
        if (!setting) return;

        if (typeof setting.versionIndex === 'number' && MUSIC_VERSIONS[setting.versionIndex]) {
            currentVersionIndex = setting.versionIndex;
        }
        if (typeof setting.speed === 'number') {
            currentSpeed = setting.speed;
        }
        activeCustomAudioUrl = setting.customAudioUrl || null;

        const trackTitle = document.getElementById('music-track-title');
        const trackArtist = document.getElementById('music-track-artist');
        const versionSelect = document.getElementById('music-version-select');
        const versionBadgeNote = document.getElementById('version-badge-note');

        // Cập nhật UI Dropdown nếu là Admin
        if (versionSelect) {
            versionSelect.value = currentVersionIndex;
        }

        // Trường hợp 1: Phát file MP3 (Nếu bài này có MP3 riêng, hoặc Admin có MP3 chung, hoặc Native Audio trong Messenger)
        const currentVer = MUSIC_VERSIONS[currentVersionIndex];
        const hasTrackAudio = Boolean(currentVer && currentVer.audioUrl);

        if (hasTrackAudio || activeCustomAudioUrl || isNativeAudioActive) {
            if (ytPlayer && isPlayerReady && typeof ytPlayer.pauseVideo === 'function') {
                try { ytPlayer.pauseVideo(); } catch(_) {}
            }

            const displayTitle = setting.title || (activeCustomAudioUrl ? "Graduation (Custom Audio)" : (currentVer ? currentVer.title : "Graduation (Relaxing Piano)"));
            if (trackTitle) trackTitle.innerText = displayTitle;
            if (trackArtist) {
                trackArtist.innerHTML = `<span style="background: #ecfdf5; border: 1px solid #a7f3d0; padding: 1.5px 7px; border-radius: 6px; color: #047857; display: inline-flex; align-items: center; gap: 4px;">🎵 MP3 Audio</span>`;
            }

            const targetSrc = (currentVer && currentVer.audioUrl) || activeCustomAudioUrl || DEFAULT_NATIVE_BGM;
            initNativeAudio(targetSrc);

            if (isPlaying && !isUserPaused) {
                localAudio.play().then(() => updateUIState(true)).catch(() => {});
            }
        } 
        // Trường hợp 2: Phát video YouTube theo phiên bản
        else {
            if (localAudio) {
                localAudio.pause();
                localAudio = null;
            }

            const ver = MUSIC_VERSIONS[currentVersionIndex];
            if (trackTitle) trackTitle.innerText = ver.title;
            if (trackArtist) {
                trackArtist.innerHTML = `<span style="background: #ecfdf5; border: 1px solid #a7f3d0; padding: 1.5px 7px; border-radius: 6px; color: #047857; display: inline-flex; align-items: center; gap: 4px;">${ver.badge}</span>`;
            }
            if (versionBadgeNote) {
                versionBadgeNote.innerText = (currentVersionIndex === 3) ? 'Bản gốc' : 'Không vi phạm Content ID';
                versionBadgeNote.style.color = (currentVersionIndex === 3) ? '#dc2626' : '#047857';
            }

            if (ytPlayer && isPlayerReady) {
                // Nếu Admin vừa đổi bản nhạc mới (showToast = true) hoặc đang ở trạng thái phát:
                if (showToast || (isPlaying && !isUserPaused)) {
                    isUserPaused = false;
                    isPlaying = true;
                    if (typeof ytPlayer.loadVideoById === 'function') {
                        ytPlayer.loadVideoById({
                            videoId: ver.id,
                            startSeconds: 0
                        });
                        ytPlayer.setPlaybackRate(currentSpeed);
                        ytPlayer.playVideo();
                        updateUIState(true);
                    }
                } else {
                    if (typeof ytPlayer.cueVideoById === 'function') {
                        ytPlayer.cueVideoById({
                            videoId: ver.id,
                            startSeconds: 0
                        });
                        ytPlayer.setPlaybackRate(currentSpeed);
                    }
                }
            }
        }

        // Hiển thị thông báo nhỏ nếu Admin vừa đổi nhạc
        if (showToast) {
            const toast = document.getElementById('music-sync-toast');
            if (toast) {
                toast.style.display = 'block';
                setTimeout(() => { toast.style.display = 'none'; }, 3500);
            }
        }
    }

    // --- 5. Đồng bộ thời gian thực cho tất cả người dùng đang sử dụng (Polling) ---
    function startRealtimeSync() {
        // Kiểm tra cài đặt nhạc mới từ server mỗi 3.5 giây
        setInterval(() => {
            fetch('/api/music-setting')
                .then(res => res.json())
                .then(data => {
                    if (!data) return;

                    // Đồng bộ danh sách bài hát nếu Admin vừa thêm/sửa/xóa trên trang quản trị
                    if (Array.isArray(data.versions) && data.versions.length > 0) {
                        const isListDifferent = (data.versions.length !== MUSIC_VERSIONS.length) ||
                            data.versions.some((v, idx) => !MUSIC_VERSIONS[idx] || v.id !== MUSIC_VERSIONS[idx].id || v.title !== MUSIC_VERSIONS[idx].title || v.speed !== MUSIC_VERSIONS[idx].speed || v.audioUrl !== MUSIC_VERSIONS[idx].audioUrl);
                        
                        if (isListDifferent) {
                            MUSIC_VERSIONS.length = 0;
                            MUSIC_VERSIONS.push(...data.versions);
                            localStorage.setItem('chatflex_music_versions', JSON.stringify(MUSIC_VERSIONS));
                            
                            const versionSelect = document.getElementById('music-version-select');
                            if (versionSelect) {
                                versionSelect.innerHTML = MUSIC_VERSIONS.map((v, i) => `<option value="${i}" ${currentVersionIndex === i ? 'selected' : ''}>${v.badge || '🎵'} ${v.title}</option>`).join('');
                            }
                        }
                    }

                    // Đồng bộ khi phiên bản nhạc, file MP3, tốc độ hoặc DANH SÁCH BÀI HÁT THỰC SỰ THAY ĐỔI
                    const versionDiff = (typeof data.versionIndex === 'number' && data.versionIndex !== currentVersionIndex);
                    const customAudioDiff = (data.customAudioUrl !== activeCustomAudioUrl);
                    const speedDiff = (typeof data.speed === 'number' && Math.abs(data.speed - currentSpeed) > 0.05);

                    if (versionDiff || customAudioDiff || speedDiff || isListDifferent) {
                        console.log('⚡ Nhận diện bản nhạc hoặc MP3 mới trên server:', data);
                        lastSettingTimestamp = data.updatedAt || Date.now();
                        applyMusicSetting(data, true);
                    } else if (data.updatedAt) {
                        lastSettingTimestamp = data.updatedAt;
                    }

                    // Đồng bộ tiêu đề thương hiệu thời gian thực nếu Admin vừa đổi
                    fetch('/api/brand-setting')
                        .then(r => r.json())
                        .then(bData => {
                            if (bData && bData.brand) {
                                const brand = bData.brand;
                                const navBrandIcon = document.querySelector('.navbar-brand .brand-icon');
                                const navBrandText = document.querySelector('.navbar-brand .brand-text');
                                if (navBrandIcon && brand.brandIcon && navBrandIcon.textContent.trim() !== brand.brandIcon.trim()) {
                                    navBrandIcon.textContent = brand.brandIcon;
                                }
                                if (navBrandText && brand.brandTitle && navBrandText.textContent.trim() !== brand.brandTitle.trim()) {
                                    navBrandText.textContent = brand.brandTitle;
                                }
                            }
                        })
                        .catch(() => {});
                })
                .catch(() => {});
        }, 3500);
    }

    // --- 6. Tích hợp YouTube IFrame Player API ---
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
            const defaultVideoId = MUSIC_VERSIONS[currentVersionIndex].id;
            ytPlayer = new window.YT.Player('yt-player-element', {
                height: '200',
                width: '200',
                videoId: defaultVideoId,
                playerVars: {
                    autoplay: 1,
                    controls: 0,
                    loop: 1,
                    playlist: defaultVideoId,
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
                        
                        // Nếu có cài đặt custom audio thì không chạy youtube
                        if (activeCustomAudioUrl) {
                            applyMusicSetting({ customAudioUrl: activeCustomAudioUrl });
                            return;
                        }

                        // Tự động phát ngay lập tức trên cả Messenger WebView & Safari
                        if (!isUserPaused) {
                            try {
                                if (typeof event.target.unMute === 'function') event.target.unMute();
                                event.target.playVideo();
                                updateUIState(true);
                            } catch(e) {
                                // Nếu WebView chặn phát có tiếng lúc mở đầu, phát muted trước để sẵn sàng
                                try {
                                    if (typeof event.target.mute === 'function') event.target.mute();
                                    event.target.playVideo();
                                } catch(_) {}
                            }
                        }
                    },
                    onStateChange: (event) => {
                        if (event.data === window.YT.PlayerState.PLAYING) {
                            if (isUserPaused) {
                                // Người dùng đã chủ động bấm Tạm dừng, không cho YouTube tự phát tiếp
                                if (ytPlayer && typeof ytPlayer.pauseVideo === 'function') {
                                    ytPlayer.pauseVideo();
                                }
                                updateUIState(false);
                            } else {
                                updateUIState(true);
                            }
                        } else if (event.data === window.YT.PlayerState.PAUSED || event.data === window.YT.PlayerState.ENDED) {
                            updateUIState(false);
                        }
                    },
                    onError: (err) => {
                        console.warn('[MusicPlayer] Lỗi YouTube IFrame, tự động chuyển ngay sang HTML5 Audio Native:', err);
                        fallbackToNativeAudio();
                    }
                }
            });
        } catch (e) {
            console.error('Lỗi khởi tạo YouTube player:', e);
            fallbackToNativeAudio();
        }
    }

    // --- 7. Các hàm điều khiển Âm nhạc cơ bản ---
    function playMusic() {
        isUserPaused = false;
        const currentVer = MUSIC_VERSIONS[currentVersionIndex];
        const hasTrackAudio = Boolean(currentVer && currentVer.audioUrl);
        const targetSrc = (currentVer && currentVer.audioUrl) || activeCustomAudioUrl || DEFAULT_NATIVE_BGM;
        if (hasTrackAudio || isNativeAudioActive || isFBInApp || activeCustomAudioUrl) {
            const audio = initNativeAudio(targetSrc);
            audio.muted = false;
            audio.volume = volumeLevel / 100;
            audio.play().then(() => {
                updateUIState(true);
            }).catch((e) => {
                console.warn('Lỗi phát localAudio:', e);
            });
            return;
        }

        if (ytPlayer && isPlayerReady && typeof ytPlayer.playVideo === 'function') {
            try {
                if (typeof ytPlayer.unMute === 'function') ytPlayer.unMute();
                if (typeof ytPlayer.setVolume === 'function') ytPlayer.setVolume(volumeLevel > 0 ? volumeLevel : 75);
                ytPlayer.playVideo();
                updateUIState(true);
            } catch(e) {
                console.warn('Lỗi playVideo, fallback sang native audio:', e);
                fallbackToNativeAudio();
            }
        } else {
            // Player chưa ready → đánh dấu chờ, khi onReady sẽ tự phát
            pendingPlay = true;
            isPlaying = true;
            updateUIState(true);
        }
    }

    function pauseMusic() {
        isUserPaused = true;
        if (ytPlayer && isPlayerReady && typeof ytPlayer.pauseVideo === 'function') {
            ytPlayer.pauseVideo();
        }
        if (localAudio) {
            localAudio.pause();
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
        if (isFBInApp || isNativeAudioActive) {
            isNativeAudioActive = true;
            const currentVer = (MUSIC_VERSIONS && MUSIC_VERSIONS[currentVersionIndex]) ? MUSIC_VERSIONS[currentVersionIndex] : null;
            const targetSrc = (currentVer && currentVer.audioUrl) || activeCustomAudioUrl || DEFAULT_NATIVE_BGM;
            initNativeAudio(targetSrc);
            if (!isUserPaused) {
                localAudio.play().then(() => updateUIState(true)).catch(() => {});
            }
        }
        loadYouTubeAPI();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
