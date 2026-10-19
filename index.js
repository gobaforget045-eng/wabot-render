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
async function uploadCatbox(buf,name='file.jpg'){ try{ let f=new FormData(); f.append('reqtype','fileupload'); f.append('fileToUpload',buf,name); let r=await axios.post('https://catbox.moe/user/api.php',f,{headers:f.getHeaders()}); return r.data }catch{ return null } }
const RELATED_REACTS={'love|❤️|😍|miss you|my baby|babe':'❤️','sad|cry|😭|😢|broken|depressed':'😢','happy|😊|yay|excited|great':'😍','angry|😡|mad|hate|annoyed':'😡','laugh|😂|lol|haha|funny':'😂','wow|😱|omg|shocked':'😱','fire|🔥|lit|dope|hot|slay':'🔥','congrats|🎉|celebrate|won|birthday|success':'🎉','thank|🙏|thanks|grateful':'🙏','okay|👌|ok|alright':'👌','cool|😎|nice|swag':'😎','music|🎵|song|play':'🎵','money|💰|rich|cash':'💰','food|🍕|eat|hungry|delicious':'😋','sleep|😴|tired|night|bed':'😴','sick|🤒|ill|fever|pain':'🤒','study|📚|exam|school|homework':'📚','game|🎮|gaming|ps5':'🎮','car|🚗|drive|travel':'🚗','phone|📱|call|chat':'📱','work|💼|job|busy|office':'💼','heartbroken|💔|breakup|cheated':'💔','kiss|😘|muah':'😘','dog|🐶|puppy|cat|🐱|pet':'🐶','baby|👶|cute|adorable':'🥰','flower|🌹|rose|beautiful':'🌹','sun|☀️|morning|day|bright':'☀️','moon|🌙|night|dark|stars':'🌙','rain|🌧️|storm|cold':'🌧️','yes|👍|agree|correct|yeah':'👍','no|👎|wrong|nope|never':'👎','clap|👏|well done':'👏','mind|🤯|blown|amazing|incredible':'🤯','silly|🤪|crazy|weird':'🤪','eye|👀|see|look|watch':'👀','100|💯|perfect|excellent|best':'💯','thinking|🤔|hmm|wonder':'🤔','party|🥳|dance|fun|celebration':'🥳','cold|🥶|freeze|ice':'🥶','hot|🥵|sweat|summer':'🥵','dead|💀|kill|die|rip':'💀','ghost|👻|scary|halloween':'👻','robot|🤖|bot|ai|astra':'🤖','crown|👑|king|queen|boss|legend':'👑','gift|🎁|present|surprise':'🎁','link|🔗|url|website|join':'🔗','warning|⚠️|danger|careful':'⚠️','check|✅|done|finished|complete':'✅','cross|❌|wrong|fail|error':'❌','question|❓|what|why|how':'❓'}
const GENERAL_REACTS=['❤️','💛','💚','💙','💜','🖤','🤍','❤️‍🔥','💘','💝','💖','😍','🥰','😘','😋','🤪','🤩','🥳','😎','🥺','😭','😱','💀','👻','🤖','👑','💯','👍','👏','🙏','🔥','🎉','✅','❌','💔','🎵','💰','📚','🎮','🚗','🔔','👥','🖼️','💌','👌','🫶']
function getSmartReaction(text){ let lower=text.toLowerCase(); for(let pat in RELATED_REACTS){ if(pat.split('|').some(k=>lower.includes(k.toLowerCase()))) return RELATED_REACTS[pat] } return GENERAL_REACTS[Math.floor(Math.random()*GENERAL_REACTS.length)] }
async function start(usePair=false,num=null){
  const {state,saveCreds}=await useMultiFileAuthState(AUTH)
  if(num) lastNumber=num
  sock=makeWASocket({auth:state,logger:pino({level:'silent'}),browser:Browsers.ubuntu('Chrome')})
  sock.ev.on('creds.update',saveCreds)
  sock.ev.on('connection.update',async u=>{ if(u.qr){ qr=u.qr; status='qr' } if(u.connection==='open'){ status='connected'; qr=null; pair=null; console.log('✅ LINKED') } if(u.connection==='close'){ let rec=u.lastDisconnect?.error?.output?.statusCode!==DisconnectReason.loggedOut; status=rec?'reconnecting':'logged-out'; if(rec) setTimeout(()=>start(),3000) } })
  if(usePair&&num&&!state.creds.registered){ await delay(3000); try{ let p=await sock.requestPairingCode(num.replace(/[^0-9]/g,'')); pair=p?.match(/.{1,4}/g)?.join('-')||p; status='pairing' }catch(e){ status=e.message } }
  setInterval(async()=>{ if(settings.autobio&&sock){ try{ let time=new Date().toLocaleTimeString(); await sock.updateProfileStatus(`💩 ASTRA GPT 6.9 | GOAT FORGET GOBA | ${time}`) }catch{} } },60000)
  sock.ev.on('call',async calls=>{ for(let c of calls){ if(settings.anticall){ await sock.rejectCall(c.id,c.from).catch(()=>{}); await sock.sendMessage(c.from,{text:`*📵 AntiCall ON*${FOOTER}`}) } } })
  sock.ev.on('group-participants.update',async anu=>{ if(settings.welcome[anu.id]){ try{ for(let p of anu.participants){ if(anu.action==='add') await sock.sendMessage(anu.id,{text:`*WELCOME* @${p.split('@')[0]}${FOOTER}`,mentions:[p]}) } }catch{} } })
  sock.ev.on('messages.update',async updates=>{ for(let upd of updates){ if(upd.update.message===null&&settings.antidelete){ let cached=settings.deletedCache.get(upd.key.id); if(cached){ try{ await sock.sendMessage(upd.key.remoteJid,{text:`*🚫 ANTI-DELETE*\n*From:* @${upd.key.participant?.split('@')[0]||'unknown'}\n*Deleted:* ${cached.text}${FOOTER}`,mentions:upd.key.participant?[upd.key.participant]:[]}) }catch{} } } } })
  sock.ev.on('messages.upsert',async ({messages})=>{
    for(let m of messages){
      if(!m.message) continue
      let from=m.key.remoteJid, isGroup=from.endsWith('@g.us'), isChannel=from.includes('@newsletter'), isPrivate=!isGroup&&!isChannel
      let sender=m.key.participant||from
      let bodyCache=m.message.conversation||m.message.extendedTextMessage?.text||m.message.imageMessage?.caption||m.message.videoMessage?.caption||''; if(bodyCache) settings.deletedCache.set(m.key.id,{text:bodyCache})
      if(settings.alwaysonline&&!m.key.fromMe){ try{ await sock.sendPresenceUpdate('available',from) }catch{} }
      if(from==='status@broadcast'){ if(settings.autostatus) try{ await sock.readMessages([m.key]); if(settings.autolikeStatus){ await sock.sendMessage('status@broadcast',{react:{text:'❤️',key:{remoteJid:'status@broadcast',id:m.key.id,fromMe:false}}}).catch(()=>{}) } }catch{}; continue }
      if(settings.autotyping&&!m.key.fromMe){ try{ await sock.sendPresenceUpdate('composing',from); await delay(1000) }catch{} }
      if(settings.autoreact&&!m.key.fromMe){
        let allow=(isChannel&&settings.autoreactChannels)||(isGroup&&settings.autoreactGroups)||(isPrivate&&settings.autoreactPrivate)
        if(allow){ try{ let bodyForReact=m.message.conversation||m.message.extendedTextMessage?.text||m.message.imageMessage?.caption||m.message.videoMessage?.caption||''; if(bodyForReact){ let emoji=getSmartReaction(bodyForReact); setTimeout(async()=>{ try{ await sock.sendMessage(from,{react:{text:emoji,key:m.key}}) }catch{} },800+Math.random()*1000) } }catch{} }
      }
      let vMsgCheck=m.message.viewOnceMessage||m.message.viewOnceMessageV2Extension
      if(vMsgCheck&&settings.antivv[from]!==false){ try{ let inner=vMsgCheck.message; let type=Object.keys(inner)[0]; let buf=await downloadMediaMessage({message:inner},'buffer',{}); let cap=inner[type]?.caption||'*🔓 AntiVV*'; if(type.includes('image')) await sock.sendMessage(from,{image:buf,caption:cap+FOOTER}); else if(type.includes('video')) await sock.sendMessage(from,{video:buf,caption:cap+FOOTER}); }catch{} }
      if(isGroup&&settings.antilink[from]){ let bc=m.message.conversation||m.message.extendedTextMessage?.text||''; if(/https:\/\/chat.whatsapp.com|https:\/\/wa.me|t.me/i.test(bc)){ try{ await sock.sendMessage(from,{delete:{remoteJid:from,fromMe:false,id:m.key.id,participant:m.key.participant}}); await sock.sendMessage(from,{text:`*🚫 Antilink @${m.key.participant?.split('@')[0]}*${FOOTER}`,mentions:[m.key.participant]}) }catch{} } }
      let body=m.message.conversation||m.message.extendedTextMessage?.text||m.message.imageMessage?.caption||m.message.videoMessage?.caption||''; if(!body) continue
      let lower=body.toLowerCase().trim(); let cmd=lower.startsWith('.')? lower.slice(1).split(' ')[0] : ''; let q=body.slice(cmd.length+1).trim(); let userId=m.key.participant||from
      const reply=(t)=>sock.sendMessage(from,{text:t+FOOTER},{quoted:m})
      const replyNoFooter=(t)=>sock.sendMessage(from,{text:t},{quoted:m})
      try{
        if(cmd==='pair'||cmd==='paircode'){
          if(!q) return reply(`Usage:.pair 2637xxxxxxx`)
          let num=q.replace(/[^0-9]/g,'')
          try{
            const {state:tempState}=await useMultiFileAuthState('./temp_auth_'+num)
            const tempSock=makeWASocket({auth:tempState,logger:pino({level:'silent'}),browser:Browsers.ubuntu('Chrome')})
            await delay(3000)
            let code=await tempSock.requestPairingCode(num)
            let formatted=code?.match(/.{1,4}/g)?.join('-')||code
            await replyNoFooter(`*🔐 PAIRING CODE - GOLDEN QUEEN*\n\n*Number:* ${num}\n*Code:* ${formatted}\nExpires 20s!${FOOTER}`)
            try{ tempSock.end() }catch{}
          }catch(e){ await reply(`❌ Failed: ${e.message}`) }
        }
        else if(cmd==='qrcode'||cmd==='qr'){
          let qrImg=qr? await qrcode.toDataURL(qr) : null
          if(qrImg){ let buf=Buffer.from(qrImg.split(',')[1],'base64'); await sock.sendMessage(from,{image:buf,caption:`*📱 QR CODE*\nStatus: ${status}${FOOTER}`},{quoted:m}) }
          else { await reply(`QR not ready, status: ${status}`) }
        }
        else if(cmd==='autoreact'){ if(q==='off'){ settings.autoreact=false; await reply('❌ OFF') } else { settings.autoreact=true; await reply(`✅ ON Channels:${settings.autoreactChannels?'✅':'❌'} Groups:${settings.autoreactGroups?'✅':'❌'}`) } }
        else if(cmd==='autotyping'){ settings.autotyping=q!=='off'; await reply(`${settings.autotyping?'✅ ON':'❌ OFF'}`) }
        else if(cmd==='ping'){ await reply(`*ASTRA 6.9 GOLDEN QUEEN*\n🏓 ${Date.now()%1000}ms\n500+ Features`) }
        else if(cmd==='menu'){ await replyNoFooter(`*💩 I'M FORGET ASTRA GPT💵*\n*CREATED BY GOAT🐐 FORGET GOBA*\n*FROM TANAKA RESIDENTS 🛖*\n*LEO MESSI TO THE WORLD🫟*\n*A 16 YEAR OLD BOY 🌎🌎🌎(🥶🥶)*\n\n*🔐 PAIRING:*\n.pair 263... .qrcode\n\n*ALL 500+ REAL*\n${FOOTER}`) }
        else if(['ai','astra','ask','gpt'].includes(cmd)){ if(!q) return reply('Usage:.ai hi'); await reply(await askAI(userId,q)) }
      }catch(e){ console.log(e.message) }
    }
  })
}
start()
app.get('/',async (req,res)=>{
  let img=''; if(qr) try{ img=await qrcode.toDataURL(qr) }catch{}
  let html=`<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>FORGET ASTRA GPT - GOLDEN QUEEN</title>
  <style>@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700&family=Poppins:wght@400;600&display=swap');
  body{background:linear-gradient(135deg,#000 0%,#1a1200 50%,#000 100%);color:#FFD700;font-family:'Poppins',sans-serif;text-align:center;padding:20px;min-height:100vh}
  .queen-card{max-width:460px;margin:auto;background:linear-gradient(145deg,#1a1a1a,#0f0f0f);padding:25px;border-radius:20px;border:2px solid #FFD700;box-shadow:0 0 30px rgba(255,215,0,0.3)}
  h1{font-family:'Cinzel',serif;color:#FFD700;text-shadow:0 0 10px #FFD700;font-size:28px}
  .code{font-size:38px;font-weight:900;color:#000;background:linear-gradient(145deg,#FFD700,#FFA500);padding:18px;border-radius:12px;letter-spacing:4px;box-shadow:0 0 25px #FFD700;margin:15px 0}
  .btn{width:100%;padding:14px;background:linear-gradient(145deg,#FFD700,#DAA520);border:none;border-radius:12px;font-weight:800;color:#000;font-size:15px;cursor:pointer;box-shadow:0 4px 15px rgba(255,215,0,0.4);margin-top:8px;display:block;text-decoration:none}
  .btn-outline{width:100%;padding:12px;background:transparent;border:2px solid #FFD700;border-radius:12px;font-weight:700;color:#FFD700;font-size:14px;cursor:pointer;margin-top:8px;display:block;text-decoration:none}
  .btn-back{width:48%;padding:12px;background:#222;border:1px solid #555;border-radius:10px;color:#fff;font-weight:600;display:inline-block;text-decoration:none}
  input{width:92%;padding:14px;border-radius:10px;background:#000;color:#FFD700;border:2px solid #FFD700;text-align:center;font-size:18px;font-weight:600}
  .footer-brand{margin-top:20px;padding:15px;background:#000;border-radius:12px;border:1px dashed #FFD700;font-size:11px;line-height:1.6;color:#FFD700;white-space:pre-line}
  img.qr{width:280px;background:#fff;padding:12px;border-radius:16px;border:3px solid #FFD700;box-shadow:0 0 25px rgba(255,215,0,0.5)}
  .row{display:flex;gap:8px;justify-content:center;margin-top:10px}
  </style></head><body>
  <h1>👑 FORGET ASTRA GPT 👑</h1><p style="color:#b8860b;font-size:12px">GOLDEN QUEEN 6.9 - BACK + NEW CODE BUTTONS</p>
  <div class="queen-card">
  <p>Status: <b style="color:#FFD700;font-size:18px">${status.toUpperCase()}</b> ${lastNumber?` | Last: ${lastNumber}`:''}</p>
  ${qr?`<img class="qr" src="${img}"><p style="color:#FFD700;font-weight:700;margin-top:10px">SCAN QR - Expires 20s ⚡</p>
  <div class="row"><a href="/" class="btn-back">⬅️ Back</a><a href="/newcode" class="btn-back">🔄 New Code</a></div>
  <a href="/qr" class="btn-outline">📱 Show QR Code</a>
  <a href="/pairpage" class="btn-outline">🔐 Generate Pairing Code Instead</a>
  <script>setTimeout(()=>location.reload(),20000)</script>`:''}
  ${pair?`<div class="code">${pair}</div><p style="color:#FFD700;font-weight:700">PAIRING CODE - Expires 20s ⚡<br><span style="font-size:12px;color:#b8860b">For: ${lastNumber||'...'}</span></p>
  <div class="row"><a href="/" class="btn-back">⬅️ Back</a><form method="POST" action="/pair" style="width:48%;display:inline-block;margin:0"><input type="hidden" name="number" value="${lastNumber||''}"><button class="btn-back" type="submit" style="width:100%;margin:0">🔄 New Pair Code</button></form></div>
  <a href="/qr" class="btn" style="margin-top:10px">📱 Generate QR Code Instead</a>
  <a href="/pairpage" class="btn-outline">🔐 Enter Different Number</a>
  <script>setTimeout(()=>location.reload(),20000)</script>`:''}
  ${!pair&&!qr?`<form method="POST" action="/pair" style="margin-top:15px">
  <input type="tel" name="number" inputmode="numeric" placeholder="263771234567" required>
  <button class="btn" type="submit" style="margin-top:12px">👑 GENERATE GOLDEN PAIR CODE 👑</button>
  </form>
  <a href="/qr" class="btn-outline">📱 Generate QR Code</a>
  <p style="color:#b8860b;font-size:11px;margin-top:10px">Or in WhatsApp: .pair 263... / .qrcode</p>
  ${status==='connected'?'<h2 style="color:#FFD700">✅ LINKED</h2>':''}`:''}
  <div class="footer-brand">💩 I'M FORGET ASTRA GPT💵
CREATED BY GOAT🐐
FORGET GOBA
FROM TANAKA RESIDENTS 🛖
LEO MESSI TO THE WORLD🫟
A 16 YEAR OLD BOY 🌎🌎🌎(🥶🥶)</div></div></body></html>`
  res.send(html)
})
app.get('/qr',async (req,res)=>{ status='qr'; try{ if(sock) sock.ev.emit('connection.update',{qr:null}) }catch{}; qr=null; pair=null; await start(); setTimeout(()=>res.redirect('/'),1500) })
app.get('/newcode',async (req,res)=>{ if(!lastNumber) return res.redirect('/'); try{ if(sock) sock.end() }catch{}; qr=null; pair=null; status='generating...'; await start(true,lastNumber); setTimeout(()=>res.redirect('/'),2500) })
app.get('/pairpage',(req,res)=>res.redirect('/'))
app.post('/pair',async (req,res)=>{ let n=req.body.number?.replace(/[^0-9]/g,''); if(!n) return res.redirect('/'); lastNumber=n; try{ if(sock) sock.end() }catch{}; qr=null; pair=null; status='generating...'; await start(true,n); setTimeout(()=>res.redirect('/'),2500) })
app.listen(PORT,()=>console.log('ASTRA 6.9 WITH BACK BUTTONS on '+PORT))
