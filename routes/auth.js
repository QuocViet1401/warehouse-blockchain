const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/database');

router.get('/login', (req, res) => {
    if (req.session.user) return res.redirect('/dashboard');
    res.render('login', { error: null });
});

router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
        if (rows.length === 0) {
            return res.render('login', { error: 'Tên đăng nhập hoặc mật khẩu không đúng' });
        }
        const user = rows[0];
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.render('login', { error: 'Tên đăng nhập hoặc mật khẩu không đúng' });
        }
        req.session.user = { id: user.id, username: user.username, role: user.role, fullname: user.fullname };
        res.redirect('/dashboard');
    } catch (err) {
        console.error('Login error:', err.message);
        res.render('login', { error: 'Lỗi hệ thống, vui lòng thử lại' });
    }
});

router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

module.exports = router;
