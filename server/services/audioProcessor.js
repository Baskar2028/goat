const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

let hasRubberband = false;
try {
    hasRubberband = execSync('ffmpeg -filters').toString().includes('rubberband');
} catch (e) {}

function processAudio(inputPath, filename, options) {
    return new Promise((resolve, reject) => {
        const tempDir = path.join(__dirname, '../../temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

        const safeFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
        
        let pitchSemitones = parseFloat(options.pitchSemitones);
        if (isNaN(pitchSemitones) || pitchSemitones < -12 || pitchSemitones > 12) pitchSemitones = 0;
        
        let playbackSpeed = parseFloat(options.playbackSpeed);
        if (isNaN(playbackSpeed) || playbackSpeed < 0.25 || playbackSpeed > 2.0) playbackSpeed = 1.0;
        
        const P = Math.pow(2, pitchSemitones / 12);
        const T = 1 / playbackSpeed;

        const format = options.format === 'mp3' ? 'mp3' : 'ogg';
        const ext = format === 'mp3' ? '.mp3' : '.ogg';
        const outputPath = path.join(tempDir, `processed_${Date.now()}_${safeFilename}${ext}`);

        const audioFilters = [];

        if (P !== 1.0 || T !== 1.0) {
            if (hasRubberband) {
                audioFilters.push(`rubberband=pitch=${P.toFixed(8)}:tempo=${T.toFixed(8)}`);
            } else {
                let actualP = 1.0;
                if (P !== 1.0) {
                    const newRate = Math.round(44100 * P);
                    actualP = newRate / 44100; 
                    audioFilters.push(`asetrate=${newRate}`, `aresample=44100`);
                }
                
                const atempoFactor = T / actualP;
                if (Math.abs(atempoFactor - 1.0) > 0.00001) {
                    let remaining = atempoFactor;
                    while (remaining > 2.0) { audioFilters.push('atempo=2.0'); remaining /= 2.0; }
                    while (remaining < 0.5) { audioFilters.push('atempo=0.5'); remaining /= 0.5; }
                    if (Math.abs(remaining - 1.0) > 0.00001) {
                        audioFilters.push(`atempo=${remaining.toFixed(8)}`);
                    }
                }
            }
        }

        if (options.normalizeLoudness) {
            audioFilters.push('loudnorm=I=-16:LRA=7:TP=-1.5');
        }

        const ffmpegArgs = ['-y', '-i', inputPath];
        if (audioFilters.length > 0) ffmpegArgs.push('-filter:a', audioFilters.join(','));

        const sampleRate = options.sampleRate || '44100';
        const channels = options.channels || '2';
        const bitrate = options.bitrate || '320k';

        if (format === 'mp3') {
            ffmpegArgs.push('-c:a', 'libmp3lame', '-b:a', bitrate, '-ar', sampleRate, '-ac', channels);
        } else {
            ffmpegArgs.push('-c:a', 'libvorbis', '-q:a', '5', '-ar', sampleRate, '-ac', channels);
        }

        ffmpegArgs.push(outputPath);
        const ffmpeg = spawn('ffmpeg', ffmpegArgs);

        ffmpeg.on('close', (code) => {
            if (code === 0) resolve(outputPath);
            else reject(new Error(`FFmpeg exited with code ${code}`));
        });

        ffmpeg.on('error', (err) => reject(err));
    });
}

module.exports = { processAudio };