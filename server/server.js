require('dotenv').config();
const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('./database');
const { processAudio } = require('./services/audioProcessor');
const { uploadToRoblox } = require('./services/robloxUploader');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(session({
    secret: process.env.SESSION_SECRET || 'dev-secret-2026',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false, maxAge: 1000 * 60 * 60 * 24 * 30 } 
}));

app.use(express.static(path.join(__dirname, '../client')));

const uploadsDir = path.join(__dirname, '../uploads');
const tempDir = path.join(__dirname, '../temp');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

const storage = multer.diskStorage({
    destination: uploadsDir,
    filename: (req, file, cb) => cb(null, `${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`)
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('audio/') || file.originalname.match(/\.(mp3|wav|ogg|flac|m4a)$/i)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type.'));
    }
};

const upload = multer({ 
    storage, 
    fileFilter,
    limits: { fileSize: (process.env.MAX_FILE_SIZE_MB || 150) * 1024 * 1024 } // Up to 150MB support
});

app.use((req, res, next) => {
    if (!req.session.userId) req.session.userId = uuidv4();
    next();
});

// --- AUTHENTICATION ROUTES ---

app.get('/api/auth/status', (req, res) => {
    if (req.session.role) res.json({ authenticated: true, role: req.session.role });
    else res.json({ authenticated: false });
});

app.post('/api/auth/team', (req, res) => {
    const { email, password } = req.body;
    if (email === 'goatedheisen@gmail.com' && password === 'goatedheisenisalwaysgoated@') {
        req.session.role = 'team';
        return res.json({ success: true });
    }
    res.status(401).json({ error: 'Invalid team credentials.' });
});

// --- API ROUTES ---

app.post('/api/upload', upload.single('audio'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    if (req.session.role !== 'team') {
        return res.status(401).json({ error: 'Unauthorized. Please login as Creator Team first.' });
    }

    const uploadId = uuidv4();
    const userId = req.session.userId;
    
    // Grab the custom name from the frontend, fallback to original filename if missing
    const finalName = req.body.customName || req.file.originalname;
    
    const options = {
        pitchSemitones: req.body.pitchSemitones || "0",
        playbackSpeed: req.body.playbackSpeed || "1",
        format: req.body.format || "ogg",
        bitrate: req.body.bitrate || "320k",
        sampleRate: req.body.sampleRate || "44100",
        channels: req.body.channels || "2",
        normalizeLoudness: req.body.normalizeLoudness === 'true'
    };

    // Save it to the database with the clean name
    db.run(
        `INSERT INTO uploads (id, owner_id, original_filename, file_size, status) VALUES (?, ?, ?, ?, ?)`,
        [uploadId, userId, finalName, req.file.size, 'processing']
    );

    res.json({ id: uploadId, status: 'processing' });

    try {
        // Process and upload using the CLEAN name
        const processedPath = await processAudio(req.file.path, finalName, options);
        db.run(`UPDATE uploads SET status = 'uploading' WHERE id = ?`, [uploadId]);

        const credentials = {
            apiKey: process.env.ROBLOX_API_KEY,
            creatorId: process.env.ROBLOX_CREATOR_ID,
            creatorType: process.env.ROBLOX_CREATOR_TYPE || 'User'
        };

        // Roblox will now receive the clean name you typed in!
        const assetId = await uploadToRoblox(processedPath, finalName, credentials);
        const processedFilename = path.basename(processedPath);
        
        db.run(`UPDATE uploads SET status = 'completed', asset_id = ?, processed_filename = ? WHERE id = ?`, 
            [assetId, processedFilename, uploadId]);

        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

    } catch (error) {
        console.error(`Error processing ${uploadId}:`, error);
        db.run(`UPDATE uploads SET status = 'failed', error_message = ? WHERE id = ?`, [error.message, uploadId]);
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    }
});

app.patch('/api/uploads/:id', (req, res) => {
    const { newName } = req.body;
    if (!newName || !newName.trim()) return res.status(400).json({ error: 'New name is required.' });

    db.get(`SELECT owner_id FROM uploads WHERE id = ?`, [req.params.id], (err, row) => {
        if (err || !row) return res.status(404).json({ error: 'Upload not found.' });
        if (row.owner_id !== req.session.userId) return res.status(403).json({ error: 'Forbidden' });

        db.run(`UPDATE uploads SET original_filename = ? WHERE id = ?`, [newName.trim(), req.params.id], (err) => {
            if (err) return res.status(500).json({ error: 'Database update failed.' });
            res.json({ success: true, newName: newName.trim() });
        });
    });
});

app.get('/api/uploads', (req, res) => {
    db.all(`SELECT id, original_filename, status, asset_id, created_at FROM uploads WHERE owner_id = ? ORDER BY created_at DESC`, 
    [req.session.userId], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

app.get('/api/uploads/:id', (req, res) => {
    db.get(`SELECT * FROM uploads WHERE id = ?`, [req.params.id], (err, row) => {
        if (err || !row) return res.status(404).json({ error: 'Not found' });
        if (row.owner_id !== req.session.userId) return res.status(403).json({ error: 'Forbidden' });
        delete row.owner_id;
        res.json(row);
    });
});

app.get('/api/download/:id', (req, res) => {
    db.get(`SELECT * FROM uploads WHERE id = ?`, [req.params.id], (err, row) => {
        if (err || !row) return res.status(404).json({ error: 'Not found' });
        if (row.owner_id !== req.session.userId) return res.status(403).json({ error: 'Forbidden' });
        
        if (!row.processed_filename) return res.status(404).json({ error: 'File not available' });
        
        const filePath = path.join(tempDir, row.processed_filename);
        if (fs.existsSync(filePath)) res.download(filePath, `processed_${row.original_filename}`);
        else res.status(404).json({ error: 'File expired or cleaned up' });
    });
});


// --- AGGRESSIVE MEMORY CLEANUP (Runs every 30 seconds) ---
setInterval(() => {
    const folders = [uploadsDir, tempDir];
    const now = Date.now();
    const maxAge = 60 * 1000; // 60 seconds exactly

    folders.forEach(folder => {
        fs.readdir(folder, (err, files) => {
            if (err) return;
            files.forEach(file => {
                const filePath = path.join(folder, file);
                fs.stat(filePath, (err, stats) => {
                    if (err) return;
                    // If the file is older than 60 seconds, NUKE IT.
                    if (now - stats.mtimeMs > maxAge) {
                        fs.unlink(filePath, () => console.log(`[Memory Cleanup] Automatically deleted old file: ${file}`));
                    }
                });
            });
        });
    });
}, 30 * 1000); // Trigger check every 30 seconds

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));