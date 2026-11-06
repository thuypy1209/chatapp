/**
 * Flappy Bird (Flappy Cat) HTML5 Canvas Engine
 * Pure Vanilla JavaScript & Canvas 2D with Web Audio 8-bit Sound FX
 * Replaces classic Mario with Flappy Bird starring the Cool Motorcycle Cat!
 */
(function() {
    'use strict';

    // --- Web Audio 8-bit Sound Generator ---
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
            } catch(e) {}
        }

        flap() {
            this.init();
            // Tiếng vỗ cánh / nẹt pô bay lên
            this.tone(280, 'sine', 0.12, 0.18, 0.01, 560);
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
            playNote(1318.51, now + 0.07, 0.28); // E6
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
            this.tone(360, 'sine', 0.15, 0.1, 0.01, 180);
        }
    }

    const audio = new RetroAudio();

    // --- Flappy Bird (Flappy Cat) Game Engine ---
    class FlappyGame {
        constructor(canvasId) {
            this.canvas = document.getElementById(canvasId);
            if (!this.canvas) return;
            this.ctx = this.canvas.getContext('2d');

            this.width = 800;
            this.height = 450;
            this.canvas.width = this.width;
            this.canvas.height = this.height;

            // Skin / Theme tương thích
            this.skin = 'classic';

            // Trạng thái game
            this.score = 0;
            this.coins = 0;
            this.bestScore = 0;
            try {
                this.bestScore = parseInt(localStorage.getItem('chatflex_flappy_best') || '0', 10);
            } catch(e) {}

            this.gameState = 'READY'; // READY, PLAYING, GAMEOVER
            this.gameFocus = false;
            this.keys = {};

            // Môi trường
            this.groundH = 68;
            this.groundX = 0;
            this.cityX = 0;
            this.treesX = 0;

            // Mây bay parallax
            this.clouds = [
                { x: 60, y: 50, scale: 1.1, speed: 0.4 },
                { x: 260, y: 90, scale: 0.85, speed: 0.35 },
                { x: 480, y: 40, scale: 1.2, speed: 0.45 },
                { x: 690, y: 75, scale: 0.9, speed: 0.38 }
            ];

            // Rung màn hình khi va chạm
            this.shakeTimer = 0;
            this.shakeIntensity = 0;

            // Hiệu ứng hạt
            this.particles = [];
            this.floatingTexts = [];

            // Tải ảnh chú mèo phi công lái xe mô tô
            this.catImg = new Image();
            this.catImg.src = '/images/flappy-cat.png';
            this.catImgLoaded = false;
            this.catImg.onload = () => {
                this.catImgLoaded = true;
            };
            this.catImg.onerror = () => {
                // Thử load ảnh dự phòng
                this.catImg.src = '/images/cat-avatar.png';
            };

            // Khởi tạo thực thể & màn chơi
            this.initGame();
            this.bindEvents();

            // Vòng lặp game
            this.lastTime = performance.now();
            requestAnimationFrame(this.loop.bind(this));
        }

        initGame() {
            // Chú Mèo Mô Tô (Flappy Cat)
            this.cat = {
                x: 130,
                y: (this.height - this.groundH) / 2 - 20,
                w: 48,
                h: 48,
                vy: 0,
                gravity: 0.28,
                jumpForce: -5.8,
                rotation: 0,
                targetRotation: 0,
                dead: false,
                floatTimer: 0
            };

            // Ống nước (Pipes)
            this.pipes = [];
            this.pipeSpawnTimer = 0;
            this.pipeGap = 138;       // Khoảng cách khe hở giữa 2 ống
            this.pipeWidth = 64;     // Bề rộng thân ống
            this.pipeSpeed = 2.4;    // Tốc độ ống trôi về bên trái
            this.pipeInterval = 120; // Số frame giữa mỗi lần sinh ống (~220px)

            // Điểm số
            this.score = 0;
            this.coins = 0;
            this.gameState = 'READY';
        }

        setSkin(skin) {
            this.skin = skin || 'classic';
        }

        toggleSkin() {
            return this.skin;
        }

        toggleAudio() {
            audio.muted = !audio.muted;
            return !audio.muted;
        }

        restart() {
            this.initGame();
            this.gameState = 'READY';
            this.canvas.style.cursor = 'default';
        }

        // Hành động vỗ cánh / nẹt pô bay lên
        flap() {
            audio.init();

            if (this.gameState === 'READY') {
                this.gameState = 'PLAYING';
                this.cat.vy = this.cat.jumpForce;
                this.cat.targetRotation = -0.38; // Ngẩng đầu lên
                audio.flap();
                this.spawnSmokeParticles();
                return;
            }

            if (this.gameState === 'PLAYING' && !this.cat.dead) {
                this.cat.vy = this.cat.jumpForce;
                this.cat.targetRotation = -0.42; // Ngẩng lên ~-24 độ
                audio.flap();
                this.spawnSmokeParticles();
            }
        }

        spawnSmokeParticles() {
            // Sinh vệt khói pô xe máy xả ra phía sau đuôi
            const tailX = this.cat.x + 6;
            const tailY = this.cat.y + this.cat.h - 10;
            for (let i = 0; i < 3; i++) {
                this.particles.push({
                    x: tailX + (Math.random() * 4 - 2),
                    y: tailY + (Math.random() * 4 - 2),
                    vx: -(1.5 + Math.random() * 1.5),
                    vy: (Math.random() - 0.5) * 1.2,
                    radius: 3 + Math.random() * 4,
                    color: 'rgba(255, 255, 255, 0.75)',
                    alpha: 0.8,
                    decay: 0.035 + Math.random() * 0.02
                });
            }
        }

        spawnPointSparkles(x, y) {
            for (let i = 0; i < 8; i++) {
                const angle = (Math.PI * 2 / 8) * i;
                const speed = 2 + Math.random() * 2.5;
                this.particles.push({
                    x: x,
                    y: y,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    radius: 2.5 + Math.random() * 2.5,
                    color: '#facc15',
                    alpha: 1,
                    decay: 0.04
                });
            }
            this.floatingTexts.push({
                x: x,
                y: y - 10,
                text: '+1',
                color: '#f59e0b',
                alpha: 1,
                vy: -1.2
            });
        }

        spawnPipe() {
            const minH = 50;
            const maxH = this.height - this.groundH - this.pipeGap - 50;
            const topH = Math.floor(minH + Math.random() * (maxH - minH));

            this.pipes.push({
                x: this.width + 10,
                topH: topH,
                w: this.pipeWidth,
                passed: false
            });
        }

        triggerGameOver() {
            if (this.gameState === 'GAMEOVER') return;
            this.gameState = 'GAMEOVER';
            this.cat.dead = true;

            // Rung màn hình
            this.shakeTimer = 14;
            this.shakeIntensity = 6;

            audio.hit();
            setTimeout(() => {
                audio.die();
            }, 120);

            // Cập nhật kỷ lục
            if (this.score > this.bestScore) {
                this.bestScore = this.score;
                try {
                    localStorage.setItem('chatflex_flappy_best', this.bestScore.toString());
                } catch(e) {}
            }

            // Đồng bộ sang coins để modal thiệp dùng
            this.coins = this.score;

            // Đổi thiệp ngẫu nhiên mới cho lần chơi này nếu cần
            if (typeof window.pickRandomGameCard === 'function') {
                window.pickRandomGameCard();
            }
        }

        bindEvents() {
            // Click chuột trên Canvas
            this.canvas.addEventListener('click', (e) => {
                this.canvas.focus();
                this.gameFocus = true;
                audio.init();

                if (this.gameState === 'READY') {
                    this.flap();
                } else if (this.gameState === 'PLAYING') {
                    this.flap();
                } else if (this.gameState === 'GAMEOVER') {
                    // Xác định vị trí bấm chuột xem bên trong hay bên ngoài tấm thiệp
                    const rect = this.canvas.getBoundingClientRect();
                    const scaleX = this.width / rect.width;
                    const scaleY = this.height / rect.height;
                    const mouseX = (e.clientX - rect.left) * scaleX;
                    const mouseY = (e.clientY - rect.top) * scaleY;

                    const cardW = Math.min(540, this.width - 40);
                    const cardH = Math.min(270, this.height - 30);
                    const cardX = (this.width - cardW) / 2;
                    const cardY = (this.height - cardH) / 2;

                    const isInsideCard = (
                        mouseX >= cardX && mouseX <= cardX + cardW &&
                        mouseY >= cardY && mouseY <= cardY + cardH
                    );

                    if (isInsideCard) {
                        // Bấm vào thiệp: Mở thiệp to!
                        if (typeof window.showGameOverCard === 'function') {
                            window.showGameOverCard(this.score, this.coins, () => {
                                this.restart();
                            });
                        }
                    } else {
                        // Bấm vào bên ngoài thiệp: Bắt đầu chơi lại!
                        this.restart();
                    }
                }
            });

            // Hover chuột khi Game Over để đổi con trỏ
            this.canvas.addEventListener('mousemove', (e) => {
                if (this.gameState === 'GAMEOVER') {
                    const rect = this.canvas.getBoundingClientRect();
                    const scaleX = this.width / rect.width;
                    const scaleY = this.height / rect.height;
                    const mouseX = (e.clientX - rect.left) * scaleX;
                    const mouseY = (e.clientY - rect.top) * scaleY;

                    const cardW = Math.min(540, this.width - 40);
                    const cardH = Math.min(270, this.height - 30);
                    const cardX = (this.width - cardW) / 2;
                    const cardY = (this.height - cardH) / 2;

                    const isInsideCard = (
                        mouseX >= cardX && mouseX <= cardX + cardW &&
                        mouseY >= cardY && mouseY <= cardY + cardH
                    );

                    this.canvas.style.cursor = isInsideCard ? 'pointer' : 'default';
                } else {
                    this.canvas.style.cursor = 'pointer';
                }
            });

            this.canvas.addEventListener('mouseenter', () => {
                this.gameFocus = true;
            });

            this.canvas.addEventListener('mouseleave', () => {
                this.gameFocus = false;
            });

            // Chạm cảm ứng trên điện thoại
            this.canvas.addEventListener('touchstart', (e) => {
                audio.init();
                if (this.gameState !== 'GAMEOVER') {
                    e.preventDefault();
                    this.flap();
                }
            }, { passive: false });

            // Bàn phím máy tính
            window.addEventListener('keydown', (e) => {
                if (!this.gameFocus && document.activeElement !== this.canvas) return;

                if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
                    e.preventDefault();
                    this.flap();
                } else if (e.code === 'KeyR') {
                    this.restart();
                }
            });
        }

        // --- Cập nhật Logic Game ---
        update(dt) {
            // Rung màn hình
            if (this.shakeTimer > 0) {
                this.shakeTimer--;
            }

            // Hiệu ứng hạt
            for (let i = this.particles.length - 1; i >= 0; i--) {
                const p = this.particles[i];
                p.x += p.vx;
                p.y += p.vy;
                p.alpha -= p.decay;
                if (p.alpha <= 0) {
                    this.particles.splice(i, 1);
                }
            }

            // Chữ bay nổi
            for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
                const ft = this.floatingTexts[i];
                ft.y += ft.vy;
                ft.alpha -= 0.02;
                if (ft.alpha <= 0) {
                    this.floatingTexts.splice(i, 1);
                }
            }

            // Mây trôi liên tục ở mọi trạng thái
            this.clouds.forEach(c => {
                c.x -= c.speed;
                if (c.x < -120) {
                    c.x = this.width + 60;
                }
            });

            // Trạng thái READY: Chú mèo bồng bềnh êm ái
            if (this.gameState === 'READY') {
                this.cat.floatTimer += 0.06;
                this.cat.y = (this.height - this.groundH) / 2 - 20 + Math.sin(this.cat.floatTimer) * 8;
                this.cat.rotation = 0;

                // Nền đất vẫn cuộn nhẹ
                this.groundX = (this.groundX - 1.2) % 24;
                this.cityX = (this.cityX - 0.4) % 800;
                this.treesX = (this.treesX - 0.7) % 800;
                return;
            }

            // Trạng thái PLAYING
            if (this.gameState === 'PLAYING') {
                // Cuộn nền
                this.groundX = (this.groundX - this.pipeSpeed) % 24;
                this.cityX = (this.cityX - this.pipeSpeed * 0.3) % 800;
                this.treesX = (this.treesX - this.pipeSpeed * 0.55) % 800;

                // Vật lý chú mèo
                this.cat.vy += this.cat.gravity;
                if (this.cat.vy > 9.5) this.cat.vy = 9.5;
                this.cat.y += this.cat.vy;

                // Góc nghiêng xe máy: ngửa lên khi bay, chúc xuống khi rơi
                if (this.cat.vy < 0) {
                    this.cat.targetRotation = -0.38; // ~ -22 độ
                } else {
                    this.cat.targetRotation = Math.min(1.25, this.cat.vy * 0.12); // Chúc xuống tới ~70 độ
                }
                this.cat.rotation += (this.cat.targetRotation - this.cat.rotation) * 0.18;

                // Kiểm tra va chạm trần nhà
                if (this.cat.y < 0) {
                    this.cat.y = 0;
                    this.cat.vy = 0;
                }

                // Kiểm tra va chạm mặt đất
                const groundLimit = this.height - this.groundH - this.cat.h;
                if (this.cat.y >= groundLimit) {
                    this.cat.y = groundLimit;
                    this.triggerGameOver();
                    return;
                }

                // Sinh ống nước
                this.pipeSpawnTimer++;
                if (this.pipeSpawnTimer >= this.pipeInterval) {
                    this.spawnPipe();
                    this.pipeSpawnTimer = 0;
                }

                // Di chuyển & kiểm tra va chạm ống nước
                for (let i = this.pipes.length - 1; i >= 0; i--) {
                    const p = this.pipes[i];
                    p.x -= this.pipeSpeed;

                    // Tính điểm khi bay qua ống thành công
                    if (!p.passed && p.x + p.w < this.cat.x) {
                        p.passed = true;
                        this.score++;
                        this.coins = this.score;
                        audio.point();
                        this.spawnPointSparkles(this.cat.x + this.cat.w / 2, this.cat.y);
                    }

                    // Hitbox kiểm tra va chạm bo tròn an toàn (thu nhỏ 6px để chơi công bằng hơn)
                    const inset = 6;
                    const catBox = {
                        l: this.cat.x + inset,
                        r: this.cat.x + this.cat.w - inset,
                        t: this.cat.y + inset,
                        b: this.cat.y + this.cat.h - inset
                    };

                    // Ống trên
                    const topPipeBox = {
                        l: p.x,
                        r: p.x + p.w,
                        t: 0,
                        b: p.topH
                    };

                    // Ống dưới
                    const bottomPipeY = p.topH + this.pipeGap;
                    const bottomPipeBox = {
                        l: p.x,
                        r: p.x + p.w,
                        t: bottomPipeY,
                        b: this.height - this.groundH
                    };

                    const hitTop = (catBox.r > topPipeBox.l && catBox.l < topPipeBox.r && catBox.t < topPipeBox.b);
                    const hitBottom = (catBox.r > bottomPipeBox.l && catBox.l < bottomPipeBox.r && catBox.b > bottomPipeBox.t);

                    if (hitTop || hitBottom) {
                        this.triggerGameOver();
                        return;
                    }

                    // Xóa ống đã trôi khuất màn hình
                    if (p.x + p.w < -20) {
                        this.pipes.splice(i, 1);
                    }
                }
            }

            // Trạng thái GAMEOVER: Mèo rơi xuống đất nếu đang ở trên không
            if (this.gameState === 'GAMEOVER') {
                const groundLimit = this.height - this.groundH - this.cat.h;
                if (this.cat.y < groundLimit) {
                    this.cat.vy += this.cat.gravity * 1.5;
                    this.cat.y += this.cat.vy;
                    this.cat.rotation = Math.min(1.4, this.cat.rotation + 0.1);
                    if (this.cat.y >= groundLimit) {
                        this.cat.y = groundLimit;
                    }
                }
            }
        }

        // --- Render Đồ Họa ---
        draw() {
            const ctx = this.ctx;

            // Xử lý rung màn hình
            ctx.save();
            if (this.shakeTimer > 0) {
                const dx = (Math.random() - 0.5) * this.shakeIntensity;
                const dy = (Math.random() - 0.5) * this.shakeIntensity;
                ctx.translate(dx, dy);
            }

            // 1. Bầu trời xanh Flappy Bird
            const skyGrad = ctx.createLinearGradient(0, 0, 0, this.height - this.groundH);
            skyGrad.addColorStop(0, '#4ec0ca');
            skyGrad.addColorStop(0.7, '#70c5ce');
            skyGrad.addColorStop(1, '#b0e5eb');
            ctx.fillStyle = skyGrad;
            ctx.fillRect(0, 0, this.width, this.height);

            // 2. Mây trắng bồng bềnh
            this.drawClouds(ctx);

            // 3. Dãy thành phố (Skyline) phía xa
            this.drawCitySkyline(ctx);

            // 4. Hàng cây xanh chân thành phố
            this.drawTrees(ctx);

            // 5. Ống nước xanh retro
            this.drawPipes(ctx);

            // 6. Mặt đất cỏ và sọc caro retro
            this.drawGround(ctx);

            // 7. Hiệu ứng khói pô và tia sao
            this.drawParticles(ctx);

            // 8. Chú Mèo Mô Tô (Flappy Cat)
            this.drawCat(ctx);

            // 9. Điểm số HUD trên màn hình
            if (this.gameState === 'PLAYING') {
                this.drawScoreHUD(ctx);
            } else if (this.gameState === 'READY') {
                this.drawReadyScreen(ctx);
            } else if (this.gameState === 'GAMEOVER') {
                this.drawGameOverCard(ctx);
            }

            ctx.restore();
        }

        drawClouds(ctx) {
            ctx.save();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
            this.clouds.forEach(c => {
                const cx = c.x;
                const cy = c.y;
                const s = c.scale;

                ctx.beginPath();
                ctx.arc(cx, cy, 22 * s, 0, Math.PI * 2);
                ctx.arc(cx + 24 * s, cy - 8 * s, 28 * s, 0, Math.PI * 2);
                ctx.arc(cx + 54 * s, cy - 2 * s, 22 * s, 0, Math.PI * 2);
                ctx.arc(cx + 74 * s, cy + 6 * s, 16 * s, 0, Math.PI * 2);
                ctx.fill();
            });
            ctx.restore();
        }

        drawCitySkyline(ctx) {
            ctx.save();
            const baseY = this.height - this.groundH;
            ctx.fillStyle = '#83ccd3'; // Tông lam xám của thành phố Flappy Bird

            // Vẽ dãy nhà cao tầng lặp vô tận
            const buildingWidth = 36;
            const heights = [70, 110, 85, 130, 95, 140, 75, 120, 100, 150, 90, 65];
            const totalCycle = heights.length * buildingWidth;
            const startX = this.cityX;

            for (let offset = -totalCycle; offset < this.width + totalCycle; offset += totalCycle) {
                heights.forEach((h, idx) => {
                    const bx = startX + offset + idx * buildingWidth;
                    if (bx + buildingWidth >= 0 && bx <= this.width) {
                        ctx.fillRect(bx, baseY - h, buildingWidth - 2, h);
                        // Cửa sổ các tòa nhà
                        ctx.fillStyle = '#9ee0e6';
                        for (let wy = baseY - h + 10; wy < baseY - 10; wy += 14) {
                            ctx.fillRect(bx + 6, wy, 6, 8);
                            ctx.fillRect(bx + buildingWidth - 14, wy, 6, 8);
                        }
                        ctx.fillStyle = '#83ccd3';
                    }
                });
            }
            ctx.restore();
        }

        drawTrees(ctx) {
            ctx.save();
            const baseY = this.height - this.groundH;
            ctx.fillStyle = '#4ea452'; // Xanh lá cây

            const treeWidth = 42;
            const totalW = 800;
            const startX = this.treesX;

            for (let offset = -totalW; offset < this.width + totalW; offset += totalW) {
                for (let i = 0; i < 20; i++) {
                    const tx = startX + offset + i * treeWidth;
                    if (tx + treeWidth >= 0 && tx <= this.width) {
                        ctx.beginPath();
                        ctx.arc(tx + treeWidth / 2, baseY - 12, 18, Math.PI, 0, false);
                        ctx.fill();
                    }
                }
            }
            ctx.restore();
        }

        drawPipes(ctx) {
            const baseY = this.height - this.groundH;

            this.pipes.forEach(p => {
                const px = p.x;
                const pw = p.w;
                const topH = p.topH;
                const botY = topH + this.pipeGap;
                const botH = baseY - botY;

                // --- 1. ỐNG TRÊN (CHÚC TỪ TRẦN XUỐNG) ---
                this.drawSinglePipe(px, 0, pw, topH, true);

                // --- 2. ỐNG DƯỚI (NHÔ TỪ MẶT ĐẤT LÊN) ---
                this.drawSinglePipe(px, botY, pw, botH, false);
            });
        }

        drawSinglePipe(x, y, w, h, isTop) {
            const ctx = this.ctx;
            const capH = 26;
            const capOverhang = 3; // Nắp ống rộng hơn thân 3px mỗi bên

            ctx.save();

            // Thân ống
            const bodyY = isTop ? y : y + capH;
            const bodyH = Math.max(0, h - capH);

            // Gradient thân ống xanh Flappy Bird
            const bodyGrad = ctx.createLinearGradient(x, 0, x + w, 0);
            bodyGrad.addColorStop(0, '#558022');   // Bóng tối cạnh trái
            bodyGrad.addColorStop(0.18, '#73bf2e'); // Xanh chính
            bodyGrad.addColorStop(0.35, '#9ce659'); // Vệt sáng highlight
            bodyGrad.addColorStop(0.65, '#73bf2e'); // Xanh chính
            bodyGrad.addColorStop(0.9, '#558022');  // Bóng tối
            bodyGrad.addColorStop(1, '#2b3d17');    // Viền đậm

            ctx.fillStyle = bodyGrad;
            ctx.fillRect(x, bodyY, w, bodyH);

            // Viền ngoài thân ống
            ctx.strokeStyle = '#2b3d17';
            ctx.lineWidth = 2.5;
            ctx.strokeRect(x, bodyY, w, bodyH);

            // Vành / Nắp ống (Cap)
            const capX = x - capOverhang;
            const capW = w + capOverhang * 2;
            const capY = isTop ? y + h - capH : y;

            const capGrad = ctx.createLinearGradient(capX, 0, capX + capW, 0);
            capGrad.addColorStop(0, '#558022');
            capGrad.addColorStop(0.18, '#73bf2e');
            capGrad.addColorStop(0.35, '#9ce659');
            capGrad.addColorStop(0.65, '#73bf2e');
            capGrad.addColorStop(0.9, '#558022');
            capGrad.addColorStop(1, '#2b3d17');

            ctx.fillStyle = capGrad;
            ctx.fillRect(capX, capY, capW, capH);

            // Viền nắp ống
            ctx.strokeStyle = '#2b3d17';
            ctx.lineWidth = 2.5;
            ctx.strokeRect(capX, capY, capW, capH);

            ctx.restore();
        }

        drawGround(ctx) {
            ctx.save();
            const gy = this.height - this.groundH;
            const gh = this.groundH;

            // Dải cỏ xanh trên mặt đất
            ctx.fillStyle = '#73bf2e';
            ctx.fillRect(0, gy, this.width, 14);

            // Viền cỏ sáng vàng-xanh
            ctx.fillStyle = '#9ce659';
            ctx.fillRect(0, gy, this.width, 3);

            // Đường phân cách cỏ và đất
            ctx.fillStyle = '#2b3d17';
            ctx.fillRect(0, gy + 14, this.width, 2.5);

            // Lớp đất cát màu kem vàng
            ctx.fillStyle = '#ded895';
            ctx.fillRect(0, gy + 16, this.width, gh - 16);

            // Họa tiết kẻ caro chéo cuộn trôi liên tục theo tốc độ game
            ctx.strokeStyle = '#cbb86e';
            ctx.lineWidth = 2.5;
            const stripeW = 20;
            const startX = this.groundX;

            ctx.beginPath();
            for (let x = startX - stripeW; x < this.width + stripeW; x += stripeW) {
                ctx.moveTo(x, gy + 16);
                ctx.lineTo(x + 12, gy + gh);
            }
            ctx.stroke();

            // Đường viền nóc đất
            ctx.fillStyle = '#2b3d17';
            ctx.fillRect(0, gy, this.width, 2.5);

            ctx.restore();
        }

        drawParticles(ctx) {
            ctx.save();
            this.particles.forEach(p => {
                ctx.globalAlpha = Math.max(0, p.alpha);
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fill();
            });

            this.floatingTexts.forEach(ft => {
                ctx.globalAlpha = Math.max(0, ft.alpha);
                ctx.fillStyle = ft.color;
                ctx.font = 'bold 18px "Quicksand", sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(ft.text, ft.x, ft.y);
            });
            ctx.restore();
        }

        drawCat(ctx) {
            ctx.save();
            const cat = this.cat;

            // Tịnh tiến và xoay theo góc nghiêng
            ctx.translate(cat.x + cat.w / 2, cat.y + cat.h / 2);
            ctx.rotate(cat.rotation);

            // Vẽ hình ảnh chú mèo mô tô
            if (this.catImgLoaded && this.catImg.naturalWidth > 0) {
                // Bo tròn chú mèo thành huy hiệu phi công siêu ngầu
                ctx.save();
                ctx.beginPath();
                ctx.arc(0, 0, cat.w / 2 - 1, 0, Math.PI * 2);
                ctx.closePath();
                ctx.clip();

                ctx.drawImage(this.catImg, -cat.w / 2, -cat.h / 2, cat.w, cat.h);
                ctx.restore();

                // Viền phát sáng bảo vệ tròn
                ctx.beginPath();
                ctx.arc(0, 0, cat.w / 2 - 1, 0, Math.PI * 2);
                ctx.strokeStyle = '#38bdf8';
                ctx.lineWidth = 2.5;
                ctx.stroke();
            } else {
                // Fallback nếu ảnh chưa tải xong: Vẽ chú mèo retro
                ctx.fillStyle = '#475569';
                this.roundRect(ctx, -cat.w / 2, -cat.h / 2, cat.w, cat.h, 12, true, false);

                // Tai mèo
                ctx.beginPath();
                ctx.moveTo(-cat.w / 2 + 6, -cat.h / 2);
                ctx.lineTo(-cat.w / 2 + 14, -cat.h / 2 - 8);
                ctx.lineTo(-cat.w / 2 + 20, -cat.h / 2);
                ctx.fill();

                // Kính bảo hộ
                ctx.fillStyle = '#38bdf8';
                ctx.fillRect(-cat.w / 2 + 8, -cat.h / 2 + 8, 28, 12);

                ctx.font = '20px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('🐱', 0, 4);
            }

            ctx.restore();
        }

        drawScoreHUD(ctx) {
            ctx.save();

            // Điểm số to bản chính giữa
            ctx.font = '900 48px "Quicksand", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';

            // Viền đen dày
            ctx.strokeStyle = '#1e293b';
            ctx.lineWidth = 7;
            ctx.strokeText(this.score.toString(), this.width / 2, 28);

            // Chữ trắng nổi bật
            ctx.fillStyle = '#ffffff';
            ctx.fillText(this.score.toString(), this.width / 2, 28);

            // Kỷ lục cao nhất (Góc trên phải)
            ctx.font = 'bold 13px "Quicksand", sans-serif';
            ctx.textAlign = 'right';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
            ctx.fillText('🏆 Kỷ lục: ' + Math.max(this.score, this.bestScore), this.width - 20, 24);

            ctx.restore();
        }

        drawReadyScreen(ctx) {
            ctx.save();

            // Dòng chữ GET READY!
            ctx.font = '900 38px "Quicksand", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            ctx.strokeStyle = '#1e293b';
            ctx.lineWidth = 6;
            ctx.strokeText('GET READY! 🚀', this.width / 2, 130);
            ctx.fillStyle = '#facc15';
            ctx.fillText('GET READY! 🚀', this.width / 2, 130);

            // Hướng dẫn tương tác nhấp nháy
            const alpha = 0.6 + Math.sin(Date.now() * 0.006) * 0.4;
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.font = 'bold 15px "Quicksand", sans-serif';
            ctx.fillText('Chạm màn hình hoặc nhấn [Space] để Mèo nẹt pô bay lên!', this.width / 2, 290);

            // Huy hiệu kỷ lục
            if (this.bestScore > 0) {
                ctx.fillStyle = '#ffffff';
                this.roundRect(ctx, this.width / 2 - 90, 320, 180, 28, 14, true, false);
                ctx.fillStyle = '#db2777';
                ctx.font = 'bold 13px "Quicksand", sans-serif';
                ctx.fillText('🏆 Kỷ lục điểm: ' + this.bestScore, this.width / 2, 335);
            }

            ctx.restore();
        }

        drawGameOverCard(ctx) {
            ctx.save();
            // Nền tối mờ phía sau
            ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
            ctx.fillRect(0, 0, this.width, this.height);

            const cardW = Math.min(540, this.width - 40);
            const cardH = Math.min(270, this.height - 30);
            const cardX = (this.width - cardW) / 2;
            const cardY = (this.height - cardH) / 2;

            // Thân thiệp màu kem ấm
            const grad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
            grad.addColorStop(0, '#fffdfa');
            grad.addColorStop(1, '#fff1f2');
            ctx.fillStyle = grad;
            this.roundRect(ctx, cardX, cardY, cardW, cardH, 20, true, false);

            // Viền thiệp nét đứt hồng pastel
            ctx.strokeStyle = '#fbcfe8';
            ctx.lineWidth = 3;
            this.roundRect(ctx, cardX, cardY, cardW, cardH, 20, false, true);

            // Nắp thiệp / Dải ribbon
            const ribbonH = 44;
            const rGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY);
            rGrad.addColorStop(0, '#f43f5e');
            rGrad.addColorStop(1, '#db2777');
            ctx.fillStyle = rGrad;
            this.roundRectTop(ctx, cardX, cardY, cardW, ribbonH, 20);

            // Tiêu đề trên ribbon
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 16px "Quicksand", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('💌 TẤM THIỆP ĐỘNG VIÊN 💌', cardX + cardW / 2, cardY + ribbonH / 2);

            // Nội dung Text Thiệp
            const cardText = (typeof window.getCurrentGameCardText === 'function') 
                ? window.getCurrentGameCardText() 
                : 'Đừng buồn vì một lần Game Over nha! Bạn đã chơi rất xuất sắc rồi! 🌸✨💖';
            
            ctx.fillStyle = '#334155';
            ctx.font = 'italic 600 13px "Quicksand", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            this.drawWrappedText(ctx, '"' + cardText + '"', cardX + cardW / 2, cardY + ribbonH + 16, cardW - 50, 20);

            // Huy hiệu điểm số Flappy Bird
            const badgeY = cardY + cardH - 64;
            ctx.fillStyle = '#ffffff';
            this.roundRect(ctx, cardX + (cardW - 260) / 2, badgeY, 260, 26, 13, true, false);
            ctx.strokeStyle = '#fbcfe8';
            ctx.lineWidth = 1.5;
            this.roundRect(ctx, cardX + (cardW - 260) / 2, badgeY, 260, 26, 13, false, true);

            ctx.fillStyle = '#db2777';
            ctx.font = 'bold 12px "Quicksand", sans-serif';
            ctx.textBaseline = 'middle';
            ctx.fillText('⭐ Điểm: ' + this.score + '  |  🏆 Kỷ lục: ' + Math.max(this.score, this.bestScore), cardX + cardW / 2, badgeY + 13);

            // Hướng dẫn click
            ctx.fillStyle = '#94a3b8';
            ctx.font = '600 11px "Quicksand", sans-serif';
            ctx.fillText('Bấm vào thiệp để mở to 💌  •  Bấm bên ngoài (hoặc phím R) để chơi lại 🔄', cardX + cardW / 2, cardY + cardH - 18);

            ctx.restore();
        }

        drawWrappedText(ctx, text, x, y, maxWidth, lineHeight) {
            const words = text.split(' ');
            let line = '';
            let curY = y;
            const maxLines = 3;
            let lineCount = 0;

            for (let n = 0; n < words.length; n++) {
                const testLine = line + words[n] + ' ';
                const metrics = ctx.measureText(testLine);
                const testWidth = metrics.width;
                if (testWidth > maxWidth && n > 0) {
                    lineCount++;
                    if (lineCount >= maxLines) {
                        ctx.fillText(line.trim() + '...', x, curY);
                        return;
                    }
                    ctx.fillText(line, x, curY);
                    line = words[n] + ' ';
                    curY += lineHeight;
                } else {
                    line = testLine;
                }
            }
            ctx.fillText(line, x, curY);
        }

        roundRect(ctx, x, y, w, h, r, fill = true, stroke = false) {
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.lineTo(x + w - r, y);
            ctx.quadraticCurveTo(x + w, y, x + w, y + r);
            ctx.lineTo(x + w, y + h - r);
            ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
            ctx.lineTo(x + r, y + h);
            ctx.quadraticCurveTo(x, y + h, x, y + h - r);
            ctx.lineTo(x, y + r);
            ctx.quadraticCurveTo(x, y, x + r, y);
            ctx.closePath();
            if (fill) ctx.fill();
            if (stroke) ctx.stroke();
        }

        roundRectTop(ctx, x, y, w, h, r) {
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.lineTo(x + w - r, y);
            ctx.quadraticCurveTo(x + w, y, x + w, y + r);
            ctx.lineTo(x + w, y + h);
            ctx.lineTo(x, y + h);
            ctx.lineTo(x, y + r);
            ctx.quadraticCurveTo(x, y, x + r, y);
            ctx.closePath();
            ctx.fill();
        }

        // --- Game Loop ---
        loop(timestamp) {
            const dt = (timestamp - this.lastTime) / 1000;
            this.lastTime = timestamp;

            this.update(dt);
            this.draw();

            requestAnimationFrame(this.loop.bind(this));
        }
    }

    // Export toàn cục (tương thích cả FlappyBirdGame & MarioGame)
    window.FlappyGame = FlappyGame;
    window.FlappyBirdGame = FlappyGame;
    window.MarioGame = FlappyGame;
    window.RetroAudio = RetroAudio;
})();
