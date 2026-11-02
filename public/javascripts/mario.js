/**
 * Super Mario Bros HTML5 Canvas Engine
 * Pure Vanilla JavaScript & Canvas 2D with Web Audio 8-bit Sound FX
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

        jump() {
            this.init();
            this.tone(160, 'square', 0.22, 0.12, 0.01, 580);
        }

        coin() {
            this.init();
            if (this.muted || !this.ctx) return;
            const now = this.ctx.currentTime;
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
            playNote(987.77, now, 0.08); // B5
            playNote(1318.51, now + 0.08, 0.35); // E6
        }

        stomp() {
            this.init();
            this.tone(200, 'triangle', 0.15, 0.2, 0.01, 60);
        }

        bump() {
            this.init();
            this.tone(140, 'triangle', 0.12, 0.2, 0.02, 80);
        }

        powerup() {
            this.init();
            const notes = [330, 392, 659, 523, 587, 784];
            notes.forEach((f, i) => {
                setTimeout(() => this.tone(f, 'square', 0.1, 0.1, 0.01), i * 70);
            });
        }

        win() {
            this.init();
            const fanfare = [
                { f: 523.25, d: 0.12, pause: 0 },
                { f: 659.25, d: 0.12, pause: 140 },
                { f: 783.99, d: 0.12, pause: 280 },
                { f: 1046.50, d: 0.35, pause: 420 },
                { f: 783.99, d: 0.15, pause: 780 },
                { f: 1046.50, d: 0.5, pause: 950 }
            ];
            fanfare.forEach(n => {
                setTimeout(() => this.tone(n.f, 'square', n.d, 0.2, 0.01), n.pause);
            });
        }

        die() {
            this.init();
            const notes = [500, 470, 440, 400, 350, 300, 250, 180];
            notes.forEach((f, i) => {
                setTimeout(() => this.tone(f, 'sawtooth', 0.12, 0.15, 0.01), i * 90);
            });
        }
    }

    const audio = new RetroAudio();

    // --- Game Engine ---
    class MarioGame {
        constructor(canvasId) {
            this.canvas = document.getElementById(canvasId);
            if (!this.canvas) return;
            this.ctx = this.canvas.getContext('2d');

            this.width = 800;
            this.height = 450;
            this.canvas.width = this.width;
            this.canvas.height = this.height;

            // Skin selection: 'minecraft' or 'classic'
            var savedSkin = 'minecraft';
            try {
                savedSkin = localStorage.getItem('chatflex_mario_skin') || 'minecraft';
            } catch(e) {}
            this.skin = savedSkin;

            this.score = 0;
            this.coins = 0;
            this.lives = 3;
            this.time = 400;
            this.timeCounter = 0;
            this.gameState = 'READY'; // READY, PLAYING, WIN, GAMEOVER, PAUSED

            this.cameraX = 0;
            this.keys = {};
            this.gameFocus = false;

            this.initLevel();
            this.bindEvents();
            this.lastTime = performance.now();
            requestAnimationFrame(this.loop.bind(this));
        }

        setSkin(skin) {
            this.skin = (skin === 'minecraft') ? 'minecraft' : 'classic';
            try {
                localStorage.setItem('chatflex_mario_skin', this.skin);
            } catch(e) {}
            if (window.onMarioSkinChanged && typeof window.onMarioSkinChanged === 'function') {
                window.onMarioSkinChanged(this.skin);
            }
        }

        toggleSkin() {
            var next = this.skin === 'minecraft' ? 'classic' : 'minecraft';
            this.setSkin(next);
            return next;
        }

        initLevel() {
            this.cameraX = 0;
            this.time = 400;

            // Mario Player (120 FPS High Refresh Physics)
            this.mario = {
                x: 80,
                y: 300,
                w: 28,
                h: 38,
                vx: 0,
                vy: 0,
                speed: 1.6,
                jumpForce: -6.2,
                gravity: 0.145,
                onGround: false,
                facing: 'right',
                state: 'idle', // idle, run, jump, dead
                invincible: 0,
                animTimer: 0,
                runFrame: 0,
                deadAnimY: 0,
                deadVy: -6
            };

            // Map layout
            this.groundY = 380;
            this.levelWidth = 3200;

            // Platforms / Blocks
            // Type: 'ground', 'brick', 'question', 'pipe'
            this.blocks = [];
            this.coinsInAir = [];
            this.particles = [];
            this.floatingTexts = [];

            // Ground with gaps
            const groundSegments = [
                { start: 0, end: 950 },
                { start: 1070, end: 1850 },
                { start: 1980, end: 3200 }
            ];
            groundSegments.forEach(seg => {
                this.blocks.push({
                    type: 'ground',
                    x: seg.start,
                    y: this.groundY,
                    w: seg.end - seg.start,
                    h: 70
                });
            });

            // Warp Pipes
            const pipes = [
                { x: 340, h: 50 },
                { x: 620, h: 70 },
                { x: 820, h: 90 },
                { x: 1300, h: 60 },
                { x: 1650, h: 80 },
                { x: 2250, h: 60 }
            ];
            pipes.forEach(p => {
                this.blocks.push({
                    type: 'pipe',
                    x: p.x,
                    y: this.groundY - p.h,
                    w: 52,
                    h: p.h
                });
            });

            // Question & Brick blocks
            const blockDefs = [
                // Section 1
                { type: 'question', x: 200, y: 270, content: 'coin' },
                { type: 'brick', x: 250, y: 270 },
                { type: 'question', x: 290, y: 270, content: 'coin' },
                { type: 'brick', x: 330, y: 270 },
                { type: 'question', x: 370, y: 270, content: 'coin' },
                { type: 'question', x: 290, y: 170, content: 'coin' },

                // Section 2 - Stair/Pyramid bricks
                { type: 'brick', x: 500, y: 290 },
                { type: 'brick', x: 540, y: 290 },
                { type: 'question', x: 540, y: 190, content: 'coin' },
                { type: 'brick', x: 580, y: 290 },

                // Section 3 - Over first pit
                { type: 'brick', x: 990, y: 250 },
                { type: 'question', x: 1030, y: 250, content: 'coin' },

                // Section 4
                { type: 'question', x: 1150, y: 270, content: 'coin' },
                { type: 'brick', x: 1200, y: 270 },
                { type: 'brick', x: 1240, y: 270 },
                { type: 'question', x: 1280, y: 270, content: 'coin' },

                { type: 'brick', x: 1420, y: 250 },
                { type: 'brick', x: 1460, y: 250 },
                { type: 'brick', x: 1500, y: 250 },
                { type: 'question', x: 1540, y: 250, content: 'coin' },

                // Floating bricks & coins
                { type: 'brick', x: 1800, y: 220 },
                { type: 'brick', x: 1840, y: 220 },
                { type: 'question', x: 1880, y: 220, content: 'coin' },

                // Over 2nd pit
                { type: 'brick', x: 1910, y: 260 },
                { type: 'brick', x: 1950, y: 260 },

                // Final stretch
                { type: 'brick', x: 2400, y: 340 },
                { type: 'brick', x: 2440, y: 340 },
                { type: 'brick', x: 2440, y: 300 },
                { type: 'brick', x: 2480, y: 340 },
                { type: 'brick', x: 2480, y: 300 },
                { type: 'brick', x: 2480, y: 260 },
                { type: 'question', x: 2560, y: 250, content: 'coin' }
            ];

            blockDefs.forEach(b => {
                this.blocks.push({
                    type: b.type,
                    x: b.x,
                    y: b.y,
                    w: 36,
                    h: 36,
                    origY: b.y,
                    bumpY: 0,
                    bumpVy: 0,
                    content: b.content || null,
                    used: false
                });
            });

            // Extra floating coins
            const coinPositions = [
                { x: 200, y: 220 }, { x: 250, y: 220 }, { x: 370, y: 220 },
                { x: 720, y: 320 }, { x: 760, y: 320 },
                { x: 1420, y: 200 }, { x: 1460, y: 200 }, { x: 1500, y: 200 },
                { x: 2330, y: 320 }, { x: 2370, y: 320 }
            ];
            coinPositions.forEach(c => {
                this.coinsInAir.push({ x: c.x, y: c.y, w: 18, h: 22, collected: false });
            });

            // Enemies: Goombas / Creepers (120 FPS calibrated)
            this.enemies = [
                { x: 420, y: 340, w: 30, h: 30, vx: -0.425, alive: true, squashed: false, squashTimer: 0 },
                { x: 530, y: 340, w: 30, h: 30, vx: 0.425, alive: true, squashed: false, squashTimer: 0 },
                { x: 740, y: 340, w: 30, h: 30, vx: -0.425, alive: true, squashed: false, squashTimer: 0 },
                { x: 1220, y: 340, w: 30, h: 30, vx: -0.45, alive: true, squashed: false, squashTimer: 0 },
                { x: 1390, y: 340, w: 30, h: 30, vx: 0.45, alive: true, squashed: false, squashTimer: 0 },
                { x: 1550, y: 340, w: 30, h: 30, vx: -0.45, alive: true, squashed: false, squashTimer: 0 },
                { x: 2150, y: 340, w: 30, h: 30, vx: -0.48, alive: true, squashed: false, squashTimer: 0 },
                { x: 2300, y: 340, w: 30, h: 30, vx: 0.48, alive: true, squashed: false, squashTimer: 0 }
            ];

            // Flagpole & Castle at end
            this.flagpole = {
                x: 2850,
                y: this.groundY - 260,
                w: 12,
                h: 260,
                flagY: this.groundY - 250,
                reached: false
            };
            this.castle = {
                x: 2950,
                y: this.groundY - 140,
                w: 160,
                h: 140
            };
        }

        bindEvents() {
            // Focus canvas when clicked
            this.canvas.addEventListener('click', (e) => {
                this.canvas.focus();
                this.gameFocus = true;
                audio.init();
                if (this.gameState === 'READY') {
                    this.gameState = 'PLAYING';
                    if (this.skin === 'minecraft') {
                        this.notifyChat('start', '🟩 Trò chơi Minecraft Edition đã bắt đầu! Steve cầm Kiếm Kim Cương 🗡️ sẵn sàng phiêu lưu!');
                    } else {
                        this.notifyChat('start', '🍄 Trò chơi Mario đã bắt đầu! Dùng phím A/D hoặc Mũi tên để di chuyển, Phím Cách hoặc W để nhảy!');
                    }
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
                    this.canvas.style.cursor = 'default';
                }
            });

            this.canvas.addEventListener('mouseenter', () => {
                this.gameFocus = true;
            });

            window.addEventListener('keydown', (e) => {
                const targetTag = e.target.tagName.toLowerCase();
                if (targetTag === 'input' || targetTag === 'textarea') {
                    return; // Don't intercept when user is typing in chat!
                }

                if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
                    if (this.gameFocus || document.activeElement === this.canvas || document.fullscreenElement || document.webkitFullscreenElement) {
                        e.preventDefault();
                    }
                }

                this.keys[e.key] = true;
                this.keys[e.code] = true;

                if (this.gameState === 'READY' && [' ', 'ArrowUp', 'KeyW', 'ArrowRight', 'KeyD'].includes(e.code || e.key)) {
                    this.gameState = 'PLAYING';
                    audio.init();
                    if (this.skin === 'minecraft') {
                        this.notifyChat('start', '⛏️ Steve Minecraft bắt đầu cuộc phiêu lưu! Hãy thu thập Kim Cương 💎 và cẩn thận với Creeper nhé!');
                    } else {
                        this.notifyChat('start', '🍄 Bắt đầu cuộc phiêu lưu của Mario! Hãy thu thập xu và giải cứu công chúa nào! ⭐');
                    }
                }

                if ((this.gameState === 'GAMEOVER' || this.gameState === 'WIN') && (e.key === 'r' || e.key === 'R' || e.key === 'Enter')) {
                    this.restart();
                }
            });

            window.addEventListener('keyup', (e) => {
                this.keys[e.key] = false;
                this.keys[e.code] = false;
            });
        }

        notifyChat(type, msg) {
            // Không bao giờ gửi tin nhắn game vào phòng chat nhân vật (/chat) để tránh mất chỗ trò chuyện của người dùng
            if (this.canvasId === 'mario-side-canvas') {
                return;
            }
            if (typeof window !== 'undefined' && window.location && window.location.pathname.indexOf('/chat') !== -1) {
                return;
            }
            if (window.marioChatBridge && typeof window.marioChatBridge === 'function') {
                window.marioChatBridge(type, msg);
            }
        }

        restart() {
            this.score = 0;
            this.coins = 0;
            this.lives = 3;
            this.gameState = 'PLAYING';
            window.__needNewCard = true;
            this.initLevel();
            var hero = this.skin === 'minecraft' ? 'Steve Minecraft' : 'Mario';
            this.notifyChat('restart', 'Đã khởi động lại màn chơi ' + hero + '! Cố lên bạn ơi!');
        }

        respawnMario() {
            this.lives--;
            var hero = this.skin === 'minecraft' ? 'Steve' : 'Mario';
            if (this.lives <= 0) {
                this.gameState = 'GAMEOVER';
                audio.die();

                // 1. Tự động bốc ngẫu nhiên một bức thiệp mới cho lần thua này
                const cardText = (typeof window.pickRandomGameCard === 'function')
                    ? window.pickRandomGameCard()
                    : ((typeof window.getCurrentGameCardText === 'function') 
                        ? window.getCurrentGameCardText() 
                        : 'Đừng buồn vì một lần Game Over nha! Bạn đã chơi rất xuất sắc rồi! 🌸✨💖');

                // 2. Tự động mở Tấm Thiệp Động Viên khi chơi thua
                if (typeof window.showGameOverCard === 'function') {
                    setTimeout(() => {
                        window.showGameOverCard(this.score, this.coins, () => {
                            this.restart();
                        });
                    }, 450);
                }

                // 3. Tự động gửi thông điệp bức thiệp ngẫu nhiên vào khung chat
                this.notifyChat('gameover', `
                    <div style="background: linear-gradient(135deg, #fffdfa 0%, #fff1f2 100%); border: 1.5px dashed #fbcfe8; border-radius: 12px; padding: 10px 12px; margin-top: 4px;">
                        <div style="font-weight: 800; color: #db2777; display: flex; align-items: center; gap: 5px; margin-bottom: 4px;">
                            <span>💌</span> Bức thiệp gửi bạn:
                        </div>
                        <div style="font-style: italic; color: #334155; line-height: 1.5; margin-bottom: 8px;">
                            "${cardText}"
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #64748b; border-top: 1px solid #fce7f3; padding-top: 6px;">
                            <span>⭐ Điểm: <b>${this.score}</b> | 🪙 Xu: <b>${this.coins}</b></span>
                            <button type="button" onclick="if(window.showGameOverCard) window.showGameOverCard(${this.score}, ${this.coins})" style="background: #ffffff; border: 1px solid #fbcfe8; color: #db2777; border-radius: 8px; padding: 2px 8px; font-weight: 700; cursor: pointer;">
                                💌 Xem thiệp
                            </button>
                        </div>
                    </div>
                `);
            } else {
                this.initLevel();
                this.mario.invincible = 180;
                this.gameState = 'PLAYING';
                this.notifyChat('die', hero + ' bị mất một mạng! Còn lại ' + this.lives + ' ❤️. Cẩn thận nhé!');
            }
        }

        addFloatingText(text, x, y, color = '#facc15') {
            this.floatingTexts.push({
                text: text,
                x: x,
                y: y,
                color: color,
                opacity: 1,
                vy: -0.6,
                life: 90
            });
        }

        triggerBlock(b) {
            if (b.bumpVy !== 0) return;
            b.bumpVy = -2.5;
            audio.bump();

            if (b.type === 'question' && !b.used) {
                b.used = true;
                this.coins++;
                this.score += 200;
                audio.coin();
                var textCol = this.skin === 'minecraft' ? '#38bdf8' : '#facc15';
                this.addFloatingText('+200', b.x + 4, b.y - 10, textCol);
                this.particles.push({
                    type: 'coinSparkle',
                    x: b.x + b.w / 2,
                    y: b.y - 15,
                    vy: -3,
                    life: 50
                });
                if (this.coins % 5 === 0) {
                    if (this.skin === 'minecraft') {
                        this.notifyChat('coin', '💎 Ting ting! Steve vừa khai thác được ' + this.coins + ' viên Kim Cương xanh biếc!');
                    } else {
                        this.notifyChat('coin', '🍄 Ting ting! Bạn vừa thu thập được ' + this.coins + ' đồng xu vàng!');
                    }
                }
            } else if (b.type === 'brick') {
                this.score += 50;
                this.addFloatingText('+50', b.x + 8, b.y - 10, '#ffffff');
            }
        }

        // --- Update Logic ---
        update() {
            if (this.gameState === 'READY' || this.gameState === 'PAUSED') return;

            if (this.gameState === 'WIN') {
                // Mario auto walks to castle
                if (this.mario.x < this.castle.x + 60) {
                    this.mario.x += 1;
                    this.mario.state = 'run';
                    this.mario.animTimer++;
                } else {
                    this.mario.state = 'idle';
                }
                return;
            }

            if (this.gameState === 'GAMEOVER') return;

            // Timer (120 FPS: 120 ticks = 1 second)
            this.timeCounter++;
            if (this.timeCounter >= 120) {
                this.timeCounter = 0;
                this.time--;
                if (this.time <= 0) {
                    this.respawnMario();
                    return;
                }
            }

            const m = this.mario;

            // Invincibility cooldown
            if (m.invincible > 0) m.invincible--;

            // Handle Mario Input
            const left = this.keys['ArrowLeft'] || this.keys['KeyA'] || this.keys['a'];
            const right = this.keys['ArrowRight'] || this.keys['KeyD'] || this.keys['d'];
            const jumpKey = this.keys['ArrowUp'] || this.keys['KeyW'] || this.keys[' '] || this.keys['Space'];
            const runKey = this.keys['ShiftLeft'] || this.keys['ShiftRight'];

            const moveSpeed = runKey ? m.speed * 1.35 : m.speed;

            if (left && !right) {
                m.vx = -moveSpeed;
                m.facing = 'left';
                if (m.onGround) m.state = 'run';
            } else if (right && !left) {
                m.vx = moveSpeed;
                m.facing = 'right';
                if (m.onGround) m.state = 'run';
            } else {
                m.vx *= 0.85;
                if (Math.abs(m.vx) < 0.1) m.vx = 0;
                if (m.onGround) m.state = 'idle';
            }

            // Jump
            if (jumpKey && m.onGround) {
                m.vy = m.jumpForce;
                m.onGround = false;
                m.state = 'jump';
                audio.jump();
            }

            // Gravity (120 FPS scaled)
            m.vy += m.gravity;
            if (m.vy > 6) m.vy = 6;

            // Horizontal Movement & Collisions
            m.x += m.vx;
            if (m.x < 0) m.x = 0;

            this.blocks.forEach(b => {
                if (this.checkCollision(m, b)) {
                    if (m.vx > 0) {
                        m.x = b.x - m.w;
                        m.vx = 0;
                    } else if (m.vx < 0) {
                        m.x = b.x + b.w;
                        m.vx = 0;
                    }
                }
            });

            // Vertical Movement & Collisions
            m.y += m.vy;
            m.onGround = false;

            this.blocks.forEach(b => {
                if (this.checkCollision(m, b)) {
                    if (m.vy > 0) { // Landing on top
                        m.y = b.y - m.h;
                        m.vy = 0;
                        m.onGround = true;
                        if (m.state === 'jump') m.state = 'idle';
                    } else if (m.vy < 0) { // Hitting block from below
                        m.y = b.y + b.h;
                        m.vy = 0;
                        this.triggerBlock(b);
                    }
                }
            });

            // Block bump animation
            this.blocks.forEach(b => {
                if (b.bumpVy !== 0 || b.bumpY !== 0) {
                    b.bumpY += b.bumpVy;
                    b.bumpVy += 0.2;
                    if (b.bumpY >= 0) {
                        b.bumpY = 0;
                        b.bumpVy = 0;
                    }
                }
            });

            // Fall into pit
            if (m.y > this.height + 50) {
                audio.die();
                this.respawnMario();
                return;
            }

            // Check Floating Coins
            this.coinsInAir.forEach(c => {
                if (!c.collected && this.checkCollision(m, c)) {
                    c.collected = true;
                    this.coins++;
                    this.score += 100;
                    audio.coin();
                    this.addFloatingText('+100', c.x, c.y);
                }
            });

            // Update Enemies
            this.enemies.forEach(e => {
                if (!e.alive) {
                    if (e.squashed) {
                        e.squashTimer++;
                    }
                    return;
                }

                // Move enemy
                e.x += e.vx;

                // Collide with pipes & blocks to reverse direction
                this.blocks.forEach(b => {
                    if (b.type === 'pipe' || b.type === 'brick' || b.type === 'question') {
                        if (this.checkCollision(e, b)) {
                            e.vx = -e.vx;
                            if (e.vx > 0) e.x = b.x + b.w;
                            else e.x = b.x - e.w;
                        }
                    }
                });

                // Mario interaction with enemy
                if (m.invincible <= 0 && this.checkCollision(m, e)) {
                    // Mario stomps from above
                    if (m.vy > 0 && m.y + m.h - m.vy <= e.y + 12) {
                        e.alive = false;
                        e.squashed = true;
                        e.squashTimer = 0;
                        m.vy = -4.5; // Mario bounce up (120 FPS calibrated)
                        this.score += 200;
                        audio.stomp();
                        var stompColor = this.skin === 'minecraft' ? '#4ade80' : '#facc15';
                        this.addFloatingText('+200', e.x, e.y - 10, stompColor);
                        if (this.skin === 'minecraft') {
                            this.notifyChat('stomp', '💥 BÙM! Steve đã vung Kiếm Kim Cương hạ gục một Creeper (+200 điểm)!');
                        } else {
                            this.notifyChat('stomp', '👞 Bẹp! Bạn vừa giẫm bẹp một Goomba xuất sắc (+200 điểm)!');
                        }
                    } else {
                        // Hurt Mario / Steve
                        audio.die();
                        this.respawnMario();
                    }
                }
            });

            // Check Flagpole (Victory)
            if (!this.flagpole.reached && this.checkCollision(m, { x: this.flagpole.x, y: this.flagpole.y, w: this.flagpole.w, h: this.flagpole.h })) {
                this.flagpole.reached = true;
                this.gameState = 'WIN';
                this.score += 1000;
                audio.win();
                this.addFloatingText('WIN! +1000', this.flagpole.x - 20, this.flagpole.y + 50, '#22c55e');
                if (this.skin === 'minecraft') {
                    this.notifyChat('win', '🎉🎉 HOAN HÔ! Steve đã kích hoạt Đèn Hiệu Beacon và chinh phục pháo đài Minecraft! Tuyệt vời!');
                } else {
                    this.notifyChat('win', '🎉🎉 HOAN HÔ! Bạn đã đưa Mario chạm đỉnh cờ chiến thắng và hoàn thành màn 1-1! Tuyệt vời!');
                }
            }

            // Camera Tracking (Smooth interpolation at 120 FPS)
            const targetCamX = m.x - this.width * 0.35;
            if (targetCamX > this.cameraX) {
                this.cameraX += (targetCamX - this.cameraX) * 0.052;
            }
            if (this.cameraX < 0) this.cameraX = 0;
            if (this.cameraX > this.levelWidth - this.width) this.cameraX = this.levelWidth - this.width;

            // Running animation frame counter (120 FPS)
            if (m.state === 'run') {
                m.animTimer++;
                if (m.animTimer % 15 === 0) {
                    m.runFrame = (m.runFrame + 1) % 3;
                }
            } else {
                m.runFrame = 0;
            }

            // Update particles & floating texts
            this.particles.forEach((p, idx) => {
                p.y += p.vy;
                p.life--;
                if (p.life <= 0) this.particles.splice(idx, 1);
            });

            this.floatingTexts.forEach((t, idx) => {
                t.y += t.vy;
                t.life--;
                t.opacity = t.life / 90;
                if (t.life <= 0) this.floatingTexts.splice(idx, 1);
            });
        }

        checkCollision(r1, r2) {
            return (
                r1.x < r2.x + r2.w &&
                r1.x + r1.w > r2.x &&
                r1.y < r2.y + r2.h &&
                r1.y + r1.h > r2.y
            );
        }

        // --- Render Graphics ---
        render() {
            const ctx = this.ctx;
            ctx.clearRect(0, 0, this.width, this.height);

            // Sky Background gradient
            const skyGrad = ctx.createLinearGradient(0, 0, 0, this.height);
            skyGrad.addColorStop(0, '#5c94fc');
            skyGrad.addColorStop(1, '#92beff');
            ctx.fillStyle = skyGrad;
            ctx.fillRect(0, 0, this.width, this.height);

            ctx.save();
            ctx.translate(-Math.floor(this.cameraX), 0);

            // Background Hills & Bushes
            this.drawScenery(ctx);

            // Draw Level Blocks & Pipes
            this.blocks.forEach(b => {
                const drawY = b.y + (b.bumpY || 0);
                if (b.type === 'ground') {
                    this.drawGround(ctx, b.x, drawY, b.w, b.h);
                } else if (b.type === 'pipe') {
                    this.drawPipe(ctx, b.x, drawY, b.w, b.h);
                } else if (b.type === 'question') {
                    this.drawQuestionBlock(ctx, b.x, drawY, b.w, b.h, b.used);
                } else if (b.type === 'brick') {
                    this.drawBrickBlock(ctx, b.x, drawY, b.w, b.h);
                }
            });

            // Floating Coins
            this.coinsInAir.forEach(c => {
                if (!c.collected) {
                    this.drawCoin(ctx, c.x, c.y, c.w, c.h);
                }
            });

            // Flagpole & Castle
            this.drawFlagpole(ctx);
            this.drawCastle(ctx);

            // Enemies
            this.enemies.forEach(e => {
                if (e.alive || (e.squashed && e.squashTimer < 60)) {
                    this.drawGoomba(ctx, e);
                }
            });

            // Mario
            if (this.lives > 0 && this.gameState !== 'GAMEOVER') {
                this.drawMario(ctx, this.mario);
            }

            // Particles
            this.particles.forEach(p => {
                if (p.type === 'coinSparkle') {
                    this.drawCoin(ctx, p.x - 9, p.y, 18, 22);
                }
            });

            // Floating Texts
            this.floatingTexts.forEach(t => {
                ctx.save();
                ctx.globalAlpha = Math.max(0, t.opacity);
                ctx.fillStyle = t.color;
                ctx.font = 'bold 15px "Segoe UI", sans-serif';
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 3;
                ctx.strokeText(t.text, t.x, t.y);
                ctx.fillText(t.text, t.x, t.y);
                ctx.restore();
            });

            ctx.restore();

            // HUD Overlay (Fixed on screen)
            this.drawHUD(ctx);

            // Overlay Screens (Ready, Win, Game Over)
            if (this.gameState === 'READY') {
                const title = this.skin === 'minecraft' ? 'MINECRAFT x MARIO' : 'SUPER MARIO BROS';
                const sub = this.skin === 'minecraft' ? 'Nhấn vào đây hoặc bấm phím bất kỳ để BẮT ĐẦU VỚI STEVE!' : 'Nhấn vào đây hoặc bấm phím bất kỳ để BẮT ĐẦU!';
                this.drawOverlayScreen(ctx, title, sub, this.skin === 'minecraft' ? '#38bdf8' : '#facc15');
            } else if (this.gameState === 'WIN') {
                const title = this.skin === 'minecraft' ? 'VICTORY ROYALE! STEVE CHIẾN THẮNG!' : 'STAGE CLEAR! BẠN ĐÃ CHIẾN THẮNG!';
                this.drawOverlayScreen(ctx, title, 'Điểm số: ' + this.score + ' | Nhấn [R] để chơi lại', '#22c55e');
            } else if (this.gameState === 'GAMEOVER') {
                this.drawGameOverCard(ctx);
            }
        }

        drawScenery(ctx) {
            if (this.skin === 'minecraft') {
                // MINECRAFT SCENERY
                // 1. Square Sun
                const sunX = Math.floor(this.cameraX * 0.08) + 120;
                const sunY = 40;
                const sunSize = 54;
                ctx.fillStyle = 'rgba(254, 240, 138, 0.35)';
                ctx.fillRect(sunX - 8, sunY - 8, sunSize + 16, sunSize + 16);
                ctx.fillStyle = '#fef08a';
                ctx.fillRect(sunX, sunY, sunSize, sunSize);
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(sunX + 10, sunY + 10, sunSize - 20, sunSize - 20);

                // 2. Minecraft Pixel Box Clouds
                const mcClouds = [
                    { x: 100, y: 75, w: 120, h: 26 },
                    { x: 380, y: 100, w: 160, h: 30 },
                    { x: 740, y: 65, w: 200, h: 28 },
                    { x: 1200, y: 90, w: 150, h: 26 },
                    { x: 1650, y: 70, w: 180, h: 32 },
                    { x: 2100, y: 85, w: 140, h: 25 },
                    { x: 2550, y: 70, w: 190, h: 30 }
                ];
                mcClouds.forEach(c => {
                    ctx.fillStyle = '#cbd5e1';
                    ctx.fillRect(c.x, c.y + c.h - 6, c.w, 6);
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(c.x, c.y, c.w, c.h - 6);
                    ctx.fillRect(c.x + 20, c.y - 8, c.w - 40, 8);
                });

                // 3. Stepped Blocky Mountain Hills
                const mcHills = [
                    { x: 40, y: this.groundY, steps: 5, stepW: 36, stepH: 18 },
                    { x: 680, y: this.groundY, steps: 6, stepW: 34, stepH: 18 },
                    { x: 1380, y: this.groundY, steps: 5, stepW: 38, stepH: 19 },
                    { x: 2050, y: this.groundY, steps: 7, stepW: 35, stepH: 18 }
                ];
                mcHills.forEach(h => {
                    for (let s = 0; s < h.steps; s++) {
                        const curW = (h.steps - s) * 2 * h.stepW;
                        const curX = h.x + s * h.stepW;
                        const curY = h.y - (s + 1) * h.stepH;
                        ctx.fillStyle = s % 2 === 0 ? '#15803d' : '#166534';
                        ctx.fillRect(curX, curY, curW, h.stepH);
                        ctx.fillStyle = '#22c55e';
                        ctx.fillRect(curX, curY, curW, 3);
                    }
                });
                return;
            }

            // CLASSIC MARIO SCENERY
            const clouds = [
                { x: 120, y: 70, scale: 1 },
                { x: 450, y: 90, scale: 0.8 },
                { x: 800, y: 60, scale: 1.2 },
                { x: 1300, y: 80, scale: 0.9 },
                { x: 1750, y: 65, scale: 1.1 },
                { x: 2200, y: 75, scale: 1 },
                { x: 2600, y: 85, scale: 0.8 }
            ];
            clouds.forEach(c => {
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(c.x, c.y, 20 * c.scale, 0, Math.PI * 2);
                ctx.arc(c.x + 25 * c.scale, c.y - 10 * c.scale, 25 * c.scale, 0, Math.PI * 2);
                ctx.arc(c.x + 55 * c.scale, c.y, 20 * c.scale, 0, Math.PI * 2);
                ctx.fill();
            });

            const hills = [
                { x: 50, y: this.groundY, w: 180, h: 80 },
                { x: 700, y: this.groundY, w: 220, h: 100 },
                { x: 1400, y: this.groundY, w: 200, h: 90 },
                { x: 2100, y: this.groundY, w: 250, h: 110 }
            ];
            hills.forEach(h => {
                ctx.fillStyle = '#00a800';
                ctx.beginPath();
                ctx.ellipse(h.x + h.w / 2, h.y, h.w / 2, h.h, 0, Math.PI, 0);
                ctx.fill();
                ctx.strokeStyle = '#006400';
                ctx.lineWidth = 2;
                ctx.stroke();
            });
        }

        drawGround(ctx, x, y, w, h) {
            if (this.skin === 'minecraft') {
                // MINECRAFT GRASS BLOCK
                // 1. Dirt background
                ctx.fillStyle = '#573d26';
                ctx.fillRect(x, y + 10, w, h - 10);

                // 2. Dirt gravel pixels
                for (let px = x; px < x + w; px += 18) {
                    ctx.fillStyle = '#3a2717';
                    ctx.fillRect(px + 4, y + 18, 4, 4);
                    ctx.fillRect(px + 12, y + 34, 5, 4);
                    ctx.fillRect(px + 2, y + 50, 4, 4);
                    ctx.fillStyle = '#845e3f';
                    ctx.fillRect(px + 10, y + 24, 4, 3);
                    ctx.fillRect(px + 3, y + 38, 4, 4);
                    ctx.fillRect(px + 12, y + 56, 4, 4);
                }

                // 3. Grass layer top
                ctx.fillStyle = '#5c8e32';
                ctx.fillRect(x, y, w, 10);
                ctx.fillStyle = '#74a838';
                ctx.fillRect(x, y, w, 3);

                // 4. Sawtooth grass blades hanging down
                ctx.fillStyle = '#5c8e32';
                for (let gx = x; gx < x + w; gx += 12) {
                    ctx.fillRect(gx, y + 10, 4, 5);
                    ctx.fillRect(gx + 4, y + 10, 4, 8);
                    ctx.fillRect(gx + 8, y + 10, 4, 3);
                }

                // Block vertical seams every 36px
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
                ctx.lineWidth = 1;
                for (let bx = x; bx < x + w; bx += 36) {
                    ctx.beginPath();
                    ctx.moveTo(bx, y);
                    ctx.lineTo(bx, y + h);
                    ctx.stroke();
                }
                return;
            }

            // Brown dirt with retro grid
            ctx.fillStyle = '#d86b27';
            ctx.fillRect(x, y + 10, w, h - 10);

            // Green grass top with notches
            ctx.fillStyle = '#00a800';
            ctx.fillRect(x, y, w, 10);
            ctx.fillStyle = '#4ae64a';
            ctx.fillRect(x, y, w, 3);

            // Brick details on ground
            ctx.strokeStyle = '#8b3f12';
            ctx.lineWidth = 1;
            for (let bx = x; bx < x + w; bx += 24) {
                ctx.strokeRect(bx, y + 10, 24, 16);
                ctx.strokeRect(bx - 12, y + 26, 24, 16);
                ctx.strokeRect(bx, y + 42, 24, 16);
            }
        }

        drawPipe(ctx, x, y, w, h) {
            if (this.skin === 'minecraft') {
                // MINECRAFT NETHER PORTAL
                // Obsidian frame
                ctx.fillStyle = '#181124';
                ctx.fillRect(x, y, w, h);
                ctx.strokeStyle = '#2e1b4d';
                ctx.lineWidth = 3;
                ctx.strokeRect(x, y, w, h);

                // Obsidian crystal texture flecks
                ctx.fillStyle = '#581c87';
                ctx.fillRect(x + 4, y + 6, 4, 4);
                ctx.fillRect(x + w - 8, y + 16, 5, 4);
                ctx.fillRect(x + 6, y + h - 18, 5, 5);

                // Inner Nether Portal Swirling Energy
                const portalX = x + 8;
                const portalY = y + 8;
                const portalW = w - 16;
                const portalH = h - 8;

                const portalGrad = ctx.createLinearGradient(portalX, portalY, portalX + portalW, portalY + portalH);
                portalGrad.addColorStop(0, '#581c87');
                portalGrad.addColorStop(0.3, '#7e22ce');
                portalGrad.addColorStop(0.6, '#a855f7');
                portalGrad.addColorStop(1, '#3b0764');
                ctx.fillStyle = portalGrad;
                ctx.fillRect(portalX, portalY, portalW, portalH);

                // Wavy portal energy strands
                const time = performance.now() * 0.003;
                ctx.fillStyle = 'rgba(216, 180, 254, 0.45)';
                for (let py = portalY + 4; py < portalY + portalH - 6; py += 10) {
                    const waveOffset = Math.sin(time + py * 0.1) * 3;
                    ctx.fillRect(portalX + 3 + waveOffset, py, portalW - 6, 3);
                }

                // Portal glow particles
                ctx.fillStyle = '#f3e8ff';
                const sparkY = portalY + ((Math.floor(time * 20) % (portalH - 10)));
                ctx.fillRect(portalX + portalW / 2 - 2, sparkY, 4, 4);

                // Obsidian pillar top lip
                ctx.fillStyle = '#0f0a17';
                ctx.fillRect(x - 3, y, w + 6, 8);
                ctx.fillStyle = '#7e22ce';
                ctx.fillRect(x + 2, y + 2, 4, 4);
                ctx.fillRect(x + w - 6, y + 2, 4, 4);
                return;
            }

            // Pipe body
            const pipeGrad = ctx.createLinearGradient(x, y, x + w, y);
            pipeGrad.addColorStop(0, '#00a800');
            pipeGrad.addColorStop(0.35, '#54e354');
            pipeGrad.addColorStop(0.7, '#00a800');
            pipeGrad.addColorStop(1, '#005400');

            ctx.fillStyle = pipeGrad;
            ctx.fillRect(x, y + 18, w, h - 18);
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y + 18, w, h - 18);

            // Pipe top lip
            ctx.fillRect(x - 4, y, w + 8, 18);
            ctx.strokeRect(x - 4, y, w + 8, 18);

            // Highlight line
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.fillRect(x + 6, y + 2, 4, 14);
            ctx.fillRect(x + 8, y + 20, 4, h - 22);
        }

        drawQuestionBlock(ctx, x, y, w, h, used) {
            if (this.skin === 'minecraft') {
                if (used) {
                    // MINECRAFT EMPTY BEDROCK / STONE BLOCK
                    ctx.fillStyle = '#475569';
                    ctx.fillRect(x, y, w, h);
                    ctx.strokeStyle = '#1e293b';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(x, y, w, h);

                    // Stone cracks
                    ctx.fillStyle = '#1e293b';
                    ctx.fillRect(x + 4, y + 6, 8, 3);
                    ctx.fillRect(x + 18, y + 14, 10, 4);
                    ctx.fillRect(x + 6, y + 24, 12, 3);
                    return;
                }

                // MINECRAFT LUCKY BLOCK
                const lGrad = ctx.createLinearGradient(x, y, x, y + h);
                lGrad.addColorStop(0, '#facc15');
                lGrad.addColorStop(1, '#ca8a04');
                ctx.fillStyle = lGrad;
                ctx.fillRect(x, y, w, h);

                // Pixel border
                ctx.strokeStyle = '#854d0e';
                ctx.lineWidth = 2;
                ctx.strokeRect(x, y, w, h);

                // Inner frame
                ctx.strokeStyle = '#eab308';
                ctx.lineWidth = 1.5;
                ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);

                // Pixel question mark
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(x + 12, y + 8, 12, 4);
                ctx.fillRect(x + 20, y + 12, 4, 5);
                ctx.fillRect(x + 15, y + 17, 6, 4);
                ctx.fillRect(x + 16, y + 24, 4, 4);

                // Question mark shadow
                ctx.fillStyle = '#713f12';
                ctx.fillRect(x + 24, y + 10, 2, 7);
                ctx.fillRect(x + 18, y + 28, 2, 2);

                // 4 Corner bolts
                ctx.fillStyle = '#854d0e';
                ctx.fillRect(x + 2, y + 2, 3, 3);
                ctx.fillRect(x + w - 5, y + 2, 3, 3);
                ctx.fillRect(x + 2, y + h - 5, 3, 3);
                ctx.fillRect(x + w - 5, y + h - 5, 3, 3);
                return;
            }

            if (used) {
                ctx.fillStyle = '#8b5a2b';
                ctx.fillRect(x, y, w, h);
                ctx.strokeStyle = '#3e2723';
                ctx.lineWidth = 2;
                ctx.strokeRect(x, y, w, h);
                ctx.fillStyle = '#3e2723';
                ctx.fillRect(x + 3, y + 3, 3, 3);
                ctx.fillRect(x + w - 6, y + 3, 3, 3);
                ctx.fillRect(x + 3, y + h - 6, 3, 3);
                ctx.fillRect(x + w - 6, y + h - 6, 3, 3);
            } else {
                const bGrad = ctx.createLinearGradient(x, y, x, y + h);
                bGrad.addColorStop(0, '#fcd34d');
                bGrad.addColorStop(1, '#d97706');
                ctx.fillStyle = bGrad;
                ctx.fillRect(x, y, w, h);
                ctx.strokeStyle = '#78350f';
                ctx.lineWidth = 2;
                ctx.strokeRect(x, y, w, h);

                ctx.fillStyle = '#78350f';
                ctx.font = 'bold 22px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('?', x + w / 2, y + h / 2 + 1);

                ctx.fillStyle = '#78350f';
                ctx.fillRect(x + 2, y + 2, 3, 3);
                ctx.fillRect(x + w - 5, y + 2, 3, 3);
                ctx.fillRect(x + 2, y + h - 5, 3, 3);
                ctx.fillRect(x + w - 5, y + h - 5, 3, 3);
            }
        }

        drawBrickBlock(ctx, x, y, w, h) {
            if (this.skin === 'minecraft') {
                // MINECRAFT COBBLESTONE (Đá Cuội Pixel)
                ctx.fillStyle = '#64748b';
                ctx.fillRect(x, y, w, h);
                ctx.strokeStyle = '#1e293b';
                ctx.lineWidth = 1.5;
                ctx.strokeRect(x, y, w, h);

                // Cobblestone patches
                ctx.fillStyle = '#334155';
                ctx.fillRect(x + 4, y + 4, 12, 10);
                ctx.fillRect(x + 19, y + 5, 13, 8);
                ctx.fillRect(x + 3, y + 18, 14, 12);
                ctx.fillRect(x + 20, y + 17, 12, 14);

                // Stone light highlights
                ctx.fillStyle = '#94a3b8';
                ctx.fillRect(x + 5, y + 5, 10, 7);
                ctx.fillRect(x + 20, y + 6, 10, 6);
                ctx.fillRect(x + 4, y + 19, 11, 9);
                ctx.fillRect(x + 21, y + 18, 10, 11);

                // Tiny gravel pixels
                ctx.fillStyle = '#cbd5e1';
                ctx.fillRect(x + 7, y + 7, 3, 3);
                ctx.fillRect(x + 22, y + 20, 3, 3);
                return;
            }

            ctx.fillStyle = '#b45309';
            ctx.fillRect(x, y, w, h);
            ctx.strokeStyle = '#451a03';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(x, y, w, h);

            ctx.beginPath();
            ctx.moveTo(x, y + h / 2);
            ctx.lineTo(x + w, y + h / 2);
            ctx.moveTo(x + w / 2, y);
            ctx.lineTo(x + w / 2, y + h / 2);
            ctx.moveTo(x + w / 4, y + h / 2);
            ctx.lineTo(x + w / 4, y + h);
            ctx.moveTo(x + (3 * w) / 4, y + h / 2);
            ctx.lineTo(x + (3 * w) / 4, y + h);
            ctx.stroke();
        }

        drawCoin(ctx, x, y, w, h) {
            if (this.skin === 'minecraft') {
                // MINECRAFT DIAMOND 💎 (Viên Kim Cương)
                ctx.save();
                const cx = x + w / 2;
                const cy = y + h / 2;

                ctx.beginPath();
                ctx.moveTo(cx, y + 2);
                ctx.lineTo(x + w - 2, y + h * 0.4);
                ctx.lineTo(cx, y + h - 2);
                ctx.lineTo(x + 2, y + h * 0.4);
                ctx.closePath();

                const dGrad = ctx.createLinearGradient(x, y, x + w, y + h);
                dGrad.addColorStop(0, '#e0f2fe');
                dGrad.addColorStop(0.3, '#38bdf8');
                dGrad.addColorStop(0.7, '#0284c7');
                dGrad.addColorStop(1, '#0369a1');
                ctx.fillStyle = dGrad;
                ctx.fill();

                ctx.strokeStyle = '#0c4a6e';
                ctx.lineWidth = 1.5;
                ctx.stroke();

                ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(cx, y + 2);
                ctx.lineTo(cx, y + h - 2);
                ctx.moveTo(x + 2, y + h * 0.4);
                ctx.lineTo(x + w - 2, y + h * 0.4);
                ctx.stroke();

                ctx.fillStyle = '#ffffff';
                ctx.fillRect(cx - 2, y + 4, 3, 3);
                ctx.restore();
                return;
            }

            ctx.save();
            ctx.fillStyle = '#facc15';
            ctx.beginPath();
            ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#b45309';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.fillStyle = '#fef08a';
            ctx.fillRect(x + w / 2 - 2, y + 4, 3, h - 8);
            ctx.restore();
        }

        drawFlagpole(ctx) {
            const f = this.flagpole;
            if (this.skin === 'minecraft') {
                // MINECRAFT BEACON BEAM (Cột Đèn Hiệu Kim Cương)
                ctx.fillStyle = '#181124';
                ctx.fillRect(f.x - 14, this.groundY - 16, 40, 16);
                ctx.fillStyle = '#38bdf8';
                ctx.fillRect(f.x - 8, this.groundY - 14, 28, 12);
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
                ctx.strokeRect(f.x - 8, this.groundY - 14, 28, 12);

                // Sky Beam: Diamond cyan beam
                const beamGrad = ctx.createLinearGradient(f.x - 4, 0, f.x + 16, 0);
                beamGrad.addColorStop(0, 'rgba(56, 189, 248, 0.25)');
                beamGrad.addColorStop(0.5, 'rgba(224, 242, 254, 0.95)');
                beamGrad.addColorStop(1, 'rgba(56, 189, 248, 0.25)');
                ctx.fillStyle = beamGrad;
                ctx.fillRect(f.x, 0, 12, this.groundY - 16);

                // Rising energy particles
                const time = performance.now() * 0.005;
                ctx.fillStyle = '#ffffff';
                for (let i = 0; i < 6; i++) {
                    const py = ((this.groundY - 20) - ((time * 60 + i * 45) % (this.groundY - 20)));
                    ctx.fillRect(f.x + 4 + (i % 2) * 3, py, 3, 3);
                }

                // Minecraft Wool Banner (Flag)
                const flagY = f.reached ? this.groundY - 60 : f.flagY;
                ctx.fillStyle = '#ef4444';
                ctx.fillRect(f.x - 28, flagY, 28, 32);
                ctx.strokeStyle = '#991b1b';
                ctx.lineWidth = 1.5;
                ctx.strokeRect(f.x - 28, flagY, 28, 32);
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(f.x - 16, flagY + 6, 4, 20);
                ctx.fillRect(f.x - 20, flagY + 12, 12, 3);
                return;
            }

            // CLASSIC FLAGPOLE
            ctx.fillStyle = '#15803d';
            ctx.fillRect(f.x - 12, this.groundY - 14, 36, 14);

            ctx.fillStyle = '#94a3b8';
            ctx.fillRect(f.x, f.y, f.w, f.h);
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = 1;
            ctx.strokeRect(f.x, f.y, f.w, f.h);

            ctx.fillStyle = '#facc15';
            ctx.beginPath();
            ctx.arc(f.x + f.w / 2, f.y, 10, 0, Math.PI * 2);
            ctx.fill();

            const flagY = f.reached ? this.groundY - 60 : f.flagY;
            ctx.fillStyle = '#22c55e';
            ctx.beginPath();
            ctx.moveTo(f.x, flagY);
            ctx.lineTo(f.x - 34, flagY + 16);
            ctx.lineTo(f.x, flagY + 32);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#15803d';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }

        drawCastle(ctx) {
            const c = this.castle;
            if (this.skin === 'minecraft') {
                // MINECRAFT STONE FORTRESS
                ctx.fillStyle = '#475569';
                ctx.fillRect(c.x, c.y, c.w, c.h);
                ctx.strokeStyle = '#1e293b';
                ctx.lineWidth = 2;
                ctx.strokeRect(c.x, c.y, c.w, c.h);

                // Cobblestone horizontal joint lines
                ctx.strokeStyle = '#334155';
                ctx.lineWidth = 1;
                for (let by = c.y + 16; by < c.y + c.h; by += 20) {
                    ctx.beginPath();
                    ctx.moveTo(c.x, by);
                    ctx.lineTo(c.x + c.w, by);
                    ctx.stroke();
                }

                // Battlements with burning torches
                for (let bx = c.x; bx < c.x + c.w; bx += 32) {
                    ctx.fillStyle = '#475569';
                    ctx.fillRect(bx, c.y - 18, 20, 18);
                    ctx.strokeRect(bx, c.y - 18, 20, 18);

                    // Minecraft Torches
                    ctx.fillStyle = '#78350f';
                    ctx.fillRect(bx + 8, c.y - 28, 4, 10);
                    ctx.fillStyle = '#facc15';
                    ctx.fillRect(bx + 7, c.y - 34, 6, 6);
                    ctx.fillStyle = '#ef4444';
                    ctx.fillRect(bx + 8, c.y - 32, 4, 3);
                }

                // Center tower
                ctx.fillStyle = '#334155';
                ctx.fillRect(c.x + 45, c.y - 45, 70, 45);
                ctx.strokeRect(c.x + 45, c.y - 45, 70, 45);

                // Fortress arched gateway
                ctx.fillStyle = '#090d16';
                ctx.fillRect(c.x + c.w / 2 - 20, c.y + c.h - 45, 40, 45);
                ctx.strokeStyle = '#64748b';
                ctx.lineWidth = 2;
                ctx.strokeRect(c.x + c.w / 2 - 20, c.y + c.h - 45, 40, 45);
                return;
            }

            // Main castle wall
            ctx.fillStyle = '#94a3b8';
            ctx.fillRect(c.x, c.y, c.w, c.h);
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = 2;
            ctx.strokeRect(c.x, c.y, c.w, c.h);

            for (let bx = c.x; bx < c.x + c.w; bx += 32) {
                ctx.fillRect(bx, c.y - 18, 18, 18);
                ctx.strokeRect(bx, c.y - 18, 18, 18);
            }

            ctx.fillRect(c.x + 45, c.y - 45, 70, 45);
            ctx.strokeRect(c.x + 45, c.y - 45, 70, 45);
            for (let bx = c.x + 45; bx < c.x + 115; bx += 24) {
                ctx.fillRect(bx, c.y - 60, 14, 15);
                ctx.strokeRect(bx, c.y - 60, 14, 15);
            }

            ctx.fillStyle = '#0f172a';
            ctx.beginPath();
            ctx.arc(c.x + c.w / 2, c.y + c.h - 35, 20, Math.PI, 0);
            ctx.lineTo(c.x + c.w / 2 + 20, c.y + c.h);
            ctx.lineTo(c.x + c.w / 2 - 20, c.y + c.h);
            ctx.closePath();
            ctx.fill();
        }

        drawGoomba(ctx, e) {
            ctx.save();
            if (this.skin === 'minecraft') {
                // MINECRAFT CREEPER
                if (e.squashed) {
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
                    ctx.beginPath();
                    ctx.arc(e.x + e.w / 2, e.y + 16, 14, 0, Math.PI * 2);
                    ctx.arc(e.x + e.w / 2 - 8, e.y + 12, 10, 0, Math.PI * 2);
                    ctx.arc(e.x + e.w / 2 + 8, e.y + 12, 10, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.strokeStyle = '#cbd5e1';
                    ctx.lineWidth = 2;
                    ctx.stroke();

                    ctx.fillStyle = '#ef4444';
                    ctx.fillRect(e.x + 4, e.y + 8, 4, 4);
                    ctx.fillRect(e.x + e.w - 8, e.y + 6, 4, 4);
                } else {
                    const hx = e.x + (e.w - 18) / 2;
                    const hy = e.y + 2;

                    // Creeper Head
                    ctx.fillStyle = '#22c55e';
                    ctx.fillRect(hx, hy, 18, 18);

                    ctx.fillStyle = '#16a34a';
                    ctx.fillRect(hx + 2, hy + 2, 3, 3);
                    ctx.fillRect(hx + 12, hy + 2, 3, 3);
                    ctx.fillRect(hx + 1, hy + 12, 3, 3);
                    ctx.fillStyle = '#15803d';
                    ctx.fillRect(hx + 7, hy + 1, 4, 3);
                    ctx.fillRect(hx + 13, hy + 13, 3, 3);

                    // Creeper Face
                    ctx.fillStyle = '#0f172a';
                    ctx.fillRect(hx + 3, hy + 4, 4, 4);
                    ctx.fillRect(hx + 11, hy + 4, 4, 4);
                    ctx.fillRect(hx + 7, hy + 7, 4, 4);
                    ctx.fillRect(hx + 5, hy + 10, 8, 4);
                    ctx.fillRect(hx + 5, hy + 14, 2, 3);
                    ctx.fillRect(hx + 11, hy + 14, 2, 3);

                    // Creeper Body
                    const bx = e.x + 8;
                    const by = hy + 18;
                    ctx.fillStyle = '#16a34a';
                    ctx.fillRect(bx, by, 14, 8);
                    ctx.fillStyle = '#15803d';
                    ctx.fillRect(bx + 2, by + 2, 4, 4);

                    // Feet
                    ctx.fillStyle = '#15803d';
                    ctx.fillRect(bx - 2, by + 8, 6, 4);
                    ctx.fillRect(bx + 10, by + 8, 6, 4);
                }
                ctx.restore();
                return;
            }

            if (e.squashed) {
                ctx.fillStyle = '#854d0e';
                ctx.fillRect(e.x, e.y + 18, e.w, 12);
                ctx.fillStyle = '#fef08a';
                ctx.fillRect(e.x + 4, e.y + 20, 6, 4);
                ctx.fillRect(e.x + e.w - 10, e.y + 20, 6, 4);
            } else {
                ctx.fillStyle = '#854d0e';
                ctx.beginPath();
                ctx.arc(e.x + e.w / 2, e.y + 12, 14, Math.PI, 0);
                ctx.lineTo(e.x + e.w, e.y + 20);
                ctx.lineTo(e.x, e.y + 20);
                ctx.closePath();
                ctx.fill();

                ctx.fillStyle = '#fef08a';
                ctx.fillRect(e.x + 6, e.y + 16, e.w - 12, 10);

                ctx.fillStyle = '#1e293b';
                ctx.beginPath();
                ctx.ellipse(e.x + 5, e.y + 28, 6, 3, 0, 0, Math.PI * 2);
                ctx.ellipse(e.x + e.w - 5, e.y + 28, 6, 3, 0, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#ffffff';
                ctx.fillRect(e.x + 7, e.y + 13, 4, 7);
                ctx.fillRect(e.x + e.w - 11, e.y + 13, 4, 7);
                ctx.fillStyle = '#000000';
                ctx.fillRect(e.x + 8, e.y + 15, 2, 4);
                ctx.fillRect(e.x + e.w - 10, e.y + 15, 2, 4);
            }
            ctx.restore();
        }

        drawMario(ctx, m) {
            ctx.save();
            ctx.translate(m.x + m.w / 2, m.y + m.h / 2);

            if (m.facing === 'left') {
                ctx.scale(-1, 1);
            }

            if (m.invincible > 0 && Math.floor(m.invincible / 4) % 2 === 0) {
                ctx.globalAlpha = 0.35;
            }

            const ox = -m.w / 2;
            const oy = -m.h / 2;

            if (this.skin === 'minecraft') {
                // MINECRAFT STEVE + DIAMOND SWORD
                // 1. Head (18x18 pixel box)
                ctx.fillStyle = '#382414'; // Brown hair
                ctx.fillRect(ox + 5, oy + 2, 18, 6);
                ctx.fillRect(ox + 5, oy + 8, 4, 5);
                ctx.fillStyle = '#c48d68'; // Skin
                ctx.fillRect(ox + 8, oy + 8, 15, 10);
                // Eyes
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(ox + 16, oy + 10, 4, 3);
                ctx.fillStyle = '#2563eb';
                ctx.fillRect(ox + 18, oy + 10, 2, 3);
                // Mouth/beard
                ctx.fillStyle = '#451a03';
                ctx.fillRect(ox + 16, oy + 15, 5, 2);

                // 2. Torso (Cyan T-Shirt)
                ctx.fillStyle = '#00a8a8';
                ctx.fillRect(ox + 6, oy + 18, 16, 12);
                ctx.fillStyle = '#c48d68';
                ctx.fillRect(ox + 12, oy + 18, 4, 3);
                ctx.fillRect(ox + 18, oy + 23, 4, 5); // Arm skin

                // 3. Pants
                ctx.fillStyle = '#1e3a8a';
                ctx.fillRect(ox + 7, oy + 30, 14, 5);

                // 4. Legs / Boots
                ctx.fillStyle = '#334155';
                if (m.state === 'jump') {
                    ctx.fillStyle = '#1e3a8a';
                    ctx.fillRect(ox + 2, oy + 30, 7, 5);
                    ctx.fillRect(ox + 17, oy + 29, 7, 5);
                    ctx.fillStyle = '#334155';
                    ctx.fillRect(ox + 1, oy + 34, 7, 4);
                    ctx.fillRect(ox + 18, oy + 33, 7, 4);
                } else if (m.state === 'run') {
                    ctx.fillStyle = '#1e3a8a';
                    if (m.runFrame === 0) {
                        ctx.fillRect(ox + 5, oy + 31, 7, 4);
                        ctx.fillRect(ox + 15, oy + 31, 7, 4);
                        ctx.fillStyle = '#334155';
                        ctx.fillRect(ox + 5, oy + 35, 7, 3);
                        ctx.fillRect(ox + 15, oy + 35, 7, 3);
                    } else if (m.runFrame === 1) {
                        ctx.fillRect(ox + 2, oy + 30, 7, 4);
                        ctx.fillRect(ox + 17, oy + 31, 7, 4);
                        ctx.fillStyle = '#334155';
                        ctx.fillRect(ox + 1, oy + 34, 7, 4);
                        ctx.fillRect(ox + 17, oy + 35, 7, 3);
                    } else {
                        ctx.fillRect(ox + 7, oy + 31, 7, 4);
                        ctx.fillRect(ox + 17, oy + 30, 7, 4);
                        ctx.fillStyle = '#334155';
                        ctx.fillRect(ox + 7, oy + 35, 7, 3);
                        ctx.fillRect(ox + 17, oy + 34, 7, 4);
                    }
                } else {
                    ctx.fillStyle = '#334155';
                    ctx.fillRect(ox + 6, oy + 34, 6, 4);
                    ctx.fillRect(ox + 14, oy + 34, 6, 4);
                }

                // 5. DIAMOND SWORD (Thanh Kiếm Kim Cương 🗡️)
                ctx.save();
                let swordAngle = 0.35;
                let swordX = ox + 20;
                let swordY = oy + 24;

                if (m.state === 'jump') {
                    swordAngle = -0.55;
                    swordY = oy + 18;
                } else if (m.state === 'run') {
                    swordAngle = (m.runFrame % 2 === 0) ? 0.6 : 0.15;
                }

                ctx.translate(swordX, swordY);
                ctx.rotate(swordAngle);

                // Handle
                ctx.fillStyle = '#451a03';
                ctx.fillRect(-2, 8, 3, 5);
                // Guard
                ctx.fillStyle = '#78350f';
                ctx.fillRect(-6, 6, 11, 2);
                // Diamond Blade
                ctx.fillStyle = '#0ea5e9';
                ctx.fillRect(-2, -14, 3, 20);
                // Diamond Highlight edge
                ctx.fillStyle = '#e0f2fe';
                ctx.fillRect(-1, -15, 2, 18);
                // Diamond Tip
                ctx.fillRect(-2, -16, 2, 2);

                ctx.restore();
                ctx.restore();
                return;
            }

            // CLASSIC MARIO DRAWING
            ctx.fillStyle = '#dc2626';
            ctx.fillRect(ox + 4, oy, 20, 8);
            ctx.fillRect(ox + 8, oy + 4, 20, 5);

            ctx.fillStyle = '#fed7aa';
            ctx.fillRect(ox + 6, oy + 8, 16, 11);

            ctx.fillStyle = '#0f172a';
            ctx.fillRect(ox + 16, oy + 10, 3, 4);
            ctx.fillStyle = '#451a03';
            ctx.fillRect(ox + 13, oy + 14, 11, 4);
            ctx.fillStyle = '#fed7aa';
            ctx.fillRect(ox + 18, oy + 12, 5, 4);

            ctx.fillStyle = '#dc2626';
            ctx.fillRect(ox + 4, oy + 18, 20, 10);

            ctx.fillStyle = '#2563eb';
            ctx.fillRect(ox + 6, oy + 21, 16, 11);
            ctx.fillStyle = '#facc15';
            ctx.fillRect(ox + 7, oy + 22, 3, 3);
            ctx.fillRect(ox + 17, oy + 22, 3, 3);

            ctx.fillStyle = '#78350f';
            if (m.state === 'jump') {
                ctx.fillRect(ox + 1, oy + 30, 10, 8);
                ctx.fillRect(ox + 17, oy + 28, 10, 8);
            } else if (m.state === 'run') {
                if (m.runFrame === 0) {
                    ctx.fillRect(ox + 4, oy + 30, 9, 8);
                    ctx.fillRect(ox + 15, oy + 30, 9, 8);
                } else if (m.runFrame === 1) {
                    ctx.fillRect(ox + 1, oy + 30, 9, 8);
                    ctx.fillRect(ox + 18, oy + 28, 9, 7);
                } else {
                    ctx.fillRect(ox + 7, oy + 28, 9, 7);
                    ctx.fillRect(ox + 18, oy + 30, 9, 8);
                }
            } else {
                ctx.fillRect(ox + 4, oy + 31, 9, 7);
                ctx.fillRect(ox + 15, oy + 31, 9, 7);
            }

            ctx.restore();
        }

        drawHUD(ctx) {
            ctx.save();
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 15px monospace';
            ctx.textBaseline = 'top';

            // 120 FPS High Refresh Badge on HUD
            const displayFps = this.currentFps ? this.currentFps : 120;
            ctx.fillStyle = '#10b981';
            ctx.font = 'bold 12px monospace';
            ctx.fillText('⚡ ' + displayFps + ' FPS', 130, 13);

            ctx.font = 'bold 15px monospace';

            if (this.skin === 'minecraft') {
                // MINECRAFT HUD
                ctx.fillStyle = '#38bdf8';
                ctx.fillText('STEVE', 30, 12);
                ctx.fillStyle = '#ffffff';
                ctx.fillText(String(this.score).padStart(6, '0'), 30, 28);

                ctx.fillStyle = '#38bdf8';
                ctx.fillText('💎 x ' + String(this.coins).padStart(2, '0'), 220, 28);

                ctx.fillStyle = '#ffffff';
                ctx.fillText('WORLD', 420, 12);
                ctx.fillText('1-1 (MC)', 422, 28);

                ctx.fillText('TIME', 600, 12);
                ctx.fillText(String(this.time).padStart(3, '0'), 608, 28);

                ctx.fillStyle = '#f43f5e';
                ctx.fillText('❤️ x ' + this.lives, 720, 28);
                ctx.restore();
                return;
            }

            // Top Status Bar
            ctx.fillText('MARIO', 30, 12);
            ctx.fillText(String(this.score).padStart(6, '0'), 30, 28);

            ctx.fillStyle = '#facc15';
            ctx.fillText('🪙 x ' + String(this.coins).padStart(2, '0'), 220, 28);

            ctx.fillStyle = '#ffffff';
            ctx.fillText('WORLD', 420, 12);
            ctx.fillText('1-1', 432, 28);

            ctx.fillText('TIME', 600, 12);
            ctx.fillText(String(this.time).padStart(3, '0'), 608, 28);

            ctx.fillStyle = '#f43f5e';
            ctx.fillText('❤️ x ' + this.lives, 720, 28);

            ctx.restore();
        }

        drawOverlayScreen(ctx, title, subtitle, titleColor = '#ffffff') {
            ctx.save();
            ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
            ctx.fillRect(0, 0, this.width, this.height);

            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            ctx.fillStyle = titleColor;
            ctx.font = 'bold 30px "Segoe UI", sans-serif';
            ctx.fillText(title, this.width / 2, this.height / 2 - 25);

            ctx.fillStyle = '#ffffff';
            ctx.font = '15px "Segoe UI", sans-serif';
            ctx.fillText(subtitle, this.width / 2, this.height / 2 + 25);

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

            // Huy hiệu điểm số
            const badgeY = cardY + cardH - 64;
            ctx.fillStyle = '#ffffff';
            this.roundRect(ctx, cardX + (cardW - 240) / 2, badgeY, 240, 26, 13, true, false);
            ctx.strokeStyle = '#fbcfe8';
            ctx.lineWidth = 1.5;
            this.roundRect(ctx, cardX + (cardW - 240) / 2, badgeY, 240, 26, 13, false, true);

            ctx.fillStyle = '#db2777';
            ctx.font = 'bold 12px "Quicksand", sans-serif';
            ctx.textBaseline = 'middle';
            ctx.fillText('⭐ Điểm: ' + this.score + '  |  🪙 Xu: ' + this.coins, cardX + cardW / 2, badgeY + 13);

            // Hướng dẫn click
            ctx.fillStyle = '#94a3b8';
            ctx.font = '600 11px "Quicksand", sans-serif';
            ctx.fillText('Bấm vào thiệp để mở to 💌  •  Bấm bên ngoài (hoặc phím R) để chơi lại 🔄', cardX + cardW / 2, cardY + cardH - 18);

            ctx.restore();
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

        drawWrappedText(ctx, text, x, y, maxWidth, lineHeight) {
            const words = text.split(' ');
            let line = '';
            let currentY = y;
            let linesDrawn = 0;
            const maxLines = 4;

            for (let n = 0; n < words.length; n++) {
                const testLine = line + words[n] + ' ';
                const metrics = ctx.measureText(testLine);
                const testWidth = metrics.width;
                if (testWidth > maxWidth && n > 0) {
                    ctx.fillText(line.trim(), x, currentY);
                    line = words[n] + ' ';
                    currentY += lineHeight;
                    linesDrawn++;
                    if (linesDrawn >= maxLines - 1) {
                        ctx.fillText((line + words.slice(n + 1).join(' ')).slice(0, 50) + '...', x, currentY);
                        return;
                    }
                } else {
                    line = testLine;
                }
            }
            ctx.fillText(line.trim(), x, currentY);
        }

        loop(timestamp) {
            if (!this.lastTimestamp) this.lastTimestamp = timestamp;
            let delta = timestamp - this.lastTimestamp;
            this.lastTimestamp = timestamp;

            // Chống tràn bước cập nhật khi người dùng chuyển tab
            if (delta > 100) delta = 100;

            // Đo FPS thực tế
            this.frameCount = (this.frameCount || 0) + 1;
            if (!this.fpsTimer) this.fpsTimer = timestamp;
            if (timestamp - this.fpsTimer >= 500) {
                this.currentFps = Math.min(120, Math.round((this.frameCount * 1000) / (timestamp - this.fpsTimer)));
                this.frameCount = 0;
                this.fpsTimer = timestamp;
            }

            this.accumulator = (this.accumulator || 0) + delta;
            const targetStep = 1000 / 120; // 120 FPS siêu mượt (~8.33ms)

            while (this.accumulator >= targetStep) {
                this.update();
                this.accumulator -= targetStep;
            }

            this.render();
            requestAnimationFrame(this.loop.bind(this));
        }
    }

    // --- Fullscreen API Support ---
    window.toggleFullscreenMario = function(containerId) {
        var elem = null;
        if (typeof containerId === 'string') {
            elem = document.getElementById(containerId);
        } else if (containerId && containerId.nodeType) {
            elem = containerId;
        }

        if (!elem) {
            elem = document.getElementById('mario-side-panel') || document.getElementById('mario-game-container');
        }
        if (!elem) return;

        var isFs = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
        if (!isFs) {
            if (elem.requestFullscreen) {
                elem.requestFullscreen().catch(function(){});
            } else if (elem.webkitRequestFullscreen) {
                elem.webkitRequestFullscreen();
            } else if (elem.mozRequestFullScreen) {
                elem.mozRequestFullScreen();
            } else if (elem.msRequestFullscreen) {
                elem.msRequestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen().catch(function(){});
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
        }
    };

    window.exitFullscreenMario = function() {
        if (document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement) {
            if (document.exitFullscreen) {
                document.exitFullscreen().catch(function(){});
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
        }
    };

    function handleFullscreenChange() {
        var fsElement = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
        var sidePanel = document.getElementById('mario-side-panel');
        var gameContainer = document.getElementById('mario-game-container');

        // Manage class fallback & Canvas Auto-focus
        if (sidePanel) {
            if (fsElement === sidePanel) {
                sidePanel.classList.add('is-mario-fullscreen');
                var sideCanvas = document.getElementById('mario-side-canvas');
                if (sideCanvas) {
                    setTimeout(function() { sideCanvas.focus(); }, 50);
                }
            } else {
                sidePanel.classList.remove('is-mario-fullscreen');
            }
        }

        if (gameContainer) {
            if (fsElement === gameContainer) {
                gameContainer.classList.add('is-mario-fullscreen');
                var marioCanvas = document.getElementById('mario-canvas');
                if (marioCanvas) {
                    setTimeout(function() { marioCanvas.focus(); }, 50);
                }
            } else {
                gameContainer.classList.remove('is-mario-fullscreen');
            }
        }

        // Cập nhật nhãn và icon cho tất cả các nút Fullscreen
        var isFs = !!fsElement;
        var fsBtns = document.querySelectorAll('.btn-mario-fullscreen-toggle, #side-fs-btn, #btn-toggle-fullscreen');
        fsBtns.forEach(function(btn) {
            var iconEl = btn.querySelector('.fs-icon');
            var textEl = btn.querySelector('.fs-text');
            if (isFs) {
                if (iconEl && textEl) {
                    iconEl.innerText = '✕';
                    textEl.innerText = 'Thoát (ESC)';
                } else {
                    btn.innerHTML = '✕ Thoát (ESC)';
                }
                btn.style.background = '#dc2626';
                btn.style.borderColor = '#f87171';
                btn.style.color = '#ffffff';
            } else {
                if (iconEl && textEl) {
                    iconEl.innerText = '⛶';
                    textEl.innerText = 'Toàn màn hình';
                } else {
                    btn.innerHTML = '⛶ Toàn màn hình';
                }
                btn.style.background = '#1d4ed8';
                btn.style.borderColor = '#60a5fa';
                btn.style.color = '#eff6ff';
            }
        });
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    // Expose Global
    window.MarioGame = MarioGame;
    window.MarioAudio = audio;
})();
