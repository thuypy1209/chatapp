/**
 * ChatFlex - Hiệu ứng Mưa Tiền Xu & Tiền Giấy (Coin & Banknote Rain Effect)
 * - Đồng xu vàng 3D xoay lấp lánh (Gold Coins)
 * - Tiền giấy bay lượn chao đảo sống động (Paper Banknotes)
 * - Tương tác click chuột tung tiền bùng nổ (Interactive Cash Burst)
 * - Hiệu ứng âm thanh nhặt xu Mario cổ điển (Web Audio API Synthesizer)
 */

(function () {
    'use strict';

    // --- Web Audio Synthesizer cho tiếng nhặt xu Mario ---
    class CoinAudioSynthesizer {
        constructor() {
            this.ctx = null;
            this.enabled = true;
            this.lastPlayTime = 0;
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

        playCoin() {
            if (!this.enabled) return;
            // Giới hạn tần suất âm thanh (tối thiểu cách nhau 110ms) để chống méo tiếng
            const nowMs = performance.now();
            if (nowMs - this.lastPlayTime < 110) return;
            this.lastPlayTime = nowMs;

            try {
                this.init();
                if (!this.ctx) return;
                const now = this.ctx.currentTime;

                // Nốt 1: B5 (987.77 Hz)
                const osc1 = this.ctx.createOscillator();
                const gain1 = this.ctx.createGain();
                osc1.type = 'sine';
                osc1.frequency.setValueAtTime(987.77, now);

                gain1.gain.setValueAtTime(0.12, now);
                gain1.gain.setValueAtTime(0.12, now + 0.08);
                gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

                osc1.connect(gain1);
                gain1.connect(this.ctx.destination);
                osc1.start(now);
                osc1.stop(now + 0.09);

                // Nốt 2: E6 (1318.51 Hz) - Kéo dài ngân vang
                const osc2 = this.ctx.createOscillator();
                const gain2 = this.ctx.createGain();
                osc2.type = 'sine';
                osc2.frequency.setValueAtTime(1318.51, now + 0.08);

                gain2.gain.setValueAtTime(0.15, now + 0.08);
                gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.42);

                osc2.connect(gain2);
                gain2.connect(this.ctx.destination);
                osc2.start(now + 0.08);
                osc2.stop(now + 0.42);
            } catch (e) {
                // Trình duyệt chưa unlock audio
            }
        }
    }

    const coinAudio = new CoinAudioSynthesizer();
    window.coinAudio = coinAudio;

    // --- Lớp biểu diễn Hạt Đồng Xu (Coin) ---
    class CoinParticle {
        constructor(w, h, burst = false, originX = null, originY = null) {
            this.reset(w, h, burst, originX, originY);
        }

        reset(w, h, burst = false, originX = null, originY = null) {
            this.type = 'coin';
            this.radius = 12 + Math.random() * 10; // Bán kính 12-22px
            this.angle = Math.random() * Math.PI * 2; // Góc xoay 3D
            this.rotSpeed = 0.04 + Math.random() * 0.06; // Tốc độ lật
            this.sway = Math.random() * Math.PI * 2;
            this.swaySpeed = 0.02 + Math.random() * 0.03;
            this.swayAmp = 0.6 + Math.random() * 1.2;

            if (burst && originX !== null) {
                this.x = originX + (Math.random() - 0.5) * 40;
                this.y = originY + (Math.random() - 0.5) * 30;
                const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
                const speed = 7 + Math.random() * 10;
                this.vx = Math.cos(angle) * speed;
                this.vy = Math.sin(angle) * speed;
                this.gravity = 0.32;
                this.isBurst = true;
            } else {
                this.x = Math.random() * w;
                this.y = -40 - Math.random() * (h * 0.5);
                this.vx = (Math.random() - 0.5) * 0.8;
                this.vy = 1.8 + Math.random() * 2.4; // Tốc độ rơi
                this.gravity = 0;
                this.isBurst = false;
            }

            // Màu vàng óng
            this.colorMain = '#f59e0b';
            this.colorLight = '#fbbf24';
            this.colorDark = '#b45309';
            this.colorEdge = '#78350f';
        }

        update(w, h) {
            if (this.isBurst) {
                this.vy += this.gravity;
                this.x += this.vx;
                this.y += this.vy;
                this.angle += this.rotSpeed * 1.6;
                if (this.y > h + 50) return false;
            } else {
                this.sway += this.swaySpeed;
                this.x += Math.sin(this.sway) * this.swayAmp + this.vx;
                this.y += this.vy;
                this.angle += this.rotSpeed;

                // Ra khỏi màn hình thì reset lên đỉnh
                if (this.y > h + 40) {
                    this.reset(w, h, false);
                }
                if (this.x < -40) this.x = w + 20;
                if (this.x > w + 40) this.x = -20;
            }
            return true;
        }

        draw(ctx) {
            ctx.save();
            ctx.translate(this.x, this.y);

            const scaleX = Math.cos(this.angle); // Hiệu ứng xoay 3D theo trục Y
            const absScaleX = Math.abs(scaleX);

            ctx.scale(scaleX, 1);

            // Viền ngoài đồng xu
            ctx.beginPath();
            ctx.ellipse(0, 0, this.radius, this.radius, 0, 0, Math.PI * 2);
            ctx.fillStyle = this.colorDark;
            ctx.fill();

            // Mặt chính của đồng xu với Gradient óng ánh
            const grad = ctx.createLinearGradient(-this.radius, -this.radius, this.radius, this.radius);
            grad.addColorStop(0, '#fef08a');
            grad.addColorStop(0.3, this.colorLight);
            grad.addColorStop(0.7, this.colorMain);
            grad.addColorStop(1, this.colorDark);

            ctx.beginPath();
            ctx.ellipse(0, 0, this.radius * 0.88, this.radius * 0.88, 0, 0, Math.PI * 2);
            ctx.fillStyle = grad;
            ctx.fill();
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = '#d97706';
            ctx.stroke();

            // Ký hiệu nổi ở giữa đồng xu (khi nhìn rõ mặt trước/sau)
            if (absScaleX > 0.35) {
                ctx.save();
                ctx.fillStyle = '#78350f';
                ctx.font = `bold ${Math.round(this.radius * 0.95)}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('★', 0, 1);
                ctx.fillStyle = '#fef08a';
                ctx.fillText('★', 0, 0);
                ctx.restore();
            }

            // Tia sáng lấp lánh (Specular Gleam) khi xoay chính diện
            if (absScaleX > 0.82) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
                ctx.beginPath();
                ctx.ellipse(-this.radius * 0.3, -this.radius * 0.3, this.radius * 0.35, this.radius * 0.15, -Math.PI / 4, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
        }
    }

    // --- Lớp biểu diễn Tiền Giấy (Paper Banknote) ---
    class BillParticle {
        constructor(w, h, burst = false, originX = null, originY = null) {
            this.reset(w, h, burst, originX, originY);
        }

        reset(w, h, burst = false, originX = null, originY = null) {
            this.type = 'bill';
            this.width = 44 + Math.random() * 20; // Chiều dài 44-64px
            this.height = this.width * 0.54; // Chiều rộng tỷ lệ chuẩn tờ tiền
            this.sway = Math.random() * Math.PI * 2;
            this.swaySpeed = 0.025 + Math.random() * 0.025;
            this.swayAmp = 1.4 + Math.random() * 1.8;

            this.tilt = (Math.random() - 0.5) * 0.6; // Góc nghiêng Z
            this.tiltSpeed = (Math.random() - 0.5) * 0.03;

            this.flipAngle = Math.random() * Math.PI * 2; // Góc lật 3D
            this.flipSpeed = 0.035 + Math.random() * 0.045;

            // Màu sắc tờ tiền (xanh lá mint / pastel emerald)
            const themes = [
                { bg1: '#a7f3d0', bg2: '#059669', border: '#047857', text: '#064e3b', val: '100' },
                { bg1: '#bbf7d0', bg2: '#16a34a', border: '#15803d', text: '#14532d', val: '500' },
                { bg1: '#bae6fd', bg2: '#0284c7', border: '#0369a1', text: '#0c4a6e', val: '$' },
                { bg1: '#fbcfe8', bg2: '#db2777', border: '#be185d', text: '#831843', val: '★' }
            ];
            this.theme = themes[Math.floor(Math.random() * themes.length)];

            if (burst && originX !== null) {
                this.x = originX + (Math.random() - 0.5) * 40;
                this.y = originY + (Math.random() - 0.5) * 30;
                const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.8;
                const speed = 6 + Math.random() * 9;
                this.vx = Math.cos(angle) * speed;
                this.vy = Math.sin(angle) * speed;
                this.gravity = 0.28;
                this.isBurst = true;
            } else {
                this.x = Math.random() * w;
                this.y = -60 - Math.random() * (h * 0.5);
                this.vx = (Math.random() - 0.5) * 0.5;
                this.vy = 1.3 + Math.random() * 1.6; // Rơi nhẹ hơn tiền xu
                this.gravity = 0;
                this.isBurst = false;
            }
        }

        update(w, h) {
            if (this.isBurst) {
                this.vy += this.gravity;
                this.x += this.vx;
                this.y += this.vy;
                this.flipAngle += this.flipSpeed * 1.4;
                this.tilt += this.tiltSpeed * 1.2;
                if (this.y > h + 60) return false;
            } else {
                this.sway += this.swaySpeed;
                // Dao động hình sin giống lá rơi / tiền chao liệng
                this.x += Math.sin(this.sway) * this.swayAmp + this.vx;
                this.y += this.vy;
                this.tilt = Math.sin(this.sway) * 0.35 + this.vx * 0.2;
                this.flipAngle += this.flipSpeed;

                if (this.y > h + 50) {
                    this.reset(w, h, false);
                }
                if (this.x < -60) this.x = w + 30;
                if (this.x > w + 60) this.x = -30;
            }
            return true;
        }

        draw(ctx) {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.tilt);

            // Hiệu ứng lật 3D dọc theo chiều giấy
            const scaleY = Math.cos(this.flipAngle);
            const absScaleY = Math.abs(scaleY);
            ctx.scale(1, scaleY);

            const w = this.width;
            const h = this.height;

            // Thân tờ tiền (Gradient pastel)
            const bgGrad = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
            bgGrad.addColorStop(0, this.theme.bg1);
            bgGrad.addColorStop(1, '#ffffff');

            ctx.fillStyle = bgGrad;
            ctx.fillRect(-w / 2, -h / 2, w, h);

            // Viền hoa văn ngoài
            ctx.strokeStyle = this.theme.border;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(-w / 2, -h / 2, w, h);

            // Viền trong nét đứt/chấm trang trí
            ctx.strokeStyle = this.theme.bg2;
            ctx.lineWidth = 0.8;
            ctx.strokeRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6);

            // Nếu tờ tiền đang mở rộng mắt nhìn được
            if (absScaleY > 0.3) {
                // Vòng tròn / Quốc huy ở trung tâm
                ctx.beginPath();
                ctx.arc(0, 0, h * 0.32, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
                ctx.fill();
                ctx.strokeStyle = this.theme.border;
                ctx.lineWidth = 1;
                ctx.stroke();

                // Chữ số giữa
                ctx.fillStyle = this.theme.text;
                ctx.font = `bold ${Math.round(h * 0.42)}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(this.theme.val, 0, 0);

                // Số nhỏ ở 2 góc
                ctx.font = `bold ${Math.round(h * 0.24)}px sans-serif`;
                ctx.fillText(this.theme.val, -w / 2 + 8, -h / 2 + 7);
                ctx.fillText(this.theme.val, w / 2 - 8, h / 2 - 6);
            }

            ctx.restore();
        }
    }

    // --- Quản lý Canvas Toàn màn hình & Vòng lặp Animation ---
    class MoneyRainEngine {
        constructor() {
            this.canvas = null;
            this.ctx = null;
            this.width = window.innerWidth;
            this.height = window.innerHeight;
            this.particles = [];
            this.burstParticles = [];
            this.isRunning = true;
            this.density = 24; // Số lượng hạt rơi tự nhiên tối ưu mượt mà (12 xu, 12 tiền giấy)
            this.maxBurstParticles = 50; // Giới hạn trần cứng số hạt bùng nổ trên màn hình để chống giật lag
            this.animId = null;

            this.init();
        }

        init() {
            // Tạo Canvas toàn màn hình
            this.canvas = document.createElement('canvas');
            this.canvas.id = 'money-rain-canvas';
            this.canvas.style.position = 'fixed';
            this.canvas.style.inset = '0';
            this.canvas.style.width = '100vw';
            this.canvas.style.height = '100vh';
            this.canvas.style.pointerEvents = 'none'; // Không cản trở click nút bấm hay chơi game
            this.canvas.style.zIndex = '99'; // Nằm dưới navbar & popup modal
            document.body.appendChild(this.canvas);

            this.ctx = this.canvas.getContext('2d');
            this.handleResize();

            window.addEventListener('resize', () => this.handleResize());

            // Tạo các hạt ban đầu
            this.createAmbientParticles();

            // Bắt đầu vòng lặp render
            this.loop = this.loop.bind(this);
            this.animId = requestAnimationFrame(this.loop);

            // Bắt sự kiện click vào trang web để tạo hiệu ứng bùng nổ tiền (nếu click vào nền)
            let lastBgBurstTime = 0;
            document.addEventListener('pointerdown', (e) => {
                // Tuyệt đối không kích hoạt nổ tiền khi click vào khung game, thanh điều khiển, nút bấm, input...
                if (this.isElementInsideGame(e.target) || this.isPointInsideGame(e.clientX, e.clientY, 15)) {
                    return;
                }
                const now = Date.now();
                if (now - lastBgBurstTime < 500) return; // Giới hạn tần suất click nền tối thiểu 500ms
                lastBgBurstTime = now;
                this.burstAt(e.clientX, e.clientY, 10);
            });
        }

        // Kiểm tra xem phần tử HTML có thuộc vùng cấm nổ tiền hay không
        isElementInsideGame(el) {
            if (!el) return false;
            const tag = el.tagName ? el.tagName.toLowerCase() : '';
            if (['input', 'textarea', 'select', 'button', 'a', 'canvas', 'video', 'audio'].includes(tag)) {
                return true;
            }
            if (el.closest('button, a, input, textarea, form, canvas, .game-card, .game-column, #mario-game-container, #mario-canvas, #mario-side-panel, #mario-side-canvas, .controls-card, .mario-touch-hud, .mario-header-bar, .mario-header-tools, .mario-grid-container, .mario-play-chat-wrapper, .mario-chat-card, #chatflex-music-widget, .game-card-modal-overlay, .game-card-wrapper, .mario-fs-header, .mario-side-panel-wrapper')) {
                return true;
            }
            return false;
        }

        // Kiểm tra xem tọa độ (x, y) có nằm trong bất kỳ khung trò chơi nào hay không
        isPointInsideGame(x, y, padding = 12) {
            const selectors = [
                '#mario-game-container',
                '#mario-canvas',
                '.game-card',
                '.controls-card',
                '.mario-header-bar',
                '#mario-side-panel',
                '#mario-side-canvas',
                '.mario-touch-hud',
                '.mario-chat-card',
                '.game-card-modal-overlay',
                '#chatflex-music-widget'
            ];
            for (let i = 0; i < selectors.length; i++) {
                const el = document.querySelector(selectors[i]);
                if (el && el.offsetWidth > 0 && el.offsetHeight > 0) {
                    const r = el.getBoundingClientRect();
                    if (x >= r.left - padding && x <= r.right + padding &&
                        y >= r.top - padding && y <= r.bottom + padding) {
                        return true;
                    }
                }
            }
            return false;
        }

        handleResize() {
            const dpr = window.devicePixelRatio || 1;
            this.width = window.innerWidth;
            this.height = window.innerHeight;
            this.canvas.width = this.width * dpr;
            this.canvas.height = this.height * dpr;
            this.ctx.resetTransform ? this.ctx.resetTransform() : this.ctx.setTransform(1, 0, 0, 1, 0, 0);
            this.ctx.scale(dpr, dpr);
        }

        createAmbientParticles() {
            this.particles = [];
            const half = Math.floor(this.density / 2);
            for (let i = 0; i < half; i++) {
                const c = new CoinParticle(this.width, this.height);
                c.y = Math.random() * this.height; // Phân bố đều khắp chiều cao khi khởi tạo
                this.particles.push(c);
            }
            for (let i = 0; i < half; i++) {
                const b = new BillParticle(this.width, this.height);
                b.y = Math.random() * this.height;
                this.particles.push(b);
            }
        }

        burstAt(x, y, count = 20) {
            // Không kích hoạt nổ tiền nếu tọa độ nằm trong khung trò chơi
            if (this.isPointInsideGame(x, y, 15)) return;

            // Giới hạn số lượng hạt bùng nổ tối đa trên màn hình để chống giật lag
            const availableSlots = this.maxBurstParticles - this.burstParticles.length;
            if (availableSlots <= 0) return;
            const spawnCount = Math.min(count, availableSlots);

            coinAudio.playCoin();
            for (let i = 0; i < spawnCount; i++) {
                if (Math.random() > 0.45) {
                    this.burstParticles.push(new CoinParticle(this.width, this.height, true, x, y));
                } else {
                    this.burstParticles.push(new BillParticle(this.width, this.height, true, x, y));
                }
            }
        }

        setDensity(num) {
            this.density = num;
            this.createAmbientParticles();
        }

        toggle(enable = null) {
            this.isRunning = (enable !== null) ? enable : !this.isRunning;
            if (this.canvas) {
                this.canvas.style.display = this.isRunning ? 'block' : 'none';
            }
            return this.isRunning;
        }

        loop() {
            if (this.isRunning) {
                this.ctx.clearRect(0, 0, this.width, this.height);

                // Lấy tọa độ các khung trò chơi và widget để hoàn toàn không vẽ tiền đè lên game
                const excludedRects = [];
                const candidateSelectors = [
                    '#mario-game-container',
                    '#mario-canvas',
                    '.game-card',
                    '.controls-card',
                    '#mario-side-panel',
                    '#mario-side-canvas',
                    '.mario-touch-hud',
                    '.game-card-modal-overlay'
                ];

                for (let s = 0; s < candidateSelectors.length; s++) {
                    const el = document.querySelector(candidateSelectors[s]);
                    if (el && el.offsetWidth > 0 && el.offsetHeight > 0) {
                        const r = el.getBoundingClientRect();
                        // Thêm padding 14px để mép của tờ tiền hoặc đồng xu không bị lẹm vào khung game
                        excludedRects.push({
                            left: r.left - 14,
                            right: r.right + 14,
                            top: r.top - 14,
                            bottom: r.bottom + 14
                        });
                    }
                }

                const isInsideGameArea = (x, y) => {
                    for (let j = 0; j < excludedRects.length; j++) {
                        const r = excludedRects[j];
                        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
                            return true;
                        }
                    }
                    return false;
                };

                // Cập nhật và vẽ hạt mưa tiền ambient
                for (let i = 0; i < this.particles.length; i++) {
                    const p = this.particles[i];
                    p.update(this.width, this.height);
                    if (!isInsideGameArea(p.x, p.y)) {
                        p.draw(this.ctx);
                    }
                }

                // Cập nhật và vẽ các hạt tiền nổ (burst)
                for (let i = this.burstParticles.length - 1; i >= 0; i--) {
                    const bp = this.burstParticles[i];
                    const alive = bp.update(this.width, this.height);
                    if (!alive) {
                        this.burstParticles.splice(i, 1);
                    } else {
                        if (!isInsideGameArea(bp.x, bp.y)) {
                            bp.draw(this.ctx);
                        }
                    }
                }
            }
            this.animId = requestAnimationFrame(this.loop);
        }
    }

    // Khởi tạo khi DOM sẵn sàng
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.moneyRainInstance = new MoneyRainEngine();
        });
    } else {
        window.moneyRainInstance = new MoneyRainEngine();
    }

})();
