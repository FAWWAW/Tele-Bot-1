require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const FormData = require('form-data');

// Ganti 'TOKEN_BOT_ANDA_DI_SINI' dengan token dari BotFather
const token = process.env.TELEGRAM_BOT_TOKEN || '8613237376:AAHltKUch-gSG1C9BrmGlyhgtepsTdH7mSE';
const bot = new TelegramBot(token, { polling: true });

// ==========================================
// FUNGSI: IMGLARGER
// ==========================================
async function imglarger(image, { scale = '2', type = 'upscale' } = {}) {
    try {
        const config = {
            scales: ['2', '4'],
            types: { upscale: 13, enhance: 2, sharpener: 1 }
        };
        
        if (!Buffer.isBuffer(image)) throw new Error('Image buffer is required.');
        if (!config.types[type]) throw new Error(`Available types: ${Object.keys(config.types).join(', ')}.`);
        if (type === 'upscale' && !config.scales.includes(scale.toString())) throw new Error(`Available scales: ${config.scales.join(', ')}.`);
        
        const form = new FormData();
        form.append('file', image, `rynn_${Date.now()}.jpg`);
        form.append('type', config.types[type].toString());
        if (!['sharpener'].includes(type)) form.append('scaleRadio', type === 'upscale' ? scale.toString() : '1');
        
        const { data: p } = await axios.post('https://photoai.imglarger.com/api/PhoAi/Upload', form, {
            headers: {
                ...form.getHeaders(),
                accept: 'application/json, text/plain, */*',
                origin: 'https://imglarger.com',
                referer: 'https://imglarger.com/',
                'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36'
            }
        });
        
        if (!p.data.code) throw new Error('Upload failed.');
        
        while (true) {
            const { data: r } = await axios.post('https://photoai.imglarger.com/api/PhoAi/CheckStatus', {
                code: p.data.code,
                type: config.types[type]
            }, {
                headers: {
                    accept: 'application/json, text/plain, */*',
                    'content-type': 'application/json',
                    origin: 'https://imglarger.com',
                    referer: 'https://imglarger.com/',
                    'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36'
                }
            });
            
            if (r.data.status === 'success') return r.data.downloadUrls;
            
            await new Promise(res => setTimeout(res, 5000));
            if (r.data.status !== 'waiting' && r.data.status !== 'success') throw new Error('Processing failed.');
        }
    } catch (error) {
        throw new Error(error.message);
    }
}

// ==========================================
// FUNGSI: GOFILE
// ==========================================
async function gofile(image) {
    try {
        if (!Buffer.isBuffer(image)) throw new Error('File must be a buffer.');
        
        const { data: a } = await axios.post('https://api.gofile.io/accounts', {}, {
            headers: {
                origin: 'https://gofile.io',
                referer: 'https://gofile.io/',
                'user-agent': 'Mozilla/5.0 (Linux; Android 15; SM-F958 Build/AP3A.240905.015) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.86 Mobile Safari/537.36'
            }
        });
        
        if (!a?.data?.token) throw new Error('Failed to create account.');
        
        const { data: b } = await axios.post('https://api.gofile.io/contents/createfolder', {
            parentFolderId: a.data.rootFolder,
            public: true
        }, {
            headers: {
                authorization: `Bearer ${a.data.token}`,
                origin: 'https://gofile.io',
                referer: 'https://gofile.io/',
                'user-agent': 'Mozilla/5.0 (Linux; Android 15; SM-F958 Build/AP3A.240905.015) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.86 Mobile Safari/537.36'
            }
        });
        
        if (!b?.data?.id) throw new Error('Failed to create folder.');
        
        const form = new FormData();
        form.append('token', a.data.token);
        form.append('folderId', b.data.id);
        form.append('file', image, `${Date.now()}_file`);
        const { data } = await axios.post('https://upload.gofile.io/uploadfile', form, {
            headers: {
                ...form.getHeaders(),
                host: 'upload.gofile.io',
                origin: 'https://gofile.io',
                referer: 'https://gofile.io/',
                'user-agent': 'Mozilla/5.0 (Linux; Android 15; SM-F958 Build/AP3A.240905.015) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.86 Mobile Safari/537.36'
            }
        });
        
        return {
            id: data.data.id,
            filename: data.data.name,
            mimetype: data.data.mimetype,
            size: data.data.size,
            download_page: data.data.downloadPage
        };
    } catch (error) {
        throw new Error(error.message);
    }
}

// ==========================================
// HANDLER: TELEGRAM BOT
// ==========================================

console.log('Bot sedang berjalan...');

bot.on('photo', async (msg) => {
    const chatId = msg.chat.id;
    const processingMsg = await bot.sendMessage(chatId, 'Menerima foto... Sedang memproses (Upscale 4x), mohon tunggu sebentar ⏳');
    
    try {
        const photo = msg.photo[msg.photo.length - 1];
        const fileId = photo.file_id;
        const fileUrl = await bot.getFileLink(fileId);
        
        const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data);
        
        const resultUrl = await imglarger(buffer, { scale: '4', type: 'upscale' });
        
        const resultImage = await axios.get(resultUrl, { responseType: 'arraybuffer' });
        const resultBuffer = Buffer.from(resultImage.data);
        
        // PERBAIKAN: Mengirim sebagai Dokumen untuk menghindari error resolusi/dimensi
        await bot.sendDocument(chatId, resultBuffer, { 
            caption: '✅ Ini hasil foto yang telah diperbesar (Upscale 4x)!',
        }, {
            filename: `upscale_${Date.now()}.jpg`,
            contentType: 'image/jpeg'
        });

        await bot.deleteMessage(chatId, processingMsg.message_id);

    } catch (error) {
        console.error(error);
        bot.editMessageText(`❌ Gagal memproses gambar: ${error.message}`, {
            chat_id: chatId,
            message_id: processingMsg.message_id
        });
    }
});

bot.on('document', async (msg) => {
    const chatId = msg.chat.id;
    const processingMsg = await bot.sendMessage(chatId, 'Mengunggah file ke Gofile, mohon tunggu ⏳');
    
    try {
        const fileId = msg.document.file_id;
        if (msg.document.file_size > 20 * 1024 * 1024) {
            throw new Error('Ukuran file melebihi batas 20MB.');
        }

        const fileUrl = await bot.getFileLink(fileId);
        const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data);
        
        const result = await gofile(buffer);
        
        const successText = `✅ <b>Berhasil Diunggah!</b>\n\n` +
                            `📄 <b>Nama File:</b> ${result.filename}\n` +
                            `📦 <b>Ukuran:</b> ${(result.size / 1024 / 1024).toFixed(2)} MB\n` +
                            `🔗 <b>Link Download:</b> ${result.download_page}`;
                            
        await bot.sendMessage(chatId, successText, { parse_mode: 'HTML' });
        await bot.deleteMessage(chatId, processingMsg.message_id);

    } catch (error) {
        bot.editMessageText(`❌ Gagal mengunggah file: ${error.message}`, {
            chat_id: chatId,
            message_id: processingMsg.message_id
        });
    }
});

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, 
        "Halo! Kirim foto untuk <b>Upscale 4x</b> atau kirim dokumen untuk upload ke <b>Gofile</b>.",
        { parse_mode: 'HTML' }
    );
});
