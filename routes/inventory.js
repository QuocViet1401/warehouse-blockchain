const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireLogin } = require('../middleware/auth');

router.get('/', requireLogin, async (req, res) => {
    const [products] = await db.query('SELECT * FROM products ORDER BY stock ASC');
    const low_stock = products.filter(p => p.stock <= 10);
    res.render('inventory/index', { user: req.session.user, currentPath: '/inventory', title: 'Quản lý tồn kho', products, low_stock });
});

module.exports = router;
