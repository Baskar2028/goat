const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const path = require('path');

// VERCEL REQUIREMENT: Point fluent-ffmpeg to the static binary installed via NPM
ffmpeg.setFfmpegPath(ffmpegPath);

function processAudio(inputPath, originalName, options) {
    return new Promise((resolve, reject) => {
        const cleanName = originalName.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9]/g, '_');
        // Output must go to Vercel's /tmp directory
        const outputPath = path.join(options.tmpDir, `processed_${Date.now()}_${cleanName}.${options.format}`);

        const speed = parseFloat(options.playbackSpeed);
        const pitch = parseFloat(options.pitchSemitones);
        const pitchMultiplier = Math.pow(2, pitch / 12);
        
        let atempo = speed / pitchMultiplier;
        let asetrate = 44100 * pitchMultiplier;

        ffmpeg(inputPath)
            .audioFilters([
                `asetrate=${asetrate}`,
                `atempo=${atempo}`
            ])
            .toFormat(options.format)
            .on('end', () => resolve(outputPath))
            .on('error', (err) => reject(new Error(`FFmpeg processing failed: ${err.message}`)))
            .save(outputPath);
    });
}

module.exports = { processAudio };