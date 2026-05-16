const jwt = require('jsonwebtoken');

const SECRET_KEY = 'zarbazar_secret_2024';

// Oddiy foydalanuvchi tekshiruvi
function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Kirish taqiqlangan. Iltimos login qiling.' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        req.user = decoded; // keyingi route da req.user orqali foydalanish mumkin
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Token yaroqsiz yoki muddati tugagan' });
    }
}

// Faqat admin tekshiruvi
function adminMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Kirish taqiqlangan. Iltimos login qiling.' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        if (decoded.role !== 'admin') {
            return res.status(403).json({ error: 'Bu sahifa faqat adminlar uchun' });
        }
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Token yaroqsiz yoki muddati tugagan' });
    }
}

module.exports = { authMiddleware, adminMiddleware };