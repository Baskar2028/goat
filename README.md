# Roblox Audio Uploader

A production-ready SaaS-style web application for processing audio (2x speed, loudness normalization, peak limiting) and securely uploading it to Roblox.

## Features
- **FFmpeg Pipeline:** 2x speed -> Loudness Normalization -> Gentle Compression -> Peak Limiting.
- **Privacy-First:** Strict server-side validation ensures users can only view their own uploads and Asset IDs. No public endpoint exposes files.
- **Auto-Cleanup:** Temporary files and uploads are scrubbed instantly after processing to save disk space.
- **Premium UI:** Dark mode, glass surfaces, smooth step-by-step progress bars.

## Prerequisites
1. **Node.js** (v16+)
2. **FFmpeg**: Must be installed globally on your server (accessible via `ffmpeg` command).
   - Windows: Install via Winget or download binaries.
   - Mac: `brew install ffmpeg`
   - Linux: `sudo apt install ffmpeg`
3. **Roblox Open Cloud API Key**: Generated via [Creator Dashboard](https://create.roblox.com/credentials) with `Audio` creation permissions.

## Installation

1. Copy all the provided files into a folder named `roblox-audio-uploader`.
2. Open terminal in the folder and run:
   `npm install`
3. Copy the environment variables:
   `cp .env.example .env`
4. Edit `.env` and fill in your Roblox API credentials. *(Note: The boilerplate code currently mocks the Roblox network delay so you can test the UI/FFmpeg immediately without an API key).*

## Running the App

`npm start`
Open your browser to `http://localhost:3000`.

*Disclaimer: Audio processing ensures acoustic compliance (loudness/peaking) and playback speed. It does not bypass Roblox moderation rules. All uploads are subject to standard platform TOS and copyright checks.*# leodass
# leodass
# leodass
# leo
# leo
# leo
# goat
# goat
