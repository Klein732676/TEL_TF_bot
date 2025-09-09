const TelegramBot = require('node-telegram-bot-api');
const config = require('./config.json');
const logger = require('./utils/console');

// إنشاء بوت مؤقت لإيقاف العمليات
const stopBot = new TelegramBot(config.telegramToken, { polling: false });

async function stopAllOperations() {
    try {
        logger.info('🛑 جاري إيقاف جميع العمليات...');
        
        // إيقاف أي webhooks إن وُجدت
        try {
            await stopBot.deleteWebHook();
            logger.info('✅ تم حذف webhook إن وُجد');
        } catch (error) {
            // تجاهل الخطأ إذا لم يكن هناك webhook
        }
        
        // إرسال رسالة للمطور الأول إذا كان موجوداً
        if (config.owners && config.owners.length > 0) {
            try {
                const ownerId = config.owners[0];
                await stopBot.sendMessage(ownerId, '🛑 تم إيقاف البوت وتنظيف جميع العمليات النشطة.');
            } catch (error) {
                logger.warn('تعذر إرسال رسالة الإيقاف للمطور');
            }
        }
        
        logger.success('✅ تم إيقاف جميع العمليات بنجاح!');
        logger.info('💡 يمكنك الآن تشغيل البوت مرة أخرى باستخدام: npm start');
        
    } catch (error) {
        logger.error('❌ خطأ أثناء إيقاف العمليات:', error.message);
    }
    
    process.exit(0);
}

stopAllOperations();
