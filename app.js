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

try {
  if (typeof firebase !== 'undefined') {
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    db = firebase.database();
    isFirebaseConnected = true;
  }
} catch (e) { console.warn("Modo local activo.", e); }

let myPlayerId = 'p_' + Math.random().toString(36).substr(2, 9);
let myPlayerName = '';
let selectedAvatarUrl = './assets/foto1.jpeg';
let selectedSkill = 'Escudo Táctico';
let hasUsedSkill = false;

let currentRoomCode = null;
let roomRef = null;
let chatRef = null;
let currentGameState = null;
let knownPlayers = {};

let llamaClicks = 0;
let loroClicks = 0;

let turnTimer = null;
let timeLeft = 10;
let pendingWildCard = null;

// WEBRTC CHAT DE VOZ EN TIEMPO REAL
let localStream = null;
let isMicOn = false;
let peerConnections = {};
const rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

const COLORS = ['rojo', 'azul', 'verde', 'amarillo'];
const VALUES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '+2', '+4', '🚫', '🔄'];

// DETECTAR ABANDONO DE NAVEGADOR
window.addEventListener('beforeunload', () => {
  if (currentRoomCode && myPlayerName && isFirebaseConnected && db) {
    db.ref(`chats/${currentRoomCode}`).push({
      sender: 'SISTEMA',
      text: `${myPlayerName} abandonó la partida.`
    });
    db.ref(`rooms/${currentRoomCode}/players/${myPlayerId}`).remove();
  }
});

function showToastNotification(message) {
  const toast = document.getElementById('system-notification');
  const msgEl = document.getElementById('toast-message');
  if (!toast || !msgEl) return;
  msgEl.innerText = message;
  toast.classList.remove('hidden');
  setTimeout(() => { toast.classList.add('hidden'); }, 4000);
}

function initHistory() {
  if (isFirebaseConnected && db) {
    db.ref('history/winners').on('value', snapshot => {
      const list = document.getElementById('winners-history-list');
      if (!list) return;
      list.innerHTML = '';
      if (snapshot.exists()) {
        Object.values(snapshot.val()).reverse().forEach(item => {
          list.innerHTML += `<li class="text-center">🏆 <b>${item.name}</b> [${item.date}]</li>`;
        });
      } else { list.innerHTML = '<li class="empty-msg text-center">Sin campeones registrados aún.</li>'; }
    });

    db.ref('history/players').on('value', snapshot => {
      const list = document.getElementById('all-players-history-list');
      if (!list) return;
      list.innerHTML = '';
      if (snapshot.exists()) {
        Object.values(snapshot.val()).reverse().forEach(item => {
          list.innerHTML += `<li class="text-center">👤 <b>${item.name}</b> (${item.skill})</li>`;
        });
      } else { list.innerHTML = '<li class="empty-msg text-center">Sin jugadores registrados.</li>'; }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => { 
  initHistory();
});

function selectAvatar(element, url, skillName, skillDesc) {
  document.querySelectorAll('.avatar-card').forEach(el => el.classList.remove('selected'));
  element.classList.add('selected');
  selectedAvatarUrl = url;
  selectedSkill = skillName;
  document.getElementById('skill-description').innerText = 'Habilidad: ' + skillDesc;
}

function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId)?.classList.add('active');

  const petsLayer = document.getElementById('pets-roaming-layer');
  if (screenId === 'screen-game') {
    petsLayer.classList.remove('pets-hidden');
    initRoamingPets();
  } else {
    petsLayer.classList.add('pets-hidden');
  }
}

function getPlayerName() {
  const input = document.getElementById('player-name-input').value.trim();
  if (!input) { alert('Por favor, ingresa tu apodo de jugador.'); return null; }
  myPlayerName = input;

  document.getElementById('my-name-display').innerText = myPlayerName;
  document.getElementById('my-avatar-display').src = selectedAvatarUrl;
  document.getElementById('my-skill-display').innerText = selectedSkill;

  return myPlayerName;
}

function generateDeck() {
  let deck = [];
  COLORS.forEach(color => {
    VALUES.forEach(val => {
      deck.push({ color, value: val, id: Math.random().toString(36).substr(2, 9) });
    });
  });
  deck.push({ color: 'negro', value: '+4', id: Math.random().toString(36).substr(2, 9) });
  deck.push({ color: 'negro', value: 'CAMBIO', id: Math.random().toString(36).substr(2, 9) });
  return deck.sort(() => Math.random() - 0.5);
}

function createRoom() {
  if (!getPlayerName()) return;
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  currentRoomCode = code;

  const initialData = {
    code: code, host: myPlayerId, status: 'waiting', stack: 0, activeColor: 'rojo', currentTurnIndex: 0,
    turnOrder: [myPlayerId], topCard: null, deck: generateDeck(), winnerName: null,
    players: {
      [myPlayerId]: { id: myPlayerId, name: myPlayerName, avatar: selectedAvatarUrl, skill: selectedSkill, hand: [], isHost: true }
    }
  };

  if (isFirebaseConnected && db) {
    roomRef = db.ref('rooms/' + code);
    roomRef.set(initialData).then(() => { 
      listenToRoom(); 
      listenToChat();
      initVoiceSignaling();
      showScreen('screen-lobby'); 
    });
  } else {
    currentGameState = initialData;
    document.getElementById('lobby-code-display').innerText = currentRoomCode;
    updateUI();
    showScreen('screen-lobby');
  }
}

function joinRoom() {
  if (!getPlayerName()) return;
  const code = document.getElementById('room-code-input').value.trim().toUpperCase();
  if (!code) return alert('Por favor ingresa un código válido.');

  currentRoomCode = code;
  if (isFirebaseConnected && db) {
    roomRef = db.ref('rooms/' + code);
    roomRef.once('value', snapshot => {
      if (!snapshot.exists()) return alert('La sala ingresada no existe.');
      roomRef.child('players/' + myPlayerId).set({
        id: myPlayerId, name: myPlayerName, avatar: selectedAvatarUrl, skill: selectedSkill, hand: [], isHost: false
      }).then(() => { 
        listenToRoom(); 
        listenToChat();
        initVoiceSignaling();
        showScreen('screen-lobby'); 
      });
    });
  }
}

function listenToRoom() {
  document.getElementById('lobby-code-display').innerText = currentRoomCode;
  if (roomRef) {
    roomRef.on('value', snapshot => {
      if (!snapshot.exists()) return;
      currentGameState = snapshot.val();
      
      const activePlayers = currentGameState.players || {};
      Object.keys(knownPlayers).forEach(pId => {
        if (!activePlayers[pId]) {
          showToastNotification(`${knownPlayers[pId]} abandonó la partida`);
        }
      });

      knownPlayers = {};
      Object.values(activePlayers).forEach(p => { knownPlayers[p.id] = p.name; });

      updateUI();
    });
  }
}

function listenToChat() {
  if (!currentRoomCode || !isFirebaseConnected || !db) return;
  chatRef = db.ref('chats/' + currentRoomCode);
  chatRef.on('child_added', snapshot => {
    const msgData = snapshot.val();
    renderL4DMessage(msgData);
    renderLobbyMessage(msgData);

    if (msgData.sender === 'SISTEMA' && msgData.text.includes('abandonó')) {
      showToastNotification(msgData.text);
    }
  });
}

// CHAT SALA DE ESPERA
function handleLobbyChatKey(event) {
  if (event.key === 'Enter') {
    const input = document.getElementById('lobby-chat-input');
    const text = input.value.trim();
    if (!text) return;

    if (isFirebaseConnected && db && currentRoomCode) {
      db.ref('chats/' + currentRoomCode).push({ sender: myPlayerName, text: text });
    } else {
      renderLobbyMessage({ sender: myPlayerName, text: text });
    }
    input.value = '';
  }
}

function renderLobbyMessage(msgData) {
  const container = document.getElementById('lobby-chat-messages');
  if (!container) return;
  const msgEl = document.createElement('div');
  msgEl.className = 'chat-msg';
  msgEl.innerHTML = `<b>${msgData.sender}:</b> ${msgData.text}`;
  container.appendChild(msgEl);
  container.scrollTop = container.scrollHeight;
}

function handleChatKey(event) {
  if (event.key === 'Enter') {
    const input = document.getElementById('l4d-chat-input');
    const text = input.value.trim();
    if (!text) return;

    if (isFirebaseConnected && db && currentRoomCode) {
      db.ref('chats/' + currentRoomCode).push({ sender: myPlayerName, text: text });
    } else {
      renderL4DMessage({ sender: myPlayerName, text: text });
    }
    input.value = '';
  }
}

function renderL4DMessage(msgData) {
  const container = document.getElementById('l4d-chat-messages');
  if (!container) return;
  const msgEl = document.createElement('div');
  msgEl.className = 'chat-msg';
  msgEl.innerHTML = `<b>${msgData.sender}:</b> ${msgData.text}`;
  container.appendChild(msgEl);
  container.scrollTop = container.scrollHeight;
}

// MICRÓFONO WEBRTC
async function toggleMicrophone() {
  const btn = document.getElementById('btn-mic-toggle');
  const text = document.getElementById('mic-status-text');
  
  if (!isMicOn) {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      isMicOn = true;
      btn.className = 'ui-btn btn-mic-on';
      text.innerText = 'Micrófono Encendido';
      
      Object.keys(peerConnections).forEach(pId => {
        localStream.getTracks().forEach(track => peerConnections[pId].addTrack(track, localStream));
      });
    } catch (err) {
      alert('No se pudo activar el micrófono. Concede los permisos necesarios.');
    }
  } else {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    isMicOn = false;
    btn.className = 'ui-btn btn-mic-off';
    text.innerText = 'Micrófono Apagado';
  }
}

function initVoiceSignaling() {
  if (!isFirebaseConnected || !db || !currentRoomCode) return;
  const signalRef = db.ref(`signals/${currentRoomCode}/${myPlayerId}`);
  
  signalRef.on('child_added', async snapshot => {
    const data = snapshot.val();
    const fromId = data.from;
    
    if (!peerConnections[fromId]) createPeerConnection(fromId);
    const pc = peerConnections[fromId];

    if (data.offer) {
      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      db.ref(`signals/${currentRoomCode}/${fromId}`).push({ from: myPlayerId, answer: answer });
    } else if (data.answer) {
      await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
    } else if (data.candidate) {
      await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
  });
}

function createPeerConnection(targetPlayerId) {
  const pc = new RTCPeerConnection(rtcConfig);
  peerConnections[targetPlayerId] = pc;

  if (localStream) {
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
  }

  pc.onicecandidate = event => {
    if (event.candidate) {
      db.ref(`signals/${currentRoomCode}/${targetPlayerId}`).push({ from: myPlayerId, candidate: event.candidate });
    }
  };

  pc.ontrack = event => {
    let audio = document.getElementById(`audio_${targetPlayerId}`);
    if (!audio) {
      audio = document.createElement('audio');
      audio.id = `audio_${targetPlayerId}`;
      audio.autoplay = true;
      document.body.appendChild(audio);
    }
    audio.srcObject = event.streams[0];
  };

  return pc;
}

function startGame() {
  if (!currentGameState) return;
  const playerKeys = Object.keys(currentGameState.players || {});
  let deck = [...currentGameState.deck];
  let players = { ...currentGameState.players };

  playerKeys.forEach(pId => { players[pId].hand = deck.splice(0, 7); });
  
  let topCard = deck.pop();
  while(topCard.color === 'negro') {
    deck.unshift(topCard);
    topCard = deck.pop();
  }

  const updatedState = {
    ...currentGameState, status: 'playing', deck: deck, players: players, topCard: topCard,
    activeColor: topCard.color, turnOrder: playerKeys, currentTurnIndex: 0, stack: 0, winnerName: null
  };

  if (roomRef) roomRef.update(updatedState);
  else { currentGameState = updatedState; updateUI(); }
}

function updateUI() {
  if (!currentGameState) return;

  if (currentGameState.status === 'waiting') {
    showScreen('screen-lobby');
    const playersArr = Object.values(currentGameState.players || {});
    document.getElementById('player-count').innerText = playersArr.length;
    
    document.getElementById('lobby-players-list').innerHTML = playersArr.map(p => `
      <div class="lobby-player-card">
        <img src="${p.avatar}" class="lobby-player-avatar">
        <div class="text-center" style="width:100%;">
          <div class="lobby-player-name">${p.name}</div>
          <div class="lobby-player-skill">${p.skill}</div>
        </div>
      </div>
    `).join('');
    
    const isHost = currentGameState.host === myPlayerId;
    document.getElementById('btn-start-game').style.display = isHost ? 'block' : 'none';
    document.getElementById('waiting-msg-container').style.display = isHost ? 'none' : 'block';

  } else if (currentGameState.status === 'playing') {
    showScreen('screen-game');
    document.getElementById('winner-modal').classList.add('hidden');
    renderGameBoard();
    startTurnTimer();
  } else if (currentGameState.status === 'finished') {
    document.getElementById('winner-name-display').innerText = currentGameState.winnerName || 'Ganador Desconocido';
    document.getElementById('winner-modal').classList.remove('hidden');
    clearInterval(turnTimer);
  }
}

function startTurnTimer() {
  clearInterval(turnTimer);
  timeLeft = 10;
  document.getElementById('timer-display').innerText = timeLeft;

  turnTimer = setInterval(() => {
    timeLeft--;
    document.getElementById('timer-display').innerText = timeLeft;
    if (timeLeft <= 0) {
      clearInterval(turnTimer);
      const activePlayerId = currentGameState.turnOrder[currentGameState.currentTurnIndex];
      if (activePlayerId === myPlayerId) {
        drawCardCurrentPlayer();
      }
    }
  }, 1000);
}

function renderGameBoard() {
  const turnPlayerId = currentGameState.turnOrder[currentGameState.currentTurnIndex];
  const isMyTurn = turnPlayerId === myPlayerId;

  document.getElementById('turn-display').innerText = isMyTurn ? '¡TU TURNO!' : currentGameState.players[turnPlayerId]?.name;
  document.getElementById('active-color-indicator').className = 'color-badge c-' + currentGameState.activeColor;
  document.getElementById('stack-display').innerText = '+' + (currentGameState.stack || 0);

  const topCardSpot = document.getElementById('top-card');
  if (topCardSpot && currentGameState.topCard) {
    topCardSpot.className = `uno-card c-${currentGameState.topCard.color}`;
    topCardSpot.innerHTML = `
      <span class="card-corner">${currentGameState.topCard.value}</span>
      <div class="card-inner">${currentGameState.topCard.value}</div>
    `;
  }

  renderOpponentsQuadrant(turnPlayerId);
  renderMyHand(isMyTurn);
}

function renderOpponentsQuadrant(turnPlayerId) {
  const zoneTop = document.getElementById('opponents-top');
  const zoneLeft = document.getElementById('opponents-left');
  const zoneRight = document.getElementById('opponents-right');

  if (!zoneTop || !zoneLeft || !zoneRight) return;
  
  zoneTop.innerHTML = '';
  zoneLeft.innerHTML = '';
  zoneRight.innerHTML = '';

  const opponents = Object.values(currentGameState.players || {}).filter(p => p.id !== myPlayerId);

  opponents.forEach((player, index) => {
    const isTurn = player.id === turnPlayerId;
    const cardCount = player.hand ? player.hand.length : 0;

    const oppEl = document.createElement('div');
    oppEl.className = `opponent-mini-card ${isTurn ? 'active-turn' : ''}`;
    oppEl.innerHTML = `
      <img src="${player.avatar}" class="opp-avatar">
      <div class="text-center" style="width:100%;">
        <div class="opp-name">${player.name}</div>
        <div style="font-size:0.75rem; color:var(--text-muted);">${cardCount} cartas</div>
      </div>
    `;

    if (index === 0) zoneLeft.appendChild(oppEl);
    else if (index === 1) zoneRight.appendChild(oppEl);
    else zoneTop.appendChild(oppEl);
  });
}

function renderMyHand(isMyTurn) {
  const container = document.getElementById('my-hand');
  if (!container) return;
  container.innerHTML = '';
  const myData = currentGameState.players[myPlayerId];
  if (!myData || !myData.hand) return;

  document.getElementById('my-card-count').innerText = myData.hand.length;

  myData.hand.forEach((card) => {
    const cardEl = document.createElement('div');
    cardEl.className = `uno-card c-${card.color}`;
    cardEl.innerHTML = `
      <span class="card-corner">${card.value}</span>
      <div class="card-inner">${card.value}</div>
    `;
    cardEl.onclick = () => { if (isMyTurn) playCard(card); };
    container.appendChild(cardEl);
  });
}

function playCard(card) {
  const activePlayerId = currentGameState.turnOrder[currentGameState.currentTurnIndex];
  if (activePlayerId !== myPlayerId) return;

  const topCard = currentGameState.topCard;
  const stack = currentGameState.stack || 0;

  if (stack > 0) {
    if (card.value !== '+2' && card.value !== '+4') {
      alert(`¡Hay un pozo acumulado de +${stack}! Juega una carta +2 o +4, o roba cartas.`);
      return;
    }
  }

  const isValid = card.color === 'negro' || card.color === currentGameState.activeColor || card.value === topCard.value;
  if (!isValid) {
    alert('Esta carta no coincide con el color ni con el número actual.');
    return;
  }

  let myHand = currentGameState.players[myPlayerId].hand.filter(c => c.id !== card.id);
  currentGameState.players[myPlayerId].hand = myHand;

  if (card.color === 'negro') {
    pendingWildCard = card;
    document.getElementById('color-modal').classList.remove('hidden');
    return;
  }

  executeCardEffect(card);
}

function selectColor(color) {
  document.getElementById('color-modal').classList.add('hidden');
  if (pendingWildCard) {
    let card = pendingWildCard;
    pendingWildCard = null;
    currentGameState.activeColor = color;
    executeCardEffect(card);
  }
}

function executeCardEffect(card) {
  currentGameState.topCard = card;
  if (card.color !== 'negro') {
    currentGameState.activeColor = card.color;
  }

  if (card.value === '+2') currentGameState.stack = (currentGameState.stack || 0) + 2;
  if (card.value === '+4') currentGameState.stack = (currentGameState.stack || 0) + 4;

  let skipTurn = false;
  if (card.value === '🚫') skipTurn = true;
  if (card.value === '🔄') currentGameState.turnOrder.reverse();

  if (currentGameState.players[myPlayerId].hand.length === 0) {
    currentGameState.status = 'finished';
    currentGameState.winnerName = myPlayerName;
    saveWinnerToHistory(myPlayerName);
  }

  nextTurn(skipTurn);
}

function saveWinnerToHistory(name) {
  if (isFirebaseConnected && db) {
    db.ref('history/winners').push({
      name: name,
      date: new Date().toLocaleDateString()
    });
    db.ref('history/players').push({
      name: name,
      skill: selectedSkill
    });
  }
}

function nextTurn(skip = false) {
  let step = skip ? 2 : 1;
  currentGameState.currentTurnIndex = (currentGameState.currentTurnIndex + step) % currentGameState.turnOrder.length;

  if (roomRef) roomRef.set(currentGameState);
  else updateUI();
}

function drawCardCurrentPlayer() {
  const activePlayerId = currentGameState.turnOrder[currentGameState.currentTurnIndex];
  if (activePlayerId !== myPlayerId) return;

  let deck = [...currentGameState.deck];
  if (deck.length === 0) deck = generateDeck();

  let myHand = [...currentGameState.players[myPlayerId].hand];
  const stack = currentGameState.stack || 0;

  if (stack > 0) {
    for (let i = 0; i < stack; i++) {
      if (deck.length > 0) myHand.push(deck.pop());
    }
    currentGameState.stack = 0;
  } else {
    if (deck.length > 0) myHand.push(deck.pop());
  }

  currentGameState.deck = deck;
  currentGameState.players[myPlayerId].hand = myHand;

  nextTurn();
}

function sayUno() {
  const myHand = currentGameState?.players[myPlayerId]?.hand;
  if (myHand && myHand.length === 1) {
    alert('¡Cargado el grito de UNO correctamente!');
    if (isFirebaseConnected && db && currentRoomCode) {
      db.ref('chats/' + currentRoomCode).push({
        sender: 'SISTEMA',
        text: `¡${myPlayerName} HA GRITADO UNO! 🚨`
      });
    }
  } else {
    alert('Solo puedes cantar UNO si te queda exactamente 1 carta.');
  }
}

function returnToLobby() {
  document.getElementById('winner-modal').classList.add('hidden');
  if (currentGameState) {
    currentGameState.status = 'waiting';
    if (roomRef) roomRef.child('status').set('waiting');
    else updateUI();
  }
}

// LÓGICA DE MASCOTAS
let petInterval = null;
function initRoamingPets() {
  if (petInterval) clearInterval(petInterval);

  const badPet = document.getElementById('bad-pet');
  const goodPet = document.getElementById('good-pet');

  function movePetsVertical() {
    const maxY = window.innerHeight - 110;
    if (badPet) badPet.style.top = `${Math.floor(Math.random() * maxY)}px`;
    if (goodPet) goodPet.style.top = `${Math.floor(Math.random() * maxY)}px`;
  }

  movePetsVertical();
  petInterval = setInterval(movePetsVertical, 3500);
}

function handleLlamaClick() {
  llamaClicks++;
  document.getElementById('llama-clicks').innerText = llamaClicks;
  if (llamaClicks >= 40) {
    llamaClicks = 0;
    document.getElementById('llama-clicks').innerText = 0;
    if (currentGameState?.players[myPlayerId]) {
      currentGameState.players[myPlayerId].hand.push({ color: 'negro', value: '+2', id: Math.random().toString(36).substr(2, 9) });
      if (roomRef) roomRef.child(`players/${myPlayerId}/hand`).set(currentGameState.players[myPlayerId].hand);
      else updateUI();
    }
  }
}

function handleGoodPetClick() {
  loroClicks++;
  document.getElementById('loro-clicks').innerText = loroClicks;
  if (loroClicks >= 40) {
    loroClicks = 0;
    document.getElementById('loro-clicks').innerText = 0;
    let hand = currentGameState?.players[myPlayerId]?.hand;
    if (hand && hand.length > 1) {
      hand.pop();
      if (roomRef) roomRef.child(`players/${myPlayerId}/hand`).set(hand);
      else updateUI();
    }
  }
}

function useSpecialSkill() {
  if (hasUsedSkill) return alert('Ya has usado la habilidad única en esta partida.');
  hasUsedSkill = true;
  if (selectedSkill === 'Escudo Táctico') currentGameState.stack = 0;
  if (roomRef) roomRef.child('stack').set(currentGameState.stack);
  updateUI();
}
