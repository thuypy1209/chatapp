var express = require('express');
var router = express.Router();
var fs = require('fs');
var multer = require('multer');
var path = require('path');

var Question = require('../schemas/Question');
var Answer = require('../schemas/Answer');
var Image = require('../schemas/Image');
var Audio = require('../schemas/Audio');
var Character = require('../schemas/Character');

// Cấu hình lưu trữ file upload cho hình ảnh và âm thanh
var storage = multer.diskStorage({
    destination: function (req, file, cb) {
        if (file.fieldname === 'avatar') {
            // Lưu vào thư mục public/uploads/images/avatar/
            cb(null, 'public/uploads/images/avatar/');
        } else if (file.fieldname === 'backgroundUrl') {
            // Lưu vào thư mục public/uploads/images/background/ (theo đúng tên bạn đặt trên thư mục)
            cb(null, 'public/uploads/images/background/');
        } else if (file.fieldname === 'imageFile' || file.fieldname.startsWith('nodeImage_')) {
            // Lưu vào thư mục chung public/uploads/images/
            cb(null, 'public/uploads/images/');
        } else if (file.fieldname === 'audioFile' || file.fieldname === 'audio' || file.fieldname === 'musicFile' || file.fieldname === 'trackAudio' || file.fieldname.startsWith('nodeAudio_')) {
            // Lưu vào thư mục public/uploads/audios/
            var audioDir = path.join(__dirname, '../public/uploads/audios/');
            if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });
            cb(null, audioDir);
        } else if (file.fieldname === 'scriptFile') {
            // Lưu file kịch bản vào thư mục public/uploads/seeds/
            cb(null, 'public/uploads/seeds/');
        } else {
            cb(null, 'public/uploads/');
        }
    },
    filename: function (req, file, cb) {
        var uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
var upload = multer({ storage: storage });
var authUtils = require('../utils/auth');

// Middleware bảo vệ các route /admin: Yêu cầu quyền Admin với token có chữ ký số
router.use(async function(req, res, next) {
    try {
        var adminToken = req.cookies.chat_admin_token;
        var adminUser = authUtils.verifyAdminToken(adminToken);
        if (adminUser) {
            req.adminUser = adminUser;
            var adminDoc = await authUtils.getAdminByUsername(adminUser);
            req.adminObj = adminDoc;
            req.isSuperAdmin = !!(adminDoc && adminDoc.role === 'superadmin');
            res.locals.isSuperAdmin = req.isSuperAdmin;
            res.locals.currentAdminRole = adminDoc ? adminDoc.role : 'admin';
            return next();
        }
        // Nếu chưa đăng nhập Admin hoặc token giả mạo, hiển thị giao diện nhập mật khẩu
        res.render('admin/Login', {
            title: 'Đăng nhập Quản trị Admin',
            error: null
        });
    } catch (err) {
        console.error('Lỗi xác thực middleware admin:', err);
        res.render('admin/Login', {
            title: 'Đăng nhập Quản trị Admin',
            error: 'Đã xảy ra lỗi xác thực quyền quản trị!'
        });
    }
});

// Middleware chặn truy cập vào các tính năng quản lý tài khoản: Chỉ Super Admin mới có quyền
function requireSuperAdmin(req, res, next) {
    if (!req.isSuperAdmin) {
        return res.status(403).json({
            success: false,
            error: 'Bạn không có quyền thực hiện thao tác này! Chỉ Super Admin mới có quyền quản lý tài khoản và xóa người dùng.'
        });
    }
    next();
}

function formatDateVN(date) {
    if (!date) return '';
    try {
        return new Date(date).toLocaleString('vi-VN', {
            timeZone: 'Asia/Ho_Chi_Minh',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour12: false
        });
    } catch(e) {
        return '';
    }
}

// 1. Hiển thị trang quản lý Admin (Bao gồm danh sách nhân vật và form thêm)
router.get('/', async function(req, res) {
    try {
        var Admin = require('../schemas/Admin');
        var User = require('../schemas/User');
        var Setting = require('../schemas/Setting');
        var characters = await Character.find({});
        var isSuperAdmin = !!req.isSuperAdmin;
        var admins = isSuperAdmin ? await Admin.find({}).select('-passwordHash').sort({ createdAt: 1 }) : [];
        var chatUsers = await User.find({}).sort({ lastActive: -1, createdAt: -1 });

        // Tải danh sách icon gợi ý từ MongoDB Setting
        var setting = await Setting.findOne({ key: 'admin_custom_icons' });
        var defaultIcons = ['🎮', '🍄', '⭐', '💻', '🧳', '🌿', '🍳', '⚔️', '⛏️', '🧙‍♂️', '🐱', '🌸', '💎', '📜', '🤖', '👑', '🔮', '🧸', '⚡', '🔥'];
        var adminIcons = (setting && Array.isArray(setting.value)) ? setting.value : defaultIcons;

        // Tải cài đặt Text Thiệp Game Over
        var settingsUtils = require('../utils/settings');
        var gameCard = settingsUtils.getGameCardSetting();

        res.render('admin/Admin', { 
            title: 'Quản trị Admin',
            characters: characters,
            admins: admins,
            chatUsers: chatUsers,
            formatDateVN: formatDateVN,
            currentAdmin: req.adminUser,
            currentAdminRole: req.adminObj ? req.adminObj.role : 'admin',
            isSuperAdmin: isSuperAdmin,
            adminIcons: adminIcons,
            gameCard: gameCard
        });
    } catch (err) {
        console.log("Lỗi lấy danh sách nhân vật cho admin:", err);
        var settingsUtils = require('../utils/settings');
        res.render('admin/Admin', { 
            title: 'Quản trị Admin',
            characters: [], 
            admins: [], 
            chatUsers: [], 
            formatDateVN: formatDateVN, 
            isSuperAdmin: false, 
            currentAdmin: req.adminUser, 
            adminIcons: [], 
            gameCard: settingsUtils.getGameCardSetting() 
        });
    }
});

// Hàm trợ giúp: Phân tích nội dung kịch bản văn bản và lưu Question, Answer, Media vào CSDL
async function saveScriptToDatabase(fileContent, charId, files) {
    if (!fileContent || !fileContent.trim()) return;

    var blocks = fileContent.split('---').map(b => b.trim()).filter(b => b.length > 0);
    var answersToInsert = [];
    var imagesToInsert = [];
    var audiosToInsert = [];
    var blockDataList = [];

    // Bước 1: Parse từng khối
    for (var i = 0; i < blocks.length; i++) {
        var lines = blocks[i].split('\n').map(l => l.trim()).filter(l => l.length > 0);
        var qTexts = [];
        var aText = "";

        lines.forEach(line => {
            if (line.startsWith('Q:')) {
                qTexts.push(line.replace(/^Q:\s*/, '').trim());
            } else if (line.startsWith('A:')) {
                aText = line.replace(/^A:\s*/, '').trim();
            }
        });

        if (qTexts.length > 0) {
            var imgFile = files ? files.find(f => f.fieldname === `nodeImage_${i}`) : null;
            var audioFile = files ? files.find(f => f.fieldname === `nodeAudio_${i}`) : null;

            var ansIndex = aText ? answersToInsert.push({ answerText: aText }) - 1 : -1;
            var imgIndex = imgFile ? imagesToInsert.push({ imageUrl: '/uploads/images/' + imgFile.filename }) - 1 : -1;
            var audIndex = audioFile ? audiosToInsert.push({ audioUrl: '/uploads/audios/' + audioFile.filename }) - 1 : -1;

            blockDataList.push({
                qTexts: qTexts,
                ansIndex: ansIndex,
                imgIndex: imgIndex,
                audIndex: audIndex
            });
        }
    }

    // Bước 2: Ghi hàng loạt Answer, Image, Audio vào DB
    var createdAnswers = answersToInsert.length > 0 ? await Answer.insertMany(answersToInsert) : [];
    var createdImages = imagesToInsert.length > 0 ? await Image.insertMany(imagesToInsert) : [];
    var createdAudios = audiosToInsert.length > 0 ? await Audio.insertMany(audiosToInsert) : [];

    // Bước 3: Tạo danh sách tất cả các Question
    var allQuestionsData = [];
    blockDataList.forEach((block, blockIdx) => {
        block.qTexts.forEach(qText => {
            allQuestionsData.push({
                questionText: qText,
                answerId: block.ansIndex !== -1 ? createdAnswers[block.ansIndex]._id : null,
                imageId: block.imgIndex !== -1 ? createdImages[block.imgIndex]._id : null,
                audioId: block.audIndex !== -1 ? createdAudios[block.audIndex]._id : null,
                characterId: charId,
                blockIndex: blockIdx,
                isRoot: blockIdx === 0
            });
        });
    });

    var createdQuestions = await Question.insertMany(allQuestionsData);

    // Bước 4: Liên kết mạng lưới nextQuestions giữa các block liên tiếp
    var updateOps = [];
    for (var k = 0; k < blockDataList.length - 1; k++) {
        var currentBlockQuestions = createdQuestions.filter(q => q.blockIndex === k);
        var nextBlockQuestions = createdQuestions.filter(q => q.blockIndex === k + 1);
        var nextIds = nextBlockQuestions.map(q => q._id);

        currentBlockQuestions.forEach(currQ => {
            updateOps.push(
                Question.findByIdAndUpdate(currQ._id, { nextQuestions: nextIds })
            );
        });
    }

    if (updateOps.length > 0) {
        await Promise.all(updateOps);
    }
}

// Route POST: Thêm nhân vật + Đọc kịch bản .txt + Upload Media (Tối ưu tốc độ CSDL)
router.post('/character/add-full', upload.any(), async function(req, res) {
    try {
        var { name, description, icon } = req.body;

        // 1. Lưu ảnh đại diện Avatar (nếu có)
        var avatarFile = req.files ? req.files.find(f => f.fieldname === 'avatar') : null;
        var avatarUrl = '';
        if (avatarFile) {
            avatarUrl = '/uploads/images/avatar/' + avatarFile.filename;
        } else if (req.body.avatarUrl && req.body.avatarUrl.trim()) {
            avatarUrl = req.body.avatarUrl.trim();
        }

        var bgFile = req.files ? req.files.find(f => f.fieldname === 'backgroundUrl') : null;
        var backgroundUrl = bgFile ? '/uploads/images/background/' + bgFile.filename : '';
        
        var scriptFile = req.files ? req.files.find(f => f.fieldname === 'scriptFile') : null;
        var scriptFilename = scriptFile ? scriptFile.filename : '';
        var seedsDir = path.join(__dirname, '../public/uploads/seeds/');
        if (!fs.existsSync(seedsDir)) fs.mkdirSync(seedsDir, { recursive: true });

        var fileContent = '';
        if (scriptFile) {
            var filePath = path.join(seedsDir, scriptFile.filename);
            if (fs.existsSync(filePath)) {
                fileContent = fs.readFileSync(filePath, 'utf8');
            }
        } else if (req.body.scriptText && req.body.scriptText.trim()) {
            fileContent = req.body.scriptText.trim();
            scriptFilename = 'script-mobile-' + Date.now() + '-' + Math.round(Math.random() * 1E6) + '.txt';
            fs.writeFileSync(path.join(seedsDir, scriptFilename), fileContent, 'utf8');
        }

        // 2. Tạo Nhân vật
        var newChar = await Character.create({
            name: name,
            description: description,
            icon: icon ? icon.trim() : '',
            avatarUrl: avatarUrl,
            backgroundUrl: backgroundUrl,
            audioUrl: (req.files && req.files.find(f => f.fieldname === 'nodeAudio_0' || f.fieldname === 'audio')) ? ('/uploads/audios/' + req.files.find(f => f.fieldname === 'nodeAudio_0' || f.fieldname === 'audio').filename) : (req.body.audioUrl || ''),
            scriptFilename: scriptFilename
        });

        // 3. Đọc kịch bản & phân tích vào CSDL (hỗ trợ cả tải file .txt và soạn trực tiếp trên web cho điện thoại)
        if (fileContent && fileContent.trim()) {
            await saveScriptToDatabase(fileContent, newChar._id, req.files || []);
        }

        res.redirect('/admin');
    } catch (err) {
        console.log("Lỗi tạo nhân vật và kịch bản:", err);
        res.redirect('/admin');
    }
});

// 3. Xử lý xóa nhân vật
router.get('/character/delete/:id', async function(req, res) {
    try {
        var charId = req.params.id;
        var character = await Character.findById(charId);
        if (character) {
            // Xóa file avatar vật lý nếu tồn tại
            if (character.avatarUrl) {
                var avatarPath = path.join(__dirname, '../public', character.avatarUrl);
                if (fs.existsSync(avatarPath)) {
                    fs.unlinkSync(avatarPath);
                }
            }
            // Xóa file background vật lý nếu tồn tại
            if (character.backgroundUrl) {
                var bgPath = path.join(__dirname, '../public', character.backgroundUrl);
                if (fs.existsSync(bgPath)) {
                    fs.unlinkSync(bgPath);
                }
            }
        }
        if (character.scriptFilename) {
                var scriptPath = path.join(__dirname, '../public/uploads/seeds/', character.scriptFilename);
                if (fs.existsSync(scriptPath)) {
                    fs.unlinkSync(scriptPath);
                }
            }

        var questions = await Question.find({ characterId: charId });

        var answerIds = questions.map(q => q.answerId).filter(Boolean);
        var imageIds = questions.map(q => q.imageId).filter(Boolean);
        var audioIds = questions.map(q => q.audioId).filter(Boolean);

        if (answerIds.length > 0) {
            await Answer.deleteMany({ _id: { $in: answerIds } });
        }
        if (imageIds.length > 0) {
            await Image.deleteMany({ _id: { $in: imageIds } });
        }
        if (audioIds.length > 0) {
            await Audio.deleteMany({ _id: { $in: audioIds } });
        }


        await Question.deleteMany({ characterId: charId });


        await Character.findByIdAndDelete(charId);

        console.log("Đã xóa sạch nhân vật, database và các file vật lý liên quan!");
        res.redirect('/admin');
    } catch (err) {
        console.log("Lỗi xóa nhân vật:", err);
        res.redirect('/admin');
    }
});
// Hàm trợ giúp: Lấy kịch bản từ file vật lý hoặc tự động tái tạo chuẩn xác từ cơ sở dữ liệu MongoDB
async function getOrReconstructCharacterScript(character) {
    if (!character) return '';

    // 1. Kiểm tra file vật lý trên đĩa nếu có
    if (character.scriptFilename) {
        var seedsDir = path.join(__dirname, '../public/uploads/seeds/');
        var scriptPath = path.join(seedsDir, character.scriptFilename);
        if (fs.existsSync(scriptPath)) {
            try {
                var content = fs.readFileSync(scriptPath, 'utf8');
                if (content && content.trim()) {
                    return content.trim();
                }
            } catch (e) {}
        }
    }

    // 2. Nếu file không tồn tại hoặc rỗng, tự động tái tạo từ Question & Answer trong MongoDB
    try {
        var questions = await Question.find({ characterId: character._id })
            .populate('answerId')
            .sort({ blockIndex: 1, createdAt: 1, _id: 1 });

        if (!questions || questions.length === 0) return '';

        var blockMap = {};
        questions.forEach(q => {
            var bIdx = (typeof q.blockIndex === 'number') ? q.blockIndex : 0;
            if (!blockMap[bIdx]) {
                blockMap[bIdx] = {
                    questions: [],
                    answerText: (q.answerId && q.answerId.answerText) ? q.answerId.answerText.trim() : ''
                };
            }
            if (q.questionText && q.questionText.trim()) {
                blockMap[bIdx].questions.push(q.questionText.trim());
            }
            if (!blockMap[bIdx].answerText && q.answerId && q.answerId.answerText) {
                blockMap[bIdx].answerText = q.answerId.answerText.trim();
            }
        });

        var blockIndices = Object.keys(blockMap).map(Number).sort((a, b) => a - b);
        var blockStrings = [];
        blockIndices.forEach(idx => {
            var block = blockMap[idx];
            var lines = [];
            block.questions.forEach(qText => {
                lines.push('Q: ' + qText);
            });
            if (block.answerText) {
                lines.push('A: ' + block.answerText);
            }
            if (lines.length > 0) {
                blockStrings.push(lines.join('\n'));
            }
        });

        var reconstructed = blockStrings.join('\n---\n');

        // Lưu lại file vật lý vào public/uploads/seeds để đảm bảo các lần sau luôn có sẵn
        if (reconstructed && reconstructed.trim()) {
            var seedsDir = path.join(__dirname, '../public/uploads/seeds/');
            if (!fs.existsSync(seedsDir)) fs.mkdirSync(seedsDir, { recursive: true });
            var genFilename = character.scriptFilename || ('script-char-' + character._id + '.txt');
            fs.writeFileSync(path.join(seedsDir, genFilename), reconstructed, 'utf8');
            if (!character.scriptFilename) {
                character.scriptFilename = genFilename;
                await character.save();
            }
        }

        return reconstructed;
    } catch (err) {
        console.error('Lỗi tái tạo kịch bản nhân vật từ CSDL:', err);
        return '';
    }
}

// GET: Lấy thông tin nhân vật để đưa lên form sửa
router.get('/character/edit/:id', async (req, res) => {
    try {
        const character = await Character.findById(req.params.id);
        var Setting = require('../schemas/Setting');
        var setting = await Setting.findOne({ key: 'admin_custom_icons' });
        var defaultIcons = ['🎮', '🍄', '⭐', '💻', '🧳', '🌿', '🍳', '⚔️', '⛏️', '🧙‍♂️', '🐱', '🌸', '💎', '📜', '🤖', '👑', '🔮', '🧸', '⚡', '🔥'];
        var adminIcons = (setting && Array.isArray(setting.value)) ? setting.value : defaultIcons;

        var existingScriptContent = await getOrReconstructCharacterScript(character);

        res.render('admin/EditCharacter', { 
            title: `Chỉnh sửa: ${character ? character.name : 'Nhân vật'}`,
            character,
            adminIcons: adminIcons,
            existingScriptContent: existingScriptContent
        });
    } catch (err) {
        res.redirect('/admin');
    }
});

// POST: Cập nhật thông tin & kịch bản mới
router.post('/character/update/:id', upload.any([
    { name: 'avatar', maxCount: 1 },
    { name: 'scriptFile', maxCount: 1 }
]), async (req, res) => {
    try {
        const charId = req.params.id;
        const { name, description, icon, scriptText } = req.body;
        const updateData = { name, description, icon: icon || '🍄', };

        // 1. Cập nhật Avatar va Backgroud
        var avatarFile = req.files ? req.files.find(f => f.fieldname === 'avatar') : null;
        if (avatarFile) {
            updateData.avatarUrl = '/uploads/images/avatar/' + avatarFile.filename;
        } else if (req.body.avatarUrl && req.body.avatarUrl.trim()) {
            updateData.avatarUrl = req.body.avatarUrl.trim();
        }

        var bgFile = req.files ? req.files.find(f => f.fieldname === 'backgroundUrl') : null;
        if (bgFile) {
            updateData.backgroundUrl = '/uploads/images/background/' + bgFile.filename;
        }

        var audioFile = req.files ? req.files.find(f => f.fieldname === 'nodeAudio_0' || f.fieldname === 'audio') : null;
        if (audioFile) {
            updateData.audioUrl = '/uploads/audios/' + audioFile.filename;
        } else if (req.body.audioUrl && req.body.audioUrl.trim()) {
            updateData.audioUrl = req.body.audioUrl.trim();
        }

        // 2. Cập nhật Kịch bản (Hỗ trợ tải file .txt HOẶC soạn trực tiếp trên web cho điện thoại)
        var scriptFile = req.files ? req.files.find(f => f.fieldname === 'scriptFile') : null;
        var seedsDir = path.join(__dirname, '../public/uploads/seeds/');
        if (!fs.existsSync(seedsDir)) fs.mkdirSync(seedsDir, { recursive: true });

        var newFileContent = '';
        if (scriptFile) {
            var filePath = path.join(seedsDir, scriptFile.filename);
            if (fs.existsSync(filePath)) {
                newFileContent = fs.readFileSync(filePath, 'utf8');
                updateData.scriptFilename = scriptFile.filename;
            }
        } else if (scriptText && scriptText.trim()) {
            newFileContent = scriptText.trim();
            var genFilename = 'script-mobile-' + Date.now() + '-' + Math.round(Math.random() * 1E6) + '.txt';
            fs.writeFileSync(path.join(seedsDir, genFilename), newFileContent, 'utf8');
            updateData.scriptFilename = genFilename;
        }

        // Cập nhật thông tin cơ bản nhân vật
        await Character.findByIdAndUpdate(charId, updateData);

        if (newFileContent && newFileContent.trim()) {
            // Xóa sạch toàn bộ kịch bản/câu hỏi cũ của nhân vật này trong CSDL
            await Question.deleteMany({ characterId: charId });
            await saveScriptToDatabase(newFileContent, charId, req.files || []);
        }

        res.redirect('/admin');
    } catch (err) {
        console.error("Lỗi cập nhật nhân vật & kịch bản:", err);
        res.redirect('/admin');
    }
});
// Route xử lý khi Admin bấm nút chọn/đổi nhân vật làm trang chủ
router.post('/character/update-default/:id', async (req, res) => {
    try {
        const charId = req.params.id;
        await Character.updateMany({}, { isDefault: false });
        await Character.findByIdAndUpdate(charId, { isDefault: true });
        res.redirect('/admin');
    } catch (err) {
        console.error("Lỗi cập nhật nhân vật mặc định:", err);
        res.redirect('/admin');
    }
});

var settingsUtils = require('../utils/settings');

// POST /admin/music-setting: Admin cập nhật phiên bản nhạc cho toàn hệ thống
router.post('/music-setting', async function(req, res) {
    try {
        var versionIndex = parseInt(req.body.versionIndex, 10);
        if (isNaN(versionIndex)) versionIndex = 0;
        var speed = parseFloat(req.body.speed) || 1.0;

        var updateData = {
            versionIndex: versionIndex,
            speed: speed
        };
        if (req.body.customAudioUrl !== undefined) {
            updateData.customAudioUrl = req.body.customAudioUrl;
            if (req.body.title) updateData.title = req.body.title;
        } else {
            updateData.customAudioUrl = null;
        }
        if (req.body.autoplayAll !== undefined) {
            updateData.autoplayAll = Boolean(req.body.autoplayAll);
        }

        var updated = await settingsUtils.updateMusicSetting(updateData);

        res.json({ success: true, setting: updated });
    } catch (err) {
        console.error('Lỗi cập nhật music-setting:', err);
        res.json({ success: false, error: 'Không thể cập nhật cài đặt nhạc!' });
    }
});

// POST /admin/music-autoplay: Admin bật / tắt tự động phát tất cả các bài cho toàn hệ thống
router.post('/music-autoplay', async function(req, res) {
    try {
        var autoplayAll = Boolean(req.body.autoplayAll);
        var updated = await settingsUtils.updateMusicSetting({
            autoplayAll: autoplayAll
        });
        res.json({ success: true, autoplayAll: updated.autoplayAll, setting: updated });
    } catch (err) {
        console.error('Lỗi cập nhật music-autoplay:', err);
        res.json({ success: false, error: 'Không thể cập nhật cài đặt autoplay!' });
    }
});

// POST /admin/music-versions: Admin lưu danh sách các phiên bản nhạc (thêm, sửa tên, link URL, tốc độ, xóa)
router.post('/music-versions', async function(req, res) {
    try {
        var versions = req.body.versions;
        if (!Array.isArray(versions) || versions.length === 0) {
            return res.json({ success: false, error: 'Danh sách bài hát không hợp lệ!' });
        }
        var updated = await settingsUtils.updateMusicSetting({
            versions: versions
        });
        res.json({ success: true, setting: updated, versions: updated.versions });
    } catch (err) {
        console.error('Lỗi cập nhật music-versions:', err);
        res.json({ success: false, error: 'Không thể cập nhật danh sách bài hát!' });
    }
});

var TrackAudio = require('../schemas/TrackAudio');

// POST /admin/music-track-upload: Tải lên file MP3 cho từng bài hát cụ thể và lưu vĩnh viễn vào MongoDB Atlas
router.post('/music-track-upload', upload.single('trackAudio'), async function(req, res) {
    try {
        if (!req.file) {
            return res.json({ success: false, error: 'Vui lòng chọn file âm thanh .mp3 hoặc .m4a!' });
        }
        var fileBuffer = null;
        if (req.file.buffer) {
            fileBuffer = req.file.buffer;
        } else if (req.file.path && fs.existsSync(req.file.path)) {
            fileBuffer = fs.readFileSync(req.file.path);
        }

        if (!fileBuffer || fileBuffer.length === 0) {
            return res.json({ success: false, error: 'Không thể đọc dữ liệu file âm thanh!' });
        }

        // Lưu trực tiếp file âm thanh vào MongoDB Atlas để tồn tại vĩnh viễn không phụ thuộc disk Render
        var doc = await TrackAudio.create({
            filename: req.file.originalname,
            contentType: req.file.mimetype || 'audio/mpeg',
            size: fileBuffer.length,
            data: fileBuffer
        });

        var audioUrl = '/api/track-audio/' + doc._id + '.mp3';
        res.json({ success: true, audioUrl: audioUrl, fileName: req.file.originalname });
    } catch (err) {
        console.error('Lỗi upload file MP3 bài hát:', err);
        res.json({ success: false, error: 'Lỗi tải lên file âm thanh!' });
    }
});

// POST /admin/music-upload: Admin tải file MP3 tùy chỉnh phát cho toàn website
router.post('/music-upload', upload.single('musicFile'), async function(req, res) {
    try {
        if (!req.file) {
            return res.json({ success: false, error: 'Vui lòng chọn file âm thanh .mp3!' });
        }
        var audioUrl = '/uploads/audios/' + req.file.filename;
        var updated = await settingsUtils.updateMusicSetting({
            customAudioUrl: audioUrl,
            customFileName: req.file.originalname,
            title: req.file.originalname.replace(/\.[^/.]+$/, "")
        });

        res.json({ success: true, audioUrl: audioUrl, setting: updated });
    } catch (err) {
        console.error('Lỗi upload nhạc của admin:', err);
        res.json({ success: false, error: 'Lỗi tải lên file âm thanh!' });
    }
});

// ========================================================
// API QUẢN LÝ DANH SÁCH TÀI KHOẢN ADMIN (MULTI-ADMIN ACCOUNTS)
// Chỉ dành riêng cho Super Admin
// ========================================================

// 1. Lấy danh sách các tài khoản admin (Chỉ Super Admin)
router.get('/api/accounts', requireSuperAdmin, async function(req, res) {
    try {
        var Admin = require('../schemas/Admin');
        var admins = await Admin.find({}).select('-passwordHash').sort({ createdAt: 1 });
        res.json({ success: true, admins: admins, currentAdmin: req.adminUser });
    } catch (err) {
        console.error('Lỗi lấy danh sách admin:', err);
        res.status(500).json({ success: false, error: 'Không thể lấy danh sách tài khoản admin!' });
    }
});

// 2. Tạo tài khoản admin mới (Chỉ Super Admin)
router.post('/api/accounts/create', requireSuperAdmin, async function(req, res) {
    try {
        var Admin = require('../schemas/Admin');
        var username = (req.body.username || '').trim().toLowerCase();
        var password = (req.body.password || '').trim();
        var fullName = (req.body.fullName || '').trim() || 'Quản trị viên';
        var role = req.body.role === 'superadmin' ? 'superadmin' : 'admin';

        if (!username || username.length < 3) {
            return res.json({ success: false, error: 'Tên tài khoản phải từ 3 ký tự trở lên!' });
        }
        if (!password || password.length < 6) {
            return res.json({ success: false, error: 'Mật khẩu phải từ 6 ký tự trở lên để đảm bảo an toàn!' });
        }

        var existing = await Admin.findOne({ username: username });
        if (existing) {
            return res.json({ success: false, error: `Tài khoản "${username}" đã tồn tại trên hệ thống!` });
        }

        var passwordHash = await Admin.hashPassword(password);
        var newAdmin = await Admin.create({
            username: username,
            passwordHash: passwordHash,
            fullName: fullName,
            role: role
        });

        res.json({ 
            success: true, 
            message: `Đã tạo thành công tài khoản quản trị "${username}"!`,
            admin: {
                _id: newAdmin._id,
                username: newAdmin.username,
                fullName: newAdmin.fullName,
                role: newAdmin.role,
                createdAt: newAdmin.createdAt
            }
        });
    } catch (err) {
        console.error('Lỗi tạo tài khoản admin:', err);
        res.status(500).json({ success: false, error: 'Lỗi khi tạo tài khoản admin mới!' });
    }
});

// 3. Đổi mật khẩu cho một tài khoản admin (Chỉ Super Admin)
router.post('/api/accounts/change-password', requireSuperAdmin, async function(req, res) {
    try {
        var Admin = require('../schemas/Admin');
        var adminId = req.body.adminId;
        var newPassword = (req.body.newPassword || '').trim();

        if (!newPassword || newPassword.length < 6) {
            return res.json({ success: false, error: 'Mật khẩu mới phải từ 6 ký tự trở lên!' });
        }

        var admin = await Admin.findById(adminId);
        if (!admin) {
            return res.json({ success: false, error: 'Không tìm thấy tài khoản quản trị cần đổi mật khẩu!' });
        }

        // Không cho phép đổi mật khẩu tài khoản gốc "admin" (Super Administrator)
        var usernameLower = (admin.username || '').toLowerCase();
        if (usernameLower === 'admin' || admin.fullName === 'Super Administrator') {
            return res.json({
                success: false,
                error: 'Tài khoản gốc "admin" (Super Administrator) được bảo vệ cố định bởi hệ thống, không được phép đổi mật khẩu hay xóa!'
            });
        }

        admin.passwordHash = await Admin.hashPassword(newPassword);
        await admin.save();

        res.json({ success: true, message: `Đã cập nhật mật khẩu mới cho tài khoản "${admin.username}"!` });
    } catch (err) {
        console.error('Lỗi đổi mật khẩu admin:', err);
        res.status(500).json({ success: false, error: 'Không thể cập nhật mật khẩu!' });
    }
});

// 4. Xóa tài khoản admin (Chỉ Super Admin)
router.post('/api/accounts/delete', requireSuperAdmin, async function(req, res) {
    try {
        var Admin = require('../schemas/Admin');
        var adminId = req.body.adminId;

        var targetAdmin = await Admin.findById(adminId);
        if (!targetAdmin) {
            return res.json({ success: false, error: 'Không tìm thấy tài khoản để xóa!' });
        }

        // Không cho phép xóa tài khoản gốc "admin" (Super Administrator)
        var usernameLower = (targetAdmin.username || '').toLowerCase();
        if (usernameLower === 'admin' || targetAdmin.fullName === 'Super Administrator') {
            return res.json({
                success: false,
                error: 'Tài khoản gốc "admin" (Super Administrator) được bảo vệ cố định bởi hệ thống, không được phép xóa hay đổi mật khẩu!'
            });
        }

        // Cấm tự xóa tài khoản đang đăng nhập
        if (targetAdmin.username === req.adminUser) {
            return res.json({ success: false, error: 'Bạn không thể tự xóa tài khoản mà bạn đang sử dụng để đăng nhập!' });
        }

        // Đảm bảo hệ thống luôn còn ít nhất 1 tài khoản
        var totalCount = await Admin.countDocuments();
        if (totalCount <= 1) {
            return res.json({ success: false, error: 'Không thể xóa! Hệ thống bắt buộc phải giữ lại ít nhất 1 tài khoản quản trị!' });
        }

        await Admin.findByIdAndDelete(adminId);
        res.json({ success: true, message: `Đã xóa tài khoản "${targetAdmin.username}" thành công!` });
    } catch (err) {
        console.error('Lỗi xóa admin:', err);
        res.status(500).json({ success: false, error: 'Lỗi khi xóa tài khoản admin!' });
    }
});

// ========================================================
// API QUẢN LÝ NGƯỜI DÙNG ĐÃ VÀO TRÒ CHUYỆN (CHAT USERS)
// ========================================================

// 1. Lấy danh sách người dùng đã vào trò chuyện
router.get('/api/chat-users', async function(req, res) {
    try {
        var User = require('../schemas/User');
        var users = await User.find({}).sort({ lastActive: -1, createdAt: -1 });
        res.json({ success: true, users: users, total: users.length });
    } catch (err) {
        console.error('Lỗi lấy danh sách chat users:', err);
        res.status(500).json({ success: false, error: 'Không thể lấy danh sách người dùng!' });
    }
});

// 2. Xóa người dùng (giải phóng tên hoặc dọn dẹp - Chỉ Super Admin)
router.post('/api/chat-users/delete', requireSuperAdmin, async function(req, res) {
    try {
        var User = require('../schemas/User');
        var userId = req.body.userId;
        var targetUser = await User.findById(userId);
        if (!targetUser) {
            return res.json({ success: false, error: 'Không tìm thấy người dùng cần xóa!' });
        }

        await User.findByIdAndDelete(userId);
        res.json({ success: true, message: `Đã xóa người dùng "${targetUser.username}" khỏi hệ thống thành công!` });
    } catch (err) {
        console.error('Lỗi xóa chat user:', err);
        res.status(500).json({ success: false, error: 'Lỗi khi xóa người dùng!' });
    }
});

// 3. API Quản lý danh sách Icon gợi ý (Custom Icons Picker)
router.get('/api/icons', async function(req, res) {
    try {
        var Setting = require('../schemas/Setting');
        var setting = await Setting.findOne({ key: 'admin_custom_icons' });
        var defaultIcons = ['🎮', '🍄', '⭐', '💻', '🧳', '🌿', '🍳', '⚔️', '⛏️', '🧙‍♂️', '🐱', '🌸', '💎', '📜', '🤖', '👑', '🔮', '🧸', '⚡', '🔥'];
        res.json({ success: true, icons: (setting && Array.isArray(setting.value)) ? setting.value : defaultIcons });
    } catch (err) {
        res.json({ success: false, error: 'Lỗi tải danh sách icon!' });
    }
});

router.post('/api/icons', async function(req, res) {
    try {
        var Setting = require('../schemas/Setting');
        var icons = req.body.icons;
        if (!Array.isArray(icons)) {
            return res.status(400).json({ success: false, error: 'Dữ liệu icon không hợp lệ!' });
        }
        await Setting.findOneAndUpdate(
            { key: 'admin_custom_icons' },
            { key: 'admin_custom_icons', value: icons, updatedAt: new Date() },
            { upsert: true, new: true }
        );
        res.json({ success: true, message: 'Đã lưu danh sách icon thành công!' });
    } catch (err) {
        console.error('Lỗi lưu icons:', err);
        res.status(500).json({ success: false, error: 'Lỗi khi lưu danh sách icon!' });
    }
});

// 4. API Quản lý Text Thiệp khi Game Over
router.get('/api/game-card', async function(req, res) {
    try {
        var settingsUtils = require('../utils/settings');
        res.json({ success: true, card: settingsUtils.getGameCardSetting() });
    } catch (err) {
        res.json({ success: false, error: 'Lỗi tải cài đặt thiệp!' });
    }
});

router.post('/api/game-card', async function(req, res) {
    try {
        var settingsUtils = require('../utils/settings');
        var { title, message, messages, isRandom, sender, buttonText } = req.body;
        
        var validMessages = Array.isArray(messages) 
            ? messages.map(function(m) { return String(m).trim(); }).filter(Boolean) 
            : [];
            
        if (validMessages.length === 0 && message && message.trim()) {
            validMessages = [message.trim()];
        }
        
        var primaryMessage = (message && message.trim()) 
            ? message.trim() 
            : (validMessages[0] || 'Thiệp mời tham dự Lễ Tốt Nghiệp 🎓✨');

        var updatedCard = await settingsUtils.updateGameCardSetting({
            title: title ? title.trim() : 'Thiệp Mời Tốt Nghiệp 💌',
            message: primaryMessage,
            messages: validMessages, // Lưu chính xác các câu người dùng tự thêm, không chèn câu mẫu Mario cũ
            isRandom: (isRandom !== undefined) ? (isRandom === true || isRandom === 'true' || isRandom === 1) : true,
            sender: sender ? sender.trim() : 'Từ Hoàng Yến',
            buttonText: buttonText ? buttonText.trim() : '🔄 Chơi lại ngay'
        });
        res.json({ success: true, message: 'Đã lưu cài đặt text thiệp thành công!', card: updatedCard });
    } catch (err) {
        console.error('Lỗi lưu text thiệp:', err);
        res.status(500).json({ success: false, error: 'Lỗi khi lưu cài đặt text thiệp!' });
    }
});

// 5. API Quản lý Tiêu đề Website & Logo Thương hiệu
router.get('/api/brand-setting', async function(req, res) {
    try {
        var settingsUtils = require('../utils/settings');
        res.json({ success: true, brand: settingsUtils.getBrandSetting() });
    } catch (err) {
        res.json({ success: false, error: 'Lỗi tải cài đặt thương hiệu!' });
    }
});

router.post('/api/brand-setting', async function(req, res) {
    try {
        var settingsUtils = require('../utils/settings');
        var brandTitle = req.body.brandTitle ? String(req.body.brandTitle).trim() : 'Graduation';
        var brandIcon = (req.body.brandIcon !== undefined) ? String(req.body.brandIcon).trim() : '';
        var welcomeText = req.body.welcomeText ? String(req.body.welcomeText).trim() : 'Cảm ơn bạn đã nhấn vào web để mình có cơ hội gửi bạn tấm thiệp nhằm mời bạn đến với lễ tốt nghiệp của mình';

        var updated = await settingsUtils.updateBrandSetting({
            brandTitle: brandTitle,
            brandIcon: brandIcon,
            welcomeText: welcomeText
        });
        res.json({ success: true, message: 'Đã lưu cài đặt tiêu đề thương hiệu thành công!', brand: updated });
    } catch (err) {
        console.error('Lỗi lưu cài đặt thương hiệu:', err);
        res.status(500).json({ success: false, error: 'Lỗi khi lưu cài đặt tiêu đề thương hiệu!' });
    }
});

module.exports = router;