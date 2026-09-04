const firebaseConfig = {
  apiKey: "AIzaSyD3ENYHqV1eFLPUMAc6HnusYG7-6S-iyqg",
  authDomain: "proyectouno-84196.firebaseapp.com",
  databaseURL: "https://proyectouno-84196-default-rtdb.firebaseio.com",
  projectId: "proyectouno-84196",
  storageBucket: "proyectouno-84196.firebasestorage.app",
  messagingSenderId: "926454626159",
  appId: "1:926454626159:web:f1cfb4836a810ac1a91a9a"
};
let db = null;
let isFirebaseConnected = false;
let auth = null;
let firebaseReadyPromise = Promise.resolve();
try {
  if (typeof firebase !== 'undefined') {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    db = firebase.database();
    auth = typeof firebase.auth === 'function' ? firebase.auth() : null;
    firebaseReadyPromise = auth ? auth.signInAnonymously().then(() => { isFirebaseConnected = true; updateFirebaseStatus(); if (document.readyState !== 'loading') initHistory(); }).catch(error => { console.warn('Autenticación anónima no disponible:', error); isFirebaseConnected = !!db; updateFirebaseStatus(); if (document.readyState !== 'loading') initHistory(); }) : Promise.resolve(isFirebaseConnected = !!db);
  }
} catch (e) {
  console.warn(
    "Modo local activo.",
    e
  );
}
let myPlayerId =
  'p_' +
  Math.random()
    .toString(36)
    .substr(2, 9);
let myPlayerName = '';
let selectedAvatarUrl =
  './assets/foto1.jpeg';
let selectedSkill =
  'Escudo Táctico';
const MAX_SKILL_USES = 3;
let currentRoomCode = null;
let roomRef = null;
let chatRef = null;
let currentGameState = null;
let knownPlayers = {};
let llamaClicks = 0;
let loroClicks = 0;
const LORO_REQUIRED_CLICKS = 5;
const LLAMA_REQUIRED_CLICKS = 6;
const HAND_HELP_THRESHOLD = 15;
let chatListeningAt = Date.now();
let chatUnread = 0;
let historyInitialized = false;
let chatPriming = true;
let turnTimer = null;
let timeLeft = 10;
let pendingWildCard = null;
let localStream = null;
let isMicOn = false;
let peerConnections = {};
let pendingIceCandidates = {};
const rtcConfig = {
  iceServers: [
    {
      urls:
        'stun:stun.l.google.com:19302'
    }
  ]
};
const COLORS = [
  'rojo',
  'azul',
  'verde',
  'amarillo'
];
function updateFirebaseStatus(){const dot=document.getElementById('firebase-status-dot');const text=document.getElementById('firebase-status-text');if(dot)dot.classList.toggle('online',isFirebaseConnected);if(text)text.innerText=isFirebaseConnected?'Servidor conectado':'Servidor no autenticado / modo local';}
const VALUES = [
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '+2',
  '+4',
  '🚫',
  '🔄'
];
window.addEventListener(
  'beforeunload',
  () => {
    if (
      currentRoomCode &&
      myPlayerName &&
      isFirebaseConnected &&
      db
    ) {
      db.ref(
        `chats/${currentRoomCode}`
      ).push({
        sender: 'SISTEMA',
        text:
          `${myPlayerName} abandonó la partida.`
      });
      db.ref(
        `rooms/${currentRoomCode}/players/${myPlayerId}`
      ).remove();
    }
  }
);
function showToastNotification(message) {
  const toast =
    document.getElementById(
      'system-notification'
    );
  const msgEl =
    document.getElementById(
      'toast-message'
    );
  if (!toast || !msgEl) {
    return;
  }
  msgEl.innerText = message;
  toast.classList.remove(
    'hidden'
  );
  setTimeout(
    () => {
      toast.classList.add(
        'hidden'
      );
    },
    4000
  );
}
function initHistory() {
  if (historyInitialized) return;
  if (
    !isFirebaseConnected ||
    !db
  ) {
    return;
  }
  historyInitialized = true;
  db.ref(
    'history/winners'
  ).on(
    'value',
    snapshot => {
      const list =
        document.getElementById(
          'winners-history-list'
        );
      if (!list) {
        return;
      }
      list.innerHTML = '';
      if (snapshot.exists()) {
        Object.values(
          snapshot.val()
        )
          .reverse()
          .forEach(item => {
            list.innerHTML += `
              <li>
                🏆
                <b>${item.name}</b>
                <span> [${item.date}]</span>
              </li>
            `;
          });
      } else {
        list.innerHTML = `
          <li>
            Sin campeones registrados aún.
          </li>
        `;
      }
    }
  );
  db.ref(
    'history/players'
  ).on(
    'value',
    snapshot => {
      const list =
        document.getElementById(
          'all-players-history-list'
        );
      if (!list) {
        return;
      }
      list.innerHTML = '';
      if (snapshot.exists()) {
        Object.values(
          snapshot.val()
        )
          .reverse()
          .forEach(item => {
            list.innerHTML += `
              <li class="history-player-item"><img src="${item.avatar||'./assets/foto1.jpeg'}" alt=""><span>👤 <b>${item.name}</b><small>${item.skill||''} ${item.date?'· '+item.date:''}</small></span></li>
            `;
          });
      } else {
        list.innerHTML = `
          <li>
            Sin jugadores registrados.
          </li>
        `;
      }
    }
  );
}
document.addEventListener(
  'DOMContentLoaded',
  () => {
    initHistory();
    loadLocalProfile();
    updateSkillDisplay();
    updateFirebaseStatus();
  }
);
function selectAvatar(
  element,
  url,
  skillName,
  skillDesc
) {
  document
    .querySelectorAll('.avatar-card')
    .forEach(
      el =>
        el.classList.remove(
          'selected'
        )
    );
  element.classList.add(
    'selected'
  );
  selectedAvatarUrl = url;
  selectedSkill = skillName;
  const description =
    document.getElementById(
      'skill-description'
    );
  if (description) {
    description.innerHTML =
      '<b>Habilidad:</b> ' +
      skillDesc;
  }
  updateSkillDisplay();
}
function showScreen(screenId) {
  document
    .querySelectorAll('.screen')
    .forEach(
      screen =>
        screen.classList.remove(
          'active'
        )
    );
  document
    .getElementById(screenId)
    ?.classList.add(
      'active'
    );
  const petsLayer =
    document.getElementById(
      'pets-roaming-layer'
    );
  if (!petsLayer) {
    return;
  }
  if (screenId === 'screen-game') {
    petsLayer.classList.remove(
      'pets-hidden'
    );
    initRoamingPets();
  } else {
    petsLayer.classList.add(
      'pets-hidden'
    );
  }
}
function getPlayerName() {
  const input=document.getElementById('player-name-input');
  if(!input)return null;
  const value=input.value.trim();
  if(!value){
    alert('Por favor, ingresa tu apodo de jugador.');
    return null;
  }
  myPlayerName=value;
  saveLocalProfile();
  const nameDisplay=document.getElementById('my-name-display');
  const avatarDisplay=document.getElementById('my-avatar-display');
  const skillDisplay=document.getElementById('my-skill-display');
  if(nameDisplay)nameDisplay.innerText=myPlayerName;
  if(avatarDisplay)avatarDisplay.src=selectedAvatarUrl;
  if(skillDisplay)skillDisplay.innerText=selectedSkill;
  return myPlayerName;
}

function saveLocalProfile(){
  try{
    localStorage.setItem('unoProfile',JSON.stringify({name:myPlayerName,avatar:selectedAvatarUrl,skill:selectedSkill}));
  }catch(error){console.warn('No se pudo guardar el perfil local:',error);}
}

function loadLocalProfile(){
  try{
    const saved=JSON.parse(localStorage.getItem('unoProfile')||'null');
    if(!saved)return;
    const input=document.getElementById('player-name-input');
    if(input&&saved.name)input.value=saved.name;
    if(saved.avatar)selectedAvatarUrl=saved.avatar;
    if(saved.skill)selectedSkill=saved.skill;
    const preview=document.getElementById('profile-photo-preview');
    if(preview)preview.src=selectedAvatarUrl;
  }catch(error){console.warn('No se pudo cargar el perfil:',error);}
}

async function handleProfilePhotoUpload(event){
  const file=event.target.files?.[0];
  if(!file||!file.type.startsWith('image/'))return;
  try{
    const dataUrl=await resizeProfileImage(file,180,180);
    selectedAvatarUrl=dataUrl;
    const preview=document.getElementById('profile-photo-preview');
    if(preview)preview.src=dataUrl;
    document.querySelectorAll('.avatar-card').forEach(el=>el.classList.remove('selected'));
    saveLocalProfile();
    const avatarDisplay=document.getElementById('my-avatar-display');
    if(avatarDisplay)avatarDisplay.src=dataUrl;
    showToastNotification('📸 Foto de perfil guardada.');
  }catch(error){
    console.error(error);
    alert('No se pudo cargar la foto.');
  }
}

function resizeProfileImage(file,maxWidth,maxHeight){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>{
      const img=new Image();
      img.onload=()=>{
        const scale=Math.min(maxWidth/img.width,maxHeight/img.height,1);
        const canvas=document.createElement('canvas');
        canvas.width=Math.max(1,Math.round(img.width*scale));
        canvas.height=Math.max(1,Math.round(img.height*scale));
        const ctx=canvas.getContext('2d');
        ctx.drawImage(img,0,0,canvas.width,canvas.height);
        resolve(canvas.toDataURL('image/jpeg',.82));
      };
      img.onerror=reject;
      img.src=reader.result;
    };
    reader.onerror=reject;
    reader.readAsDataURL(file);
  });
}

function savePlayerProfileHistory(){
  if(!isFirebaseConnected||!db||!myPlayerName)return;
  db.ref('history/players').push({name:myPlayerName,skill:selectedSkill,avatar:selectedAvatarUrl,date:new Date().toLocaleDateString()});
}

function generateDeck() {
  let deck = [];
  COLORS.forEach(
    color => {
      VALUES.forEach(
        value => {
          deck.push({
            color,
            value,
            id:
              Math.random()
                .toString(36)
                .substr(2, 9)
          });
        }
      );
    }
  );
  deck.push({
    color: 'negro',
    value: '+4',
    id:
      Math.random()
        .toString(36)
        .substr(2, 9)
  });
  deck.push({
    color: 'negro',
    value: 'CAMBIO',
    id:
      Math.random()
        .toString(36)
        .substr(2, 9)
  });
  return deck.sort(
    () => Math.random() - .5
  );
}
function generateRoomCode() {
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code='';
  for(let i=0;i<6;i++)code+=chars[Math.floor(Math.random()*chars.length)];
  return code;
}
function attachPlayerDisconnect(){
  if(roomRef&&myPlayerId)roomRef.child(`players/${myPlayerId}`).onDisconnect().remove().catch(()=>{});
}
function createRoom(){
  if(!getPlayerName())return;
  if(!isFirebaseConnected&&db){firebaseReadyPromise.then(()=>createRoom()).catch(()=>{});return;}
  const code=generateRoomCode();
  currentRoomCode=code;
  const initialData={code,roomId:code,host:myPlayerId,status:'waiting',stack:0,activeColor:'rojo',currentTurnIndex:0,turnOrder:[myPlayerId],topCard:null,deck:generateDeck(),winnerName:null,players:{[myPlayerId]:{id:myPlayerId,name:myPlayerName,avatar:selectedAvatarUrl,skill:selectedSkill,hand:[],isHost:true,skillUses:MAX_SKILL_USES}}};
  const finish=()=>{attachPlayerDisconnect();listenToRoom();listenToChat();initVoiceSignaling();savePlayerProfileHistory();showScreen('screen-lobby');showToastNotification(`🎮 Sala ${code} creada.`);};
  if(isFirebaseConnected&&db){roomRef=db.ref(`rooms/${code}`);roomRef.set(initialData).then(()=>db.ref(`roomCodes/${code}`).set(code)).then(finish).catch(error=>{console.error(error);alert(`No se pudo crear la sala. Firebase respondió: ${error.message||error.code||'error desconocido'}`);});}
  else{currentGameState=initialData;updateUI();showScreen('screen-lobby');}
}
function resolveRoomCode(code){
  return db.ref(`rooms/${code}`).once('value').then(snapshot=>{if(snapshot.exists())return{key:code,data:snapshot.val()};return db.ref(`roomCodes/${code}`).once('value').then(alias=>{const key=alias.val();if(!key)return null;return db.ref(`rooms/${key}`).once('value').then(room=>room.exists()?{key,data:room.val()}:null);});});
}
function joinRoom(){
  if(!getPlayerName())return;
  const input=document.getElementById('room-code-input');
  const code=input?.value.trim().toUpperCase();
  if(!/^[A-Z0-9]{6}$/.test(code||'')){alert('Ingresa un código de 6 caracteres.');return;}
  const join=()=>resolveRoomCode(code).then(result=>{
    if(!result)throw new Error('La sala ingresada no existe.');
    const players=result.data.players||{};
    if(Object.keys(players).length>=4)throw new Error('La sala ya está llena.');
    currentRoomCode=result.key;roomRef=db.ref(`rooms/${result.key}`);
    return roomRef.child(`players/${myPlayerId}`).set({id:myPlayerId,name:myPlayerName,avatar:selectedAvatarUrl,skill:selectedSkill,hand:[],isHost:false,skillUses:MAX_SKILL_USES}).then(()=>{attachPlayerDisconnect();listenToRoom();listenToChat();initVoiceSignaling();savePlayerProfileHistory();showScreen('screen-lobby');});
  }).catch(error=>{console.error(error);alert(error.message||'No se pudo entrar a la sala.');});
  if(isFirebaseConnected&&db)firebaseReadyPromise.then(join);else alert('Firebase no está conectado.');
}
function ensureHost(){
  if(!roomRef||!currentGameState?.players)return;
  const players=currentGameState.players;const ids=Object.keys(players).filter(id=>players[id]);
  if(!ids.length)return;if(currentGameState.host&&players[currentGameState.host])return;
  const newHost=ids.sort()[0];
  roomRef.child('host').transaction(current=>current&&players[current]?undefined:newHost).then(result=>{if(result.committed&&result.snapshot.val()===newHost){const updates={};ids.forEach(id=>updates[`players/${id}/isHost`]=id===newHost);return roomRef.update(updates);}}).catch(error=>console.warn('No se pudo transferir el anfitrión:',error));
}
function listenToRoom(){
  const codeDisplay=document.getElementById('lobby-code-display');if(codeDisplay)codeDisplay.innerText=currentGameState?.code||currentRoomCode;if(!roomRef)return;
  roomRef.off('value');
  roomRef.on('value',snapshot=>{
    if(!snapshot.exists()){showScreen('screen-setup');showToastNotification('⚠️ La sala ya no existe.');return;}
    currentGameState=snapshot.val();const activePlayers=currentGameState.players||{};
    Object.keys(knownPlayers).forEach(playerId=>{if(!activePlayers[playerId])showToastNotification(`${knownPlayers[playerId]} abandonó la partida`);});
    knownPlayers={};Object.values(activePlayers).forEach(player=>knownPlayers[player.id]=player.name);attachPlayerDisconnect();ensureHost();updateUI();
  });
}
function copyRoomCode(){
  const code=currentGameState?.code||currentRoomCode;if(!code)return;
  const done=()=>showToastNotification(`📋 Código ${code} copiado.`);
  if(navigator.clipboard?.writeText)navigator.clipboard.writeText(code).then(done).catch(()=>fallbackCopy(code));else fallbackCopy(code);
}
function fallbackCopy(code){const temp=document.createElement('textarea');temp.value=code;document.body.appendChild(temp);temp.select();try{document.execCommand('copy');}catch(e){}temp.remove();showToastNotification(`📋 Código ${code} copiado.`);}
function changeRoomCode(){
  if(!currentGameState||currentGameState.host!==myPlayerId||!roomRef)return;
  const current=currentGameState.code||currentRoomCode;const next=prompt('Personaliza el nuevo código de la sala (6 caracteres):',current);if(next===null)return;
  const clean=next.trim().toUpperCase();if(!/^[A-Z0-9]{6}$/.test(clean)){alert('El código debe tener exactamente 6 caracteres.');return;}if(clean===current)return;
  db.ref(`rooms/${clean}`).once('value').then(snapshot=>{if(snapshot.exists())throw new Error('Ese código ya está ocupado.');return db.ref(`roomCodes/${clean}`).set(currentRoomCode).then(()=>roomRef.child('code').set(clean));}).then(()=>{showToastNotification(`✏️ Código cambiado a ${clean}. Nadie sale de la partida.`);updateUI();}).catch(error=>alert(error.message||'No se pudo cambiar el código.'));
}
function leaveRoom(){if(roomRef&&myPlayerId)roomRef.child(`players/${myPlayerId}`).remove().catch(()=>{});if(chatRef)chatRef.off();roomRef=null;chatRef=null;currentRoomCode=null;currentGameState=null;knownPlayers={};resetPetCounters();showScreen('screen-setup');}
function returnToSetup(){leaveRoom();}
function updateChatBadge(){const badge=document.getElementById('chat-unread-badge');if(badge){badge.innerText=chatUnread>9?'9+':chatUnread;badge.classList.toggle('hidden',chatUnread===0);}}
function toggleChatBubble(){const activeScreen=document.querySelector('.screen.active');const panel=activeScreen?.querySelector('.lobby-chat,.compact-chat');if(!panel)return;panel.classList.toggle('chat-open');if(panel.classList.contains('chat-open')){chatUnread=0;updateChatBadge();(panel.querySelector('input')||document.getElementById('l4d-chat-input'))?.focus();}}
function notifyIncomingChat(msgData){if(!msgData||msgData.sender===myPlayerName||msgData.sender==='SISTEMA')return;chatUnread++;updateChatBadge();showToastNotification(`💬 ${msgData.sender}: ${msgData.text}`);}
function listenToChat(){if(!currentRoomCode||!isFirebaseConnected||!db)return;if(chatRef)chatRef.off();chatListeningAt=Date.now();chatPriming=true;chatRef=db.ref(`chats/${currentRoomCode}`);chatRef.on('child_added',snapshot=>{const msgData=snapshot.val()||{};renderL4DMessage(msgData);renderLobbyMessage(msgData);if(!chatPriming&&msgData.sender!==myPlayerName)notifyIncomingChat(msgData);if(msgData.sender==='SISTEMA'&&msgData.text?.includes('abandonó'))showToastNotification(msgData.text);});chatRef.once('value').then(()=>{setTimeout(()=>chatPriming=false,150);});}
function pushChatMessage(text){if(!text||!currentRoomCode)return;const data={sender:myPlayerName,text,createdAt:firebase.database.ServerValue.TIMESTAMP};if(isFirebaseConnected&&db)db.ref(`chats/${currentRoomCode}`).push(data);else{renderL4DMessage(data);renderLobbyMessage(data);}}
function handleLobbyChatKey(event){if(event.key!=='Enter')return;const input=document.getElementById('lobby-chat-input');const text=input?.value.trim();if(!text)return;pushChatMessage(text);input.value='';}
function renderLobbyMessage(msgData){const container=document.getElementById('lobby-chat-messages');if(!container)return;const msgEl=document.createElement('div');msgEl.className='chat-msg';msgEl.innerHTML=`<b>${escapeHtml(msgData.sender||'Jugador')}:</b> ${escapeHtml(msgData.text||'')}`;container.appendChild(msgEl);container.scrollTop=container.scrollHeight;}
function handleChatKey(event){if(event.key!=='Enter')return;const input=document.getElementById('l4d-chat-input');const text=input?.value.trim();if(!text)return;pushChatMessage(text);input.value='';}
function renderL4DMessage(msgData){const container=document.getElementById('l4d-chat-messages');if(!container)return;const msgEl=document.createElement('div');msgEl.className='chat-msg';msgEl.innerHTML=`<b>${escapeHtml(msgData.sender||'Jugador')}:</b> ${escapeHtml(msgData.text||'')}`;container.appendChild(msgEl);container.scrollTop=container.scrollHeight;}
function escapeHtml(value){return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));}
async function toggleMicrophone() {
  const btn=document.getElementById('btn-mic-toggle');
  const text=document.getElementById('mic-status-text');
  if(!btn||!text)return;
  if(!isMicOn){
    try{
      if(!navigator.mediaDevices?.getUserMedia)throw new Error('getUserMedia no disponible');
      localStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
      isMicOn=true;
      localStream.getAudioTracks().forEach(track=>track.enabled=true);
      btn.className='mic-chat-btn btn-mic-on';
      text.innerText='On';
      Object.keys(peerConnections).forEach(playerId=>{
        const pc=peerConnections[playerId];
        if(!pc)return;
        const sender=pc.getSenders().find(s=>s.track?.kind==='audio');
        if(sender){
          sender.replaceTrack(localStream.getAudioTracks()[0]);
        }else{
          pc.addTrack(localStream.getAudioTracks()[0],localStream);
        }
      });
      await renegotiateAllPeers();
      showToastNotification('🎤 Micrófono activado.');
    }catch(err){
      console.error(err);
      isMicOn=false;
      localStream=null;
      alert('No se pudo activar el micrófono. Revisa los permisos del navegador y usa HTTPS o localhost.');
    }
  }else{
    if(localStream)localStream.getAudioTracks().forEach(track=>track.enabled=false);
    isMicOn=false;
    btn.className='mic-chat-btn btn-mic-off';
    text.innerText='Off';
    showToastNotification('🎤 Micrófono desactivado.');
  }
}

function initVoiceSignaling(){
  if(!isFirebaseConnected||!db||!currentRoomCode)return;
  const signalRef=db.ref(`signals/${currentRoomCode}/${myPlayerId}`);
  signalRef.off();
  signalRef.on('child_added',async snapshot=>{
    const data=snapshot.val();
    if(!data||!data.from||data.from===myPlayerId)return;
    const fromId=data.from;
    const pc=peerConnections[fromId]||createPeerConnection(fromId);
    try{
      if(data.offer){
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        await flushPendingIce(fromId);
        const answer=await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await db.ref(`signals/${currentRoomCode}/${fromId}`).push({from:myPlayerId,answer:pc.localDescription.toJSON()});
      }else if(data.answer){
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        await flushPendingIce(fromId);
      }else if(data.candidate){
        if(pc.remoteDescription?.type){
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        }else{
          pendingIceCandidates[fromId]=(pendingIceCandidates[fromId]||[]).concat(data.candidate);
        }
      }
    }catch(error){
      console.warn('Error WebRTC:',error);
    }
  });
  setupVoicePeers();
}

function setupVoicePeers(){
  if(!currentGameState?.players)return;
  Object.values(currentGameState.players).forEach(player=>{
    if(player.id!==myPlayerId)createPeerConnection(player.id);
  });
}

function createPeerConnection(targetPlayerId){
  if(peerConnections[targetPlayerId])return peerConnections[targetPlayerId];
  const pc=new RTCPeerConnection(rtcConfig);
  peerConnections[targetPlayerId]=pc;
  pendingIceCandidates[targetPlayerId]=pendingIceCandidates[targetPlayerId]||[];
  if(localStream){
    localStream.getAudioTracks().forEach(track=>{
      if(!pc.getSenders().some(sender=>sender.track?.id===track.id))pc.addTrack(track,localStream);
    });
  }
  pc.onicecandidate=event=>{
    if(event.candidate&&db&&currentRoomCode){
      db.ref(`signals/${currentRoomCode}/${targetPlayerId}`).push({from:myPlayerId,candidate:event.candidate.toJSON()});
    }
  };
  pc.ontrack=event=>{
    const stream=event.streams[0];
    if(!stream)return;
    let audio=document.getElementById(`audio_${targetPlayerId}`);
    if(!audio){
      audio=document.createElement('audio');
      audio.id=`audio_${targetPlayerId}`;
      audio.autoplay=true;
      audio.playsInline=true;
      audio.controls=false;
      audio.volume=1;
      document.body.appendChild(audio);
    }
    audio.srcObject=stream;
    audio.muted=false;
    audio.play().catch(()=>showToastNotification('🔊 Haz clic en la página para activar el audio del chat de voz.'));
  };
  pc.onconnectionstatechange=()=>{
    if(['failed','closed'].includes(pc.connectionState)){
      pc.close();
      delete peerConnections[targetPlayerId];
    }
  };
  pc.onnegotiationneeded=async()=>{
    if(!db||!currentRoomCode||pc.signalingState!=='stable'||pc.makingOffer)return;
    try{
      pc.makingOffer=true;
      const offer=await pc.createOffer();
      if(pc.signalingState!=='stable')return;
      await pc.setLocalDescription(offer);
      await db.ref(`signals/${currentRoomCode}/${targetPlayerId}`).push({from:myPlayerId,offer:pc.localDescription.toJSON()});
    }catch(error){
      console.warn('No se pudo negociar la voz:',error);
    }finally{
      pc.makingOffer=false;
    }
  };
  if(myPlayerId<targetPlayerId)queueMicrotask(()=>renegotiatePeer(targetPlayerId));
  return pc;
}

async function renegotiatePeer(targetPlayerId){
  const pc=peerConnections[targetPlayerId];
  if(!pc||!db||!currentRoomCode||pc.signalingState!=='stable'||pc.makingOffer)return;
  try{
    pc.makingOffer=true;
    const offer=await pc.createOffer();
    await pc.setLocalDescription(offer);
    await db.ref(`signals/${currentRoomCode}/${targetPlayerId}`).push({from:myPlayerId,offer:pc.localDescription.toJSON()});
  }catch(error){
    console.warn('No se pudo iniciar la conexión de voz:',error);
  }finally{
    pc.makingOffer=false;
  }
}

async function renegotiateAllPeers(){
  for(const playerId of Object.keys(peerConnections)){
    await renegotiatePeer(playerId);
  }
}

async function flushPendingIce(playerId){
  const pc=peerConnections[playerId];
  const pending=pendingIceCandidates[playerId]||[];
  if(!pc?.remoteDescription?.type||!pending.length)return;
  for(const candidate of pending){
    try{await pc.addIceCandidate(new RTCIceCandidate(candidate));}catch(error){console.warn('ICE pendiente rechazado:',error);}
  }
  pendingIceCandidates[playerId]=[];
}

function startGame() {
  if (!currentGameState || currentGameState.host !== myPlayerId) return;
  if (!currentGameState) {
    return;
  }
  const playerKeys =
    Object.keys(
      currentGameState.players ||
      {}
    );
  if (playerKeys.length < 1) {
    return;
  }
  let deck =
    generateDeck();
  let players = {
    ...currentGameState.players
  };
  playerKeys.forEach(
    playerId => {
      players[playerId].hand =
        deck.splice(
          0,
          7
        );
      players[playerId].skillUses =
        MAX_SKILL_USES;
    }
  );
  let topCard =
    deck.pop();
  while (
    topCard &&
    topCard.color === 'negro'
  ) {
    deck.unshift(
      topCard
    );
    topCard =
      deck.pop();
  }
  const updatedState = {
    ...currentGameState,
    status:
      'playing',
    deck,
    players,
    topCard,
    activeColor:
      topCard.color,
    turnOrder:
      playerKeys,
    currentTurnIndex:
      0,
    stack:
      0,
    winnerName:
      null
  };
  if (roomRef) {
    roomRef.update(
      updatedState
    );
  } else {
    currentGameState =
      updatedState;
    updateUI();
  }
  resetPetCounters();
}
function updateUI() {
  if (!currentGameState) {
    return;
  }
  if (
    currentGameState.status ===
    'waiting'
  ) {
    showScreen(
      'screen-lobby'
    );
    const playersArr =
      Object.values(
        currentGameState.players ||
        {}
      );
    const count =
      document.getElementById(
        'player-count'
      );
    if (count) {
      count.innerText =
        playersArr.length;
    }
    const lobby =
      document.getElementById(
        'lobby-players-list'
      );
    if (lobby) {
      lobby.innerHTML =
        playersArr
          .map(
            player => `
              <div class="lobby-player-card">
                <img
                  src="${player.avatar}"
                  class="lobby-player-avatar"
                  alt="${player.name}"
                >
                <div
                  class="text-center"
                  style="width:100%;"
                >
                  <div
                    class="lobby-player-name"
                  >
                    ${player.name}
                  </div>
                  <div
                    class="lobby-player-skill"
                  >
                    ${player.skill}
                  </div>
                </div>
              </div>
            `
          )
          .join('');
    }
    const isHost =
      currentGameState.host ===
      myPlayerId;
    const startButton =
      document.getElementById(
        'btn-start-game'
      );
    const waiting =
      document.getElementById(
        'waiting-msg-container'
      );
    if (startButton) {
      startButton.style.display =
        isHost
          ? 'flex'
          : 'none';
    }
    if (waiting) {
      waiting.style.display =
        isHost
          ? 'none'
          : 'flex';
    }
  }
  else if (
    currentGameState.status ===
    'playing'
  ) {
    showScreen(
      'screen-game'
    );
    document
      .getElementById(
        'winner-modal'
      )
      ?.classList.add(
        'hidden'
      );
    renderGameBoard();
    startTurnTimer();
  }
  else if (
    currentGameState.status ===
    'finished'
  ) {
    const winner =
      document.getElementById(
        'winner-name-display'
      );
    if (winner) {
      winner.innerText =
        currentGameState.winnerName ||
        'Ganador Desconocido';
    }
    document
      .getElementById(
        'winner-modal'
      )
      ?.classList.remove(
        'hidden'
      );
    clearInterval(
      turnTimer
    );
  }
}
function startTurnTimer() {
  clearInterval(
    turnTimer
  );
  timeLeft = 10;
  const timerDisplay =
    document.getElementById(
      'timer-display'
    );
  if (timerDisplay) {
    timerDisplay.innerText =
      timeLeft;
  }
  const turnPlayerId =
    currentGameState
      ?.turnOrder
      ? currentGameState.turnOrder[
          currentGameState.currentTurnIndex
        ]
      : null;
  turnTimer =
    setInterval(
      () => {
        timeLeft--;
        if (timerDisplay) {
          timerDisplay.innerText =
            timeLeft;
        }
        if (
          timeLeft <= 0
        ) {
          clearInterval(
            turnTimer
          );
          if (
            turnPlayerId ===
            myPlayerId
          ) {
            drawCardCurrentPlayer();
          }
        }
      },
      1000
    );
}
function renderGameBoard() {
  if (
    !currentGameState ||
    !currentGameState.turnOrder
  ) {
    return;
  }
  const turnPlayerId =
    currentGameState
      .turnOrder[
        currentGameState.currentTurnIndex
      ];
  const isMyTurn =
    turnPlayerId ===
    myPlayerId;
  const turnDisplay =
    document.getElementById(
      'turn-display'
    );
  if (turnDisplay) {
    turnDisplay.innerText =
      isMyTurn
        ? '¡TU TURNO!'
        : (
          currentGameState
            .players[
              turnPlayerId
            ]?.name ||
          '---'
        );
  }
  const activeColor =
    currentGameState.activeColor ||
    'rojo';
  const colorIndicator =
    document.getElementById(
      'active-color-indicator'
    );
  if (colorIndicator) {
    colorIndicator.className =
      'color-badge c-' +
      activeColor;
  }
  const colorText =
    document.getElementById(
      'active-color-text'
    );
  if (colorText) {
    colorText.innerText =
      capitalize(
        activeColor
      );
  }
  const stack =
    currentGameState.stack ||
    0;
  updateText(
    'stack-display',
    '+' + stack
  );
  updateText(
    'match-stack-count',
    '+' + stack
  );
  const topCardSpot =
    document.getElementById(
      'top-card'
    );
  if (
    topCardSpot &&
    currentGameState.topCard
  ) {
    const card =
      currentGameState.topCard;
    topCardSpot.className =
      `uno-card c-${card.color}`;
    topCardSpot.innerHTML = `
      <span class="card-corner">
        ${card.value}
      </span>
      <div class="card-inner">
        ${card.value}
      </div>
    `;
  }
  renderOpponentsQuadrant(
    turnPlayerId
  );
  renderMyHand(
    isMyTurn
  );
  const relief=document.getElementById('hand-relief-btn');
  if(relief)relief.classList.toggle('hidden',!isMyTurn||((currentGameState.players?.[myPlayerId]?.hand||[]).length<HAND_HELP_THRESHOLD));
  updateSkillDisplay();
}
function renderOpponentsQuadrant(turnPlayerId){
  const zones={top:document.getElementById('opponents-top'),left:document.getElementById('opponents-left'),right:document.getElementById('opponents-right')};if(!zones.top||!zones.left||!zones.right)return;Object.values(zones).forEach(zone=>zone.innerHTML='');
  const order=currentGameState.turnOrder||[];const myIndex=order.indexOf(myPlayerId);const opponents=Object.values(currentGameState.players||{}).filter(player=>player.id!==myPlayerId);const positions=[];
  if(myIndex>=0){[order[(myIndex+1)%order.length],order[(myIndex+2)%order.length],order[(myIndex-1+order.length)%order.length]].forEach(id=>{if(id&&id!==myPlayerId&&!positions.includes(id))positions.push(id);});}
  opponents.forEach(player=>{if(!positions.includes(player.id))positions.push(player.id);});
  positions.slice(0,3).forEach((id,index)=>{const player=currentGameState.players[id];if(!player)return;const isTurn=player.id===turnPlayerId;const cardCount=(player.hand||[]).length;const backs=Math.min(cardCount,5);const oppEl=document.createElement('div');oppEl.className=`opponent-mini-card ${isTurn?'active-turn':''}`;oppEl.innerHTML=`<img src="${escapeHtml(player.avatar||'./assets/foto1.jpeg')}" class="opp-avatar" alt="${escapeHtml(player.name)}"><div class="opp-details"><div class="opp-name">${escapeHtml(player.name)}</div><div class="opp-count">${cardCount} cartas</div><div class="opp-card-backs">${Array.from({length:backs},()=>'<span class="mini-card-back">UNO</span>').join('')}</div></div>`;(index===0?zones.left:index===1?zones.top:zones.right).appendChild(oppEl);});
}
function renderMyHand(
  isMyTurn
) {
  const container =
    document.getElementById(
      'my-hand'
    );
  if (!container) {
    return;
  }
  container.innerHTML =
    '';
  const myData =
    currentGameState
      .players[
        myPlayerId
      ];
  if (
    !myData ||
    !myData.hand
  ) {
    return;
  }
  const count =
    myData.hand.length;
  updateText(
    'my-card-count',
    count
  );
  updateText(
    'hand-card-counter',
    count
  );
  updateText(
    'header-card-count',
    count
  );
  updateText(
    'match-hand-count',
    count
  );
  myData.hand.forEach(
    card => {
      const cardEl =
        document.createElement(
          'div'
        );
      cardEl.className =
        `uno-card c-${card.color}`;
      cardEl.innerHTML = `
        <span class="card-corner">
          ${card.value}
        </span>
        <div class="card-inner">
          ${card.value}
        </div>
      `;
      cardEl.onclick =
        () => {
          if (isMyTurn) {
            playCard(
              card
            );
          }
        };
      container.appendChild(
        cardEl
      );
    }
  );
}
function playCard(
  card
) {
  const activePlayerId =
    currentGameState
      .turnOrder[
        currentGameState.currentTurnIndex
      ];
  if (
    activePlayerId !==
    myPlayerId
  ) {
    return;
  }
  const topCard =
    currentGameState.topCard;
  const currentHand = currentGameState.players[myPlayerId].hand || [];
  if (currentHand.length === 1) { applyLastCardPenalty(); return; }
  const stack =
    currentGameState.stack ||
    0;
  if (stack > 0) {
    if (
      card.value !== '+2' &&
      card.value !== '+4'
    ) {
      alert(
        `¡Hay un pozo acumulado de +${stack}! Juega una carta +2 o +4, o roba cartas.`
      );
      return;
    }
  }
  const isValid =
    card.color === 'negro' ||
    card.color ===
      currentGameState.activeColor ||
    card.value ===
      topCard.value;
  if (!isValid) {
    alert(
      'Esta carta no coincide con el color ni con el valor actual.'
    );
    return;
  }
  const myHand =
    currentGameState
      .players[
        myPlayerId
      ]
      .hand
      .filter(
        c =>
          c.id !==
          card.id
      );
  currentGameState
    .players[
      myPlayerId
    ]
    .hand =
    myHand;
  if (
    card.color ===
    'negro'
  ) {
    pendingWildCard =
      card;
    document
      .getElementById(
        'color-modal'
      )
      ?.classList.remove(
        'hidden'
      );
    return;
  }
  executeCardEffect(
    card
  );
}
function selectColor(
  color
) {
  document
    .getElementById(
      'color-modal'
    )
    ?.classList.add(
      'hidden'
    );
  if (!pendingWildCard) {
    return;
  }
  const card =
    pendingWildCard;
  pendingWildCard =
    null;
  currentGameState.activeColor =
    color;
  executeCardEffect(
    card
  );
}
function applyLastCardPenalty(){const player=currentGameState?.players?.[myPlayerId];if(!player)return;let deck=[...(currentGameState.deck||[])];const hand=[...(player.hand||[])];for(let i=0;i<10;i++){if(!deck.length)deck=generateDeck();hand.push(deck.pop());}player.hand=hand;currentGameState.deck=deck;showToastNotification('🚫 ¡No puedes ganar con la última carta! Castigo: +10 cartas.');if(roomRef)roomRef.update(currentGameState);else updateUI();}
function applyHandRelief(){const player=currentGameState?.players?.[myPlayerId];if(!player||(player.hand||[]).length<HAND_HELP_THRESHOLD)return;if(currentGameState.turnOrder?.[currentGameState.currentTurnIndex]!==myPlayerId){alert('La ayuda de mano solo puede usarse durante tu turno.');return;}const amount=player.hand.length>=20?4:2;player.hand=[...(player.hand||[])];for(let i=0;i<amount&&player.hand.length>1;i++)player.hand.splice(Math.floor(Math.random()*player.hand.length),1);showToastNotification(`🧹 Ayuda de mano: -${amount} cartas.`);if(roomRef)roomRef.update({[`players/${myPlayerId}/hand`]:player.hand});else updateUI();}
function executeCardEffect(
  card
) {
  currentGameState.topCard =
    card;
  if (
    card.color !==
    'negro'
  ) {
    currentGameState.activeColor =
      card.color;
  }
  if (
    card.value ===
    '+2'
  ) {
    currentGameState.stack =
      (
        currentGameState.stack ||
        0
      ) + 2;
  }
  if (
    card.value ===
    '+4'
  ) {
    currentGameState.stack =
      (
        currentGameState.stack ||
        0
      ) + 4;
  }
  let skipTurn =
    false;
  if (
    card.value ===
    '🚫'
  ) {
    skipTurn =
      true;
  }
  if (
    card.value ===
    '🔄'
  ) {
    currentGameState
      .turnOrder
      .reverse();
  }
  const myHand =
    currentGameState
      .players[
        myPlayerId
      ]
      .hand;
  if (myHand.length === 0) { applyLastCardPenalty(); return; }
  nextTurn(
    skipTurn
  );
}
function saveWinnerToHistory(
  name
) {
  if (
    !isFirebaseConnected ||
    !db
  ) {
    return;
  }
  db.ref(
    'history/winners'
  ).push({
    name,
    date:
      new Date()
        .toLocaleDateString()
  });
  db.ref(
    'history/players'
  ).push({
    name,
    skill:
      selectedSkill
  });
}
function nextTurn(
  skip = false
) {
  const order =
    currentGameState.turnOrder;
  if (
    !order ||
    order.length === 0
  ) {
    return;
  }
  const step =
    skip
      ? 2
      : 1;
  currentGameState
    .currentTurnIndex =
    (
      currentGameState
        .currentTurnIndex +
      step
    ) %
    order.length;
  if (roomRef) {
    roomRef.update(
      currentGameState
    );
  } else {
    updateUI();
  }
}
function drawCardCurrentPlayer() {
  if (
    !currentGameState ||
    !currentGameState.turnOrder
  ) {
    return;
  }
  const activePlayerId =
    currentGameState
      .turnOrder[
        currentGameState.currentTurnIndex
      ];
  if (
    activePlayerId !==
    myPlayerId
  ) {
    return;
  }
  let deck =
    [
      ...(currentGameState.deck ||
      [])
    ];
  if (
    deck.length === 0
  ) {
    deck =
      generateDeck();
  }
  let myHand =
    [
      ...currentGameState
        .players[
          myPlayerId
        ]
        .hand
    ];
  const stack =
    currentGameState.stack ||
    0;
  if (stack > 0) {
    for (
      let i = 0;
      i < stack;
      i++
    ) {
      if (
        deck.length > 0
      ) {
        myHand.push(
          deck.pop()
        );
      }
    }
    currentGameState.stack =
      0;
  } else {
    if (
      deck.length > 0
    ) {
      myHand.push(
        deck.pop()
      );
    }
  }
  currentGameState.deck =
    deck;
  currentGameState
    .players[
      myPlayerId
    ]
    .hand =
    myHand;
  nextTurn();
}
function sayUno() {
  const myHand =
    currentGameState
      ?.players[
        myPlayerId
      ]
      ?.hand;
  if (
    myHand &&
    myHand.length === 1
  ) {
    showToastNotification(
      '🔥 ¡UNO! Has cantado correctamente.'
    );
    if (
      isFirebaseConnected &&
      db &&
      currentRoomCode
    ) {
      db.ref(
        'chats/' +
        currentRoomCode
      ).push({
        sender:
          'SISTEMA',
        text:
          `¡${myPlayerName} HA GRITADO UNO! 🚨`
      });
    }
  } else {
    alert(
      'Solo puedes cantar UNO si te queda exactamente 1 carta.'
    );
  }
}
function returnToLobby() {
  document
    .getElementById(
      'winner-modal'
    )
    ?.classList.add(
      'hidden'
    );
  if (!currentGameState) {
    return;
  }
  currentGameState.status =
    'waiting';
  if (roomRef) {
    roomRef.child(
      'status'
    ).set(
      'waiting'
    );
  } else {
    updateUI();
  }
  resetPetCounters();
}
let petInterval = null;
function resetPetCounters() {
  llamaClicks =
    0;
  loroClicks =
    0;
  updateText(
    'llama-clicks',
    0
  );
  updateText(
    'loro-clicks',
    0
  );
}
function initRoamingPets() {
  if (petInterval) {
    clearInterval(
      petInterval
    );
  }
  const badPet =
    document.getElementById(
      'bad-pet'
    );
  const goodPet =
    document.getElementById(
      'good-pet'
    );
  function movePetsVertical() {
    const maxY =
      Math.max(
        100,
        window.innerHeight -
        130
      );
    if (badPet) {
      badPet.style.top =
        `${Math.floor(
          Math.random() *
          maxY
        )}px`;
    }
    if (goodPet) {
      goodPet.style.top =
        `${Math.floor(
          Math.random() *
          maxY
        )}px`;
    }
  }
  movePetsVertical();
  petInterval =
    setInterval(
      movePetsVertical,
      3500
    );
}
function handleLlamaClick() {
  if (
    currentGameState?.status !==
    'playing'
  ) {
    return;
  }
  llamaClicks++;
  updateText(
    'llama-clicks',
    llamaClicks
  );
  if (
    llamaClicks <
    LLAMA_REQUIRED_CLICKS
  ) {
    return;
  }
  llamaClicks =
    0;
  updateText(
    'llama-clicks',
    0
  );
  const player =
    currentGameState
      .players[
        myPlayerId
      ];
  if (!player) {
    return;
  }
  let hand =
    [
      ...(
        player.hand ||
        []
      )
    ];
  if (
    hand.length === 1
  ) {
    alert(
      '⚠️ ¡ABUSO DE MASCOTA DETECTADO! Recibes un castigo de 10 cartas.'
    );
    let deck =
      [
        ...(currentGameState.deck ||
        [])
      ];
    for (
      let i = 0;
      i < 10;
      i++
    ) {
      if (
        deck.length === 0
      ) {
        deck =
          generateDeck();
      }
      hand.push(
        deck.pop()
      );
    }
    currentGameState.deck =
      deck;
  } else {
    hand.push({
      color:
        'negro',
      value:
        '+4',
      id:
        Math.random()
          .toString(36)
          .substr(2, 9)
    });
    showToastNotification(
      '🦙 ¡La Llama te dio una carta +4!'
    );
  }
  currentGameState
    .players[
      myPlayerId
    ]
    .hand =
    hand;
  savePlayerHand(
    hand
  );
}
function handleGoodPetClick() {
  if (
    currentGameState?.status !==
    'playing'
  ) {
    return;
  }
  loroClicks++;
  updateText(
    'loro-clicks',
    loroClicks
  );
  if (
    loroClicks <
    LORO_REQUIRED_CLICKS
  ) {
    return;
  }
  loroClicks =
    0;
  updateText(
    'loro-clicks',
    0
  );
  const player =
    currentGameState
      .players[
        myPlayerId
      ];
  if (!player) {
    return;
  }
  let hand =
    [
      ...(
        player.hand ||
        []
      )
    ];
  if (
    hand.length <= 1
  ) {
    showToastNotification(
      '🦜 El Loro ya no puede ayudarte. ¡Tienes 1 carta! Ahora debes jugarla para ganar.'
    );
    return;
  }
  const removedIndex =
    Math.floor(
      Math.random() *
      hand.length
    );
  hand.splice(
    removedIndex,
    1
  );
  currentGameState
    .players[
      myPlayerId
    ]
    .hand =
    hand;
  if (
    hand.length === 1
  ) {
    showToastNotification(
      '🦜 ¡El Loro te dejó con 1 carta! 🔥 Ahora debes jugar esa carta para ganar.'
    );
  } else {
    showToastNotification(
      '🦜 ¡El Loro Bueno se llevó una carta de tu mano!'
    );
  }
  savePlayerHand(
    hand
  );
}
function savePlayerHand(
  hand
) {
  if (
    roomRef
  ) {
    roomRef
      .child(
        `players/${myPlayerId}/hand`
      )
      .set(
        hand
      );
  } else {
    updateUI();
  }
}
function useSpecialSkill() {
  if (
    !currentGameState
  ) {
    return;
  }
  const player =
    currentGameState
      .players[
        myPlayerId
      ];
  if (!player) {
    return;
  }
  if (
    typeof player.skillUses !==
    'number'
  ) {
    player.skillUses =
      MAX_SKILL_USES;
  }
  const skillUses =
    player.skillUses;
  if (
    skillUses <= 0
  ) {
    alert(
      '⚡ Ya has usado tus 3 habilidades de esta partida.'
    );
    return;
  }
  if (
    currentGameState
      .turnOrder[
        currentGameState.currentTurnIndex
      ] !==
    myPlayerId
  ) {
    alert(
      'Solo puedes usar tu habilidad durante tu turno.'
    );
    return;
  }
  let skillWasUsed =
    false;
  const hand =
    [
      ...(player.hand ||
      [])
    ];
  if (
    selectedSkill ===
    'Escudo Táctico'
  ) {
    if (
      (currentGameState.stack || 0) <= 0
    ) {
      showToastNotification(
        '🛡️ No hay cartas acumuladas para anular.'
      );
      return;
    }
    currentGameState.stack =
      0;
    showToastNotification(
      '🛡️ ¡Escudo activado! El pozo fue anulado.'
    );
    skillWasUsed =
      true;
  }
  else if (
    selectedSkill ===
    'Espionaje'
  ) {
    const opponents =
      Object.values(
        currentGameState.players
      )
      .filter(
        p =>
          p.id !==
          myPlayerId
      );
    if (
      opponents.length === 0
    ) {
      alert(
        '🔍 No hay rivales para espiar.'
      );
      return;
    }
    const opponentInfo =
      opponents
        .map(
          opponent => {
            const cards =
              opponent.hand ||
              [];
            const cardText =
              cards
                .map(
                  card =>
                    `${capitalize(card.color)} ${card.value}`
                )
                .join(', ');
            return `
              ${opponent.name}:
              ${cards.length} cartas
              ${cardText || 'Sin cartas'}
            `;
          }
        )
        .join(
          '\n\n'
        );
    alert(
      '🔍 CARTAS DE LOS RIVALES\n\n' +
      opponentInfo
    );
    skillWasUsed =
      true;
  }
  else if (
    selectedSkill ===
    'Robo Rápido'
  ) {
    currentGameState.stack =
      (
        currentGameState.stack ||
        0
      ) + 4;
    showToastNotification(
      '⚡ ¡Robo Rápido activado! +4 agregados al pozo.'
    );
    skillWasUsed =
      true;
  }
  else if (
    selectedSkill ===
    'Purga Directa'
  ) {
    if (
      hand.length <= 2
    ) {
      alert(
        '🔥 Necesitas tener más de 2 cartas para ejecutar la Purga.'
      );
      return;
    }
    for (
      let i = 0;
      i < 2;
      i++
    ) {
      if (
        hand.length > 0
      ) {
        const randomIndex =
          Math.floor(
            Math.random() *
            hand.length
          );
        hand.splice(
          randomIndex,
          1
        );
      }
    }
    player.hand =
      hand;
    showToastNotification(
      '🔥 ¡Purga activada! Eliminaste 2 cartas de tu mano.'
    );
    skillWasUsed =
      true;
  }
  if (
    skillWasUsed
  ) {
    player.skillUses =
      Math.max(
        0,
        skillUses - 1
      );
    updateSkillDisplay();
    if (roomRef) {
      roomRef.update(
        currentGameState
      );
    } else {
      updateUI();
    }
  }
}
function updateSkillDisplay() {
  let uses =
    MAX_SKILL_USES;
  if (
    currentGameState &&
    currentGameState.players &&
    currentGameState.players[
      myPlayerId
    ]
  ) {
    const player =
      currentGameState
        .players[
          myPlayerId
        ];
    if (
      typeof player.skillUses ===
      'number'
    ) {
      uses =
        player.skillUses;
    }
  }
  updateText(
    'skill-uses-display',
    uses
  );
  updateText(
    'skill-button-count',
    uses
  );
  updateText(
    'match-skill-count',
    uses
  );
}
function updateText(
  id,
  value
) {
  const element =
    document.getElementById(
      id
    );
  if (element) {
    element.innerText =
      value;
  }
}
function capitalize(
  text
) {
  if (!text) {
    return '';
  }
  return (
    text.charAt(0).toUpperCase() +
    text.slice(1)
  );
}
