const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

require('./database');

const authRoutes = require('./routes/auth');
const tasksRoutes = require('./routes/tasks');
const kpiRoutes = require('./routes/kpi');
const adminRoutes = require('./routes/admin');
const salesRoutes = require('./routes/sales');

app.use('/api/auth', authRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/kpi', kpiRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/sales', salesRoutes);

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`✅ Server ishga tushdi: http://localhost:${PORT}`);
    console.log(`📊 Zar Bazar Hisbot tayyor!`);
});