import makeWASocket, { useMultiFileAuthState, DisconnectReason, Browsers, delay } from '@whiskeysockets/baileys'
import express from 'express'
import pino from 'pino'
import qrcode from 'qrcode'
import { GoogleGenAI } from '@google/genai'
import fetch from 'node-fetch'

const app = express()
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
const PORT = process.env.PORT || 10000
const AUTH = './auth_info_baileys'
const KEY = process.env.GEMINI_API_KEY || ''
let sock = null, qr = null, pair = null, status = 'disconnected', users = 0, ai = null

if (KEY) { try { ai = new GoogleGenAI({ apiKey: KEY }); console.log('Gemini ON') } catch { } }

// Render 24/7 self-ping - keeps alive
setInterval(() => {
  fetch(`http://localhost:${PORT}/`).then(()=>console.log('self-ping ok')).catch(()=>{})
}, 1000 * 60 * 4)

async function start(usePair = false, num = null) {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH)
  sock = makeWASocket({ auth: state, logger: pino({ level: 'silent' }), browser: Browsers.ubuntu('Chrome') })
  sock.ev.on('creds.update', saveCreds)
  sock.ev.on('connection.update', async (u) => {
    if (u.qr) { qr = u.qr; status = 'qr'; console.log('QR ready') }
    if (u.connection === 'open') { status = 'connected'; qr = null; pair = null; users = 1; console.log('✅ LINKED!') }
    if (u.connection === 'close') {
      let shouldReconnect = u.lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
      status = shouldReconnect ? 'reconnecting' : 'disconnected'
      users = 0
      if (shouldReconnect) setTimeout(() => start(), 3000)
    }
  })
  if (usePair && num && !state.creds.registered) {
    await delay(3500)
    try {
      let clean = num.replace(/[^0-9]/g, '')
      if (clean.length < 11) throw new Error('Number too short. Use 263771234567')
      console.log('Requesting pairing for', clean)
      pair = await sock.requestPairingCode(clean)
      pair = pair?.match(/.{1,4}/g)?.join('-') || pair
      status = 'pairing'
      console.log('PAIRING CODE:', pair)
    } catch (e) { status = 'error: ' + e.message; console.log(e.message) }
  }
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (let m of messages) {
      if (!m.message || m.key.remoteJid === 'status@broadcast') continue
      let from = m.key.remoteJid, text = m.message.conversation || m.message.extendedTextMessage?.text || '', lower = text.toLowerCase().trim()
      if (!text) continue
      try {
        if (lower === '.ping') { await sock.sendMessage(from, { text: `🏓 Pong!\nStatus: ${status}\nAI: ${ai ? 'ON' : 'OFF'}\n24/7: Active ✅` }, { quoted: m }) }
        else if (lower === '.alive') { await sock.sendMessage(from, { text: `🐐 FORGET V21.1\nStatus: ${status}\nUsers: ${users}\nAI: ${ai ? 'ON' : 'OFF'}\nRender: 24/7 ✅` }, { quoted: m }) }
        else if (lower.startsWith('.ai ')) {
          let q = text.slice(4); let ans = 'Add GEMINI_API_KEY'
          if (ai) { try { let r = await ai.models.generateContent({ model: 'gemini-2.0-flash', contents: [{ text: q }] }); ans = r.text } catch (e) { ans = e.message } }
          await sock.sendMessage(from, { text: ans }, { quoted: m })
        }
      } catch (e) { console.log(e.message) }
    }
  })
}
start()

app.get('/', async (req, res) => {
  let img = ''; if (qr) img = await qrcode.toDataURL(qr)
  res.send(`<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Forget V21.1</title><style>body{background:#000;color:#fff;font-family:system-ui;text-align:center;padding:20px}.card{max-width:400px;margin:auto;background:#111;padding:20px;border-radius:16px;border:1px solid #222}.code{font-size:42px;font-weight:900;color:#25D366;letter-spacing:5px;background:#000;padding:15px;border-radius:12px;border:2px dashed #25D366}.btn{width:100%;padding:14px;background:#25D366;color:#000;border:none;border-radius:10px;font-weight:800;margin:8px 0}input{width:90%;padding:12px;border-radius:8px;background:#222;color:#fff;border:1px solid #333}.on{color:#25D366;font-weight:900}</style></head><body><h1>🐐 FORGET V21.1 - 24/7</h1><div class="card"><p>Status: <span class="${status==='connected'?'on':''}">${status.toUpperCase()}</span></p>${status==='connected'?'<h2 class="on">✅ LINKED! Bot is 24/7 Online</h2><p>Send <b>.ping</b> in WhatsApp</p>':''}${qr?`<img src="${img}" style="width:260px;background:#fff;padding:10px;border-radius:12px"><p>Scan QR in WhatsApp</p>`:''}${pair?`<p>YOUR CODE:</p><div class="code">${pair}</div><p>WhatsApp → Linked Devices → Link a device → <b>Link with phone number</b><br>Enter FAST (60s expiry)</p><script>setTimeout(()=>location.reload(),15000)</script>`:''}${!pair&&status!=='connected'?`<form method="POST" action="/pair"><h3>🔑 Get Pairing Code</h3><input name="number" placeholder="263771234567" required><button class="btn">Get Code</button></form>`:''}<p style="font-size:11px;color:#666;margin-top:20px">Render 24/7 + Disk Persistent + Auto-Reconnect ✅</p></div></body></html>`)
})
app.post('/pair', async (req, res) => {
  let n = req.body.number?.replace(/[^0-9]/g, ''); if (!n) return res.redirect('/')
  if (sock) try { sock.end() } catch {} ; qr = null; pair = null; status = 'generating...'
  await start(true, n); setTimeout(() => res.redirect('/'), 3000)
})
app.listen(PORT, () => console.log('Running on ' + PORT))
