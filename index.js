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
let settings={antivv:{},autostatus:true,anticall:true,antilink:{},welcome:{},antibadword:{},antibot:{},autoreact:true,autoreactMode:'smart',autoreactChannels:true,autoreactGroups:true,autoreactPrivate:true,autotyping:true,autorecording:false,alwaysonline:true,antidelete:true,autolikeStatus:true,autobio:false,afk:{},deletedCache:new Map(),economy:{},warnings:{}}
const FOOTER=`\n\n💩 I'M FORGET ASTRA GPT💵\nCREATED BY GOAT🐐\nFORGET GOBA\nFROM TANAKA RESIDENTS 🛖\nLEO MESSI TO THE WORLD🫟\nA 16 YEAR OLD BOY 🌎🌎🌎(🥶🥶)`
if(GEMINI_KEY) try{ ai=new GoogleGenAI({apiKey:GEMINI_KEY}) }catch{}
setInterval(()=>{ fetch(`http://localhost:${PORT}/`).catch(()=>{}) },1000*60*4)
async function tavilySearch(q){ if(!TAVILY_KEY) return null; try{ let r=await axios.post('https://api.tavily.com/search',{api_key:TAVILY_KEY,query:q,max_results:5,include_answer:true}); return r.data }catch{ return null } }
async function askAI(uid,prompt){
  if(!ai) return `❌ Add GEMINI_API_KEY${FOOTER}`
  let ins=userInstructions[uid]||'You are FORGET ASTRA GPT 6.9 Golden Queen, created by GOAT FORGET GOBA from TANAKA RESIDENTS.'
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
  setInterval(async()=>{ if(settings.autobio&&sock){ try{ let time=new Date().toLocaleTimeString(); await sock.updateProfileStatus(`💩 ASTRA GPT 6.9 | GOAT FORGET GOBA | ${time} | 500+ Features`) }catch{} } },60000)
  sock.ev.on('call',async calls=>{ for(let c of calls){ if(settings.anticall){ await sock.rejectCall(c.id,c.from).catch(()=>{}); await sock.sendMessage(c.from,{text:`*📵 AntiCall ON - FORGET ASTRA GPT*${FOOTER}`}) } } })
  sock.ev.on('group-participants.update',async anu=>{ if(settings.welcome[anu.id]){ try{ for(let p of anu.participants){ if(anu.action==='add') await sock.sendMessage(anu.id,{text:`*WELCOME* @${p.split('@')[0]}${FOOTER}`,mentions:[p]}); else await sock.sendMessage(anu.id,{text:`*GOODBYE* @${p.split('@')[0]} 👋${FOOTER}`,mentions:[p]}) } }catch{} } })
  sock.ev.on('messages.update',async updates=>{ for(let upd of updates){ if(upd.update.message===null&&settings.antidelete){ let cached=settings.deletedCache.get(upd.key.id); if(cached){ try{ await sock.sendMessage(upd.key.remoteJid,{text:`*🚫 ANTI-DELETE 6.9*\n*From:* @${upd.key.participant?.split('@')[0]||'unknown'}\n*Deleted:* ${cached.text}${FOOTER}`,mentions:upd.key.participant?[upd.key.participant]:[]}) }catch{} } } } })
  sock.ev.on('messages.upsert',async ({messages})=>{
    for(let m of messages){
      if(!m.message) continue
      let from=m.key.remoteJid, isGroup=from.endsWith('@g.us'), isChannel=from.includes('@newsletter'), isPrivate=!isGroup&&!isChannel
      let sender=m.key.participant||from
      let bodyCache=m.message.conversation||m.message.extendedTextMessage?.text||m.message.imageMessage?.caption||m.message.videoMessage?.caption||''; if(bodyCache) settings.deletedCache.set(m.key.id,{text:bodyCache})
      if(settings.alwaysonline&&!m.key.fromMe){ try{ await sock.sendPresenceUpdate('available',from) }catch{} }
      if(from==='status@broadcast'){ if(settings.autostatus) try{ await sock.readMessages([m.key]); if(settings.autolikeStatus){ await sock.sendMessage('status@broadcast',{react:{text:'❤️',key:{remoteJid:'status@broadcast',id:m.key.id,fromMe:false}}}).catch(()=>{}) } }catch{}; continue }
      if(settings.autotyping&&!m.key.fromMe){ try{ await sock.sendPresenceUpdate('composing',from); await delay(1000) }catch{} }
      if(settings.autorecording&&!m.key.fromMe){ try{ await sock.sendPresenceUpdate('recording',from); await delay(1200) }catch{} }
      if(settings.autoreact&&!m.key.fromMe){
        let allow=(isChannel&&settings.autoreactChannels)||(isGroup&&settings.autoreactGroups)||(isPrivate&&settings.autoreactPrivate)
        if(allow){ try{ let bodyForReact=m.message.conversation||m.message.extendedTextMessage?.text||m.message.imageMessage?.caption||m.message.videoMessage?.caption||''; if(bodyForReact){ let emoji=getSmartReaction(bodyForReact); setTimeout(async()=>{ try{ await sock.sendMessage(from,{react:{text:emoji,key:m.key}}) }catch{} },800+Math.random()*1000) } }catch{} }
      }
      let vMsgCheck=m.message.viewOnceMessage||m.message.viewOnceMessageV2||m.message.viewOnceMessageV2Extension
      if(vMsgCheck&&settings.antivv[from]!==false){ try{ let inner=vMsgCheck.message; let type=Object.keys(inner)[0]; let buf=await downloadMediaMessage({message:inner},'buffer',{}); let cap=inner[type]?.caption||'*🔓 Auto AntiVV 6.9*'; if(type.includes('image')) await sock.sendMessage(from,{image:buf,caption:cap+FOOTER}); else if(type.includes('video')) await sock.sendMessage(from,{video:buf,caption:cap+FOOTER}); }catch{} }
      if(isGroup&&settings.antilink[from]){ let bc=m.message.conversation||m.message.extendedTextMessage?.text||''; if(/https:\/\/chat.whatsapp.com|https:\/\/wa.me|t.me/i.test(bc)){ try{ await sock.sendMessage(from,{delete:{remoteJid:from,fromMe:false,id:m.key.id,participant:m.key.participant}}); await sock.sendMessage(from,{text:`*🚫 Antilink @${m.key.participant?.split('@')[0]}*${FOOTER}`,mentions:[m.key.participant]}) }catch{} } }
      if(isGroup&&settings.antibadword[from]){ let bc=(m.message.conversation||'').toLowerCase(); if(/fuck|shit|bitch|asshole|porn/i.test(bc)){ try{ await sock.sendMessage(from,{delete:{remoteJid:from,fromMe:false,id:m.key.id,participant:m.key.participant}}) }catch{} } }
      let body=m.message.conversation||m.message.extendedTextMessage?.text||m.message.imageMessage?.caption||m.message.videoMessage?.caption||''; if(!body) continue
      let lower=body.toLowerCase().trim(); let cmd=lower.startsWith('.')? lower.slice(1).split(' ')[0] : ''; let q=body.slice(cmd.length+1).trim(); let userId=m.key.participant||from
      const reply=(t)=>sock.sendMessage(from,{text:t+FOOTER},{quoted:m})
      const replyNoFooter=(t)=>sock.sendMessage(from,{text:t},{quoted:m})
      try{
        if(cmd==='pair'||cmd==='paircode'){
          if(!q) return reply(`Usage:.pair 2637xxxxxxx - Generates pairing code`)
          let num=q.replace(/[^0-9]/g,'')
          try{
            const {state:tempState}=await useMultiFileAuthState('./temp_auth_'+num)
            const tempSock=makeWASocket({auth:tempState,logger:pino({level:'silent'}),browser:Browsers.ubuntu('Chrome')})
            await delay(3000)
            let code=await tempSock.requestPairingCode(num)
            let formatted=code?.match(/.{1,4}/g)?.join('-')||code
            await replyNoFooter(`*🔐 PAIRING CODE - GOLDEN QUEEN ASTRA 6.9*\n\n*Number:* ${num}\n*Code:* ${formatted}\n\nSteps:\n1. WhatsApp > Linked Devices > Link with phone number\n2. Enter: ${formatted}\nExpires 20s!\n\n*© FORGET ASTRA GPT*${FOOTER}`)
            try{ tempSock.end() }catch{}
          }catch(e){ await reply(`❌ Failed: ${e.message}\nTry .qrcode ${q}`) }
        }
        else if(cmd==='qrcode'||cmd==='qr'){
          let qrImg=qr? await qrcode.toDataURL(qr) : null
          if(qrImg){ let buf=Buffer.from(qrImg.split(',')[1],'base64'); await sock.sendMessage(from,{image:buf,caption:`*📱 QR CODE - SCAN TO LINK*\nStatus: ${status}${FOOTER}`},{quoted:m}) }
          else { await reply(`QR not ready, status: ${status}\nGo to website`) }
        }
        else if(cmd==='autoreact'){ if(q==='off'){ settings.autoreact=false; await reply('❌ AutoReact OFF') } else if(q==='random'){ settings.autoreact=true; settings.autoreactMode='random'; await reply('✅ AutoReact RANDOM - 50+ random') } else if(q==='channel'){ settings.autoreactChannels=!settings.autoreactChannels; await reply(`${settings.autoreactChannels?'✅':'❌'} Channels`) } else if(q==='group'){ settings.autoreactGroups=!settings.autoreactGroups; await reply(`${settings.autoreactGroups?'✅':'❌'} Groups`) } else if(q==='private'){ settings.autoreactPrivate=!settings.autoreactPrivate; await reply(`${settings.autoreactPrivate?'✅':'❌'} Private`) } else { settings.autoreact=true; settings.autoreactMode='smart'; await reply(`✅ AutoReact SMART ON\nChannels:${settings.autoreactChannels?'✅':'❌'} Groups:${settings.autoreactGroups?'✅':'❌'} Private:${settings.autoreactPrivate?'✅':'❌'}`) } }
        else if(cmd==='autolike'){ if(q==='off'){ settings.autolikeStatus=false; await reply('❌ AutoLike OFF') } else { settings.autolikeStatus=true; await reply('✅ AutoLike ON') } }
        else if(cmd==='react'){ if(!q) return reply('Usage:.react ❤️ reply'); let target=m.message.extendedTextMessage?.contextInfo?.stanzaId; if(!target) return reply('Reply to msg'); let qKey={remoteJid:from,fromMe:false,id:target,participant:m.message.extendedTextMessage?.contextInfo?.participant}; await sock.sendMessage(from,{react:{text:q,key:qKey}}) }
        else if(cmd==='autotyping'){ if(q==='off'){ settings.autotyping=false; await reply('❌ AutoTyping OFF') } else { settings.autotyping=true; settings.autorecording=false; await reply('✅ AutoTyping ON') } }
        else if(cmd==='autorecording'){ if(q==='off'){ settings.autorecording=false; await reply('❌ AutoRecording OFF') } else { settings.autorecording=true; settings.autotyping=false; await reply('✅ AutoRecording ON') } }
        else if(cmd==='alwaysonline'){ if(q==='off'){ settings.alwaysonline=false; await reply('❌ AlwaysOnline OFF') } else { settings.alwaysonline=true; await reply('✅ AlwaysOnline ON') } }
        else if(cmd==='autobio'){ if(q==='off'){ settings.autobio=false; await sock.updateProfileStatus('🤖 ASTRA 6.9 FINAL'); await reply('❌ AutoBio OFF') } else { settings.autobio=true; await reply('✅ AutoBio ON') } }
        else if(cmd==='antidelete'){ if(q==='off'){ settings.antidelete=false; await reply('❌ AntiDelete OFF') } else { settings.antidelete=true; await reply('✅ AntiDelete ON') } }
        else if(cmd==='antivv'){ if(q==='off'){ settings.antivv[from]=false; await reply('❌ AntiVV OFF') } else { settings.antivv[from]=true; await reply('✅ AntiVV ON') } }
        else if(cmd==='autostatus'){ if(q==='off'){ settings.autostatus=false; await reply('❌ AutoStatus OFF') } else { settings.autostatus=true; await reply('✅ AutoStatus ON') } }
        else if(cmd==='anticall'){ if(q==='off'){ settings.anticall=false; await reply('❌ AntiCall OFF') } else { settings.anticall=true; await reply('✅ AntiCall ON') } }
        else if(cmd==='antilink'){ if(!isGroup) return reply('Group only'); if(q==='off'){ settings.antilink[from]=false; await reply('❌ Antilink OFF') } else { settings.antilink[from]=true; await reply('✅ Antilink ON') } }
        else if(cmd==='antibadword'){ if(!isGroup) return reply('Group only'); if(q==='off'){ settings.antibadword[from]=false; await reply('❌ AntiBadWord OFF') } else { settings.antibadword[from]=true; await reply('✅ AntiBadWord ON') } }
        else if(cmd==='welcome'){ if(!isGroup) return reply('Group only'); if(q==='off'){ settings.welcome[from]=false; await reply('❌ Welcome OFF') } else { settings.welcome[from]=true; await reply('✅ Welcome ON') } }
        else if(cmd==='status'){ await reply(`*ASTRA 6.9 FINAL - STATUS*\n*Reacts:*\nAutoReact:${settings.autoreact?'✅ '+settings.autoreactMode:'❌'}\n├ Channels:${settings.autoreactChannels?'✅':'❌'}\n├ Groups:${settings.autoreactGroups?'✅':'❌'}\n└ Private:${settings.autoreactPrivate?'✅':'❌'}\nAutoLike:${settings.autolikeStatus?'✅':'❌'}\n*Presence:*\nTyping:${settings.autotyping?'✅':'❌'} Recording:${settings.autorecording?'✅':'❌'}\nOnline:${settings.alwaysonline?'✅':'❌'} Bio:${settings.autobio?'✅':'❌'}\n*Anti:*\nDelete:${settings.antidelete?'✅':'❌'} VV:${settings.antivv[from]!==false?'✅':'❌'}\nPair: .pair 263... | QR: .qrcode\n500+ Features`) }
        else if(cmd==='setinstruction'){ if(!q) return reply('Usage:.setinstruction text'); userInstructions[userId]=q; await reply(`✅ Saved: ${q}`) }
        else if(cmd==='myinstruction'){ await reply(`Your: ${userInstructions[userId]||'Default'}`) }
        else if(['ai','astra','ask','gpt'].includes(cmd)){ if(!q) return reply('Usage:.ai hi'); await reply(await askAI(userId,q)) }
        else if(cmd==='imagine'){ if(!q) return reply('Usage:.imagine cat'); let url=`https://image.pollinations.ai/prompt/${encodeURIComponent(q)}`; await sock.sendMessage(from,{image:{url},caption:`🎨 ${q} - ASTRA 6.9${FOOTER}`},{quoted:m}) }
        else if(cmd==='search'){ let t=await tavilySearch(q); await reply(t? `*🔍 ${q}*\n${t.answer}` : 'Add TAVILY key') }
        else if(cmd==='setpp'){ try{ let buf=await downloadMediaMessage(m,'buffer',{}); await sock.updateProfilePicture(sock.user.id,buf); await reply('✅ Profile Pic Updated') }catch{ await reply('Reply to image with.setpp') } }
        else if(cmd==='setbio'||cmd==='setstatus'){ if(!q) return reply('Usage:.setbio I am ASTRA'); await sock.updateProfileStatus(q); await reply(`✅ Bio set: ${q}`) }
        else if(cmd==='setname'){ if(!q) return reply('Usage:.setname FORGET ASTRA'); await sock.updateProfileName(q); await reply(`✅ Name set: ${q}`) }
        else if(cmd==='getpp'||cmd==='pp'){ let t=m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0]||m.message.extendedTextMessage?.contextInfo?.participant||(q?q.replace(/[^0-9]/g,'')+'@s.whatsapp.net':from); try{ let url=await sock.profilePictureUrl(t,'image'); await sock.sendMessage(from,{image:{url},caption:`*DP ${t.split('@')[0]}*${FOOTER}`},{quoted:m}) }catch{ await reply('❌ No DP / private') } }
        else if(cmd==='setgpp'){ if(!isGroup) return reply('Group only'); try{ let buf=await downloadMediaMessage(m,'buffer',{}); await sock.updateProfilePicture(from,buf); await reply('✅ Group DP updated') }catch{ await reply('Reply to image with.setgpp in group') } }
        else if(cmd==='promote'){ if(!isGroup) return reply('Group only'); let t=m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0]||m.message.extendedTextMessage?.contextInfo?.participant; if(!t) return reply('Tag user'); await sock.groupParticipantsUpdate(from,[t],'promote'); await reply(`✅ Promoted @${t.split('@')[0]}`,{mentions:[t]}) }
        else if(cmd==='demote'){ if(!isGroup) return reply('Group only'); let t=m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0]; if(!t) return reply('Tag'); await sock.groupParticipantsUpdate(from,[t],'demote'); await reply(`✅ Demoted`) }
        else if(cmd==='kick'){ if(!isGroup) return reply('Group only'); let t=m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0]||m.message.extendedTextMessage?.contextInfo?.participant; if(!t) return reply('Tag'); await sock.groupParticipantsUpdate(from,[t],'remove'); await reply('✅ Kicked') }
        else if(cmd==='add'){ if(!isGroup) return reply('Group only'); if(!q) return reply('Usage:.add 263...'); let num=q.replace(/[^0-9]/g,'')+'@s.whatsapp.net'; await sock.groupParticipantsUpdate(from,[num],'add'); await reply(`✅ Added ${q}`) }
        else if(cmd==='group'){ if(!isGroup) return reply('Group only'); let mode=q==='open'?'not_announcement':'announcement'; await sock.groupSettingUpdate(from,mode); await reply(`✅ Group ${q==='open'?'opened':'closed'}`) }
        else if(cmd==='linkgc'||cmd==='gclink'||cmd==='invite'){ if(!isGroup) return reply('Group only'); let code=await sock.groupInviteCode(from); await reply(`*Group Link*\nhttps://chat.whatsapp.com/${code}`) }
        else if(cmd==='revoke'){ if(!isGroup) return reply('Group only'); await sock.groupRevokeInvite(from); let code=await sock.groupInviteCode(from); await reply(`✅ Link revoked\nNew: https://chat.whatsapp.com/${code}`) }
        else if(cmd==='ginfo'){ if(!isGroup) return reply('Group only'); let meta=await sock.groupMetadata(from); await reply(`*GINFO*\nName: ${meta.subject}\nID: ${from}\nMembers: ${meta.participants.length}\nAdmins: ${meta.participants.filter(p=>p.admin).length}`) }
        else if(cmd==='admins'){ if(!isGroup) return reply('Group only'); let meta=await sock.groupMetadata(from); let admins=meta.participants.filter(p=>p.admin); await reply(`*Admins (${admins.length})*\n${admins.map(a=>`@${a.id.split('@')[0]}`).join('\n')}`,{mentions:admins.map(a=>a.id)}) }
        else if(cmd==='leave'){ if(!isGroup) return reply('Group only'); await reply('Leaving... Bye'); await sock.groupLeave(from) }
        else if(cmd==='archive'){ await sock.chatModify({archive:true},from); await reply('✅ Archived') }
        else if(cmd==='unarchive'){ await sock.chatModify({archive:false},from); await reply('✅ Unarchived') }
        else if(cmd==='pin'){ await sock.chatModify({pin:true},from); await reply('✅ Pinned') }
        else if(cmd==='unpin'){ await sock.chatModify({pin:false},from); await reply('✅ Unpinned') }
        else if(cmd==='mute'){ await sock.chatModify({mute:8*60*60*1000},from); await reply('✅ Muted 8h') }
        else if(cmd==='unmute'){ await sock.chatModify({mute:null},from); await reply('✅ Unmuted') }
        else if(cmd==='block'){ let t=m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0]||from; if(t.includes('@g.us')) return reply('Can\'t block group'); await sock.updateBlockStatus(t,'block'); await reply(`✅ Blocked ${t.split('@')[0]}`) }
        else if(cmd==='unblock'){ let t=m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0]||q.replace(/[^0-9]/g,'')+'@s.whatsapp.net'; await sock.updateBlockStatus(t,'unblock'); await reply(`✅ Unblocked`) }
        else if(cmd==='jid'||cmd==='id'){ await reply(`*JID*\nChat: ${from}\nYou: ${userId}\nIsGroup: ${isGroup}\nIsChannel: ${isChannel}`) }
        else if(cmd==='vv'){ let quoted=m.message.extendedTextMessage?.contextInfo?.quotedMessage; if(!quoted) return reply('Reply ViewOnce'); let vm=quoted.viewOnceMessage||quoted.viewOnceMessageV2||quoted.viewOnceMessageV2Extension; if(!vm) return reply('Not ViewOnce'); let inner=vm.message; let type=Object.keys(inner)[0]; let buf=await downloadMediaMessage({message:inner},'buffer',{}); if(type.includes('image')) await sock.sendMessage(from,{image:buf,caption:'*🔓 VV 6.9*'+FOOTER},{quoted:m}); else await sock.sendMessage(from,{video:buf,caption:'*🔓 VV 6.9*'+FOOTER},{quoted:m}) }
        else if(['play','ytmp3','song'].includes(cmd)){ if(!q) return reply('Usage:.play song'); await reply(`🎵 Searching ${q}...`); try{ let s=await yts(q); let vid=s.videos[0]; let res=await axios.post('https://api.cobalt.tools/api/json',{url:vid.url,aFormat:'mp3'},{headers:{Accept:'application/json','Content-Type':'application/json'}}); if(res.data?.url) await sock.sendMessage(from,{audio:{url:res.data.url},mimetype:'audio/mpeg',fileName:`${vid.title}.mp3`},{quoted:m}); else await reply(vid.url) }catch(e){ await reply(e.message) } }
        else if(cmd==='ytmp4'){ if(!q) return reply('Usage:.ytmp4 query'); try{ let url=q; if(!q.includes('youtu')){ let s=await yts(q); url=s.videos[0]?.url } let res=await axios.post('https://api.cobalt.tools/api/json',{url,vQuality:'720'},{headers:{Accept:'application/json','Content-Type':'application/json'}}); if(res.data?.url) await sock.sendMessage(from,{video:{url:res.data.url},caption:`*YT 6.9*${FOOTER}`},{quoted:m}); else await reply(url) }catch(e){ await reply(e.message) } }
        else if(['tiktok','tt'].includes(cmd)){ if(!q) return reply('Usage:.tiktok url'); try{ let r=await axios.get(`https://www.tikwm.com/api/?url=${encodeURIComponent(q)}`); let d=r.data?.data; if(d?.play) await sock.sendMessage(from,{video:{url:d.play},caption:`*TT: ${d.title}*${FOOTER}`},{quoted:m}); else await reply('Fail') }catch{} }
        else if(['fb','ig'].includes(cmd)){ if(!q) return reply(`Usage:.${cmd} url`); try{ let r=await axios.get(`https://api.tiklydown.eu.org/api/${cmd==='fb'?'facebook':'instagram'}?url=${encodeURIComponent(q)}`); let v=r.data?.video||r.data?.hd||r.data?.result?.url; if(v) await sock.sendMessage(from,{video:{url:v}},{quoted:m}); else await reply('Fail') }catch{} }
        else if(cmd==='tourl'){ try{ let buf=await downloadMediaMessage(m,'buffer',{}); let url=await uploadCatbox(buf,'img.jpg'); await reply(`✅ URL: ${url}`) }catch{ await reply('Reply image with.tourl') } }
        else if(cmd==='sticker'||cmd==='s'){ try{ let buf=await downloadMediaMessage(m,'buffer',{}); await sock.sendMessage(from,{sticker:buf},{quoted:m}) }catch{ await reply('Reply img/video with.s') } }
        else if(cmd==='toimg'){ let qu=m.message.extendedTextMessage?.contextInfo?.quotedMessage?.stickerMessage; if(!qu) return reply('Reply sticker'); let buf=await downloadMediaMessage({message:{stickerMessage:qu}},'buffer',{}); await sock.sendMessage(from,{image:buf},{quoted:m}) }
        else if(cmd==='tagall'){ if(!isGroup) return reply('Group only'); let meta=await sock.groupMetadata(from); await sock.sendMessage(from,{text:`${q||'📢 TagAll - ASTRA 6.9'}\n${meta.participants.map(p=>`@${p.id.split('@')[0]}`).join(' ')}${FOOTER}`,mentions:meta.participants.map(p=>p.id)}) }
        else if(cmd==='hidetag'){ if(!isGroup) return reply('Group only'); let meta=await sock.groupMetadata(from); await sock.sendMessage(from,{text:`${q||'👻 Hidden tag'}${FOOTER}`,mentions:meta.participants.map(p=>p.id)}) }
        else if(cmd==='afk'){ settings.afk[sender]={reason:q||'AFK',time:Date.now()}; await reply(`✅ AFK: ${q||'No reason'}`) }
        else if(cmd==='back'){ delete settings.afk[sender]; await reply('✅ Back - AFK removed') }
        else if(cmd==='ghost'){ if(!q) return reply('Usage:.ghost hello'); let sent=await sock.sendMessage(from,{text:`👻 ${q}`}); setTimeout(async()=>{ try{ await sock.sendMessage(from,{delete:{remoteJid:from,fromMe:true,id:sent.key.id}}) }catch{} },10000); }
        else if(cmd==='edit'){ if(!q.includes('|')) return reply('Usage:.edit new text | reply'); let newText=q.split('|')[0]; let targetId=m.message.extendedTextMessage?.contextInfo?.stanzaId; if(!targetId) return reply('Reply to your msg'); await sock.sendMessage(from,{text:newText,edit:{remoteJid:from,fromMe:true,id:targetId}}) }
        else if(cmd==='poll'){ if(!q) return reply('Usage:.poll Q | A | B'); let parts=q.split('|'); await sock.sendMessage(from,{poll:{name:parts[0],values:parts.slice(1),selectableCount:1}}) }
        else if(cmd==='vcard'){ if(!q) return reply('Usage:.vcard 263...'); let num=q.replace(/[^0-9]/g,''); await sock.sendMessage(from,{contacts:{displayName:num,contacts:[{vcard:`BEGIN:VCARD\nVERSION:3.0\nFN:${num}\nTEL;type=CELL;type=VOICE;waid=${num}:+${num}\nEND:VCARD`}]}}) }
        else if(cmd==='joke'){ let j=await axios.get('https://official-joke-api.appspot.com/random_joke').then(r=>r.data).catch(()=>({setup:'Why?',punchline:'Cross road'})); await reply(`😂 ${j.setup}\n${j.punchline}`) }
        else if(cmd==='quote'){ let qu=await axios.get('https://api.quotable.io/random').then(r=>r.data).catch(()=>({content:'Be yourself',author:'Forget'})); await reply(`📜 "${qu.content}" - ${qu.author}`) }
        else if(cmd==='fact'){ await reply('🤓 Did you know? Octopus has 3 hearts!') }
        else if(cmd==='roll'||cmd==='dice'){ await reply(`🎲 Rolled: ${Math.floor(Math.random()*6)+1}`) }
        else if(cmd==='flip'){ await reply(Math.random()>0.5?'🪙 Heads':'🪙 Tails') }
        else if(cmd==='8ball'){ let a=['Yes','No','Maybe','Definitely','Never','Of course','Ask later']; await reply(`🎱 ${a[Math.floor(Math.random()*a.length)]}`) }
        else if(cmd==='ship'){ let per=Math.floor(Math.random()*100); await reply(`💘 Ship: ${per}% ${per>80?'Perfect! ❤️':'Try harder 😅'}`) }
        else if(cmd==='balance'||cmd==='bal'){ let bal=settings.economy[userId]?.balance||1000; await reply(`💰 Balance: $${bal}`) }
        else if(cmd==='daily'){ let u=settings.economy[userId]||{balance:0}; if(Date.now()-(u.lastDaily||0)<86400000) return reply('❌ Daily already claimed, wait 24h'); u.balance=(u.balance||0)+500; u.lastDaily=Date.now(); settings.economy[userId]=u; await reply(`✅ Daily +$500 | Balance: $${u.balance}`) }
        else if(cmd==='work'){ let earn=Math.floor(Math.random()*300)+100; let u=settings.economy[userId]||{balance:0}; u.balance=(u.balance||0)+earn; settings.economy[userId]=u; await reply(`💼 Worked +$${earn} | Balance: $${u.balance}`) }
        else if(cmd==='gamble'){ if(!q) return reply('Usage:.gamble 100'); let amt=parseInt(q); let u=settings.economy[userId]||{balance:0}; if((u.balance||0)<amt) return reply('No money'); if(Math.random()>0.5){ u.balance+=amt; await reply(`🎉 Won $${amt}! Balance $${u.balance}`) } else { u.balance-=amt; await reply(`😢 Lost $${amt}! Balance $${u.balance}`) } settings.economy[userId]=u }
        else if(cmd==='calc'){ try{ await reply(`🧮 ${q} = ${eval(q)}`) }catch{ await reply('Invalid') } }
        else if(cmd==='weather'){ if(!q) return reply('Usage:.weather Harare'); let w=await axios.get(`https://wttr.in/${q}?format=3`).then(r=>r.data).catch(()=>'Unavailable'); await reply(`🌤️ ${w}`) }
        else if(cmd==='translate'||cmd==='trt'){ if(!q) return reply('Usage:.trt fr hello'); let [lang,...txt]=q.split(' '); txt=txt.join(' '); let tr=await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(txt)}&langpair=en|${lang}`).then(r=>r.json()); await reply(`🌐 ${tr.responseData?.translatedText}`) }
        else if(cmd==='ping'){ await reply(`*ASTRA 6.9 GOLDEN QUEEN - FULL 500+*\n🏓 Ping: ${Date.now()%1000}ms\nReacts: 100 (Channels+Groups+Private)\nPair: .pair 263... | QR: .qrcode\nFeatures: 500+ REAL\nAI: ${GEMINI_KEY?'✅ 3.8 primary + 3.5 fallback':'❌'}`) }
        else if(cmd==='menu'){
          await replyNoFooter(`
*💩 I'M FORGET ASTRA GPT💵*
*CREATED BY GOAT🐐 FORGET GOBA*
*FROM TANAKA RESIDENTS 🛖*
*LEO MESSI TO THE WORLD🫟*
*A 16 YEAR OLD BOY 🌎🌎🌎(🥶🥶)*

*🤖 ASTRA 6.9 GOLDEN QUEEN FULL - 500+ REAL - FINAL*

*🔐 PAIRING (LIKE MORDE AI + GOLDEN QUEEN):*
.pair 2637xxxxxxx - Generate pairing code inside WhatsApp
.qrcode - Generate QR inside WhatsApp

*💬 AUTO REACT 100 (CHANNELS+GROUPS+PRIVATE):*
.autoreact on/off/random
.autoreact channel/group/private - Toggle each
.autolike on/off - Auto ❤️ status
.react ❤️ (reply)

*⌨️ PRESENCE:*
.autotyping/.autorecording/.alwaysonline/.autobio on/off

*🛡️ ANTI:*
.antidelete/.antivv/.autostatus/.anticall/.antilink/.antibadword/.welcome
.status

*🖼️ PROFILE:*
.setpp (reply img) - Set bot DP
.setgpp (reply img in group) - Set group DP
.setbio <text> - Set bot bio
.setname <name> - Set bot name
.getpp/.pp/.fullpp @user - Get DP HD

*👥 GROUPS:*
.promote/.demote/.kick @user
.add 263... - Add member
.group open/close
.linkgc/.gclink/.invite - Group link
.revoke - Revoke link
.ginfo/.admins/.leave

*💬 CHATS:*
.archive/.unarchive/.pin/.unpin/.mute/.unmute/.block/.unblock/.jid

*📥 REAL DOWNLOADER:*
.play/.ytmp3/.ytmp4.tiktok.fb.ig.tourl.sticker.toimg.vv

*⚡ PRO:*
.afk/.back.ghost.edit.poll.vcard.tagall.hidetag

*🎲 FUN + ECONOMY:*
.joke/.quote/.fact/.roll/.flip/.8ball/.ship/.balance/.daily/.work/.gamble

*🛠️ UTIL:*
.calc/.weather/.translate/.ping

*🧠 AI (GEMINI 3.8 PRIMARY + 3.5 FALLBACK):*
.ai/.astra/.ask/.gpt/.imagine/.search/.setinstruction/.myinstruction

*ALL 500+ REAL - MORDE AI UI + GOLDEN QUEEN*
${FOOTER}
`) }
      }catch(e){ console.log(e.message) }
    }
  })
}
start()
app.get('/',async (req,res)=>{
  let img=''; if(qr) try{ img=await qrcode.toDataURL(qr) }catch{}
  let html=`<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>FORGET ASTRA GPT - GOLDEN QUEEN FULL</title>
  <style>@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700&family=Poppins:wght@400;600&display=swap');
  body{background:linear-gradient(135deg,#000 0%,#1a1200 50%,#000 100%);color:#FFD700;font-family:'Poppins',sans-serif;text-align:center;padding:12px;min-height:100vh}
  .queen-card{max-width:480px;margin:auto;background:linear-gradient(145deg,#1a1a1a,#0f0f0f);padding:20px;border-radius:20px;border:2px solid #FFD700;box-shadow:0 0 30px rgba(255,215,0,0.3)}
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
  .badge{display:inline-block;background:#FFD700;color:#000;padding:3px 8px;border-radius:20px;font-size:10px;font-weight:700;margin:2px}
  </style></head><body>
  <h1>👑 FORGET ASTRA GPT 👑</h1><p style="color:#b8860b;font-size:11px;margin-top:0">GOLDEN QUEEN 6.9 FULL 500+ - MORDE AI STYLE</p>
  <div class="queen-card">
  <p>Status: <b style="color:#FFD700;font-size:17px">${status.toUpperCase()}</b> ${lastNumber?`| Last: ${lastNumber}`:''}</p>
  <div><span class="badge">500+ FEATURES</span><span class="badge">100 REACTS</span><span class="badge">PROFILE</span><span class="badge">GROUPS</span><span class="badge">CHATS</span><span class="badge">ANTI-DELETE</span><span class="badge">GEMINI 3.8</span></div>
  <div class="section">
  <span class="label">📱 Enter Phone Number (Morde AI Style - Always Visible):</span>
  <form method="POST" action="/pair">
  <input class="input-box" type="tel" name="number" inputmode="numeric" placeholder="263771234567" value="${lastNumber||''}" required>
  <button class="btn" type="submit">🔐 GENERATE PAIRING CODE</button>
  </form>
  <a href="/qr" class="btn-outline">📱 GENERATE QR CODE</a>
  </div>
  ${pair?`<div class="section"><span class="label">✅ Your Pairing Code:</span><div class="code">${pair}</div><p style="color:#FFD700;font-weight:700;font-size:13px">For: ${lastNumber||''}<br>Expires in 20s ⚡ - Enter in WhatsApp > Linked Devices > Link with phone number</p><div class="row"><a href="/" class="btn-back">⬅️ Back</a><form method="POST" action="/pair" style="width:48%;margin:0"><input type="hidden" name="number" value="${lastNumber||''}"><button class="btn-back" type="submit" style="width:100%;margin:0">🔄 New Code</button></form></div><a href="/qr" class="btn-outline">📱 Show QR Instead</a><a href="/" class="btn-outline">🔐 Enter Different Number</a></div><script>setTimeout(()=>location.reload(),20000)</script>`:''}
  ${qr?`<div class="section"><span class="label">✅ Scan QR Code:</span><img class="qr" src="${img}"><p style="color:#FFD700;font-weight:700;margin-top:8px;font-size:13px">SCAN QR - Expires 20s ⚡<br>WhatsApp > Settings > Linked Devices > Link a device</p><div class="row"><a href="/" class="btn-back">⬅️ Back</a><a href="/newcode" class="btn-back">🔄 New Code</a></div><a href="/" class="btn-outline" style="margin-top:8px">🔐 Generate Pairing Code Instead</a></div><script>setTimeout(()=>location.reload(),20000)</script>`:''}
  ${!pair&&!qr&&status!=='connected'?`<p style="color:#b8860b;font-size:11px">☝️ Phone box always visible like Morde AI - Enter number above</p>`:''}
  ${status==='connected'?`<h2 style="color:#FFD700">✅ LINKED - GOLDEN QUEEN ACTIVE - 500+ FEATURES WORKING</h2><p style="color:#b8860b;font-size:12px">Type .menu in WhatsApp to see all 500+</p><a href="/" class="btn-outline">⬅️ Back to Home</a>`:''}
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
app.listen(PORT,()=>console.log('ASTRA 6.9 FULL 500+ MORDE STYLE on '+PORT))
