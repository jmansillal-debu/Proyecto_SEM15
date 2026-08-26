// CONFIGURACIÓN DE FIREBASE (FORMATO COMPAT DE CDN)
const firebaseConfig = {
  apiKey: "AIzaSyD3ENYHqV1eFLPUMAc6HnusYG7-6S-iyqg",
  authDomain: "proyectouno-84196.firebaseapp.com",
  databaseURL: "https://proyectouno-84196-default-rtdb.firebaseio.com",
  projectId: "proyectouno-84196",
  storageBucket: "proyectouno-84196.firebasestorage.app",
  messagingSenderId: "926454626159",
  appId: "1:926454626159:web:f1cfb4836a810ac1a91a9a",
  measurementId: "G-V966LGLNZB"
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

// CONTADORES DE CLICS PARA MASCOTAS (REQUERIMIENTO: 40 CLICS)
let llamaClicks = 0;
let loroClicks = 0;

const COLORS = ['rojo', 'azul', 'verde', 'amarillo'];
const VALUES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '+2', '+4', '+6', '+8', '🚫', '🔄'];

function initHistory() {
  if (isFirebaseConnected && db) {
    db.ref('history/winners').on('value', snapshot => {
      const list = document.getElementById('winners-history-list');
      if (!list) return;
      list.innerHTML = '';
      if (snapshot.exists()) {
        Object.values(snapshot.val()).reverse().forEach(item => {
          list.innerHTML += `<li><b>${item.name}</b> [${item.date}]</li>`;
        });
      } else { list.innerHTML = '<li class="empty-msg">Sin registro de victorias.</li>'; }
    });

    db.ref('history/players').on('value', snapshot => {
      const list = document.getElementById('all-players-history-list');
      if (!list) return;
      list.innerHTML = '';
      if (snapshot.exists()) {
        Object.values(snapshot.val()).reverse().forEach(item => {
          list.innerHTML += `<li><b>${item.name}</b> (${item.skill})</li>`;
        });
      } else { list.innerHTML = '<li class="empty-msg">Sin datos.</li>'; }
    });
  }
}

function savePlayerRegistration(name, skill) {
  if (isFirebaseConnected && db) {
    db.ref('history/players').push({ name, skill, date: new Date().toLocaleTimeString() });
  }
}

document.addEventListener('DOMContentLoaded', () => { 
  initHistory();
  initRoamingPets();
});

function selectAvatar(element, url, skillName, skillDesc) {
  document.querySelectorAll('.avatar-card').forEach(el => el.classList.remove('selected'));
  element.classList.add('selected');
  selectedAvatarUrl = url;
  selectedSkill = skillName;
  document.getElementById('skill-description').innerText = '> Habilidad: ' + skillDesc;
}

function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId)?.classList.add('active');
}

function getPlayerName() {
  const input = document.getElementById('player-name-input').value.trim();
  if (!input) { alert('ERROR: Ingrese un ID válido.'); return null; }
  myPlayerName = input;
  savePlayerRegistration(myPlayerName, selectedSkill);
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
      if (!snapshot.exists()) return alert('Error: Sala inexistente.');
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
    document.getElementById('lobby-players-list').innerHTML = playersArr.map(p => `<li>> <b>${p.name}</b> (${p.skill})</li>`).join('');
    document.getElementById('btn-start-game').style.display = currentGameState.host === myPlayerId ? 'block' : 'none';
  } else if (currentGameState.status === 'playing') {
    showScreen('screen-game');
    renderGameBoard();
  }
}

function renderGameBoard() {
  const turnPlayerId = currentGameState.turnOrder[currentGameState.currentTurnIndex];
  const isMyTurn = turnPlayerId === myPlayerId;

  document.getElementById('turn-display').innerText = isMyTurn ? 'TU TURNO' : currentGameState.players[turnPlayerId]?.name;
  document.getElementById('active-color-indicator').className = 'color-badge c-' + currentGameState.activeColor;
  document.getElementById('stack-display').innerText = '+' + (currentGameState.stack || 0);

  // MESA CENTRAL
  const topCardSpot = document.getElementById('top-card');
  if (topCardSpot && currentGameState.topCard) {
    topCardSpot.className = `cyber-card c-${currentGameState.topCard.color}`;
    topCardSpot.innerHTML = `
      <span class="card-corner">${currentGameState.topCard.value}</span>
      <div class="card-inner">${currentGameState.topCard.value}</div>
    `;
  }

  renderOpponents(turnPlayerId);
  renderMyHand(isMyTurn);
}

// RENDERIZADO DE OPONENTES COMPACTO CON CARTAS VISIBLES DERSO
function renderOpponents(turnPlayerId) {
  const container = document.getElementById('opponents-zone');
  if (!container) return;
  container.innerHTML = '';

  Object.values(currentGameState.players || {}).forEach(player => {
    if (player.id === myPlayerId) return;

    const isTurn = player.id === turnPlayerId;
    const cardCount = player.hand ? player.hand.length : 0;
    
    let cardsBackHTML = '';
    for(let i = 0; i < Math.min(cardCount, 8); i++) {
      cardsBackHTML += `<div class="opp-card-back"></div>`;
    }

    const oppEl = document.createElement('div');
    oppEl.className = `opponent-mini-card ${isTurn ? 'active-turn' : ''}`;
    oppEl.innerHTML = `
      <img src="${player.avatar}" class="opp-avatar">
      <div class="opp-info">
        <span class="opp-name">${player.name}</span>
        <div class="opp-cards-fan">${cardsBackHTML} (${cardCount})</div>
      </div>
    `;
    container.appendChild(oppEl);
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
    cardEl.className = `cyber-card c-${card.color}`;
    cardEl.innerHTML = `
      <span class="card-corner">${card.value}</span>
      <div class="card-inner">${card.value}</div>
    `;
    cardEl.onclick = () => { if (isMyTurn) playCard(card); };
    container.appendChild(cardEl);
  });
}

// LÓGICA DE CLICS EN MASCOTAS (exactamente 40 clics)
function handleLlamaClick() {
  llamaClicks++;
  document.getElementById('llama-clicks').innerText = llamaClicks;
  if (llamaClicks >= 40) {
    llamaClicks = 0;
    document.getElementById('llama-clicks').innerText = 0;
    let myHand = [...(currentGameState?.players[myPlayerId]?.hand || [])];
    myHand.push({ color: 'negro', value: '+2', id: Math.random().toString(36).substr(2, 9) });

    if (roomRef) roomRef.child(`players/${myPlayerId}/hand`).set(myHand);
    else { currentGameState.players[myPlayerId].hand = myHand; updateUI(); }
    sendL4DMessage('SISTEMA', `🦙 ¡Dron Llama completó 40 impactos y otorgó +1 carta a ${myPlayerName}!`);
  }
}

function handleGoodPetClick() {
  loroClicks++;
  document.getElementById('loro-clicks').innerText = loroClicks;
  if (loroClicks >= 40) {
    loroClicks = 0;
    document.getElementById('loro-clicks').innerText = 0;
    let myHand = [...(currentGameState?.players[myPlayerId]?.hand || [])];

    if (myHand.length <= 1) {
      sendL4DMessage('SISTEMA', `🦜 ¡${myPlayerName} intentó purgar su última carta con el Loro! Penalización +4.`);
      for (let i = 0; i < 4; i++) {
        myHand.push({ color: COLORS[i % 4], value: `${i + 1}`, id: Math.random().toString(36).substr(2, 9) });
      }
    } else {
      myHand.pop();
      sendL4DMessage('SISTEMA', `🦜 ¡Dron Loro completó 40 impactos y purgó 1 carta de ${myPlayerName}!`);
    }

    if (roomRef) roomRef.child(`players/${myPlayerId}/hand`).set(myHand);
    else { currentGameState.players[myPlayerId].hand = myHand; updateUI(); }
  }
}

// MOVIMIENTO LENTO Y FLUIDO POR TODA LA PANTALLA
function initRoamingPets() {
  const badPet = document.getElementById('bad-pet');
  const goodPet = document.getElementById('good-pet');

  function movePet(petEl) {
    if (!petEl) return;
    const maxX = window.innerWidth - 100;
    const maxY = window.innerHeight - 100;
    const randomX = Math.floor(Math.random() * maxX);
    const randomY = Math.floor(Math.random() * maxY);
    petEl.style.left = `${randomX}px`;
    petEl.style.top = `${randomY}px`;
  }

  setInterval(() => movePet(badPet), 4000);
  setInterval(() => movePet(goodPet), 5000);
}

function useSpecialSkill() {
  if (hasUsedSkill) return alert('Habilidad agotada.');
  hasUsedSkill = true;

  if (selectedSkill === 'Escudo Táctico') {
    currentGameState.stack = 0;
    sendL4DMessage('HABILIDAD', `¡${myPlayerName} desplegó Escudo Táctico!`);
  } else if (selectedSkill === 'Robo Rápido') {
    let myHand = currentGameState.players[myPlayerId].hand;
    myHand.push({ color: 'negro', value: '+4', id: Math.random().toString(36).substr(2, 9) });
    sendL4DMessage('HABILIDAD', `¡${myPlayerName} ejecutó Inyección de Suma (+4)!`);
  }
  updateUI();
}

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
  msgEl.className = 'chat-msg';
  msgEl.innerHTML = `<b>${msgData.sender}:</b> ${msgData.text}`;
  container.appendChild(msgEl);
  container.scrollTop = container.scrollHeight;
}
