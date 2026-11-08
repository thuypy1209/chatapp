var express = require('express');
var router = express.Router();
var Character = require('../schemas/Character'); 
var Question = require('../schemas/Question');

/* GET home page. */
router.get('/', async function(req, res, next) {
    try {
        var allCharacters = await Character.find({});
        var defaultCharacter = await Character.findOne({ isDefault: true });

        if (!defaultCharacter) {
            defaultCharacter = allCharacters.length > 0 ? allCharacters[0] : null;
        }

        // Render giao diện trang chủ / chào mừng (ví dụ file views/*/*.ejs)
        var brand = (res.locals.siteBrand && res.locals.siteBrand.brandTitle) ? res.locals.siteBrand.brandTitle : 'Graduation';
        res.render('page/home', { 
            title: brand,
            defaultCharacter: defaultCharacter,
            allCharacters: allCharacters
        });
    } catch (err) {
        console.log("Lỗi trang chủ:", err);
        res.render('page/home', { 
            title: 'Trang Chủ',
            defaultCharacter: null,
            allCharacters: []
        });
    }
});

module.exports = router;
