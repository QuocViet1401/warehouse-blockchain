const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireLogin, requireAdmin } = require('../middleware/auth');

router.get('/', requireLogin, async (req, res) => {
    const search = req.query.search || '';
    const category = req.query.category || '';
    let query = 'SELECT * FROM products WHERE 1=1';
    const params = [];
    if (search) {
        query += ' AND (name LIKE ? OR code LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
    }
    if (category) {
        query += ' AND category = ?';
        params.push(category);
    }
    query += ' ORDER BY created_at DESC';
    const [products] = await db.query(query, params);
    const [categories] = await db.query('SELECT DISTINCT category FROM products WHERE category IS NOT NULL');
    res.render('products/index', { user: req.session.user, currentPath: '/products', title: 'Sản phẩm', products, categories, search, category });
});

router.get('/add', requireAdmin, (req, res) => {
    res.render('products/form', { user: req.session.user, currentPath: '/products', title: 'Thêm sản phẩm', product: null, error: null });
});

router.post('/add', requireAdmin, async (req, res) => {
    const { code, name, stock, price, category } = req.body;
    try {
        const [existing] = await db.query('SELECT id FROM products WHERE code = ?', [code]);
        if (existing.length > 0) {
            return res.render('products/form', { user: req.session.user, currentPath: '/products', title: 'Thêm sản phẩm', product: req.body, error: 'Mã sản phẩm đã tồn tại' });
        }
        await db.query('INSERT INTO products (code, name, stock, price, category) VALUES (?, ?, ?, ?, ?)',
            [code, name, parseInt(stock) || 0, parseFloat(price) || 0, category]);
        res.redirect('/products');
    } catch (err) {
        res.render('products/form', { user: req.session.user, currentPath: '/products', title: 'Thêm sản phẩm', product: req.body, error: err.message });
    }
});

router.get('/edit/:id', requireAdmin, async (req, res) => {
    const [rows] = await db.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.redirect('/products');
    res.render('products/form', { user: req.session.user, currentPath: '/products', title: 'Sửa sản phẩm', product: rows[0], error: null });
});

router.post('/edit/:id', requireAdmin, async (req, res) => {
    const { code, name, price, category } = req.body;
    try {
        const [existing] = await db.query('SELECT id FROM products WHERE code = ? AND id != ?', [code, req.params.id]);
        if (existing.length > 0) {
            return res.render('products/form', { user: req.session.user, currentPath: '/products', title: 'Sửa sản phẩm', product: { ...req.body, id: req.params.id }, error: 'Mã sản phẩm đã tồn tại' });
        }
        await db.query('UPDATE products SET code = ?, name = ?, price = ?, category = ? WHERE id = ?',
            [code, name, parseFloat(price) || 0, category, req.params.id]);
        res.redirect('/products');
    } catch (err) {
        res.render('products/form', { user: req.session.user, currentPath: '/products', title: 'Sửa sản phẩm', product: { ...req.body, id: req.params.id }, error: err.message });
    }
});

router.post('/delete/:id', requireAdmin, async (req, res) => {
    await db.query('DELETE FROM products WHERE id = ?', [req.params.id]);
    res.redirect('/products');
});

router.get('/detail/:id', requireLogin, async (req, res) => {
    const [rows] = await db.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.redirect('/products');
    const [import_history] = await db.query(`
        SELECT i.*, u.fullname as created_by_name FROM import_orders i
        JOIN users u ON i.created_by = u.id
        WHERE i.product_id = ? ORDER BY i.created_at DESC
    `, [req.params.id]);
    const [export_history] = await db.query(`
        SELECT e.*, u.fullname as created_by_name FROM export_orders e
        JOIN users u ON e.created_by = u.id
        WHERE e.product_id = ? ORDER BY e.created_at DESC
    `, [req.params.id]);
    res.render('products/detail', { user: req.session.user, currentPath: '/products', title: 'Chi tiết sản phẩm', product: rows[0], import_history, export_history });
});

module.exports = router;
