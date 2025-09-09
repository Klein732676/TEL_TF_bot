const fs = require('fs-extra');
const path = require('path');
const logger = require('../utils/console');

let loadedPlugins = {};

async function loadPlugins() {
    try {
        const pluginsDir = path.join(__dirname, '../plugins');
        await fs.ensureDir(pluginsDir);
        const files = await fs.readdir(pluginsDir);
        const pluginFiles = files.filter(file => file.endsWith('.js') && file !== 'loader.js');

        loadedPlugins = {};

        for (const file of pluginFiles) {
            try {
                const pluginPath = path.join(pluginsDir, file);
                const plugin = require(pluginPath);
                
                if (plugin && typeof plugin.execute === 'function' && plugin.command) {
                    loadedPlugins[plugin.command] = plugin;
                    logger.info(`تم تحميل الإضافة: ${plugin.command}`);
                }
            } catch (error) {
                logger.error(`فشل تحميل الإضافة ${file}: ${error.message}`);
            }
        }

        return loadedPlugins;
    } catch (error) {
        logger.error('فشل في تحميل الإضافات:', error);
        return {};
    }
}

function getPlugins() {
    return loadedPlugins;
}

module.exports = {
    loadPlugins,
    getPlugins
};