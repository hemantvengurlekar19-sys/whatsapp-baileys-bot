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
let schedulerStarted = false;
let groupId = null;

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

We request all concerned warehouses to take note of the pending orders. These are primarily due to stock issues or merchant-related errors:

• Merchant Errors: Please share the correct details for the affected orders.
• Insufficient Stock: Kindly raise GRNs against the respective Purchase Orders.

We request that the necessary actions be completed and updates shared via email or the group at the earliest. This will help us process the remaining orders and ensure timely closure for the month.

All warehouses are requested to resolve these issues promptly so that the pending orders can be placed accordingly.

Best Regards,
Tech Team`;
}

// ========================
// 📄 DOWNLOAD PDF
// ========================
async function downloadSheetPDF() {
    const SHEET_ID = "1lkTEocYCLcVRQJdJPJWAI6HZpt6V024uJPTzmLbao-8";
    const GID = "959647230";

    const url =
        `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export` +
        `?format=pdf&gid=${GID}` +
        `&range=A2:L12` +
        `&size=A4` +
        `&fitw=true` +
        `&portrait=false` +
        `&gridlines=false`;

    const filePath = "./sheet.pdf";

    const response = await axios({
        url,
        method: "GET",
        responseType: "stream"
    });

    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
        writer.on("finish", () => resolve(filePath));
        writer.on("error", reject);
    });
}

// ========================
// 📤 SEND REPORT
// ========================
async function sendReport() {
    try {
        console.log("📤 Sending report...");

        if (!groupId) {
            console.log("❌ Group ID not found");
            return;
        }

        const pdfPath = await downloadSheetPDF();
        const pdfBuffer = fs.readFileSync(pdfPath);

        await sock.sendMessage(groupId, {
            document: pdfBuffer,
            fileName: "DMS-WMS-Report.pdf",
            mimetype: "application/pdf",
            caption: buildMessage()
        });

        console.log("✅ Message sent successfully!");

    } catch (err) {
        console.error("❌ Error sending report:", err.message);
    }
}

// ========================
// ⏰ SCHEDULER
// ========================
function startScheduler() {

    if (schedulerStarted) return;

    schedulerStarted = true;

    console.log("⏰ Scheduler started (10 AM + 5 PM IST)");

    // 10:00 AM
    cron.schedule(
        "0 10 * * *",
        async () => {
            console.log("⏰ Triggered 10 AM job");
            await sendReport();
        },
        {
            timezone: "Asia/Kolkata"
        }
    );

    // 5:00 PM
    cron.schedule(
        "50 22 * * *",
        async () => {
            console.log("⏰ Triggered 5 PM job");
            await sendReport();
        },
        {
            timezone: "Asia/Kolkata"
        }
    );
}

// ========================
// 🚀 START BOT
// ========================
async function startBot() {

    const { state, saveCreds } =
        await useMultiFileAuthState("auth");

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {

        const {
            connection,
            lastDisconnect,
            qr
        } = update;

        if (qr) {
            console.log("\n📱 Scan QR Code:\n");
            qrcode.generate(qr, {
                small: true
            });
        }

        if (connection === "open") {

            console.log("\n✅ WhatsApp Connected!");

            // Find group only once
            if (!groupId) {

                const groups =
                    await sock.groupFetchAllParticipating();

                const targetGroup =
                    Object.values(groups).find(
                        g => g.subject === "😺😺😺"
                    );

                if (!targetGroup) {
                    console.log("❌ Group not found");
                    return;
                }

                groupId = targetGroup.id;

                console.log(
                    "✅ Group Found:",
                    targetGroup.subject
                );

                console.log(
                    "🆔 Group ID:",
                    groupId
                );
            }

            startScheduler();
        }

        if (connection === "close") {

            const code =
                lastDisconnect?.error?.output?.statusCode;

            if (code !== DisconnectReason.loggedOut) {

                console.log("🔄 Reconnecting...");

                setTimeout(() => {
                    startBot();
                }, 5000);

            } else {

                console.log(
                    "❌ Logged out. Delete auth folder and login again."
                );
            }
        }
    });
}

// ========================
// ▶️ START
// ========================
startBot();
