const crypto = require('crypto');

const DIFFICULTY = 3; 

class Block {
    constructor(index, timestamp, data, previousHash) {
        this.index = index;
        this.timestamp = timestamp;
        this.data = data;
        this.previousHash = previousHash;
        this.nonce = 0;
        this.hash = this.calculateHash();
        this.mineBlock();
    }

    calculateHash() {
        return crypto.createHash('sha256')
            .update(this.index + this.previousHash + this.timestamp + JSON.stringify(this.data) + this.nonce)
            .digest('hex');
    }

    mineBlock() {
        const target = '0'.repeat(DIFFICULTY);
        while (!this.hash.startsWith(target)) {
            this.nonce++;
            this.hash = this.calculateHash();
        }
    }
}

function signHash(hash, privateKeyPem) {
    const signer = crypto.createSign('SHA256');
    signer.update(hash);
    return signer.sign(privateKeyPem, 'hex');
}

function verifyHashSignature(hash, signature, publicKeyPem) {
    try {
        const verifier = crypto.createVerify('SHA256');
        verifier.update(hash);
        return verifier.verify(publicKeyPem, signature, 'hex');
    } catch {
        return false;
    }
}

function generateKeyPair() {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
        namedCurve: 'P-256',
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
    return { privateKey, publicKey };
}

class Blockchain {
    constructor(db) {
        this.db = db;
    }

    async getLastBlock() {
        const [rows] = await this.db.query('SELECT * FROM blockchain ORDER BY block_index DESC LIMIT 1');
        return rows[0] || null;
    }

    // privateKeyPem + publicKeyPem: để ký số (tùy chọn)
    async addTransaction(transactionData, privateKeyPem, publicKeyPem) {
        const lastBlock = await this.getLastBlock();
        const previousHash = lastBlock ? lastBlock.hash : '0'.repeat(64);
        const index = lastBlock ? lastBlock.block_index + 1 : 0;
        const timestamp = new Date().toISOString();

        // Transaction ID duy nhất + public key nhúng vào data (self-contained block)
        const tx_id = crypto.randomUUID();
        const dataWithMeta = { ...transactionData, tx_id, ...(publicKeyPem ? { public_key: publicKeyPem } : {}) };

        // Khai thác khối (Proof of Work)
        const block = new Block(index, timestamp, dataWithMeta, previousHash);

        // Ký chữ ký số lên hash của khối
        let signature = '';
        if (privateKeyPem) {
            signature = signHash(block.hash, privateKeyPem);
        }

        await this.db.query(
            'INSERT INTO blockchain (block_index, timestamp, data, previous_hash, hash, nonce, tx_id, signature) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [block.index, block.timestamp, JSON.stringify(block.data), block.previousHash, block.hash, block.nonce, tx_id, signature]
        );

        return block;
    }

    async getChain() {
        const [rows] = await this.db.query('SELECT * FROM blockchain ORDER BY block_index ASC');
        return rows.map(row => ({ ...row, data: JSON.parse(row.data) }));
    }

    async getTransactionsByProduct(productId) {
        const [rows] = await this.db.query('SELECT * FROM blockchain ORDER BY block_index ASC');
        return rows
            .map(row => ({ ...row, data: JSON.parse(row.data) }))
            .filter(block => block.data.product_id == productId);
    }

    async isChainValid() {
        const chain = await this.getChain();
        for (let i = 1; i < chain.length; i++) {
            const current = chain[i];
            const previous = chain[i - 1];

            // 2. Kiểm tra liên kết chuỗi (áp dụng cho mọi khối)
            if (current.previous_hash !== previous.hash) return false;

            // Khối cũ (không có tx_id) là khối di sản trước khi nâng cấp
            // Chỉ kiểm tra liên kết chuỗi, bỏ qua hash + PoW + chữ ký
            if (!current.tx_id) continue;

            // 1. Kiểm tra hash toàn vẹn (chỉ khối mới có tx_id)
            const recalculated = crypto.createHash('sha256')
                .update(current.block_index + current.previous_hash + current.timestamp + JSON.stringify(current.data) + current.nonce)
                .digest('hex');
            if (current.hash !== recalculated) return false;

            // 3. Kiểm tra Proof of Work
            if (!current.hash.startsWith('0'.repeat(DIFFICULTY))) return false;

            // 4. Kiểm tra chữ ký số
            if (current.signature && current.data && current.data.public_key) {
                if (!verifyHashSignature(current.hash, current.signature, current.data.public_key)) return false;
            }
        }
        return true;
    }
}

Blockchain.generateKeyPair = generateKeyPair;
module.exports = Blockchain;
