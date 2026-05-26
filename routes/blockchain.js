const express = require('express');
const router = express.Router();
const db = require('../config/database');
const Blockchain = require('../blockchain/Blockchain');
const { requireLogin } = require('../middleware/auth');

router.get('/', requireLogin, async (req, res) => {
    const blockchain = new Blockchain(db);
    const chain = await blockchain.getChain();
    const isValid = await blockchain.isChainValid();
    res.render('blockchain/index', { user: req.session.user, currentPath: '/blockchain', title: 'Lịch sử Blockchain', chain, isValid });
});

router.get('/product/:id', requireLogin, async (req, res) => {
    const blockchain = new Blockchain(db);
    const [productRows] = await db.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (productRows.length === 0) return res.redirect('/blockchain');
    const transactions = await blockchain.getTransactionsByProduct(req.params.id);
    res.render('blockchain/product', { user: req.session.user, currentPath: '/blockchain', title: 'Truy xuất sản phẩm - ' + productRows[0].name, product: productRows[0], transactions });
});

module.exports = router;
