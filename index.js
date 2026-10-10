require('dotenv').config()
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, downloadMediaMessage } = require('@whiskeysockets/baileys')
const { GoogleGenAI } = require('@google/genai')
const { exec, execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const P = require('pino')
const qrcode = require('qrcode-terminal')
const express = require('express')
const QR = require('qrcode')

const BOT_NAME = 'Forget tha goat.com 🐐👑'
const GEMINI_KEY = process.env.GEMINI_API_KEY || ''
const OWNER_NUMBER = (process.env.OWNER_NUMBER || '263718285216').replace(/\D/g,'')
const PORT = process.env.PORT || 10000

const AUTH = path.join(__dirname, 'auth')
const DATA = path.join(__dirname, 'data')
const SAVE = path.join(__dirname, 'downloads')
for (const d of [AUTH, DATA, SAVE]) if (!fs.existsSync(d)) fs.mkdirSync(d, {recursive:true})

function loadDB(){
  const def={antilink:{},welcome:{},users:{},settings:{autoreact:true,autoviewstatus:true,autoreactstatus:true,autotyping:true,antidelete:false},aiMemory:{}}
  try{ if(!fs.existsSync(path.join(DATA,'db.json'))) return def; return {...def,...JSON.parse(fs.readFileSync(path.join(DATA,'db.json'),'utf8'))} }catch{ return def }
}
let db=loadDB()
function saveDB(){ try{ fs.writeFileSync(path.join(DATA,'db.json'), JSON.stringify(db,null,2)) }catch{} }

let ai=null; if(GEMINI_KEY) try{ ai=new GoogleGenAI({apiKey:GEMINI_KEY}); console.log('✓ Gemini ready') }catch{}
const MODELS=["gemini-3.5-flash-lite","gemini-2.0-flash-001","gemini-3.8-flash","gemini-flash-latest"]

function getText(m){ return (m.message?.conversation||m.message?.extendedTextMessage?.text||m.message?.imageMessage?.caption||m.message?.videoMessage?.caption||'').trim() }
function numberFromJid(j){ return j.split(':')[0].replace('@s.whatsapp.net','') }
function isOwner(j){ return numberFromJid(j)===OWNER_NUMBER }
function getSmartEmoji(t){ t=String(t).toLowerCase(); if(t.includes('love')||t.includes('baby')) return '❤️'; if(t.includes('lol')||t.includes('haha')) return '😂'; if(t.includes('goat')||t.includes('fire')||t.includes('lit')) return '🔥'; if(t.includes('thank')) return '🙏'; const e=['❤️','🔥','👑','🐐','💀','😂','🎧','⚡','💯']; return e[Math.floor(Math.random()*e.length)] }
async function askAI(q){
  let last=''; for(let model of MODELS){ try{ const r=await ai.models.generateContent({model,contents:`You are ${BOT_NAME}, Zimbo goat. Short. User: ${q}`}); let txt=r.text||''; if(txt) return txt.slice(0,3500) }catch(e){ last=e.message; if(last.includes('503')) await new Promise(r=>setTimeout(r,4000)) } } throw new Error(last.slice(0,400))
}
async function sendText(sock,jid,t,q){ try{ return await sock.sendMessage(jid,{text:t},q?{quoted:q}:{}) }catch{} }
async function getGroupMeta(sock,jid){ try{ return await sock.groupMetadata(jid) }catch{ return null } }

let lastQR='', qrImage='', botStatus='Starting...', logs=[], queue=[], isDownloading=false
function log(t){ const l=`[${new Date().toLocaleTimeString()}] ${t}`; logs.push(l); if(logs.length>100) logs.shift(); console.log(t) }
async function processQueue(sock){
  if(isDownloading||queue.length===0) return; isDownloading=true
  const {from,m,query}=queue.shift()
  const cmd=`yt-dlp --extractor-args "youtube:player_client=android" --no-playlist -x --audio-format mp3 -o "${SAVE}/%(title)s.%(ext)s" "${query.includes('http')?query:`ytsearch1:${query}`}"`
  exec(cmd, async (err,_,stderr)=>{ isDownloading=false; if(err) await sendText(sock,from,`❌ ${stderr.slice(0,200)}`,m); else{ const f=fs.readdirSync(SAVE).filter(x=>x.endsWith('.mp3')).sort((a,b)=>fs.statSync(path.join(SAVE,b)).mtimeMs-fs.statSync(path.join(SAVE,a)).mtimeMs)[0]; if(f) await sock.sendMessage(from,{audio:fs.readFileSync(path.join(SAVE,f)),mimetype:'audio/mpeg'},{quoted:m}) } if(queue.length) processQueue(sock) })
}

// WEB
const app=express()
app.get('/', async (req,res)=>{
  res.send(`<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>GOAT V20</title><style>body{background:#0a0a0a;color:#fff;font-family:system-ui;text-align:center;padding:15px}.card{background:#151515;padding:20px;border-radius:16px;margin:12px auto;max-width:520px}.qr{background:#fff;padding:16px;border-radius:16px;display:inline-block} h1{color:#25D366}.btn{padding:12px 22px;background:#25D366;color:#000;border:none;border-radius:10px;margin:4px;font-weight:800;cursor:pointer}.log{background:#000;text-align:left;padding:10px;border-radius:10px;height:160px;overflow:auto;font-size:11px}</style></head><body>
  <h1>🐐 ${BOT_NAME} V20 RENDER</h1>
  <div class="card"><h3>${botStatus}</h3><p>Users: ${Object.keys(db.users||{}).length} | Queue: ${queue.length} | Uptime: ${Math.floor(process.uptime()/60)}m</p></div>
  <div class="card"><h3>📱 SCAN QR HERE</h3>${qrImage?`<div class="qr"><img src="${qrImage}" width="280"/></div><p>WhatsApp > Linked Devices > Link Device</p>`:botStatus.includes('ONLINE')?'<h2>✅ ONLINE - Auth saved!</h2>':'<p>Generating QR...</p>'}<br><button class="btn" onclick="location.reload()">Refresh</button></div>
  <div class="card"><h3>Features Active</h3><p>AutoReact: ${db.settings.autoreact?'🟢':'🔴'} | AutoStatus: ${db.settings.autoviewstatus?'🟢':'🔴'} | AutoTyping: ${db.settings.autotyping?'🟢':'🔴'}</p><p>.menu in WhatsApp for commands</p></div>
  <div class="card"><div class="log">${logs.slice(-25).reverse().join('<br>')}</div></div>
  <p style="opacity:.5">Render Disk: /auth saves login - no need rescan after deploy</p>
  </body></html>`)
})
app.get('/qr',(req,res)=>res.json({qr:lastQR,status:botStatus}))
app.listen(PORT,()=>log(`🌐 WEB LIVE on ${PORT}`))

async function start(){
  log('Starting bot...')
  const { state, saveCreds } = await useMultiFileAuthState(AUTH)
  const sock=makeWASocket({logger:P({level:'silent'}),auth:state,browser:[BOT_NAME,'Chrome','1.0']})
  sock.ev.on('creds.update',saveCreds)
  sock.ev.on('connection.update', async ({connection,qr,lastDisconnect})=>{
    if(qr){ lastQR=qr; qrImage=await QR.toDataURL(qr); botStatus='Scan QR on website'; qrcode.generate(qr,{small:true}); log('QR generated - open your Render link') }
    if(connection==='open'){ botStatus='ONLINE 🟢 V20'; lastQR=''; qrImage=''; log('✓ BOT ONLINE V20 RENDER') }
    if(connection==='close'){ const code=lastDisconnect?.error?.output?.statusCode; botStatus=`Closed ${code}`; log(`Closed ${code}`); if(code!==DisconnectReason.loggedOut) setTimeout(start,3000) }
  })
  sock.ev.on('messages.upsert', async ({messages})=>{
    for(const m of messages){
      try{
        if(!m.message||m.key.fromMe) continue
        const from=m.key.remoteJid, sender=m.key.participant||from, text=getText(m), lower=text.toLowerCase()
        if(!text) continue
        const num=numberFromJid(sender); if(!db.users[num]) db.users[num]={msgs:0}; db.users[num].msgs++; saveDB()
        if(db.settings.autoreact &&!lower.startsWith('.')){ try{ await sock.sendMessage(from,{react:{text:getSmartEmoji(text),key:m.key}}) }catch{} }
        if(db.settings.autotyping &&!lower.startsWith('.')){ try{ await sock.sendPresenceUpdate('composing',from) }catch{} }
        if(lower==='.menu'||lower==='menu'){ await sendText(sock,from,`*${BOT_NAME} V20 RENDER* 🐐\n\n🤖.ai <q>\n🎧.play <song>\n📹.video <name>\n📥.tiktok/.fb/.ig <link>\n👥.tagall\n⚙️.autoreact on/off\n🌐 Web dashboard has QR`,m) }
        if(lower.startsWith('.ai ')){ const q=text.slice(4); await sendText(sock,from,'🤖 thinking...',m); try{ const ans=await askAI(q); await sendText(sock,from,ans,m) }catch(e){ await sendText(sock,from,`❌ ${e.message.slice(0,300)}`,m) } }
        if(lower.startsWith('.play ')){ const q=text.slice(6); queue.push({from,m,query:q}); await sendText(sock,from,`🎧 Queued [${queue.length}]`,m); processQueue(sock) }
        if(lower==='.alive'||lower==='.ping'){ await sendText(sock,from,`🐐 V20 ONLINE\n${botStatus}\nUptime ${Math.floor(process.uptime()/60)}m\nWeb: your Render URL`,m) }
      }catch(e){ log('msg err '+e.message.slice(0,100)) }
    }
  })
}
start()
