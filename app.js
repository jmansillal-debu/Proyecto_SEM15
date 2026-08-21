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

// Intentar inicializar Firebase
try {
  if (typeof firebase !== 'undefined' && firebaseConfig.apiKey !== "TU_API_KEY_REAL") {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    db = firebase.database();
    isFirebaseConnected = true;
  }
} catch (e) {
  console.warn("Firebase no está configurado correctamente. Usando modo de prueba local.", e);
}

// Estado global del cliente
let myPlayerId = 'p_' + Math.random().toString(36).substr(2, 9);
let myPlayerName = '';
let currentRoomCode = null;
let roomRef = null;
let chatRef = null;
let currentGameState = null;
let pendingWildCard = null;

const COLORS = ['rojo', 'azul', 'verde', 'amarillo'];
const VALUES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '+2', '🚫', '🔄'];

// NAVEGACIÓN Y MENÚS
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(screenId);
  if (target) target.classList.add('active');
}

function getPlayerName() {
  const input = document.getElementById('player-name-input').value.trim();
  if (!input) {
    alert('Por favor introduce tu apodo.');
    return null;
  }
  myPlayerName = input;
  return myPlayerName;
}

function createRoom() {
  if (!getPlayerName()) return;

  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  currentRoomCode = code;

  const initialRoomData = {
    code: code,
    host: myPlayerId,
    status: 'waiting',
    stack: 0,
    activeColor: 'rojo',
    currentTurnIndex: 0,
    turnOrder: [myPlayerId],
    topCard: null,
    deck: generateDeck(),
    players: {
      [myPlayerId]: {
        id: myPlayerId,
        name: myPlayerName,
        hand: [],
        saidUno: false,
        isHost: true
      }
    }
  };

  if (isFirebaseConnected && db) {
    roomRef = db.ref('rooms/' + code);
    roomRef.set(initialRoomData)
      .then(() => {
        listenToRoom();
        showScreen('screen-lobby');
      })
      .catch(err => {
        console.error("Error al crear la sala en Firebase:", err);
        alert("Error de conexión con Firebase. Iniciando en modo local.");
        startLocalRoom(initialRoomData);
      });
  } else {
    // Modo Local
    startLocalRoom(initialRoomData);
  }
}

function startLocalRoom(initialData) {
  currentGameState = initialData;
  const display = document.getElementById('lobby-code-display');
  if (display) display.innerText = currentRoomCode;
  updateUI();
  showScreen('screen-lobby');
}

function joinRoom() {
  if (!getPlayerName()) return;
  const code = document.getElementById('room-code-input').value.trim().toUpperCase();
  if (!code) {
    alert('Ingresa un código de sala válido.');
    return;
  }

  currentRoomCode = code;

  if (isFirebaseConnected && db) {
    roomRef = db.ref('rooms/' + code);
    roomRef.once('value', snapshot => {
      if (!snapshot.exists()) {
        alert('La sala no existe.');
        return;
      }
      const data = snapshot.val();
      if (data.status !== 'waiting') {
        alert('La partida ya ha comenzado o ha finalizado.');
        return;
      }

      roomRef.child('players/' + myPlayerId).set({
        id: myPlayerId,
        name: myPlayerName,
        hand: [],
        saidUno: false,
        isHost: false
      }).then(() => {
        listenToRoom();
        showScreen('screen-lobby');
      }).catch(err => {
        alert("Error al unirse a la sala: " + err.message);
      });
    });
  } else {
    alert('Modo local: Para jugar multijugador entre varios dispositivos, debes ingresar tu API Key de Firebase en app.js.');
  }
}

// LÓGICA DE BARAJA Y JUEGO
function generateDeck() {
  let deck = [];
  COLORS.forEach(color => {
    VALUES.forEach(val => {
      deck.push({ color, value: val, id: Math.random().toString(36).substr(2, 9) });
      if (val !== '0') deck.push({ color, value: val, id: Math.random().toString(36).substr(2, 9) });
    });
  });

  // Cartas Especiales (Negras)
  for (let i = 0; i < 4; i++) {
    deck.push({ color: 'negro', value: '★', id: Math.random().toString(36).substr(2, 9) });
    deck.push({ color: 'negro', value: '+4', id: Math.random().toString(36).substr(2, 9) });
  }

  // Mezclar
  return deck.sort(() => Math.random() - 0.5);
}

function listenToRoom() {
  const display = document.getElementById('lobby-code-display');
  if (display) display.innerText = currentRoomCode;

  if (roomRef) {
    roomRef.on('value', snapshot => {
      if (!snapshot.exists()) return;
      currentGameState = snapshot.val();
      updateUI();
    });
  }

  if (isFirebaseConnected && db) {
    chatRef = db.ref('chats/' + currentRoomCode);
    chatRef.on('value', snapshot => {
      if (!snapshot.exists()) return;
      renderChat(snapshot.val());
    });
  }
}

// Cargar Historial de Ganadores al iniciar
if (isFirebaseConnected && db) {
  db.ref('winners').limitToLast(5).on('value', snapshot => {
    const list = document.getElementById('winners-history-list');
    if (!snapshot.exists()) {
      if (list) list.innerHTML = '<li style="padding:10px; opacity:0.6;">Sin victorias aún</li>';
      return;
    }
    renderWinners(snapshot.val());
  }, err => {
    console.error("Error al cargar historial:", err);
    setFallbackWinners();
  });
} else {
  window.addEventListener('DOMContentLoaded', () => {
    setFallbackWinners();
  });
}

function setFallbackWinners() {
  const list = document.getElementById('winners-history-list');
  if (list) {
    list.innerHTML = `
      <li class="winner-item"><span>Demo Player</span> <span>12:00</span></li>
      <li class="winner-item"><span>Mesa Lista</span> <span>Local</span></li>
    `;
  }
}

function startGame() {
  if (!currentGameState) return;

  const playerKeys = Object.keys(currentGameState.players || {});
  let deck = [...currentGameState.deck];
  let players = { ...currentGameState.players };

  playerKeys.forEach(pId => {
    players[pId].hand = deck.splice(0, 7);
  });

  let topCard = deck.pop();
  while (topCard && topCard.color === 'negro') {
    deck.unshift(topCard);
    topCard = deck.pop();
  }

  const updatedState = {
    ...currentGameState,
    status: 'playing',
    deck: deck,
    players: players,
    topCard: topCard,
    activeColor: topCard ? topCard.color : 'rojo',
    turnOrder: playerKeys,
    currentTurnIndex: 0
  };

  currentGameState = updatedState;

  if (roomRef) {
    roomRef.update(updatedState);
  } else {
    updateUI();
  }
}

function updateUI() {
  if (!currentGameState) return;

  if (currentGameState.status === 'waiting') {
    showScreen('screen-lobby');
    const playersArr = Object.values(currentGameState.players || {});
    const pCount = document.getElementById('player-count');
    if (pCount) pCount.innerText = playersArr.length;

    const list = document.getElementById('lobby-players-list');
    if (list) {
      list.innerHTML = playersArr.map(p => `<li>${p.name} ${p.isHost ? '👑' : ''}</li>`).join('');
    }

    const btnStart = document.getElementById('btn-start-game');
    const msgWait = document.getElementById('waiting-msg');

    if (currentGameState.host === myPlayerId) {
      if (btnStart) btnStart.style.display = 'block';
      if (msgWait) msgWait.style.display = 'none';
    } else {
      if (btnStart) btnStart.style.display = 'none';
      if (msgWait) msgWait.style.display = 'block';
    }
  } else if (currentGameState.status === 'playing') {
    showScreen('screen-game');
    renderGameBoard();
  }
}

function renderGameBoard() {
  const turnPlayerId = currentGameState.turnOrder[currentGameState.currentTurnIndex];
  const isMyTurn = turnPlayerId === myPlayerId;
  const turnPlayerName = currentGameState.players[turnPlayerId]?.name || '---';

  const turnDisp = document.getElementById('turn-display');
  if (turnDisp) {
    turnDisp.innerText = isMyTurn ? '¡TU TURNO!' : turnPlayerName;
    turnDisp.style.color = isMyTurn ? '#ffb300' : '#fff';
  }

  const colorInd = document.getElementById('active-color-indicator');
  if (colorInd) colorInd.className = 'color-dot c-' + currentGameState.activeColor;

  const stackDisp = document.getElementById('stack-display');
  if (stackDisp) stackDisp.innerText = '+' + (currentGameState.stack || 0);

  const topCardSpot = document.getElementById('top-card');
  if (topCardSpot && currentGameState.topCard) {
    topCardSpot.className = `unocard c-${currentGameState.topCard.color}`;
    topCardSpot.innerHTML = `
      <span class="card-corner">${currentGameState.topCard.value}</span>
      <div class="card-inner">${currentGameState.topCard.value}</div>
      <span class="card-corner bottom">${currentGameState.topCard.value}</span>
    `;
  }

  renderOpponents(turnPlayerId);
  renderMyHand(isMyTurn);
}

function renderOpponents(activeTurnId) {
  const board = document.getElementById('opponents-zone');
  if (!board) return;
  board.innerHTML = '';

  const opponents = Object.values(currentGameState.players || {}).filter(p => p.id !== myPlayerId);
  const positions = ['opp-pos-top', 'opp-pos-left', 'opp-pos-right'];

  opponents.forEach((opp, idx) => {
    const posClass = positions[idx % positions.length];
    const isActiveClass = opp.id === activeTurnId ? 'active' : '';

    let cardsBackHTML = '';
    const cardCount = (opp.hand || []).length;
    for (let i = 0; i < Math.min(cardCount, 5); i++) {
      cardsBackHTML += `<div class="mini-card-back"></div>`;
    }

    const div = document.createElement('div');
    div.className = `opponent-card ${posClass} ${isActiveClass}`;
    div.innerHTML = `
      <span class="opp-name">${opp.name} (${cardCount})</span>
      <div class="opp-hand-visual">${cardsBackHTML}</div>
    `;
    board.appendChild(div);
  });
}

function renderMyHand(isMyTurn) {
  const container = document.getElementById('my-hand');
  if (!container) return;
  container.innerHTML = '';

  const myData = currentGameState.players[myPlayerId];
  if (!myData || !myData.hand) return;

  const cardCountElem = document.getElementById('my-card-count');
  if (cardCountElem) cardCountElem.innerText = myData.hand.length;

  myData.hand.forEach((card) => {
    const cardEl = document.createElement('div');
    cardEl.className = `unocard c-${card.color}`;
    cardEl.innerHTML = `
      <span class="card-corner">${card.value}</span>
      <div class="card-inner">${card.value}</div>
      <span class="card-corner bottom">${card.value}</span>
    `;

    cardEl.onclick = () => {
      if (isMyTurn) playCard(card);
    };

    container.appendChild(cardEl);
  });
}

function playCard(card) {
  const top = currentGameState.topCard;
  const activeColor = currentGameState.activeColor;
  const stack = currentGameState.stack || 0;

  let isValid = false;

  if (stack > 0) {
    if (card.value === '+2' || card.value === '+4') {
      isValid = true;
    }
  } else {
    if (card.color === 'negro' || card.color === activeColor || card.value === top.value) {
      isValid = true;
    }
  }

  if (!isValid) return;

  if (card.color === 'negro') {
    pendingWildCard = card;
    const modal = document.getElementById('color-modal');
    if (modal) modal.classList.remove('hidden');
  } else {
    executeMove(card, card.color);
  }
}

function selectColor(color) {
  const modal = document.getElementById('color-modal');
  if (modal) modal.classList.add('hidden');
  if (pendingWildCard) {
    executeMove(pendingWildCard, color);
    pendingWildCard = null;
  }
}

function executeMove(card, chosenColor) {
  let myHand = [...currentGameState.players[myPlayerId].hand];
  myHand = myHand.filter(c => c.id !== card.id);

  let newStack = currentGameState.stack || 0;
  if (card.value === '+2') newStack += 2;
  if (card.value === '+4') newStack += 4;

  if (myHand.length === 0) {
    if (roomRef) {
      db.ref('winners').push({
        name: myPlayerName,
        date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
      roomRef.update({ status: 'waiting' });
    }
    alert('¡HAS GANADO LA PARTIDA!');
    showScreen('screen-menu');
    return;
  }

  let nextIndex = currentGameState.currentTurnIndex;
  let step = card.value === '🔄' ? -1 : 1;

  if (card.value === '🚫') {
    nextIndex = getNextTurnIndex(nextIndex, step * 2);
  } else {
    nextIndex = getNextTurnIndex(nextIndex, step);
  }

  currentGameState.players[myPlayerId].hand = myHand;
  currentGameState.topCard = card;
  currentGameState.activeColor = chosenColor;
  currentGameState.stack = newStack;
  currentGameState.currentTurnIndex = nextIndex;

  if (roomRef) {
    const updates = {};
    updates[`players/${myPlayerId}/hand`] = myHand;
    updates['topCard'] = card;
    updates['activeColor'] = chosenColor;
    updates['stack'] = newStack;
    updates['currentTurnIndex'] = nextIndex;
    roomRef.update(updates);
  } else {
    updateUI();
  }
}

function getNextTurnIndex(currentIndex, step) {
  const total = currentGameState.turnOrder.length;
  let next = (currentIndex + step) % total;
  if (next < 0) next += total;
  return next;
}

function drawCardCurrentPlayer() {
  const turnPlayerId = currentGameState.turnOrder[currentGameState.currentTurnIndex];
  if (turnPlayerId !== myPlayerId) return;

  let deck = [...(currentGameState.deck || [])];
  let myHand = [...(currentGameState.players[myPlayerId].hand || [])];
  let stack = currentGameState.stack || 0;

  if (deck.length < Math.max(1, stack)) {
    deck = generateDeck();
  }

  const drawCount = stack > 0 ? stack : 1;
  for (let i = 0; i < drawCount; i++) {
    if (deck.length > 0) {
      myHand.push(deck.pop());
    }
  }

  const nextIndex = getNextTurnIndex(currentGameState.currentTurnIndex, 1);

  currentGameState.deck = deck;
  currentGameState.stack = 0;
  currentGameState.players[myPlayerId].hand = myHand;
  currentGameState.currentTurnIndex = nextIndex;

  if (roomRef) {
    roomRef.update({
      deck: deck,
      stack: 0,
      [`players/${myPlayerId}/hand`]: myHand,
      currentTurnIndex: nextIndex
    });
  } else {
    updateUI();
  }
}

function sayUno() {
  const myHand = currentGameState.players[myPlayerId]?.hand || [];
  if (myHand.length === 1) {
    if (chatRef) {
      chatRef.push({
        sender: 'SISTEMA',
        text: `¡${myPlayerName} ha cantado ¡UNO!!`
      });
    } else {
      alert('¡Has cantado UNO!');
    }
  } else {
    alert('Solo puedes cantar UNO si te queda exactamente 1 carta.');
  }
}

function toggleChat() {
  const chatBox = document.getElementById('chat-box');
  if (chatBox) chatBox.classList.toggle('hidden');
  const badge = document.getElementById('chat-badge');
  if (badge) badge.innerText = '0';
}

function sendChatMessage() {
  const input = document.getElementById('chat-input');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  if (chatRef) {
    chatRef.push({
      sender: myPlayerName,
      text: text
    });
  }
  input.value = '';
}

function handleChatKey(event) {
  if (event.key === 'Enter') {
    sendChatMessage();
  }
}

function renderChat(messagesObj) {
  const container = document.getElementById('chat-messages');
  if (!container) return;
  container.innerHTML = '';

  const msgs = Object.values(messagesObj);
  msgs.forEach(m => {
    const div = document.createElement('div');
    div.className = 'chat-msg';
    div.innerHTML = `<strong>${m.sender}</strong><span>${m.text}</span>`;
    container.appendChild(div);
  });

  container.scrollTop = container.scrollHeight;
}

function renderWinners(winnersObj) {
  const list = document.getElementById('winners-history-list');
  if (!list) return;
  list.innerHTML = '';
  const winners = Object.values(winnersObj).reverse();

  winners.forEach(w => {
    const li = document.createElement('li');
    li.className = 'winner-item';
    li.innerHTML = `<span>${w.name}</span> <span>${w.date || ''}</span>`;
    list.appendChild(li);
  });
}