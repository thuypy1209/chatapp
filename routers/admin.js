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
        } else if (file.fieldname === 'audioFile' || file.fieldname === 'audio' || file.fieldname === 'musicFile' || file.fieldname.startsWith('nodeAudio_')) {
            // Lưu vào thư mục public/uploads/audios/
            cb(null, 'public/uploads/audios/');
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
            error: 'Bạn không có quyền thực hiện thao tác này! Chỉ Super Admin mới có quyền quản lý tài khoản quản trị.'
        });
    }
    next();
}

// 1. Hiển thị trang quản lý Admin (Bao gồm danh sách nhân vật và form thêm)
router.get('/', async function(req, res) {
    try {
        var Admin = require('../schemas/Admin');
        var characters = await Character.find({});
        var isSuperAdmin = !!req.isSuperAdmin;
        var admins = isSuperAdmin ? await Admin.find({}).select('-passwordHash').sort({ createdAt: 1 }) : [];
        res.render('admin/Admin', { 
            title: 'Quản trị Admin',
            characters: characters,
            admins: admins,
            currentAdmin: req.adminUser,
            currentAdminRole: req.adminObj ? req.adminObj.role : 'admin',
            isSuperAdmin: isSuperAdmin
        });
    } catch (err) {
        console.log("Lỗi lấy danh sách nhân vật cho admin:", err);
        res.render('admin/Admin', { characters: [], admins: [], isSuperAdmin: false, currentAdmin: req.adminUser });
    }
});

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

        // 3. Đọc file .txt kịch bản

        if (scriptFile) {
            var filePath = path.join(__dirname, '../public/uploads/seeds/', scriptFile.filename);
            var fileContent = fs.readFileSync(filePath, 'utf8');

            // // Xóa file tạm ngay sau khi đọc xong
            // fs.unlink(filePath, function(err) {
            //     if (err) console.error("Lỗi xóa file tạm:", err);
            // });

            // Phân tách các khối hội thoại dựa vào dấu ngăn cách "---"
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
                        qTexts.push(line.replace('Q:', '').trim());
                    } else if (line.startsWith('A:')) {
                        aText = line.replace('A:', '').trim();
                    }
                });

                if (qTexts.length > 0) {
                    var imgFile = req.files.find(f => f.fieldname === `nodeImage_${i}`);
                    var audioFile = req.files.find(f => f.fieldname === `nodeAudio_${i}`);

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
                        characterId: newChar._id, // hoặc newChar._id nếu ở hàm add
                        blockIndex: blockIdx,
                        isRoot: blockIdx === 0 // Đánh dấu đây là các câu hỏi khởi đầu ở block đầu tiên
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
// GET: Lấy thông tin nhân vật để đưa lên form sửa
router.get('/character/edit/:id', async (req, res) => {
    try {
        const character = await Character.findById(req.params.id);
        res.render('admin/EditCharacter', { 
            title: `Chỉnh sửa: ${character ? character.name : 'Nhân vật'}`,
            character 
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
        const { name, description, icon } = req.body;
        const updateData = { name, description, icon: icon || '😀', };

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

        // Cập nhật thông tin cơ bản nhân vật
        await Character.findByIdAndUpdate(charId, updateData);

        // 2. Cập nhật Kịch bản .txt (nếu người dùng tải file mới)
        var scriptFile = req.files ? req.files.find(f => f.fieldname === 'scriptFile') : null;
        if (scriptFile) {
            var filePath = path.join(__dirname, '../public/uploads/seeds/', scriptFile.filename);

            if (fs.existsSync(filePath)) {
                var fileContent = fs.readFileSync(filePath, 'utf8');

                // fs.unlink(filePath, function(err) {
                //     if (err) console.error("Lỗi xóa file tạm:", err);
                // });

                // Xóa sạch toàn bộ kịch bản/câu hỏi cũ của nhân vật này trong CSDL
                await Question.deleteMany({ characterId: charId });

                // Phân tách các khối kịch bản theo dấu "---"
                var blocks = fileContent.split('---').map(b => b.trim()).filter(b => b.length > 0);

                var answersToInsert = [];
                var blockDataList = [];
                var imagesToInsert = [];
                var audiosToInsert = [];

                // Parse từng khối trong file .txt
                for (var i = 0; i < blocks.length; i++) {
                    var lines = blocks[i].split('\n').map(l => l.trim()).filter(l => l.length > 0);
                    var qTexts = [];
                    var aText = "";

                    lines.forEach(line => {
                        if (line.startsWith('Q:')) {
                            qTexts.push(line.replace('Q:', '').trim());
                        } else if (line.startsWith('A:')) {
                            aText = line.replace('A:', '').trim();
                        }
                    });

                    if (qTexts.length > 0) {
                        var imgFile = req.files.find(f => f.fieldname === `nodeImage_${i}`);
                        var audioFile = req.files.find(f => f.fieldname === `nodeAudio_${i}`);

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

                // Lưu các câu trả lời (Answer) mới vào MongoDB
                var createdAnswers = answersToInsert.length > 0 ? await Answer.insertMany(answersToInsert) : [];
                var createdImages = imagesToInsert.length > 0 ? await Image.insertMany(imagesToInsert) : [];
                var createdAudios = audiosToInsert.length > 0 ? await Audio.insertMany(audiosToInsert) : [];

                // Tạo danh sách câu hỏi (Question) mới
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

                // Liên kết mạng lưới phân nhánh nextQuestions giữa các khối
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

        var updated = await settingsUtils.updateMusicSetting({
            versionIndex: versionIndex,
            speed: speed,
            customAudioUrl: null
        });

        res.json({ success: true, setting: updated });
    } catch (err) {
        console.error('Lỗi cập nhật music-setting:', err);
        res.json({ success: false, error: 'Không thể cập nhật cài đặt nhạc!' });
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

module.exports = router;