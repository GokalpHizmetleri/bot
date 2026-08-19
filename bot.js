const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const whois = require('whois-json');
const exifParser = require('exif-parser');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL;

// Aktif çerezlerin
const RUH_COOKIE_STRING = 'RUHSID=2ab3c4e530074364e35991cca00d5c7b; cf_clearance=Sv3OeYBYrF0s6mqveRLRMoSn2dD8K4zvBht2L2WJwYo-1787066409-1.2.1.1-FM55vL69XUvKvz8.ARHpRXMGeiGGFU5ycPku4LavZYG3aQrFxw.0u8fa_U4W1N2MgBDrgTEkXHiIY1M3nuzYrr0i5AufojBGv4EGafCfVm1U7y.Pu5F7QPC10cl2PGGP5PHzHeyO0BccscGCcgaEMksfV2vwgHS3LFS4X4jmkMfITXeeL.uZ0T5ycbTrYTHdKB7oHQMEhnsqiKoZOzWO0EQRZun9I031rveppUuyDXtoFp6xWnbaLKXmwX6bRiNM_C9kH98cLBmbOSE5NiPwVeGdLZN7FWAVmGbrwXWm0OHyHjunrMB0qo73kK7A0kuYn6CdhgoT_azPMPCChaBs_fgTr1GaTDKk_MdYS6PQzlPaw_zpoIcviXU01v81ZClsV5huFNnF_q40GUOS1VAC.ECFP9O9nYnfEQ6kNy5V06egF4_r3jLT5.stz6.v5z4yku.a5j1BfAVsWJMrTsYxgA; twk_idm_key=7TT_ibQEdt3sK8rmHDFt-';

const bot = new TelegramBot(TOKEN, { webHook: true });
const app = express();

app.use(express.json());

app.post('/bot-webhook', (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// Gelişmiş RuhsuzPanel İstek Fonksiyonu (Hata Ayıklama Destekli)
async function callRuhsuzPanel(endpoint, dataObj) {
    const url = `https://ruhsuzpanel8.site/${endpoint}`;
    const headers = {
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': RUH_COOKIE_STRING,
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
            details: error.response ? typeof error.response.data === 'string' ? error.response.data.substring(0, 150) : 'HTML/Cloudflare Engeli' : 'Sunucu yanıt vermedi'
        };
    }
}

// Telegram Komutları
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, 
        "GHPanel OSINT Bot Aktif 🚀\n\n" +
        "Komutlar:\n" +
        "/adsoyad <ad> <soyad> - Ad Soyad Sorgula\n" +
        "/gsm <telefon> - GSM Sorgula\n" +
        "/hane <tc_no> - Hane Sorgula\n" +
        "/whois <domain> - Whois Sorgusu\n" +
        "/rdap <domain/ip> - RDAP Sorgusu"
    );
});

bot.onText(/\/adsoyad (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const args = match[1].split(' ');
    if (args.length < 2) {
        bot.sendMessage(chatId, "Örnek kullanım: `/adsoyad Gökalp İkiz`", { parse_mode: 'Markdown' });
        return;
    }
    bot.sendMessage(chatId, `Sorgulanıyor...`);
    const res = await callRuhsuzPanel('adsoyad.php', { ad: args[0], soyad: args.slice(1).join(' ') });
    
    if (res.success) {
        bot.sendMessage(chatId, `\`\`\`json\n${JSON.stringify(res.data, null, 2)}\n\`\`\``, { parse_mode: 'Markdown' });
    } else {
        bot.sendMessage(chatId, `❌ **Panel Hatası / Engeli:**\n• HTTP Durum: ${res.status}\n• Mesaj: ${res.error}\n• Detay: ${res.details}`, { parse_mode: 'Markdown' });
    }
});

bot.onText(/\/gsm (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, `Sorgulanıyor...`);
    const res = await callRuhsuzPanel('gsm.php', { gsm: match[1] });
    
    if (res.success) {
        bot.sendMessage(chatId, `\`\`\`json\n${JSON.stringify(res.data, null, 2)}\n\`\`\``, { parse_mode: 'Markdown' });
    } else {
        bot.sendMessage(chatId, `❌ **Panel Hatası / Engeli:**\n• HTTP Durum: ${res.status}\n• Mesaj: ${res.error}\n• Detay: ${res.details}`, { parse_mode: 'Markdown' });
    }
});

bot.onText(/\/hane (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, `Sorgulanıyor...`);
    const res = await callRuhsuzPanel('hane.php', { tc: match[1], limit: 50, offset: 0 });
    
    if (res.success) {
        bot.sendMessage(chatId, `\`\`\`json\n${JSON.stringify(res.data, null, 2)}\n\`\`\``, { parse_mode: 'Markdown' });
    } else {
        bot.sendMessage(chatId, `❌ **Panel Hatası / Engeli:**\n• HTTP Durum: ${res.status}\n• Mesaj: ${res.error}\n• Detay: ${res.details}`, { parse_mode: 'Markdown' });
    }
});

// Whois / RDAP / Document aynen kalıyor...
bot.onText(/\/whois (.+)/, async (msg, match) => {
    try {
        const result = await whois(match[1]);
        bot.sendMessage(msg.chat.id, `\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``, { parse_mode: 'Markdown' });
    } catch (error) {
        bot.sendMessage(msg.chat.id, `Whois hatası: ${error.message}`);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    console.log(`Bot ${PORT} portunda çalışıyor.`);
    await bot.setWebHook(WEBHOOK_URL);
});
