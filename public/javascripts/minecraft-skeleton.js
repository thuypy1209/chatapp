/**
 * ChatFlex - Minecraft Skeleton chạy qua chạy lại trên dải đất Super Mario
 * - Đồ họa Pixel Art chuẩn Skeleton Minecraft (Đầu vuông, xương sườn, Cung tên Bow)
 * - Tự động tuần tra chạy qua lại giữa 2 mép màn hình, lật mặt quay đầu mượt mà
 * - Tương tác click chuột: Giật mình nhảy cẫng lên, rớt xương 🦴, tăng tốc chạy trốn
 * - Hiệu ứng âm thanh tiếng xương lạch cạch retro (Web Audio API)
 */

(function () {
    'use strict';

    // Âm thanh tiếng xương "Clack-rattle" bằng Web Audio API
    class SkeletonSound {
        constructor() {
            this.ctx = null;
        }

        init() {
            if (!this.ctx) {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (AudioCtx) this.ctx = new AudioCtx();
            }
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
        }

        playRattle() {
            try {
                this.init();
                if (!this.ctx) return;
                const now = this.ctx.currentTime;

                // Tiếng lách cách xương khô (Bộ gõ noise + bandpass filter)
                const bufferSize = this.ctx.sampleRate * 0.08;
                const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
                }

                const noise = this.ctx.createBufferSource();
                noise.buffer = buffer;

                const filter = this.ctx.createBiquadFilter();
                filter.type = 'bandpass';
                filter.frequency.setValueAtTime(1800, now);
                filter.Q.setValueAtTime(3.5, now);

                const gain = this.ctx.createGain();
                gain.gain.setValueAtTime(0.18, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

                noise.connect(filter);
                filter.connect(gain);
                gain.connect(this.ctx.destination);
                noise.start(now);
            } catch (e) {
                // Trình duyệt chưa unlock audio
            }
        }
    }

    const skelAudio = new SkeletonSound();

    class MinecraftSkeleton {
        constructor() {
            this.container = null;
            this.posX = -80; // Vị trí X ban đầu
            this.posY = 0;   // Độ cao nhảy thêm so với mặt đất (jump offset)
            this.direction = 1; // 1: sang phải, -1: sang trái
            this.baseSpeed = 1.7; // Tốc độ chạy bình thường
            this.speed = this.baseSpeed;
            this.isJumping = false;
            this.jumpVy = 0;
            this.isPausing = false;
            this.isPanicking = false;
            this.panicTimer = null;
            this.animFrameId = null;

            this.init();
        }

        init() {
            if (document.getElementById('minecraft-skeleton-container')) return;

            // Thêm Style chuyển động khớp xương
            this.injectStyles();

            // Tạo phần tử Skeleton
            this.container = document.createElement('div');
            this.container.id = 'minecraft-skeleton-container';
            this.container.title = 'Minecraft Skeleton 🏹 (Nhấp chuột để trêu chọc!)';

            // SVG Pixel Art chuẩn Minecraft Skeleton với khớp xương cử động
            this.container.innerHTML = `
                <div class="skel-wrapper">
                    <!-- Bong bóng chat khi bị chọc ghẹo (Luôn giữ xuôi chiều không bị lật ngược) -->
                    <div id="skel-speech-bubble" style="display: none;"></div>

                    <!-- Khung hình nhân vật Skeleton (Được lật scaleX theo hướng chạy) -->
                    <div class="skel-sprite" style="transform-origin: center center; display: inline-block;">
                        <svg class="skel-svg" viewBox="0 0 46 72" width="46" height="72" xmlns="http://www.w3.org/2000/svg">
                            <defs>
                                <filter id="skel-pixel-shadow" x="-10%" y="-10%" width="120%" height="120%">
                                    <feDropShadow dx="0" dy="2" stdDeviation="1" flood-color="rgba(0,0,0,0.25)" />
                                </filter>
                            </defs>

                            <!-- Chân sau (Left Leg) -->
                            <g class="skel-leg-back" style="transform-origin: 20px 48px;">
                                <rect x="18" y="48" width="4" height="21" fill="#9ca3af" />
                                <rect x="16" y="66" width="6" height="3" fill="#6b7280" />
                            </g>

                            <!-- Tay sau (Left Arm) -->
                            <g class="skel-arm-back" style="transform-origin: 22px 28px;">
                                <rect x="20" y="27" width="4" height="18" fill="#9ca3af" />
                            </g>

                            <!-- Thân và Lồng ngực (Body & Spine) -->
                            <g class="skel-body">
                                <!-- Cột sống (Spine) -->
                                <rect x="21" y="27" width="3" height="21" fill="#6b7280" />
                                <!-- Xương sườn (Ribs) -->
                                <rect x="16" y="29" width="13" height="3" fill="#e5e7eb" />
                                <rect x="15" y="34" width="15" height="3" fill="#f3f4f6" />
                                <rect x="16" y="39" width="13" height="3" fill="#e5e7eb" />
                                <rect x="17" y="44" width="11" height="2" fill="#d1d5db" />
                                <!-- Khung chậu (Pelvis) -->
                                <rect x="16" y="46" width="13" height="3" fill="#9ca3af" />
                            </g>

                            <!-- Đầu hộp vuông Minecraft (Head 8x8 blocks) -->
                            <g class="skel-head" style="transform-origin: 22px 26px;">
                                <!-- Hộp sọ -->
                                <rect x="10" y="2" width="24" height="24" fill="#e5e7eb" stroke="#9ca3af" stroke-width="1" />
                                <!-- Vùng trán pixel đổ bóng -->
                                <rect x="10" y="2" width="24" height="6" fill="#f3f4f6" />
                                <rect x="10" y="8" width="4" height="18" fill="#d1d5db" />
                                <rect x="30" y="8" width="4" height="18" fill="#9ca3af" />
                                
                                <!-- Hốc mắt rỗng đen đặc trưng (Eyes) -->
                                <rect x="14" y="11" width="5" height="5" fill="#111827" />
                                <rect x="24" y="11" width="5" height="5" fill="#111827" />
                                
                                <!-- Hốc mũi (Nose) -->
                                <rect x="20" y="16" width="3" height="3" fill="#1f2937" />
                                
                                <!-- Miệng xương răng cưa (Mouth & Teeth) -->
                                <rect x="15" y="20" width="13" height="3" fill="#111827" />
                                <!-- Răng trắng -->
                                <rect x="17" y="20" width="2" height="2" fill="#f9fafb" />
                                <rect x="21" y="20" width="2" height="2" fill="#f9fafb" />
                                <rect x="25" y="20" width="2" height="2" fill="#f9fafb" />
                            </g>

                            <!-- Cung tên Minecraft (Bow & Arrow) cầm trên tay -->
                            <g class="skel-bow-arm" style="transform-origin: 24px 28px;">
                                <!-- Tay trước -->
                                <rect x="22" y="27" width="5" height="18" fill="#f3f4f6" />
                                <!-- Cây cung (Bow) -->
                                <path d="M 31 16 L 36 21 L 38 31 L 38 41 L 36 51 L 31 56" fill="none" stroke="#92400e" stroke-width="2.5" stroke-linecap="square" />
                                <path d="M 32 17 L 35 21 L 37 31 L 37 41 L 35 51 L 32 55" fill="none" stroke="#b45309" stroke-width="1" />
                                <!-- Dây cung (Bowstring) -->
                                <line x1="31" y1="16" x2="31" y2="56" stroke="#f1f5f9" stroke-width="1.2" stroke-dasharray="2 1" />
                                <!-- Mũi tên giương sẵn (Arrow) -->
                                <line x1="24" y1="36" x2="43" y2="36" stroke="#64748b" stroke-width="1.8" />
                                <!-- Đầu mũi tên nhọn sắt -->
                                <polygon points="43,33 46,36 43,39" fill="#334155" />
                                <!-- Lông đuôi tên -->
                                <line x1="25" y1="33" x2="27" y2="36" stroke="#f8fafc" stroke-width="1.5" />
                                <line x1="25" y1="39" x2="27" y2="36" stroke="#f8fafc" stroke-width="1.5" />
                            </g>

                            <!-- Chân trước (Right Leg) -->
                            <g class="skel-leg-front" style="transform-origin: 24px 48px;">
                                <rect x="22" y="48" width="4" height="21" fill="#f3f4f6" />
                                <rect x="22" y="66" width="6" height="3" fill="#9ca3af" />
                            </g>
                        </svg>
                    </div>
                </div>
            `;

            document.body.appendChild(this.container);

            // Bắt sự kiện click tương tác
            this.container.addEventListener('click', (e) => {
                e.stopPropagation();
                this.interact();
            });

            // Bắt đầu vòng lặp chuyển động
            this.loop = this.loop.bind(this);
            this.animFrameId = requestAnimationFrame(this.loop);
        }

        injectStyles() {
            if (document.getElementById('minecraft-skeleton-styles')) return;
            const style = document.createElement('style');
            style.id = 'minecraft-skeleton-styles';
            style.textContent = `
                #minecraft-skeleton-container {
                    position: fixed;
                    bottom: 46px; /* Đứng ngay trên mép cỏ của dải đất 48px */
                    left: -80px;
                    z-index: 95; /* Nằm dưới thanh menu & popup */
                    cursor: pointer;
                    user-select: none;
                    transition: transform 0.25s ease;
                    pointer-events: auto;
                    filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.22));
                }

                #minecraft-skeleton-container:hover {
                    filter: drop-shadow(0 6px 12px rgba(239, 68, 68, 0.4));
                }

                .skel-wrapper {
                    position: relative;
                    display: inline-block;
                }

                .skel-svg {
                    image-rendering: pixelated;
                    image-rendering: crisp-edges;
                    display: block;
                }

                /* Hoạt ảnh chân bước đi luân phiên chuẩn Minecraft */
                .skel-running .skel-leg-front {
                    animation: skelLegFrontAnim 0.5s infinite ease-in-out alternate;
                }
                .skel-running .skel-leg-back {
                    animation: skelLegBackAnim 0.5s infinite ease-in-out alternate;
                }

                /* Hoạt ảnh tay đung đưa theo nhịp chạy */
                .skel-running .skel-bow-arm {
                    animation: skelBowArmAnim 0.5s infinite ease-in-out alternate;
                }
                .skel-running .skel-arm-back {
                    animation: skelArmBackAnim 0.5s infinite ease-in-out alternate;
                }

                /* Đầu nhấp nhô khi chạy */
                .skel-running .skel-head {
                    animation: skelHeadBob 0.25s infinite ease-in-out alternate;
                }

                @keyframes skelLegFrontAnim {
                    0% { transform: rotate(-26deg); }
                    100% { transform: rotate(26deg); }
                }

                @keyframes skelLegBackAnim {
                    0% { transform: rotate(26deg); }
                    100% { transform: rotate(-26deg); }
                }

                @keyframes skelBowArmAnim {
                    0% { transform: rotate(-8deg) translateY(0); }
                    100% { transform: rotate(8deg) translateY(-1px); }
                }

                @keyframes skelArmBackAnim {
                    0% { transform: rotate(18deg); }
                    100% { transform: rotate(-18deg); }
                }

                @keyframes skelHeadBob {
                    0% { transform: translateY(0); }
                    100% { transform: translateY(-2px); }
                }

                /* Bong bóng thoại vui nhộn khi bị click */
                #skel-speech-bubble {
                    position: absolute;
                    top: -38px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: #ffffff;
                    border: 2px solid #1e293b;
                    color: #1e293b;
                    font-size: 11px;
                    font-weight: 800;
                    white-space: nowrap;
                    padding: 3px 8px;
                    border-radius: 8px;
                    box-shadow: 0 3px 0 #1e293b;
                    pointer-events: none;
                    animation: skelBubblePop 0.25s ease-out;
                    z-index: 100;
                }

                #skel-speech-bubble::after {
                    content: "";
                    position: absolute;
                    bottom: -5px;
                    left: 50%;
                    transform: translateX(-50%);
                    border-width: 5px 5px 0;
                    border-style: solid;
                    border-color: #1e293b transparent;
                    display: block;
                    width: 0;
                }

                @keyframes skelBubblePop {
                    0% { transform: translateX(-50%) scale(0.5); opacity: 0; }
                    100% { transform: translateX(-50%) scale(1); opacity: 1; }
                }

                /* Hạt xương pixel văng ra khi bị đánh */
                .skel-bone-particle {
                    position: fixed;
                    pointer-events: none;
                    font-size: 16px;
                    z-index: 96;
                    animation: boneFly 0.8s ease-out forwards;
                }

                @keyframes boneFly {
                    0% { transform: translate(0, 0) scale(1) rotate(0deg); opacity: 1; }
                    100% { transform: translate(var(--dx), var(--dy)) scale(0.6) rotate(360deg); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }

        // Tương tác khi người dùng click vào Skeleton
        interact() {
            // Âm thanh tiếng xương lạch cạch
            skelAudio.playRattle();

            // Nhảy cẫng lên (Jump)
            if (!this.isJumping) {
                this.isJumping = true;
                this.jumpVy = -9.5;
            }

            // Hiện bong bóng thoại ngộ nghĩnh
            const quotes = [
                '💀 Clack clack!',
                '🏹 Coi chừng tên!',
                '🦴 Đừng chọc tui!',
                '⚡ Rattle rattle!',
                '🏃 Chạy lẹ anh em!',
                '⭐ Gặp Mario rùi!',
                '🎯 Trúng cung tên giờ!'
            ];
            const bubble = document.getElementById('skel-speech-bubble');
            if (bubble) {
                bubble.innerText = quotes[Math.floor(Math.random() * quotes.length)];
                bubble.style.display = 'block';
                clearTimeout(this.bubbleTimer);
                this.bubbleTimer = setTimeout(() => {
                    bubble.style.display = 'none';
                }, 1800);
            }

            // Bắn ra các mẩu xương 🦴 và ngôi sao ⭐
            this.spawnBoneParticles();

            // Kích hoạt chế độ hoảng loạn chạy nhanh trong 2.5 giây
            this.isPanicking = true;
            this.speed = 4.2;
            clearTimeout(this.panicTimer);
            this.panicTimer = setTimeout(() => {
                this.isPanicking = false;
                this.speed = this.baseSpeed;
            }, 2500);
        }

        // Tạo hiệu ứng hạt xương văng ra
        spawnBoneParticles() {
            const rect = this.container.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const items = ['🦴', '💀', '⭐', '🦴'];

            for (let i = 0; i < 4; i++) {
                const p = document.createElement('div');
                p.className = 'skel-bone-particle';
                p.innerText = items[i];
                p.style.left = centerX + 'px';
                p.style.top = centerY + 'px';
                const angle = (Math.PI * 2 / 4) * i + (Math.random() - 0.5) * 0.5;
                const dist = 35 + Math.random() * 30;
                p.style.setProperty('--dx', (Math.cos(angle) * dist) + 'px');
                p.style.setProperty('--dy', (Math.sin(angle) * dist - 30) + 'px');
                document.body.appendChild(p);

                setTimeout(() => p.remove(), 800);
            }
        }

        loop() {
            const screenW = window.innerWidth;
            const wrapper = this.container.querySelector('.skel-wrapper');

            // Xử lý nhảy (Jump physics)
            if (this.isJumping) {
                this.posY += this.jumpVy;
                this.jumpVy += 0.55; // Trọng lực
                if (this.posY >= 0) {
                    this.posY = 0;
                    this.isJumping = false;
                }
            }

            // Nếu đang trong trạng thái tạm dừng nghỉ chân
            if (this.isPausing) {
                if (wrapper) wrapper.classList.remove('skel-running');
            } else {
                if (wrapper) wrapper.classList.add('skel-running');

                // Di chuyển vị trí X
                this.posX += this.speed * this.direction;

                // Kiểm tra chạm biên phải
                if (this.direction === 1 && this.posX >= screenW - 65) {
                    this.posX = screenW - 65;
                    this.pauseAndTurn(-1);
                }
                // Kiểm tra chạm biên trái
                else if (this.direction === -1 && this.posX <= 15) {
                    this.posX = 15;
                    this.pauseAndTurn(1);
                }
            }

            // Cập nhật vị trí DOM
            this.container.style.left = this.posX + 'px';
            this.container.style.bottom = (46 - this.posY) + 'px'; // 46px là mép dải cỏ xanh

            // Chỉ lật khung hình nhân vật Skeleton theo hướng chạy, giữ bong bóng thoại luôn xuôi chiều đọc chuẩn
            const sprite = this.container.querySelector('.skel-sprite');
            if (sprite) {
                sprite.style.transform = `scaleX(${this.direction})`;
            }

            this.animFrameId = requestAnimationFrame(this.loop);
        }

        // Tạm dừng một nhịp rồi quay đầu chạy ngược lại
        pauseAndTurn(newDirection) {
            this.isPausing = true;
            const pauseTime = this.isPanicking ? 250 : (700 + Math.random() * 800);

            setTimeout(() => {
                this.direction = newDirection;
                this.isPausing = false;
            }, pauseTime);
        }
    }

    // Khởi chạy khi DOM sẵn sàng
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.minecraftSkeletonInstance = new MinecraftSkeleton();
        });
    } else {
        window.minecraftSkeletonInstance = new MinecraftSkeleton();
    }

})();
