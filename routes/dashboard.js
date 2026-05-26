const express = require('express');
const router = express.Router();
const db = require('../config/database');
const Blockchain = require('../blockchain/Blockchain');
const { requireLogin } = require('../middleware/auth');

function toDateKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

router.get('/', requireLogin, async (req, res) => {
    try {
        // Stat cards
        const [[{ total_products }]] = await db.query('SELECT COUNT(*) as total_products FROM products');
        const [[{ total_import }]]   = await db.query('SELECT COALESCE(SUM(quantity),0) as total_import FROM import_orders');
        const [[{ total_export }]]   = await db.query('SELECT COALESCE(SUM(quantity),0) as total_export FROM export_orders');
        const [[{ total_stock }]]    = await db.query('SELECT COALESCE(SUM(stock),0) as total_stock FROM products');
        const [low_stock]            = await db.query('SELECT * FROM products WHERE stock <= 10 ORDER BY stock ASC LIMIT 5');

        // Recent activity
        const [recent_imports] = await db.query(`
            SELECT i.*, p.name as product_name, u.fullname as created_by_name
            FROM import_orders i JOIN products p ON i.product_id=p.id JOIN users u ON i.created_by=u.id
            ORDER BY i.created_at DESC LIMIT 5`);
        const [recent_exports] = await db.query(`
            SELECT e.*, p.name as product_name, u.fullname as created_by_name
            FROM export_orders e JOIN products p ON e.product_id=p.id JOIN users u ON e.created_by=u.id
            ORDER BY e.created_at DESC LIMIT 5`);

        // Biểu đồ xu hướng 7 ngày
        const chartLabels = [], dateKeys = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            dateKeys.push(toDateKey(d));
            chartLabels.push(`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`);
        }
        const importByDay = Object.fromEntries(dateKeys.map(k => [k, 0]));
        const exportByDay = Object.fromEntries(dateKeys.map(k => [k, 0]));

        const [importTrend] = await db.query(
            'SELECT DATE(created_at) as day, SUM(quantity) as total FROM import_orders WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) GROUP BY DATE(created_at)');
        const [exportTrend] = await db.query(
            'SELECT DATE(created_at) as day, SUM(quantity) as total FROM export_orders WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) GROUP BY DATE(created_at)');

        const toKey = r => r.day instanceof Date ? toDateKey(r.day) : String(r.day).substring(0,10);
        importTrend.forEach(r => { const k=toKey(r); if(k in importByDay) importByDay[k]=Number(r.total); });
        exportTrend.forEach(r => { const k=toKey(r); if(k in exportByDay) exportByDay[k]=Number(r.total); });

        const chartImport = dateKeys.map(k => importByDay[k]);
        const chartExport = dateKeys.map(k => exportByDay[k]);

        // Biểu đồ tồn kho theo danh mục
        const [categoryStock] = await db.query(
            "SELECT COALESCE(category,'Khác') as category, SUM(stock) as total FROM products GROUP BY category ORDER BY total DESC");

        // Thông tin Blockchain
        const [[{ total_blocks }]]  = await db.query('SELECT COUNT(*) as total_blocks FROM blockchain');
        const [[{ signed_blocks }]] = await db.query("SELECT COUNT(*) as signed_blocks FROM blockchain WHERE signature IS NOT NULL AND signature != ''");
        const [lastRows]            = await db.query('SELECT block_index, hash, timestamp, nonce, tx_id FROM blockchain ORDER BY block_index DESC LIMIT 1');
        const blockchain = new Blockchain(db);
        const chainValid = await blockchain.isChainValid();

        res.render('dashboard', {
            user: req.session.user, currentPath: '/dashboard', title: 'Tổng quan',
            stats: { total_products, total_import, total_export, total_stock },
            low_stock, recent_imports, recent_exports,
            chartLabels, chartImport, chartExport,
            categoryStock,
            blockchainStats: {
                total_blocks: Number(total_blocks),
                signed_blocks: Number(signed_blocks),
                last_block: lastRows[0] || null,
                chainValid
            }
        });
    } catch (err) {
        res.render('error', { message: err.message, user: req.session.user, currentPath: '' });
    }
});

module.exports = router;
