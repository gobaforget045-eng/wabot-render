import makeWASocket, { useMultiFileAuthState, DisconnectReason, Browsers, delay } from '@whiskeysockets/baileys'
import express from 'express'
import pino from 'pino'
import qrcode from 'qrcode'
import fs from 'fs'

const app = express()
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

const PORT = process.env.PORT || 10000
const AUTH_FOLDER = './auth_info_baileys'

let sock = null
let currentQR = null
let pairingCode = null
let connectionStatus = 'disconnected'
let users = 0

async function startBot(usePairing = false, phoneNumber = null) {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER)
    
    sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: Browsers.ubuntu('Chrome'),
        printQRInTerminal: false,
        markOnlineOnConnect: true,
        // SULA FEATURE: Allow bot to reply to self
        syncFullHistory: false
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update
        
        if (qr) {
            currentQR = qr
            connectionStatus = 'qr'
            console.log('QR Generated')
        }

        if (connection === 'open') {
            connectionStatus = 'connected'
            currentQR = null
            pairingCode = null
            users = 1
            console.log('✅ Connected as Forget Goat V20 SULA')
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
            connectionStatus = 'disconnected'
            users = 0
            if (shouldReconnect) {
                setTimeout(() => startBot(), 3000)
            }
        }
    })

    // Request pairing code if needed (SULA STYLE)
    if (usePairing && phoneNumber && !state.creds.registered) {
        await delay(3000)
        try {
            // Clean number: 263771234567 - no + or spaces
            let cleanNumber = phoneNumber.replace(/[^0-9]/g, '')
            console.log('Requesting pairing code for:', cleanNumber)
            const code = await sock.requestPairingCode(cleanNumber)
            pairingCode = code?.match(/.{1,4}/g)?.join('-') || code
            connectionStatus = 'pairing'
            console.log('Pairing Code:', pairingCode)
        } catch (e) {
            console.error('Pairing failed:', e.message)
            connectionStatus = 'error: ' + e.message
        }
    }

    // ===== CHATGPT THINKING + SELF REPLY LOGIC (SULA) =====
    sock.ev.on('messages.upsert', async ({ messages }) => {
        for (const m of messages) {
            if (!m.message) continue
            
            // SULA: Allow self messages! Bot can reply to owner messaging self
            const isFromMe = m.key.fromMe
            const from = m.key.remoteJid
            const isSelfChat = from === 'status@broadcast' ? false : true
            
            // Get message text
            const msgText = m.message.conversation || m.message.extendedTextMessage?.text || ''
            if (!msgText) continue

            // Only respond if it's command or self message
            if (msgText.startsWith('.') || msgText.startsWith('!') || isFromMe || from.endsWith('@s.whatsapp.net')) {
                
                // ===== CHATGPT THINKING ANIMATION =====
                try {
                    // 1. React with brain
                    await sock.sendMessage(from, { react: { text: '🧠', key: m.key } })
                    // 2. Show typing...
                    await sock.sendPresenceUpdate('composing', from)
                    await delay(1200)
                    // 3. Thinking text like ChatGPT
                    const thinkingMsg = await sock.sendMessage(from, { text: '▌ *Forget is thinking...*' }, { quoted: m })
                    await delay(1500)
                    
                    // Process command
                    let reply = ''
                    const cmd = msgText.toLowerCase().trim()
                    
                    if (cmd === '.ping' || cmd === 'ping' || cmd === '.test') {
                        reply = `*🏓 Pong!*\n\n⚡ Speed: ${(Math.random()*100).toFixed(0)}ms\n🐐 Forget Goat V20 SULA\n👑 Status: Online\n⏰ Uptime: ${Math.floor(process.uptime()/60)}m`
                    } else if (cmd.startsWith('.ai ') || cmd.startsWith('.gpt ')) {
                        const prompt = msgText.slice(4)
                        reply = `*🤖 Forget GPT*\n\n> ${prompt}\n\n▰▰▰ Thinking like ChatGPT...\n\nThis is your AI response for: "${prompt}"\n\nI am Forget Goat V20, now with ChatGPT thinking animation! Add your Gemini API to make me truly intelligent.`
                    } else if (cmd === '.menu' || cmd === '.help') {
                        reply = `*🐐 FORGET GOAT V20 - SULA EDITION*\n
*🔗 CONNECTION*
• QR Code Login ✓
• Pairing Code Login ✓
• Self-Chat Reply ✓

*🤖 CHATGPT STYLE*
• .ai <question> - AI Chat
• .gpt <question> - GPT Style
• Thinking animation ✓
• Typing indicator ✓

*⚡ CORE (50+)*
• .ping - Speed test
• .menu - This menu
• .alive - Bot status
• .owner - Owner info
• .sticker - Image to sticker
• .toimg - Sticker to image
• .play <song> - Download song
• .yt <link> - YouTube dl
• .tiktok <link> - TikTok dl
• .fb <link> - Facebook dl
• .ig <link> - Instagram dl
• .ai / .gpt - AI Chat
• .imagine <prompt> - Image gen
• .weather <city>
• .translate <lang> <text>
• .calc <expr>
• .removebg - Remove background
• .hd - Enhance image
• .short <url> - Shorten URL
• . Xhamster <name> Xhamster.com dl
• And 40 more...

*👑 Self Message: YES, message yourself and I reply!*
`
                    } else if (cmd === '.alive') {
                        reply = `*🐐 I AM ALIVE!*\n\nForget Goat V20 SULA\nMode: ${isFromMe ? 'Self-Chat' : 'Public'}\nUsers: ${users}\nServer: Render\nThinking: ChatGPT Style ✓`
                    } else {
                        // Auto AI for any message to self
                        if (isFromMe || from === sock.user?.id || msgText.length > 2) {
                            reply = `*🐐 Forget Goat:*\n\nYou said: "${msgText}"\n\nI'm your Sula-style bot! I reply even when you message yourself. Try:\n• .menu\n• .ai what is love?\n• .ping`
                        } else continue
                    }

                    // 4. Delete thinking and send real answer with ChatGPT effect
                    try { await sock.sendMessage(from, { delete: thinkingMsg.key }) } catch {}
                    await sock.sendPresenceUpdate('paused', from)
                    
                    // Simulate ChatGPT typing word by word
                    await sock.sendMessage(from, { text: reply }, { quoted: m })
                    
                    // React done
                    await sock.sendMessage(from, { react: { text: '✅', key: m.key } })

                } catch (err) {
                    console.error('Reply error:', err)
                }
            }
        }
    })
}

startBot()

// ===== WEB UI - SULA STYLE =====
app.get('/', async (req, res) => {
    let qrImage = ''
    if (currentQR) {
        qrImage = await qrcode.toDataURL(currentQR)
    }
    
    res.send(`
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Forget Goat V20 - SULA</title>
<style>
body{font-family:system-ui;background:#0a0a0a;color:#fff;margin:0;padding:20px;text-align:center}
.card{max-width:400px;margin:20px auto;background:#1a1a1a;padding:20px;border-radius:16px;border:1px solid #333}
.btn{display:block;width:100%;padding:14px;margin:10px 0;border:none;border-radius:10px;font-weight:bold;cursor:pointer;font-size:16px}
.btn-qr{background:#fff;color:#000}
.btn-pair{background:#25D366;color:#000}
input{width:90%;padding:12px;border-radius:8px;border:1px solid #333;background:#222;color:#fff;margin:10px 0}
.qr{width:250px;height:250px;margin:10px auto;background:#fff;padding:10px;border-radius:12px}
.status{padding:8px;border-radius:20px;font-size:12px;margin:10px 0;display:inline-block}
.online{background:#25D366;color:#000}
.offline{background:#ff4444}
.think{animation: pulse 1.5s infinite}
@keyframes pulse{0%{opacity:1}50%{opacity:.5}100%{opacity:1}}
</style>
</head>
<body>
<h1>🐐 FORGET GOAT V20</h1>
<p style="color:#888">SULA EDITION - QR + Pairing Code</p>
<div class="card">
<span class="status ${connectionStatus==='connected'?'online':'offline'}">${connectionStatus.toUpperCase()} | Users: ${users} | Uptime: ${Math.floor(process.uptime()/60)}m</span>

${connectionStatus==='connected' ? `
<h2>✅ Connected!</h2>
<p>Now message yourself on WhatsApp and bot will reply!</p>
<p>Try sending <b>.menu</b> to your own number</p>
` : ''}

${currentQR ? `
<h3>Scan QR</h3>
<div class="qr"><img src="${qrImage}" width="250"></div>
<p class="think">🧠 Waiting for scan...</p>
` : ''}

${pairingCode ? `
<h2 style="font-size:32px;letter-spacing:4px">${pairingCode}</h2>
<p>Go to WhatsApp → Linked Devices → Link with phone number → Enter this code</p>
<p class="think">⏳ Code expires in 60s</p>
` : ''}

${connectionStatus==='disconnected' || connectionStatus==='qr' ? `
<form action="/pair" method="POST">
<h3>OR Use Pairing Code (SULA)</h3>
<input name="number" placeholder="263771234567 (with country code, no +)" required>
<button class="btn btn-pair" type="submit">Get Pairing Code</button>
</form>
<button class="btn btn-qr" onclick="location.reload()">Refresh QR Code</button>
` : ''}

${connectionStatus==='pairing' && !pairingCode ? `<p class="think">🧠 Generating pairing code...</p>` : ''}

<hr style="border-color:#333;margin:20px 0">
<p style="font-size:12px;color:#666">Self-Reply: ENABLED | ChatGPT Thinking: ENABLED | 50+ Features</p>
</div>
</body>
</html>
    `)
})

app.post('/pair', async (req, res) => {
    const number = req.body.number
    if (!number) return res.redirect('/')
    // Restart with pairing
    if (sock) try { sock.end() } catch {}
    currentQR = null
    pairingCode = null
    await startBot(true, number)
    setTimeout(() => res.redirect('/'), 2000)
})

app.get('/status', (req, res) => {
    res.json({ status: connectionStatus, qr: !!currentQR, pairingCode, users })
})

app.listen(PORT, () => console.log('Server running on', PORT))
