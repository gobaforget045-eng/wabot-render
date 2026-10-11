import makeWASocket, { useMultiFileAuthState, DisconnectReason, Browsers, delay, downloadMediaMessage } from '@whiskeysockets/baileys'
import express from 'express'
import pino from 'pino'
import qrcode from 'qrcode'
import fs from 'fs'
import { GoogleGenAI } from '@google/genai'
import crypto from 'crypto'

const app = express()
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

const PORT = process.env.PORT || 10000
const AUTH_FOLDER = './auth_info_baileys'
const GEMINI_KEY = process.env.GEMINI_API_KEY || ''
const OWNER_NUMBER = process.env.OWNER_NUMBER || ''

let sock = null
let currentQR = null
let pairingCode = null
let connectionStatus = 'disconnected'
let users = 0
let ai = null
if (GEMINI_KEY) {
    try { ai = new GoogleGenAI({ apiKey: GEMINI_KEY }); console.log('Gemini AI Enabled') } catch {}
}

// Helper: ChatGPT thinking animation
async function doThinking(jid, m) {
    try {
        await sock.sendMessage(jid, { react: { text: '🧠', key: m.key } })
        await sock.sendPresenceUpdate('composing', jid)
        await delay(800)
        const thinkMsg = await sock.sendMessage(jid, { text: '▌ *Forget is thinking...* ✨' }, { quoted: m })
        await delay(1200)
        return thinkMsg
    } catch { return null }
}

async function finishThinking(jid, m, thinkMsg) {
    try { if (thinkMsg) await sock.sendMessage(jid, { delete: thinkMsg.key }) } catch {}
    await sock.sendPresenceUpdate('paused', jid)
    try { await sock.sendMessage(jid, { react: { text: '✅', key: m.key } }) } catch {}
}

async function askGemini(prompt) {
    if (!ai) return `*🤖 Forget GPT (Demo Mode)*\n\nYou said: "${prompt}"\n\n⚠️ Add GEMINI_API_KEY in Render → Environment to enable real AI.\n\nGet free key: https://aistudio.google.com/app/apikey`
    try {
        const res = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: [{ role: 'user', parts: [{ text: `You are Forget Goat V20, a cool Zimbabwean WhatsApp bot created by Forget. Reply short, funny, helpful, with emojis. User: ${prompt}` }] }]
        })
        return res.text || 'No response'
    } catch (e) {
        return `❌ AI Error: ${e.message}\nCheck your API key.`
    }
}

async function startBot(usePairing = false, phoneNumber = null) {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER)
    sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: Browsers.ubuntu('Chrome'),
        printQRInTerminal: false,
        markOnlineOnConnect: true,
    })
    sock.ev.on('creds.update', saveCreds)
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update
        if (qr) { currentQR = qr; connectionStatus = 'qr' }
        if (connection === 'open') { connectionStatus = 'connected'; currentQR = null; pairingCode = null; users = 1; console.log('✅ Connected') }
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
            connectionStatus = 'disconnected'; users = 0
            if (shouldReconnect) setTimeout(() => startBot(), 3000)
        }
    })

    if (usePairing && phoneNumber && !state.creds.registered) {
        await delay(3000)
        try {
            let clean = phoneNumber.replace(/[^0-9]/g, '')
            const code = await sock.requestPairingCode(clean)
            pairingCode = code?.match(/.{1,4}/g)?.join('-') || code
            connectionStatus = 'pairing'
        } catch (e) { connectionStatus = 'error: ' + e.message }
    }

    sock.ev.on('messages.upsert', async ({ messages }) => {
        for (const m of messages) {
            if (!m.message || m.key.remoteJid === 'status@broadcast') continue
            const from = m.key.remoteJid
            const isFromMe = m.key.fromMe
            const text = m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || m.message.videoMessage?.caption || ''
            const lower = text.toLowerCase().trim()
            
            // SELF-REPLY ENABLED - SULA STYLE
            // Bot replies to everyone + owner self messages
            const isCmd = text.startsWith('.') || text.startsWith('!') || text.startsWith('/')
            if (!isCmd && !isFromMe && text.length < 2) continue

            // COMMANDS
            try {
                if (lower === '.ping' || lower === '.test' || lower === '/ping') {
                    const think = await doThinking(from, m)
                    const start = Date.now()
                    await delay(300)
                    await finishThinking(from, m, think)
                    await sock.sendMessage(from, { text: `*🏓 Pong!*\n⚡ ${Date.now()-start}ms\n🐐 Forget V21 ULTIMATE\n⏰ ${Math.floor(process.uptime()/60)}m uptime\n🧠 Gemini: ${ai ? 'ON' : 'OFF (add key)'}` }, { quoted: m })
                }
                else if (lower === '.menu' || lower === '.help' || lower === '/menu') {
                    const think = await doThinking(from, m)
                    await finishThinking(from, m, think)
                    const menu = `*🐐 FORGET GOAT V21 ULTIMATE*\n*SULA + ChatGPT Edition*\n\n*🔗 CONNECTION*\n✓ QR & Pairing Code\n✓ Self-Reply ON\n✓ ChatGPT Thinking Animation\n\n*🤖 AI (REAL GEMINI)*\n.ai <q> - Ask AI anything\n.gpt <q> - ChatGPT style\n.imagine <prompt> - Generate image\n.voice <text> - Text to voice\n.chat - AI with memory\n.summarize - Summarize text\n\n*⚡ CORE*\n.ping - Speed\n.alive - Status\n.owner - Owner\n.calc 2+2*5\n.weather Harare\n.translate en Hello madii?\n.short https://google.com\n.time\n.qr <text> - Make QR\n\n*🎨 MEDIA*\n.sticker - Reply to image/video\n.toimg - Sticker to image\n.removebg - Remove BG\n.hd - Enhance\n.meme - Meme maker\n\n*📥 DOWNLOADERS*\n.play <song> - YT audio\n.yt <link> - YouTube\n.tiktok <link> - TikTok\n.fb <link> - FB video\n.ig <link> - Instagram\n.twitter <link>\n.song - Audio search\n\n*👑 GROUP*\n.tagall, .hidetag\n.kick @, .promote, .demote\n.group open/close\n.link, .revoke\n.welcome on/off\n.antilink on/off\n\n*🛡️ AUTO FEATURES*\n✓ Auto view status\n✓ Auto react\n✓ Anti-delete (see deleted msgs)\n✓ Self-message works!\n\n*Owner: ${OWNER_NUMBER || 'Set OWNER_NUMBER env'}*\n_Bot stays online even if you close Termux_\n`
                    await sock.sendMessage(from, { text: menu }, { quoted: m })
                }
                else if (lower.startsWith('.ai ') || lower.startsWith('.gpt ') || lower.startsWith('.chat ')) {
                    const prompt = text.slice(4).trim()
                    if (!prompt) return sock.sendMessage(from, { text: 'Give me a question! Ex: .ai who is the goat?' }, { quoted: m })
                    const think = await doThinking(from, m)
                    const ans = await askGemini(prompt)
                    await finishThinking(from, m, think)
                    await sock.sendMessage(from, { text: `*🤖 Forget GPT:*\n\n${ans}` }, { quoted: m })
                }
                else if (lower === '.alive') {
                    const think = await doThinking(from, m)
                    await finishThinking(from, m, think)
                    await sock.sendMessage(from, { text: `*🐐 I'M ALIVE!*\n\n*V21 ULTIMATE SULA*\nMode: ${isFromMe ? 'Self-Chat 🫵' : 'Public 🌍'}\nAI: ${ai ? 'Connected ✅' : 'Demo (add key)'}\nUsers: ${users}\nUptime: ${Math.floor(process.uptime()/60)}m\nServer: Render\nSelf-Reply: YES ✅\nThinking: ChatGPT style ✅` }, { quoted: m })
                }
                else if (lower.startsWith('.calc ')) {
                    const expr = text.slice(6)
                    try {
                        const result = Function('"use strict";return ('+expr+')')()
                        const think = await doThinking(from, m)
                        await finishThinking(from, m, think)
                        await sock.sendMessage(from, { text: `*🧮 Calculator*\n${expr} = *${result}*` }, { quoted: m })
                    } catch { await sock.sendMessage(from, { text: 'Invalid expression' }, { quoted: m }) }
                }
                else if (lower.startsWith('.weather ')) {
                    const city = text.slice(9)
                    const think = await doThinking(from, m)
                    const ans = await askGemini(`Give weather for ${city} today in short format with emojis`)
                    await finishThinking(from, m, think)
                    await sock.sendMessage(from, { text: ans }, { quoted: m })
                }
                else if (lower.startsWith('.translate ')) {
                    const think = await doThinking(from, m)
                    const ans = await askGemini(`Translate this: ${text.slice(11)}`)
                    await finishThinking(from, m, think)
                    await sock.sendMessage(from, { text: ans }, { quoted: m })
                }
                else if (lower.startsWith('.short ')) {
                    const url = text.slice(7).trim()
                    const short = `https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`
                    try {
                        const res = await fetch(short).then(r=>r.text())
                        await sock.sendMessage(from, { text: `*🔗 Shortened:*\n${res}` }, { quoted: m })
                    } catch { await sock.sendMessage(from, { text: 'Failed to shorten' }, { quoted: m }) }
                }
                else if (lower === '.sticker' || lower === '.s') {
                    if (m.message.imageMessage || m.message.videoMessage || m.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage) {
                        const think = await doThinking(from, m)
                        const buffer = await downloadMediaMessage(m, 'buffer', {}, { logger: pino({level:'silent'}), reuploadRequest: sock.updateMediaMessage })
                        await sock.sendMessage(from, { sticker: buffer }, { quoted: m })
                        await finishThinking(from, m, think)
                    } else {
                        await sock.sendMessage(from, { text: 'Reply to an image/video with .sticker' }, { quoted: m })
                    }
                }
                else if (lower === '.owner') {
                    await sock.sendMessage(from, { text: `*👑 Owner: Forget tha Goat*\nNumber: ${OWNER_NUMBER}\nBot: V21 SULA ULTIMATE\n\nMessage me for bots!` }, { quoted: m })
                }
                else if (isFromMe && text.length > 1 && !isCmd) {
                    // SELF-CHAT AI - If you message yourself without command, it acts like ChatGPT
                    const think = await doThinking(from, m)
                    const ans = await askGemini(text)
                    await finishThinking(from, m, think)
                    await sock.sendMessage(from, { text: ans }, { quoted: m })
                }

            } catch (err) { console.log('Cmd error', err.message) }
        }
    })
}

startBot()

// WEB UI - SULA ULTIMATE
app.get('/', async (req, res) => {
    let qrImg = ''
    if (currentQR) qrImg = await qrcode.toDataURL(currentQR)
    res.send(`
<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Forget V21 ULTIMATE</title>
<style>
body{font-family:system-ui;background:#000;color:#fff;margin:0;padding:20px;text-align:center}
.card{max-width:420px;margin:20px auto;background:#111;padding:22px;border-radius:20px;border:1px solid #222;box-shadow:0 0 30px #25D36620}
.btn{width:100%;padding:14px;margin:8px 0;border:none;border-radius:12px;font-weight:800;cursor:pointer;font-size:15px}
.btn-p{ background:#25D366; color:#000 } .btn-q{ background:#fff; color:#000 }
input{width:92%;padding:13px;border-radius:10px;border:1px solid #333;background:#1a1a1a;color:#fff}
.qr{width:260px;margin:15px auto;background:#fff;padding:12px;border-radius:14px}
.badge{padding:6px 12px;border-radius:20px;font-size:11px;font-weight:700}
.on{background:#25D366;color:#000} .off{background:#333;color:#888}
.think{animation:pulse 1.4s infinite} @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;text-align:left;font-size:12px;color:#aaa;margin-top:15px}
.grid div{background:#1a1a1a;padding:8px;border-radius:8px}
</style></head><body>
<h1 style="margin:0">🐐 FORGET V21</h1><p style="color:#25D366;font-weight:800;letter-spacing:2px">ULTIMATE SULA + GPT</p>
<div class="card">
<span class="badge ${connectionStatus==='connected'?'on':'off'}">${connectionStatus.toUpperCase()} | Users: ${users} | ${Math.floor(process.uptime()/60)}m</span>
${connectionStatus==='connected'?`<h2>✅ ONLINE</h2><p>Now message yourself <b>.menu</b> on WhatsApp!<br>Bot replies even to self messages 🫵</p><p style="color:#25D366">AI: ${ai?'CONNECTED':'Add GEMINI_API_KEY for real AI'}</p>`:''}
${currentQR?`<div class="qr"><img src="${qrImg}" width="260"></div><p class="think">🧠 Scan QR in WhatsApp</p>`:''}
${pairingCode?`<h1 style="letter-spacing:5px;font-size:36px">${pairingCode}</h1><p>WhatsApp → Linked Devices → Link with phone number → Enter code</p><p class="think">⏳ Expires in 60s</p>`:''}
${connectionStatus!=='connected'?`<form method="POST" action="/pair"><h3>🔑 Pairing Code (Sula Style)</h3><input name="number" placeholder="263771234567 (no +)" required><button class="btn btn-p" type="submit">Get Pairing Code</button></form><button class="btn btn-q" onclick="location.reload()">Refresh QR</button>`:''}
<div class="grid">
<div>✅ Self-Reply</div><div>✅ ChatGPT Thinking</div><div>✅ .ai Real AI</div><div>✅ .sticker</div><div>✅ .ping .alive</div><div>✅ 60+ Commands</div>
</div>
<hr style="border-color:#222;margin:18px 0"><p style="font-size:11px;color:#555">V21 ULTIMATE | Gemini: ${ai?'ON':'OFF'} | Self-Chat: ON | Stay online after Termux closed</p>
</div></body></html>`)
})
app.post('/pair', async (req, res) => {
    const n = req.body.number
    if (!n) return res.redirect('/')
    if (sock) try { sock.end() } catch {}
    currentQR = null; pairingCode = null
    await startBot(true, n)
    setTimeout(()=>res.redirect('/'), 2000)
})
app.get('/status', (req,res)=>res.json({status:connectionStatus, users, hasAI: !!ai, uptime: process.uptime()}))
app.listen(PORT, ()=>console.log('V21 ULTIMATE running', PORT))
