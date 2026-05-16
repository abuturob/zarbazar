const express = require('express');
const router = express.Router();
const db = require('../database');
const { authMiddleware } = require('../middleware/auth');

// Barcha vazifalarni olish (hafta/oy/davomiy filter bilan)
router.get('/', authMiddleware, (req, res) => {
    const userId = req.user.id;
    const { filter, weekStart } = req.query;

    let query = 'SELECT * FROM tasks WHERE user_id = ?';
    let params = [userId];

    if (filter === 'hafta' && weekStart) {
        // Hafta boshi va oxiri
        const start = new Date(weekStart);
        const end = new Date(weekStart);
        end.setDate(end.getDate() + 6);

        const startStr = start.toISOString().split('T')[0];
        const endStr = end.toISOString().split('T')[0];

        query += ' AND date >= ? AND date <= ?';
        params.push(startStr, endStr);

    } else if (filter === 'oy') {
        // Joriy oy
        const now = new Date();
        const monthStr = now.toISOString().slice(0, 7); // 2024-05
        query += ' AND date LIKE ?';
        params.push(monthStr + '%');

    }
    // 'davomiy' bo'lsa — hamma vazifalar (filter yo'q)

    query += ' ORDER BY date ASC, id ASC';

    db.all(query, params, (err, tasks) => {
        if (err) {
            return res.status(500).json({ error: 'Vazifalarni olishda xato' });
        }
        res.json(tasks);
    });
});

// Yangi vazifa qo'shish
router.post('/', authMiddleware, (req, res) => {
    const userId = req.user.id;
    const { name, comment, day, date, file_name, file_type, file_data, habit } = req.body;

    if (!name) {
        return res.status(400).json({ error: 'Vazifa nomi kiritilmadi' });
    }

    db.run(
        `INSERT INTO tasks (user_id, name, comment, day, date, file_name, file_type, file_data, habit)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, name, comment || '', day || '', date || '', file_name || null, file_type || null, file_data || null, habit ? 1 : 0],
        function (err) {
            if (err) {
                return res.status(500).json({ error: 'Vazifa qo\'shishda xato' });
            }
            res.json({ id: this.lastID, message: 'Vazifa qo\'shildi' });
        }
    );
});

// Vazifani yangilash (tahrirlash)
router.put('/:id', authMiddleware, (req, res) => {
    const userId = req.user.id;
    const taskId = req.params.id;
    const { name, comment, completed, file_name, file_type, file_data } = req.body;

    // Faqat o'z vazifasini o'zgartira oladi
    db.get('SELECT * FROM tasks WHERE id = ? AND user_id = ?', [taskId, userId], (err, task) => {
        if (err || !task) {
            return res.status(404).json({ error: 'Vazifa topilmadi' });
        }

        db.run(
            `UPDATE tasks SET
                name = ?,
                comment = ?,
                completed = ?,
                file_name = ?,
                file_type = ?,
                file_data = ?
             WHERE id = ? AND user_id = ?`,
            [
                name ?? task.name,
                comment ?? task.comment,
                completed !== undefined ? (completed ? 1 : 0) : task.completed,
                file_name ?? task.file_name,
                file_type ?? task.file_type,
                file_data ?? task.file_data,
                taskId,
                userId
            ],
            (err) => {
                if (err) {
                    return res.status(500).json({ error: 'Vazifani yangilashda xato' });
                }
                res.json({ message: 'Vazifa yangilandi' });
            }
        );
    });
});

// Vazifani bajarildi/bajarilmadi qilish (tez toggle)
router.patch('/:id/toggle', authMiddleware, (req, res) => {
    const userId = req.user.id;
    const taskId = req.params.id;

    db.get('SELECT * FROM tasks WHERE id = ? AND user_id = ?', [taskId, userId], (err, task) => {
        if (err || !task) {
            return res.status(404).json({ error: 'Vazifa topilmadi' });
        }

        const newCompleted = task.completed === 1 ? 0 : 1;

        db.run(
            'UPDATE tasks SET completed = ? WHERE id = ? AND user_id = ?',
            [newCompleted, taskId, userId],
            (err) => {
                if (err) {
                    return res.status(500).json({ error: 'Xato yuz berdi' });
                }
                res.json({ message: 'Holat o\'zgartirildi', completed: newCompleted === 1 });
            }
        );
    });
});

// Vazifani o'chirish
router.delete('/:id', authMiddleware, (req, res) => {
    const userId = req.user.id;
    const taskId = req.params.id;

    db.run('DELETE FROM tasks WHERE id = ? AND user_id = ?', [taskId, userId], function (err) {
        if (err) {
            return res.status(500).json({ error: 'O\'chirishda xato' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Vazifa topilmadi' });
        }
        res.json({ message: 'Vazifa o\'chirildi' });
    });
});

module.exports = router;