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
