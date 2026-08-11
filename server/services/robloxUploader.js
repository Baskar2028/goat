const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');

async function uploadToRoblox(filePath, originalName, credentials) {
    const { apiKey, creatorId, creatorType } = credentials;

    if (!apiKey || !creatorId || apiKey === 'your_open_cloud_api_key') {
        throw new Error("Roblox API credentials are missing or invalid.");
    }

    // Clean the filename (Roblox limits names to 50 chars and dislikes file extensions)
    const cleanName = originalName.replace(/\.[^/.]+$/, "").substring(0, 50);

    const requestMetadata = {
        assetType: 'Audio',
        displayName: cleanName || 'AURA Audio', 
        description: 'AURA Audio',
        creationContext: { creator: {} }
    };

    if (creatorType.toLowerCase() === 'group') {
        requestMetadata.creationContext.creator.groupId = creatorId;
    } else {
        requestMetadata.creationContext.creator.userId = creatorId;
    }

    const formData = new FormData();
    
    // Explicitly tell Roblox this part is JSON data
    formData.append('request', JSON.stringify(requestMetadata), {
        contentType: 'application/json'
    });
    
    // Append the audio file
    formData.append('fileContent', fs.createReadStream(filePath));

    try {
        console.log(`[Roblox API] Uploading ${cleanName} to Roblox...`);
        const uploadRes = await axios.post('https://apis.roblox.com/assets/v1/assets', formData, {
            headers: {
                'x-api-key': apiKey,
                ...formData.getHeaders()
            }
        });

        const operationPath = uploadRes.data.path; 
        return await pollRobloxOperation(operationPath, apiKey);
        
    } catch (error) {
        // Log the exact Roblox API error to the terminal
        console.error("Roblox API Error Details:", error.response?.data || error.message);
        
        const errorMsg = error.response?.data?.message || error.message;
        throw new Error(`Roblox API Rejected: ${errorMsg}`);
    }
}

async function pollRobloxOperation(operationPath, apiKey) {
    const operationUrl = `https://apis.roblox.com/assets/v1/${operationPath}`;
    
    // INCREASED TIMEOUT: Check 40 times, waiting 3 seconds between each check (up to 120 seconds)
    for (let i = 0; i < 40; i++) {
        await new Promise(resolve => setTimeout(resolve, 3000)); 
        
        console.log(`[Roblox API] Checking processing status... (Attempt ${i + 1}/40)`);
        
        try {
            const res = await axios.get(operationUrl, { headers: { 'x-api-key': apiKey } });

            if (res.data.done) {
                if (res.data.response && res.data.response.assetId) {
                    console.log(`[Roblox API] Success! Asset ID: ${res.data.response.assetId}`);
                    return res.data.response.assetId; 
                } else {
                    throw new Error("Roblox moderation or processing rejected the file.");
                }
            }
        } catch (pollError) {
            // Ignore temporary network blips during polling
            if (pollError.response && pollError.response.status === 401) {
                throw new Error("Roblox API Key is invalid or missing permissions.");
            }
        }
    }
    throw new Error("Roblox asset processing timed out.");
}

module.exports = { uploadToRoblox };