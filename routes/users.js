const express = require('express');
const router = express.Router();
const db = require('../config/database');
const bcrypt = require('bcryptjs');
const { requireAdmin } = require('../middleware/auth');

router.get('/', requireAdmin, async (req, res) => {
    const [users] = await db.query('SELECT id, username, fullname, role, created_at FROM users ORDER BY created_at DESC');
    res.render('users/index', { user: req.session.user, currentPath: '/users', title: 'Quản lý người dùng', users, error: null, success: null });
});

router.post('/add', requireAdmin, async (req, res) => {
    const { username, fullname, password, role } = req.body;
    try {
        const [existing] = await db.query('SELECT id FROM users WHERE username = ?', [username]);
        if (existing.length > 0) {
            const [users] = await db.query('SELECT id, username, fullname, role, created_at FROM users ORDER BY created_at DESC');
            return res.render('users/index', { user: req.session.user, currentPath: '/users', title: 'Quản lý người dùng', users, error: 'Tên đăng nhập đã tồn tại', success: null });
        }
        const hashed = await bcrypt.hash(password, 10);
        const Blockchain = require('../blockchain/Blockchain');
        const { privateKey, publicKey } = Blockchain.generateKeyPair();
        await db.query('INSERT INTO users (username, fullname, password, role, private_key, public_key) VALUES (?, ?, ?, ?, ?, ?)', [username, fullname, hashed, role, privateKey, publicKey]);
        const [users] = await db.query('SELECT id, username, fullname, role, created_at FROM users ORDER BY created_at DESC');
        res.render('users/index', { user: req.session.user, currentPath: '/users', title: 'Quản lý người dùng', users, error: null, success: 'Thêm người dùng thành công' });
    } catch (err) {
        const [users] = await db.query('SELECT id, username, fullname, role, created_at FROM users ORDER BY created_at DESC');
        res.render('users/index', { user: req.session.user, currentPath: '/users', title: 'Quản lý người dùng', users, error: err.message, success: null });
    }
});

router.post('/delete/:id', requireAdmin, async (req, res) => {
    if (parseInt(req.params.id) === req.session.user.id) {
        const [users] = await db.query('SELECT id, username, fullname, role, created_at FROM users ORDER BY created_at DESC');
        return res.render('users/index', { user: req.session.user, currentPath: '/users', title: 'Quản lý người dùng', users, error: 'Không thể xóa chính mình', success: null });
    }
    await db.query('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.redirect('/users');
});

module.exports = router;
