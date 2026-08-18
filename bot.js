require('dotenv').config();
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const FormData = require('form-data');
const whois = require('whois-json');
const exifParser = require('exif-parser');

const TOKEN = process.env.TELEGRAM_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL;

const bot = new TelegramBot(TOKEN, { webHook: true });
const app = express();

app.use(express.json());

app.post('/bot-webhook', (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// ApexCodex İstek Fonksiyonu (.env'den çerezleri alır)
async function callApexCodex(action, params) {
    const form = new FormData();
    form.append('action', action);
    for (const [key, value] of Object.entries(params)) {
        form.append(key, value);
    }
    try {
        const response = await axios.post('https://apexcodex.alwaysdata.net/', form, {
            headers: {
                ...form.getHeaders(),
                'Cookie': `PHPSESSID=${process.env.APEX_SESS}`,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        return response.data;
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// RuhsuzPanel İstek Fonksiyonu (.env'den çerezleri alır)
async function callRuhsuzPanel(endpoint, dataObj) {
    const url = `https://ruhsuzpanel8.site/${endpoint}`;
    const headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': process.env.RUH_SESS,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    };
    try {
        const response = await axios.post(url, new URLSearchParams(dataObj).toString(), { headers });
        return response.data;
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Telegram Komutları

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, 
        "GHPanel OSINT Bot (.env Aktif) 🚀\n\n" +
        "Komutlar:\n" +
        "/tc <tc_no> - TC Kimlik Sorgu\n" +
        "/gsm <telefon> - GSM Sorgu\n" +
        "/aile <tc_no> - Aile Sorgu\n" +
        "/sulale <tc_no> - Sülale Sorgu\n" +
        "/hane <tc_no> - Hane Sorgu\n" +
        "/whois <domain> - Whois Sorgu\n" +
        "📷 (Fotoğraf): GPS / EXIF Analizi"
    );
});

bot.onText(/\/tc (.+)/, async (msg, match) => {
    const result = await callApexCodex('query_tc', { tc: match[1] });
    bot.sendMessage(msg.chat.id, `\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``, { parse_mode: 'Markdown' });
});

bot.onText(/\/gsm (.+)/, async (msg, match) => {
    const result = await callRuhsuzPanel('gsm.php', { gsm: match[1] });
    bot.sendMessage(msg.chat.id, `\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``, { parse_mode: 'Markdown' });
});

bot.onText(/\/aile (.+)/, async (msg, match) => {
    const result = await callApexCodex('query_aile', { tc: match[1] });
    bot.sendMessage(msg.chat.id, `\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``, { parse_mode: 'Markdown' });
});

bot.onText(/\/sulale (.+)/, async (msg, match) => {
    const result = await callApexCodex('query_sulale', { tc: match[1] });
    bot.sendMessage(msg.chat.id, `\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``, { parse_mode: 'Markdown' });
});

bot.onText(/\/hane (.+)/, async (msg, match) => {
    const result = await callRuhsuzPanel('hane.php', { tc: match[1], limit: 50, offset: 0 });
    bot.sendMessage(msg.chat.id, `\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``, { parse_mode: 'Markdown' });
});

bot.onText(/\/whois (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    try {
        const result = await whois(match[1]);
        bot.sendMessage(chatId, `\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``, { parse_mode: 'Markdown' });
    } catch (error) {
        bot.sendMessage(chatId, `Whois hatası: ${error.message}`);
    }
});

bot.on('photo', async (msg) => {
    const chatId = msg.chat.id;
    try {
        const photo = msg.photo[msg.photo.length - 1];
        const fileLink = await bot.getFileLink(photo.file_id);
        const response = await axios.get(fileLink, { responseType: 'arraybuffer' });
        const parser = exifParser.create(Buffer.from(response.data));
        const result = parser.parse();
        
        let report = "📷 **Görsel Meta Veri Analizi:**\n\n";
        report += `• Model: ${result.tags.Make || 'Bilinmiyor'} ${result.tags.Model || ''}\n`;
        
        if (result.gps && result.gps.Latitude && result.gps.Longitude) {
            const lat = result.gps.Latitude;
            const lon = result.gps.Longitude;
            report += `\n📍 **GPS Konum Bulundu:**\n• Harita: https://maps.google.com/?q=${lat},${lon}`;
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