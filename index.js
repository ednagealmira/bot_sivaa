const { Client, RemoteAuth } = require("whatsapp-web.js");
// const { Client, LocalAuth } = require('whatsapp-web.js');
const { MongoStore } = require("wwebjs-mongo");
const mongoose = require("mongoose");
const qrcode = require("qrcode-terminal");
const fs = require("fs");

// --- KEEP-ALIVE SERVER (Prevents Sleep) ---
const express = require("express");
const app = express();
const port = process.env.PORT || 3000; // Render sets a PORT env var automatically

app.get("/", (req, res) => res.send("Sivaa Bot is active on Render!"));
app.listen(port, () => console.log(`Server listening on port ${port}`));

// Load the FAQ data
const rawData = fs.readFileSync("faq.json");
const faqData = JSON.parse(rawData);

// --- DATABASE CONNECTION ---
const mongoURI = process.env.MONGO_URI; // We will set this in Render dashboard later

mongoose.connect(mongoURI).then(() => {
    console.log("Connected to MongoDB");

    const store = new MongoStore({ mongoose: mongoose });
    // Initialize the Client
    // LocalAuth stores your session so you don't scan the QR code every time
    const client = new Client({
        // authStrategy: new LocalAuth(),
        authStrategy: new RemoteAuth({
            store: store,
            backupSyncIntervalMs: 300000 // Save session every 5 minutes
        }),
        webVersionCache: {
            type: "remote",
            remotePath: `https://raw.githubusercontent.com/wppconnect-team/wa-version/refs/heads/main/html/2.3000.1031490220-alpha.html`,
        },
        puppeteer: {
            headless: true,
            // Render specific args to make Chrome work
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-accelerated-2d-canvas",
                "--no-first-run",
                "--disable-gpu",
                "--single-process",
                "--no-zygote",
            ],
        },
    });

    // Generate QR Code for login
    client.on("qr", (qr) => {
        console.log("QR RECEIVED", qr);
        console.log("Scan this QR code with your phone:");
        qrcode.generate(qr, { small: true });
    });

    // Confirm connection
    client.on("ready", () => {
        console.log("Sivaa Bot is ready and listening!");
    });

    // Main Message Handler
    client.on("message", async (message) => {
        if (message.type !== "chat") return;

        // Convert message to lowercase for easier matching
        const msgBody = message.body
            .toLowerCase()
            .replace(/[^a-z0-9 ]/g, " ") // Replace symbols with space
            .replace(/\s+/g, " ") // Merge multiple spaces into one
            .trim();

        // Check if the message is in a Group or DM
        const chat = await message.getChat();
        const isGroup = chat.isGroup;

        let keyword = msgBody;
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
            if (greetingPattern.test(msgBody) || msgBody.includes("sivaa")) {
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
                        const userSchema = new mongoose.Schema({
                            userId: { type: String, required: true, unique: true },
                            messageCount: { type: Number, default: 0 }
                        });
                        const User = mongoose.model('User', userSchema);
                        const userId = message.from; // Get the user's phone number ID
                        try {
                            const user = await User.findOneAndUpdate(
                                { userId: userId },
                                { $inc: { messageCount: 1 } }, 
                                { new: true, upsert: true }
                            );
                            if (user.messageCount % 3 === 0) {
                                await client.sendMessage(
                                    message.from,
                                    "Apakah ibu sudah mengerti dengan penjelasan kami?\n\nJika ibu sudah mengerti dan *bersedia mendaftar untuk dilakukan pemeriksaan IVA*, mohon untuk mengisi link google form dibawah ini.\nhttps://tinyurl.com/RencanaIVAPuskesmasBoomBaru",
                                );
                            }
                        } catch (e) {
                            console.error("Database error:", e);
                        }
                    }
                } else {
                    try {
                        await message.reply(
                            `Mohon maaf, SIVAA belum mengenali kata kunci tersebut 🙏🏻\n\nSaat ini SIVAA hanya dapat memberikan informasi otomatis jika Anda mengetik salah satu topik berikut:\n👉 *KANKER SERVIKS*\n👉 *PEMERIKSAAN IVA*\n\nUntuk pertanyaan medis yang lebih spesifik, Anda bisa berkonsultasi langsung ke *Puskesmas Boom Baru*.\n\n📋 Jika Anda ingin langsung mendaftar pemeriksaan, silakan isi formulir di sini: https://tinyurl.com/RencanaIVAPuskesmasBoomBaru\n\nTerima kasih 💙`,
                        );
                    } catch (e) {
                        console.error(e);
                    }
                }
            }
        }
    });

    // Start the bot
    client.initialize();

});

// Handle Ctrl+C (Manual stop in terminal)
process.on("SIGINT", async () => {
    console.log("(SIGINT) Shutting down...");
    await client.destroy();
    console.log("Client destroyed successfully.");
    process.exit(0);
});

// Handle Replit "Stop" button or system restarts
process.on("SIGTERM", async () => {
    console.log("(SIGTERM) Shutting down...");
    await client.destroy();
    console.log("Client destroyed successfully.");
    process.exit(0);
});
