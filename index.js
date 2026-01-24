import makeWASocket, { DisconnectReason, fetchLatestBaileysVersion, initAuthCreds, BufferJSON, proto } from "@whiskeysockets/baileys";
import mongoose from "mongoose";
import qrcode from "qrcode-terminal";
import fs from "fs";
import http from "http";
import pino from "pino";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// --- KEEP-ALIVE SERVER ---
const port = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200);
    res.end("Sivaa Bot is active!");
}).listen(port, () => console.log(`Server listening on port ${port}`));

// --- PING FAQ BOT EVERY 5 MINUTES ---
const FAQ_BOT_URL = "https://faq-bot-neso.onrender.com";
setInterval(async () => {
    try {
        const res = await fetch(FAQ_BOT_URL);
        console.log(`[Keep-Alive] Pinged ${FAQ_BOT_URL} - Status: ${res.status}`);
    } catch (err) {
        console.error(`[Keep-Alive] Failed to ping ${FAQ_BOT_URL}:`, err.message);
    }
}, 5 * 60 * 1000); // 5 minutes

// Load the FAQ data
const faqData = JSON.parse(fs.readFileSync(join(__dirname, "faq.json"), "utf-8"));
const userActivity = {};

// --- MongoDB Auth State Storage ---
const mongoURI = process.env.MONGO_URI;

// Schema for storing auth credentials in MongoDB
const authSchema = new mongoose.Schema({
    _id: String,
    data: String
}, { collection: "auth" });

let AuthState;

// Custom auth state that saves to MongoDB
async function useMongoDBAuthState() {
    const writeData = async (id, data) => {
        const serialized = JSON.stringify(data, BufferJSON.replacer);
        await AuthState.findOneAndUpdate(
            { _id: id },
            { _id: id, data: serialized },
            { upsert: true, new: true }
        );
    };

    const readData = async (id) => {
        try {
            const doc = await AuthState.findById(id);
            if (!doc) return null;
            return JSON.parse(doc.data, BufferJSON.reviver);
        } catch (e) {
            console.error("Error reading data:", id, e.message);
            return null;
        }
    };

    const removeData = async (id) => {
        await AuthState.deleteOne({ _id: id });
    };

    // Load existing creds or initialize new ones
    let creds = await readData("creds");
    if (!creds) {
        console.log("No existing credentials found, initializing new ones...");
        creds = initAuthCreds();
    }

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    for (const id of ids) {
                        const value = await readData(`${type}-${id}`);
                        if (value) {
                            if (type === "app-state-sync-key") {
                                data[id] = proto.Message.AppStateSyncKeyData.create(value);
                            } else if (type === "tctoken" && value.token) {
                                // Restore Buffer from serialized data
                                data[id] = {
                                    ...value,
                                    token: Buffer.from(value.token)
                                };
                            } else {
                                data[id] = value;
                            }
                        }
                    }
                    return data;
                },
                set: async (data) => {
                    const tasks = [];
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            if (value) {
                                tasks.push(writeData(`${category}-${id}`, value));
                            } else {
                                tasks.push(removeData(`${category}-${id}`));
                            }
                        }
                    }
                    await Promise.all(tasks);
                }
            }
        },
        saveCreds: async () => {
            await writeData("creds", creds);
            console.log("Credentials saved to MongoDB");
        }
    };
}

let sock;
let isConnecting = false;

async function startBot() {
    if (isConnecting) return;
    isConnecting = true;

    try {
        // Connect to MongoDB if not connected
        if (mongoose.connection.readyState !== 1) {
            console.log("Connecting to MongoDB...");
            await mongoose.connect(mongoURI);
            console.log("Connected to MongoDB");
            AuthState = mongoose.model("AuthState", authSchema);
        }

        const { state, saveCreds } = await useMongoDBAuthState();
        const { version } = await fetchLatestBaileysVersion();
        console.log("Using WA version:", version);

        sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: "silent" }),
            browser: ["SIVAA Bot", "Chrome", "1.0.0"],
            version,
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
        });

        // Save credentials when updated
        sock.ev.on("creds.update", saveCreds);

        // Handle connection updates
        sock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                console.log("\n========== QR CODE ==========");
                console.log("Scan with your phone:");
                qrcode.generate(qr, { small: true });
                console.log("=============================\n");
            }

            if (connection === "close") {
                isConnecting = false;
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut &&
                    statusCode !== DisconnectReason.connectionReplaced;

                console.log("Connection closed. Status:", statusCode);
                console.log("Error:", lastDisconnect?.error?.message || "Unknown");

                if (statusCode === DisconnectReason.connectionReplaced) {
                    console.log("Session conflict detected (another device connected).");
                    console.log("Clearing auth data to allow fresh QR scan...");
                    await AuthState.deleteMany({});
                    console.log("Auth data cleared. Restarting to show new QR code...");
                    setTimeout(startBot, 3000);
                } else if (shouldReconnect) {
                    console.log("Reconnecting in 5 seconds...");
                    setTimeout(startBot, 5000);
                } else {
                    console.log("Logged out. Clearing auth data...");
                    await AuthState.deleteMany({});
                    console.log("Auth data cleared. Restart the bot to scan QR again.");
                }
            } else if (connection === "open") {
                isConnecting = false;
                console.log("Sivaa Bot is ready and listening!");
            }
        });

        // Handle incoming messages
        sock.ev.on("messages.upsert", async (m) => {
            try {
                const msg = m.messages[0];
                if (!msg.message || msg.key.fromMe) return;
                if (m.type !== "notify") return;

                const messageType = Object.keys(msg.message)[0];
                if (messageType !== "conversation" && messageType !== "extendedTextMessage") return;

                const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
                const from = msg.key.remoteJid;

                // Skip group messages
                if (from.endsWith("@g.us")) return;

                // Normalize message
                const msgBody = text
                    .toLowerCase()
                    .replace(/[^a-z0-9 ]/g, " ")
                    .replace(/\s+/g, " ")
                    .trim();

                const greetingPattern = /^(halo+|hello+|hi+|ha+i+|helo+|hallo+)\b/;

                // Reply function
                const reply = async (content) => {
                    await sock.sendMessage(from, { text: content }, { quoted: msg });
                };

                const sendMessage = async (content) => {
                    await sock.sendMessage(from, { text: content });
                };

                if (greetingPattern.test(msgBody) || msgBody.includes("sivaa")) {
                    await reply(faqData["greeting"]);
                } else if (faqData[msgBody]) {
                    await reply(faqData[msgBody]);

                    const excludedTopics = ["kanker serviks", "pemeriksaan iva"];
                    if (!excludedTopics.includes(msgBody)) {
                        if (!userActivity[from]) {
                            userActivity[from] = 0;
                        }
                        userActivity[from]++;

                        if (userActivity[from] % 3 === 0) {
                            await sendMessage(
                                "Apakah ibu sudah mengerti dengan penjelasan kami?\n\nJika ibu sudah mengerti dan *bersedia mendaftar untuk dilakukan pemeriksaan IVA*, mohon untuk mengisi link google form dibawah ini.\nhttps://tinyurl.com/RencanaIVAPuskesmasBoomBaru"
                            );
                        }
                    }
                } else {
                    await reply(
                        `Mohon maaf, SIVAA belum mengenali kata kunci tersebut 🙏🏻\n\nSaat ini SIVAA hanya dapat memberikan informasi otomatis jika Anda mengetik salah satu topik berikut:\n👉 *KANKER SERVIKS*\n👉 *PEMERIKSAAN IVA*\n\nUntuk pertanyaan medis yang lebih spesifik, Anda bisa berkonsultasi langsung ke *Puskesmas Boom Baru*.\n\n📋 Jika Anda ingin langsung mendaftar pemeriksaan, silakan isi formulir di sini: https://tinyurl.com/RencanaIVAPuskesmasBoomBaru\n\nTerima kasih 💙`
                    );
                }
            } catch (e) {
                console.error("Error handling message:", e.message);
            }
        });

    } catch (e) {
        console.error("Error starting bot:", e.message);
        isConnecting = false;
        setTimeout(startBot, 5000);
    }
}

// Start the bot
startBot();

// Graceful shutdown
async function shutdown(signal) {
    console.log(`\n(${signal}) Shutting down...`);
    if (sock) {
        try {
            sock.end();
            console.log("Socket closed successfully.");
        } catch (e) {
            console.error("Error closing socket:", e.message);
        }
    }
    if (mongoose.connection.readyState === 1) {
        await mongoose.connection.close();
        console.log("MongoDB connection closed.");
    }
    process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
