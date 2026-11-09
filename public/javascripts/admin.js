/**
 * Admin Panel Enhancements:
 * - Advanced Avatar Studio (Click to upload, Drag & Drop, Preset Avatars, URL Input)
 * - Custom Icon Selector & Direct Input
 * - Live Script .txt Parsing & Preview
 * - Live Audio Player Preview
 */

window.initAdminEnhancements = function() {
    initAvatarStudio();
    initScriptPreview();
    initAudioPreview();
    initIconPicker();
    initDynamicNodes();
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.initAdminEnhancements);
} else {
    window.initAdminEnhancements();
}

// --- 1. AVATAR STUDIO: XEM TRƯỚC, TẢI ẢNH, CHỌN ẢNH MẪU & URL ---
function initAvatarStudio() {
    const avatarInput = document.getElementById('avatar-input');
    const avatarCircle = document.getElementById('avatar-circle-preview');
    const avatarImg = document.getElementById('avatar-preview-img');
    const avatarPlaceholder = document.getElementById('avatar-placeholder-icon');
    const avatarInfoText = document.getElementById('avatar-info-text');
    const btnRemoveAvatar = document.getElementById('btn-remove-avatar');
    const avatarUrlInput = document.getElementById('avatar-url-input');
    const avatarUrlField = document.getElementById('avatar-url-field');
    const iconInput = document.getElementById('iconInput');

    if (!avatarInput || !avatarImg) return;

    // Click vào hình tròn avatar để mở hộp thoại chọn file
    if (avatarCircle) {
        avatarCircle.addEventListener('click', function() {
            avatarInput.click();
        });

        // Hỗ trợ kéo & thả ảnh (Drag & Drop) trực tiếp vào vòng tròn Avatar
        avatarCircle.addEventListener('dragover', function(e) {
            e.preventDefault();
            this.style.borderColor = '#db2777';
            this.style.transform = 'scale(1.05)';
        });

        avatarCircle.addEventListener('dragleave', function(e) {
            e.preventDefault();
            this.style.borderColor = '#f472b6';
            this.style.transform = 'scale(1)';
        });

        avatarCircle.addEventListener('drop', function(e) {
            e.preventDefault();
            this.style.borderColor = '#f472b6';
            this.style.transform = 'scale(1)';
            const files = e.dataTransfer && e.dataTransfer.files;
            if (files && files.length > 0) {
                avatarInput.files = files;
                handleAvatarFileChange(files[0]);
            }
        });
    }

    // Khi người dùng chọn file từ máy tính
    avatarInput.addEventListener('change', function() {
        const file = this.files && this.files[0];
        if (file) {
            handleAvatarFileChange(file);
        }
    });

    function handleAvatarFileChange(file) {
        if (!file.type.startsWith('image/')) {
            alert('Vui lòng chọn tập tin hình ảnh hợp lệ (JPG, PNG, GIF, WebP)!');
            avatarInput.value = '';
            return;
        }

        const objectUrl = URL.createObjectURL(file);
        showImageInAvatar(objectUrl);

        if (avatarUrlInput) avatarUrlInput.value = '';
        if (avatarUrlField) avatarUrlField.value = '';
        if (avatarInfoText) {
            avatarInfoText.innerHTML = `<span style="color:#15803d; font-weight:700;">✓ Tải từ máy:</span> ${escapeHtml(file.name)} (${formatBytes(file.size)})`;
        }
        if (btnRemoveAvatar) btnRemoveAvatar.style.display = 'inline-block';
    }

    // Nhập URL ảnh trực tiếp
    if (avatarUrlField) {
        avatarUrlField.addEventListener('input', function() {
            const url = this.value.trim();
            if (url) {
                avatarInput.value = ''; // Xóa file upload nếu dùng link
                if (avatarUrlInput) avatarUrlInput.value = url;
                showImageInAvatar(url);
                if (avatarInfoText) {
                    avatarInfoText.innerHTML = `<span style="color:#2563eb; font-weight:700;">✓ Dùng liên kết online:</span> Link ảnh`;
                }
                if (btnRemoveAvatar) btnRemoveAvatar.style.display = 'inline-block';
            } else {
                resetAvatarToDefault();
            }
        });
    }

    // Nút gỡ ảnh / quay về mặc định
    if (btnRemoveAvatar) {
        btnRemoveAvatar.addEventListener('click', function(e) {
            e.stopPropagation();
            resetAvatarToDefault();
        });
    }

    function showImageInAvatar(src) {
        avatarImg.src = src;
        avatarImg.style.display = 'block';
        if (avatarPlaceholder) avatarPlaceholder.style.display = 'none';
    }

    function resetAvatarToDefault() {
        avatarInput.value = '';
        if (avatarUrlInput) avatarUrlInput.value = '';
        if (avatarUrlField) avatarUrlField.value = '';
        avatarImg.src = '';
        avatarImg.style.display = 'none';
        if (avatarPlaceholder) {
            avatarPlaceholder.style.display = 'flex';
            // Cập nhật icon theo ô nhập icon hiện tại
            const currentIcon = (iconInput && iconInput.value.trim()) ? iconInput.value.trim() : '🍄';
            avatarPlaceholder.innerText = currentIcon;
        }
        if (avatarInfoText) {
            avatarInfoText.innerHTML = '<span style="color:#64748b;">Chưa chọn ảnh (Dùng icon mặc định)</span>';
        }
        if (btnRemoveAvatar) btnRemoveAvatar.style.display = 'none';
    }

    // Cho phép gọi reset từ bên ngoài
    window.resetAvatarToDefault = resetAvatarToDefault;

    // Hàm chọn Avatar mẫu có sẵn
    window.selectPresetAvatar = function(url, title) {
        avatarInput.value = '';
        if (avatarUrlInput) avatarUrlInput.value = url;
        if (avatarUrlField) avatarUrlField.value = url;
        showImageInAvatar(url);
        if (avatarInfoText) {
            avatarInfoText.innerHTML = `<span style="color:#d97706; font-weight:700;">✓ Ảnh mẫu:</span> ${title}`;
        }
        if (btnRemoveAvatar) btnRemoveAvatar.style.display = 'inline-block';
    };
}

// --- 2. QUẢN LÝ KỊCH BẢN: SOẠN TRỰC TIẾP TRÊN WEB (CHO ĐIỆN THOẠI) HOẶC TẢI FILE .TXT ---
function initScriptPreview() {
    const scriptInput = document.getElementById('script-input');
    const directEditor = document.getElementById('script-direct-editor');
    const scriptPreviewWrapper = document.getElementById('script-preview-wrapper');
    const scriptPreviewStats = document.getElementById('script-preview-stats');
    const scriptPreviewContent = document.getElementById('script-preview-content');
    const btnToggleRawScript = document.getElementById('btn-toggle-raw-script');
    const scriptRawContent = document.getElementById('script-raw-content');
    const charCountEl = document.getElementById('script-char-count');
    const scriptFileLabel = document.getElementById('script-file-name-label');

    // Chuyển đổi giữa 2 chế độ: Soạn trực tiếp (Điện thoại) và Tải file (Máy tính)
    window.switchScriptMode = function(mode) {
        const tabDirect = document.getElementById('tab-script-direct');
        const tabFile = document.getElementById('tab-script-file');
        const panelDirect = document.getElementById('script-mode-direct-panel');
        const panelFile = document.getElementById('script-mode-file-panel');

        if (mode === 'direct') {
            if (panelDirect) panelDirect.style.display = 'block';
            if (panelFile) panelFile.style.display = 'none';
            if (tabDirect) {
                tabDirect.style.border = '2px solid #22c55e';
                tabDirect.style.background = '#f0fdf4';
                tabDirect.style.color = '#166534';
                tabDirect.style.boxShadow = '0 2px 6px rgba(34,197,94,0.15)';
            }
            if (tabFile) {
                tabFile.style.border = '2px solid #cbd5e1';
                tabFile.style.background = '#f8fafc';
                tabFile.style.color = '#64748b';
                tabFile.style.boxShadow = 'none';
            }
            if (directEditor && directEditor.value.trim()) {
                renderScriptPreview(directEditor.value, 'Soạn trực tiếp trên web (Điện thoại)', new Blob([directEditor.value]).size);
            }
        } else {
            if (panelDirect) panelDirect.style.display = 'none';
            if (panelFile) panelFile.style.display = 'block';
            if (tabFile) {
                tabFile.style.border = '2px solid #3b82f6';
                tabFile.style.background = '#eff6ff';
                tabFile.style.color = '#1d4ed8';
                tabFile.style.boxShadow = '0 2px 6px rgba(59,130,246,0.15)';
            }
            if (tabDirect) {
                tabDirect.style.border = '2px solid #cbd5e1';
                tabDirect.style.background = '#f8fafc';
                tabDirect.style.color = '#64748b';
                tabDirect.style.boxShadow = 'none';
            }
            if (scriptInput && scriptInput.files && scriptInput.files[0]) {
                const file = scriptInput.files[0];
                const reader = new FileReader();
                reader.onload = function(e) {
                    renderScriptPreview(e.target.result, file.name, file.size);
                };
                reader.readAsText(file);
            }
        }
    };

    // Chèn ký tự / cú pháp nhanh vào vị trí con trỏ
    window.insertScriptToken = function(token) {
        if (!directEditor) return;
        const start = directEditor.selectionStart;
        const end = directEditor.selectionEnd;
        const text = directEditor.value;
        const before = text.substring(0, start);
        const after = text.substring(end, text.length);

        // Đảm bảo dòng mới nếu cần
        let insertText = token;
        if ((token === 'Q: ' || token === 'A: ') && start > 0 && text[start - 1] !== '\n') {
            insertText = '\n' + token;
        }

        directEditor.value = before + insertText + after;
        directEditor.selectionStart = directEditor.selectionEnd = start + insertText.length;
        directEditor.focus();
        directEditor.dispatchEvent(new Event('input', { bubbles: true }));
    };

    // Chèn kịch bản mẫu chuẩn
    window.insertSampleScript = function() {
        if (!directEditor) return;
        const sample = `Q: Xin chào bạn! Rất vui được gặp bạn!
Q: Giới thiệu về bạn đi!
A: Chào bạn yêu quý! Mình là người bạn đồng hành luôn sẵn sàng trò chuyện cùng bạn đây!
---
Q: Hôm nay bạn cảm thấy thế nào?
Q: Có điều gì vui muốn chia sẻ không?
A: Hôm nay là một ngày tuyệt vời! Hãy cùng nhau khám phá những điều thú vị và cùng chơi game nhé!
---
Q: Bạn có thể giúp gì cho mình?
A: Mình luôn lắng nghe bạn tâm sự, cùng chơi game Flappy Bangboo và gửi gắm những tấm thiệp tốt nghiệp ấm áp!`;
        directEditor.value = sample;
        directEditor.focus();
        directEditor.dispatchEvent(new Event('input', { bubbles: true }));
    };

    // Xóa trắng kịch bản
    window.clearDirectScript = function() {
        if (!directEditor) return;
        if (directEditor.value.trim() && !confirm('Bạn có chắc muốn xóa trắng ô kịch bản đang soạn không?')) {
            return;
        }
        directEditor.value = '';
        directEditor.dispatchEvent(new Event('input', { bubbles: true }));
        if (scriptPreviewWrapper) scriptPreviewWrapper.style.display = 'none';
    };

    // Lắng nghe người dùng gõ trực tiếp trong Textarea
    if (directEditor) {
        directEditor.addEventListener('input', function() {
            const val = this.value;
            if (charCountEl) {
                charCountEl.innerText = val.length + ' ký tự';
            }
            if (val.trim()) {
                renderScriptPreview(val, 'Soạn trực tiếp trên web (Điện thoại)', new Blob([val]).size);
            } else {
                if (scriptPreviewWrapper) scriptPreviewWrapper.style.display = 'none';
            }
        });

        // Nếu đã có sẵn nội dung (VD trang chỉnh sửa EditCharacter)
        if (directEditor.value && directEditor.value.trim()) {
            if (charCountEl) {
                charCountEl.innerText = directEditor.value.length + ' ký tự';
            }
            renderScriptPreview(directEditor.value, 'Kịch bản hiện tại', new Blob([directEditor.value]).size);
        }
    }

    // Khi người dùng chọn file .txt từ máy
    if (scriptInput) {
        scriptInput.addEventListener('change', function() {
            const file = this.files && this.files[0];
            if (file) {
                if (!file.name.endsWith('.txt')) {
                    alert('Vui lòng chọn đúng file văn bản định dạng .txt!');
                    this.value = '';
                    if (scriptFileLabel) scriptFileLabel.innerText = 'Bấm để chọn file kịch bản .txt từ máy tính';
                    return;
                }

                if (scriptFileLabel) {
                    scriptFileLabel.innerText = '✓ Đã chọn file: ' + file.name + ' (' + formatBytes(file.size) + ')';
                }

                const reader = new FileReader();
                reader.onload = function(e) {
                    const text = e.target.result;
                    renderScriptPreview(text, file.name, file.size);
                    // Đồng bộ sang direct editor nếu đang rỗng
                    if (directEditor && !directEditor.value.trim()) {
                        directEditor.value = text;
                        if (charCountEl) charCountEl.innerText = text.length + ' ký tự';
                    }
                };
                reader.readAsText(file);
            } else {
                if (scriptFileLabel) scriptFileLabel.innerText = 'Bấm để chọn file kịch bản .txt từ máy tính';
            }
        });
    }

    // Tự động kích hoạt chế độ "Soạn trực tiếp trên web (Điện thoại)" trên màn hình mobile
    if (window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)) {
        window.switchScriptMode('direct');
    } else {
        window.switchScriptMode('direct');
    }

    // Render xem trước kịch bản
    function renderScriptPreview(rawText, sourceName, fileSize) {
        if (!scriptPreviewWrapper) return;
        if (!rawText || !rawText.trim()) {
            scriptPreviewWrapper.style.display = 'none';
            return;
        }

        scriptPreviewWrapper.style.display = 'block';
        const rawBlocks = rawText.split('---').map(b => b.trim()).filter(b => b.length > 0);

        let totalQuestions = 0;
        let totalAnswers = 0;
        let formattedBlocksHtml = '';

        rawBlocks.forEach((blockText, idx) => {
            const lines = blockText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            let questions = [];
            let answer = '';

            lines.forEach(line => {
                if (line.startsWith('Q:')) {
                    questions.push(line.substring(2).trim());
                    totalQuestions++;
                } else if (line.startsWith('A:')) {
                    answer = line.substring(2).trim();
                    totalAnswers++;
                }
            });

            formattedBlocksHtml += `
                <div class="script-block-card" style="background: #ffffff; border: 1.5px solid #fbcfe8; border-radius: 12px; padding: 12px; margin-bottom: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
                    <div style="font-size: 12px; font-weight: 800; color: #db2777; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
                        <span style="display: flex; align-items: center; gap: 6px;">
                            <span style="background: #fdf2f8; border: 1px solid #fbcfe8; padding: 2px 8px; border-radius: 8px;">Bước ${idx + 1}</span>
                            <span>Khối hội thoại ${idx + 1}</span>
                        </span>
                        <span style="color: #64748b; font-size: 11px; font-weight: 600;">${questions.length} câu hỏi lựa chọn</span>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 5px; margin-bottom: 8px;">
                        ${questions.map(q => `
                            <div style="font-size: 13px; color: #1e293b; background: #fdf2f8; padding: 6px 10px; border-radius: 8px; border-left: 3px solid #f472b6; display: flex; align-items: center; gap: 6px;">
                                <span style="font-size: 11px; background: #f472b6; color: #fff; padding: 1px 6px; border-radius: 6px; font-weight: 800;">Q</span>
                                <span>${escapeHtml(q)}</span>
                            </div>
                        `).join('')}
                    </div>
                    <div style="font-size: 13px; color: #15803d; background: #f0fdf4; padding: 8px 12px; border-radius: 8px; border-left: 3px solid #22c55e;">
                        <div style="font-size: 11px; font-weight: 800; color: #16a34a; margin-bottom: 2px; display: flex; align-items: center; gap: 4px;">
                            <span>🤖</span> <span>Bot trả lời khi người dùng bấm các câu hỏi trên:</span>
                        </div>
                        <div>${answer ? escapeHtml(answer) : '<i style="color:#94a3b8">Chưa có câu trả lời (A:)</i>'}</div>
                    </div>
                </div>
            `;
        });

        if (scriptPreviewStats) {
            scriptPreviewStats.innerHTML = `
                <span>📝 <b>${sourceName}</b> (${formatBytes(fileSize)})</span>
                <span>• <b>${rawBlocks.length}</b> bước</span>
                <span>• <b>${totalQuestions}</b> câu hỏi</span>
                <span>• <b>${totalAnswers}</b> phản hồi</span>
            `;
        }

        if (scriptPreviewContent) {
            scriptPreviewContent.innerHTML = formattedBlocksHtml || '<p style="color: #64748b; font-size: 13px;">Gõ câu hỏi (Q:) và câu trả lời (A:) để xem trước trực quan tại đây.</p>';
        }

        if (scriptRawContent) {
            scriptRawContent.value = rawText;
        }
    }

    if (btnToggleRawScript && scriptRawContent && scriptPreviewContent) {
        let isRaw = false;
        btnToggleRawScript.addEventListener('click', function() {
            isRaw = !isRaw;
            if (isRaw) {
                scriptRawContent.style.display = 'block';
                scriptPreviewContent.style.display = 'none';
                btnToggleRawScript.innerText = '📋 Xem dạng cấu trúc trực quan';
            } else {
                scriptRawContent.style.display = 'none';
                scriptPreviewContent.style.display = 'block';
                btnToggleRawScript.innerText = '📝 Xem mã text gốc';
            }
        });
    }

    // Kiểm tra hợp lệ kịch bản khi submit form
    const forms = document.querySelectorAll('form[action="/admin/character/add-full"], form[action^="/admin/character/update/"]');
    forms.forEach(form => {
        form.addEventListener('submit', function(e) {
            const hasDirectText = directEditor && directEditor.value.trim().length > 0;
            const hasFile = scriptInput && scriptInput.files && scriptInput.files.length > 0;
            const isUpdateForm = form.action.includes('/update/');

            // Với form thêm mới: bắt buộc phải có kịch bản (soạn trực tiếp hoặc file)
            if (!isUpdateForm && !hasDirectText && !hasFile) {
                e.preventDefault();
                alert('⚠️ Vui lòng soạn kịch bản hội thoại hoặc tải lên file kịch bản (.txt) cho nhân vật!');
                if (window.switchScriptMode) window.switchScriptMode('direct');
                if (directEditor) directEditor.focus();
                return false;
            }
        });
    });
}

// --- 3. XEM TRƯỚC & NGHE THỬ ÂM THANH (AUDIO PREVIEW) ---
function initAudioPreview() {
    setupSingleAudioPreview('audio-input', 'audio-preview-player', 'audio-preview-wrapper', 'audio-file-name', 'btn-remove-audio');
}

function setupSingleAudioPreview(inputId, playerId, wrapperId, nameId, removeBtnId) {
    const input = document.getElementById(inputId);
    const player = document.getElementById(playerId);
    const wrapper = document.getElementById(wrapperId);
    const nameLabel = document.getElementById(nameId);
    const removeBtn = document.getElementById(removeBtnId);
    const pickerLabel = document.getElementById('audio-picker-label');
    const pickerBtn = document.getElementById('audio-picker-btn');

    if (!input || !player) return;

    input.addEventListener('change', function() {
        const file = this.files && this.files[0];
        if (file) {
            if (!file.type.startsWith('audio/') && !file.name.match(/\.(mp3|wav|ogg|m4a|aac|opus)$/i)) {
                alert('Vui lòng chọn file âm thanh hợp lệ (MP3, WAV, OGG, M4A)!');
                this.value = '';
                if (pickerLabel) pickerLabel.innerText = 'Chạm để chọn file âm thanh từ điện thoại / máy tính (.mp3, .wav, .m4a)';
                return;
            }
            const objectUrl = URL.createObjectURL(file);
            player.src = objectUrl;
            if (nameLabel) nameLabel.innerText = file.name + ' (' + formatBytes(file.size) + ')';
            if (pickerLabel) {
                pickerLabel.innerText = '✓ Đã chọn: ' + file.name + ' (' + formatBytes(file.size) + ')';
            }
            if (pickerBtn) {
                pickerBtn.style.borderColor = '#22c55e';
                pickerBtn.style.background = '#f0fdf4';
                pickerBtn.style.color = '#15803d';
            }
            if (wrapper) wrapper.style.display = 'block';
        }
    });

    if (removeBtn) {
        removeBtn.addEventListener('click', function() {
            input.value = '';
            player.src = '';
            if (pickerLabel) {
                pickerLabel.innerText = 'Chạm để chọn file âm thanh từ điện thoại / máy tính (.mp3, .wav, .m4a)';
            }
            if (pickerBtn) {
                pickerBtn.style.borderColor = '#f472b6';
                pickerBtn.style.background = '#fff5f8';
                pickerBtn.style.color = '#db2777';
            }
            if (wrapper) wrapper.style.display = 'none';
        });
    }
}

// --- 4. TÙY CHỈNH ICON (CUSTOM ICON & PICKER - THÊM & XÓA ICON) ---
const DEFAULT_PICKER_ICONS = ['🎮', '🍄', '⭐', '💻', '🧳', '🌿', '🍳', '⚔️', '⛏️', '🧙‍♂️', '🐱', '🌸', '💎', '📜', '🤖', '👑', '🔮', '🧸', '⚡', '🔥'];
let currentPickerIcons = [...DEFAULT_PICKER_ICONS];
let isIconDeleteMode = false;

function initIconPicker() {
    const iconInput = document.getElementById('iconInput');
    const iconDisplayLarge = document.getElementById('icon-display-large');
    const avatarPlaceholder = document.getElementById('avatar-placeholder-icon');
    const avatarImg = document.getElementById('avatar-preview-img');

    if (iconInput) {
        iconInput.addEventListener('input', function() {
            this.dataset.userEdited = 'true';
            updateIconDisplay(this.value);
        });
    }

    function updateIconDisplay(val) {
        const cleanVal = val.trim();
        if (iconDisplayLarge) {
            iconDisplayLarge.innerText = cleanVal || '❓';
        }
        if (avatarPlaceholder && (!avatarImg || avatarImg.style.display === 'none')) {
            avatarPlaceholder.innerText = cleanVal || '❓';
        }
    }

    // Nạp danh sách icons từ server hoặc localStorage
    loadAdminIcons();
}

function syncSelectedIconIfDeleted() {
    const iconInput = document.getElementById('iconInput');
    if (!iconInput) return;

    // Không can thiệp nếu là trang sửa nhân vật cũ có icon riêng
    const isEditPage = !!document.querySelector('form[action*="/admin/character/update"]');
    if (isEditPage) return;

    const currentVal = iconInput.value.trim();
    // Nếu icon trong ô nhập không có trong bảng (ví dụ icon tay cầm đã bị xóa) và người dùng chưa gõ tay emoji khác
    if (!currentPickerIcons.includes(currentVal) && currentPickerIcons.length > 0) {
        selectCommonIcon(currentPickerIcons[0]);
    }
}

function loadAdminIcons() {
    // 1. Kiểm tra localStorage trước để hiện ngay tức thì
    const cached = localStorage.getItem('chatflex_admin_icons');
    if (cached) {
        try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
                currentPickerIcons = parsed;
                renderIconPickerList();
                syncSelectedIconIfDeleted();
            }
        } catch (e) {}
    }

    // 2. Đồng bộ từ Server MongoDB
    fetch('/admin/api/icons')
        .then(res => res.json())
        .then(data => {
            if (data.success && Array.isArray(data.icons) && data.icons.length > 0) {
                currentPickerIcons = data.icons;
                localStorage.setItem('chatflex_admin_icons', JSON.stringify(currentPickerIcons));
                renderIconPickerList();
                syncSelectedIconIfDeleted();
            } else if (!cached) {
                renderIconPickerList();
            }
        })
        .catch(() => {
            if (!cached) renderIconPickerList();
        });
}

function renderIconPickerList() {
    const container = document.getElementById('common-icon-picker-list');
    if (!container) return;

    if (currentPickerIcons.length === 0) {
        container.innerHTML = '<span style="font-size: 12px; color: #94a3b8; padding: 4px 8px;">Chưa có icon nào trong bảng. Hãy bấm "🔍 Tìm & Thêm icon" để thêm emoji!</span>';
        return;
    }

    container.innerHTML = currentPickerIcons.map(emoji => {
        const safeEmoji = escapeHtml(emoji);
        if (isIconDeleteMode) {
            return `
                <div style="position: relative; display: inline-block;">
                    <button type="button" onclick="deletePickerIcon('${safeEmoji}')" 
                        title="Bấm để xóa icon ${safeEmoji}"
                        style="font-size: 18px; cursor: pointer; background: #fee2e2; border: 1.5px solid #f87171; border-radius: 8px; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; position: relative; transition: all 0.15s ease;">
                        ${safeEmoji}
                        <span style="position: absolute; top: -5px; right: -5px; background: #dc2626; color: #fff; width: 14px; height: 14px; border-radius: 50%; font-size: 9px; font-weight: bold; display: flex; align-items: center; justify-content: center; line-height: 1;">✕</span>
                    </button>
                </div>
            `;
        } else {
            return `
                <button type="button" onclick="selectCommonIcon('${safeEmoji}')" 
                    title="Chọn icon ${safeEmoji}"
                    style="font-size: 18px; cursor: pointer; background: #fdf2f8; border: 1px solid #fbcfe8; border-radius: 8px; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; transition: transform 0.1s ease, background 0.15s ease;"
                    onmouseover="this.style.transform='scale(1.2)'; this.style.background='#fce7f3';"
                    onmouseout="this.style.transform='scale(1)'; this.style.background='#fdf2f8';">
                    ${safeEmoji}
                </button>
            `;
        }
    }).join('');
}

function selectCommonIcon(emoji) {
    const iconInput = document.getElementById('iconInput');
    const iconDisplayLarge = document.getElementById('icon-display-large');
    const avatarPlaceholder = document.getElementById('avatar-placeholder-icon');
    const avatarImg = document.getElementById('avatar-preview-img');

    if (iconInput) {
        iconInput.value = emoji;
        iconInput.dataset.userEdited = 'true';
    }
    if (iconDisplayLarge) iconDisplayLarge.innerText = emoji || '❓';
    if (avatarPlaceholder && (!avatarImg || avatarImg.style.display === 'none')) {
        avatarPlaceholder.innerText = emoji || '❓';
    }
}

function selectIcon(emoji) {
    selectCommonIcon(emoji);
}

function addCurrentInputToIconList() {
    const iconInput = document.getElementById('iconInput');
    const emoji = iconInput ? iconInput.value.trim() : '';
    if (!emoji) {
        alert('Vui lòng gõ hoặc chọn một emoji vào ô nhập trước khi thêm!');
        return;
    }
    addNewPickerIcon(emoji);
}

function addNewPickerIcon(emoji) {
    if (!emoji) return;
    if (currentPickerIcons.includes(emoji)) {
        selectCommonIcon(emoji);
        return;
    }
    currentPickerIcons.push(emoji);
    savePickerIcons();
    selectCommonIcon(emoji);
}

function deletePickerIcon(emoji) {
    const idx = currentPickerIcons.indexOf(emoji);
    if (idx !== -1) {
        currentPickerIcons.splice(idx, 1);
        savePickerIcons();

        // NẾU ICON BỊ XÓA ĐANG ĐƯỢC CHỌN Ở Ô NHẬP VÀ XEM TRƯỚC:
        const iconInput = document.getElementById('iconInput');
        if (iconInput && iconInput.value.trim() === emoji) {
            const nextEmoji = currentPickerIcons.length > 0 ? currentPickerIcons[0] : '';
            selectCommonIcon(nextEmoji);
        }
    }
}

function toggleIconDeleteMode() {
    isIconDeleteMode = !isIconDeleteMode;
    const btn = document.getElementById('btn-toggle-delete-icon');
    if (btn) {
        if (isIconDeleteMode) {
            btn.innerHTML = '✅ Xong';
            btn.style.background = '#dcfce7';
            btn.style.color = '#15803d';
            btn.style.borderColor = '#86efac';
        } else {
            btn.innerHTML = '🗑️ Xóa icon';
            btn.style.background = '#fee2e2';
            btn.style.color = '#dc2626';
            btn.style.borderColor = '#fca5a5';
        }
    }
    renderIconPickerList();
}

function savePickerIcons() {
    localStorage.setItem('chatflex_admin_icons', JSON.stringify(currentPickerIcons));
    renderIconPickerList();

    // Lưu đồng bộ lên MongoDB qua API
    fetch('/admin/api/icons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ icons: currentPickerIcons })
    }).catch(function(err) {
        console.warn('Không thể đồng bộ icon lên server:', err);
    });
}

// --- KHO EMOJI TÌM KIẾM TRỰC TIẾP & BỘ SƯU TẬP PHONG PHÚ ---
const EMOJI_CATALOG = [
    // Game & Retro & Vũ khí
    { emoji: '🎮', name: 'tay cam game choi dien tu console video game', cat: 'game' },
    { emoji: '🕹️', name: 'can gat joystick retro arcade game', cat: 'game' },
    { emoji: '👾', name: 'quai vat alien space invader pixel retro', cat: 'game' },
    { emoji: '🍄', name: 'nam mario mushroom super 1up red', cat: 'game' },
    { emoji: '⭐', name: 'sao star vang mario invincible bat tu', cat: 'game' },
    { emoji: '🌟', name: 'sao lap lanh glowing star toa sang', cat: 'game' },
    { emoji: '✨', name: 'lap lanh sparkles phep thuat magic blink', cat: 'game' },
    { emoji: '⚡', name: 'set tia set lightning zap pikachu dien', cat: 'game' },
    { emoji: '🔥', name: 'lua fire flame hoa cau lua', cat: 'game' },
    { emoji: '💥', name: 'no boom explosion bup', cat: 'game' },
    { emoji: '⚔️', name: 'kiem vu khi swords combat chien dau song kiem', cat: 'game' },
    { emoji: '🗡️', name: 'dao gam dagger sword vu khi', cat: 'game' },
    { emoji: '🏹', name: 'cung ten bow arrow minecraft skeleton', cat: 'game' },
    { emoji: '🛡️', name: 'khien giap shield phong thu bao ve', cat: 'game' },
    { emoji: '⛏️', name: 'cup cuoc dao pickaxe minecraft steve khoang san', cat: 'game' },
    { emoji: '🔨', name: 'bua hammer tho sua chua', cat: 'game' },
    { emoji: '💎', name: 'kim cuong diamond gem quy bao vat', cat: 'game' },
    { emoji: '👑', name: 'vuong mien crown vua cong chua peach king quyen luc', cat: 'game' },
    { emoji: '🔮', name: 'qua cau pha le crystal ball tien tri phap su phep', cat: 'fantasy' },
    { emoji: '📜', name: 'cuon giay scroll kich ban thu phap mat thu', cat: 'fantasy' },
    { emoji: '🧙‍♂️', name: 'phap su phu thuy wizard mage magic phu thuy', cat: 'fantasy' },
    { emoji: '🧝', name: 'yeu tinh elf cung thu tien toc', cat: 'fantasy' },
    { emoji: '🧞', name: 'than den genie uoc nguyen phep mau', cat: 'fantasy' },
    { emoji: '🧜', name: 'nguoi ca mermaid duoi ca', cat: 'fantasy' },
    { emoji: '🤖', name: 'robot nguoi may ai bot mecha', cat: 'game' },
    { emoji: '🚀', name: 'ten lua rocket vu tru bay', cat: 'game' },
    { emoji: '🛸', name: 'dia bay ufo alien ngoai hanh tinh', cat: 'game' },
    { emoji: '🏆', name: 'cup vo dich trophy winner chien thang', cat: 'game' },
    { emoji: '🎯', name: 'bia ban target phi tieu chinh xac', cat: 'game' },
    { emoji: '🎲', name: 'xuc xac dice roll game may man', cat: 'game' },
    { emoji: '💻', name: 'laptop may tinh macbook code dev tin hoc', cat: 'game' },
    { emoji: '🧳', name: 'vali hanh ly du lich luggage travel phuot', cat: 'game' },
    { emoji: '🪙', name: 'dong xu coin mario gold tien vang tien xu', cat: 'game' },
    { emoji: '💰', name: 'tui tien money bag dola giau co tien bac', cat: 'game' },

    // Thú cưng & Động vật
    { emoji: '🐱', name: 'meo cat meow kitten con meo meo de thuong', cat: 'animals' },
    { emoji: '😸', name: 'meo cuoi cat grin mieng cuoi', cat: 'animals' },
    { emoji: '😻', name: 'meo yeu cat love heart eyes mat tim', cat: 'animals' },
    { emoji: '🐰', name: 'tho rabbit bunny con tho tho bay mau tai dai', cat: 'animals' },
    { emoji: '🦊', name: 'cao fox con cao tinh ranh', cat: 'animals' },
    { emoji: '🐼', name: 'gau truc panda bear truc trung quoc', cat: 'animals' },
    { emoji: '🐨', name: 'gau koala uc de thuong', cat: 'animals' },
    { emoji: '🐹', name: 'hamster chuot chuot tui', cat: 'animals' },
    { emoji: '🐶', name: 'cho dog puppy cun con pet gau gau', cat: 'animals' },
    { emoji: '🐻', name: 'gau bear teddy gau nau', cat: 'animals' },
    { emoji: '🦁', name: 'su tu lion rung xanh chúa son lam', cat: 'animals' },
    { emoji: '🐯', name: 'ho tiger cop chua son lam', cat: 'animals' },
    { emoji: '🐮', name: 'bo cow sua be de thuong', cat: 'animals' },
    { emoji: '🐷', name: 'heo pig lon con mui heo u in', cat: 'animals' },
    { emoji: '🐸', name: 'ech frog toad ech xanh pepe', cat: 'animals' },
    { emoji: '🐵', name: 'khi monkey ngo nghinh', cat: 'animals' },
    { emoji: '🐔', name: 'ga chicken con ga trong o o o', cat: 'animals' },
    { emoji: '🐧', name: 'canh cut penguin chim nam cuc', cat: 'animals' },
    { emoji: '🦆', name: 'vit duck con vit quack', cat: 'animals' },
    { emoji: '🦄', name: 'ky lan unicorn cau vong phep thuat', cat: 'fantasy' },
    { emoji: '🦋', name: 'buom butterfly xinh buom buom bay', cat: 'animals' },
    { emoji: '🐝', name: 'ong bee mat ong cham chi', cat: 'animals' },
    { emoji: '🐞', name: 'bo rua ladybug may man', cat: 'animals' },
    { emoji: '🐢', name: 'rua turtle koopa mario mai rua cham chap', cat: 'animals' },
    { emoji: '🐍', name: 'ran snake bo sat', cat: 'animals' },
    { emoji: '🐙', name: 'bach tuoc octopus bien sau', cat: 'animals' },
    { emoji: '🐬', name: 'ca heo dolphin thong minh', cat: 'animals' },
    { emoji: '🐳', name: 'ca voi whale phun nuoc', cat: 'animals' },
    { emoji: '🦈', name: 'ca map shark hung du', cat: 'animals' },
    { emoji: '🐉', name: 'rong dragon bowser rong than', cat: 'fantasy' },
    { emoji: '🦖', name: 'khung long t-rex yoshi mario bao chua', cat: 'animals' },

    // Cây cỏ & Hoa quả
    { emoji: '🌸', name: 'hoa cherry blossom anh dao pink hong nhat ban', cat: 'nature' },
    { emoji: '🌺', name: 'hoa hibiscus dam but do nhiet doi', cat: 'nature' },
    { emoji: '🌻', name: 'hoa huong duong sunflower mat troi vang', cat: 'nature' },
    { emoji: '🌹', name: 'hoa hong rose love tinh yeu do', cat: 'nature' },
    { emoji: '🌷', name: 'hoa tulip ha lan', cat: 'nature' },
    { emoji: '🌼', name: 'hoa cuc daisy vang trang', cat: 'nature' },
    { emoji: '🌱', name: 'mam cay seedling mam xanh bat dau', cat: 'nature' },
    { emoji: '🌿', name: 'la cay herb la xanh cay thien nhien', cat: 'nature' },
    { emoji: '🍀', name: 'co 4 la four leaf clover may man clover', cat: 'nature' },
    { emoji: '🍁', name: 'la phong maple leaf mua thu do', cat: 'nature' },
    { emoji: '🍂', name: 'la rung fallen leaf mua thu', cat: 'nature' },
    { emoji: '🍓', name: 'dau tay strawberry trai cay ngot do', cat: 'nature' },
    { emoji: '🍑', name: 'dao peach cong chua qua dao hong', cat: 'nature' },
    { emoji: '🍒', name: 'cherry qua anh dao do doi cherry', cat: 'nature' },
    { emoji: '🍎', name: 'tao red apple trai tao do', cat: 'nature' },
    { emoji: '🍉', name: 'dua hau watermelon mat lanh', cat: 'nature' },
    { emoji: '🍇', name: 'nho grapes trai nho tim', cat: 'nature' },
    { emoji: '🍋', name: 'chanh lemon vang chua', cat: 'nature' },
    { emoji: '🍌', name: 'chuoi banana vang khi thich', cat: 'nature' },
    { emoji: '🍍', name: 'dua thom pineapple mat troi', cat: 'nature' },
    { emoji: '🥭', name: 'xoai mango thom ngon', cat: 'nature' },
    { emoji: '🥑', name: 'bo avocado qua bo xanh', cat: 'nature' },
    { emoji: '🌈', name: 'cau vong rainbow may troi 7 mau', cat: 'nature' },
    { emoji: '☀️', name: 'mat troi sun ngay nang toa sang', cat: 'nature' },
    { emoji: '🌙', name: 'mat trang moon dem trăng trang luoi liem', cat: 'nature' },

    // Ẩm thực & Đồ ăn
    { emoji: '🍔', name: 'burger hamburger banh mi bo fastfood', cat: 'food' },
    { emoji: '🍟', name: 'khoai tay chien french fries gion', cat: 'food' },
    { emoji: '🍕', name: 'pizza banh pizza y cheese pho mai', cat: 'food' },
    { emoji: '🌭', name: 'xuc xich hotdog banh mi', cat: 'food' },
    { emoji: '🥪', name: 'sandwich banh mi kep bua sang', cat: 'food' },
    { emoji: '🍳', name: 'trung op la fried egg chao bua sang', cat: 'food' },
    { emoji: '🍜', name: 'mi ramen mi goi noodle nong hoi', cat: 'food' },
    { emoji: '🍝', name: 'my y spaghetti pasta sot ca', cat: 'food' },
    { emoji: '🍣', name: 'sushi com cuon nhat ban ca hoi', cat: 'food' },
    { emoji: '🍦', name: 'kem ice cream oc que kem mat lanh', cat: 'food' },
    { emoji: '🍧', name: 'da bao shaved ice siro', cat: 'food' },
    { emoji: '🍩', name: 'banh donut banh ran doraemon ngot', cat: 'food' },
    { emoji: '🍪', name: 'banh quy cookie quy gung socola', cat: 'food' },
    { emoji: '🎂', name: 'banh sinh nhat birthday cake party', cat: 'food' },
    { emoji: '🍰', name: 'banh ngot shortcake kem dau', cat: 'food' },
    { emoji: '🧁', name: 'cupcake banh kem mini', cat: 'food' },
    { emoji: '🍫', name: 'socola chocolate bar ngot ngao', cat: 'food' },
    { emoji: '🍬', name: 'keo candy ngot', cat: 'food' },
    { emoji: '🍭', name: 'keo mut lollipop kẹo xoay', cat: 'food' },
    { emoji: '🍮', name: 'flan pudding caramen thom', cat: 'food' },
    { emoji: '🧋', name: 'tra sua boba milk tea tran chau', cat: 'food' },
    { emoji: '☕', name: 'ca phe coffee tach ca phe nong', cat: 'food' },
    { emoji: '🥤', name: 'nuoc ngot cup soda nuoc giai khat', cat: 'food' },

    // Cảm xúc & Biểu tượng
    { emoji: '😀', name: 'cuoi grin smile vui ve toe toet', cat: 'smileys' },
    { emoji: '🥰', name: 'yeu love tim yeu thuong hanh phuc', cat: 'smileys' },
    { emoji: '😍', name: 'mat tim heart eyes me man thich', cat: 'smileys' },
    { emoji: '🤩', name: 'mat sao star eyes bat ngo thich thu', cat: 'smileys' },
    { emoji: '😎', name: 'ngau cool kinh ram sunglasses ba dao', cat: 'smileys' },
    { emoji: '🥳', name: 'tiec party le hoi chuc mung sinh nhat', cat: 'smileys' },
    { emoji: '🥺', name: 'cau xin pleading de thuong lam nung', cat: 'smileys' },
    { emoji: '😴', name: 'ngu sleep zzz buon ngu', cat: 'smileys' },
    { emoji: '💖', name: 'tim sparkling heart yeu thuong lap lanh', cat: 'smileys' },
    { emoji: '💝', name: 'hop qua tim gift heart tang ban', cat: 'smileys' },
    { emoji: '❤️', name: 'trai tim do red heart love yeu', cat: 'smileys' },
    { emoji: '🎀', name: 'no ribbon no hong cute trang tri', cat: 'smileys' },
    { emoji: '🎈', name: 'bong bong balloon bong bay sinh nhat', cat: 'smileys' },
    { emoji: '🎉', name: 'phao hoa party popper chuc mung vui ve', cat: 'smileys' },
    { emoji: '🎁', name: 'qua tang gift hop qua bat ngo', cat: 'smileys' },
    { emoji: '🧸', name: 'gau bong teddy bear do choi em be', cat: 'smileys' }
];

let activeEmojiCategory = 'all';

function openEmojiLibraryModal() {
    const modal = document.getElementById('modal-emoji-library');
    if (!modal) return;
    modal.style.display = 'flex';

    const searchInput = document.getElementById('emoji-search-input');
    if (searchInput) {
        searchInput.value = '';
        setTimeout(function() { searchInput.focus(); }, 100);
    }

    activeEmojiCategory = 'all';
    updateCategoryTabsUI();
    renderEmojiLibrary(EMOJI_CATALOG);
}

function closeEmojiLibraryModal() {
    const modal = document.getElementById('modal-emoji-library');
    if (modal) modal.style.display = 'none';
}

function handleSearchEmojiLibrary(query) {
    const q = (query || '').toLowerCase().trim();
    let filtered = EMOJI_CATALOG;

    if (activeEmojiCategory !== 'all') {
        filtered = filtered.filter(function(item) {
            return item.cat === activeEmojiCategory;
        });
    }

    if (q) {
        filtered = filtered.filter(function(item) {
            return item.name.toLowerCase().includes(q) || item.emoji.includes(q);
        });
    }

    renderEmojiLibrary(filtered);
}

function filterEmojiCategory(cat, btnEl) {
    activeEmojiCategory = cat;
    updateCategoryTabsUI();

    const searchInput = document.getElementById('emoji-search-input');
    const query = searchInput ? searchInput.value : '';
    handleSearchEmojiLibrary(query);
}

function updateCategoryTabsUI() {
    const buttons = document.querySelectorAll('.emoji-cat-btn');
    buttons.forEach(function(b) {
        const onclickAttr = b.getAttribute('onclick') || '';
        const match = onclickAttr.match(/'([^']+)'/);
        if (match && match[1] === activeEmojiCategory) {
            b.classList.add('active');
        } else {
            b.classList.remove('active');
        }
    });
}

function renderEmojiLibrary(list) {
    const grid = document.getElementById('emoji-library-grid');
    if (!grid) return;

    if (!list || list.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1 / -1; padding: 24px; text-align: center; color: #94a3b8; font-size: 13px;">Không tìm thấy emoji nào phù hợp. Bạn hãy gõ từ khóa khác hoặc dán trực tiếp emoji vào ô dán nhanh!</div>';
        return;
    }

    grid.innerHTML = list.map(function(item) {
        return `
            <button type="button" class="emoji-grid-item" onclick="selectEmojiFromLibrary('${item.emoji}')" title="${escapeHtml(item.name)}">
                ${item.emoji}
            </button>
        `;
    }).join('');
}

function selectEmojiFromLibrary(emoji) {
    addNewPickerIcon(emoji);
    selectCommonIcon(emoji);
    closeEmojiLibraryModal();
}

function submitManualPasteEmoji() {
    const input = document.getElementById('manual-paste-emoji');
    const emoji = input ? input.value.trim() : '';
    if (!emoji) {
        alert('Vui lòng dán hoặc nhập ít nhất một emoji!');
        return;
    }
    addNewPickerIcon(emoji);
    selectCommonIcon(emoji);
    if (input) input.value = '';
    closeEmojiLibraryModal();
}

// --- 5. ĐÍNH KÈM ĐỘNG CÁC BƯỚC (DYNAMIC NODES) ---
function initDynamicNodes() {
    // Đã ẩn nút và các bước phụ theo yêu cầu giao diện tối giản
    const btnAddNode = document.getElementById('btn-add-node');
    if (btnAddNode) {
        btnAddNode.style.display = 'none';
    }
    // Dọn dẹp bất kỳ node phụ nào khác ngoài node-0 (âm thanh chào mừng)
    const extraNodes = document.querySelectorAll('#dialogue-container .node-box:not(#node-0)');
    extraNodes.forEach(function(node) {
        node.remove();
    });
}

function previewNodeImage(input, previewContainerId) {
    const file = input.files && input.files[0];
    const previewDiv = document.getElementById(previewContainerId);
    if (!previewDiv) return;
    if (file) {
        const img = previewDiv.querySelector('img');
        if (img) img.src = URL.createObjectURL(file);
        previewDiv.style.display = 'block';
    } else {
        previewDiv.style.display = 'none';
    }
}

function previewNodeAudio(input, previewContainerId) {
    const file = input.files && input.files[0];
    const previewDiv = document.getElementById(previewContainerId);
    if (!previewDiv) return;
    if (file) {
        const aud = previewDiv.querySelector('audio');
        if (aud) aud.src = URL.createObjectURL(file);
        previewDiv.style.display = 'block';
    } else {
        previewDiv.style.display = 'none';
    }
}

// Utility
// Play audio inline in admin character list
let currentInlineAudio = null;
let currentInlineBtn = null;

window.playAudioInline = function(url, btn) {
    if (!url) return;
    if (currentInlineAudio && !currentInlineAudio.paused) {
        currentInlineAudio.pause();
        if (currentInlineBtn) currentInlineBtn.innerHTML = '🎵 Nghe giọng';
        if (currentInlineBtn === btn) {
            currentInlineAudio = null;
            currentInlineBtn = null;
            return;
        }
    }
    currentInlineAudio = new Audio(url);
    currentInlineBtn = btn;
    btn.innerHTML = '⏸️ Đang phát...';
    currentInlineAudio.play().catch(function(e) { console.error(e); });
    currentInlineAudio.onended = function() {
        btn.innerHTML = '🎵 Nghe giọng';
        currentInlineAudio = null;
        currentInlineBtn = null;
    };
};

function formatBytes(bytes, decimals = 1) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function escapeHtml(string) {
    return String(string).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}


// --- 6. QUẢN LÝ TEXT THIỆP & KHO LỜI NHẮN NGẪU NHIÊN (RANDOM MESSAGES) ---
const DEFAULT_CARD_MESSAGES_LIST = [];

let adminCardMessages = [];

function initAdminCardMessages() {
    const data = window.__ADMIN_GAME_CARD_DATA || {};
    if (Array.isArray(data.messages)) {
        adminCardMessages = data.messages.filter(m => typeof m === 'string' && m.trim() && !/Vương quốc Nấm|Mario|công chúa/i.test(m));
    } else {
        adminCardMessages = [];
    }
    renderAdminCardMessagesList();
}

function renderAdminCardMessagesList() {
    const listEl = document.getElementById('admin-card-messages-list');
    const countEl = document.getElementById('admin-card-msg-count');
    if (!listEl) return;

    if (countEl) countEl.innerText = adminCardMessages.length;

    if (adminCardMessages.length === 0) {
        listEl.innerHTML = '<div style="text-align: center; padding: 14px; color: #94a3b8; font-size: 13px;">Chưa có lời chúc nào trong kho. Hãy thêm câu mới phía dưới!</div>';
        return;
    }

    listEl.innerHTML = adminCardMessages.map((msg, idx) => {
        const safeMsg = escapeHtml(msg);
        return `
            <div style="background: #fdf2f8; border: 1px solid #fbcfe8; border-radius: 10px; padding: 8px 12px; display: flex; align-items: center; justify-content: space-between; gap: 10px;">
                <div style="display: flex; align-items: flex-start; gap: 8px; flex: 1; min-width: 0;">
                    <span style="background: #db2777; color: #fff; font-size: 10px; font-weight: 800; border-radius: 6px; padding: 2px 6px; flex-shrink: 0; margin-top: 2px;">#${idx + 1}</span>
                    <span style="font-size: 13px; color: #334155; line-height: 1.4; word-break: break-word;">${safeMsg}</span>
                </div>
                <div style="display: flex; gap: 4px; flex-shrink: 0;">
                    <button type="button" onclick="editCardMessage(${idx})" title="Chỉnh sửa câu này"
                        style="background: #fff; border: 1px solid #bfdbfe; color: #2563eb; border-radius: 6px; padding: 3px 8px; font-size: 11px; font-weight: 700; cursor: pointer;">
                        ✏️ Sửa
                    </button>
                    <button type="button" onclick="deleteCardMessage(${idx})" title="Xóa câu này"
                        style="background: #fff; border: 1px solid #fca5a5; color: #dc2626; border-radius: 6px; padding: 3px 8px; font-size: 11px; font-weight: 700; cursor: pointer;">
                        🗑️ Xóa
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function addNewCardMessageToList() {
    const input = document.getElementById('admin-card-new-msg-input');
    if (!input) return;
    const val = input.value.trim();
    if (!val) {
        alert('Vui lòng gõ nội dung câu lời chúc/động viên!');
        return;
    }
    adminCardMessages.push(val);
    input.value = '';
    renderAdminCardMessagesList();

    // Đồng bộ vào textarea chính nếu chưa có
    const singleInput = document.getElementById('admin-card-message-input');
    if (singleInput && !singleInput.value.trim()) {
        singleInput.value = val;
    }
}

// ==================== QUẢN LÝ SỬA & XÓA CÂU LỜI CHÚC THIỆP (MODAL) ====================
function editCardMessage(idx) {
    openEditCardMessageModal(idx);
}

function openEditCardMessageModal(idx) {
    const current = adminCardMessages[idx] || '';
    const modal = document.getElementById('modal-edit-card-message');
    if (!modal) {
        const updated = prompt('Chỉnh sửa nội dung câu lời chúc:', current);
        if (updated !== null && updated.trim()) {
            adminCardMessages[idx] = updated.trim();
            renderAdminCardMessagesList();
        }
        return;
    }

    document.getElementById('modal-edit-card-index').value = idx;
    const labelEl = document.getElementById('modal-edit-card-index-label');
    if (labelEl) labelEl.innerText = '#' + (idx + 1);

    const textarea = document.getElementById('modal-edit-card-text');
    if (textarea) {
        textarea.value = current;
        updateCardCharCount(current);
    }

    const errEl = document.getElementById('modal-edit-card-error');
    if (errEl) {
        errEl.style.display = 'none';
        errEl.innerText = '';
    }

    modal.style.display = 'flex';
    setTimeout(() => {
        if (textarea) {
            textarea.focus();
            textarea.setSelectionRange(textarea.value.length, textarea.value.length);
        }
    }, 60);
}

function closeEditCardMessageModal() {
    const modal = document.getElementById('modal-edit-card-message');
    if (modal) modal.style.display = 'none';
}

function updateCardCharCount(val) {
    const countEl = document.getElementById('modal-edit-card-char-count');
    if (countEl) countEl.innerText = (val ? val.length : 0) + ' ký tự';
}

function insertEmojiToEditCard(emoji) {
    const textarea = document.getElementById('modal-edit-card-text');
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    textarea.value = text.substring(0, start) + emoji + text.substring(end);
    textarea.focus();
    textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
    updateCardCharCount(textarea.value);
}

function submitEditCardMessage(e) {
    if (e && e.preventDefault) e.preventDefault();
    const idx = parseInt(document.getElementById('modal-edit-card-index').value, 10);
    const textarea = document.getElementById('modal-edit-card-text');
    const errEl = document.getElementById('modal-edit-card-error');
    const val = textarea ? textarea.value.trim() : '';

    if (!val) {
        if (errEl) {
            errEl.style.display = 'block';
            errEl.innerText = 'Vui lòng không để trống nội dung câu lời chúc!';
        }
        if (textarea) textarea.focus();
        return;
    }

    if (!isNaN(idx) && idx >= 0 && idx < adminCardMessages.length) {
        adminCardMessages[idx] = val;
        renderAdminCardMessagesList();
    }
    closeEditCardMessageModal();
}

function deleteCardMessage(idx) {
    openDeleteCardMessageModal(idx);
}

function openDeleteCardMessageModal(idx) {
    const modal = document.getElementById('modal-delete-card-message');
    if (!modal) {
        if (confirm('Bạn có chắc chắn muốn xóa câu lời nhắn này khỏi danh sách ngẫu nhiên?')) {
            adminCardMessages.splice(idx, 1);
            renderAdminCardMessagesList();
        }
        return;
    }

    document.getElementById('modal-del-card-index').value = idx;
    const labelEl = document.getElementById('modal-del-card-index-label');
    if (labelEl) labelEl.innerText = '#' + (idx + 1);

    const previewEl = document.getElementById('modal-del-card-preview');
    if (previewEl) {
        previewEl.innerText = '"' + (adminCardMessages[idx] || '') + '"';
    }

    modal.style.display = 'flex';
}

function closeDeleteCardMessageModal() {
    const modal = document.getElementById('modal-delete-card-message');
    if (modal) modal.style.display = 'none';
}

function confirmDeleteCardMessage() {
    const idx = parseInt(document.getElementById('modal-del-card-index').value, 10);
    if (!isNaN(idx) && idx >= 0 && idx < adminCardMessages.length) {
        adminCardMessages.splice(idx, 1);
        renderAdminCardMessagesList();
    }
    closeDeleteCardMessageModal();
}

function onCardRandomToggleChange(checked) {
    const singleSection = document.getElementById('admin-card-single-section');
    if (singleSection) {
        singleSection.style.display = checked ? 'none' : 'block';
    }
}

// Đã gỡ bỏ khôi phục câu mẫu theo yêu cầu

function testRollAdminCardMessage() {
    if (adminCardMessages.length === 0) {
        alert('Danh sách đang trống!');
        return;
    }
    const rand = adminCardMessages[Math.floor(Math.random() * adminCardMessages.length)];
    if (window.__currentCardData) {
        window.__currentCardData.title = document.getElementById('admin-card-title-input').value.trim() || 'Thiệp Mời Tốt Nghiệp 💌';
        window.__currentCardData.message = rand;
        window.__currentCardData.sender = document.getElementById('admin-card-sender-input').value.trim() || 'Từ Hoàng Yến';
        window.__activeCardMessage = rand;
    }
    if (typeof window.showGameOverCard === 'function') {
        window.showGameOverCard(1520, 36);
    } else {
        alert('🎲 Câu ngẫu nhiên được chọn:\n\n"' + rand + '"');
    }
}

function handleSaveGameCardSetting(event) {
    event.preventDefault();

    const title = document.getElementById('admin-card-title-input').value.trim();
    const sender = document.getElementById('admin-card-sender-input').value.trim();
    const isRandomToggle = document.getElementById('admin-card-is-random');
    const isRandom = isRandomToggle ? isRandomToggle.checked : true;
    const singleMsgInput = document.getElementById('admin-card-message-input');
    const message = (singleMsgInput && singleMsgInput.value.trim()) ? singleMsgInput.value.trim() : (adminCardMessages[0] || 'Thiệp mời tham dự Lễ Tốt Nghiệp 🎓✨');
    const statusEl = document.getElementById('game-card-save-status');

    if (adminCardMessages.length === 0 && !message) {
        alert('Vui lòng nhập ít nhất 1 câu nội dung cho bức thiệp!');
        return;
    }

    if (statusEl) statusEl.innerText = 'Đang lưu...';

    fetch('/admin/api/game-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            title, 
            message, 
            messages: adminCardMessages,
            isRandom,
            sender 
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            if (statusEl) {
                statusEl.innerText = '✅ Đã lưu cài đặt thiệp & danh sách random thành công!';
                setTimeout(() => { statusEl.innerText = ''; }, 3500);
            }
            if (window.__currentCardData) {
                window.__currentCardData = Object.assign({}, window.__currentCardData, data.card);
            }
        } else {
            alert('Lỗi: ' + (data.error || 'Không thể lưu cài đặt thiệp!'));
            if (statusEl) statusEl.innerText = '';
        }
    })
    .catch(err => {
        console.error('Lỗi lưu thiệp:', err);
        alert('Lỗi kết nối khi lưu thiệp!');
        if (statusEl) statusEl.innerText = '';
    });
}

function previewGameCardFromAdmin() {
    const title = document.getElementById('admin-card-title-input').value.trim() || 'Thiệp Mời Tốt Nghiệp 💌';
    const isRandom = document.getElementById('admin-card-is-random') ? document.getElementById('admin-card-is-random').checked : true;
    
    let message = '';
    if (isRandom && adminCardMessages.length > 0) {
        message = adminCardMessages[Math.floor(Math.random() * adminCardMessages.length)];
    } else {
        message = (document.getElementById('admin-card-message-input') && document.getElementById('admin-card-message-input').value.trim()) 
            ? document.getElementById('admin-card-message-input').value.trim() 
            : (adminCardMessages[0] || 'Thiệp mời tham dự Lễ Tốt Nghiệp 🎓✨');
    }

    const sender = document.getElementById('admin-card-sender-input').value.trim() || 'Từ Hoàng Yến';

    if (window.__currentCardData) {
        window.__currentCardData.title = title;
        window.__currentCardData.message = message;
        window.__currentCardData.messages = adminCardMessages;
        window.__currentCardData.isRandom = isRandom;
        window.__currentCardData.sender = sender;
        window.__activeCardMessage = message;
    }

    if (typeof window.showGameOverCard === 'function') {
        window.showGameOverCard(1250, 42);
    } else {
        alert('Tiêu đề: ' + title + '\n\nNội dung (Random: ' + (isRandom ? 'Bật' : 'Tắt') + '):\n"' + message + '"\n\nKý tên: ' + sender);
    }
}

// Đã gỡ bỏ khôi phục thiệp mặc định theo yêu cầu

// Tự động khởi tạo kho lời nhắn thiệp khi tải trang
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('admin-card-messages-list')) {
        initAdminCardMessages();
    }
});

// Phím ESC đóng modal thiệp
window.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' || e.keyCode === 27) {
        if (typeof closeEditCardMessageModal === 'function') closeEditCardMessageModal();
        if (typeof closeDeleteCardMessageModal === 'function') closeDeleteCardMessageModal();
    }
});
