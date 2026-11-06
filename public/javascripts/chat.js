/**
 * ChatFlex Interactive Chat Engine
 * - Scenario Question Handling & Free-text Input
 * - Typing Indicator & Typewriter Text Animation
 * - Text-to-Speech (Vietnamese TTS)
 * - Retro Sound Effects (Web Audio API)
 * - One-click Chat Reset
 * - Parallel Mario Game Toggle
 */

(function() {
    'use strict';

    // --- Web Audio Retro Chime for Chat ---
    class ChatAudioFX {
        constructor() {
            this.ctx = null;
            this.muted = false;
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

        playPop(isBot = false) {
            if (this.muted) return;
            this.init();
            if (!this.ctx) return;
            try {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                const now = this.ctx.currentTime;
                
                osc.type = 'sine';
                if (isBot) {
                    // Âm thanh nhận tin nhắn (2 nốt ting ting nhẹ)
                    osc.frequency.setValueAtTime(587.33, now); // D5
                    osc.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5
                } else {
                    // Âm thanh gửi tin nhắn (Bloop nhanh)
                    osc.frequency.setValueAtTime(440, now);
                    osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.08);
                }

                gain.gain.setValueAtTime(0.08, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(now);
                osc.stop(now + 0.14);
            } catch(e) {}
        }
    }

    const chatAudio = new ChatAudioFX();
    window.chatAudio = chatAudio;

    // --- Typewriter Effect ---
    function typewriterEffect(element, text, speed = 18, callback) {
        element.innerHTML = '';
        let i = 0;
        function typing() {
            if (i < text.length) {
                element.innerHTML += text.charAt(i);
                i++;
                const messageBox = document.getElementById('message-box');
                if (messageBox) messageBox.scrollTop = messageBox.scrollHeight;
                setTimeout(typing, speed);
            } else {
                if (callback) callback();
            }
        }
        typing();
    }

    // --- Voice Message Player ---
    let currentVoiceAudio = null;
    let currentVoiceBtn = null;

    window.togglePlayVoice = function(btn, audioUrl) {
        if (!audioUrl) return;

        if (currentVoiceAudio && !currentVoiceAudio.paused) {
            currentVoiceAudio.pause();
            if (currentVoiceBtn) currentVoiceBtn.innerText = '▶';
            if (currentVoiceBtn === btn) {
                currentVoiceAudio = null;
                currentVoiceBtn = null;
                return;
            }
        }

        currentVoiceAudio = new Audio(audioUrl);
        currentVoiceBtn = btn;
        btn.innerText = '⏸';

        currentVoiceAudio.play().catch(function(e) { console.error('Lỗi phát audio:', e); });

        currentVoiceAudio.onended = function() {
            btn.innerText = '▶';
            currentVoiceAudio = null;
            currentVoiceBtn = null;
        };
    };

    // --- Text to Speech (Tiếng Việt) ---
    window.speakText = function(text, btnElement) {
        if (!('speechSynthesis' in window)) {
            alert('Trình duyệt của bạn chưa hỗ trợ giọng đọc Text-to-Speech.');
            return;
        }

        window.speechSynthesis.cancel(); // Dừng câu đang đọc nếu có

        const cleanText = text.replace(/<[^>]*>?/gm, '').trim();
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = 'vi-VN';
        utterance.rate = 1.0;
        utterance.pitch = 1.05;

        // Đổi icon loa thành icon đang phát
        if (btnElement) {
            const originalIcon = btnElement.innerHTML;
            btnElement.innerHTML = '🔊 Đang đọc...';
            btnElement.style.color = '#15803d';

            utterance.onend = function() {
                btnElement.innerHTML = originalIcon;
                btnElement.style.color = '';
            };
            utterance.onerror = function() {
                btnElement.innerHTML = originalIcon;
                btnElement.style.color = '';
            };
        }

        window.speechSynthesis.speak(utterance);
    };

    // --- 1. Gửi câu hỏi lựa chọn theo kịch bản ---
    window.sendQuestion = function(questionId, questionText) {
        var messageBox = document.getElementById('message-box');
        var optionsContainer = document.getElementById('options-container');
        var charNameInput = document.getElementById('character-name');
        var botName = charNameInput ? charNameInput.value : 'Bot';
        var charIcon = document.getElementById('character-icon') ? document.getElementById('character-icon').value : '🤖';

        if (!questionText) {
            var clickedBtn = document.querySelector(`button[onclick*="${questionId}"]`);
            questionText = clickedBtn ? clickedBtn.innerText.replace(charIcon, '').replace('💬', '').trim() : 'Câu hỏi';
        }

        // Tên người gửi (lấy từ cookie hoặc navbar)
        var userName = getCurrentUserName();
        var userEmoji = (window.getEmojiForName && userName) ? window.getEmojiForName(userName) : '🐱';

        // Chèn tin nhắn của Người dùng
        var userMsgHtml = `
            <div class="message user" style="align-self: flex-end; background: #db2777; color: #fff; padding: 10px 16px; border-radius: 16px 16px 4px 16px; font-size: 14px; max-width: 82%; box-shadow: 0 2px 8px rgba(219,39,119,0.2); animation: fadeIn 0.15s ease;">
                <img src="/images/cat-avatar.png" alt="Avatar" style="width: 20px; height: 20px; border-radius: 50%; object-fit: cover; vertical-align: middle; margin-right: 6px; border: 1px solid rgba(255,255,255,0.7); display: inline-block;" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';"><span style="display: none; margin-right: 5px;">${userEmoji}</span><b>${escapeHtml(userName)}:</b> ${escapeHtml(questionText)}
            </div>
        `;
        messageBox.insertAdjacentHTML('beforeend', userMsgHtml);
        chatAudio.playPop(false);
        messageBox.scrollTop = messageBox.scrollHeight;

        // Trạng thái bot đang gõ
        var typingId = 'typing-' + Date.now();
        var typingHtml = `
            <div id="${typingId}" class="message bot" style="align-self: flex-start; background: #ffffff; border: 1px solid #fbcfe8; border-radius: 16px 16px 16px 4px; padding: 10px 14px; font-size: 13px; color: #94a3b8; display: flex; align-items: center; gap: 8px;">
                <span class="char-icon">${charIcon}</span> <span>${botName} đang phản hồi...</span>
            </div>
        `;
        messageBox.insertAdjacentHTML('beforeend', typingHtml);
        messageBox.scrollTop = messageBox.scrollHeight;

        if (optionsContainer) {
            optionsContainer.innerHTML = '<div style="font-size: 12px; color: #94a3b8; text-align: center; padding: 8px;">Đang tải câu hỏi tiếp theo...</div>';
        }

        // Gửi AJAX tới Server
        fetch('/chat/ask', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ questionId: questionId })
        })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            var typingEl = document.getElementById(typingId);
            if (typingEl) typingEl.remove();

            if (data.error) {
                if (optionsContainer) optionsContainer.innerHTML = '<p style="color: red; font-size: 13px; text-align: center;">' + data.error + '</p>';
                return;
            }

            chatAudio.playPop(true);

            // Cập nhật ảnh nền nếu có
            if (data.imageUrl && data.imageUrl.startsWith('/uploads/images/background')) {
                document.body.style.backgroundImage = "url('" + data.imageUrl + "')";
            }

            // Tạo khung tin nhắn của Bot
            var botMsgId = 'bot-msg-' + Date.now();
            var answerText = data.answerText || 'Xin chào!';
            var botMsgHtml = `
                <div class="message bot" style="align-self: flex-start; background: #ffffff; border: 1px solid #fbcfe8; border-radius: 16px 16px 16px 4px; padding: 14px 16px; font-size: 14px; color: #1e293b; max-width: 88%; box-shadow: 0 2px 10px rgba(0,0,0,0.04); line-height: 1.5;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                        <b style="color: #db2777; display: flex; align-items: center; gap: 6px;">
                            <span>${charIcon}</span> ${botName}:
                        </b>
                    </div>
                    <div id="${botMsgId}"></div>
            `;

            if (data.imageUrl) {
                botMsgHtml += `<div class="media-box" style="margin-top: 10px;"><img src="${data.imageUrl}" class="chat-media-img" alt="Hình ảnh đính kèm" style="max-width: 100%; border-radius: 10px; border: 1px solid #fbcfe8;"></div>`;
            }

            if (data.audioUrl) {
                botMsgHtml += `
                    <div class="voice-bubble" style="margin-top: 10px; background: #fdf2f8; border: 1.5px solid #fbcfe8; border-radius: 12px; padding: 8px 12px; display: flex; align-items: center; gap: 10px; max-width: 280px;">
                        <button type="button" class="btn-play-voice" onclick="togglePlayVoice(this, '${data.audioUrl}')" style="width: 34px; height: 34px; border-radius: 50%; background: #db2777; color: #fff; border: none; font-size: 13px; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(219,39,119,0.3); flex-shrink: 0;">
                            ▶
                        </button>
                        <div style="flex: 1;">
                            <div style="font-size: 11px; font-weight: 700; color: #db2777; margin-bottom: 2px;">
                                🎵 Tin nhắn thoại (${botName})
                            </div>
                            <div style="display: flex; align-items: center; gap: 3px; height: 12px;">
                                <span style="width: 3px; height: 5px; background: #f472b6; border-radius: 2px;"></span>
                                <span style="width: 3px; height: 11px; background: #db2777; border-radius: 2px;"></span>
                                <span style="width: 3px; height: 7px; background: #f472b6; border-radius: 2px;"></span>
                                <span style="width: 3px; height: 12px; background: #db2777; border-radius: 2px;"></span>
                                <span style="width: 3px; height: 6px; background: #f472b6; border-radius: 2px;"></span>
                            </div>
                        </div>
                    </div>
                `;
            }

            botMsgHtml += `</div>`;
            messageBox.insertAdjacentHTML('beforeend', botMsgHtml);

            // Chạy hiệu ứng máy đánh chữ
            var textContainer = document.getElementById(botMsgId);
            if (textContainer) {
                typewriterEffect(textContainer, answerText, 14, function() {
                    renderNextOptions(data.nextQuestions, charIcon);
                });
            } else {
                renderNextOptions(data.nextQuestions, charIcon);
            }
        })
        .catch(function(err) {
            var typingEl = document.getElementById(typingId);
            if (typingEl) typingEl.remove();
            console.error('Lỗi gửi câu hỏi:', err);
        });
    };

    // --- 2. Gửi văn bản tự do người dùng nhập ---
    window.handleSendFreeText = function(event) {
        if (event) event.preventDefault();
        var input = document.getElementById('chat-free-input');
        var charIdInput = document.getElementById('character-id');
        if (!input || !charIdInput) return;

        var text = input.value.trim();
        if (!text) return;

        var charId = charIdInput.value;
        var messageBox = document.getElementById('message-box');
        var charNameInput = document.getElementById('character-name');
        var botName = charNameInput ? charNameInput.value : 'Bot';
        var charIcon = document.getElementById('character-icon') ? document.getElementById('character-icon').value : '🤖';

        input.value = '';

        // Tên người gửi
        var userName = getCurrentUserName();
        var userEmoji = (window.getEmojiForName && userName) ? window.getEmojiForName(userName) : '🐱';

        // Chèn tin nhắn của Người dùng
        var userMsgHtml = `
            <div class="message user" style="align-self: flex-end; background: #db2777; color: #fff; padding: 10px 16px; border-radius: 16px 16px 4px 16px; font-size: 14px; max-width: 82%; box-shadow: 0 2px 8px rgba(219,39,119,0.2);">
                <img src="/images/cat-avatar.png" alt="Avatar" style="width: 20px; height: 20px; border-radius: 50%; object-fit: cover; vertical-align: middle; margin-right: 6px; border: 1px solid rgba(255,255,255,0.7); display: inline-block;" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';"><span style="display: none; margin-right: 5px;">${userEmoji}</span><b>${escapeHtml(userName)}:</b> ${escapeHtml(text)}
            </div>
        `;
        messageBox.insertAdjacentHTML('beforeend', userMsgHtml);
        chatAudio.playPop(false);
        messageBox.scrollTop = messageBox.scrollHeight;

        // Trạng thái bot đang gõ
        var typingId = 'typing-' + Date.now();
        var typingHtml = `
            <div id="${typingId}" class="message bot" style="align-self: flex-start; background: #ffffff; border: 1px solid #fbcfe8; border-radius: 16px 16px 16px 4px; padding: 10px 14px; font-size: 13px; color: #94a3b8; display: flex; align-items: center; gap: 8px;">
                <span class="char-icon">${charIcon}</span> <span>${botName} đang phản hồi...</span>
            </div>
        `;
        messageBox.insertAdjacentHTML('beforeend', typingHtml);
        messageBox.scrollTop = messageBox.scrollHeight;

        // Gửi tới Server route /chat/text-message
        fetch('/chat/text-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text, characterId: charId })
        })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            var typingEl = document.getElementById(typingId);
            if (typingEl) typingEl.remove();

            if (data.error) return;

            chatAudio.playPop(true);

            var botMsgId = 'bot-msg-' + Date.now();
            var answerText = data.answerText || 'Mình đã nhận được tin nhắn của bạn!';
            var botMsgHtml = `
                <div class="message bot" style="align-self: flex-start; background: #ffffff; border: 1px solid #fbcfe8; border-radius: 16px 16px 16px 4px; padding: 14px 16px; font-size: 14px; color: #1e293b; max-width: 88%; box-shadow: 0 2px 10px rgba(0,0,0,0.04); line-height: 1.5;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                        <b style="color: #db2777; display: flex; align-items: center; gap: 6px;">
                            <span>${charIcon}</span> ${botName}:
                        </b>
                    </div>
                    <div id="${botMsgId}"></div>
            `;

            if (data.imageUrl) {
                botMsgHtml += `<div class="media-box" style="margin-top: 10px;"><img src="${data.imageUrl}" class="chat-media-img" style="max-width: 100%; border-radius: 10px; border: 1px solid #fbcfe8;"></div>`;
            }

            botMsgHtml += `</div>`;
            messageBox.insertAdjacentHTML('beforeend', botMsgHtml);

            var textContainer = document.getElementById(botMsgId);
            if (textContainer) {
                typewriterEffect(textContainer, answerText, 14, function() {
                    renderNextOptions(data.nextQuestions, charIcon);
                });
            } else {
                renderNextOptions(data.nextQuestions, charIcon);
            }
        })
        .catch(function(err) {
            var typingEl = document.getElementById(typingId);
            if (typingEl) typingEl.remove();
            console.error('Lỗi gửi text-message:', err);
        });
    };

    // Render danh sách lựa chọn tiếp theo
    function renderNextOptions(nextQuestions, charIcon) {
        var optionsContainer = document.getElementById('options-container');
        if (!optionsContainer) return;

        if (nextQuestions && nextQuestions.length > 0) {
            var html = '<div style="font-size: 12px; font-weight: 700; color: #db2777; margin-bottom: 4px;">💡 Chọn câu hỏi tiếp theo:</div>';
            nextQuestions.forEach(function(q) {
                var qText = q.questionText || q.text || 'Câu hỏi tiếp theo';
                html += `
                    <button type="button" class="question-btn" onclick="sendQuestion('${q._id}', '${escapeQuotes(qText)}')" 
                        style="width: 100%; text-align: left; background: #fdf2f8; border: 1px solid #fbcfe8; padding: 10px 14px; border-radius: 10px; cursor: pointer; color: #db2777; font-weight: 600; font-size: 13px; margin-bottom: 4px; transition: transform 0.1s ease;"
                        onmouseover="this.style.background='#fce7f3'; this.style.transform='translateY(-1px)';"
                        onmouseout="this.style.background='#fdf2f8'; this.style.transform='none';">
                        ${charIcon || '💬'} ${escapeHtml(qText)}
                    </button>
                `;
            });
            optionsContainer.innerHTML = html;
        } else {
            optionsContainer.innerHTML = `
                <div style="text-align: center; padding: 6px;">
                    <p style="font-size: 13px; color: #64748b; margin: 0 0 8px 0;">🎉 Đã hoàn thành kịch bản hội thoại này!</p>
                    <button type="button" onclick="restartCurrentChat()" style="background: #22c55e; color: #fff; border: none; padding: 8px 18px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; box-shadow: 0 2px 6px rgba(34,197,94,0.25);">
                        🔄 Bắt đầu lại cuộc trò chuyện
                    </button>
                </div>
            `;
        }

        var messageBox = document.getElementById('message-box');
        if (messageBox) messageBox.scrollTop = messageBox.scrollHeight;
    }

    // --- 3. Làm mới / Khởi động lại cuộc trò chuyện ---
    window.restartCurrentChat = function() {
        var charIdInput = document.getElementById('character-id');
        if (!charIdInput) return;
        var charId = charIdInput.value;
        var charNameInput = document.getElementById('character-name');
        var botName = charNameInput ? charNameInput.value : 'Bot';
        var charIcon = document.getElementById('character-icon') ? document.getElementById('character-icon').value : '🤖';

        fetch('/chat/reset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ characterId: charId })
        })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            if (data.error) return;
            var messageBox = document.getElementById('message-box');
            if (messageBox) {
                messageBox.innerHTML = `
                    <div class="message bot" style="align-self: flex-start; background: #ffffff; border: 1px solid #fbcfe8; border-radius: 16px 16px 16px 4px; padding: 14px 16px; font-size: 14px; color: #1e293b; max-width: 88%; box-shadow: 0 2px 10px rgba(0,0,0,0.04); line-height: 1.5;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                            <b style="color: #db2777; display: flex; align-items: center; gap: 6px;">
                                <span>${charIcon}</span> ${botName}:
                            </b>
                        </div>
                        <div>${data.initialBotMessage}</div>
                    </div>
                `;
            }
            renderNextOptions(data.questions, charIcon);
        });
    };

    // --- 4. Bật / Tắt Game Mario song song ---
    window.toggleMarioSidePanel = function() {
        var sidePanel = document.getElementById('mario-side-panel');
        var chatMainCard = document.getElementById('chat-main-card');
        var btnToggle = document.getElementById('btn-toggle-mario-side');
        var chatLayoutWrapper = document.getElementById('chat-layout-wrapper');

        if (!sidePanel) return;

        if (sidePanel.style.display === 'none' || !sidePanel.style.display) {
            sidePanel.style.display = 'block';
            sidePanel.style.alignSelf = 'start'; // Khớp chiều cao thực tế, không bị giãn 82vh
            if (chatLayoutWrapper) {
                chatLayoutWrapper.classList.add('has-mario-side');
                chatLayoutWrapper.style.maxWidth = '1300px';
                chatLayoutWrapper.style.display = 'grid';
                if (window.innerWidth < 900) {
                    chatLayoutWrapper.style.gridTemplateColumns = '1fr';
                    chatLayoutWrapper.style.gap = '14px';
                } else {
                    chatLayoutWrapper.style.gridTemplateColumns = 'minmax(0, 1.25fr) minmax(380px, 1fr)';
                    chatLayoutWrapper.style.gap = '20px';
                }
                chatLayoutWrapper.style.alignItems = 'start'; // Không kéo giãn khoảng đen bên dưới
            }
            if (btnToggle) {
                btnToggle.innerHTML = '✖ Đóng Mario Game';
                btnToggle.style.background = '#fee2e2';
                btnToggle.style.color = '#dc2626';
                btnToggle.style.borderColor = '#fca5a5';
            }

            // Khởi tạo Game Mario nếu chưa khởi tạo (không gắn marioChatBridge để không làm mất đoạn hội thoại trong phòng chat)
            if (!window.marioSideGameInstance && window.MarioGame) {
                window.marioSideGameInstance = new window.MarioGame('mario-side-canvas');
            }

            // Cập nhật nhãn nút skin ban đầu
            if (window.marioSideGameInstance) {
                var skinBtn = document.getElementById('side-skin-btn');
                if (skinBtn && window.marioSideGameInstance.skin) {
                    if (window.marioSideGameInstance.skin === 'minecraft') {
                        skinBtn.innerHTML = '🟩 Minecraft';
                        skinBtn.style.background = '#065f46';
                        skinBtn.style.borderColor = '#10b981';
                        skinBtn.style.color = '#a7f3d0';
                    } else {
                        skinBtn.innerHTML = '🍄 Mario';
                        skinBtn.style.background = '#991b1b';
                        skinBtn.style.borderColor = '#f87171';
                        skinBtn.style.color = '#fecaca';
                    }
                }
            }

            // Tự động focus canvas để điều khiển ngay lập tức
            var sideCanvas = document.getElementById('mario-side-canvas');
            if (sideCanvas) {
                setTimeout(function() { sideCanvas.focus(); }, 50);
            }
        } else {
            sidePanel.style.display = 'none';
            if (chatLayoutWrapper) {
                chatLayoutWrapper.classList.remove('has-mario-side');
                chatLayoutWrapper.style.maxWidth = '680px';
                chatLayoutWrapper.style.display = 'block';
                chatLayoutWrapper.style.gridTemplateColumns = '';
            }
            if (btnToggle) {
                btnToggle.innerHTML = '🎮 Bật Mario Game';
                btnToggle.style.background = '#fef08a';
                btnToggle.style.color = '#854d0e';
                btnToggle.style.borderColor = '#facc15';
            }
        }
    };

    // Điều khiển Game Mario trên Side Panel
    window.toggleSideSkin = function() {
        if (!window.marioSideGameInstance && window.MarioGame) {
            window.marioSideGameInstance = new window.MarioGame('mario-side-canvas');
        }
        if (window.marioSideGameInstance) {
            var nextSkin = window.marioSideGameInstance.toggleSkin();
            var skinBtn = document.getElementById('side-skin-btn');
            if (skinBtn) {
                if (nextSkin === 'minecraft') {
                    skinBtn.innerHTML = '🟩 Minecraft';
                    skinBtn.style.background = '#065f46';
                    skinBtn.style.borderColor = '#10b981';
                    skinBtn.style.color = '#a7f3d0';
                } else {
                    skinBtn.innerHTML = '🍄 Mario';
                    skinBtn.style.background = '#991b1b';
                    skinBtn.style.borderColor = '#f87171';
                    skinBtn.style.color = '#fecaca';
                }
            }
            var sideCanvas = document.getElementById('mario-side-canvas');
            if (sideCanvas) sideCanvas.focus();
        }
    };

    window.restartSideMario = function() {
        if (window.marioSideGameInstance) {
            window.marioSideGameInstance.restart();
            var sideCanvas = document.getElementById('mario-side-canvas');
            if (sideCanvas) sideCanvas.focus();
        }
    };

    window.toggleSideAudio = function() {
        var audio = window.FlappyAudio || window.MarioAudio;
        if (audio) {
            audio.muted = !audio.muted;
            var audioBtn = document.getElementById('side-audio-btn');
            if (audioBtn) {
                audioBtn.innerHTML = audio.muted ? '🔇' : '🔊';
            }
        }
    };

    if (!window.toggleFullscreenMario) {
        window.toggleFullscreenMario = function(containerId) {
            containerId = containerId || 'mario-side-panel';
            var elem = document.getElementById(containerId);
            if (!elem) return;
            var isFs = document.fullscreenElement || document.webkitFullscreenElement;
            if (!isFs && !elem.classList.contains('is-mario-fullscreen')) {
                if (elem.requestFullscreen) {
                    elem.requestFullscreen().catch(function() { elem.classList.add('is-mario-fullscreen'); });
                } else if (elem.webkitRequestFullscreen) {
                    elem.webkitRequestFullscreen();
                } else {
                    elem.classList.add('is-mario-fullscreen');
                }
                elem.classList.add('is-mario-fullscreen');
                document.body.classList.add('in-mario-fullscreen-mode');
            } else {
                if (window.exitFullscreenMario) window.exitFullscreenMario(containerId);
            }
        };
    }

    window.triggerSideKey = function(keyName, isDown) {
        if (!window.marioSideGameInstance && window.MarioGame) {
            window.marioSideGameInstance = new window.MarioGame('mario-side-canvas');
        }
        if (window.marioSideGameInstance) {
            window.marioSideGameInstance.keys[keyName] = isDown;
            if (isDown) {
                if (typeof window.marioSideGameInstance.flap === 'function') {
                    window.marioSideGameInstance.flap();
                } else if (window.marioSideGameInstance.gameState === 'READY') {
                    window.marioSideGameInstance.gameState = 'PLAYING';
                }
            }
        }
    };

    // Tiện ích
    function getCurrentUserName() {
        var userEl = document.getElementById('nav-username-display');
        if (userEl && userEl.innerText && userEl.innerText.trim()) {
            return userEl.innerText.trim();
        }
        var match = document.cookie.match(new RegExp('(^| )chat_user=([^;]+)'));
        if (match) {
            return decodeURIComponent(match[2]);
        }
        return 'Bạn';
    }

    function escapeHtml(string) {
        return String(string).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function escapeQuotes(string) {
        return String(string).replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, ' ');
    }

})();
