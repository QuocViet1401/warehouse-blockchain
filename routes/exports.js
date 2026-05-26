const express = require('express');
const router = express.Router();
const db = require('../config/database');
const Blockchain = require('../blockchain/Blockchain');
const { requireLogin } = require('../middleware/auth');

router.get('/', requireLogin, async (req, res) => {
    const [orders] = await db.query(`
        SELECT e.*, p.name as product_name, p.code as product_code, u.fullname as created_by_name
        FROM export_orders e
        JOIN products p ON e.product_id = p.id
        JOIN users u ON e.created_by = u.id
        ORDER BY e.created_at DESC
    `);
    res.render('exports/index', { user: req.session.user, currentPath: '/exports', title: 'Xuất kho', orders });
});

router.get('/add', requireLogin, async (req, res) => {
    const [products] = await db.query('SELECT * FROM products WHERE stock > 0 ORDER BY name ASC');
    res.render('exports/form', { user: req.session.user, currentPath: '/exports', title: 'Tạo phiếu xuất', products, error: null });
});

router.post('/add', requireLogin, async (req, res) => {
    const { product_id, quantity, note } = req.body;
    const qty = parseInt(quantity);
    if (!product_id || !qty || qty <= 0) {
        const [products] = await db.query('SELECT * FROM products WHERE stock > 0 ORDER BY name ASC');
        return res.render('exports/form', { user: req.session.user, currentPath: '/exports', title: 'Tạo phiếu xuất', products, error: 'Dữ liệu không hợp lệ' });
    }
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const [productRows] = await conn.query('SELECT * FROM products WHERE id = ? FOR UPDATE', [product_id]);
        if (productRows.length === 0) throw new Error('San pham khong ton tai');
        const product = productRows[0];
        if (product.stock < qty) throw new Error(`Không đủ hàng. Tồn kho hiện tại: ${product.stock}`);

        const [result] = await conn.query(
            'INSERT INTO export_orders (product_id, quantity, note, created_by) VALUES (?, ?, ?, ?)',
            [product_id, qty, note, req.session.user.id]
        );
        await conn.query('UPDATE products SET stock = stock - ? WHERE id = ?', [qty, product_id]);
        await conn.commit();

        const [keyRows] = await db.query('SELECT private_key, public_key FROM users WHERE id = ?', [req.session.user.id]);
        const blockchain = new Blockchain(db);
        await blockchain.addTransaction({
            order_id: result.insertId,
            product_id: parseInt(product_id),
            product_code: product.code,
            product_name: product.name,
            transaction_type: 'EXPORT',
            quantity: qty,
            note: note || '',
            performed_by: req.session.user.username,
            performed_by_id: req.session.user.id
        }, keyRows[0]?.private_key, keyRows[0]?.public_key);

        res.redirect('/exports');
    } catch (err) {
        await conn.rollback();
        const [products] = await db.query('SELECT * FROM products WHERE stock > 0 ORDER BY name ASC');
        res.render('exports/form', { user: req.session.user, currentPath: '/exports', title: 'Tạo phiếu xuất', products, error: err.message });
    } finally {
        conn.release();
    }
});

router.get('/:id', requireLogin, async (req, res) => {
    const crypto = require('crypto');
    const [orders] = await db.query(`
        SELECT e.*, p.name as product_name, p.code as product_code, p.category,
               u.fullname as created_by_name, u.username as created_by_username
        FROM export_orders e
        JOIN products p ON e.product_id = p.id
        JOIN users u ON e.created_by = u.id
        WHERE e.id = ?
    `, [req.params.id]);
    if (orders.length === 0) return res.redirect('/exports');

    const [blocks] = await db.query(
        "SELECT * FROM blockchain WHERE JSON_EXTRACT(data, '$.order_id') = ? AND JSON_EXTRACT(data, '$.transaction_type') = 'EXPORT'",
        [parseInt(req.params.id)]
    );

    let block = null, hashValid = false, sigValid = null;
    if (blocks.length > 0) {
        const rawData = blocks[0].data;
        block = { ...blocks[0], data: JSON.parse(rawData) };
        const recalculated = crypto.createHash('sha256')
            .update(block.block_index + block.previous_hash + block.timestamp + rawData + block.nonce)
            .digest('hex');
        hashValid = block.hash === recalculated;
        if (block.signature && block.data.public_key) {
            try {
                const v = crypto.createVerify('SHA256');
                v.update(block.hash);
                sigValid = v.verify(block.data.public_key, block.signature, 'hex');
            } catch { sigValid = false; }
        }
    }

    res.render('exports/detail', {
        user: req.session.user, currentPath: '/exports',
        title: 'Phiếu xuất #' + req.params.id,
        order: orders[0], block, hashValid, sigValid
    });
});

module.exports = router;
