
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const FormData = require('form-data');
const whois = require('whois-json');
const exifParser = require('exif-parser');

// ==================== SABİT ÇEREZLER VE AYARLAR ====================
const APEX_SESSION_ID = 'a37ebc4b724bbee56535b760527557b0';
const RUH_COOKIE_STRING = 'RUHSID=719ff939cffd042f3220a985a3c4e2cb; cf_clearance=gpSabjl8fkNYXB4YxeFsRfo.jRc7me3TyTAwotPVf7A-1787060256-1.2.1.1-A0SO0v3_.8peL9b7AUeEKVslCk7hbVOf48cDOPq7xrHF8qlVh8pJ30Vnst2PybOy2woGohfh4Q_cSwaOu1X6rtwKZMz6bKzYwzFlmRbErPgINm2KNmdCktlN0_xhbk.sOQCwp.SrtbLrBxj3geb31XXYRQ8UW1QyxesTNap2Kg0ALkZHxVr4VrguxtYO9uxQz.d9pOaE8d9Y29DPS0nY9Z8PrX.aFm963xEbIpxeSlXmbmPT5pl00rCmYsggqtu.4CJ.uyE0s_BYlTguLzzEBHQV7ueUyK32pDl3QA9B2Fp2angx5huKzYnaoTCVpQJMHsNWyNYUT49AzPGKIpphYdaAWRjJW9JaEZMrea4pGx2kZySyDu4Oa9T8Nt4iQg.WCpYT.N6kiqQIpmnjPHrDL_k9CE3Et0q0DC.6CLK89AV.I7rUleMFXj_tmybxpnNKEyCUsaOputyTYSuuJ.BsYg';
// ===================================================================

// Sadece hassas olması gereken Telegram Token ve Webhook URL secret (.env) üzerinden alınır
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL;

const bot = new TelegramBot(TOKEN, { webHook: true });
const app = express();

app.use(express.json());

app.post('/bot-webhook', (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// ApexCodex İstek Fonksiyonu
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
                'Cookie': `PHPSESSID=${APEX_SESSION_ID}`,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        return response.data;
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// RuhsuzPanel İstek Fonksiyonu
async function callRuhsuzPanel(endpoint, dataObj) {
    const url = `https://ruhsuzpanel8.site/${endpoint}`;
    const headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': RUH_COOKIE_STRING,
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
        "GHPanel OSINT Bot Aktif 🚀\n\n" +
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
