console.log("🚀 DMS → WMS Bot Starting...");

const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason
} = require("@whiskeysockets/baileys");

const qrcode = require("qrcode-terminal");
const axios = require("axios");
const fs = require("fs");
const cron = require("node-cron");

let sock;

// ========================
// 📊 MESSAGE
// ========================
function buildMessage() {
    const now = new Date();

    const date = now.toLocaleDateString("en-GB");
    const time = now.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit"
    });

    return `📊 DMS to WMS Status Update—JUNE 2026

Dear Team,

Please find below the updated DMS to WMS status as of ${date}, ${time}.

Warehouses that have not yet shared their Sales Order data are requested to do so at the earliest to avoid delays in processing.

We request all concerned warehouses to take note of the pending orders:

* Merchant Errors: Please share correct details
* Insufficient Stock: Kindly raise GRNs against POs

Best Regards,  
Tech Team`;
}

// ========================
// 📄 SHEET EXPORT (A2:L12)
// ========================
async function downloadSheetPDF() {
    const SHEET_ID = "1lkTEocYCLcVRQJdJPJWAI6HZpt6V024uJPTzmLbao-8";
    const GID = "959647230";

    const url =
        `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export` +
        `?format=pdf&gid=${GID}&range=A2:L12` +
        `&size=A4&fitw=true&portrait=false&gridlines=false`;

    const filePath = "./sheet.pdf";

    const res = await axios.get(url, { responseType: "stream" });

    const writer = fs.createWriteStream(filePath);
    res.data.pipe(writer);

    return new Promise((resolve, reject) => {
        writer.on("finish", () => resolve(filePath));
        writer.on("error", reject);
    });
}

// ========================
// 🚀 SEND REPORT
// ========================
async function sendReport() {
    try {
        console.log("📤 Sending report...");

        const groupName = "😺😺😺";

        const chats = await sock.groupFetchAllParticipating();

        const group = Object.values(chats).find(
            g => g.subject === groupName
        );

        if (!group) {
            console.log("❌ Group not found");
            return;
        }

        const pdfPath = await downloadSheetPDF();
        const pdfBuffer = fs.readFileSync(pdfPath);

        await sock.sendMessage(group.id, {
            document: pdfBuffer,
            fileName: "DMS-WMS-Report.pdf",
            mimetype: "application/pdf",
            caption: buildMessage()
        });

        console.log("✅ Message sent successfully!");

    } catch (err) {
        console.error("❌ Error sending report:", err);
    }
}

// ========================
// ⏰ SCHEDULER
// ========================
function startScheduler() {
    console.log("⏰ Scheduler started (10 AM + 5 PM IST)");

    cron.schedule("0 10 * * *", () => {
        console.log("⏰ 10 AM trigger");
        sendReport();
    }, {
        timezone: "Asia/Kolkata"
    });

    cron.schedule("0 17 * * *", () => {
        console.log("⏰ 5 PM trigger");
        sendReport();
    }, {
        timezone: "Asia/Kolkata"
    });
}

// ========================
// 🚀 BOT START
// ========================
async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("auth");

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log("\n📱 Scan QR below:\n");
            qrcode.generate(qr, { small: true });
        }

        if (connection === "open") {
            console.log("\n✅ WhatsApp Connected!");
            startScheduler();
        }

        if (connection === "close") {
            const code = lastDisconnect?.error?.output?.statusCode;

            if (code !== DisconnectReason.loggedOut) {
                console.log("🔄 Reconnecting...");
                startBot();
            } else {
                console.log("❌ Logged out. Delete auth folder.");
            }
        }
    });
}

startBot();