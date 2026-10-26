var express = require('express');
var router = express.Router();
var Character = require('../schemas/Character'); 
var Question = require('../schemas/Question');

/* GET home page. */
router.get('/', async function(req, res, next) {
    try {
        var defaultCharacter = await Character.findOne({ isDefault: true });

        if (!defaultCharacter) {
            defaultCharacter = await Character.findOne({});
        }

        // Render giao diện trang chủ / chào mừng (ví dụ file views/*/*.ejs)
        res.render('page/home', { 
            title: 'Phổi bạn không phải tôi',
            defaultCharacter: defaultCharacter 
        });
    } catch (err) {
        console.log("Lỗi trang chủ:", err);
        res.render('user/Home', { 
            title: 'Trang Chủ',
            defaultCharacter: null 
        });
    }
});

module.exports = router;
