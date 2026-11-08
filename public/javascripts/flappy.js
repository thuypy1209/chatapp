/**
 * Flappy Bangboo (Zenless Zone Zero) - 100% DOM & GPU Hardware-Accelerated Game Engine
 * ULTRA HIGH-PERFORMANCE EDITION (120 FPS / ZERO-ALLOCATION OBJECT POOLING / DETERMINISTIC 60Hz PHYSICS)
 * 
 * - Zero Memory Allocation trong Game Loop: Toàn bộ ống nước, khói pô, text điểm đều dùng Object Pooling
 * - Fixed Time-Step Accumulator: Tốc độ chuẩn xác, chuyển động mượt mà tuyệt đối trên mọi màn hình 60Hz / 90Hz / 120Hz
 * - Triệt tiêu hoàn toàn Ghost Click & Input Lag trên màn hình cảm ứng di động
 * - Math.round() Pixel-Snapping: Khử hiện tượng nhòe / rung hình subpixel trên GPU
 */
(function () {
    'use strict';

    // --- 1. Web Audio 8-bit Sound Generator (Tối ưu độ trễ & không block main thread) ---
    class RetroAudio {
        constructor() {
            this.ctx = null;
            this.muted = false;
            this._resuming = false;
        }

        init() {
            if (!this.ctx) {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (AudioCtx) {
                    this.ctx = new AudioCtx();
                }
            }
            if (this.ctx && this.ctx.state === 'suspended' && !this._resuming) {
                this._resuming = true;
                this.ctx.resume().then(() => {
                    this._resuming = false;
                }).catch(() => {
                    this._resuming = false;
                });
            }
        }

        tone(freq, type, duration, startVol = 0.15, endVol = 0.001, slideFreq = null) {
            if (this.muted || !this.ctx) return;
            try {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                const now = this.ctx.currentTime;
                osc.type = type;
                osc.frequency.setValueAtTime(freq, now);
                if (slideFreq) {
                    osc.frequency.exponentialRampToValueAtTime(Math.max(10, slideFreq), now + duration);
                }
                gain.gain.setValueAtTime(startVol, now);
                gain.gain.exponentialRampToValueAtTime(endVol, now + duration);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(now);
                osc.stop(now + duration);
            } catch (e) {}
        }

        flap() {
            if (this.muted) return;
            if (!this.ctx || this.ctx.state === 'suspended') this.init();
            this.tone(280, 'sine', 0.08, 0.15, 0.01, 560);
        }

        point() {
            if (this.muted) return;
            if (!this.ctx || this.ctx.state === 'suspended') this.init();
            if (!this.ctx) return;
            const now = this.ctx.currentTime;
            try {
                const playNote = (f, time, dur) => {
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(f, time);
                    gain.gain.setValueAtTime(0.18, time);
                    gain.gain.exponentialRampToValueAtTime(0.01, time + dur);
                    osc.connect(gain);
                    gain.connect(this.ctx.destination);
                    osc.start(time);
                    osc.stop(time + dur);
                };
                playNote(987.77, now, 0.06); // B5
                playNote(1318.51, now + 0.06, 0.22); // E6
            } catch (e) {}
        }

        hit() {
            if (this.muted) return;
            if (!this.ctx || this.ctx.state === 'suspended') this.init();
            this.tone(220, 'sawtooth', 0.12, 0.22, 0.02, 50);
        }

        die() {
            if (this.muted) return;
            if (!this.ctx || this.ctx.state === 'suspended') this.init();
            this.tone(170, 'triangle', 0.20, 0.20, 0.01, 35);
        }

        swoosh() {
            if (this.muted) return;
            if (!this.ctx || this.ctx.state === 'suspended') this.init();
            this.tone(360, 'sine', 0.12, 0.08, 0.01, 180);
        }
    }

    const audio = new RetroAudio();
    window.FlappyAudio = audio;
    window.MarioAudio = audio;
    window.RetroAudio = RetroAudio;

    // --- 2. Flappy Bangboo DOM Engine (Zero Canvas / High-Speed Object Pool) ---
    class FlappyGame {
        constructor(elementId) {
            this.elementId = elementId;
            let target = document.getElementById(elementId);
            if (!target) return;

            // Nếu phần tử truyền vào là thẻ <canvas>, tự động chuyển thành <div>
            if (target.tagName && target.tagName.toLowerCase() === 'canvas') {
                const div = document.createElement('div');
                div.id = target.id;
                div.className = (target.className ? target.className + ' ' : '') + 'game-dom-viewport';
                div.tabIndex = target.tabIndex || 0;
                if (target.parentNode) {
                    target.parentNode.replaceChild(div, target);
                }
                target = div;
            } else {
                target.classList.add('game-dom-viewport');
            }
            this.container = target;

            // Lưu instance toàn cục để tương thích tuyệt đối
            window.flappyInstance = this;
            window.marioInstance = this;
            if (elementId === 'mario-side-canvas') {
                window.flappySideGameInstance = this;
                window.marioSideGameInstance = this;
            }

            // Kích thước chuẩn sân khấu ảo tỉ lệ 16:9 (800 x 450)
            this.width = 800;
            this.height = 450;
            this.groundH = 68;
            this.playH = this.height - this.groundH; // 382px

            // Trạng thái trò chơi
            this.score = 0;
            this.coins = 0;
            this.bestScore = 0;
            try {
                this.bestScore = parseInt(localStorage.getItem('chatflex_flappy_best') || '0', 10);
            } catch (e) {}

            this.gameState = 'READY'; // READY, PLAYING, GAMEOVER
            this.isTabHidden = false;
            this.groundX = 0;

            // Physics Accumulator (Fixed 60Hz Time-Step)
            this.accumulator = 0;
            this.lastTime = 0;

            // Thiết lập cấu trúc DOM & Object Pools
            this.buildDOM();
            this.buildObjectPools();

            // Khởi tạo thực thể & lắng nghe sự kiện
            this.initGame();
            this.bindEvents();

            // Tự động scale tỉ lệ sân khấu theo kích thước container
            this.resizeStage();
            window.addEventListener('resize', () => this.resizeStage(), { passive: true });
            document.addEventListener('fullscreenchange', () => this.resizeStage());
            document.addEventListener('webkitfullscreenchange', () => this.resizeStage());

            // Tạm dừng khi chuyển tab/app trên điện thoại để tiết kiệm pin
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    this.isTabHidden = true;
                } else {
                    this.isTabHidden = false;
                    this.lastTime = performance.now();
                    this.accumulator = 0;
                    this.resizeStage();
                }
            });

            // Bắt đầu vòng lặp Game Loop
            this._boundLoop = this.loop.bind(this);
            this.lastTime = performance.now();
            this._rafId = requestAnimationFrame(this._boundLoop);
        }

        // Xây dựng cây phần tử DOM GPU
        buildDOM() {
            this.container.innerHTML = `
                <div class="flappy-dom-stage" id="flappy-dom-stage">
                    <!-- 1. Bầu trời Flappy Bird -->
                    <div class="flappy-sky"></div>

                    <!-- 2. Mây trắng bồng bềnh (Static CSS layer) -->
                    <div class="flappy-clouds-layer">
                        <div class="flappy-cloud c1"></div>
                        <div class="flappy-cloud c2"></div>
                        <div class="flappy-cloud c3"></div>
                    </div>

                    <!-- 3. Dãy thành phố chân trời retro -->
                    <div class="flappy-city-layer">
                        <svg viewBox="0 0 800 110" preserveAspectRatio="none" style="width: 100%; height: 100%; display: block;">
                            <rect x="15" y="30" width="38" height="80" fill="#83ccd3" />
                            <rect x="22" y="42" width="7" height="10" fill="#9ee0e6" /><rect x="36" y="42" width="7" height="10" fill="#9ee0e6" />
                            <rect x="22" y="62" width="7" height="10" fill="#9ee0e6" /><rect x="36" y="62" width="7" height="10" fill="#9ee0e6" />
                            <rect x="65" y="10" width="46" height="100" fill="#83ccd3" />
                            <rect x="74" y="22" width="8" height="12" fill="#9ee0e6" /><rect x="92" y="22" width="8" height="12" fill="#9ee0e6" />
                            <rect x="74" y="46" width="8" height="12" fill="#9ee0e6" /><rect x="92" y="46" width="8" height="12" fill="#9ee0e6" />
                            <rect x="125" y="45" width="40" height="65" fill="#83ccd3" />
                            <rect x="135" y="58" width="7" height="10" fill="#9ee0e6" /><rect x="148" y="58" width="7" height="10" fill="#9ee0e6" />
                            <rect x="180" y="20" width="44" height="90" fill="#83ccd3" />
                            <rect x="190" y="34" width="8" height="12" fill="#9ee0e6" /><rect x="206" y="34" width="8" height="12" fill="#9ee0e6" />
                            <rect x="240" y="50" width="36" height="60" fill="#83ccd3" />
                            <rect x="290" y="15" width="48" height="95" fill="#83ccd3" />
                            <rect x="300" y="28" width="8" height="12" fill="#9ee0e6" /><rect x="318" y="28" width="8" height="12" fill="#9ee0e6" />
                            <rect x="355" y="38" width="42" height="72" fill="#83ccd3" />
                            <rect x="415" y="8" width="50" height="102" fill="#83ccd3" />
                            <rect x="425" y="22" width="8" height="12" fill="#9ee0e6" /><rect x="445" y="22" width="8" height="12" fill="#9ee0e6" />
                            <rect x="480" y="42" width="38" height="68" fill="#83ccd3" />
                            <rect x="535" y="25" width="46" height="85" fill="#83ccd3" />
                            <rect x="545" y="38" width="8" height="12" fill="#9ee0e6" /><rect x="563" y="38" width="8" height="12" fill="#9ee0e6" />
                            <rect x="595" y="48" width="40" height="62" fill="#83ccd3" />
                            <rect x="650" y="18" width="46" height="92" fill="#83ccd3" />
                            <rect x="660" y="32" width="8" height="12" fill="#9ee0e6" /><rect x="678" y="32" width="8" height="12" fill="#9ee0e6" />
                            <rect x="710" y="35" width="42" height="75" fill="#83ccd3" />
                            <rect x="765" y="15" width="30" height="95" fill="#83ccd3" />
                        </svg>
                    </div>

                    <!-- 4. Hàng cây xanh mướt -->
                    <div class="flappy-trees-layer"></div>

                    <!-- 5. Tầng chứa các cột ống nước (Object Pool) -->
                    <div class="flappy-pipes-layer" id="flappy-pipes-layer"></div>

                    <!-- 6. Mặt đất cỏ và sọc caro retro -->
                    <div class="flappy-ground-layer">
                        <div class="flappy-ground-track" id="flappy-ground-track">
                            <div class="flappy-ground-grass"></div>
                            <div class="flappy-ground-dirt"></div>
                        </div>
                    </div>

                    <!-- 7. Chú Bangboo Mô Tô (Zenless Zone Zero) -->
                    <div class="flappy-bird-hero" id="flappy-bird-hero">
                        <img src="/images/flappy-bangboo.png" alt="Bangboo" class="flappy-bird-img" id="flappy-bird-img" onerror="this.src='/images/flappy-cat.png';" />
                    </div>

                    <!-- 8. Tầng chứa khói pô và chữ điểm bay (Object Pool) -->
                    <div class="flappy-particles-layer" id="flappy-particles-layer"></div>

                    <!-- 9. HUD Điểm số -->
                    <div class="flappy-hud-score" id="flappy-hud-score">0</div>
                    <div class="flappy-hud-best" id="flappy-hud-best">🏆 Kỷ lục: 0</div>

                    <!-- 10. Màn hình GET READY -->
                    <div class="flappy-ready-overlay" id="flappy-ready-overlay">
                        <div class="flappy-ready-title">GET READY! 🚀</div>
                        <div class="flappy-ready-guide">Chạm màn hình hoặc nhấn [Space] để nẹt pô phóng lên! 🚀</div>
                        <div class="flappy-ready-best-badge" id="flappy-ready-best">🏆 Kỷ lục điểm: 0</div>
                    </div>

                    <!-- 11. Màn hình GAMEOVER - Tấm thiệp động viên -->
                    <div class="flappy-gameover-overlay" id="flappy-gameover-overlay" style="display: none;">
                        <div class="flappy-card-body" id="flappy-card-body" title="Bấm vào thiệp để xem chi tiết">
                            <div class="flappy-card-ribbon">💌 TẤM THIỆP ĐỘNG VIÊN 💌</div>
                            <div class="flappy-card-content">
                                <div class="flappy-card-quote" id="flappy-card-quote">"Đừng buồn vì một lần Game Over nha! Bạn đã chơi rất xuất sắc rồi! 🌸✨💖"</div>
                                <div class="flappy-card-badge" id="flappy-card-badge">⭐ Điểm: 0 &nbsp;|&nbsp; 🏆 Kỷ lục: 0</div>
                                <div class="flappy-card-hint">Bấm vào thiệp để mở to 💌 • Bấm bên ngoài để chơi lại 🔄</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Cache các phần tử DOM cố định
            this.stage = document.getElementById('flappy-dom-stage');
            this.pipesLayer = document.getElementById('flappy-pipes-layer');
            this.groundTrack = document.getElementById('flappy-ground-track');
            this.birdHero = document.getElementById('flappy-bird-hero');
            this.particlesLayer = document.getElementById('flappy-particles-layer');
            this.hudScore = document.getElementById('flappy-hud-score');
            this.hudBest = document.getElementById('flappy-hud-best');
            this.readyOverlay = document.getElementById('flappy-ready-overlay');
            this.readyBest = document.getElementById('flappy-ready-best');
            this.gameoverOverlay = document.getElementById('flappy-gameover-overlay');
            this.cardBody = document.getElementById('flappy-card-body');
            this.cardQuote = document.getElementById('flappy-card-quote');
            this.cardBadge = document.getElementById('flappy-card-badge');
        }

        // Tạo sẵn các bể Object Pool (Zero DOM allocation trong khi chơi)
        buildObjectPools() {
            // 1. Pipe Pool: Tối đa 5 cặp cột ống tồn tại cùng lúc trên màn hình 800px
            this.pipePool = [];
            for (let i = 0; i < 5; i++) {
                const el = document.createElement('div');
                el.className = 'flappy-pipe-pair';
                el.style.display = 'none';
                el.style.transform = 'translate3d(-500px, 0, 0)';
                el.innerHTML = `
                    <div class="flappy-pipe-top"><div class="flappy-pipe-cap"></div></div>
                    <div class="flappy-pipe-bottom"><div class="flappy-pipe-cap"></div></div>
                `;
                this.pipesLayer.appendChild(el);
                this.pipePool.push({
                    el: el,
                    topEl: el.querySelector('.flappy-pipe-top'),
                    botEl: el.querySelector('.flappy-pipe-bottom'),
                    active: false,
                    x: -500,
                    w: 68,
                    topH: 0,
                    botY: 0,
                    passed: false
                });
            }

            // 2. Smoke Pool: Tối đa 5 đốm khói pô xe
            this.smokePool = [];
            for (let i = 0; i < 5; i++) {
                const s = document.createElement('div');
                s.className = 'flappy-smoke';
                s.style.display = 'none';
                this.particlesLayer.appendChild(s);
                this.smokePool.push({
                    el: s,
                    active: false,
                    hideTimer: null
                });
            }

            // 3. Floating Score Pool: Tối đa 3 nhãn điểm +1
            this.scorePool = [];
            for (let i = 0; i < 3; i++) {
                const ft = document.createElement('div');
                ft.className = 'flappy-floating-text';
                ft.textContent = '+1';
                ft.style.display = 'none';
                this.particlesLayer.appendChild(ft);
                this.scorePool.push({
                    el: ft,
                    active: false,
                    hideTimer: null
                });
            }
        }

        // Tự động đồng bộ tỉ lệ thu phóng của sân khấu theo kích thước khung chứa
        resizeStage() {
            if (!this.container || !this.stage) return;
            const rect = this.container.getBoundingClientRect();
            const cw = rect.width;
            const ch = rect.height;
            if (cw <= 0 || ch <= 0) return;

            // Tự động thích ứng chiều cao sân khấu ảo theo tỉ lệ thực tế của khung chứa
            // Khung 16:9 trên PC -> height = 450; Khung 4:3 trên điện thoại -> height = 600
            const targetH = Math.round(this.width * (ch / cw));
            this.height = Math.max(450, Math.min(800, targetH));
            this.playH = this.height - this.groundH;
            if (this.stage) {
                this.stage.style.height = this.height + 'px';
            }

            const zoom = Math.min(cw / this.width, ch / this.height);
            this.stage.style.transform = `translate(-50%, -50%) scale(${zoom})`;
        }

        // Khởi tạo trạng thái bàn chơi
        initGame() {
            // Chú Bangboo Mô Tô (Zenless Zone Zero)
            // Vật lý được cân chỉnh hoàn hảo: Nảy dứt khoát, rơi tự nhiên, tốc độ lướt phấn khích
            this.cat = {
                x: 130,
                y: (this.playH - 58) / 2,
                w: 52,
                h: 58,
                vy: 0,
                gravity: 0.32,      // Trọng lực rõ ràng, không lơ lửng như bóng bay
                jumpForce: -6.2,    // Lực nẹt pô nảy lên nhạy bén tức thì
                maxFallSpeed: 7.6,  // Giới hạn tốc độ rơi
                rotation: 0,
                targetRotation: 0,
                floatTimer: 0
            };

            // Reset toàn bộ Pipe Pool về trạng thái ẩn
            for (let i = 0; i < this.pipePool.length; i++) {
                const p = this.pipePool[i];
                p.active = false;
                p.passed = false;
                p.el.style.display = 'none';
                p.el.style.transform = 'translate3d(-500px, 0, 0)';
            }

            this.pipeSpawnTimer = 0;
            this.pipeGap = 160;       // Khe hở 160px rộng rãi, công bằng
            this.pipeWidth = 68;      // Chiều rộng cột ống
            this.pipeSpeed = 3.6;     // Tốc độ lướt nhanh gọn, sống động, chuẩn arcade
            this.pipeInterval = 84;   // Nhịp độ xuất hiện cột ống nhịp nhàng

            // Điểm số & trạng thái
            this.score = 0;
            this.coins = 0;
            this.gameState = 'READY';
            this.setPlayingState(false);

            // Cập nhật HUD
            if (this.hudScore) this.hudScore.textContent = '0';
            if (this.hudBest) this.hudBest.textContent = '🏆 Kỷ lục: ' + this.bestScore;
            if (this.readyBest) this.readyBest.textContent = '🏆 Kỷ lục điểm: ' + this.bestScore;
            if (this.readyOverlay) this.readyOverlay.style.display = 'flex';
            if (this.gameoverOverlay) this.gameoverOverlay.style.display = 'none';

            // Đặt vị trí ban đầu
            if (this.birdHero) {
                this.birdHero.style.transform = `translate3d(${this.cat.x}px, ${Math.round(this.cat.y)}px, 0)`;
            }
        }

        // Quản lý trạng thái đang chơi để tự động ẩn các nút điều khiển trên điện thoại
        setPlayingState(isPlaying) {
            const containers = document.querySelectorAll('#mario-game-container, .game-card');
            if (isPlaying) {
                document.body.classList.add('is-playing');
                containers.forEach(el => el.classList.add('is-playing'));
            } else {
                document.body.classList.remove('is-playing');
                containers.forEach(el => el.classList.remove('is-playing'));
            }
        }

        // Bắt đầu chơi lại
        restart() {
            this.initGame();
        }

        // Hành động nẹt pô bay lên
        flap() {
            audio.init();

            if (this.gameState === 'READY') {
                this.gameState = 'PLAYING';
                this.setPlayingState(true);
                this.cat.vy = this.cat.jumpForce;
                this.cat.targetRotation = -0.38;
                audio.flap();
                if (this.readyOverlay) this.readyOverlay.style.display = 'none';
                this.spawnSmoke(this.cat.x + 6, this.cat.y + this.cat.h - 12);
                return;
            }

            if (this.gameState === 'PLAYING') {
                this.cat.vy = this.cat.jumpForce;
                this.cat.targetRotation = -0.42;
                audio.flap();
                this.spawnSmoke(this.cat.x + 6, this.cat.y + this.cat.h - 12);
            }
        }

        // Tái sử dụng khói pô từ Pool (Zero DOM allocation)
        spawnSmoke(x, y) {
            for (let i = 0; i < this.smokePool.length; i++) {
                const s = this.smokePool[i];
                if (!s.active) {
                    s.active = true;
                    if (s.hideTimer) clearTimeout(s.hideTimer);
                    s.el.style.left = `${Math.round(x)}px`;
                    s.el.style.top = `${Math.round(y)}px`;
                    s.el.style.display = 'block';
                    s.hideTimer = setTimeout(() => {
                        s.el.style.display = 'none';
                        s.active = false;
                    }, 350);
                    break;
                }
            }
        }

        // Tái sử dụng nhãn +1 điểm từ Pool (Zero DOM allocation)
        spawnFloatingScore(x, y) {
            for (let i = 0; i < this.scorePool.length; i++) {
                const ft = this.scorePool[i];
                if (!ft.active) {
                    ft.active = true;
                    if (ft.hideTimer) clearTimeout(ft.hideTimer);
                    ft.el.style.left = `${Math.round(x)}px`;
                    ft.el.style.top = `${Math.round(y)}px`;
                    ft.el.style.display = 'block';
                    ft.hideTimer = setTimeout(() => {
                        ft.el.style.display = 'none';
                        ft.active = false;
                    }, 550);
                    break;
                }
            }
        }

        // Kích hoạt một cặp ống nước từ Pool (Zero DOM allocation)
        spawnPipe() {
            for (let i = 0; i < this.pipePool.length; i++) {
                const p = this.pipePool[i];
                if (!p.active) {
                    const minH = 45;
                    const maxH = this.playH - this.pipeGap - 45; // 382 - 160 - 45 = 177
                    const topH = Math.floor(minH + Math.random() * (maxH - minH));
                    const botY = topH + this.pipeGap;
                    const botH = this.playH - botY;

                    p.topH = topH;
                    p.botY = botY;
                    p.x = this.width + 10;
                    p.passed = false;
                    p.active = true;

                    p.topEl.style.height = `${topH}px`;
                    p.botEl.style.top = `${botY}px`;
                    p.botEl.style.height = `${botH}px`;
                    p.el.style.transform = `translate3d(${Math.round(p.x)}px, 0, 0)`;
                    p.el.style.display = 'block';
                    break;
                }
            }
        }

        // Xử lý khi Game Over
        triggerGameOver() {
            if (this.gameState === 'GAMEOVER') return;
            this.gameState = 'GAMEOVER';
            this.setPlayingState(false);

            audio.hit();
            setTimeout(() => audio.die(), 120);

            // Cập nhật kỷ lục
            if (this.score > this.bestScore) {
                this.bestScore = this.score;
                try {
                    localStorage.setItem('chatflex_flappy_best', this.bestScore.toString());
                } catch (e) {}
            }

            this.coins = this.score;

            // Đổi thiệp ngẫu nhiên mới
            if (typeof window.pickRandomGameCard === 'function') {
                window.pickRandomGameCard();
            }

            // Cập nhật nội dung thiệp trên DOM
            const cardText = (typeof window.getCurrentGameCardText === 'function')
                ? window.getCurrentGameCardText()
                : 'Đừng buồn vì một lần Game Over nha! Bạn đã chơi rất xuất sắc rồi! 🌸✨💖';

            if (this.cardQuote) this.cardQuote.textContent = `"${cardText}"`;
            if (this.cardBadge) this.cardBadge.innerHTML = `⭐ Điểm: ${this.score} &nbsp;|&nbsp; 🏆 Kỷ lục: ${Math.max(this.score, this.bestScore)}`;
            if (this.hudBest) this.hudBest.textContent = '🏆 Kỷ lục: ' + Math.max(this.score, this.bestScore);

            // Hiện tấm thiệp
            if (this.gameoverOverlay) {
                this.gameoverOverlay.style.display = 'flex';
            }
        }

        // Gán các sự kiện tương tác chuột, cảm ứng và bàn phím (Triệt tiêu Ghost Click)
        bindEvents() {
            let lastInteractionTime = 0;

            const handleAction = (e) => {
                if (e) {
                    if (e.target && e.target.closest && e.target.closest('#flappy-card-body, .game-hud-toolbar, .game-hud-btn, .game-hud-exit-btn, .mario-fs-actions')) {
                        return; // Người chơi nhấp vào thiệp hoặc các nút điều khiển -> không bay
                    }
                    if (e.cancelable) e.preventDefault();
                }

                lastInteractionTime = Date.now();

                if (this.gameState === 'READY') {
                    this.flap();
                } else if (this.gameState === 'PLAYING') {
                    this.flap();
                } else if (this.gameState === 'GAMEOVER') {
                    this.restart();
                }
            };

            // Sử dụng pointerdown cho tốc độ phản hồi tức thì (<1ms) trên cả chuột và cảm ứng
            this.container.addEventListener('pointerdown', (e) => {
                handleAction(e);
            }, { passive: false });

            // Lọc bỏ click giả lập sau touch (ghost click chống nhảy đôi)
            this.container.addEventListener('click', (e) => {
                if (Date.now() - lastInteractionTime < 400) return;
                handleAction(e);
            });

            // Sự kiện nhấp trực tiếp vào Tấm thiệp để mở thiệp to
            if (this.cardBody) {
                this.cardBody.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (typeof window.showGameOverCard === 'function') {
                        window.showGameOverCard(this.score, this.coins, () => {
                            this.restart();
                        });
                    }
                });
            }

            // Bàn phím điều khiển (Space / ArrowUp / KeyW / KeyR)
            window.addEventListener('keydown', (e) => {
                if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
                    e.preventDefault();
                    if (this.gameState === 'GAMEOVER') {
                        this.restart();
                    } else {
                        this.flap();
                    }
                } else if (e.code === 'KeyR') {
                    this.restart();
                }
            });
        }

        // --- Bước cập nhật vật lý chuẩn 60Hz (Deterministic Fixed Physics Step) ---
        updatePhysics() {
            // Trạng thái READY: Chú Bangboo nhấp nhô bồng bềnh
            if (this.gameState === 'READY') {
                this.cat.floatTimer += 0.06;
                this.cat.y = (this.playH - this.cat.h) / 2 + Math.sin(this.cat.floatTimer) * 8;
                this.cat.rotation = 0;

                // Mặt đất cuộn mượt
                this.groundX -= 1.4;
                if (this.groundX <= -28) this.groundX += 28;
                return;
            }

            // Trạng thái PLAYING
            if (this.gameState === 'PLAYING') {
                // Cuộn mặt đất theo tốc độ trò chơi (chắc chắn lặp ở chu kỳ 28px)
                this.groundX -= this.pipeSpeed;
                if (this.groundX <= -28) this.groundX += 28;

                // Vật lý chú Bangboo
                this.cat.vy += this.cat.gravity;
                if (this.cat.vy > this.cat.maxFallSpeed) this.cat.vy = this.cat.maxFallSpeed;
                this.cat.y += this.cat.vy;

                // Góc nghiêng xe máy
                if (this.cat.vy < 0) {
                    this.cat.targetRotation = -0.38;
                } else {
                    this.cat.targetRotation = Math.min(0.9, this.cat.vy * 0.16);
                }
                this.cat.rotation += (this.cat.targetRotation - this.cat.rotation) * 0.22;

                // Va chạm trần
                if (this.cat.y < 0) {
                    this.cat.y = 0;
                    this.cat.vy = 0;
                }

                // Va chạm mặt đất
                const groundLimit = this.playH - this.cat.h;
                if (this.cat.y >= groundLimit) {
                    this.cat.y = groundLimit;
                    this.triggerGameOver();
                    return;
                }

                // Sinh cột ống nước định kỳ
                this.pipeSpawnTimer++;
                if (this.pipeSpawnTimer >= this.pipeInterval) {
                    this.spawnPipe();
                    this.pipeSpawnTimer = 0;
                }

                // Di chuyển & kiểm tra va chạm các cột ống đang hoạt động
                for (let i = 0; i < this.pipePool.length; i++) {
                    const p = this.pipePool[i];
                    if (!p.active) continue;

                    p.x -= this.pipeSpeed;

                    // Ghi điểm khi bay qua ống an toàn
                    if (!p.passed && p.x + p.w < this.cat.x) {
                        p.passed = true;
                        this.score++;
                        this.coins = this.score;
                        audio.point();
                        if (this.hudScore) this.hudScore.textContent = this.score.toString();
                        this.spawnFloatingScore(this.cat.x + this.cat.w / 2, this.cat.y);
                    }

                    // Hitbox kiểm tra va chạm (thu hẹp 7px để công bằng và trải nghiệm mượt mà)
                    const inset = 7;
                    const catBox = {
                        l: this.cat.x + inset,
                        r: this.cat.x + this.cat.w - inset,
                        t: this.cat.y + inset,
                        b: this.cat.y + this.cat.h - inset
                    };

                    const hitTop = (catBox.r > p.x && catBox.l < p.x + p.w && catBox.t < p.topH);
                    const hitBottom = (catBox.r > p.x && catBox.l < p.x + p.w && catBox.b > p.botY);

                    if (hitTop || hitBottom) {
                        this.triggerGameOver();
                        return;
                    }

                    // Thu dọn ống đã trôi khuất màn hình về Pool
                    if (p.x + p.w < -30) {
                        p.active = false;
                        p.el.style.display = 'none';
                    }
                }
            }

            // Trạng thái GAMEOVER: Bangboo rơi xuống mặt đất
            if (this.gameState === 'GAMEOVER') {
                const groundLimit = this.playH - this.cat.h;
                if (this.cat.y < groundLimit) {
                    this.cat.vy += this.cat.gravity * 1.5;
                    this.cat.y += this.cat.vy;
                    this.cat.rotation = Math.min(1.4, this.cat.rotation + 0.12);
                    if (this.cat.y >= groundLimit) {
                        this.cat.y = groundLimit;
                    }
                }
            }
        }

        // --- Kết xuất DOM vị trí đã tính toán lên GPU (Pixel-Snapping khử rung) ---
        renderDOM() {
            // 1. Chú Bangboo
            if (this.birdHero) {
                const roundY = Math.round(this.cat.y);
                const rot = this.cat.rotation.toFixed(3);
                this.birdHero.style.transform = `translate3d(${this.cat.x}px, ${roundY}px, 0) rotate(${rot}rad)`;
            }

            // 2. Mặt đất
            if (this.groundTrack) {
                const roundGroundX = Math.round(this.groundX);
                this.groundTrack.style.transform = `translate3d(${roundGroundX}px, 0, 0)`;
            }

            // 3. Các cột ống nước đang hoạt động
            if (this.gameState === 'PLAYING') {
                for (let i = 0; i < this.pipePool.length; i++) {
                    const p = this.pipePool[i];
                    if (p.active) {
                        const roundX = Math.round(p.x);
                        p.el.style.transform = `translate3d(${roundX}px, 0, 0)`;
                    }
                }
            }
        }

        // Vòng lặp chính Game Loop (Deterministic 60Hz Physics Accumulator)
        loop(timestamp) {
            if (this.isTabHidden) {
                this._rafId = requestAnimationFrame(this._boundLoop);
                return;
            }

            if (!this.lastTime) this.lastTime = timestamp;
            let frameTime = (timestamp - this.lastTime) / 1000;
            this.lastTime = timestamp;

            // Chống spiral of death khi bị lag hoặc đổi app (tối đa 0.05s = 50ms)
            if (frameTime > 0.05) frameTime = 0.05;

            this.accumulator += frameTime;

            // Cập nhật vật lý với bước thời gian cố định 60Hz (1/60s = 0.016667s)
            const FIXED_STEP = 1 / 60;
            while (this.accumulator >= FIXED_STEP) {
                this.updatePhysics();
                this.accumulator -= FIXED_STEP;
            }

            // Kết xuất vị trí lên GPU DOM (1 lần duy nhất mỗi frame)
            this.renderDOM();

            this._rafId = requestAnimationFrame(this._boundLoop);
        }

        // Dọn dẹp game khi chuyển trang (hỗ trợ Seamless SPA Router không giật lag)
        destroy() {
            if (this._rafId) {
                cancelAnimationFrame(this._rafId);
                this._rafId = null;
            }
            this.gameState = 'DESTROYED';
            if (this.container) {
                this.container.innerHTML = '';
            }
        }
    }

    // Export toàn cục (tương thích tuyệt đối cả FlappyBirdGame & MarioGame)
    window.FlappyGame = FlappyGame;
    window.FlappyBirdGame = FlappyGame;
    window.MarioGame = FlappyGame;

    // --- 3. CÁC HÀM TIỆN ÍCH TOÀN CỤC CHO GIAO DIỆN NGOÀI ---
    // 1. Chơi lại (Restart)
    window.restartFlappyGame = function () {
        const g = window.flappyInstance || window.marioInstance || window.flappySideGameInstance || window.marioSideGameInstance;
        if (g && typeof g.restart === 'function') {
            g.restart();
        }
        if (typeof window.closeGameOverCard === 'function') {
            window.closeGameOverCard();
        }
        const overlay = document.getElementById('game-card-modal-overlay');
        if (overlay) overlay.style.display = 'none';
    };
    window.restartMarioGame = window.restartFlappyGame;

    // 2. Bật / Tắt âm thanh
    window.toggleGameAudio = function () {
        const a = window.FlappyAudio || window.MarioAudio || audio;
        if (a) {
            a.muted = !a.muted;
        }
        const isMuted = a ? a.muted : false;

        const soundIcons = document.querySelectorAll('#sound-icon, #side-sound-icon, .hud-sound-icon');
        const soundTexts = document.querySelectorAll('#sound-text, #side-sound-text');
        const fsSoundBtn = document.getElementById('fs-sound-btn');
        const soundBtns = document.querySelectorAll('#btn-toggle-sound, #side-audio-btn, .btn-hud-sound');

        soundIcons.forEach(el => el.innerText = isMuted ? '🔇' : '🔊');
        soundTexts.forEach(el => el.innerText = isMuted ? 'Âm thanh: Tắt' : 'Âm thanh: Bật');
        if (fsSoundBtn) fsSoundBtn.innerText = isMuted ? '🔇' : '🔊';

        soundBtns.forEach(btn => {
            if (isMuted) {
                btn.style.background = 'rgba(100, 116, 139, 0.85)';
                btn.style.borderColor = 'rgba(203, 213, 225, 0.6)';
                btn.style.color = '#ffffff';
            } else {
                btn.style.background = 'rgba(190, 24, 93, 0.85)';
                btn.style.borderColor = 'rgba(244, 114, 182, 0.85)';
                btn.style.color = '#ffffff';
            }
        });
        return !isMuted;
    };

    // 3. Toàn màn hình (Fullscreen)
    window.toggleFullscreenMario = function (containerId) {
        containerId = containerId || 'mario-game-container';
        let elem = document.getElementById(containerId);
        if (!elem) {
            elem = document.getElementById('mario-game-container') || document.getElementById('mario-side-container') || document.getElementById('mario-side-panel');
        }
        if (!elem) return;

        const isFs = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;

        if (!isFs && !elem.classList.contains('is-mario-fullscreen')) {
            if (window.toggleMainNavbar) window.toggleMainNavbar(false);

            if (elem.requestFullscreen) {
                elem.requestFullscreen().catch(() => elem.classList.add('is-mario-fullscreen'));
            } else if (elem.webkitRequestFullscreen) {
                elem.webkitRequestFullscreen();
            } else if (elem.mozRequestFullScreen) {
                elem.mozRequestFullScreen();
            } else if (elem.msRequestFullscreen) {
                elem.msRequestFullscreen();
            } else {
                elem.classList.add('is-mario-fullscreen');
            }
            elem.classList.add('is-mario-fullscreen');
            document.body.classList.add('in-mario-fullscreen-mode');

            const fsText = elem.querySelector('.fs-text') || document.querySelector('.btn-mario-fullscreen-toggle .fs-text');
            const fsIcon = elem.querySelector('.fs-icon') || document.querySelector('.btn-mario-fullscreen-toggle .fs-icon');
            if (fsText) fsText.innerText = 'Thu nhỏ';
            if (fsIcon) fsIcon.innerText = '🗗';

            const g = window.flappyInstance || window.marioInstance;
            if (g && typeof g.resizeStage === 'function') {
                setTimeout(() => g.resizeStage(), 60);
            }
        } else {
            window.exitFullscreenMario(containerId);
        }
    };

    window.exitFullscreenMario = function (containerId) {
        if (document.exitFullscreen && (document.fullscreenElement || document.webkitFullscreenElement)) {
            document.exitFullscreen().catch(() => {});
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }

        const containers = document.querySelectorAll('#mario-game-container, #mario-side-container, #mario-side-panel, .is-mario-fullscreen');
        containers.forEach(c => c.classList.remove('is-mario-fullscreen'));
        document.body.classList.remove('in-mario-fullscreen-mode');

        const fsText = document.querySelector('.btn-mario-fullscreen-toggle .fs-text');
        const fsIcon = document.querySelector('.btn-mario-fullscreen-toggle .fs-icon');
        if (fsText) fsText.innerText = 'Toàn màn hình';
        if (fsIcon) fsIcon.innerText = '⛶';

        const g = window.flappyInstance || window.marioInstance;
        if (g && typeof g.resizeStage === 'function') {
            setTimeout(() => g.resizeStage(), 60);
        }
    };

    // Lắng nghe sự kiện thoát Fullscreen
    const handleFsChange = function () {
        const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
        if (!isFs) {
            const containers = document.querySelectorAll('#mario-game-container, #mario-side-panel, .is-mario-fullscreen');
            containers.forEach(c => c.classList.remove('is-mario-fullscreen'));
            document.body.classList.remove('in-mario-fullscreen-mode');
            const fsText = document.querySelector('.btn-mario-fullscreen-toggle .fs-text');
            const fsIcon = document.querySelector('.btn-mario-fullscreen-toggle .fs-icon');
            if (fsText) fsText.innerText = 'Toàn màn hình';
            if (fsIcon) fsIcon.innerText = '⛶';

            const g = window.flappyInstance || window.marioInstance;
            if (g && typeof g.resizeStage === 'function') {
                setTimeout(() => g.resizeStage(), 60);
            }
        }
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    document.addEventListener('mozfullscreenchange', handleFsChange);
    document.addEventListener('MSFullscreenChange', handleFsChange);

    window.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' || e.code === 'Escape') {
            window.exitFullscreenMario();
        }
    });

    // 4. Bay lên (Flap)
    window.flapGameHero = function () {
        const g = window.flappyInstance || window.marioInstance || window.flappySideGameInstance || window.marioSideGameInstance;
        if (g && typeof g.flap === 'function') {
            g.flap();
        }
    };
})();
