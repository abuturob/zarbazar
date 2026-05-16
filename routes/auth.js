const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database');

const SECRET_KEY = 'zarbazar_secret_2024';

// LOGIN
router.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Login va parol kiritilmadi' });
    }

    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Server xatosi' });
        }

        if (!user) {
            return res.status(401).json({ error: 'Login yoki parol noto\'g\'ri' });
        }

        const isValid = bcrypt.compareSync(password, user.password);
        if (!isValid) {
            return res.status(401).json({ error: 'Login yoki parol noto\'g\'ri' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            SECRET_KEY,
            { expiresIn: '7d' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                fio: user.fio,
                username: user.username,
                lavozim: user.lavozim,
                role: user.role
            }
        });
    });
});

// MENI KO'RISH (token orqali)
router.get('/me', (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token yo\'q' });

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        db.get('SELECT id, fio, username, lavozim, role FROM users WHERE id = ?', [decoded.id], (err, user) => {
            if (err || !user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
            res.json(user);
        });
    } catch {
        res.status(401).json({ error: 'Token yaroqsiz' });
    }
});

module.exports = router;