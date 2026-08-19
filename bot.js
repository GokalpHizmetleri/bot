const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const whois = require('whois-json');
const exifParser = require('exif-parser');
const puppeteer = require('puppeteer');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL;

const bot = new TelegramBot(TOKEN, { webHook: true });
const app = express();

app.use(express.json());

app.post('/bot-webhook', (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// ==================== OTOMATİK ÇEREZ TOPLAYICI ====================
async function getAutoCookies() {
    try {
        const browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ]
        });
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36');
        
        // Panele gidip güncel çerezleri yakalıyoruz
        await page.goto('https://ruhsuzpanel8.site/adsoyad.php', { waitUntil: 'networkidle2', timeout: 30000 });
        
        const cookies = await page.cookies();
        await browser.close();

        let cookieString = '';
        cookies.forEach(c => {
            cookieString += `${c.name}=${c.value}; `;
        });

        return cookieString;
    } catch (error) {
        console.error("Otomatik çerez toplama hatası:", error.message);
        return '';
    }
}
// ==================================================================

// RuhsuzPanel İstek Fonksiyonu (Otomatik taze çerezle çalışır)
async function callRuhsuzPanel(endpoint, dataObj) {
    const dynamicCookies = await getAutoCookies();
    const url = `https://ruhsuzpanel8.site/${endpoint}`;
    
    const headers = {
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': dynamicCookies,
        'Origin': 'https://ruhsuzpanel8.site',
        'Referer': `https://ruhsuzpanel8.site/${endpoint}`,
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36'
    };
    
    try {
        const response = await axios.post(url, new URLSearchParams(dataObj).toString(), { headers });
        return { success: true, data: response.data };
    } catch (error) {
        return { 
            success: false, 
            status: error.response ? error.response.status : 'Bilinmiyor',
            error: error.message,
            details: error.response ? (typeof error.response.data === 'string' ? error.response.data.substring(0, 150) : 'Cloudflare Engeli') : 'Sunucu yanıt vermedi'
        };
    }
}

// Telegram Komutları
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, 
        "GHPanel OSINT Bot (Tam Otomatik) 🚀\n\n" +
        "Komutlar:\n" +
        "/adsoyad <İsim(ler)> <Soyisim> - Ad Soyad Sorgula\n" +
        "/gsm <telefon> - GSM Sorgula\n" +
        "/hane <tc_no> - Hane Sorgula\n" +
        "/whois <domain> - Whois Sorgusu\n" +
        "/qr <metin_veya_link> - Anında QR Kod Görseli Üret\n" +
        "/base64 <encode|decode> <metin> - Base64 Şifreleme/Çözme\n" +
        "📁 (Dosya Olarak Gönder): Fotoğrafın EXIF ve GPS meta verilerini analiz eder."
    );
});

// Ad Soyad (İki isimli yapıları otomatik çözer: Son kelime soyad, öncekiler ad)
bot.onText(/\/adsoyad (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const args = match[1].trim().split(/\s+/);
    
    if (args.length < 2) {
        bot.sendMessage(chatId, "Lütfen en az bir isim ve bir soyisim girin.\nÖrnek: `/adsoyad Onur Mert Bulak`", { parse_mode: 'Markdown' });
        return;
    }

    const soyad = args[args.length - 1];
    const ad = args.slice(0, args.length - 1).join(' ');

    bot.sendMessage(chatId, `Çerezler otomatik toplanıp sorgulanıyor -> Ad: *${ad}* | Soyad: *${soyad}*...`, { parse_mode: 'Markdown' });
    const res = await callRuhsuzPanel('adsoyad.php', { ad: ad, soyad: soyad });
    
    if (res.success) {
        bot.sendMessage(chatId, `\`\`\`json\n${JSON.stringify(res.data, null, 2)}\n\`\`\``, { parse_mode: 'Markdown' });
    } else {
        bot.sendMessage(chatId, `❌ **Hata:**\n• Durum: ${res.status}\n• Detay: ${res.details}`, { parse_mode: 'Markdown' });
    }
});

bot.onText(/\/gsm (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, `Çerezler toplanıp sorgulanıyor...`);
    const res = await callRuhsuzPanel('gsm.php', { gsm: match[1] });
    
    if (res.success) {
        bot.sendMessage(chatId, `\`\`\`json\n${JSON.stringify(res.data, null, 2)}\n\`\`\``, { parse_mode: 'Markdown' });
    } else {
        bot.sendMessage(chatId, `❌ **Hata:**\n• Durum: ${res.status}\n• Detay: ${res.details}`, { parse_mode: 'Markdown' });
    }
});

bot.onText(/\/hane (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, `Çerezler toplanıp sorgulanıyor...`);
    const res = await callRuhsuzPanel('hane.php', { tc: match[1], limit: 50, offset: 0 });
    
    if (res.success) {
        bot.sendMessage(chatId, `\`\`\`json\n${JSON.stringify(res.data, null, 2)}\n\`\`\``, { parse_mode: 'Markdown' });
    } else {
        bot.sendMessage(chatId, `❌ **Hata:**\n• Durum: ${res.status}\n• Detay: ${res.details}`, { parse_mode: 'Markdown' });
    }
});

// Whois Sorgu
bot.onText(/\/whois (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    try {
        const result = await whois(match[1].trim());
        bot.sendMessage(chatId, `\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``, { parse_mode: 'Markdown' });
    } catch (error) {
        bot.sendMessage(chatId, `Whois hatası: ${error.message}`);
    }
});

// QR Kod Üretici
bot.onText(/\/qr (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const text = match[1].trim();
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(text)}`;
    
    bot.sendPhoto(chatId, qrImageUrl, { 
        caption: `🔗 **QR Kod Üretildi**\n• İçerik: \`${text}\``, 
        parse_mode: 'Markdown' 
    });
});

// Base64 Şifreleme / Çözme
bot.onText(/\/base64 (encode|decode) (.+)/i, (msg, match) => {
    const chatId = msg.chat.id;
    const action = match[1].toLowerCase();
    const text = match[2];

    try {
        let result = '';
        if (action === 'encode') {
            result = Buffer.from(text).toString('base64');
        } else {
            result = Buffer.from(text, 'base64').toString('utf8');
        }
        bot.sendMessage(chatId, `Sonuç:\n\`\`\`\n${result}\n\`\`\``, { parse_mode: 'Markdown' });
    } catch (error) {
        bot.sendMessage(chatId, `İşlem hatası: ${error.message}`);
    }
});

// Dosya Meta Analizi
bot.on('document', async (msg) => {
    const chatId = msg.chat.id;
    const doc = msg.document;
    if (!doc.mime_type || !doc.mime_type.startsWith('image/')) return;

    try {
        bot.sendMessage(chatId, "Görsel meta verileri taranıyor...");
        const fileLink = await bot.getFileLink(doc.file_id);
        const response = await axios.get(fileLink, { responseType: 'arraybuffer' });
        const parser = exifParser.create(Buffer.from(response.data));
        const result = parser.parse();
        
        let report = "📁 **Görsel Meta Analizi:**\n\n";
        report += `• Cihaz Model: ${result.tags.Make || 'Bilinmiyor'} ${result.tags.Model || ''}\n`;
        
        if (result.gps && result.gps.Latitude && result.gps.Longitude) {
            const lat = result.gps.Latitude;
            const lon = result.gps.Longitude;
            report += `\n📍 **GPS Konum:** https://maps.google.com/?q=${lat},${lon}`;
        } else {
            report += `\n⚠️ GPS verisi bulunamadı.`;
        }
        bot.sendMessage(chatId, report, { parse_mode: 'Markdown' });
    } catch (error) {
        bot.sendMessage(chatId, `Hata: ${error.message}`);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    console.log(`Bot ${PORT} portunda çalışıyor.`);
    await bot.setWebHook(WEBHOOK_URL);
});
