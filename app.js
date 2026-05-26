const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const session = require('express-session');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback_secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000, httpOnly: true }
}));

app.use('/', require('./routes/auth'));
app.use('/dashboard', require('./routes/dashboard'));
app.use('/products', require('./routes/products'));
app.use('/imports', require('./routes/imports'));
app.use('/exports', require('./routes/exports'));
app.use('/blockchain', require('./routes/blockchain'));
app.use('/users', require('./routes/users'));
app.use('/inventory', require('./routes/inventory'));

app.get('/', (req, res) => {
    if (req.session.user) return res.redirect('/dashboard');
    res.redirect('/login');
});

app.use((req, res) => {
    res.status(404).render('error', { message: 'Trang khong ton tai', user: req.session.user || null });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('Server dang chay tai http://localhost:' + PORT);
});
