const express = require('express');
const router = express.Router();
const db = require('../database');
const bcrypt = require('bcryptjs');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// =====================
// HODIMLAR
// =====================

// Barcha hodimlarni olish
router.get('/users', adminMiddleware, (req, res) => {
    db.all(
        'SELECT id, fio, username, lavozim, role, created_at FROM users ORDER BY created_at DESC',
        [],
        (err, users) => {
            if (err) return res.status(500).json({ error: 'Hodimlarni olishda xato' });
            res.json(users);
        }
    );
});

// Yangi hodim qo'shish
router.post('/users', adminMiddleware, (req, res) => {
    const { fio, username, password, lavozim, role } = req.body;

    if (!fio || !username || !password) {
        return res.status(400).json({ error: 'F.I.O, login va parol kiritilmadi' });
    }

    // Login band emasligini tekshirish
    db.get('SELECT id FROM users WHERE username = ?', [username], (err, existing) => {
        if (existing) {
            return res.status(400).json({ error: 'Bu login allaqachon band' });
        }

        const hashedPassword = bcrypt.hashSync(password, 10);

        db.run(
            `INSERT INTO users (fio, username, password, lavozim, role)
             VALUES (?, ?, ?, ?, ?)`,
            [fio, username, hashedPassword, lavozim || '', role || 'hodim'],
            function (err) {
                if (err) return res.status(500).json({ error: 'Hodim qo\'shishda xato' });
                res.json({ id: this.lastID, message: 'Hodim qo\'shildi' });
            }
        );
    });
});

// Hodimni o'chirish
router.delete('/users/:id', adminMiddleware, (req, res) => {
    const userId = req.params.id;

    // Adminni o'chirib bo'lmaydi
    db.get('SELECT role FROM users WHERE id = ?', [userId], (err, user) => {
        if (!user) return res.status(404).json({ error: 'Hodim topilmadi' });
        if (user.role === 'admin') return res.status(403).json({ error: 'Adminni o\'chirib bo\'lmaydi' });

        db.run('DELETE FROM users WHERE id = ?', [userId], function (err) {
            if (err) return res.status(500).json({ error: 'O\'chirishda xato' });
            res.json({ message: 'Hodim o\'chirildi' });
        });
    });
});

// Hodim parolini yangilash
router.patch('/users/:id/password', adminMiddleware, (req, res) => {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Yangi parol kiritilmadi' });

    const hashedPassword = bcrypt.hashSync(password, 10);
    db.run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, req.params.id], (err) => {
        if (err) return res.status(500).json({ error: 'Parol yangilashda xato' });
        res.json({ message: 'Parol yangilandi' });
    });
});

// =====================
// HODIMLAR STATISTIKASI
// =====================

// Barcha hodimlar statistikasi
router.get('/stats', adminMiddleware, (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = new Date().toISOString().slice(0, 7);

    db.all(
        `SELECT
            u.id,
            u.fio,
            u.lavozim,
            u.username,
            COUNT(DISTINCT t.id) as total_tasks,
            SUM(CASE WHEN t.completed = 1 THEN 1 ELSE 0 END) as completed_tasks,
            SUM(CASE WHEN t.completed = 1 AND t.date = ? THEN 1 ELSE 0 END) as today_completed,
            SUM(CASE WHEN t.file_name IS NOT NULL AND t.date = ? THEN 1 ELSE 0 END) as today_files,
            COALESCE(kpi_sum.monthly_salary, 0) as monthly_salary,
            COALESCE(kpi_sum.kpi_count, 0) as kpi_count
         FROM users u
         LEFT JOIN tasks t ON u.id = t.user_id
         LEFT JOIN (
             SELECT k.user_id,
                    SUM(s.rate) as monthly_salary,
                    COUNT(k.id) as kpi_count
             FROM kpi k
             LEFT JOIN kpi_settings s ON k.category = s.category
             WHERE k.date LIKE ?
             GROUP BY k.user_id
         ) kpi_sum ON u.id = kpi_sum.user_id
         WHERE u.role = 'hodim'
         GROUP BY u.id
         ORDER BY completed_tasks DESC`,
        [today, today, currentMonth + '%'],
        (err, stats) => {
            if (err) return res.status(500).json({ error: 'Statistikani olishda xato' });
            res.json(stats);
        }
    );
});

// =====================
// KPI SOZLAMALARI
// =====================

// KPI sozlamalarini olish
router.get('/kpi-settings', adminMiddleware, (req, res) => {
    db.all('SELECT * FROM kpi_settings', [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Sozlamalarni olishda xato' });
        res.json(rows);
    });
});

// KPI sozlamalarini yangilash
router.put('/kpi-settings', adminMiddleware, (req, res) => {
    const { Yengil, Orta, Ogir } = req.body;

    const updates = [
        { category: 'Yengil', rate: parseInt(Yengil) || 0 },
        { category: "O'rta", rate: parseInt(Orta) || 0 },
        { category: "Og'ir", rate: parseInt(Ogir) || 0 }
    ];

    let completed = 0;
    let hasError = false;

    updates.forEach(({ category, rate }) => {
        db.run(
            'UPDATE kpi_settings SET rate = ? WHERE category = ?',
            [rate, category],
            (err) => {
                if (err) hasError = true;
                completed++;
                if (completed === updates.length) {
                    if (hasError) return res.status(500).json({ error: 'Sozlamalarni saqlashda xato' });
                    res.json({ message: 'Sozlamalar saqlandi' });
                }
            }
        );
    });
});

// =====================
// VAZIFA SHABLONLARI
// =====================

// Barcha shablonlarni olish
router.get('/templates', authMiddleware, (req, res) => {
    db.all('SELECT * FROM templates ORDER BY created_at DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Shablonlarni olishda xato' });
        res.json(rows);
    });
});

// Yangi shablon qo'shish
router.post('/templates', adminMiddleware, (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Shablon nomi kiritilmadi' });

    db.run('INSERT INTO templates (name) VALUES (?)', [name], function (err) {
        if (err) return res.status(500).json({ error: 'Shablon qo\'shishda xato' });
        res.json({ id: this.lastID, name, message: 'Shablon qo\'shildi' });
    });
});

// Shablonni o'chirish
router.delete('/templates/:id', adminMiddleware, (req, res) => {
    db.run('DELETE FROM templates WHERE id = ?', [req.params.id], function (err) {
        if (err) return res.status(500).json({ error: 'O\'chirishda xato' });
        if (this.changes === 0) return res.status(404).json({ error: 'Shablon topilmadi' });
        res.json({ message: 'Shablon o\'chirildi' });
    });
});

module.exports = router;