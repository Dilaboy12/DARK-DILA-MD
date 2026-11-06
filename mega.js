const fs = require("fs");
const { Storage, File } = require("megajs");

async function upload(filePath, fileName) {
    if (!fs.existsSync(filePath)) {
        throw new Error("Session archive not found: " + filePath);
    }

    const email = process.env.MEGA_EMAIL;
    const password = process.env.MEGA_PASSWORD;

    if (!email || !password) {
        throw new Error("MEGA_EMAIL or MEGA_PASSWORD is missing.");
    }

    const stat = fs.statSync(filePath);

    if (!stat.size) {
        throw new Error("Session archive is empty.");
    }

    let storage;

    try {
        console.log("[MEGA] Connecting to account...");

        storage = await new Storage({
            email,
            password,
            keepalive: false
        }).ready;

        console.log("[MEGA] Account connected.");
        console.log("[MEGA] Uploading:", fileName);
        console.log("[MEGA] File size:", stat.size);

        const stream = fs.createReadStream(filePath);

        const uploadStream = storage.upload({
            name: fileName,
            size: stat.size
        }, stream);

        const uploadedFile = await uploadStream.complete;

        console.log("[MEGA] Upload completed.");
        console.log("[MEGA] Creating private file link...");

        const url = await uploadedFile.link();

        if (!url) {
            throw new Error("MEGA returned an empty file link.");
        }

        console.log("[MEGA] Private link created.");

        return url;

    } catch (error) {
        throw new Error(
            "[MEGA UPLOAD] " + (error.message || String(error))
        );
    } finally {
        if (storage) {
            try {
                storage.close();
            } catch {}
        }
    }
}

async function download(url) {
    if (!url) {
        throw new Error("MEGA download URL is missing.");
    }

    try {
        console.log("[MEGA] Opening session file...");

        const file = File.fromURL(url);

        await file.loadAttributes();

        console.log("[MEGA] Downloading:", file.name);

        const buffer = await file.downloadBuffer();

        if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
            throw new Error("Downloaded session archive is empty.");
        }

        console.log("[MEGA] Download completed.");

        return buffer;

    } catch (error) {
        throw new Error(
            "[MEGA DOWNLOAD] " + (error.message || String(error))
        );
    }
}

module.exports = {
    upload,
    download
};
