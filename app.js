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
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    db = firebase.database();
    isFirebaseConnected = true;
  }
} catch (e) {
  console.warn("Modo local activado.", e);
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

// Mascotas y Jerga Peruana
const PET_AVATARS = ['🦙', '🦫', '🦜', '🦝'];
let currentPetIndex = 0;
const PERU_PHRASES = [
  "¡Habla causa!",
  "¡Paga tu +4 pues!",
  "¡Oe, no seas fino!",
  "¡Asu mare, qué buena carta!",
  "¡Ya fuiste mano!",
  "¡Canta UNO o te caigo!",
  "¡Aguanta ahí, pe!",
  "¡No me florees!"
];

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
    winnerName: null,
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
      .catch(() => startLocalRoom(initialRoomData));
  } else {
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
        alert('La partida ya inició.');
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
      });
    });
  } else {
    alert('Se requiere conexión Firebase activa para unirse a salas remotas.');
  }
}

function generateDeck() {
  let deck = [];
  COLORS.forEach(color => {
    VALUES.forEach(val => {
      deck.push({ color, value: val, id: Math.random().toString(36).substr(2, 9) });
      if (val !== '0') deck.push({ color, value: val, id: Math.random().toString(36).substr(2, 9) });
    });
  });

  for (let i = 0; i < 4; i++) {
    deck.push({ color: 'negro', value: '★', id: Math.random().toString(36).substr(2, 9) });
    deck.push({ color: 'negro', value: '+4', id: Math.random().toString(36).substr(2, 9) });
  }

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
    chatRef.on('child_added', snapshot => {
      if (snapshot.exists()) {
        renderL4DMessage(snapshot.val());
      }
    });
  }
}

// CARGAR HISTORIAL CON GANADOR Y JUGADORES
if (isFirebaseConnected && db) {
  db.ref('winners').limitToLast(5).on('value', snapshot => {
    if (!snapshot.exists()) {
      setFallbackWinners();
      return;
    }
    renderWinners(snapshot.val());
  });
} else {
  window.addEventListener('DOMContentLoaded', () => setFallbackWinners());
}

function setFallbackWinners() {
  const list = document.getElementById('winners-history-list');
  if (list) {
    list.innerHTML = `
      <li class="winner-item">
        <div class="winner-header"><span>🏆 Fernando</span> <span>12:00</span></div>
        <div class="winner-players">Jugadores: Fernando, Carlos, Ana</div>
      </li>
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
    currentTurnIndex: 0,
    winnerName: null
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
    document.getElementById('winner-modal')?.classList.add('hidden');
    showScreen('screen-lobby');
    const playersArr = Object.values(currentGameState.players || {});
    
    document.getElementById('player-count').innerText = playersArr.length;
    document.getElementById('lobby-players-list').innerHTML = playersArr.map(p => `<li>${p.name} ${p.isHost ? '👑' : ''}</li>`).join('');

    const btnStart = document.getElementById('btn-start-game');
    const msgWait = document.getElementById('waiting-msg');

    if (currentGameState.host === myPlayerId) {
      btnStart.style.display = 'block';
      msgWait.style.display = 'none';
    } else {
      btnStart.style.display = 'none';
      msgWait.style.display = 'block';
    }
  } else if (currentGameState.status === 'playing') {
    showScreen('screen-game');
    renderGameBoard();
  } else if (currentGameState.status === 'ended') {
    showScreen('screen-game');
    const modal = document.getElementById('winner-modal');
    document.getElementById('winner-name-display').innerText = currentGameState.winnerName || "---";
    modal.classList.remove('hidden');
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

  document.getElementById('active-color-indicator').className = 'color-dot c-' + currentGameState.activeColor;
  document.getElementById('stack-display').innerText = '+' + (currentGameState.stack || 0);

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

  document.getElementById('my-card-count').innerText = myData.hand.length;

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
    if (card.value === '+2' || card.value === '+4') isValid = true;
  } else {
    if (card.color === 'negro' || card.color === activeColor || card.value === top.value) isValid = true;
  }

  if (!isValid) return;

  if (card.color === 'negro') {
    pendingWildCard = card;
    document.getElementById('color-modal')?.classList.remove('hidden');
  } else {
    executeMove(card, card.color);
  }
}

function selectColor(color) {
  document.getElementById('color-modal')?.classList.add('hidden');
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

  triggerPetInteraction();

  // VERIFICAR GANADOR
  if (myHand.length === 0) {
    const allPlayerNames = Object.values(currentGameState.players).map(p => p.name).join(', ');

    if (isFirebaseConnected && db) {
      db.ref('winners').push({
        winner: myPlayerName,
        players: allPlayerNames,
        date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });

      roomRef.update({
        status: 'ended',
        winnerName: myPlayerName
      });
    } else {
      currentGameState.status = 'ended';
      currentGameState.winnerName = myPlayerName;
      updateUI();
    }
    return;
  }

  let nextIndex = currentGameState.currentTurnIndex;
  let step = card.value === '🔄' ? -1 : 1;

  if (card.value === '🚫') {
    nextIndex = getNextTurnIndex(nextIndex, step * 2);
  } else {
    nextIndex = getNextTurnIndex(nextIndex, step);
  }

  if (roomRef) {
    const updates = {};
    updates[`players/${myPlayerId}/hand`] = myHand;
    updates['topCard'] = card;
    updates['activeColor'] = chosenColor;
    updates['stack'] = newStack;
    updates['currentTurnIndex'] = nextIndex;
    roomRef.update(updates);
  } else {
    currentGameState.players[myPlayerId].hand = myHand;
    currentGameState.topCard = card;
    currentGameState.activeColor = chosenColor;
    currentGameState.stack = newStack;
    currentGameState.currentTurnIndex = nextIndex;
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

  if (deck.length < Math.max(1, stack)) deck = generateDeck();

  const drawCount = stack > 0 ? stack : 1;
  for (let i = 0; i < drawCount; i++) {
    if (deck.length > 0) myHand.push(deck.pop());
  }

  const nextIndex = getNextTurnIndex(currentGameState.currentTurnIndex, 1);

  if (roomRef) {
    roomRef.update({
      deck: deck,
      stack: 0,
      [`players/${myPlayerId}/hand`]: myHand,
      currentTurnIndex: nextIndex
    });
  } else {
    currentGameState.deck = deck;
    currentGameState.stack = 0;
    currentGameState.players[myPlayerId].hand = myHand;
    currentGameState.currentTurnIndex = nextIndex;
    updateUI();
  }
}

function sayUno() {
  const myHand = currentGameState.players[myPlayerId]?.hand || [];
  if (myHand.length === 1) {
    sendL4DMessage(`SISTEMA`, `¡${myPlayerName} ha cantado ¡UNO!!`);
  } else {
    alert('Solo puedes cantar UNO con 1 carta en la mano.');
  }
}

// CHAT LEFT 4 DEAD 2
function handleChatKey(event) {
  if (event.key === 'Enter') {
    const input = document.getElementById('l4d-chat-input');
    const text = input.value.trim();
    if (text) {
      sendL4DMessage(myPlayerName, text);
      input.value = '';
    }
  }
}

function sendL4DMessage(sender, text) {
  if (chatRef) {
    chatRef.push({ sender, text, timestamp: Date.now() });
  } else {
    renderL4DMessage({ sender, text });
  }
}

function renderL4DMessage(msgData) {
  const container = document.getElementById('l4d-chat-messages');
  if (!container) return;

  const msgEl = document.createElement('div');
  msgEl.className = 'l4d-msg';
  msgEl.innerHTML = `<strong>${msgData.sender}:</strong><span>${msgData.text}</span>`;

  container.appendChild(msgEl);

  setTimeout(() => {
    msgEl.remove();
  }, 6000);
}

// MASCOTA INTERACTIVA
function triggerPetInteraction() {
  const petEl = document.getElementById('pet-avatar');
  const speechEl = document.getElementById('pet-speech');
  if (!petEl || !speechEl) return;

  currentPetIndex = (currentPetIndex + 1) % PET_AVATARS.length;
  petEl.innerText = PET_AVATARS[currentPetIndex];

  const randomPhrase = PERU_PHRASES[Math.floor(Math.random() * PERU_PHRASES.length)];
  speechEl.innerText = randomPhrase;
  speechEl.classList.remove('hidden');

  setTimeout(() => {
    speechEl.classList.add('hidden');
  }, 2500);
}

function returnToLobby() {
  if (roomRef && currentGameState.host === myPlayerId) {
    roomRef.update({ status: 'waiting' });
  } else if (!roomRef) {
    currentGameState.status = 'waiting';
    updateUI();
  } else {
    showScreen('screen-lobby');
  }
}

function renderWinners(winnersObj) {
  const list = document.getElementById('winners-history-list');
  if (!list) return;
  list.innerHTML = '';

  const winners = Object.values(winnersObj).reverse();
  winners.forEach(w => {
    const li = document.createElement('li');
    li.className = 'winner-item';
    li.innerHTML = `
      <div class="winner-header"><span>🏆 ${w.winner}</span> <span>${w.date || ''}</span></div>
      <div class="winner-players">Jugadores: ${w.players || 'Varios'}</div>
    `;
    list.appendChild(li);
  });
}