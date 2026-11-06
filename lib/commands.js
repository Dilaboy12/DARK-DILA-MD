const fs = require("fs");
const path = require("path");

const PLUGIN_DIR = path.join(__dirname, "../plugins");

class CommandHandler {
    constructor() {
        this.commands = new Map();
        this.plugins = new Map();
    }

    /**
     * Register a command.
     */
    register(plugin) {
        if (!plugin || typeof plugin.handler !== "function") {
            console.error("[COMMAND] Invalid plugin skipped");
            return false;
        }

        const names = Array.isArray(plugin.command)
            ? plugin.command
            : [plugin.command];

        if (!names.length || names.some(name =>
            typeof name !== "string" || !name.trim()
        )) {
            console.error("[COMMAND] Invalid command name");
            return false;
        }

        for (const name of names) {
            const commandName = name.trim().toLowerCase();

            if (this.commands.has(commandName)) {
                console.warn(`[COMMAND] Duplicate command: ${commandName}`);
                continue;
            }

            this.commands.set(commandName, plugin);
        }

        if (plugin.name) {
            this.plugins.set(plugin.name, plugin);
        }

        return true;
    }

    /**
     * Load all JavaScript plugins.
     */
    loadPlugins() {
        if (!fs.existsSync(PLUGIN_DIR)) {
            fs.mkdirSync(PLUGIN_DIR, { recursive: true });
        }

        const files = fs.readdirSync(PLUGIN_DIR)
            .filter(file => file.endsWith(".js"));

        for (const file of files) {
            const filePath = path.join(PLUGIN_DIR, file);

            try {
                delete require.cache[require.resolve(filePath)];

                const plugin = require(filePath);

                if (this.register(plugin)) {
                    console.log(`[PLUGIN] Loaded: ${file}`);
                }
            } catch (error) {
                console.error(
                    `[PLUGIN] Failed: ${file}`,
                    error.message
                );
            }
        }

        console.log(`[COMMAND] Total commands: ${this.commands.size}`);

        return this.commands.size;
    }

    /**
     * Get a command.
     */
    get(commandName) {
        return this.commands.get(
            String(commandName || "").toLowerCase()
        );
    }

    /**
     * Check whether command exists.
     */
    has(commandName) {
        return this.commands.has(
            String(commandName || "").toLowerCase()
        );
    }

    /**
     * Get all commands.
     */
    getAll() {
        return [...this.commands.keys()];
    }

    /**
     * Get all plugins.
     */
    getPlugins() {
        return [...this.plugins.keys()];
    }

    /**
     * Clear registered commands.
     */
    clear() {
        this.commands.clear();
        this.plugins.clear();
    }
}

module.exports = new CommandHandler();
