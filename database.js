const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'zarbazar.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('❌ Bazaga ulanishda xato:', err.message);
    } else {
        console.log('✅ Ma\'lumotlar bazasiga ulandi');
    }
});

db.serialize(() => {

    // Foydalanuvchilar jadvali
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fio TEXT NOT NULL,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            lavozim TEXT,
            position_type TEXT DEFAULT 'sotuvchi',
            filial_id INTEGER DEFAULT NULL,
            role TEXT DEFAULT 'hodim',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Vazifalar jadvali
    db.run(`
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            comment TEXT,
            day TEXT,
            date TEXT,
            completed INTEGER DEFAULT 0,
            file_name TEXT,
            file_type TEXT,
            file_data TEXT,
            habit INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);

    // KPI jadvali
    db.run(`
        CREATE TABLE IF NOT EXISTS kpi (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            date TEXT NOT NULL,
            task_name TEXT NOT NULL,
            category TEXT NOT NULL,
            comment TEXT,
            file_name TEXT,
            file_type TEXT,
            file_data TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);

    // KPI sozlamalari jadvali
    db.run(`
        CREATE TABLE IF NOT EXISTS kpi_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT UNIQUE NOT NULL,
            rate INTEGER DEFAULT 0
        )
    `);

    // Vazifa shablonlari jadvali
    db.run(`
        CREATE TABLE IF NOT EXISTS templates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Filiallar jadvali
    db.run(`
        CREATE TABLE IF NOT EXISTS filials (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            address TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Savdo rejalari jadvali
    db.run(`
        CREATE TABLE IF NOT EXISTS sales_plans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            filial_id INTEGER NOT NULL,
            month TEXT NOT NULL,
            plan_amount REAL NOT NULL,
            commission_rate REAL DEFAULT 0.04,
            bonus_70 INTEGER DEFAULT 700000,
            bonus_100 INTEGER DEFAULT 1000000,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, month),
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (filial_id) REFERENCES filials(id)
        )
    `);

    // Kunlik savdolar jadvali
    db.run(`
        CREATE TABLE IF NOT EXISTS daily_sales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            filial_id INTEGER NOT NULL,
            date TEXT NOT NULL,
            amount REAL NOT NULL,
            comment TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (filial_id) REFERENCES filials(id)
        )
    `);

    // Admin
    const adminPassword = bcrypt.hashSync('admin123', 10);
    db.run(
        `INSERT OR IGNORE INTO users (fio, username, password, lavozim, role) VALUES (?, ?, ?, ?, ?)`,
        ['Administrator', 'admin', adminPassword, 'Bosh admin', 'admin']
    );

    // KPI sozlamalari
    db.run(`INSERT OR IGNORE INTO kpi_settings (category, rate) VALUES (?, ?)`, ['Yengil', 10000]);
    db.run(`INSERT OR IGNORE INTO kpi_settings (category, rate) VALUES (?, ?)`, ['Orta', 25000]);
    db.run(`INSERT OR IGNORE INTO kpi_settings (category, rate) VALUES (?, ?)`, ['Ogir', 50000]);

    // 5 ta default filial
    const filials = ['1-Filial', '2-Filial', '3-Filial', '4-Filial', '5-Filial'];
    filials.forEach(name => {
        db.run(`INSERT OR IGNORE INTO filials (name) VALUES (?)`, [name]);
    });

    console.log('✅ Jadvallar tayyor');
});

module.exports = db;