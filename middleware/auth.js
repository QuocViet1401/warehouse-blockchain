function requireLogin(req, res, next) {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    next();
}

function requireAdmin(req, res, next) {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    if (req.session.user.role !== 'admin') {
        return res.status(403).render('error', { message: 'Bạn không có quyền truy cập trang này', user: req.session.user });
    }
    next();
}

module.exports = { requireLogin, requireAdmin };
