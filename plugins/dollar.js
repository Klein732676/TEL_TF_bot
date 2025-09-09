const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs-extra');
const path = require('path');

// ملف قاعدة البيانات
const dataFile = path.resolve(__dirname, '../data/dollar.json');

// التأكد من وجود المجلد والملف
if (!fs.existsSync(path.dirname(dataFile))) fs.mkdirSync(path.dirname(dataFile), { recursive: true });
if (!fs.existsSync(dataFile)) fs.writeFileSync(dataFile, '{}', 'utf8');

// تحميل البيانات من الملف
let dollarData = {};
try {
    dollarData = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
} catch (e) {
    console.error('خطأ عند قراءة dollar.json:', e);
    dollarData = {};
}

// حفظ البيانات في الملف
function saveData() {
    try {
        fs.writeFileSync(dataFile, JSON.stringify(dollarData, null, 2), 'utf8');
    } catch (e) {
        console.error('خطأ عند حفظ dollar.json:', e);
    }
}

// متغير لحفظ مؤقتات الإرسال التلقائي
const timerIntervals = {};

// متغير لحفظ مراقبي تغيير السعر
const priceMonitors = {};
let lastPrices = {}; // حفظ آخر أسعار لمقارنتها

// دالة لجلب سعر الدولار
async function getDollarRates() {
    try {
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

        if (!found) throw new Error("USD rate not found on page");

        // تحويل التاريخ والوقت للغة الفارسية
        const now = new Date();
        const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true };
        const dateOptions = { year: 'numeric', month: 'numeric', day: 'numeric' };
        const persianTime = now.toLocaleTimeString('fa-AF', timeOptions);
        const persianDate = now.toLocaleDateString('fa-AF', dateOptions);

        return {
            buy,
            sell,
            text: `⊹‏⊱≼━━━━⌬〔• 💰 •〕⌬━━━━≽⊰⊹
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
            `.trim()
        };
    } catch (err) {
        console.error("Error fetching dollar rates:", err.message);
        throw err;
    }
}

// دالة لتحويل النص إلى مليثانية (محسَّنة)
function parseTimeToMilliseconds(timeStr) {
    if (!timeStr) return 60000; // افتراضي: دقيقة واحدة
    
    // دعم الصيغ الجديدة مثل "1د" و "10د" و "30د"
    const match = timeStr.match(/^(\d+)([ثدسي])$/i);
    if (!match) return 60000; // افتراضي: دقيقة واحدة
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    switch (unit) {
        case 'ث': // ثانية
            return value * 1000;
        case 'د': // دقيقة
            return value * 60000;
        case 'س': // ساعة
            return value * 3600000;
        case 'ي': // يوم
            return value * 86400000;
        default:
            return 60000; // افتراضي: دقيقة واحدة
    }
}

// دالة لأمان العمليات غير المتزامنة
function safeAsyncOperation(operation, chatId, fallbackMessage = '❌ فشل في العملية') {
    return operation().catch(error => {
        console.error(`خطأ في عملية الدردشة ${chatId}:`, error);
        return null;
    });
}

// دالة لبدء الإرسال التلقائي (محسَّنة)
async function startAutoSend(bot, chatId, interval) {
    const chatIdStr = chatId.toString();
    
    // إيقاف أي مؤقتات سابقة لهذه الدردشة
    if (timerIntervals[chatIdStr]) {
        clearInterval(timerIntervals[chatIdStr]);
        delete timerIntervals[chatIdStr];
    }
    
    // إيقاف مراقبة الأسعار إن وُجدت
    if (priceMonitors[chatIdStr]) {
        clearInterval(priceMonitors[chatIdStr]);
        delete priceMonitors[chatIdStr];
    }
    
    // تحديث حالة الدردشة
    dollarData[chatIdStr] = {
        active: true,
        interval: interval,
        lastUpdate: new Date().getTime(),
        type: 'auto_send' // نوع العملية
    };
    safeAsyncOperation(() => Promise.resolve(saveData()), chatIdStr);
    
    // دالة إرسال آمنة
    const sendDollarRate = async () => {
        return safeAsyncOperation(async () => {
            const rates = await getDollarRates();
            if (rates) {
                lastPrices[chatIdStr] = { buy: rates.buy, sell: rates.sell };
                await bot.sendMessage(chatId, rates.text);
                return true;
            }
            return false;
        }, chatIdStr);
    };
    
    // إرسال فوري
    await sendDollarRate();
    
    // بدء المؤقت
    timerIntervals[chatIdStr] = setInterval(sendDollarRate, interval);
    
    console.log(`✅ تم بدء الإرسال التلقائي للدردشة ${chatIdStr} كل ${interval}مس`);
    return interval;
}

// دالة لإيقاف الإرسال التلقائي (محسَّنة)
function stopAutoSend(chatId) {
    const chatIdStr = chatId.toString();
    let stopped = false;
    
    // إيقاف المؤقت
    if (timerIntervals[chatIdStr]) {
        clearInterval(timerIntervals[chatIdStr]);
        delete timerIntervals[chatIdStr];
        stopped = true;
    }
    
    // إيقاف مراقبة الأسعار
    if (priceMonitors[chatIdStr]) {
        clearInterval(priceMonitors[chatIdStr]);
        delete priceMonitors[chatIdStr];
        stopped = true;
    }
    
    // حذف البيانات
    if (dollarData[chatIdStr]) {
        delete dollarData[chatIdStr];
        safeAsyncOperation(() => Promise.resolve(saveData()), chatIdStr);
        stopped = true;
    }
    
    // حذف آخر الأسعار
    if (lastPrices[chatIdStr]) {
        delete lastPrices[chatIdStr];
    }
    
    if (stopped) {
        console.log(`✅ تم إيقاف جميع العمليات للدردشة ${chatIdStr}`);
    }
    
    return stopped;
}

module.exports = {
    command: 'دولار',
    description: 'إظهار سعر الدولار في أفغانستان مع خاصية التحديث التلقائي',
    usage: '/دولار [وقت]',
    category: 'معلومات',

    async execute(bot, msg, args) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;

        try {
            // فحص ما إذا كان المؤقت نشط لهذه المحادثة
            const isActive = timerIntervals[chatId] ? true : false;
            
            // إذا كانت الرسالة فقط 'دولار' بدون وسائط إضافية
            if (!args || args.length === 0) {
                if (isActive) {
                    // إيقاف الإرسال التلقائي
                    stopAutoSend(chatId);
                    await bot.sendMessage(chatId, '✅ تم إيقاف التحديث التلقائي لسعر الدولار.');
                } else {
                    // بدء الإرسال التلقائي بالوقت الافتراضي (دقيقة)
                    const defaultInterval = 60000; // دقيقة واحدة
                    const interval = await startAutoSend(bot, chatId, defaultInterval);
                    await bot.sendMessage(chatId, `✅ تم تفعيل التحديث التلقائي لسعر الدولار كل دقيقة.\n\n🔄 لإيقاف التحديث التلقائي، اكتب: دولار\n⏱️ لتغيير الوقت، اكتب: دولار [رقم][ث/د/س/ي]\nمثال: دولار 30ث، دولار 2د، دولار 1س`);
                }
                return;
            }
            
            // إذا كان هناك وسيط زمني (مثل 30ث، 2د، 1س)
            const timeArg = args[0];
            const interval = parseTimeToMilliseconds(timeArg);
            
            // تحويل المليثانية إلى نص مقروء
            let timeText;
            if (interval < 60000) {
                timeText = `${Math.floor(interval / 1000)} ثانية`;
            } else if (interval < 3600000) {
                timeText = `${Math.floor(interval / 60000)} دقيقة`;
            } else if (interval < 86400000) {
                timeText = `${Math.floor(interval / 3600000)} ساعة`;
            } else {
                timeText = `${Math.floor(interval / 86400000)} يوم`;
            }
            
            // بدء الإرسال التلقائي
            await startAutoSend(bot, chatId, interval);
            await bot.sendMessage(chatId, `✅ تم تفعيل التحديث التلقائي لسعر الدولار كل ${timeText}.\n\n🔄 لإيقاف التحديث التلقائي، اكتب: دولار`);
            
        } catch (error) {
            console.error('خطأ في أمر الدولار:', error);
            await bot.sendMessage(chatId, '❌ فشل في تنفيذ الأمر. يرجى المحاولة لاحقاً.');
        }
    }
};

// دالة مساعدة لإعادة المحادثات المفعلة
module.exports.getActiveChats = function() {
    return Object.keys(dollarData).filter(id => dollarData[id] && dollarData[id].active);
};

// استعادة المؤقتات النشطة عند تشغيل البوت (محسَّنة)
module.exports.restoreTimers = function(bot) {
    const activeChats = Object.keys(dollarData);
    let restoredCount = 0;
    
    activeChats.forEach(chatId => {
        const data = dollarData[chatId];
        if (data && data.active && data.interval) {
            // فحص عمر البيانات - لا نستعيد بيانات أقدم من 24 ساعة
            const lastUpdate = data.lastUpdate || 0;
            const now = new Date().getTime();
            const timeDiff = now - lastUpdate;
            
            if (timeDiff < 86400000) { // 24 ساعة
                safeAsyncOperation(async () => {
                    await startAutoSend(bot, chatId, data.interval);
                    restoredCount++;
                    return true;
                }, chatId, `فشل في استعادة مؤقت للدردشة ${chatId}`);
            } else {
                // حذف البيانات القديمة
                delete dollarData[chatId];
            }
        }
    });
    
    // حفظ البيانات المعدلة
    saveData();
    
    if (restoredCount > 0) {
        console.log(`✅ تم استعادة ${restoredCount} مؤقتاً نشطاً`);
    }
};

// إيقاف جميع المؤقتات النشطة
module.exports.stopAllTimers = function() {
    Object.keys(timerIntervals).forEach(chatId => {
        clearInterval(timerIntervals[chatId]);
        delete timerIntervals[chatId];
    });
    
    Object.keys(priceMonitors).forEach(chatId => {
        clearInterval(priceMonitors[chatId]);
        delete priceMonitors[chatId];
    });
    
    // مسح جميع بيانات الدردشة
    dollarData = {};
    saveData();
    
    console.log('✅ تم إيقاف جميع مؤقتات سعر الدولار ومراقبي الأسعار');
};

// بدء مراقبة تغيير السعر (محسَّنة)
module.exports.startPriceMonitoring = async function(bot, chatId) {
    const chatIdStr = chatId.toString();
    
    // إيقاف أي عمليات سابقة
    if (timerIntervals[chatIdStr]) {
        clearInterval(timerIntervals[chatIdStr]);
        delete timerIntervals[chatIdStr];
    }
    
    if (priceMonitors[chatIdStr]) {
        clearInterval(priceMonitors[chatIdStr]);
        delete priceMonitors[chatIdStr];
    }
    
    // جلب السعر الأولي
    await safeAsyncOperation(async () => {
        const initialRates = await getDollarRates();
        if (initialRates) {
            lastPrices[chatIdStr] = { buy: initialRates.buy, sell: initialRates.sell };
            // إرسال السعر الحالي فوراً
            await bot.sendMessage(chatId, initialRates.text);
        }
        return true;
    }, chatIdStr, 'فشل في جلب السعر الأولي');
    
    // حفظ في البيانات
    dollarData[chatIdStr] = {
        active: true,
        type: 'price_monitoring',
        lastUpdate: new Date().getTime()
    };
    saveData();
    
    // بدء المراقبة (كل 15 ثانية للسرعة في الاستجابة)
    const monitorPrice = async () => {
        await safeAsyncOperation(async () => {
            const currentRates = await getDollarRates();
            const previousPrice = lastPrices[chatIdStr];
            
            if (currentRates && previousPrice) {
                const buyChanged = previousPrice.buy !== currentRates.buy;
                const sellChanged = previousPrice.sell !== currentRates.sell;
                
                if (buyChanged || sellChanged) {
                    // رسالة تنبيه مختصرة بالفارسية
                    const alertMessage = `🚨 تغییر در قیمت دالر!`;
                    
                    await bot.sendMessage(chatId, alertMessage);
                    
                    // إرسال السعر الكامل بعد ثانية
                    setTimeout(async () => {
                        await safeAsyncOperation(async () => {
                            await bot.sendMessage(chatId, currentRates.text);
                        }, chatIdStr);
                    }, 1000);
                }
                
                // تحديث آخر سعر
                lastPrices[chatIdStr] = { buy: currentRates.buy, sell: currentRates.sell };
            }
            
            return true;
        }, chatIdStr);
    };
    
    priceMonitors[chatIdStr] = setInterval(monitorPrice, 15000); // فحص كل 15 ثانية
    
    console.log(`✅ تم تفعيل مراقبة تغيير السعر للدردشة ${chatIdStr}`);
};

// إيقاف مراقبة تغيير السعر (محسَّنة)
module.exports.stopPriceMonitoring = function(chatId) {
    const chatIdStr = chatId.toString();
    let stopped = false;
    
    if (priceMonitors[chatIdStr]) {
        clearInterval(priceMonitors[chatIdStr]);
        delete priceMonitors[chatIdStr];
        stopped = true;
    }
    
    if (lastPrices[chatIdStr]) {
        delete lastPrices[chatIdStr];
    }
    
    // حذف من البيانات إذا كان نوعه مراقبة
    if (dollarData[chatIdStr] && dollarData[chatIdStr].type === 'price_monitoring') {
        delete dollarData[chatIdStr];
        saveData();
    }
    
    if (stopped) {
        console.log(`✅ تم إيقاف مراقبة تغيير السعر للدردشة ${chatIdStr}`);
    }
    
    return stopped;
};

// إرجاع قائمة المحادثات التي تراقب تغيير السعر
module.exports.getPriceMonitors = function() {
    return Object.keys(priceMonitors).filter(chatId => priceMonitors[chatId]);
};
