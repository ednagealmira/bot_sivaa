const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

// Load the FAQ data
const rawData = fs.readFileSync('faq.json');
const faqData = JSON.parse(rawData);
const userActivity = {};

// Initialize the Client
// LocalAuth stores your session so you don't scan the QR code every time
const client = new Client({
    authStrategy: new LocalAuth(),
    webVersionCache: {
        type: 'remote',
        remotePath: `https://raw.githubusercontent.com/wppconnect-team/wa-version/refs/heads/main/html/2.3000.1031490220-alpha.html`,    
    },
});

// Generate QR Code for login
client.on('qr', (qr) => {
    console.log('Scan this QR code with your phone:');
    qrcode.generate(qr, { small: true });
});

// Confirm connection
client.on('ready', () => {
    console.log('Bot is ready and listening!');
});

// Main Message Handler
client.on('message', async message => {
    // Convert message to lowercase for easier matching
    const msgBody = message.body
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, ' ')  // Replace symbols with space
        .replace(/\s+/g, ' ')         // Merge multiple spaces into one
        .trim();
    
    // Check if the message is in a Group or DM
    const chat = await message.getChat();
    const isGroup = chat.isGroup;
    
    let keyword = msgBody;
    console.log(msgBody);
    // --- SMART GREETING DETECTION ---
    // This Regex breakdown:
    // ^          : Start of the message
    // ( ... )    : Group of allowed greeting words
    // halo+      : Matches "halo", "haloo", "haloooo" (+ means "one or more")
    // hello+     : Matches "hello", "helloo", "helloooo"
    // ha+i+      : Matches "hai", "haai", "haiii"
    // \b         : Word Boundary (Ensures it stops there, so "haloooo" matches, but "halogen" does NOT)
    
    const greetingPattern = /^(halo+|hello+|hi+|ha+i+|helo+|hallo+)\b/;

    if (!isGroup) {
        // Check if the message matches the pattern OR explicitly mentions "sivaa"
        if (greetingPattern.test(msgBody) || msgBody.includes('sivaa')) {
            try {
                await message.reply(faqData["greeting"]);
            } catch (e) {
                console.error(e);
            }
        } else {
            if (faqData[keyword]) {
                try {
                    await message.reply(faqData[keyword]);
                } catch (e) {
                    console.error(e);
                }

                const excludedTopics = ["kanker serviks", "pemeriksaan iva"];
                if (!excludedTopics.includes(keyword)) {
                    // COUNTER LOGIC
                    const userId = message.from; // Get the user's phone number ID

                    // If this user is new, start their counter at 0
                    if (!userActivity[userId]) {
                        userActivity[userId] = 0;
                    }

                    // Add 1 to their count
                    userActivity[userId]++;

                    console.log("userId", userId);
                    console.log('userActivity count', userActivity[userId])
                    // CHECK IF IT IS THE 3RD MESSAGE
                    if (userActivity[userId] % 3 === 0) {
                        console.log('sudah nanya 3 kali lebih');
                        try {
                            await client.sendMessage(message.from, "Apakah ibu sudah mengerti dengan penjelasan kami?\n\nJika ibu sudah mengerti dan *bersedia mendaftar untuk dilakukan pemeriksaan IVA*, mohon untuk mengisi link google form dibawah ini.\nhttps://tinyurl.com/RencanaIVAPuskesmasBoomBaru");
                        } catch (e) {
                            console.error(e);
                        }
                    }
                }
            } else {
                try {
                    await message.reply(`Mohon maaf, SIVAA belum mengenali kata kunci tersebut 🙏🏻\n\nSaat ini SIVAA hanya dapat memberikan informasi otomatis jika Anda mengetik salah satu topik berikut:\n👉 *KANKER SERVIKS*\n👉 *PEMERIKSAAN IVA*\n\nUntuk pertanyaan medis yang lebih spesifik, Anda bisa berkonsultasi langsung ke *Puskesmas Boom Baru*.\n\n📋 Jika Anda ingin langsung mendaftar pemeriksaan, silakan isi formulir di sini: https://tinyurl.com/RencanaIVAPuskesmasBoomBaru\n\nTerima kasih 💙`);
                } catch (e) {
                    console.error(e);
                }
            }
        }        
    }
});

// Start the bot
client.initialize();