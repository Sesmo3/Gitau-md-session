
const express = require('express');
const { makeWASocket, useMultiFileAuthState, makeInMemoryStore, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode');
const { zipSession } = require('./utils/zipSession');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('views'));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.get('/qr', async (req, res) => {
    const { state, saveCreds } = await useMultiFileAuthState('session');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, qr } = update;
        if (qr) {
            const qrImage = await qrcode.toDataURL(qr);
            res.send(`<h2>Scan the QR Code:</h2><img src="${qrImage}" /><p>Leave this tab open until WhatsApp connects.</p>`);
        }

        if (connection === 'open') {
            await saveCreds();
            await zipSession('./session', './views/session.zip');
            const jid = sock.user.id;
            await sock.sendMessage(jid, { document: fs.readFileSync('./views/session.zip'), mimetype: 'application/zip', fileName: 'session.zip' });
            console.log("✅ Session sent to", jid);
            sock.end();
        }

        if (connection === 'close') sock.end();
    });
});

app.listen(PORT, () => {
    console.log(`✅ Gitau-md Session Generator running on http://localhost:${PORT}`);
});
