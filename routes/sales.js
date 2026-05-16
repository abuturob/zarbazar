const express = require('express');
const router = express.Router();
const db = require('../database');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// =====================
// FILIALLAR
// =====================
router.get('/filials', authMiddleware, (req, res) => {
    db.all('SELECT * FROM filials ORDER BY name', [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Filiallarni olishda xato' });
        res.json(rows);
    });
});

router.post('/filials', adminMiddleware, (req, res) => {
    const { name, address } = req.body;
    if (!name) return res.status(400).json({ error: 'Filial nomi kiritilmadi' });
    db.run('INSERT INTO filials (name, address) VALUES (?, ?)', [name, address || ''], function (err) {
        if (err) return res.status(500).json({ error: "Filial qo'shishda xato" });
        res.json({ id: this.lastID, name, message: "Filial qo'shildi" });
    });
});

router.put('/filials/:id', adminMiddleware, (req, res) => {
    const { name, address } = req.body;
    db.run('UPDATE filials SET name = ?, address = ? WHERE id = ?', [name, address || '', req.params.id], (err) => {
        if (err) return res.status(500).json({ error: 'Yangilashda xato' });
        res.json({ message: 'Filial yangilandi' });
    });
});

// =====================
// SAVDO REJALARI
// =====================
router.get('/plan', authMiddleware, (req, res) => {
    const { month } = req.query;
    const currentMonth = month || new Date().toISOString().slice(0, 7);
    const userId = req.user.id;

    db.get(
        `SELECT sp.*, f.name as filial_name, u.fio, u.lavozim, u.position_type
         FROM sales_plans sp
         LEFT JOIN filials f ON sp.filial_id = f.id
         LEFT JOIN users u ON sp.user_id = u.id
         WHERE sp.user_id = ? AND sp.month = ?`,
        [userId, currentMonth],
        (err, row) => {
            if (err) return res.status(500).json({ error: 'Rejani olishda xato' });
            res.json(row || null);
        }
    );
});

router.get('/plans', adminMiddleware, (req, res) => {
    const { month, filial_id } = req.query;
    const currentMonth = month || new Date().toISOString().slice(0, 7);

    let query = `
        SELECT sp.*, f.name as filial_name, u.fio, u.lavozim, u.position_type,
               COALESCE(sales_sum.total, 0) as sold_amount
        FROM sales_plans sp
        LEFT JOIN filials f ON sp.filial_id = f.id
        LEFT JOIN users u ON sp.user_id = u.id
        LEFT JOIN (
            SELECT user_id, SUM(amount) as total
            FROM daily_sales WHERE date LIKE ?
            GROUP BY user_id
        ) sales_sum ON sp.user_id = sales_sum.user_id
        WHERE sp.month = ?`;

    const params = [currentMonth + '%', currentMonth];
    if (filial_id) { query += ' AND sp.filial_id = ?'; params.push(filial_id); }
    query += ' ORDER BY f.name, u.fio';

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: 'Rejalarni olishda xato' });
        res.json(rows);
    });
});

router.post('/plan', adminMiddleware, (req, res) => {
    const { user_id, filial_id, month, plan_amount, commission_rate } = req.body;
    if (!user_id || !filial_id || !month || !plan_amount) {
        return res.status(400).json({ error: "Barcha maydonlarni to'ldiring" });
    }
    db.run(
        `INSERT INTO sales_plans (user_id, filial_id, month, plan_amount, commission_rate)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(user_id, month) DO UPDATE SET
             filial_id = excluded.filial_id,
             plan_amount = excluded.plan_amount,
             commission_rate = excluded.commission_rate`,
        [user_id, filial_id, month, plan_amount, commission_rate || 0.04],
        function (err) {
            if (err) return res.status(500).json({ error: 'Reja saqlashda xato: ' + err.message });
            res.json({ message: 'Reja saqlandi' });
        }
    );
});

// =====================
// KUNLIK SAVDOLAR
// =====================
router.get('/daily', authMiddleware, (req, res) => {
    const userId = req.user.id;
    const { month } = req.query;
    const currentMonth = month || new Date().toISOString().slice(0, 7);

    db.all(
        `SELECT ds.*, f.name as filial_name FROM daily_sales ds
         LEFT JOIN filials f ON ds.filial_id = f.id
         WHERE ds.user_id = ? AND ds.date LIKE ?
         ORDER BY ds.date DESC`,
        [userId, currentMonth + '%'],
        (err, rows) => {
            if (err) return res.status(500).json({ error: 'Savdolarni olishda xato' });
            res.json(rows);
        }
    );
});

router.post('/daily', authMiddleware, (req, res) => {
    const userId = req.user.id;
    const { date, amount, comment } = req.body;
    if (!date || !amount) return res.status(400).json({ error: 'Sana va summa kiritilmadi' });

    db.get(
        `SELECT filial_id FROM sales_plans WHERE user_id = ? AND month = ?`,
        [userId, date.slice(0, 7)],
        (err, plan) => {
            if (!plan) return res.status(400).json({ error: "Bu oy uchun savdo rejasi belgilanmagan. Admin bilan bog'laning." });

            db.run(
                `INSERT INTO daily_sales (user_id, filial_id, date, amount, comment) VALUES (?, ?, ?, ?, ?)`,
                [userId, plan.filial_id, date, parseFloat(amount), comment || ''],
                function (err) {
                    if (err) return res.status(500).json({ error: 'Savdo kiritishda xato' });
                    res.json({ id: this.lastID, message: 'Savdo kiritildi' });
                }
            );
        }
    );
});

router.delete('/daily/:id', authMiddleware, (req, res) => {
    const userId = req.user.id;
    db.run('DELETE FROM daily_sales WHERE id = ? AND user_id = ?', [req.params.id, userId], function (err) {
        if (err) return res.status(500).json({ error: "O'chirishda xato" });
        if (this.changes === 0) return res.status(404).json({ error: 'Savdo topilmadi' });
        res.json({ message: "Savdo o'chirildi" });
    });
});

// =====================
// KPI HISOBLASH
// =====================
router.get('/kpi-result', authMiddleware, (req, res) => {
    const userId = req.user.id;
    const { month } = req.query;
    const currentMonth = month || new Date().toISOString().slice(0, 7);

    db.get(
        `SELECT sp.plan_amount, sp.commission_rate,
                COALESCE(SUM(ds.amount), 0) as sold_amount,
                u.fio, u.lavozim, u.position_type, f.name as filial_name
         FROM sales_plans sp
         LEFT JOIN daily_sales ds ON sp.user_id = ds.user_id AND ds.date LIKE ?
         LEFT JOIN users u ON sp.user_id = u.id
         LEFT JOIN filials f ON sp.filial_id = f.id
         WHERE sp.user_id = ? AND sp.month = ?
         GROUP BY sp.id`,
        [currentMonth + '%', userId, currentMonth],
        (err, row) => {
            if (err) return res.status(500).json({ error: 'KPI hisoblashda xato' });
            if (!row) return res.json({ no_plan: true, message: 'Bu oy uchun reja belgilanmagan' });

            const plan = row.plan_amount;
            const sold = row.sold_amount;
            const rate = row.commission_rate;
            const percent = plan > 0 ? (sold / plan) * 100 : 0;
            const commission = sold * rate / 100;
            let bonus = 0;
            if (percent >= 100) bonus = 1000000;
            else if (percent >= 70) bonus = 700000;

            res.json({
                fio: row.fio,
                lavozim: row.lavozim,
                filial: row.filial_name,
                position_type: row.position_type,
                plan_amount: plan,
                sold_amount: sold,
                percent: Math.round(percent * 10) / 10,
                commission_rate: rate,
                commission: Math.round(commission),
                bonus,
                total: Math.round(commission + bonus),
                month: currentMonth
            });
        }
    );
});

router.get('/kpi-all', adminMiddleware, (req, res) => {
    const { month, filial_id } = req.query;
    const currentMonth = month || new Date().toISOString().slice(0, 7);

    let query = `
        SELECT sp.plan_amount, sp.commission_rate,
               COALESCE(SUM(ds.amount), 0) as sold_amount,
               u.id as user_id, u.fio, u.lavozim, u.position_type,
               f.name as filial_name, f.id as filial_id
        FROM sales_plans sp
        LEFT JOIN daily_sales ds ON sp.user_id = ds.user_id AND ds.date LIKE ?
        LEFT JOIN users u ON sp.user_id = u.id
        LEFT JOIN filials f ON sp.filial_id = f.id
        WHERE sp.month = ?`;

    const params = [currentMonth + '%', currentMonth];
    if (filial_id) { query += ' AND sp.filial_id = ?'; params.push(filial_id); }
    query += ' GROUP BY sp.id ORDER BY f.name, sold_amount DESC';

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: 'KPI olishda xato' });

        const result = rows.map(row => {
            const plan = row.plan_amount;
            const sold = row.sold_amount;
            const rate = row.commission_rate;
            const percent = plan > 0 ? (sold / plan) * 100 : 0;
            const commission = sold * rate / 100;
            let bonus = 0;
            if (percent >= 100) bonus = 1000000;
            else if (percent >= 70) bonus = 700000;

            return {
                user_id: row.user_id,
                fio: row.fio,
                lavozim: row.lavozim,
                filial: row.filial_name,
                filial_id: row.filial_id,
                position_type: row.position_type,
                plan_amount: plan,
                sold_amount: sold,
                percent: Math.round(percent * 10) / 10,
                commission_rate: rate,
                commission: Math.round(commission),
                bonus,
                total: Math.round(commission + bonus)
            };
        });

        res.json(result);
    });
});

module.exports = router;