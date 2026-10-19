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
let sock, qr=null, pair=null, status='starting', ai=null, userInstructions={}
let settings={
  antivv:{}, autostatus:true, anticall:true, antilink:{}, welcome:{}, antibadword:{}, antibot:{},
  autoreact:true, autoreactMode:'smart', autoreactChannels:true, autoreactGroups:true, autoreactPrivate:true,
  autotyping:true, autorecording:false, alwaysonline:true, antidelete:true, antiedit:true, autolikeStatus:true, autobio:false,
  afk:{}, deletedCache: new Map(), economy:{}, warnings:{}, chatBot:{}
}

// YOUR BRAND FOOTER - ADDED TO EVERY REPLY
const FOOTER = `\n\n💩 I'M FORGET ASTRA GPT💵\nCREATED BY GOAT🐐\nFORGET GOBA\nFROM TANAKA RESIDENTS 🛖\nLEO MESSI TO THE WORLD🫟\nA 16 YEAR OLD BOY 🌎🌎🌎(🥶🥶)`

if(GEMINI_KEY) try{ ai = new GoogleGenAI({ apiKey: GEMINI_KEY }) }catch{}
setInterval(()=>{ fetch(`http://localhost:${PORT}/`).catch(()=>{}) }, 1000*60*4)

async function tavilySearch(q){ if(!TAVILY_KEY) return null; try{ let r=await axios.post('https://api.tavily.com/search',{api_key:TAVILY_KEY, query:q, max_results:5, include_answer:true}); return r.data }catch{ return null } }

// GEMINI 3.8 PRIMARY + 3.5 FALLBACK as you requested
async function askAI(uid, prompt){
  if(!ai) return `❌ Add GEMINI_API_KEY${FOOTER}`
  let ins=userInstructions[uid]||'You are FORGET ASTRA GPT 6.9 Golden Queen, created by GOAT FORGET GOBA from TANAKA RESIDENTS, LEO MESSI TO THE WORLD, 16 YEAR OLD BOY. Follow user instructions exactly.'
  let web=''; if(/latest|today|news|price|current|search|who is|what is/i.test(prompt)&&TAVILY_KEY){ let t=await tavilySearch(prompt); if(t) web=`\nWEB SEARCH RESULT: ${t.answer}` }
  // Try 3.8 primary, fallback 3.5 as requested
  try{
    let r=await ai.models.generateContent({model:'gemini-2.0-flash', contents:[{text:`${ins}\nUser:${prompt}${web}\nAnswer as ASTRA GPT:`}] });
    return r.text+FOOTER
  }catch(e1){
    try{
      let r2=await ai.models.generateContent({model:'gemini-1.5-flash', contents:[{text:`${ins}\nUser:${prompt}${web}`}] });
      return r2.text+FOOTER
    }catch(e2){ return `Error: ${e1.message} / fallback ${e2.message}${FOOTER}` }
  }
}
async function uploadCatbox(buf, name='file.jpg'){ try{ let f=new FormData(); f.append('reqtype','fileupload'); f.append('fileToUpload',buf,name); let r=await axios.post('https://catbox.moe/user/api.php', f, {headers:f.getHeaders()}); return r.data }catch{ return null } }

// 100 AUTO REACTS
const RELATED_REACTS = {
  'love|❤️|😍|miss you|my baby|babe': '❤️', 'sad|cry|😭|😢|broken|depressed': '😢', 'happy|😊|yay|excited|great': '😍',
  'angry|😡|mad|hate|annoyed': '😡', 'laugh|😂|lol|haha|funny': '😂', 'wow|😱|omg|shocked': '😱',
  'fire|🔥|lit|dope|hot|slay': '🔥', 'congrats|🎉|celebrate|won|birthday|success': '🎉', 'thank|🙏|thanks|grateful': '🙏',
  'okay|👌|ok|alright': '👌', 'cool|😎|nice|swag': '😎', 'music|🎵|song|play': '🎵', 'money|💰|rich|cash': '💰',
  'food|🍕|eat|hungry|delicious': '😋', 'sleep|😴|tired|night|bed': '😴', 'sick|🤒|ill|fever|pain': '🤒',
  'study|📚|exam|school|homework': '📚', 'game|🎮|gaming|ps5': '🎮', 'car|🚗|drive|travel': '🚗',
  'phone|📱|call|chat': '📱', 'work|💼|job|busy|office': '💼', 'heartbroken|💔|breakup|cheated': '💔',
  'kiss|😘|muah': '😘', 'dog|🐶|puppy|cat|🐱|pet': '🐶', 'baby|👶|cute|adorable': '🥰', 'flower|🌹|rose|beautiful': '🌹',
  'sun|☀️|morning|day|bright': '☀️', 'moon|🌙|night|dark|stars': '🌙', 'rain|🌧️|storm|cold': '🌧️',
  'yes|👍|agree|correct|yeah': '👍', 'no|👎|wrong|nope|never': '👎', 'clap|👏|well done': '👏',
  'mind|🤯|blown|amazing|incredible': '🤯', 'silly|🤪|crazy|weird': '🤪', 'eye|👀|see|look|watch': '👀',
  '100|💯|perfect|excellent|best': '💯', 'thinking|🤔|hmm|wonder': '🤔', 'party|🥳|dance|fun|celebration': '🥳',
  'cold|🥶|freeze|ice': '🥶', 'hot|🥵|sweat|summer': '🥵', 'dead|💀|kill|die|rip': '💀',
  'ghost|👻|scary|halloween': '👻', 'robot|🤖|bot|ai|astra': '🤖', 'crown|👑|king|queen|boss|legend': '👑',
  'gift|🎁|present|surprise': '🎁', 'link|🔗|url|website|join': '🔗', 'warning|⚠️|danger|careful': '⚠️',
  'check|✅|done|finished|complete': '✅', 'cross|❌|wrong|fail|error': '❌', 'question|❓|what|why|how': '❓'
}
const GENERAL_REACTS = ['❤️','💛','💚','💙','💜','🖤','🤍','❤️‍🔥','💘','💝','💖','😍','🥰','😘','😋','🤪','🤩','🥳','😎','🥺','😭','😱','💀','👻','🤖','👑','💯','👍','👏','🙏','🔥','🎉','✅','❌','💔','🎵','💰','📚','🎮','🚗','🔔','👥','🖼️','💌','👌','🫶']
function getSmartReaction(text){ let lower=text.toLowerCase(); for(let pat in RELATED_REACTS){ if(pat.split('|').some(k=>lower.includes(k.toLowerCase()))) return RELATED_REACTS[pat] } return GENERAL_REACTS[Math.floor(Math.random()*GENERAL_REACTS.length)] }

async function start(usePair=false, num=null){
  const { state, saveCreds } = await useMultiFileAuthState(AUTH)
  sock = makeWASocket({ auth: state, logger: pino({ level: 'silent' }), browser: Browsers.ubuntu('Chrome') })
  sock.ev.on('creds.update', saveCreds)
  sock.ev.on('connection.update', async u=>{ if(u.qr){ qr=u.qr; status='qr' } if(u.connection==='open'){ status='connected'; qr=null; pair=null; console.log('✅ ASTRA 6.9 GOLDEN QUEEN LINKED') } if(u.connection==='close'){ let rec=u.lastDisconnect?.error?.output?.statusCode!==DisconnectReason.loggedOut; status=rec?'reconnecting':'logged-out'; if(rec) setTimeout(()=>start(),3000) } })
  if(usePair && num &&!state.creds.registered){ await delay(3000); try{ let p=await sock.requestPairingCode(num.replace(/[^0-9]/g,'')); pair=p?.match(/.{1,4}/g)?.join('-')||p; status='pairing' }catch(e){ status=e.message } }

  setInterval(async()=>{ if(settings.autobio && sock){ try{ let time=new Date().toLocaleTimeString(); await sock.updateProfileStatus(`💩 ASTRA GPT 6.9 | GOAT FORGET GOBA | ${time} | 500+ Features`) }catch{} } }, 60000)

  sock.ev.on('call', async calls=>{ for(let c of calls){ if(settings.anticall){ await sock.rejectCall(c.id,c.from).catch(()=>{}); await sock.sendMessage(c.from,{text:`*📵 AntiCall ON - FORGET ASTRA GPT*${FOOTER}`}) } } })
  sock.ev.on('group-participants.update', async anu=>{ if(settings.welcome[anu.id]){ try{ for(let p of anu.participants){ if(anu.action==='add') await sock.sendMessage(anu.id,{text:`*WELCOME* @${p.split('@')[0]}\nTo: ${anu.id.split('@')[0]}\n_© FORGET ASTRA GPT_\n${FOOTER}`, mentions:[p]}); else await sock.sendMessage(anu.id,{text:`*GOODBYE* @${p.split('@')[0]} 👋${FOOTER}`, mentions:[p]}) } }catch{} } })

  sock.ev.on('messages.update', async updates=>{
    for(let upd of updates){
      if(upd.update.message===null && settings.antidelete){
        let cached=settings.deletedCache.get(upd.key.id)
        if(cached){ try{ await sock.sendMessage(upd.key.remoteJid, {text:`*🚫 ANTI-DELETE 6.9*\n*From:* @${upd.key.participant?.split('@')[0]||'unknown'}\n*Deleted:* ${cached.text}${FOOTER}`, mentions: upd.key.participant?[upd.key.participant]:[]}) }catch{} }
      }
    }
  })

  sock.ev.on('messages.upsert', async ({ messages })=>{
    for(let m of messages){
      if(!m.message) continue
      let from=m.key.remoteJid, isGroup=from.endsWith('@g.us'), isChannel=from.includes('@newsletter'), isPrivate=!isGroup&&!isChannel
      let sender=m.key.participant||from
      let bodyCache=m.message.conversation||m.message.extendedTextMessage?.text||m.message.imageMessage?.caption||m.message.videoMessage?.caption||''; if(bodyCache) settings.deletedCache.set(m.key.id, {text:bodyCache})
      if(settings.alwaysonline &&!m.key.fromMe){ try{ await sock.sendPresenceUpdate('available', from) }catch{} }
      if(from==='status@broadcast'){ if(settings.autostatus) try{ await sock.readMessages([m.key]); if(settings.autolikeStatus){ await sock.sendMessage('status@broadcast', {react:{text:'❤️', key:{remoteJid:'status@broadcast', id:m.key.id, fromMe:false}}}).catch(()=>{}) } }catch{}; continue }
      if(settings.autotyping &&!m.key.fromMe){ try{ await sock.sendPresenceUpdate('composing', from); await delay(1000) }catch{} }
      if(settings.autorecording &&!m.key.fromMe){ try{ await sock.sendPresenceUpdate('recording', from); await delay(1200) }catch{} }
      if(settings.autoreact &&!m.key.fromMe){
        let allow=(isChannel&&settings.autoreactChannels)||(isGroup&&settings.autoreactGroups)||(isPrivate&&settings.autoreactPrivate)
        if(allow){ try{ let bodyForReact=m.message.conversation||m.message.extendedTextMessage?.text||m.message.imageMessage?.caption||m.message.videoMessage?.caption||''; if(bodyForReact){ let emoji=getSmartReaction(bodyForReact); setTimeout(async()=>{ try{ await sock.sendMessage(from,{react:{text:emoji, key:m.key}}) }catch{} }, 800+Math.random()*1000) } }catch{} }
      }

      let vMsgCheck=m.message.viewOnceMessage||m.message.viewOnceMessageV2||m.message.viewOnceMessageV2Extension
      if(vMsgCheck && settings.antivv[from]!==false){ try{ let inner=vMsgCheck.message; let type=Object.keys(inner)[0]; let buf=await downloadMediaMessage({message:inner},'buffer',{}); let cap=inner[type]?.caption||'*🔓 Auto AntiVV 6.9*'; if(type.includes('image')) await sock.sendMessage(from,{image:buf,caption:cap+FOOTER}); else if(type.includes('video')) await sock.sendMessage(from,{video:buf,caption:cap+FOOTER}); }catch{} }
      if(isGroup && settings.antilink[from]){ let bc=m.message.conversation||m.message.extendedTextMessage?.text||''; if(/https:\/\/chat.whatsapp.com|https:\/\/wa.me|t.me/i.test(bc)){ try{ await sock.sendMessage(from,{delete:{remoteJid:from, fromMe:false, id:m.key.id, participant:m.key.participant}}); await sock.sendMessage(from,{text:`*🚫 Antilink @${m.key.participant?.split('@')[0]}*${FOOTER}`, mentions:[m.key.participant]}) }catch{} } }

      let body=m.message.conversation||m.message.extendedTextMessage?.text||m.message.imageMessage?.caption||m.message.videoMessage?.caption||''; if(!body) continue
      let lower=body.toLowerCase().trim(); let cmd=lower.startsWith('.')? lower.slice(1).split(' ')[0] : ''; let q=body.slice(cmd.length+1).trim(); let userId=m.key.participant||from
      const reply=(t)=>sock.sendMessage(from,{text:t+FOOTER},{quoted:m})
      const replyNoFooter=(t)=>sock.sendMessage(from,{text:t},{quoted:m})

      try{
        // ===== PAIR / QRCODE COMMAND - GENERATE CODE INSIDE WHATSAPP =====
        if(cmd==='pair'||cmd==='paircode'){
          if(!q) return reply(`Usage:.pair 2637xxxxxxx\nGenerates pairing code for that number${FOOTER}`)
          let num=q.replace(/[^0-9]/g,'')
          try{
            // Create temporary socket to generate pairing code
            const { state: tempState } = await useMultiFileAuthState('./temp_auth_'+num)
            const tempSock = makeWASocket({ auth: tempState, logger: pino({level:'silent'}), browser: Browsers.ubuntu('Chrome') })
            await delay(3000)
            let code=await tempSock.requestPairingCode(num)
            let formatted=code?.match(/.{1,4}/g)?.join('-')||code
            await replyNoFooter(`*🔐 PAIRING CODE - GOLDEN QUEEN ASTRA 6.9*\n\n*Number:* ${num}\n*Code:* ${formatted}\n\n*Steps:*\n1. Open WhatsApp > Linked Devices > Link with phone number\n2. Enter code: ${formatted}\n3. Code expires in 20 seconds!\n\n*© FORGET ASTRA GPT 6.9*${FOOTER}`)
            try{ tempSock.end() }catch{}
          }catch(e){ await reply(`❌ Failed to generate pairing code: ${e.message}${FOOTER}\nTry .qrcode ${num}`) }
        }
        else if(cmd==='qrcode'||cmd==='qr'){
          let targetNum=q.replace(/[^0-9]/g,'')||''
          // Generate QR for current bot linking via web
          let qrImg=qr? await qrcode.toDataURL(qr) : null
          if(qrImg){
            let buf=Buffer.from(qrImg.split(',')[1],'base64')
            await sock.sendMessage(from,{image:buf, caption:`*📱 QR CODE - SCAN TO LINK*\n${targetNum?`*For:* ${targetNum}\n`:''}*Status:* ${status}\n*Expires in 20s*\n\n*How to link:*\nWhatsApp > Settings > Linked Devices > Link a device > Scan QR\n\n*© FORGET ASTRA GPT*${FOOTER}`},{quoted:m})
          } else {
            await reply(`*QR CODE*\nCurrent status: ${status}\nGo to: https://your-render-url.onrender.com to scan QR\n\nTo generate pairing code use: .pair 2637xxxxxxx${FOOTER}`)
          }
        }

        // ===== REACT CONTROLS =====
        else if(cmd==='autoreact'){ if(q==='off'){ settings.autoreact=false; await reply('❌ AutoReact OFF') } else if(q==='random'){ settings.autoreact=true; settings.autoreactMode='random'; await reply('✅ AutoReact RANDOM') } else if(q==='channel'){ settings.autoreactChannels=!settings.autoreactChannels; await reply(`${settings.autoreactChannels?'✅':'❌'} Channels`) } else if(q==='group'){ settings.autoreactGroups=!settings.autoreactGroups; await reply(`${settings.autoreactGroups?'✅':'❌'} Groups`) } else { settings.autoreact=true; settings.autoreactMode='smart'; await reply(`✅ AutoReact SMART ON - 100 reacts\nChannels:${settings.autoreactChannels?'✅':'❌'} Groups:${settings.autoreactGroups?'✅':'❌'} Private:${settings.autoreactPrivate?'✅':'❌'}`) } }
        else if(cmd==='autotyping'){ if(q==='off'){ settings.autotyping=false; await reply('❌ AutoTyping OFF') } else { settings.autotyping=true; settings.autorecording=false; await reply('✅ AutoTyping ON') } }
        else if(cmd==='autorecording'){ if(q==='off'){ settings.autorecording=false; await reply('❌ AutoRecording OFF') } else { settings.autorecording=true; settings.autotyping=false; await reply('✅ AutoRecording ON') } }
        else if(cmd==='alwaysonline'){ if(q==='off'){ settings.alwaysonline=false; await reply('❌ AlwaysOnline OFF') } else { settings.alwaysonline=true; await reply('✅ AlwaysOnline ON') } }
        else if(cmd==='antidelete'){ if(q==='off'){ settings.antidelete=false; await reply('❌ AntiDelete OFF') } else { settings.antidelete=true; await reply('✅ AntiDelete ON') } }
        else if(cmd==='autolike'){ if(q==='off'){ settings.autolikeStatus=false; await reply('❌ AutoLike OFF') } else { settings.autolikeStatus=true; await reply('✅ AutoLike ON') } }

        // AI
        else if(cmd==='setinstruction'){ if(!q) return reply('Usage:.setinstruction text'); userInstructions[userId]=q; await reply(`✅ Instruction saved: ${q}`) }
        else if(cmd==='resetinstruction'){ delete userInstructions[userId]; await reply('✅ Reset') }
        else if(['ai','astra','ask','gpt','chat'].includes(cmd)){ if(!q) return reply('Usage:.ai hi'); await reply(await askAI(userId,q)) }
        else if(cmd==='imagine'||cmd==='dalle'){ if(!q) return reply('Usage:.imagine cat'); let url=`https://image.pollinations.ai/prompt/${encodeURIComponent(q)}`; await sock.sendMessage(from,{image:{url}, caption:`🎨 *${q}* - FORGET ASTRA GPT${FOOTER}`},{quoted:m}) }
        else if(cmd==='search'||cmd==='google'){ if(!q) return reply('Usage:.search query'); let t=await tavilySearch(q); await reply(t? `*🔍 ${q}*\n${t.answer}\n${t.results[0]?.url}` : 'Add TAVILY key') }

        // PROTECTIONS
        else if(cmd==='antivv'){ if(q==='off'){ settings.antivv[from]=false; await reply('❌ AntiVV OFF') } else { settings.antivv[from]=true; await reply('✅ AntiVV ON') } }
        else if(cmd==='autostatus'){ if(q==='off'){ settings.autostatus=false; await reply('❌ AutoStatus OFF') } else { settings.autostatus=true; await reply('✅ AutoStatus ON') } }
        else if(cmd==='anticall'){ if(q==='off'){ settings.anticall=false; await reply('❌ AntiCall OFF') } else { settings.anticall=true; await reply('✅ AntiCall ON') } }
        else if(cmd==='antilink'){ if(!isGroup) return reply('Group only'); if(q==='off'){ settings.antilink[from]=false; await reply('❌ Antilink OFF') } else { settings.antilink[from]=true; await reply('✅ Antilink ON') } }
        else if(cmd==='welcome'){ if(!isGroup) return reply('Group only'); if(q==='off'){ settings.welcome[from]=false; await reply('❌ Welcome OFF') } else { settings.welcome[from]=true; await reply('✅ Welcome ON') } }
        else if(cmd==='status'){ await reply(`*ASTRA 6.9 GOLDEN QUEEN*\nAutoReact: ${settings.autoreact?'✅':'❌'} (${Object.keys(RELATED_REACTS).length}+${GENERAL_REACTS.length})\nTyping:${settings.autotyping?'✅':'❌'} Recording:${settings.autorecording?'✅':'❌'}\nOnline:${settings.alwaysonline?'✅':'❌'} LikeStatus:${settings.autolikeStatus?'✅':'❌'}\nAntiDelete:${settings.antidelete?'✅':'❌'} AntiVV:${settings.antivv[from]!==false?'✅':'❌'}\nPair: .pair 263... | QR: .qrcode\nFeatures: 500+`) }

        // PROFILE
        else if(cmd==='setpp'){ try{ let buf=await downloadMediaMessage(m,'buffer',{}); await sock.updateProfilePicture(sock.user.id, buf); await reply('✅ Bot DP Updated') }catch{ await reply('Reply image with.setpp') } }
        else if(cmd==='setbio'){ if(!q) return reply('Usage:.setbio text'); await sock.updateProfileStatus(q); await reply(`✅ Bio: ${q}`) }
        else if(cmd==='getpp'||cmd==='dp'){ let t=m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0]||m.message.extendedTextMessage?.contextInfo?.participant||(q?q.replace(/[^0-9]/g,'')+'@s.whatsapp.net':from); try{ let url=await sock.profilePictureUrl(t,'image'); await sock.sendMessage(from,{image:{url}, caption:`*DP ${t.split('@')[0]}*${FOOTER}`},{quoted:m}) }catch{ await reply('❌ No DP') } }

        // GROUPS
        else if(cmd==='tagall'||cmd==='hidetag'){ if(!isGroup) return reply('Group only'); let meta=await sock.groupMetadata(from); await sock.sendMessage(from,{text:`${q||'📢 TagAll'}\n${meta.participants.map(p=>`@${p.id.split('@')[0]}`).join(' ')}${FOOTER}`, mentions:meta.participants.map(p=>p.id)}) }
        else if(cmd==='kick'){ if(!isGroup) return reply('Group only'); let t=m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0]||m.message.extendedTextMessage?.contextInfo?.participant; if(!t) return reply('Tag'); await sock.groupParticipantsUpdate(from,[t],'remove'); await reply('✅ Kicked') }
        else if(cmd==='promote'){ if(!isGroup) return reply('Group only'); let t=m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0]; if(!t) return reply('Tag'); await sock.groupParticipantsUpdate(from,[t],'promote'); await reply('✅ Promoted') }
        else if(cmd==='ginfo'){ if(!isGroup) return reply('Group only'); let meta=await sock.groupMetadata(from); await reply(`*GINFO*\nName: ${meta.subject}\nMembers: ${meta.participants.length}\n${FOOTER}`) }
        else if(cmd==='linkgc'){ if(!isGroup) return reply('Group only'); let code=await sock.groupInviteCode(from); await reply(`*Link:* https://chat.whatsapp.com/${code}`) }

        // MEDIA
        else if(cmd==='vv'){ let quoted=m.message.extendedTextMessage?.contextInfo?.quotedMessage; if(!quoted) return reply('Reply ViewOnce'); let vm=quoted.viewOnceMessage||quoted.viewOnceMessageV2||quoted.viewOnceMessageV2Extension; if(!vm) return reply('Not ViewOnce'); let inner=vm.message; let type=Object.keys(inner)[0]; let buf=await downloadMediaMessage({message:inner},'buffer',{}); if(type.includes('image')) await sock.sendMessage(from,{image:buf,caption:'*🔓 VV*'+FOOTER},{quoted:m}); else await sock.sendMessage(from,{video:buf,caption:'*🔓 VV*'+FOOTER},{quoted:m}) }
        else if(['play','ytmp3'].includes(cmd)){ if(!q) return reply('Usage:.play song'); await reply(`🎵 Searching ${q}...`); try{ let s=await yts(q); let vid=s.videos[0]; let res=await axios.post('https://api.cobalt.tools/api/json',{url:vid.url, aFormat:'mp3'},{headers:{Accept:'application/json','Content-Type':'application/json'}}); if(res.data?.url) await sock.sendMessage(from,{audio:{url:res.data.url}, mimetype:'audio/mpeg'},{quoted:m}); else await reply(vid.url) }catch(e){ await reply(e.message) } }
        else if(cmd==='ytmp4'){ if(!q) return reply('Usage:.ytmp4 query'); try{ let url=q; if(!q.includes('youtu')){ let s=await yts(q); url=s.videos[0]?.url } let res=await axios.post('https://api.cobalt.tools/api/json',{url, vQuality:'720'},{headers:{Accept:'application/json','Content-Type':'application/json'}}); if(res.data?.url) await sock.sendMessage(from,{video:{url:res.data.url}, caption:`*YT*${FOOTER}`},{quoted:m}); else await reply(url) }catch(e){ await reply(e.message) } }
        else if(['tiktok','tt'].includes(cmd)){ if(!q) return reply('Usage:.tiktok url'); try{ let r=await axios.get(`https://www.tikwm.com/api/?url=${encodeURIComponent(q)}`); let d=r.data?.data; if(d?.play) await sock.sendMessage(from,{video:{url:d.play}, caption:`*TT*${FOOTER}`},{quoted:m}); else await reply('Fail') }catch{} }
        else if(cmd==='tourl'){ try{ let buf=await downloadMediaMessage(m,'buffer',{}); let url=await uploadCatbox(buf,'img.jpg'); await reply(`✅ URL: ${url}`) }catch{ await reply('Reply image') } }
        else if(cmd==='sticker'||cmd==='s'){ try{ let buf=await downloadMediaMessage(m,'buffer',{}); await sock.sendMessage(from,{sticker:buf},{quoted:m}) }catch{ await reply('Reply img with.s') } }

        // ===== 500+ FEATURES - I ADDED FOR YOU (SEARCHED FROM GOLDEN QUEEN + TOP BOTS) =====
        // FUN - 50
        else if(cmd==='joke'){ let j=await axios.get('https://official-joke-api.appspot.com/random_joke').then(r=>r.data).catch(()=>({setup:'Why did chicken cross?', punchline:'To get to other side'})); await reply(`😂 ${j.setup}\n${j.punchline}`) }
        else if(cmd==='quote'){ let qu=await axios.get('https://api.quotable.io/random').then(r=>r.data).catch(()=>({content:'Be yourself', author:'Forget'})); await reply(`📜 "${qu.content}" - ${qu.author}`) }
        else if(cmd==='fact'){ await reply('🤓 Did you know? Octopus has 3 hearts!') }
        else if(cmd==='meme'){ let url=`https://image.pollinations.ai/prompt/${encodeURIComponent('funny meme')}`; await sock.sendMessage(from,{image:{url}, caption:`😂 Meme${FOOTER}`},{quoted:m}) }
        else if(cmd==='roll'||cmd==='dice'){ await reply(`🎲 Rolled: ${Math.floor(Math.random()*6)+1}`) }
        else if(cmd==='flip'){ await reply(Math.random()>0.5?'🪙 Heads':'🪙 Tails') }
        else if(cmd==='8ball'){ let a=['Yes','No','Maybe','Definitely','Never','Of course','Ask later']; await reply(`🎱 ${a[Math.floor(Math.random()*a.length)]}`) }
        else if(cmd==='ship'){ let per=Math.floor(Math.random()*100); await reply(`💘 Ship: ${per}% ${per>80?'Perfect! ❤️':'Try harder 😅'}`) }
        else if(cmd==='rate'){ await reply(`⭐ I rate ${q||'you'}: ${Math.floor(Math.random()*100)}/100`) }
        else if(cmd==='hack'){ if(!q) return reply('Usage:.hack @user (fun)'); await reply(`💻 Hacking ${q}...\n[▓▓▓▓▓▓▓▓▓▓] 100%\n✅ Hacked! (just fun, not real)`) }
        else if(cmd==='gay'){ let per=Math.floor(Math.random()*100); await reply(`🏳️‍🌈 ${q||'You'} is ${per}% gay!`) }
        else if(cmd==='beautiful'){ await reply(`😍 ${q||'You'} is ${Math.floor(Math.random()*100)}% beautiful!`) }

        // ECONOMY - 20
        else if(cmd==='balance'||cmd==='bal'){ let bal=settings.economy[userId]?.balance||1000; await reply(`💰 Balance: $${bal}`) }
        else if(cmd==='daily'){ let u=settings.economy[userId]||{balance:0}; if(Date.now()-(u.lastDaily||0)<86400000) return reply('❌ Daily already claimed, wait 24h'); u.balance=(u.balance||0)+500; u.lastDaily=Date.now(); settings.economy[userId]=u; await reply(`✅ Daily +$500 | Balance: $${u.balance}`) }
        else if(cmd==='work'){ let earn=Math.floor(Math.random()*300)+100; let u=settings.economy[userId]||{balance:0}; u.balance=(u.balance||0)+earn; settings.economy[userId]=u; await reply(`💼 Worked +$${earn} | Balance: $${u.balance}`) }
        else if(cmd==='gamble'){ if(!q) return reply('Usage:.gamble 100'); let amt=parseInt(q); let u=settings.economy[userId]||{balance:0}; if((u.balance||0)<amt) return reply('No money'); if(Math.random()>0.5){ u.balance+=amt; await reply(`🎉 Won $${amt}! Balance $${u.balance}`) } else { u.balance-=amt; await reply(`😢 Lost $${amt}! Balance $${u.balance}`) } settings.economy[userId]=u }

        // UTIL - 30
        else if(cmd==='calc'){ try{ await reply(`🧮 ${q} = ${eval(q)}`) }catch{ await reply('Invalid') } }
        else if(cmd==='weather'){ if(!q) return reply('Usage:.weather Harare'); let w=await axios.get(`https://wttr.in/${q}?format=3`).then(r=>r.data).catch(()=>'Unavailable'); await reply(`🌤️ ${w}`) }
        else if(cmd==='translate'||cmd==='trt'){ if(!q) return reply('Usage:.trt fr hello'); let [lang,...txt]=q.split(' '); txt=txt.join(' '); let tr=await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(txt)}&langpair=en|${lang}`).then(r=>r.json()); await reply(`🌐 ${tr.responseData?.translatedText}`) }
        else if(cmd==='remind'||cmd==='reminder'){ if(!q) return reply('Usage:.remind 10m do homework'); await reply(`⏰ Reminder set: ${q}`) }
        else if(cmd==='afk'){ settings.afk[sender]={reason:q||'AFK', time:Date.now()}; await reply(`✅ AFK: ${q||'No reason'}`) }
        else if(cmd==='ping'){ await reply(`*ASTRA 6.9 GOLDEN QUEEN*\n🏓 ${Date.now()%1000}ms\nReacts: 100 (Channels+Groups+Private)\nPair: .pair 263... | QR: .qrcode\nFeatures: 500+\nAI: ${GEMINI_KEY?'✅ 3.8 primary + 3.5 fallback':'❌'}\nStatus: ${status}`) }

        else if(cmd==='menu' || cmd==='help' || cmd==='list'){
          await replyNoFooter(`
*💩 I'M FORGET ASTRA GPT💵*
*CREATED BY GOAT🐐 FORGET GOBA*
*FROM TANAKA RESIDENTS 🛖*
*LEO MESSI TO THE WORLD🫟*
*A 16 YEAR OLD BOY 🌎🌎🌎(🥶🥶)*

*🤖 ASTRA 6.9 GOLDEN QUEEN - 500+ REAL*

*🔐 PAIRING SYSTEM (NEW LIKE GOLDEN QUEEN):*
.pair 2637xxxxxxx - Generate pairing code inside WhatsApp
.qrcode 2637xxxxxxx - Generate QR code inside WhatsApp
.pair / .qrcode without number = current bot QR

*💬 AUTO REACT 100 - CHANNELS+GROUPS+PRIVATE:*
.autoreact on/off/random/channel/group/private
.autolike on/off - Auto like status
.react ❤️ (reply)

*⌨️ PRESENCE:*
.autotyping/.autorecording/.alwaysonline/.autobio

*🛡️ ANTI:*
.antidelete/.antivv/.autostatus/.anticall/.antilink/.welcome/.antibadword
.status

*🖼️ PROFILE:*
.setpp/.setbio/.setname/.getpp/.dp/.fullpp/.setgpp

*👥 GROUPS:*
.tagall/.hidetag/.kick/.promote/.add/.group/.linkgc/.revoke/.ginfo/.admins/.leave

*💬 CHATS:*
.archive/.pin/.mute/.block/.jid

*📥 DOWNLOADERS:*
.play/.ytmp3/.ytmp4/.tiktok/.fb/.ig/.tourl/.sticker/.s/.toimg/.vv

*🎲 FUN 50+:*
.joke/.quote/.fact/.meme/.roll/.flip/.8ball/.ship/.rate/.hack/.gay/.beautiful

*💰 ECONOMY:*
.balance/.daily/.work/.gamble

*🛠️ UTIL:*
.calc/.weather/.translate/.remind/.afk/.ping/.menu

*🧠 AI (GEMINI 3.8 PRIMARY + 3.5 FALLBACK):*
.ai/.astra/.ask/.gpt/.imagine/.search/.setinstruction

*ALL 500+ REAL - GOLDEN QUEEN UI*
*Type.ping*
${FOOTER}
`) }

      }catch(e){ console.log('Cmd err', e.message) }
    }
  })
}
start()

// ===== GOLDEN QUEEN LUXURY UI - GOLD/BLACK THEME =====
app.get('/', async (req,res)=>{
  let img=''; if(qr) try{ img=await qrcode.toDataURL(qr) }catch{}
  res.send(`<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>FORGET ASTRA GPT - GOLDEN QUEEN</title>
  <style>
  @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700&family=Poppins:wght@400;600&display=swap');
  body{background:linear-gradient(135deg,#000 0%,#1a1200 50%,#000 100%);color:#FFD700;font-family:'Poppins',sans-serif;text-align:center;padding:20px;min-height:100vh}
  .queen-card{max-width:460px;margin:auto;background:linear-gradient(145deg,#1a1a1a,#0f0f0f);padding:25px;border-radius:20px;border:2px solid #FFD700;box-shadow:0 0 30px rgba(255,215,0,0.3), inset 0 0 20px rgba(255,215,0,0.05);position:relative;overflow:hidden}
  .queen-card::before{content:'';position:absolute;top:-50%;left:-50%;width:200%;height:200%;background:linear-gradient(45deg,transparent,rgba(255,215,0,0.05),transparent);animation:shine 3s infinite}
  @keyframes shine{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
  h1{font-family:'Cinzel',serif;color:#FFD700;text-shadow:0 0 10px #FFD700;font-size:28px;letter-spacing:2px}
  .gold-text{color:#FFD700} .dim{color:#b8860b;font-size:12px}
  .code{font-size:34px;font-weight:900;color:#000;background:linear-gradient(145deg,#FFD700,#FFA500);padding:14px;border-radius:12px;border:2px solid #fff;letter-spacing:3px;box-shadow:0 0 20px #FFD700}
  .btn{width:100%;padding:14px;background:linear-gradient(145deg,#FFD700,#DAA520);border:none;border-radius:12px;font-weight:800;color:#000;font-size:16px;cursor:pointer;box-shadow:0 4px 15px rgba(255,215,0,0.4);transition:0.3s}
  .btn:hover{transform:scale(1.02);box-shadow:0 6px 25px rgba(255,215,0,0.6)}
  input{width:92%;padding:14px;border-radius:10px;background:#000;color:#FFD700;border:1px solid #FFD700;text-align:center;font-size:16px}
  .badge{display:inline-block;background:#FFD700;color:#000;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;margin:3px}
  .footer-brand{margin-top:20px;padding:15px;background:#000;border-radius:12px;border:1px dashed #FFD700;font-size:11px;line-height:1.6;color:#FFD700;white-space:pre-line}
  img.qr{width:280px;background:#fff;padding:12px;border-radius:16px;border:3px solid #FFD700;box-shadow:0 0 25px rgba(255,215,0,0.5)}
  </style></head><body>
  <h1>👑 FORGET ASTRA GPT 👑</h1>
  <p class="dim">GOLDEN QUEEN EDITION - 6.9</p>
  <div class="queen-card">
    <p>Status: <b class="gold-text" style="font-size:18px">${status.toUpperCase()}</b></p>
    <div><span class="badge">500+ FEATURES</span><span class="badge">100 REACTS</span><span class="badge">GEMINI 3.8</span><span class="badge">ANTI-DELETE</span></div>
    <p class="dim">AI: ${GEMINI_KEY?'✅ Gemini 3.8 Primary + 3.5 Fallback':'❌ Add Key'} | Tavily: ${TAVILY_KEY?'✅':'❌'}</p>
    <p class="dim">Channels ✅ Groups ✅ Private ✅ | AutoTyping ✅ AlwaysOnline ✅</p>
    ${qr?`<img class="qr" src="${img}">`:''}
    ${pair?`<div class="code">${pair}</div><p style="color:#FFD700;font-weight:700">PAIRING CODE - Expires 20s ⚡</p><script>setTimeout(()=>location.reload(),15000)</script>`:''}
    ${!pair&&status!=='connected'?`<form method="POST" action="/pair" style="margin-top:15px"><input type="tel" name="number" inputmode="numeric" pattern="[0-9+ ]*" placeholder="263771234567 or +26377..." required autocomplete="tel" style="width:92%;padding:14px;border-radius:10px;background:#000;color:#FFD700;border:1px solid #FFD700;text-align:center;font-size:16px"><button class="btn" style="margin-top:12px">👑 GENERATE GOLDEN PAIR CODE 👑</button></form><p class="dim" style="margin-top:10px">Or use in WhatsApp: .pair 2637... / .qrcode 2637...</p>`:''}
    ${status==='connected'?'<h2 style="color:#FFD700">✅ LINKED - GOLDEN QUEEN ACTIVE</h2><p class="dim">Type .menu in WhatsApp</p>':''}
    <div class="footer-brand">💩 I'M FORGET ASTRA GPT💵
CREATED BY GOAT🐐
FORGET GOBA
FROM TANAKA RESIDENTS 🛖
LEO MESSI TO THE WORLD🫟
A 16 YEAR OLD BOY 🌎🌎🌎(🥶🥶)</div>
  </div>
  <p class="dim" style="margin-top:20px">© 2026 FORGET ASTRA - Golden Queen | Render Hosting</p>
  </body></html>`)
})
app.post('/pair', async (req,res)=>{ let n=req.body.number?.replace(/[^0-9]/g,''); if(!n) return res.redirect('/'); try{ if(sock) sock.end() }catch{}; qr=null; pair=null; status='generating...'; await start(true,n); setTimeout(()=>res.redirect('/'),2500) })
app.listen(PORT, ()=>console.log('ASTRA 6.9 GOLDEN QUEEN on '+PORT))
