// Auth & Modal Elements
const authModal = document.getElementById('auth-modal');
const luaModal = document.getElementById('lua-modal');

// Workspace DOM Elements
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const workspacePanel = document.getElementById('workspace-panel');
const statusPanel = document.getElementById('status-panel');
const resultPanel = document.getElementById('result-panel');

// Controls
const pitchSlider = document.getElementById('pitch-slider');
const speedSlider = document.getElementById('speed-slider');
const pitchVal = document.getElementById('pitch-val');
const speedVal = document.getElementById('speed-val');
const pitchPresets = document.querySelectorAll('#pitch-presets button');
const speedPresets = document.querySelectorAll('#speed-presets button');

// Format UI
const formatRadios = document.querySelectorAll('input[name="format"]');
const mp3Options = document.getElementById('mp3-options');

// Info & Preview
const infoName = document.getElementById('info-name');
const infoDuration = document.getElementById('info-duration');
const infoSize = document.getElementById('info-size');
const prevOrig = document.getElementById('prev-orig');
const prevMult = document.getElementById('prev-mult');
const prevOut = document.getElementById('prev-out');
const prevRoblox = document.getElementById('prev-roblox');
const prevFinal = document.getElementById('prev-final');

// Lua Metadata
const metaSong = document.getElementById('meta-song');
const metaMovie = document.getElementById('meta-movie');
const metaLang = document.getElementById('meta-lang');

let currentFile = null;
let originalDurationSeconds = 0;
let pollInterval = null;
let pendingDownloadDate = null; // Stores which date to download after password

// --- Authentication Logic ---
async function checkAuth() {
    try {
        const res = await fetch('/api/auth/status');
        const data = await res.json();
        if (!data.authenticated) {
            authModal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        } else {
            authModal.classList.add('hidden');
            document.body.style.overflow = 'auto';
            loadHistory();
        }
    } catch (e) {
        showToast('Server connection failed.');
    }
}

document.getElementById('btn-login-team').addEventListener('click', async () => {
    const email = document.getElementById('team-email').value;
    const password = document.getElementById('team-pass').value;
    
    const res = await fetch('/api/auth/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (data.success) {
        checkAuth();
    } else {
        showToast(data.error || 'Login failed');
    }
});

checkAuth();

// --- Page Routing ---
function showWorkspace() {
    document.getElementById('lua-page').classList.add('hidden');
    document.querySelector('.workspace-container').classList.remove('hidden');
    document.getElementById('tools').classList.remove('hidden');
    document.getElementById('history').classList.remove('hidden');
    document.getElementById('about').classList.remove('hidden');
    
    document.getElementById('nav-ws').classList.add('active');
    document.getElementById('nav-lua').classList.remove('active');
    
    if (!currentFile && document.getElementById('status-panel').classList.contains('hidden') && document.getElementById('result-panel').classList.contains('hidden')) {
        document.getElementById('hero-section').style.display = 'block';
    }
}

function showLuaPage() {
    document.querySelector('.workspace-container').classList.add('hidden');
    document.getElementById('tools').classList.add('hidden');
    document.getElementById('history').classList.add('hidden');
    document.getElementById('about').classList.add('hidden');
    document.getElementById('hero-section').style.display = 'none';
    
    document.getElementById('lua-page').classList.remove('hidden');
    
    document.getElementById('nav-ws').classList.remove('active');
    document.getElementById('nav-lua').classList.add('active');
    
    renderLuaFiles();
}

// --- Formatting Helpers ---
function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return "0:00.000";
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(3);
    return `${mins}:${secs.padStart(6, '0')}`;
}

function showToast(msg) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

// --- Logic & Math ---
function updateCalculations() {
    const pitch = parseFloat(pitchSlider.value);
    pitchVal.textContent = (pitch > 0 ? '+' : '') + pitch.toFixed(2) + ' semitones';

    const speed = parseFloat(speedSlider.value);
    speedVal.textContent = speed.toFixed(3) + 'x';

    pitchPresets.forEach(b => b.classList.toggle('active', parseFloat(b.dataset.val) === pitch));
    speedPresets.forEach(b => b.classList.toggle('active', parseFloat(b.dataset.val) === speed));

    const processingMultiplier = 1 / speed;
    const outDuration = originalDurationSeconds / processingMultiplier;
    const finalDuration = outDuration / speed; 

    prevMult.textContent = processingMultiplier.toFixed(3) + '×';
    prevOut.textContent = formatTime(outDuration);
    prevRoblox.textContent = speed.toFixed(3) + '×';
    prevFinal.textContent = formatTime(finalDuration);
}

pitchSlider.addEventListener('input', (e) => {
    const pitch = parseFloat(e.target.value);
    const calcSpeed = Math.pow(2, -pitch / 12);
    speedSlider.value = calcSpeed;
    updateCalculations();
});

speedSlider.addEventListener('input', (e) => {
    const speed = parseFloat(e.target.value);
    const calcPitch = -12 * Math.log2(speed);
    pitchSlider.value = calcPitch; 
    updateCalculations();
});

pitchPresets.forEach(btn => btn.addEventListener('click', (e) => {
    pitchSlider.value = e.target.dataset.val;
    pitchSlider.dispatchEvent(new Event('input'));
}));

speedPresets.forEach(btn => btn.addEventListener('click', (e) => {
    speedSlider.value = e.target.dataset.val;
    speedSlider.dispatchEvent(new Event('input'));
}));

formatRadios.forEach(radio => radio.addEventListener('change', (e) => {
    if (e.target.value === 'mp3') mp3Options.classList.remove('hidden');
    else mp3Options.classList.add('hidden');
}));

// --- Upload Handling ---
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    window.addEventListener(eventName, (e) => { e.preventDefault(); e.stopPropagation(); }, false);
    dropZone.addEventListener(eventName, (e) => { e.preventDefault(); e.stopPropagation(); }, false);
});

['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => {
        dropZone.style.borderColor = 'var(--accent-primary)';
        dropZone.style.background = 'var(--bg-surface)';
    }, false);
});
['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => {
        dropZone.style.borderColor = '';
        dropZone.style.background = '';
    }, false);
});

dropZone.addEventListener('drop', (e) => {
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});

dropZone.addEventListener('click', (e) => {
    if(e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT') {
        fileInput.click();
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) handleFile(e.target.files[0]);
});

function handleFile(file) {
    currentFile = file;
    infoName.textContent = file.name;
    infoSize.textContent = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
    
    metaSong.value = file.name.replace(/\.[^/.]+$/, "");
    metaMovie.value = ""; 
    
    dropZone.style.display = 'none';
    workspacePanel.classList.remove('hidden');
    document.getElementById('hero-section').style.display = 'none';
    
    const audio = new Audio(URL.createObjectURL(file));
    audio.onloadedmetadata = () => {
        originalDurationSeconds = audio.duration;
        infoDuration.textContent = formatTime(audio.duration);
        prevOrig.textContent = formatTime(audio.duration);
        updateCalculations();
    };
    
    audio.onerror = () => {
        originalDurationSeconds = 0;
        infoDuration.textContent = "Unknown";
        prevOrig.textContent = "Unknown";
        updateCalculations();
    };
}

// --- Processing ---
// --- Processing ---
document.getElementById('btn-process').addEventListener('click', async () => {
    if (!currentFile) return;

    const formData = new FormData();
    
    // Grab the name from the Lua Metadata box. If it's empty, fallback to the file name.
    const customSongName = document.getElementById('meta-song').value.trim() || infoName.textContent.trim();
    
    formData.append('audio', currentFile, infoName.textContent.trim());
    formData.append('customName', customSongName); // Send the custom name to the backend
    
    formData.append('pitchSemitones', pitchSlider.value);
    formData.append('playbackSpeed', speedSlider.value);
    formData.append('normalizeLoudness', document.getElementById('norm-loud').checked);
    formData.append('format', document.querySelector('input[name="format"]:checked').value);
    formData.append('bitrate', document.getElementById('bitrate').value);
    formData.append('sampleRate', document.getElementById('sample-rate').value);
    formData.append('channels', document.getElementById('channels').value);

    workspacePanel.classList.add('hidden');
    statusPanel.classList.remove('hidden');

    try {
        const response = await fetch('/api/upload', { method: 'POST', body: formData });
        const data = await response.json();
        if (data.id) {
            pollStatus(data.id);
        } else {
            showToast('Upload failed.'); resetUpload();
        }
    } catch (err) {
        showToast('Network error.'); resetUpload();
    }
});

function pollStatus(id) {
    const steps = document.querySelectorAll('.status-steps .step');
    
    pollInterval = setInterval(async () => {
        try {
            const res = await fetch(`/api/uploads/${id}`);
            const data = await res.json();

            if (data.status === 'processing') {
                steps[1].classList.add('active'); 
            } else if (data.status === 'uploading') {
                steps[1].classList.add('active');
                steps[2].classList.add('active'); 
            } else if (data.status === 'completed') {
                clearInterval(pollInterval);
                steps[3].classList.add('active'); 
                
                setTimeout(() => {
                    statusPanel.classList.add('hidden');
                    resultPanel.classList.remove('hidden');
                    document.getElementById('final-asset-id').textContent = data.asset_id;
                    
                    // NEW: Automatically save the Lua config without prompting for password
                    autoSaveLuaConfig(data.asset_id);
                    
                    loadHistory();
                }, 800);

            } else if (data.status === 'failed') {
                clearInterval(pollInterval);
                showToast('Error: ' + (data.error_message || 'Unknown processing error'));
                resetUpload();
            }
        } catch (e) {}
    }, 2000);
}

function resetUpload() {
    currentFile = null;
    workspacePanel.classList.add('hidden');
    statusPanel.classList.add('hidden');
    resultPanel.classList.add('hidden');
    dropZone.style.display = 'block';
    document.getElementById('hero-section').style.display = 'block';
    
    document.querySelectorAll('.status-steps .step').forEach((el, index) => {
        if(index > 0) el.classList.remove('active');
    });
    
    loadHistory();
}

// --- AUTOMATED LUA SAVING & AGGREGATION ---
function autoSaveLuaConfig(assetId) {
    const songName = metaSong.value || "Unknown Song";
    const movieName = metaMovie.value || "Unknown Movie";
    const lang = metaLang.value;
    const speed = parseFloat(speedSlider.value).toFixed(3);
    const uniqueNum = Math.floor(Math.random() * 900) + 100;

    const luaBlock = `\t{
\t\tId = "song_${lang.toLowerCase()}_${uniqueNum}",
\t\tName = "${songName}",
\t\tSoundPlaybackSpeed = ${speed},
\t\tAuthor = "(${movieName}-${lang})",
\t\tImage = "rbxassetid://103063446506253",
\t\tSoundId = "rbxassetid://${assetId}",
\t\tLyrics = {}
\t}`;

    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    const dateString = `${dd}-${mm}-${yyyy}`;

    let luaStore = JSON.parse(localStorage.getItem('aura_lua_store')) || {};
    if (!luaStore[dateString]) {
        luaStore[dateString] = [];
    }

    luaStore[dateString].push(luaBlock);
    localStorage.setItem('aura_lua_store', JSON.stringify(luaStore));
    
    showToast(`Successfully auto-saved to ${dateString}.lua file.`);
}

// --- PASSWORD PROTECTED DOWNLOAD ---
document.getElementById('btn-lua-cancel').addEventListener('click', () => {
    luaModal.classList.add('hidden');
    pendingDownloadDate = null;
});

document.getElementById('btn-lua-confirm').addEventListener('click', () => {
    const pwd = document.getElementById('lua-pwd').value;
    if (pwd === '8838') {
        luaModal.classList.add('hidden');
        if (pendingDownloadDate) {
            executeLuaDownload(pendingDownloadDate);
            pendingDownloadDate = null;
        }
    } else {
        showToast('ACCESS DENIED: Invalid Master Code.');
    }
});

function renderLuaFiles() {
    const luaStore = JSON.parse(localStorage.getItem('aura_lua_store')) || {};
    const list = document.getElementById('lua-file-list');
    list.innerHTML = '';

    const dates = Object.keys(luaStore).sort().reverse(); 

    if (dates.length === 0) {
        list.innerHTML = '<div class="history-item"><span style="color: var(--text-muted);">No daily Lua configurations generated yet.</span></div>';
        return;
    }

    dates.forEach(date => {
        const songCount = luaStore[date].length;
        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerHTML = `
            <div class="hist-info">
                <span class="hist-name">${date}.lua</span>
                <span class="hist-meta" style="color: var(--accent-primary);">Contains ${songCount} configured song(s)</span>
            </div>
            <div class="hist-actions">
                <button class="btn-primary outline btn-dl-lua" data-date="${date}">Download Script</button>
                <button class="btn-icon btn-del-lua" data-date="${date}" title="Delete File">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            </div>
        `;
        list.appendChild(div);
    });

    // Request password when attempting to download
    document.querySelectorAll('.btn-dl-lua').forEach(btn => {
        btn.addEventListener('click', (e) => {
            pendingDownloadDate = e.target.dataset.date;
            luaModal.classList.remove('hidden');
            document.getElementById('lua-pwd').value = '';
            document.getElementById('lua-pwd').focus();
        });
    });

    document.querySelectorAll('.btn-del-lua').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const date = e.currentTarget.dataset.date;
            if (confirm(`WARNING: Are you sure you want to permanently delete all ${luaStore[date].length} songs configured on ${date}?`)) {
                delete luaStore[date];
                localStorage.setItem('aura_lua_store', JSON.stringify(luaStore));
                renderLuaFiles();
            }
        });
    });
}

function executeLuaDownload(date) {
    const luaStore = JSON.parse(localStorage.getItem('aura_lua_store')) || {};
    const entries = luaStore[date] || [];

    const luaContent = `-- AURA Auto-Generated Config | Date: ${date}\n-- Contains ${entries.length} Song(s)\n\nreturn {\n${entries.join(',\n')}\n}`;

    const blob = new Blob([luaContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${date}_Aura_Config.lua`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast(`Authorization Accepted. ${date}_Aura_Config.lua downloaded.`);
}

// --- Actions ---
document.getElementById('btn-copy').addEventListener('click', () => {
    navigator.clipboard.writeText(document.getElementById('final-asset-id').textContent)
    .then(() => showToast('Asset ID copied'));
});

// --- History ---
async function loadHistory() {
    try {
        const res = await fetch('/api/uploads');
        const uploads = await res.json();
        const list = document.getElementById('history-list');
        list.innerHTML = '';
        
        uploads.forEach(u => {
            const div = document.createElement('div');
            div.className = 'history-item';
            
            div.innerHTML = `
                <div class="hist-info">
                    <span class="hist-name">${u.original_filename}</span>
                    <span class="hist-meta">${new Date(u.created_at).toLocaleDateString()} • ID: ${u.asset_id || '---'}</span>
                </div>
                <div class="hist-actions">
                    <span class="status-lbl ${u.status}">${u.status}</span>
                </div>
            `;
            list.appendChild(div);
        });
    } catch (e) {}
}