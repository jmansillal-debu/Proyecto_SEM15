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
// CONFIGURACIÓN DE FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyD-EXAMPLE_KEY_1234567890",
  authDomain: "tu-proyecto.firebaseapp.com",
  databaseURL: "https://tu-proyecto-default-rtdb.firebaseio.com",
  projectId: "tu-proyecto",
  storageBucket: "tu-proyecto.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef123456"
};

let db = null;
let isFirebaseConnected = false;

try {
  if (typeof firebase !== 'undefined' && firebaseConfig.apiKey !== "TU_API_KEY_REAL") {
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    db = firebase.database();
    isFirebaseConnected = true;
  }
} catch (e) {
  console.warn("Modo local activado.", e);
}

// Estado global
let myPlayerId = 'p_' + Math.random().toString(36).substr(2, 9);
let myPlayerName = '';
let selectedAvatarUrl = './assets/foto1.png';
let currentRoomCode = null;
let roomRef = null;
let chatRef = null;
let currentGameState = null;
let pendingWildCard = null;

// Temporizador
let turnTimer = null;
let timeLeft = 10;

const COLORS = ['rojo', 'azul', 'verde', 'amarillo'];
const VALUES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '+2', '+4', '+6', '+8', '🚫', '🔄'];

// Clicks Mascotas
let badPetClicks = 0;
let targetBadClicks = Math.floor(Math.random() * (10 - 5 + 1)) + 5;

let goodPetClicks = 0;
let targetGoodClicks = Math.floor(Math.random() * (50 - 30 + 1)) + 30;

function selectAvatar(element, url) {
  document.querySelectorAll('.avatar-option').forEach(el => el.classList.remove('selected'));
  element.classList.add('selected');
  selectedAvatarUrl = url;
}

function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(screenId);
  if (target) target.classList.add('active');
}

function getPlayerName() {
  const input = document.getElementById('player-name-input').value.trim();
  if (!input) {
    alert('Introduce tu apodo.');
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
      [myPlayerId]: { id: myPlayerId, name: myPlayerName, avatar: selectedAvatarUrl, hand: [], saidUno: false, isHost: true }
    }
  };

  if (isFirebaseConnected && db) {
    roomRef = db.ref('rooms/' + code);
    roomRef.set(initialRoomData).then(() => {
      listenToRoom();
      showScreen('screen-lobby');
    }).catch(() => startLocalRoom(initialRoomData));
  } else {
    startLocalRoom(initialRoomData);
  }
}

function startLocalRoom(initialData) {
  currentGameState = initialData;
  document.getElementById('lobby-code-display').innerText = currentRoomCode;
  updateUI();
  showScreen('screen-lobby');
}

function joinRoom() {
  if (!getPlayerName()) return;
  const code = document.getElementById('room-code-input').value.trim().toUpperCase();
  if (!code) return alert('Ingresa un código válido.');

  currentRoomCode = code;

  if (isFirebaseConnected && db) {
    roomRef = db.ref('rooms/' + code);
    roomRef.once('value', snapshot => {
      if (!snapshot.exists()) return alert('La sala no existe.');
      const data = snapshot.val();
      if (data.status !== 'waiting') return alert('La partida ya empezó.');

      roomRef.child('players/' + myPlayerId).set({
        id: myPlayerId, name: myPlayerName, avatar: selectedAvatarUrl, hand: [], saidUno: false, isHost: false
      }).then(() => {
        listenToRoom();
        showScreen('screen-lobby');
      });
    });
  } else {
    alert('Conexión requerida para unirse.');
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
    deck.push({ color: 'negro', value: '+8', id: Math.random().toString(36).substr(2, 9) });
  }

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

  if (roomRef) roomRef.update(updatedState);
  else { currentGameState = updatedState; updateUI(); }
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
    btnStart.style.display = currentGameState.host === myPlayerId ? 'block' : 'none';
    msgWait.style.display = currentGameState.host === myPlayerId ? 'none' : 'block';
  } else if (currentGameState.status === 'playing') {
    showScreen('screen-game');
    renderGameBoard();
    resetTurnTimer();
  } else if (currentGameState.status === 'ended') {
    clearInterval(turnTimer);
    showScreen('screen-game');
    document.getElementById('winner-name-display').innerText = currentGameState.winnerName || "---";
    document.getElementById('winner-modal')?.classList.remove('hidden');
  }
}

function resetTurnTimer() {
  clearInterval(turnTimer);
  timeLeft = 10;
  document.getElementById('timer-display').innerText = timeLeft;

  const turnPlayerId = currentGameState.turnOrder[currentGameState.currentTurnIndex];

  turnTimer = setInterval(() => {
    timeLeft--;
    document.getElementById('timer-display').innerText = timeLeft;

    if (timeLeft <= 0) {
      clearInterval(turnTimer);
      if (turnPlayerId === myPlayerId) handleTurnTimeout();
    }
  }, 1000);
}

function handleTurnTimeout() {
  const penalty = Math.floor(Math.random() * 2) + 2;
  sendL4DMessage('TIEMPO ⏳', `¡${myPlayerName} agotó 10s y recibe +${penalty} cartas!`);
  applyCardPenalty(penalty);
}

function renderGameBoard() {
  const turnPlayerId = currentGameState.turnOrder[currentGameState.currentTurnIndex];
  const isMyTurn = turnPlayerId === myPlayerId;
  const turnPlayerName = currentGameState.players[turnPlayerId]?.name || '---';

  const turnDisp = document.getElementById('turn-display');
  if (turnDisp) {
    turnDisp.innerText = isMyTurn ? '¡TU TURNO!' : turnPlayerName;
    turnDisp.style.color = isMyTurn ? '#63b3ed' : '#ffffff';
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

  opponents.forEach((opp) => {
    const isActive = opp.id === activeTurnId ? 'active' : '';
    const cardCount = (opp.hand || []).length;
    const avatarSrc = opp.avatar || './assets/foto1.png';

    const div = document.createElement('div');
    div.className = `opponent-card ${isActive}`;
    div.innerHTML = `
      <div class="opp-avatar">
        <img src="${avatarSrc}" class="opp-avatar-img">
      </div>
      <div class="opp-info">
        <span class="opp-name">${opp.name}</span>
        <span class="opp-count">🎴 ${cardCount} cartas</span>
      </div>
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

    cardEl.onclick = () => { if (isMyTurn) playCard(card); };
    container.appendChild(cardEl);
  });
}

function playCard(card) {
  const top = currentGameState.topCard;
  const activeColor = currentGameState.activeColor;
  const stack = currentGameState.stack || 0;

  let isValid = false;

  if (stack > 0) {
    if (card.value.startsWith('+')) isValid = true;
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
  if (card.value === '+6') newStack += 6;
  if (card.value === '+8') newStack += 8;

  if (myHand.length === 0) {
    const allPlayerNames = Object.values(currentGameState.players).map(p => p.name).join(', ');

    if (isFirebaseConnected && db) {
      db.ref('winners').push({ winner: myPlayerName, players: allPlayerNames, date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
      roomRef.update({ status: 'ended', winnerName: myPlayerName });
    } else {
      currentGameState.status = 'ended';
      currentGameState.winnerName = myPlayerName;
      updateUI();
    }
    return;
  }

  let nextIndex = getNextTurnIndex(currentGameState.currentTurnIndex, card.value === '🔄' ? -1 : (card.value === '🚫' ? 2 : 1));

  if (roomRef) {
    roomRef.update({
      [`players/${myPlayerId}/hand`]: myHand,
      topCard: card,
      activeColor: chosenColor,
      stack: newStack,
      currentTurnIndex: nextIndex
    });
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
  return next < 0 ? next + total : next;
}

function drawCardCurrentPlayer() {
  const turnPlayerId = currentGameState.turnOrder[currentGameState.currentTurnIndex];
  if (turnPlayerId !== myPlayerId) return;

  const stack = currentGameState.stack || 0;
  applyCardPenalty(stack > 0 ? stack : 1);
}

function applyCardPenalty(amount) {
  let deck = [...(currentGameState.deck || [])];
  let myHand = [...(currentGameState.players[myPlayerId].hand || [])];

  if (deck.length < amount) deck = generateDeck();

  for (let i = 0; i < amount; i++) {
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
  if (myHand.length === 1) sendL4DMessage(`SISTEMA`, `¡${myPlayerName} dice ¡UNO!!`);
}

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
  if (chatRef) chatRef.push({ sender, text, timestamp: Date.now() });
  else renderL4DMessage({ sender, text });
}

// CORRECCIÓN DE CHAT: AUTOSCROLL COMPLETO
function renderL4DMessage(msgData) {
  const container = document.getElementById('l4d-chat-messages');
  if (!container) return;

  const msgEl = document.createElement('div');
  msgEl.className = 'l4d-msg';
  msgEl.innerHTML = `<strong>${msgData.sender}:</strong><span>${msgData.text}</span>`;

  container.appendChild(msgEl);
  container.scrollTop = container.scrollHeight; // Mantiene el chat siempre abajo
}

// SOLO MUEVE A LA MASCOTA BUENA
function moveGoodPet() {
  const pet = document.getElementById('good-pet');
  if (!pet) return;
  pet.style.left = `${Math.floor(Math.random() * (window.innerWidth - 120)) + 20}px`;
  pet.style.top = `${Math.floor(Math.random() * (window.innerHeight - 120)) + 20}px`;
}

setInterval(moveGoodPet, 3000);
window.addEventListener('DOMContentLoaded', moveGoodPet);

function handleBadPetClick() {
  badPetClicks++;

  if (badPetClicks >= targetBadClicks) {
    badPetClicks = 0;
    targetBadClicks = Math.floor(Math.random() * (10 - 5 + 1)) + 5;
    const penalty = Math.floor(Math.random() * 2) + 2;

    const speech = document.getElementById('bad-pet-speech');
    speech.innerText = `¡ERA UNA TRAMPA! +${penalty} CARTAS 🦙💥`;

    if (currentGameState && currentGameState.status === 'playing') {
      applyCardPenalty(penalty);
      sendL4DMessage('SISTEMA 🦙', `¡${myPlayerName} cayó en la trampa y recibió +${penalty} cartas!`);
    }

    setTimeout(() => {
      speech.innerText = "¡Presiona aquí y te ayudo! 🎁";
    }, 2500);
  }
}

function handleGoodPetClick() {
  goodPetClicks++;
  const speech = document.getElementById('good-pet-speech');
  speech.innerText = "¡Sigue tocando, te ayudaré!";
  speech.classList.remove('hidden');
  setTimeout(() => speech.classList.add('hidden'), 1500);

  if (goodPetClicks >= targetGoodClicks) {
    goodPetClicks = 0;
    targetGoodClicks = Math.floor(Math.random() * (50 - 30 + 1)) + 30;
    const removeCount = Math.floor(Math.random() * 2) + 1;

    speech.innerText = `¡ME LLEVO TU CARTA! 🦜✨`;
    speech.classList.remove('hidden');

    if (currentGameState && currentGameState.status === 'playing') {
      let myHand = [...(currentGameState.players[myPlayerId].hand || [])];

      for (let i = 0; i < removeCount; i++) {
        if (myHand.length > 1) {
          myHand.pop();
          animateFlyCardToPet();
        }
      }

      setTimeout(() => {
        if (roomRef) {
          roomRef.child(`players/${myPlayerId}/hand`).set(myHand);
        } else {
          currentGameState.players[myPlayerId].hand = myHand;
          updateUI();
        }
      }, 800);

      sendL4DMessage('SISTEMA 🦜', `¡La mascota voló y se llevó ${removeCount} carta(s) de ${myPlayerName}!`);
    }
  }
}

function animateFlyCardToPet() {
  const goodPet = document.getElementById('good-pet');
  const handContainer = document.getElementById('my-hand');
  const flyContainer = document.getElementById('fly-card-container');

  if (!goodPet || !handContainer || !flyContainer) return;

  const petRect = goodPet.getBoundingClientRect();
  const handRect = handContainer.getBoundingClientRect();

  const flyCard = document.createElement('div');
  flyCard.className = 'flying-card';

  flyCard.style.left = `${handRect.left + handRect.width / 2 - 35}px`;
  flyCard.style.top = `${handRect.top}px`;

  flyContainer.appendChild(flyCard);

  requestAnimationFrame(() => {
    flyCard.style.left = `${petRect.left + 10}px`;
    flyCard.style.top = `${petRect.top + 10}px`;
    flyCard.style.transform = 'scale(0.2) rotate(360deg)';
    flyCard.style.opacity = '0.2';
  });

  setTimeout(() => {
    flyCard.remove();
  }, 850);
}

function returnToLobby() {
  if (roomRef && currentGameState.host === myPlayerId) roomRef.update({ status: 'waiting' });
  else showScreen('screen-lobby');
}