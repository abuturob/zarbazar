const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'zarbazar.db');
const db = new Database(DB_PATH);

console.log("✅ Ma'lumotlar bazasiga ulandi");

db.pragma('journal_mode = WAL');

db.exec(`
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
    );
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
    );
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
    );
    CREATE TABLE IF NOT EXISTS kpi_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT UNIQUE NOT NULL,
        rate INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS filials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
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
    );
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
    );
`);

const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
if (!adminExists) {
    const adminPassword = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO users (fio, username, password, lavozim, role) VALUES (?, ?, ?, ?, ?)')
      .run('Administrator', 'admin', adminPassword, 'Bosh admin', 'admin');
}

[['Yengil', 10000], ['Orta', 25000], ['Ogir', 50000]].forEach(([cat, rate]) => {
    db.prepare('INSERT OR IGNORE INTO kpi_settings (category, rate) VALUES (?, ?)').run(cat, rate);
});

['1-Filial', '2-Filial', '3-Filial', '4-Filial', '5-Filial'].forEach(name => {
    db.prepare('INSERT OR IGNORE INTO filials (name) VALUES (?)').run(name);
});

console.log('✅ Jadvallar tayyor');

const wrapper = {
    get: (sql, params, cb) => {
        try {
            const p = Array.isArray(params) ? params : (params !== undefined ? [params] : []);
            const row = db.prepare(sql).get(...p);
            if (cb) cb(null, row);
            return row;
        } catch (err) {
            if (cb) cb(err);
        }
    },
    all: (sql, params, cb) => {
        try {
            const p = Array.isArray(params) ? params : (params !== undefined ? [params] : []);
            const rows = db.prepare(sql).all(...p);
            if (cb) cb(null, rows);
            return rows;
        } catch (err) {
            if (cb) cb(err);
        }
    },
    run: (sql, params, cb) => {
        try {
            const stmt = db.prepare(sql);
            const p = Array.isArray(params) ? params : (params !== undefined ? [params] : []);
            const result = stmt.run(...p);
            const context = { lastID: result.lastInsertRowid, changes: result.changes };
            if (cb) cb.call(context, null);
            return context;
        } catch (err) {
            if (cb) cb.call({}, err);
        }
    }
};

module.exports = wrapper;