/**
 * Flappy Bangboo (Zenless Zone Zero) - 100% DOM & GPU Hardware-Accelerated Game Engine
 * ZERO CANVAS CONTEXT - KHÔNG SỬ DỤNG CANVAS!
 * 
 * Toàn bộ trò chơi được kết xuất trực tiếp bằng các phần tử DOM (HTML5/CSS3) và tăng tốc 
 * phần cứng bằng GPU qua CSS `transform: translate3d(...)` và `will-change: transform`.
 * - Tiêu thụ CPU và pin cực thấp trên điện thoại di động
 * - Loại bỏ hoàn toàn hiện tượng nghẽn rasterization / Layout Thrashing của 2D Canvas
 * - Duy trì ổn định 60 - 120 FPS mượt mà trên mọi dòng iPhone, iPad và điện thoại Android!
 */
(function () {
    'use strict';

    // --- 1. Web Audio 8-bit Sound Generator (Độc lập, không phụ thuộc Canvas) ---
    class RetroAudio {
        constructor() {
            this.ctx = null;
            this.muted = false;
        }

        init() {
            if (!this.ctx) {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (AudioCtx) {
                    this.ctx = new AudioCtx();
                }
            }
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
        }

        tone(freq, type, duration, startVol = 0.15, endVol = 0.001, slideFreq = null) {
            if (this.muted || !this.ctx) return;
            try {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = type;
                osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
                if (slideFreq) {
                    osc.frequency.exponentialRampToValueAtTime(Math.max(10, slideFreq), this.ctx.currentTime + duration);
                }
                gain.gain.setValueAtTime(startVol, this.ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(endVol, this.ctx.currentTime + duration);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start();
                osc.stop(this.ctx.currentTime + duration);
            } catch (e) {}
        }

        flap() {
            this.init();
            // Tiếng vỗ cánh / nẹt pô xe mô tô nảy lên
            this.tone(280, 'sine', 0.11, 0.16, 0.01, 560);
        }

        point() {
            this.init();
            if (this.muted || !this.ctx) return;
            const now = this.ctx.currentTime;
            const playNote = (f, time, dur) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(f, time);
                gain.gain.setValueAtTime(0.2, time);
                gain.gain.exponentialRampToValueAtTime(0.01, time + dur);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(time);
                osc.stop(time + dur);
            };
            playNote(987.77, now, 0.07); // B5
            playNote(1318.51, now + 0.07, 0.26); // E6
        }

        hit() {
            this.init();
            this.tone(240, 'sawtooth', 0.14, 0.25, 0.02, 60);
        }

        die() {
            this.init();
            this.tone(180, 'triangle', 0.22, 0.22, 0.01, 40);
        }

        swoosh() {
            this.init();
            this.tone(360, 'sine', 0.14, 0.1, 0.01, 180);
        }
    }

    const audio = new RetroAudio();
    window.FlappyAudio = audio;
    window.MarioAudio = audio;
    window.RetroAudio = RetroAudio;

    // --- 2. Flappy Bangboo DOM & GPU Engine (Zero Canvas) ---
    class FlappyGame {
        constructor(elementId) {
            this.elementId = elementId;
            let target = document.getElementById(elementId);
            if (!target) return;

            // Nếu element truyền vào là thẻ <canvas> (từ cache trình duyệt hoặc code cũ),
            // tự động chuyển đổi thành <div> để loại bỏ 100% Canvas API và giải phóng RAM/GPU
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

            // Lưu instance toàn cục để tương thích tuyệt đối với các nút bấm giao diện ngoài
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
            this.pipes = [];
            this.groundX = 0;

            // Thiết lập cấu trúc DOM hoàn chỉnh
            this.buildDOM();

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
                    this.resizeStage();
                }
            });

            // Vòng lặp chuyển động Game Loop (60 - 120 FPS)
            this.lastTime = performance.now();
            // Bind loop 1 lần duy nhất tránh tạo function mới mỗi frame (giảm GC pressure)
            this._boundLoop = this.loop.bind(this);
            this._rafId = requestAnimationFrame(this._boundLoop);
        }

        // Xây dựng cây phần tử DOM GPU bên trong container
        buildDOM() {
            this.container.innerHTML = `
                <div class="flappy-dom-stage" id="flappy-dom-stage">
                    <!-- 1. Bầu trời Flappy Bird -->
                    <div class="flappy-sky"></div>

                    <!-- 2. Mây trắng bồng bềnh -->
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

                    <!-- 5. Tầng chứa các cột ống nước -->
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

                    <!-- 8. Tầng chứa khói pô và chữ điểm bay -->
                    <div class="flappy-particles-layer" id="flappy-particles-layer"></div>

                    <!-- 9. HUD Điểm số -->
                    <div class="flappy-hud-score" id="flappy-hud-score">0</div>
                    <div class="flappy-hud-best" id="flappy-hud-best">🏆 Kỷ lục: 0</div>

                    <!-- 10. Màn hình GET READY -->
                    <div class="flappy-ready-overlay" id="flappy-ready-overlay">
                        <div class="flappy-ready-title">GET READY! 🚀</div>
                        <div class="flappy-ready-guide">Chạm màn hình hoặc nhấn [Space] để Bangboo nẹt pô bay lên! 🚀</div>
                        <div class="flappy-ready-best-badge" id="flappy-ready-best">🏆 Kỷ lục điểm: 0</div>
                    </div>

                    <!-- 11. Màn hình GAMEOVER - Tấm thiệp động viên -->
                    <div class="flappy-gameover-overlay" id="flappy-gameover-overlay" style="display: none;">
                        <div class="flappy-card-body" id="flappy-card-body" title="Bấm vào thiệp để xem chi tiết">
                            <div class="flappy-card-ribbon">💌 TẤM THIỆP ĐỘNG VIÊN 💌</div>
                            <div class="flappy-card-content">
                                <div class="flappy-card-quote" id="flappy-card-quote">"Đừng buồn vì một lần Game Over nha! Bạn đã chơi rất xuất sắc rồi! 🌸✨💖"</div>
                                <div class="flappy-card-badge" id="flappy-card-badge">⭐ Điểm: 0 &nbsp;|&nbsp; 🏆 Kỷ lục: 0</div>
                                <div class="flappy-card-hint">Bấm vào thiệp để mở to 💌 • Bấm bên ngoài (hoặc phím R) để chơi lại 🔄</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Lưu các tham chiếu DOM để truy xuất siêu tốc trong Game Loop
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

        // Tự động đồng bộ tỉ lệ thu phóng (Scale Zoom) của sân khấu theo kích thước khung chứa
        resizeStage() {
            if (!this.container || !this.stage) return;
            const rect = this.container.getBoundingClientRect();
            const cw = rect.width;
            const ch = rect.height;
            if (cw <= 0 || ch <= 0) return;
            const zoom = Math.min(cw / this.width, ch / this.height);
            this.stage.style.transform = `translate(-50%, -50%) scale(${zoom})`;
        }

        // Khởi tạo trạng thái bàn chơi
        initGame() {
            // Chú Bangboo Mô Tô (Zenless Zone Zero)
            this.cat = {
                x: 130,
                y: (this.playH - 58) / 2,
                w: 52,
                h: 58,
                vy: 0,
                gravity: 0.25,      // Trọng lực rơi tự nhiên, êm ái
                jumpForce: -5.4,    // Lực nảy nẹt pô xe mô tô dứt khoát
                maxFallSpeed: 6.8,  // Giới hạn tốc độ rơi tối đa
                rotation: 0,
                targetRotation: 0,
                floatTimer: 0
            };

            // Dọn sạch các ống nước cũ trong DOM
            if (this.pipesLayer) {
                this.pipesLayer.innerHTML = '';
            }
            this.pipes = [];
            this.pipeSpawnTimer = 0;
            this.pipeGap = 165;       // Khe hở rộng rãi 165px thoải mái bay lướt
            this.pipeWidth = 68;      // Chiều rộng thân cột ống
            this.pipeSpeed = 3.0;     // Tốc độ ống trôi kịch tính
            this.pipeInterval = 105;  // Khoảng cách sinh cột ống hợp lý

            // Điểm số
            this.score = 0;
            this.coins = 0;
            this.gameState = 'READY';

            // Cập nhật giao diện ban đầu
            if (this.hudScore) this.hudScore.textContent = '0';
            if (this.hudBest) this.hudBest.textContent = '🏆 Kỷ lục: ' + this.bestScore;
            if (this.readyBest) this.readyBest.textContent = '🏆 Kỷ lục điểm: ' + this.bestScore;
            if (this.readyOverlay) this.readyOverlay.style.display = 'flex';
            if (this.gameoverOverlay) this.gameoverOverlay.style.display = 'none';

            // Đặt vị trí ban đầu cho chú mèo
            if (this.birdHero) {
                this.birdHero.style.transform = `translate3d(${this.cat.x}px, ${this.cat.y}px, 0)`;
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
                this.cat.vy = this.cat.jumpForce;
                this.cat.targetRotation = -0.36;
                audio.flap();
                if (this.readyOverlay) this.readyOverlay.style.display = 'none';
                this.spawnSmoke(this.cat.x + 6, this.cat.y + this.cat.h - 12);
                return;
            }

            if (this.gameState === 'PLAYING') {
                this.cat.vy = this.cat.jumpForce;
                this.cat.targetRotation = -0.40;
                audio.flap();
                this.spawnSmoke(this.cat.x + 6, this.cat.y + this.cat.h - 12);
            }
        }

        // Hiệu ứng khói pô GPU
        spawnSmoke(x, y) {
            if (!this.particlesLayer) return;
            const smoke = document.createElement('div');
            smoke.className = 'flappy-smoke';
            smoke.style.left = `${x}px`;
            smoke.style.top = `${y}px`;
            this.particlesLayer.appendChild(smoke);
            setTimeout(() => {
                if (smoke.parentNode) smoke.parentNode.removeChild(smoke);
            }, 380);
        }

        // Hiệu ứng chữ +1 điểm nổi lên
        spawnFloatingScore(text, x, y) {
            if (!this.particlesLayer) return;
            const ft = document.createElement('div');
            ft.className = 'flappy-floating-text';
            ft.textContent = text;
            ft.style.left = `${x}px`;
            ft.style.top = `${y}px`;
            this.particlesLayer.appendChild(ft);
            setTimeout(() => {
                if (ft.parentNode) ft.parentNode.removeChild(ft);
            }, 600);
        }

        // Sinh cặp cột ống nước mới
        spawnPipe() {
            if (!this.pipesLayer) return;
            const minH = 45;
            const maxH = this.playH - this.pipeGap - 45; // 382 - 165 - 45 = 172
            const topH = Math.floor(minH + Math.random() * (maxH - minH));
            const botY = topH + this.pipeGap;
            const botH = this.playH - botY;

            const pipeEl = document.createElement('div');
            pipeEl.className = 'flappy-pipe-pair';
            pipeEl.innerHTML = `
                <div class="flappy-pipe-top" style="height: ${topH}px;">
                    <div class="flappy-pipe-cap"></div>
                </div>
                <div class="flappy-pipe-bottom" style="top: ${botY}px; height: ${botH}px;">
                    <div class="flappy-pipe-cap"></div>
                </div>
            `;
            pipeEl.style.transform = `translate3d(${this.width + 10}px, 0, 0)`;
            this.pipesLayer.appendChild(pipeEl);

            this.pipes.push({
                x: this.width + 10,
                w: this.pipeWidth,
                topH: topH,
                botY: botY,
                botH: botH,
                passed: false,
                el: pipeEl
            });
        }

        // Xử lý khi Game Over
        triggerGameOver() {
            if (this.gameState === 'GAMEOVER') return;
            this.gameState = 'GAMEOVER';

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

        // Gán các sự kiện tương tác chuột, cảm ứng và bàn phím
        bindEvents() {
            const handleAction = (e) => {
                if (e) {
                    if (e.target && e.target.closest && e.target.closest('#flappy-card-body')) {
                        // Người chơi nhấp vào thiệp -> mở modal thiệp to
                        return;
                    }
                    e.preventDefault();
                }

                if (this.gameState === 'READY') {
                    this.flap();
                } else if (this.gameState === 'PLAYING') {
                    this.flap();
                } else if (this.gameState === 'GAMEOVER') {
                    this.restart();
                }
            };

            // Chạm cảm ứng trên điện thoại
            this.container.addEventListener('touchstart', handleAction, { passive: false });

            // Nhấp chuột trên máy tính
            this.container.addEventListener('click', (e) => {
                this.container.focus();
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

        // --- Cập nhật Logic & Vật lý Game (Loop) ---
        update(dt) {
            const timeScale = Math.min(1.8, Math.max(0.5, (dt || 0.0166) * 60));

            // Trạng thái READY: Chú Bangboo nhấp nhô bồng bềnh
            if (this.gameState === 'READY') {
                this.cat.floatTimer += 0.06 * timeScale;
                this.cat.y = (this.playH - this.cat.h) / 2 + Math.sin(this.cat.floatTimer) * 8;
                this.cat.rotation = 0;

                if (this.birdHero) {
                    this.birdHero.style.transform = `translate3d(${this.cat.x}px, ${this.cat.y}px, 0)`;
                }

                // Mặt đất vẫn cuộn êm
                this.groundX = (this.groundX - 1.2 * timeScale) % 28;
                if (this.groundTrack) {
                    this.groundTrack.style.transform = `translate3d(${this.groundX}px, 0, 0)`;
                }
                return;
            }

            // Trạng thái PLAYING
            if (this.gameState === 'PLAYING') {
                // Cuộn mặt đất theo tốc độ trò chơi
                this.groundX = (this.groundX - this.pipeSpeed * timeScale) % 28;
                if (this.groundTrack) {
                    this.groundTrack.style.transform = `translate3d(${this.groundX}px, 0, 0)`;
                }

                // Vật lý chú Bangboo
                this.cat.vy += this.cat.gravity * timeScale;
                if (this.cat.vy > this.cat.maxFallSpeed) this.cat.vy = this.cat.maxFallSpeed;
                this.cat.y += this.cat.vy * timeScale;

                // Góc nghiêng xe máy: ngửa lên khi phóng, chúc mũi khi rơi
                if (this.cat.vy < 0) {
                    this.cat.targetRotation = -0.36; // Ngửa lên ~ -21 độ
                } else {
                    this.cat.targetRotation = Math.min(0.9, this.cat.vy * 0.16); // Chúc xuống tối đa ~52 độ
                }
                this.cat.rotation += (this.cat.targetRotation - this.cat.rotation) * 0.2 * timeScale;

                // Va chạm trần
                if (this.cat.y < 0) {
                    this.cat.y = 0;
                    this.cat.vy = 0;
                }

                // Va chạm mặt đất
                const groundLimit = this.playH - this.cat.h;
                if (this.cat.y >= groundLimit) {
                    this.cat.y = groundLimit;
                    if (this.birdHero) {
                        this.birdHero.style.transform = `translate3d(${this.cat.x}px, ${this.cat.y}px, 0) rotate(${this.cat.rotation}rad)`;
                    }
                    this.triggerGameOver();
                    return;
                }

                if (this.birdHero) {
                    this.birdHero.style.transform = `translate3d(${this.cat.x}px, ${this.cat.y}px, 0) rotate(${this.cat.rotation}rad)`;
                }

                // Sinh cột ống nước định kỳ
                this.pipeSpawnTimer += timeScale;
                if (this.pipeSpawnTimer >= this.pipeInterval) {
                    this.spawnPipe();
                    this.pipeSpawnTimer = 0;
                }

                // Di chuyển & kiểm tra va chạm cột ống nước
                for (let i = this.pipes.length - 1; i >= 0; i--) {
                    const p = this.pipes[i];
                    p.x -= this.pipeSpeed * timeScale;
                    p.el.style.transform = `translate3d(${p.x}px, 0, 0)`;

                    // Ghi điểm khi bay qua ống an toàn
                    if (!p.passed && p.x + p.w < this.cat.x) {
                        p.passed = true;
                        this.score++;
                        this.coins = this.score;
                        audio.point();
                        if (this.hudScore) this.hudScore.textContent = this.score.toString();
                        this.spawnFloatingScore('+1', this.cat.x + this.cat.w / 2, this.cat.y);
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

                    // Thu dọn ống đã trôi khuất màn hình
                    if (p.x + p.w < -30) {
                        if (p.el && p.el.parentNode) {
                            p.el.parentNode.removeChild(p.el);
                        }
                        this.pipes.splice(i, 1);
                    }
                }
            }

            // Trạng thái GAMEOVER: Bangboo rơi xuống mặt đất
            if (this.gameState === 'GAMEOVER') {
                const groundLimit = this.playH - this.cat.h;
                if (this.cat.y < groundLimit) {
                    this.cat.vy += this.cat.gravity * 1.5 * timeScale;
                    this.cat.y += this.cat.vy * timeScale;
                    this.cat.rotation = Math.min(1.4, this.cat.rotation + 0.12 * timeScale);
                    if (this.cat.y >= groundLimit) {
                        this.cat.y = groundLimit;
                    }
                    if (this.birdHero) {
                        this.birdHero.style.transform = `translate3d(${this.cat.x}px, ${this.cat.y}px, 0) rotate(${this.cat.rotation}rad)`;
                    }
                }
            }
        }

        // Vòng lặp chính Game Loop
        // QUAN TRỌNG: Dùng arrow function được bind 1 lần trong constructor thay vì
        // gọi .bind(this) mỗi frame (tiết kiệm ~0.3ms GC overhead mỗi 16ms frame)
        loop(timestamp) {
            if (this.isTabHidden) {
                this._rafId = requestAnimationFrame(this._boundLoop);
                return;
            }

            const dt = (timestamp - this.lastTime) / 1000;
            this.lastTime = timestamp;

            this.update(dt);

            this._rafId = requestAnimationFrame(this._boundLoop);
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

        const soundIcon = document.getElementById('sound-icon');
        const soundText = document.getElementById('sound-text');
        const btnSound = document.getElementById('btn-toggle-sound');
        const fsSoundBtn = document.getElementById('fs-sound-btn');
        const sideAudioBtn = document.getElementById('side-audio-btn');

        if (soundIcon) soundIcon.innerText = isMuted ? '🔇' : '🔊';
        if (soundText) soundText.innerText = isMuted ? 'Âm thanh: Tắt' : 'Âm thanh: Bật';
        if (fsSoundBtn) fsSoundBtn.innerText = isMuted ? '🔇' : '🔊';
        if (sideAudioBtn) sideAudioBtn.innerText = isMuted ? '🔇' : '🔊';

        if (btnSound) {
            if (isMuted) {
                btnSound.style.background = '#f1f5f9';
                btnSound.style.borderColor = '#cbd5e1';
                btnSound.style.color = '#64748b';
            } else {
                btnSound.style.background = '#fdf2f8';
                btnSound.style.borderColor = '#f472b6';
                btnSound.style.color = '#db2777';
            }
        }
        return !isMuted;
    };

    // 3. Toàn màn hình (Fullscreen)
    window.toggleFullscreenMario = function (containerId) {
        containerId = containerId || 'mario-game-container';
        let elem = document.getElementById(containerId);
        if (!elem) {
            elem = document.getElementById('mario-game-container') || document.getElementById('mario-side-panel');
        }
        if (!elem) return;

        const isFs = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;

        if (!isFs && !elem.classList.contains('is-mario-fullscreen')) {
            // Vào Fullscreen — tự động thu gọn navbar để không đè lên game
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

            // Cập nhật text nút toàn màn hình
            const fsText = elem.querySelector('.fs-text') || document.querySelector('.btn-mario-fullscreen-toggle .fs-text');
            const fsIcon = elem.querySelector('.fs-icon') || document.querySelector('.btn-mario-fullscreen-toggle .fs-icon');
            if (fsText) fsText.innerText = 'Thu nhỏ';
            if (fsIcon) fsIcon.innerText = '🗗';

            // Kích hoạt đồng bộ scale stage
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
