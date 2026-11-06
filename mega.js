const fs = require("fs");
const { Storage, File } = require("megajs");

async function getStorage() {
    const email = process.env.MEGA_EMAIL;
    const password = process.env.MEGA_PASSWORD;

    if (!email || !password) {
        throw new Error(
            "MEGA_EMAIL or MEGA_PASSWORD GitHub Secrets are missing."
        );
    }

    return await new Storage({
        email,
        password,
        keepalive: false
    }).ready;
}

async function upload(filePath, fileName) {
    if (!fs.existsSync(filePath)) {
        throw new Error("Upload file not found: " + filePath);
    }

    const storage = await getStorage();

    try {
        const stat = fs.statSync(filePath);
        const stream = fs.createReadStream(filePath);

        const uploaded = await storage.upload({
            name: fileName,
            size: stat.size
        }, stream).complete;

        const url = await uploaded.link();

        if (!url || !url.includes("#")) {
            throw new Error("MEGA did not return a valid private file link.");
        }

        return url;
    } finally {
        storage.close();
    }
}

async function download(url) {
    if (!url || typeof url !== "string") {
        throw new Error("Invalid MEGA download URL.");
    }

    if (!/^https:\/\/mega\.(nz|co\.nz)\//i.test(url)) {
        throw new Error("Only valid MEGA file links are accepted.");
    }

    const file = File.fromURL(url);
    const buffer = await file.downloadBuffer();

    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        throw new Error("Downloaded MEGA session archive is empty.");
    }

    return buffer;
}

module.exports = {
    upload,
    download
};
