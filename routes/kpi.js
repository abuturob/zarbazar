const express = require('express');
const router = express.Router();
const db = require('../database');
const { authMiddleware } = require('../middleware/auth');

// KPI larni olish (joriy oy)
router.get('/', authMiddleware, (req, res) => {
    const userId = req.user.id;
    const { month } = req.query; // format: 2024-05

    const currentMonth = month || new Date().toISOString().slice(0, 7);

    db.all(
        `SELECT k.*, s.rate as summa
         FROM kpi k
         LEFT JOIN kpi_settings s ON k.category = s.category
         WHERE k.user_id = ? AND k.date LIKE ?
         ORDER BY k.date DESC`,
        [userId, currentMonth + '%'],
        (err, rows) => {
            if (err) return res.status(500).json({ error: 'KPI larni olishda xato' });
            res.json(rows);
        }
    );
});

// Oylik jami hisoblash
router.get('/total', authMiddleware, (req, res) => {
    const userId = req.user.id;
    const { month } = req.query;
    const currentMonth = month || new Date().toISOString().slice(0, 7);

    db.get(
        `SELECT SUM(s.rate) as total, COUNT(k.id) as count
         FROM kpi k
         LEFT JOIN kpi_settings s ON k.category = s.category
         WHERE k.user_id = ? AND k.date LIKE ?`,
        [userId, currentMonth + '%'],
        (err, row) => {
            if (err) return res.status(500).json({ error: 'Jami hisoblashda xato' });
            res.json({ total: row.total || 0, count: row.count || 0, month: currentMonth });
        }
    );
});

// KPI sozlamalarini olish
router.get('/settings', authMiddleware, (req, res) => {
    db.all('SELECT * FROM kpi_settings', [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Sozlamalarni olishda xato' });
        res.json(rows);
    });
});

// Yangi KPI qo'shish
router.post('/', authMiddleware, (req, res) => {
    const userId = req.user.id;
    const { date, task_name, category, comment, file_name, file_type, file_data } = req.body;

    if (!task_name || !category || !date) {
        return res.status(400).json({ error: 'Sana, vazifa nomi va kategoriya kiritilmadi' });
    }

    const validCategories = ['Yengil', "O'rta", "Og'ir"];
    if (!validCategories.includes(category)) {
        return res.status(400).json({ error: 'Noto\'g\'ri kategoriya' });
    }

    db.run(
        `INSERT INTO kpi (user_id, date, task_name, category, comment, file_name, file_type, file_data)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, date, task_name, category, comment || '', file_name || null, file_type || null, file_data || null],
        function (err) {
            if (err) return res.status(500).json({ error: 'KPI qo\'shishda xato' });

            // Qo'shilgan KPI ni qaytarish
            db.get(
                `SELECT k.*, s.rate as summa FROM kpi k
                 LEFT JOIN kpi_settings s ON k.category = s.category
                 WHERE k.id = ?`,
                [this.lastID],
                (err, row) => {
                    if (err) return res.status(500).json({ error: 'Xato' });
                    res.json(row);
                }
            );
        }
    );
});

// KPI ni yangilash
router.put('/:id', authMiddleware, (req, res) => {
    const userId = req.user.id;
    const kpiId = req.params.id;
    const { date, task_name, category, comment, file_name, file_type, file_data } = req.body;

    db.get('SELECT * FROM kpi WHERE id = ? AND user_id = ?', [kpiId, userId], (err, kpi) => {
        if (err || !kpi) return res.status(404).json({ error: 'KPI topilmadi' });

        db.run(
            `UPDATE kpi SET
                date = ?,
                task_name = ?,
                category = ?,
                comment = ?,
                file_name = ?,
                file_type = ?,
                file_data = ?
             WHERE id = ? AND user_id = ?`,
            [
                date ?? kpi.date,
                task_name ?? kpi.task_name,
                category ?? kpi.category,
                comment ?? kpi.comment,
                file_name ?? kpi.file_name,
                file_type ?? kpi.file_type,
                file_data ?? kpi.file_data,
                kpiId,
                userId
            ],
            (err) => {
                if (err) return res.status(500).json({ error: 'KPI yangilashda xato' });
                res.json({ message: 'KPI yangilandi' });
            }
        );
    });
});

// KPI o'chirish
router.delete('/:id', authMiddleware, (req, res) => {
    const userId = req.user.id;
    const kpiId = req.params.id;

    db.run('DELETE FROM kpi WHERE id = ? AND user_id = ?', [kpiId, userId], function (err) {
        if (err) return res.status(500).json({ error: 'O\'chirishda xato' });
        if (this.changes === 0) return res.status(404).json({ error: 'KPI topilmadi' });
        res.json({ message: 'KPI o\'chirildi' });
    });
});

module.exports = router;