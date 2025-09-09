const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs-extra');
const path = require('path');
const logger = require('./utils/console');
const { loadPlugins } = require('./plugins/loader');
const config = require('./config.json');

// Initialize Telegram bot with better error handling
const bot = new TelegramBot(config.telegramToken, { 
    polling: {
        interval: 1000,
        params: {
            timeout: 10
        }
    },
    request: {
        agentOptions: {
            keepAlive: true,
            family: 4
        },
        timeout: 60000
    }
});

// Data directory
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Load plugins
let plugins = {};
async function initializePlugins() {
    plugins = await loadPlugins();
    logger.success(`تم تحميل ${Object.keys(plugins).length} إضافة`);
}

// Handle messages
bot.on('message', async (msg) => {
    try {
        const text = msg.text || '';
        const chatId = msg.chat.id;
        const userId = msg.from.id;

        // تجاهل الرسائل التي تبدأ بـ / (سيتم معالجتها من onText)
        if (text.startsWith('/')) return;
        
        // Check if message starts with prefix
        if (!text.startsWith(config.prefix)) return;

        const args = text.slice(config.prefix.length).trim().split(/\s+/);
        const command = args.shift().toLowerCase();

        logger.info(`📩 أمر: ${command} من: ${chatId}`);

        // Find and execute plugin
        const plugin = plugins[command];
        if (plugin) {
            try {
                await plugin.execute(bot, msg, args);
                logger.success(`✅ تم تنفيذ الأمر: ${command}`);
            } catch (error) {
                logger.error(`❌ خطأ في تنفيذ الأمر ${command}:`, error);
                await bot.sendMessage(chatId, config.messages.error);
            }
        }
    } catch (error) {
        logger.error('❌ خطأ في معالجة الرسالة:', error);
    }
});

// Handle polling errors
bot.on('polling_error', (error) => {
    logger.error(`❌ خطأ polling: ${error.code} - ${error.message}`);
    if (error.code === 'ETELEGRAM' && error.message.includes('409 Conflict')) {
        logger.warn('🔄 توقف مؤقت بسبب تعارض متعدد الوصول - جاري المحاولة مرة أخرى...');
        // لا نفعل شيء - المكتبة ستعيد المحاولة تلقائياً
    }
});

// Handle general errors
bot.on('error', (error) => {
    logger.error('❌ خطأ عام في البوت:', error);
});

// Start command
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    logger.info(`📩 أمر: /start من: ${chatId}`);
    
    const welcomeMessage = `🤖 مرحباً بك في بوت سعر الدولار الأفغاني!

💰 يمكنك متابعة سعر الدولار بشكل تلقائي وفوري
✨ مع إمكانية تخصيص فترة التحديث حسب رغبتك

📋 اختر قسماً من الأسفل:`;
    
    const keyboard = {
        inline_keyboard: [
            [{ text: '💵 سعر الدولار', callback_data: 'dollar_menu' }],
            [{ text: '⚙️ الإعدادات', callback_data: 'settings_menu' }],
            [{ text: '❓ المساعدة', callback_data: 'help_menu' }]
        ]
    };

    bot.sendMessage(chatId, welcomeMessage, {
        reply_markup: keyboard
    });
});

// معالج الأزرار التفاعلية
bot.on('callback_query', async (callbackQuery) => {
    const msg = callbackQuery.message;
    const chatId = msg.chat.id;
    const data = callbackQuery.data;
    const messageId = msg.message_id;
    
    logger.info(`🔘 زر مضغوط: ${data} من: ${chatId}`);

    try {
        switch (data) {
            case 'dollar_menu':
                await showDollarMenu(bot, chatId, messageId);
                break;
            case 'settings_menu':
                await showSettingsMenu(bot, chatId, messageId);
                break;
            case 'help_menu':
                await showHelpMenu(bot, chatId, messageId);
                break;
            case 'back_to_main':
                await showMainMenu(bot, chatId, messageId);
                break;
            case 'dollar_now':
                await showDollarNow(bot, chatId);
                break;
            case 'dollar_auto_1m':
                await startDollarAuto(bot, chatId, '1د');
                break;
            case 'dollar_auto_5m':
                await startDollarAuto(bot, chatId, '5د');
                break;
            case 'dollar_auto_10m':
                await startDollarAuto(bot, chatId, '10د');
                break;
            case 'dollar_auto_30m':
                await startDollarAuto(bot, chatId, '30د');
                break;
            case 'dollar_stop':
                await stopDollarAuto(bot, chatId);
                break;
            case 'price_monitor_start':
                await startPriceMonitoring(bot, chatId);
                break;
            case 'price_monitor_stop':
                await stopPriceMonitoring(bot, chatId);
                break;
            default:
                await bot.answerCallbackQuery(callbackQuery.id, '❌ أمر غير معروف');
                return;
        }
        
        // تأكيد استقبال الزر
        await bot.answerCallbackQuery(callbackQuery.id);
        
    } catch (error) {
        logger.error('❌ خطأ في معالجة الزر:', error);
        await bot.answerCallbackQuery(callbackQuery.id, '❌ حدث خطأ');
    }
});

// دوال مساعدة لعرض القوائم
async function showMainMenu(bot, chatId, messageId = null) {
    const welcomeMessage = `🤖 مرحباً بك في بوت سعر الدولار الأفغاني!

💰 يمكنك متابعة سعر الدولار بشكل تلقائي وفوري
✨ مع إمكانية تخصيص فترة التحديث حسب رغبتك

📋 اختر قسماً من الأسفل:`;
    
    const keyboard = {
        inline_keyboard: [
            [{ text: '💵 سعر الدولار', callback_data: 'dollar_menu' }],
            [{ text: '⚙️ الإعدادات', callback_data: 'settings_menu' }],
            [{ text: '❓ المساعدة', callback_data: 'help_menu' }]
        ]
    };

    if (messageId) {
        await bot.editMessageText(welcomeMessage, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: keyboard
        });
    } else {
        await bot.sendMessage(chatId, welcomeMessage, {
            reply_markup: keyboard
        });
    }
}

async function showDollarMenu(bot, chatId, messageId) {
    // فحص حالة التحديث التلقائي
    const dollarPlugin = plugins['دولار'];
    const isActive = dollarPlugin && dollarPlugin.getActiveChats && dollarPlugin.getActiveChats().includes(chatId.toString());
    const isMonitoring = dollarPlugin && dollarPlugin.getPriceMonitors && dollarPlugin.getPriceMonitors().includes(chatId.toString());
    
    const statusText = isActive ? '🟢 التحديث التلقائي نشط' : '🔴 التحديث التلقائي متوقف';
    const monitorText = isMonitoring ? '🟢 مراقبة تغيير السعر نشطة' : '🔴 مراقبة تغيير السعر متوقفة';
    
    const message = `💵 **قائمة سعر الدولار**

📊 حالة التحديث: ${statusText}
🔔 حالة المراقبة: ${monitorText}

اختر العملية المطلوبة:`;
    
    const keyboard = {
        inline_keyboard: [
            [{ text: '🔄 عرض السعر الآن', callback_data: 'dollar_now' }],
            [{ text: '⏰ تحديث كل دقيقة', callback_data: 'dollar_auto_1m' }],
            [{ text: '⏲️ تحديث كل 5 دقائق', callback_data: 'dollar_auto_5m' }],
            [{ text: '⏳ تحديث كل 10 دقائق', callback_data: 'dollar_auto_10m' }],
            [{ text: '🕰️ تحديث كل 30 دقيقة', callback_data: 'dollar_auto_30m' }]
        ]
    };
    
    // إضافة زر الإيقاف إذا كان التحديث نشط
    if (isActive) {
        keyboard.inline_keyboard.push([{ text: '☹️ إيقاف التحديث التلقائي', callback_data: 'dollar_stop' }]);
    }
    
    // إضافة أزرار مراقبة تغيير السعر
    if (isMonitoring) {
        keyboard.inline_keyboard.push([{ text: '🔕 إيقاف مراقبة تغيير السعر', callback_data: 'price_monitor_stop' }]);
    } else {
        keyboard.inline_keyboard.push([{ text: '🔔 تفعيل مراقبة تغيير السعر', callback_data: 'price_monitor_start' }]);
    }
    
    keyboard.inline_keyboard.push([{ text: '⬅️ عودة للقائمة الرئيسية', callback_data: 'back_to_main' }]);
    
    await bot.editMessageText(message, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: keyboard,
        parse_mode: 'Markdown'
    });
}

async function showSettingsMenu(bot, chatId, messageId) {
    const message = `⚙️ **قائمة الإعدادات**

🔧 هذه القائمة قيد التطوير
✨ سيتم إضافة المزيد من الإعدادات قريباً

💰 المصدر: البنك المركزي الأفغاني`;
    
    const keyboard = {
        inline_keyboard: [
            [{ text: '⬅️ عودة للقائمة الرئيسية', callback_data: 'back_to_main' }]
        ]
    };
    
    await bot.editMessageText(message, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: keyboard,
        parse_mode: 'Markdown'
    });
}

async function showHelpMenu(bot, chatId, messageId) {
    const message = `❓ **قائمة المساعدة**

🕰️ **وحدات الزمن:**
ث = ثانية | د = دقيقة | س = ساعة | ي = يوم

🔄 **الأوامر النصية:**
\u2022 دولار - تفعيل/إيقاف حسب الحالة
\u2022 دولار 30ث - تحديث كل 30 ثانية
\u2022 دولار 2د - تحديث كل دقيقتين
\u2022 دولار 1س - تحديث كل ساعة

💰 **المصدر:** البنك المركزي الأفغاني
✨ **التقويم:** فارسي أفغاني`;
    
    const keyboard = {
        inline_keyboard: [
            [{ text: '⬅️ عودة للقائمة الرئيسية', callback_data: 'back_to_main' }]
        ]
    };
    
    await bot.editMessageText(message, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: keyboard,
        parse_mode: 'Markdown'
    });
}

// دوال مساعدة للتعامل مع إضافة الدولار
async function showDollarNow(bot, chatId) {
    try {
        // عرض رسالة تحميل
        const loadingMsg = await bot.sendMessage(chatId, '⏳ جاري جلب سعر الدولار...');
        
        // جلب سعر الدولار مباشرة
        const axios = require('axios');
        const cheerio = require('cheerio');
        
        const url = "https://www.dab.gov.af/exchange-rates";
        const { data } = await axios.get(url, { timeout: 10000 });
        const $ = cheerio.load(data);

        let buy = null;
        let sell = null;
        let found = false;

        $('table').first().find('tbody tr').each((i, elem) => {
            const currency = $(elem).find('td').eq(0).text().trim();
            if (currency === "USD$" || currency === "USD" || currency.startsWith("USD")) {
                sell = $(elem).find('td').eq(1).text().trim();
                buy = $(elem).find('td').eq(2).text().trim();
                found = true;
                return false;
            }
        });

        if (!found) throw new Error("لم يتم العثور على سعر الدولار");

        // تحويل التاريخ والوقت للغة الفارسية
        const now = new Date();
        const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true };
        const dateOptions = { year: 'numeric', month: 'numeric', day: 'numeric' };
        const persianTime = now.toLocaleTimeString('fa-AF', timeOptions);
        const persianDate = now.toLocaleDateString('fa-AF', dateOptions);

        const dollarText = `⊹⊱≼━━━━⌬〔• 💰 •〕⌬━━━━≽⊰⊹
        «❮💵❯╃قــــیــــمت╃دالـــــر╃❮💵❯»
        ⊹‏⊱≼━━━━⌬〔• 💰 •〕⌬━━━━≽⊰⊹
        ✯╎ به دلیل تغییرات اقتصادی.
        ✯╎ مطابق با درخواست‌های پیوسته شما.
        ✯╎ قیمت فعلی دالر را تقدیم می‌کنیم.
        ✯╎ امیدواریم مورد استفاده قرار گیرد.
        ⊹‏⊱≼━━━━⌬〔• 💰 •〕⌬━━━━≽⊰⊹
        ┇💵╎قــیــمــت خــریــد╎⤹
        ✯╎↫ 〔 ${buy} افغانی 〕
        
        ┇💶╎قــیــمــت فــروش╎⤹
        ✯╎↫ 〔 ${sell} افغانی 〕
        
        ┇🕒╎زمــان╎⤹
        ✯╎↫ 〔 ${persianTime} 〕
        
        ┇📅╎تــاریــخ╎⤹
        ✯╎↫ 〔 ${persianDate} 〕
        
        ┇🌐╎مــنــبــع╎⤹
        ✯╎↫ 〔 بانک مرکزی افغانستان 〕
        ⊹‏⊱≼━━━━⌬〔• 💰 •〕⌬━━━━≽⊰⊹
        `.trim();
        
        // حذف رسالة التحميل وإرسال النتيجة
        await bot.deleteMessage(chatId, loadingMsg.message_id);
        await bot.sendMessage(chatId, dollarText);
        
    } catch (error) {
        logger.error('❌ خطأ في جلب سعر الدولار:', error);
        await bot.sendMessage(chatId, '❌ فشل في جلب سعر الدولار. يرجى المحاولة لاحقاً.');
    }
}

async function startDollarAuto(bot, chatId, timeStr) {
    try {
        if (plugins['دولار']) {
            const fakeMsg = { 
                chat: { id: chatId },
                from: { id: chatId }
            };
            await plugins['دولار'].execute(bot, fakeMsg, [timeStr]);
        }
    } catch (error) {
        logger.error('❌ خطأ في بدء التحديث التلقائي:', error);
        await bot.sendMessage(chatId, '❌ فشل في بدء التحديث التلقائي. يرجى المحاولة مرة أخرى.');
    }
}

async function stopDollarAuto(bot, chatId) {
    try {
        if (plugins['دولار']) {
            const fakeMsg = { 
                chat: { id: chatId },
                from: { id: chatId }
            };
            await plugins['دولار'].execute(bot, fakeMsg, []);
        }
    } catch (error) {
        logger.error('❌ خطأ في إيقاف التحديث التلقائي:', error);
        await bot.sendMessage(chatId, '❌ فشل في إيقاف التحديث التلقائي.');
    }
}

// بدء مراقبة تغيير السعر
async function startPriceMonitoring(bot, chatId) {
    try {
        if (plugins['دولار'] && plugins['دولار'].startPriceMonitoring) {
            await plugins['دولار'].startPriceMonitoring(bot, chatId);
            await bot.sendMessage(chatId, '✅ تم تفعيل مراقبة تغيير السعر!\n🔔 سيتم إرسال تنبيه فور حدوث أي تغيير في السعر.');
        }
    } catch (error) {
        logger.error('❌ خطأ في بدء مراقبة تغيير السعر:', error);
        await bot.sendMessage(chatId, '❌ فشل في بدء مراقبة تغيير السعر.');
    }
}

// إيقاف مراقبة تغيير السعر
async function stopPriceMonitoring(bot, chatId) {
    try {
        if (plugins['دولار'] && plugins['دولار'].stopPriceMonitoring) {
            plugins['دولار'].stopPriceMonitoring(chatId);
            await bot.sendMessage(chatId, '✅ تم إيقاف مراقبة تغيير السعر.');
        }
    } catch (error) {
        logger.error('❌ خطأ في إيقاف مراقبة تغيير السعر:', error);
    }
}

// Stop command - للمطورين فقط
bot.onText(/\/stop/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    logger.info(`📩 أمر: /stop من: ${chatId}`);

    // فحص إذا كان المستخدم من المطورين
    if (!config.owners.includes(userId)) {
        await bot.sendMessage(chatId, config.messages.ownerOnly);
        return;
    }

    try {
        // إرسال رسالة تأكيد الإغلاق
        await bot.sendMessage(chatId, '🛱 تم إيقاف البوت بنجاح!');
        
        // إيقاف جميع المؤقتات النشطة للدولار
        if (plugins['دولار'] && plugins['دولار'].stopAllTimers) {
            plugins['دولار'].stopAllTimers();
        }
        
        logger.info('🛱 تم إيقاف البوت بواسطة المطور');
        
        // إغلاق البوت
        setTimeout(() => {
            process.exit(0);
        }, 1000);
        
    } catch (error) {
        logger.error('❌ خطأ في إيقاف البوت:', error);
        await bot.sendMessage(chatId, '❌ حدث خطأ أثناء إيقاف البوت');
    }
});

// Initialize and start bot
async function startBot() {
    try {
        await initializePlugins();
        
        // استعادة المؤقتات النشطة للدولار
        if (plugins['دولار'] && plugins['دولار'].restoreTimers) {
            plugins['دولار'].restoreTimers(bot);
            logger.info('🔄 تم استعادة المؤقتات النشطة لسعر الدولار');
        }
        
        logger.success('✅ تم تشغيل البوت بنجاح!');
        logger.info('🤖 البوت يعمل وجاهز لاستقبال الأوامر');
    } catch (error) {
        logger.error('❌ فشل في تشغيل البوت:', error);
        process.exit(1);
    }
}

// Handle process termination gracefully
process.on('SIGINT', async () => {
    logger.info('🛑 إيقاف البوت...');
    try {
        // إيقاف جميع المؤقتات النشطة
        if (plugins['دولار'] && plugins['دولار'].stopAllTimers) {
            plugins['دولار'].stopAllTimers();
            logger.info('✅ تم إيقاف جميع المؤقتات');
        }
        
        // إنهاء البوت
        await bot.stopPolling();
        logger.success('🛑 تم إيقاف البوت بنجاح');
    } catch (error) {
        logger.error('❌ خطأ أثناء إيقاف البوت:', error);
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    logger.info('🛑 إيقاف البوت بواسطة SIGTERM...');
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    logger.error('❌ خطأ غير متوقع:', error);
    // لا نخرج من البرنامج فوراً - نترك البوت يعمل
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('❌ وعد مرفوض:', reason);
    // لا نخرج من البرنامج - نترك البوت يعمل
});

// Start the bot
startBot();