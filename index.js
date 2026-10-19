import makeWASocket, { useMultiFileAuthState, DisconnectReason, Browsers, delay, downloadMediaMessage } from '@whiskeysockets/baileys'
import express from 'express'
import pino from 'pino'
import qrcode from 'qrcode'
import { GoogleGenAI } from '@google/genai'
import fetch from 'node-fetch'
import axios from 'axios'
import FormData from 'form-data'
import yts from 'yt-search'
const app = express()
app.use(express.json()); app.use(express.urlencoded({ extended: true }))
const PORT = process.env.PORT || 10000
const AUTH = './auth_info_baileys'
const GEMINI_KEY = process.env.GEMINI_API_KEY || ''
const TAVILY_KEY = process.env.TAVILY_API_KEY || ''
let sock, qr=null, pair=null, status='starting', ai=null, userInstructions={}, lastNumber=null
let settings={antivv:{},autostatus:true,anticall:true,antilink:{},welcome:{},antibadword:{},autoreact:true,autoreactMode:'smart',autoreactChannels:true,autoreactGroups:true,autoreactPrivate:true,autotyping:true,autorecording:false,alwaysonline:true,antidelete:true,autolikeStatus:true,autobio:false,afk:{},deletedCache:new Map(),economy:{}}
const FOOTER=`\n\n💩 I'M FORGET ASTRA GPT💵\nCREATED BY GOAT🐐\nFORGET GOBA\nFROM TANAKA RESIDENTS 🛖\nLEO MESSI TO THE WORLD🫟\nA 16 YEAR OLD BOY 🌎🌎🌎(🥶🥶)`
if(GEMINI_KEY) try{ ai=new GoogleGenAI({apiKey:GEMINI_KEY}) }catch{}
setInterval(()=>{ fetch(`http://localhost:${PORT}/`).catch(()=>{}) },1000*60*4)
async function tavilySearch(q){ if(!TAVILY_KEY) return null; try{ let r=await axios.post('https://api.tavily.com/search',{api_key:TAVILY_KEY,query:q,max_results:5,include_answer:true}); return r.data }catch{ return null } }
async function askAI(uid,prompt){
  if(!ai) return `❌ Add GEMINI_API_KEY${FOOTER}`
  let ins=userInstructions[uid]||'You are FORGET ASTRA GPT 6.9 Golden Queen.'
  let web=''; if(/latest|today|news|price|current|search|who is/i.test(prompt)&&TAVILY_KEY){ let t=await tavilySearch(prompt); if(t) web=`\nWEB: ${t.answer}` }
  try{ let r=await ai.models.generateContent({model:'gemini-2.0-flash',contents:[{text:`${ins}\nUser:${prompt}${web}`}] }); return r.text+FOOTER }
  catch(e1){ try{ let r2=await ai.models.generateContent({model:'gemini-1.5-flash',contents:[{text:`${ins}\nUser:${prompt}${web}`}] }); return r2.text+FOOTER }catch(e2){ return `Error ${e1.message}${FOOTER}` } }
}
const RELATED_REACTS={'love|❤️|😍':'❤️','sad|cry|😭|😢':'😢','happy|😊|yay':'😍','angry|😡':'😡','laugh|😂|lol|haha':'😂','wow|😱|omg':'😱','fire|🔥':'🔥','congrats|🎉':'🎉','thank|🙏':'🙏','okay|👌':'👌','cool|😎':'😎','music|🎵':'🎵','money|💰':'💰','food|🍕':'😋','sleep|😴':'😴','sick|🤒':'🤒','study|📚':'📚','game|🎮':'🎮','car|🚗':'🚗','phone|📱':'📱','work|💼':'💼','heartbroken|💔':'💔','kiss|😘':'😘','dog|🐶|cat|🐱':'🐶','baby|👶':'🥰','flower|🌹':'🌹','sun|☀️':'☀️','moon|🌙':'🌙','rain|🌧️':'🌧️','yes|👍':'👍','no|👎':'👎','clap|👏':'👏','mind|🤯':'🤯','eye|👀':'👀','100|💯':'💯','thinking|🤔':'🤔','party|🥳':'🥳','dead|💀':'💀','ghost|👻':'👻','robot|🤖':'🤖','crown|👑':'👑','gift|🎁':'🎁','link|🔗':'🔗','warning|⚠️':'⚠️','check|✅':'✅','cross|❌':'❌','question|❓':'❓'}
const GENERAL_REACTS=['❤️','💛','💚','💙','💜','🖤','🤍','❤️‍🔥','💘','😍','🥰','😘','😋','🤪','🤩','🥳','😎','🥺','😭','😱','💀','👻','🤖','👑','💯','👍','👏','🙏','🔥','🎉','✅','❌','💔','🎵','💰','📚','🎮','🚗','🔔','👥','🖼️']
function getSmartReaction(text){ let lower=text.toLowerCase(); for(let pat in RELATED_REACTS){ if(pat.split('|').some(k=>lower.includes(k.toLowerCase()))) return RELATED_REACTS[pat] } return GENERAL_REACTS[Math.floor(Math.random()*GENERAL_REACTS.length)] }
async function start(usePair=false,num=null){
  const {state,saveCreds}=await useMultiFileAuthState(AUTH)
  if(num) lastNumber=num
  sock=makeWASocket({auth:state,logger:pino({level:'silent'}),browser:Browsers.ubuntu('Chrome')})
  sock.ev.on('creds.update',saveCreds)
  sock.ev.on('connection.update',async u=>{ if(u.qr){ qr=u.qr; status='qr' } if(u.connection==='open'){ status='connected'; qr=null; pair=null; } if(u.connection==='close'){ let rec=u.lastDisconnect?.error?.output?.statusCode!==DisconnectReason.loggedOut; status=rec?'reconnecting':'logged-out'; if(rec) setTimeout(()=>start(),3000) } })
  if(usePair&&num&&!state.creds.registered){ await delay(3000); try{ let p=await sock.requestPairingCode(num.replace(/[^0-9]/g,'')); pair=p?.match(/.{1,4}/g)?.join('-')||p; status='pairing' }catch(e){ status=e.message } }
  sock.ev.on('call',async calls=>{ for(let c of calls){ if(settings.anticall){ await sock.rejectCall(c.id,c.from).catch(()=>{}); await sock.sendMessage(c.from,{text:`*📵 AntiCall*${FOOTER}`}) } } })
  sock.ev.on('messages.upsert',async ({messages})=>{
    for(let m of messages){
      if(!m.message) continue
      let from=m.key.remoteJid, isGroup=from.endsWith('@g.us'), isChannel=from.includes('@newsletter')
      let bodyCache=m.message.conversation||m.message.extendedTextMessage?.text||m.message.imageMessage?.caption||m.message.videoMessage?.caption||''; if(bodyCache) settings.deletedCache.set(m.key.id,{text:bodyCache})
      if(settings.alwaysonline&&!m.key.fromMe){ try{ await sock.sendPresenceUpdate('available',from) }catch{} }
      if(from==='status@broadcast'){ if(settings.autostatus) try{ await sock.readMessages([m.key]); }catch{}; continue }
      if(settings.autotyping&&!m.key.fromMe){ try{ await sock.sendPresenceUpdate('composing',from); await delay(800) }catch{} }
      if(settings.autoreact&&!m.key.fromMe){ let bodyForReact=m.message.conversation||m.message.extendedTextMessage?.text||''; if(bodyForReact){ let emoji=getSmartReaction(bodyForReact); setTimeout(async()=>{ try{ await sock.sendMessage(from,{react:{text:emoji,key:m.key}}) }catch{} },800) } }
      let body=m.message.conversation||m.message.extendedTextMessage?.text||m.message.imageMessage?.caption||m.message.videoMessage?.caption||''; if(!body) continue
      let lower=body.toLowerCase().trim(); let cmd=lower.startsWith('.')? lower.slice(1).split(' ')[0] : ''; let q=body.slice(cmd.length+1).trim(); let userId=m.key.participant||from
      const reply=(t)=>sock.sendMessage(from,{text:t+FOOTER},{quoted:m})
      try{
        if(cmd==='pair'){ if(!q) return reply('Usage:.pair 2637...'); let num=q.replace(/[^0-9]/g,''); try{ const {state:tempState}=await useMultiFileAuthState('./temp_auth_'+num); const tempSock=makeWASocket({auth:tempState,logger:pino({level:'silent'}),browser:Browsers.ubuntu('Chrome')}); await delay(3000); let code=await tempSock.requestPairingCode(num); let fmt=code?.match(/.{1,4}/g)?.join('-')||code; await sock.sendMessage(from,{text:`*🔐 PAIR CODE*\nNumber: ${num}\nCode: ${fmt}${FOOTER}`},{quoted:m}); try{ tempSock.end() }catch{} }catch(e){ await reply(`❌ ${e.message}`) } }
        else if(cmd==='qrcode'||cmd==='qr'){ let qrImg=qr? await qrcode.toDataURL(qr) : null; if(qrImg){ let buf=Buffer.from(qrImg.split(',')[1],'base64'); await sock.sendMessage(from,{image:buf,caption:`*📱 QR CODE*${FOOTER}`},{quoted:m}) } else { await reply(`QR not ready ${status}`) } }
        else if(cmd==='ping'){ await reply(`*ASTRA 6.9 GOLDEN QUEEN*\n🏓 ${Date.now()%1000}ms`) }
        else if(cmd==='menu'){ await reply(`*💩 I'M FORGET ASTRA GPT💵*\n*CREATED BY GOAT🐐*\n.pair 263... .qrcode .ping`) }
        else if(['ai','astra','ask','gpt'].includes(cmd)){ if(!q) return reply('Usage:.ai hi'); await reply(await askAI(userId,q)) }
      }catch(e){}
    }
  })
}
start()
app.get('/',async (req,res)=>{
  let img=''; if(qr) try{ img=await qrcode.toDataURL(qr) }catch{}
  let html=`<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>FORGET ASTRA GPT - GOLDEN QUEEN</title>
  <style>@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700&family=Poppins:wght@400;600&display=swap');
  body{background:linear-gradient(135deg,#000,#1a1200,#000);color:#FFD700;font-family:'Poppins',sans-serif;text-align:center;padding:12px;min-height:100vh}
  .queen-card{max-width:460px;margin:auto;background:linear-gradient(145deg,#1a1a1a,#0f0f0f);padding:20px;border-radius:20px;border:2px solid #FFD700;box-shadow:0 0 30px rgba(255,215,0,0.3)}
  h1{font-family:'Cinzel',serif;color:#FFD700;text-shadow:0 0 10px #FFD700;font-size:26px;margin:8px 0}
  .code{font-size:36px;font-weight:900;color:#000;background:linear-gradient(145deg,#FFD700,#FFA500);padding:16px;border-radius:12px;letter-spacing:4px;box-shadow:0 0 25px #FFD700;margin:12px 0}
  .btn{width:100%;padding:14px;background:linear-gradient(145deg,#FFD700,#DAA520);border:none;border-radius:12px;font-weight:800;color:#000;font-size:15px;cursor:pointer;margin-top:8px;display:block;text-decoration:none}
  .btn-outline{width:100%;padding:12px;background:transparent;border:2px solid #FFD700;border-radius:12px;font-weight:700;color:#FFD700;font-size:14px;cursor:pointer;margin-top:8px;display:block;text-decoration:none;box-sizing:border-box}
  .btn-back{width:48%;padding:11px;background:#222;border:1px solid #555;border-radius:10px;color:#fff;font-weight:600;display:inline-block;text-decoration:none;box-sizing:border-box}
  .input-box{width:100%;padding:14px;border-radius:12px;background:#000;color:#FFD700;border:2px solid #FFD700;text-align:center;font-size:18px;font-weight:700;box-sizing:border-box;outline:none}
  .footer-brand{margin-top:18px;padding:12px;background:#000;border-radius:12px;border:1px dashed #FFD700;font-size:11px;line-height:1.6;color:#FFD700;white-space:pre-line}
  img.qr{width:280px;max-width:90%;background:#fff;padding:12px;border-radius:16px;border:3px solid #FFD700;box-shadow:0 0 25px rgba(255,215,0,0.5)}
  .row{display:flex;gap:8px;justify-content:center;margin-top:10px}
  .section{margin:14px 0;padding:14px;background:rgba(255,215,0,0.05);border-radius:12px;border:1px solid rgba(255,215,0,0.2)}
  .label{color:#FFD700;font-weight:700;font-size:13px;margin-bottom:8px;display:block;text-align:left}
  </style></head><body>
  <h1>👑 FORGET ASTRA GPT 👑</h1><p style="color:#b8860b;font-size:11px;margin-top:0">GOLDEN QUEEN 6.9 - MORDE AI STYLE</p>
  <div class="queen-card">
  <p>Status: <b style="color:#FFD700;font-size:17px">${status.toUpperCase()}</b> ${lastNumber?`| Last: ${lastNumber}`:''}</p>

  <!-- ALWAYS SHOW PHONE INPUT LIKE MORDE AI -->
  <div class="section">
  <span class="label">📱 Enter Phone Number (with country code):</span>
  <form method="POST" action="/pair">
  <input class="input-box" type="tel" name="number" inputmode="numeric" placeholder="263771234567" value="${lastNumber||''}" required>
  <button class="btn" type="submit">🔐 GENERATE PAIRING CODE</button>
  </form>
  <a href="/qr" class="btn-outline">📱 GENERATE QR CODE</a>
  </div>

  ${pair?`<div class="section"><span class="label">✅ Your Pairing Code:</span><div class="code">${pair}</div><p style="color:#FFD700;font-weight:700;font-size:13px">For: ${lastNumber||''}<br>Expires in 20s ⚡</p><div class="row"><a href="/" class="btn-back">⬅️ Back</a><form method="POST" action="/pair" style="width:48%;margin:0"><input type="hidden" name="number" value="${lastNumber||''}"><button class="btn-back" type="submit" style="width:100%;margin:0">🔄 New Code</button></form></div><a href="/qr" class="btn-outline">📱 Show QR Instead</a></div><script>setTimeout(()=>location.reload(),20000)</script>`:''}

  ${qr?`<div class="section"><span class="label">✅ Scan QR Code:</span><img class="qr" src="${img}"><p style="color:#FFD700;font-weight:700;margin-top:8px;font-size:13px">SCAN QR - Expires 20s ⚡</p><div class="row"><a href="/" class="btn-back">⬅️ Back</a><a href="/newcode" class="btn-back">🔄 New Code</a></div><a href="/" class="btn-outline" style="margin-top:8px">🔐 Generate Pairing Code Instead</a></div><script>setTimeout(()=>location.reload(),20000)</script>`:''}

  ${!pair&&!qr&&status!=='connected'?`<p style="color:#b8860b;font-size:11px">Enter number above to get pairing code, or click QR</p>`:''}
  ${status==='connected'?`<h2 style="color:#FFD700">✅ LINKED - GOLDEN QUEEN ACTIVE</h2><p style="color:#b8860b;font-size:12px">Type .menu in WhatsApp</p><a href="/" class="btn-outline">⬅️ Back to Home</a>`:''}

  <div class="footer-brand">💩 I'M FORGET ASTRA GPT💵
CREATED BY GOAT🐐
FORGET GOBA
FROM TANAKA RESIDENTS 🛖
LEO MESSI TO THE WORLD🫟
A 16 YEAR OLD BOY 🌎🌎🌎(🥶🥶)</div></div></body></html>`
  res.send(html)
})
app.get('/qr',async (req,res)=>{ try{ if(sock) { try{sock.end()}catch{} } }catch{}; qr=null; pair=null; status='qr'; await start(); setTimeout(()=>res.redirect('/'),1800) })
app.get('/newcode',async (req,res)=>{ if(!lastNumber) return res.redirect('/'); try{ if(sock) sock.end() }catch{}; qr=null; pair=null; status='generating...'; await start(true,lastNumber); setTimeout(()=>res.redirect('/'),2500) })
app.post('/pair',async (req,res)=>{ let n=req.body.number?.replace(/[^0-9]/g,''); if(!n) return res.redirect('/'); lastNumber=n; try{ if(sock) sock.end() }catch{}; qr=null; pair=null; status='generating...'; await start(true,n); setTimeout(()=>res.redirect('/'),2500) })
app.listen(PORT,()=>console.log('ASTRA 6.9 MORDE STYLE on '+PORT))
