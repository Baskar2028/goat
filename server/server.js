require('dotenv').config();
const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const { processAudio } = require('./services/audioProcessor');
const { uploadToRoblox } = require('./services/robloxUploader');

const app = express();

app.use(express.json());
app.use(session({
    secret: process.env.SESSION_SECRET || 'dev-secret-2026',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false, maxAge: 1000 * 60 * 60 * 24 } // 24 hours
}));

// Vercel routes static files automatically via vercel.json, but keep this for local testing
app.use(express.static(path.join(__dirname, '../client')));

// VERCEL REQUIREMENT: Only write to the temporary /tmp directory
const tmpDir = os.tmpdir();

const storage = multer.diskStorage({
    destination: tmpDir,
    filename: (req, file, cb) => cb(null, `${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`)
});

const upload = multer({ 
    storage, 
    limits: { fileSize: (process.env.MAX_FILE_SIZE_MB || 20) * 1024 * 1024 }
});

// VERCEL REQUIREMENT: Stateless In-Memory Database (Resets when Vercel sleeps)
const uploadsDB = []; 

app.use((req, res, next) => {
    if (!req.session.userId) req.session.userId = uuidv4();
    next();
});

// --- AUTHENTICATION ---
app.get('/api/auth/status', (req, res) => {
    if (req.session.role) res.json({ authenticated: true, role: req.session.role });
    else res.json({ authenticated: false });
});

app.post('/api/auth/team', (req, res) => {
    const { email, password } = req.body;
    if (email === 'goatedheisen@gmail.com' && password === 'goatedheisenisalwaysgoated#') {
        req.session.role = 'team';
        return res.json({ success: true });
    }
    res.status(401).json({ error: 'Invalid credentials.' });
});

// --- PROCESSING API ---
app.post('/api/upload', upload.single('audio'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    if (req.session.role !== 'team') return res.status(401).json({ error: 'Unauthorized.' });

    const uploadId = uuidv4();
    const finalName = req.body.customName || req.file.originalname;
    
    // Save to memory DB
    const uploadRecord = {
        id: uploadId,
        owner_id: req.session.userId,
        original_filename: finalName,
        status: 'processing',
        created_at: Date.now()
    };
    uploadsDB.push(uploadRecord);

    // Send immediate response so Vercel doesn't block the frontend
    res.json({ id: uploadId, status: 'processing' });

    const options = {
        pitchSemitones: req.body.pitchSemitones || "0",
        playbackSpeed: req.body.playbackSpeed || "1",
        format: req.body.format || "ogg",
        tmpDir: tmpDir // Pass the temp directory
    };

    try {
        // 1. Process Audio
        const processedPath = await processAudio(req.file.path, finalName, options);
        uploadRecord.status = 'uploading';

        // 2. Upload to Roblox
        const credentials = {
            apiKey: process.env.ROBLOX_API_KEY,
            creatorId: process.env.ROBLOX_CREATOR_ID,
            creatorType: process.env.ROBLOX_CREATOR_TYPE || 'User'
        };

        const assetId = await uploadToRoblox(processedPath, finalName, credentials);
        
        // 3. Update Record
        uploadRecord.status = 'completed';
        uploadRecord.asset_id = assetId;

        // 4. Vercel Memory Cleanup (Manual)
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        if (fs.existsSync(processedPath)) fs.unlinkSync(processedPath);

    } catch (error) {
        uploadRecord.status = 'failed';
        uploadRecord.error_message = error.message;
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    }
});

// --- STATUS POLLING ---
app.get('/api/uploads/:id', (req, res) => {
    const record = uploadsDB.find(u => u.id === req.params.id);
    if (!record) return res.status(404).json({ error: 'Not found' });
    if (record.owner_id !== req.session.userId) return res.status(403).json({ error: 'Forbidden' });
    res.json(record);
});

app.get('/api/uploads', (req, res) => {
    const userUploads = uploadsDB
        .filter(u => u.owner_id === req.session.userId)
        .sort((a, b) => b.created_at - a.created_at);
    res.json(userUploads);
});

module.exports = app;