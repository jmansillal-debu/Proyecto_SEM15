const firebaseConfig = {
  apiKey: "AIzaSyD3ENYHqV1eFLPUMAc6HnusYG7-6S-iyqg",
  authDomain: "proyectouno-84196.firebaseapp.com",
  databaseURL: "https://proyectouno-84196-default-rtdb.firebaseio.com",
  projectId: "proyectouno-84196",
  storageBucket: "proyectouno-84196.appspot.com",
  messagingSenderId: "926454626159",
  appId: "1:926454626159:web:f1cfb4B36a810ac1a91a9a",
  measurementId: "G-V966LGLNZB"
};

let db = null;
let isFirebaseConnected = false;

try {
  if (typeof firebase !== 'undefined' && firebaseConfig.apiKey !== "TU_API_KEY_REAL") {
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    db = firebase.database();
    isFirebaseConnected = true;
  }
} catch (e) { console.warn("Modo local.", e); }

let myPlayerId = 'p_' + Math.random().toString(36).substr(2, 9);
let myPlayerName = '';
let selectedAvatarUrl = './assets/foto1.jpeg';
let selectedSkill = 'Escudo Táctico';
let hasUsedSkill = false;

let currentRoomCode = null;
let roomRef = null;
let chatRef = null;
let currentGameState = null;
let pendingWildCard = null;

let turnTimer = null;
let timeLeft = 10;

const COLORS = ['rojo', 'azul', 'verde', 'amarillo'];
const VALUES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '+2', '+4', '+6', '+8', '🚫', '🔄'];

let goodPetClicks = 0;
let targetGoodClicks = 15;

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
}

function getPlayerName() {
  const input = document.getElementById('player-name-input').value.trim();
  if (!input) { alert('Ingresa tu nombre.'); return null; }
  myPlayerName = input;
  return myPlayerName;
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
    roomRef.set(initialData).then(() => { listenToRoom(); showScreen('screen-lobby'); });
  } else { startLocalRoom(initialData); }
}

function startLocalRoom(data) {
  currentGameState = data;
  document.getElementById('lobby-code-display').innerText = currentRoomCode;
  updateUI();
  showScreen('screen-lobby');
}

function joinRoom() {
  if (!getPlayerName()) return;
  const code = document.getElementById('room-code-input').value.trim().toUpperCase();
  if (!code) return alert('Código inválido.');

  currentRoomCode = code;
  if (isFirebaseConnected && db) {
    roomRef = db.ref('rooms/' + code);
    roomRef.once('value', snapshot => {
      if (!snapshot.exists()) return alert('Sala no encontrada.');
      roomRef.child('players/' + myPlayerId).set({
        id: myPlayerId, name: myPlayerName, avatar: selectedAvatarUrl, skill: selectedSkill, hand: [], isHost: false
      }).then(() => { listenToRoom(); showScreen('screen-lobby'); });
    });
  }
}

function generateDeck() {
  let deck = [];
  COLORS.forEach(color => {
    VALUES.forEach(val => {
      deck.push({ color, value: val, id: Math.random().toString(36).substr(2, 9) });
    });
  });
  return deck.sort(() => Math.random() - 0.5);
}

function listenToRoom() {
  document.getElementById('lobby-code-display').innerText = currentRoomCode;
  if (roomRef) {
    roomRef.on('value', snapshot => {
      if (!snapshot.exists()) return;
      currentGameState = snapshot.val();
      updateUI();
    });
  }
  if (isFirebaseConnected && db) {
    chatRef = db.ref('chats/' + currentRoomCode);
    chatRef.off(); 
    chatRef.on('child_added', snapshot => {
      if (snapshot.exists()) renderL4DMessage(snapshot.val());
    });
  }
}

function startGame() {
  if (!currentGameState) return;
  const playerKeys = Object.keys(currentGameState.players || {});
  let deck = [...currentGameState.deck];
  let players = { ...currentGameState.players };

  playerKeys.forEach(pId => { players[pId].hand = deck.splice(0, 7); });
  let topCard = deck.pop();

  const updatedState = {
    ...currentGameState, status: 'playing', deck: deck, players: players, topCard: topCard,
    activeColor: topCard.color !== 'negro' ? topCard.color : 'rojo', turnOrder: playerKeys, currentTurnIndex: 0
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
    document.getElementById('lobby-players-list').innerHTML = playersArr.map(p => `<li>${p.name} (${p.skill})</li>`).join('');
    document.getElementById('btn-start-game').style.display = currentGameState.host === myPlayerId ? 'block' : 'none';
  } else if (currentGameState.status === 'playing') {
    showScreen('screen-game');
    renderGameBoard();
  }
}

function renderGameBoard() {
  const turnPlayerId = currentGameState.turnOrder[currentGameState.currentTurnIndex];
  const isMyTurn = turnPlayerId === myPlayerId;

  document.getElementById('turn-display').innerText = isMyTurn ? '¡TU TURNO!' : currentGameState.players[turnPlayerId]?.name;
  document.getElementById('active-color-indicator').className = 'color-dot c-' + currentGameState.activeColor;
  document.getElementById('stack-display').innerText = '+' + (currentGameState.stack || 0);

  const topCardSpot = document.getElementById('top-card');
  if (topCardSpot && currentGameState.topCard) {
    topCardSpot.className = `unocard c-${currentGameState.topCard.color}`;
    topCardSpot.innerHTML = `<div class="card-inner">${currentGameState.topCard.value}</div>`;
  }

  renderMyHand(isMyTurn);
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
    cardEl.className = `unocard c-${card.color}`;
    cardEl.innerHTML = `<div class="card-inner">${card.value}</div>`;
    cardEl.onclick = () => { if (isMyTurn) playCard(card); };
    container.appendChild(cardEl);
  });
}

function useSpecialSkill() {
  if (hasUsedSkill) return alert('Ya usaste tu habilidad en esta partida.');
  hasUsedSkill = true;

  if (selectedSkill === 'Escudo Táctico') {
    currentGameState.stack = 0;
    sendL4DMessage('HABILIDAD', `¡${myPlayerName} activó Escudo Táctico y anuló la suma!`);
  } else if (selectedSkill === 'Robo Rápido') {
    let myHand = currentGameState.players[myPlayerId].hand;
    myHand.push({ color: 'negro', value: '+4', id: Math.random().toString(36).substr(2, 9) });
    sendL4DMessage('HABILIDAD', `¡${myPlayerName} obtuvo una carta de +4!`);
  }
  updateUI();
}

function handleLlamaClick() {
  const speech = document.getElementById('bad-pet-speech');
  speech.innerText = "¡Toma una carta de suma táctica! 🎁";

  let myHand = [...(currentGameState?.players[myPlayerId]?.hand || [])];
  myHand.push({ color: 'negro', value: '+2', id: Math.random().toString(36).substr(2, 9) });

  if (roomRef) {
    roomRef.child(`players/${myPlayerId}/hand`).set(myHand);
  }
  sendL4DMessage('MASCOTA 🦙', `¡La Llama le regaló una carta +2 a ${myPlayerName}!`);
}

function movePets() {
  const llama = document.getElementById('bad-pet');
  const loro = document.getElementById('good-pet');
  
  if (llama) {
    llama.style.left = `${Math.floor(Math.random() * (window.innerWidth - 100))}px`;
    llama.style.top = `${Math.floor(Math.random() * (window.innerHeight - 100))}px`;
  }
  if (loro) {
    loro.style.left = `${Math.floor(Math.random() * (window.innerWidth - 100))}px`;
    loro.style.top = `${Math.floor(Math.random() * (window.innerHeight - 100))}px`;
  }
}

setInterval(movePets, 4000);

function handleChatKey(event) {
  if (event.key === 'Enter') {
    const input = document.getElementById('l4d-chat-input');
    if (input.value.trim()) {
      sendL4DMessage(myPlayerName, input.value.trim());
      input.value = '';
    }
  }
}

function sendL4DMessage(sender, text) {
  if (chatRef) chatRef.push({ sender, text });
  else renderL4DMessage({ sender, text });
}

function renderL4DMessage(msgData) {
  const container = document.getElementById('l4d-chat-messages');
  if (!container) return;
  const msgEl = document.createElement('div');
  msgEl.className = 'l4d-msg';
  msgEl.innerHTML = `<strong>${msgData.sender}:</strong> ${msgData.text}`;
  container.appendChild(msgEl);
  container.scrollTop = container.scrollHeight;
}