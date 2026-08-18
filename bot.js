const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const whois = require('whois-json');
const exifParser = require('exif-parser');

// ==================== ENVIRONMENT VARIABLES (SECRET) ====================
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL;

const RUH_COOKIE_STRING = 'RUHSID=2ab3c4e530074364e35991cca00d5c7b; cf_clearance=Sv3OeYBYrF0s6mqveRLRMoSn2dD8K4zvBht2L2WJwYo-1787066409-1.2.1.1-FM55vL69XUvKvz8.ARHpRXMGeiGGFU5ycPku4LavZYG3aQrFxw.0u8fa_U4W1N2MgBDrgTEkXHiIY1M3nuzYrr0i5AufojBGv4EGafCfVm1U7y.Pu5F7QPC10cl2PGGP5PHzHeyO0BccscGCcgaEMksfV2vwgHS3LFS4X4jmkMfITXeeL.uZ0T5ycbTrYTHdKB7oHQMEhnsqiKoZOzWO0EQRZun9I031rveppUuyDXtoFp6xWnbaLKXmwX6bRiNM_C9kH98cLBmbOSE5NiPwVeGdLZN7FWAVmGbrwXWm0OHyHjunrMB0qo73kK7A0kuYn6CdhgoT_azPMPCChaBs_fgTr1GaTDKk_MdYS6PQzlPaw_zpoIcviXU01v81ZClsV5huFNnF_q40GUOS1VAC.ECFP9O9nYnfEQ6kNy5V06egF4_r3jLT5.stz6.v5z4yku.a5j1BfAVsWJMrTsYxgA; twk_idm_key=7TT_ibQEdt3sK8rmHDFt-';
// ========================================================================

const bot = new TelegramBot(TOKEN, { webHook: true });
const app = express();

app.use(express.json());

app.post('/bot-webhook', (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// RuhsuzPanel Ortak İstek Fonksiyonu
async function callRuhsuzPanel(endpoint, dataObj) {
    const url = `https://ruhsuzpanel8.site/${endpoint}`;
    const headers = {
        'Accept': '*/*',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': RUH_COOKIE_STRING,
        'Origin': 'https://ruhsuzpanel8.site',
        'Referer': `https://ruhsuzpanel8.site/${endpoint}`,
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36'
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
        "GHPanel OSINT Bot Aktif 🚀\n\n" +
        "Komutlar:\n" +
        "/adsoyad <ad> <soyad> - Ad Soyad ile Sorgula (Örn: /adsoyad Gökalp İkiz)\n" +
        "/gsm <telefon> - GSM ile Sorgula\n" +
        "/hane <tc_no> - Hane Sorgula\n" +
        "/whois <domain> - Whois Sorgusu\n" +
        "/rdap <domain/ip> - RDAP Sorgusu\n" +
        "📁 (Dosya/Document Olarak Gönder): Fotoğrafın orijinal EXIF ve GPS meta verilerini analiz eder."
    );
});

// 1. Ad Soyad Sorgu Modülü (/adsoyad.php)
bot.onText(/\/adsoyad (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const args = match[1].split(' ');
    if (args.length < 2) {
        bot.sendMessage(chatId, "Lütfen geçerli formatta yazın. Örnek: `/adsoyad Gökalp İkiz`", { parse_mode: 'Markdown' });
        return;
    }
    const ad = args[0];
    const soyad = args.slice(1).join(' ');

    bot.sendMessage(chatId, `Sorgulanıyor (Ad Soyad): ${ad} ${soyad}...`);
    const result = await callRuhsuzPanel('adsoyad.php', { ad: ad, soyad: soyad });
    bot.sendMessage(chatId, `\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``, { parse_mode: 'Markdown' });
});

// 2. GSM Sorgu (gsm.php)
bot.onText(/\/gsm (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const gsm = match[1];
    bot.sendMessage(chatId, `Sorgulanıyor (GSM): ${gsm}...`);
    const result = await callRuhsuzPanel('gsm.php', { gsm: gsm });
    bot.sendMessage(chatId, `\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``, { parse_mode: 'Markdown' });
});

// 3. Hane Sorgu (hane.php)
bot.onText(/\/hane (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const tc = match[1];
    bot.sendMessage(chatId, `Sorgulanıyor (Hane): ${tc}...`);
    const result = await callRuhsuzPanel('hane.php', { tc: tc, limit: 50, offset: 0 });
    bot.sendMessage(chatId, `\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``, { parse_mode: 'Markdown' });
});

// Whois Sorgu
bot.onText(/\/whois (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    try {
        const result = await whois(match[1]);
        bot.sendMessage(chatId, `\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``, { parse_mode: 'Markdown' });
    } catch (error) {
        bot.sendMessage(chatId, `Whois hatası: ${error.message}`);
    }
});

// RDAP Sorgu
bot.onText(/\/rdap (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const query = match[1].trim();
    bot.sendMessage(chatId, `RDAP sorgulanıyor: ${query}...`);
    try {
        let rdapUrl = `https://rdap.org/domain/${query}`;
        if (/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(query)) {
            rdapUrl = `https://rdap.org/ip/${query}`;
        }
        const response = await axios.get(rdapUrl);
        bot.sendMessage(chatId, `\`\`\`json\n${JSON.stringify(response.data, null, 2)}\n\`\`\``, { parse_mode: 'Markdown' });
    } catch (error) {
        bot.sendMessage(chatId, `RDAP sorgu hatası: ${error.message}`);
    }
});

// Görsel Meta / GPS Analizi (Dosya olarak gönderildiğinde)
bot.on('document', async (msg) => {
    const chatId = msg.chat.id;
    const doc = msg.document;
    if (!doc.mime_type || !doc.mime_type.startsWith('image/')) return;

    try {
        bot.sendMessage(chatId, "Dosya görseli analiz ediliyor, EXIF ve GPS verileri taranıyor...");
        const fileLink = await bot.getFileLink(doc.file_id);
        const response = await axios.get(fileLink, { responseType: 'arraybuffer' });
        const parser = exifParser.create(Buffer.from(response.data));
        const result = parser.parse();
        
        let report = "📁 **Dosya Görsel Meta Analizi:**\n\n";
        report += `• Cihaz Model: ${result.tags.Make || 'Bilinmiyor'} ${result.tags.Model || ''}\n`;
        report += `• Çekim Tarihi: ${result.tags.DateTimeOriginal ? new Date(result.tags.DateTimeOriginal * 1000).toLocaleString() : 'Bilinmiyor'}\n`;
        
        if (result.gps && result.gps.Latitude && result.gps.Longitude) {
            const lat = result.gps.Latitude;
            const lon = result.gps.Longitude;
            report += `\n📍 **GPS Konum (Bulundu!):**\n• Harita: https://maps.google.com/?q=${lat},${lon}`;
        } else {
            report += `\n⚠️ Bu dosyada GPS konum verisi bulunamadı.`;
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

