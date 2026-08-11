const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '../database');
if (!fs.existsSync(dbPath)) fs.mkdirSync(dbPath);

const db = new sqlite3.Database(path.join(dbPath, 'uploads.sqlite'));

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS uploads (
            id TEXT PRIMARY KEY,
            owner_id TEXT NOT NULL,
            original_filename TEXT NOT NULL,
            processed_filename TEXT,
            file_size INTEGER,
            status TEXT DEFAULT 'processing',
            asset_id TEXT,
            error_message TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
});

module.exports = db;