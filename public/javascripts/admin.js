/**
 * Admin Panel Enhancements:
 * - Advanced Avatar Studio (Click to upload, Drag & Drop, Preset Avatars, URL Input)
 * - Custom Icon Selector & Direct Input
 * - Live Script .txt Parsing & Preview
 * - Live Audio Player Preview
 */

document.addEventListener('DOMContentLoaded', function() {
    initAvatarStudio();
    initScriptPreview();
    initAudioPreview();
    initIconPicker();
    initDynamicNodes();
});

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

// --- 2. XEM TRƯỚC FILE KỊCH BẢN .TXT ---
function initScriptPreview() {
    const scriptInput = document.getElementById('script-input');
    const scriptPreviewWrapper = document.getElementById('script-preview-wrapper');
    const scriptPreviewStats = document.getElementById('script-preview-stats');
    const scriptPreviewContent = document.getElementById('script-preview-content');
    const btnToggleRawScript = document.getElementById('btn-toggle-raw-script');
    const scriptRawContent = document.getElementById('script-raw-content');

    if (!scriptInput) return;

    scriptInput.addEventListener('change', function() {
        const file = this.files && this.files[0];
        if (file) {
            if (!file.name.endsWith('.txt')) {
                alert('Vui lòng chọn đúng file văn bản định dạng .txt!');
                this.value = '';
                return;
            }

            const reader = new FileReader();
            reader.onload = function(e) {
                const text = e.target.result;
                renderScriptPreview(text, file.name, file.size);
            };
            reader.readAsText(file);
        }
    });

    function renderScriptPreview(rawText, fileName, fileSize) {
        if (!scriptPreviewWrapper) return;
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
                <div class="script-block-card" style="background: #ffffff; border: 1px solid #fbcfe8; border-radius: 10px; padding: 12px; margin-bottom: 10px; box-shadow: 0 2px 6px rgba(0,0,0,0.03);">
                    <div style="font-size: 12px; font-weight: 700; color: #db2777; margin-bottom: 6px; display: flex; justify-content: space-between;">
                        <span>Khối ${idx + 1} (Bước hội thoại ${idx + 1})</span>
                        <span style="color: #64748b; font-weight: normal;">${questions.length} câu hỏi lựa chọn</span>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px;">
                        ${questions.map(q => `<div style="font-size: 13px; color: #1e293b; background: #fdf2f8; padding: 4px 8px; border-radius: 6px; border-left: 3px solid #f472b6;"><b>Q:</b> ${escapeHtml(q)}</div>`).join('')}
                    </div>
                    <div style="font-size: 13px; color: #15803d; background: #f0fdf4; padding: 6px 10px; border-radius: 6px; border-left: 3px solid #22c55e;">
                        <b>A (Bot phản hồi):</b> ${answer ? escapeHtml(answer) : '<i style="color:#94a3b8">Chưa có câu trả lời</i>'}
                    </div>
                </div>
            `;
        });

        if (scriptPreviewStats) {
            scriptPreviewStats.innerHTML = `
                <span>📄 <b>${fileName}</b> (${formatBytes(fileSize)})</span>
                <span>• <b>${rawBlocks.length}</b> khối hội thoại</span>
                <span>• <b>${totalQuestions}</b> câu hỏi</span>
                <span>• <b>${totalAnswers}</b> câu phản hồi</span>
            `;
        }

        if (scriptPreviewContent) {
            scriptPreviewContent.innerHTML = formattedBlocksHtml || '<p style="color: #64748b; font-size: 13px;">Không phát hiện thấy câu hỏi (Q:) hoặc câu trả lời (A:) nào hợp lệ trong file kịch bản.</p>';
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

    if (!input || !player) return;

    input.addEventListener('change', function() {
        const file = this.files && this.files[0];
        if (file) {
            if (!file.type.startsWith('audio/') && !file.name.match(/\.(mp3|wav|ogg|m4a|aac)$/i)) {
                alert('Vui lòng chọn file âm thanh hợp lệ (MP3, WAV, OGG, M4A)!');
                this.value = '';
                return;
            }
            const objectUrl = URL.createObjectURL(file);
            player.src = objectUrl;
            if (nameLabel) nameLabel.innerText = file.name + ' (' + formatBytes(file.size) + ')';
            if (wrapper) wrapper.style.display = 'block';
        }
    });

    if (removeBtn) {
        removeBtn.addEventListener('click', function() {
            input.value = '';
            player.src = '';
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
            updateIconDisplay(this.value);
        });
    }

    function updateIconDisplay(val) {
        const cleanVal = val.trim() || '🍄';
        if (iconDisplayLarge) {
            iconDisplayLarge.innerText = cleanVal;
        }
        if (avatarPlaceholder && (!avatarImg || avatarImg.style.display === 'none')) {
            avatarPlaceholder.innerText = cleanVal;
        }
    }

    // Nạp danh sách icons từ server hoặc localStorage
    loadAdminIcons();
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
        container.innerHTML = '<span style="font-size: 12px; color: #94a3b8; padding: 4px 8px;">Chưa có icon nào trong bảng. Hãy bấm "➕ Thêm icon" hoặc "🔄 Đặt lại"!</span>';
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

    if (iconInput) iconInput.value = emoji;
    if (iconDisplayLarge) iconDisplayLarge.innerText = emoji;
    if (avatarPlaceholder && (!avatarImg || avatarImg.style.display === 'none')) {
        avatarPlaceholder.innerText = emoji;
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

function promptAddNewIcon() {
    const emoji = prompt('Nhập emoji hoặc biểu tượng bạn muốn thêm vào bảng (VD: 🦄, 🍓, 🍕, 🐉, 🐱...):');
    if (emoji && emoji.trim()) {
        addNewPickerIcon(emoji.trim());
    }
}

function addNewPickerIcon(emoji) {
    if (!emoji) return;
    if (currentPickerIcons.includes(emoji)) {
        alert('Icon "' + emoji + '" đã có trong bảng gợi ý rồi!');
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

function restoreDefaultIcons() {
    if (confirm('Khôi phục danh sách icon gợi ý về mặc định ban đầu?')) {
        currentPickerIcons = [...DEFAULT_PICKER_ICONS];
        isIconDeleteMode = false;
        const btn = document.getElementById('btn-toggle-delete-icon');
        if (btn) {
            btn.innerHTML = '🗑️ Xóa icon';
            btn.style.background = '#fee2e2';
            btn.style.color = '#dc2626';
            btn.style.borderColor = '#fca5a5';
        }
        savePickerIcons();
    }
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
