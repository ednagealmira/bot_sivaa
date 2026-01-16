const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

// 1. Load the FAQ data
const rawData = fs.readFileSync('faq.json');
const faqData = JSON.parse(rawData);

// 2. Initialize the Client
// LocalAuth stores your session so you don't scan the QR code every time
const client = new Client({
    authStrategy: new LocalAuth(),
    webVersionCache: {
        type: 'remote',
        remotePath: `https://raw.githubusercontent.com/wppconnect-team/wa-version/refs/heads/main/html/2.3000.1031490220-alpha.html`,    
    },
});

// 3. Generate QR Code for login
client.on('qr', (qr) => {
    console.log('Scan this QR code with your phone:');
    qrcode.generate(qr, { small: true });
});

// 4. Confirm connection
client.on('ready', () => {
    console.log('Bot is ready and listening!');
});

// 5. Main Message Handler
client.on('message', async message => {
    // Convert message to lowercase for easier matching
    const msgBody = message.body.toLowerCase();
    
    // Check if the message is in a Group or DM
    const chat = await message.getChat();
    const isGroup = chat.isGroup;
    
    let keyword = "";

    // --- SMART GREETING DETECTION ---
    // This Regex breakdown:
    // ^          : Start of the message
    // ( ... )    : Group of allowed greeting words
    // halo+      : Matches "halo", "haloo", "haloooo" (+ means "one or more")
    // hello+     : Matches "hello", "helloo", "helloooo"
    // ha+i+      : Matches "hai", "haai", "haiii"
    // \b         : Word Boundary (Ensures it stops there, so "haloooo" matches, but "halogen" does NOT)
    
    const greetingPattern = /^(halo+|hello+|hi+|hai+|helo+|hallo+)\b/;

    if (!isGroup) {
        // Check if the message matches the pattern OR explicitly mentions "sivaa"
        if (greetingPattern.test(msgBody) || msgBody.includes('sivaa')) {
            try {
                await message.reply(faqData["halo"]);
            } catch (e) {
                console.error(e);
            }
            return;
        } else {
            keyword = msgBody;
        }

        //=============Greetings without regex=============
        // const greetings = ['halo sivaa', 'hello sivaa', 'halo', 'hello', 'hi', 'hai'];
        // const isGreeting = greetings.includes(msgBody) || msgBody.startsWith('halo sivaa');

        // if (isGreeting) {
        //     await message.reply("Halo! Saya SIVAA, asisten virtual Anda. Ada yang bisa saya bantu mengenai kesehatan leher rahim? Ketik topik yang ingin Anda tanyakan.");
        //     return; // Stop here so it doesn't look for other answers
        // }
        
        if (faqData[keyword]) {
            try {
                await message.reply(faqData[keyword]);
            } catch (e) {
                console.error(e);
            }
        } else {
            try {
                await message.reply(`Mohon maaf, SIVAA belum mengenali kata kunci tersebut 🙏🏻\n\nSaat ini SIVAA hanya dapat memberikan informasi otomatis jika Anda mengetik salah satu topik berikut:\n👉 *KANKER SERVIKS*\n👉 *PEMERIKSAAN IVA*\n\nUntuk pertanyaan medis yang lebih spesifik, Anda bisa berkonsultasi langsung ke *Puskesmas Boom Baru*.\n\n📋 Jika Anda ingin langsung mendaftar pemeriksaan, silakan isi formulir di sini: https://tinyurl.com/RencanaIVAPuskesmasBoomBaru\n\nTerima kasih 💙`);
            } catch (e) {
                console.error(e);
            }
            
        }
    }
});

// 6. Start the bot
client.initialize();