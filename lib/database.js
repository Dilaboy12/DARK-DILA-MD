const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "../data");

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * Get database file path.
 */
function getFilePath(name) {
    if (typeof name !== "string" || !/^[a-zA-Z0-9_-]+$/.test(name)) {
        throw new Error("Invalid database filename");
    }

    return path.join(DATA_DIR, `${name}.json`);
}

/**
 * Read JSON database.
 */
function read(name, defaultValue = {}) {
    const file = getFilePath(name);

    try {
        if (!fs.existsSync(file)) {
            write(name, defaultValue);
            return defaultValue;
        }

        const content = fs.readFileSync(file, "utf8");
        return content.trim() ? JSON.parse(content) : defaultValue;
    } catch (error) {
        console.error(`[DATABASE] Read error (${name}):`, error.message);
        return defaultValue;
    }
}

/**
 * Write JSON database.
 */
function write(name, data) {
    const file = getFilePath(name);
    const tempFile = `${file}.tmp`;

    try {
        fs.writeFileSync(
            tempFile,
            JSON.stringify(data, null, 2),
            "utf8"
        );

        fs.renameSync(tempFile, file);
        return true;
    } catch (error) {
        console.error(`[DATABASE] Write error (${name}):`, error.message);

        if (fs.existsSync(tempFile)) {
            fs.unlinkSync(tempFile);
        }

        return false;
    }
}

/**
 * Update one database value.
 */
function update(name, callback, defaultValue = {}) {
    if (typeof callback !== "function") {
        throw new Error("Callback must be a function");
    }

    const data = read(name, defaultValue);
    const result = callback(data);

    return write(name, result === undefined ? data : result);
}

/**
 * Delete a database file.
 */
function remove(name) {
    const file = getFilePath(name);

    if (fs.existsSync(file)) {
        fs.unlinkSync(file);
        return true;
    }

    return false;
}

module.exports = {
    read,
    write,
    update,
    remove,
    DATA_DIR
};
