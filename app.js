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

function initializeDatabase() {
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    db = firebase.database();
  } catch (error) {
    console.error("Error al inicializar Firebase Database:", error);
  }
}

initializeDatabase();

let localState = {
  roomCode: '',
  playerId: '',
  playerName: '',
  isHost: false
};

function showScreen(screenId) {
  const screens = document.querySelectorAll('.screen');
  screens.forEach(s => s.classList.remove('active'));
  const target = document.getElementById(screenId);
  if (target) target.classList.add('active');
}

function openHelpModal() {
  const modal = document.getElementById('help-modal');
  if (modal) modal.style.display = 'flex';
}

function closeHelpModal() {
  const modal = document.getElementById('help-modal');
  if (modal) modal.style.display = 'none';
}

function createRoom() {
  const nameInput = document.getElementById('player-name-input');
  const name = nameInput ? nameInput.value.trim() : '';

  if (!name) return alert("Por favor ingresa tu apodo de jugador.");
  if (!db) return alert("No hay conexión con el servidor.");

  localState.playerName = name;
  localState.playerId = 'player_' + Math.random().toString(36).substring(2, 8);
  localState.roomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
  localState.isHost = true;

  const roomRef = db.ref('rooms/' + localState.roomCode);
  roomRef.set({
    status: 'LOBBY',
    host: localState.playerId,
    turnIndex: 0,
    activeColor: 'rojo',
    stackCount: 0,
    direction: 1,
    createdAt: Date.now(),
    players: {
      [localState.playerId]: {
        name: name,
        hand: [],
        id: localState.playerId,
        isHost: true
      }
    }
  }).then(() => {
    listenToRoom();
    showScreen('screen-lobby');
  }).catch(err => alert("Error: " + err.message));
}

function joinRoom() {
  const nameInput = document.getElementById('player-name-input');
  const codeInput = document.getElementById('room-code-input');
  const name = nameInput ? nameInput.value.trim() : '';
  const code = codeInput ? codeInput.value.trim().toUpperCase() : '';

  if (!name || !code) return alert("Ingresa tu apodo y el código.");
  if (!db) return alert("Sin conexión.");

  localState.playerName = name;
  localState.playerId = 'player_' + Math.random().toString(36).substring(2, 8);
  localState.roomCode = code;
  localState.isHost = false;

  const roomRef = db.ref('rooms/' + code);
  roomRef.once('value', snapshot => {
    if (!snapshot.exists()) return alert("La sala no existe.");
    const roomData = snapshot.val();
    const existingPlayers = Object.keys(roomData.players || {});
    if (existingPlayers.length >= 4) return alert("Sala llena.");

    db.ref(`rooms/${code}/players/${localState.playerId}`).set({
      name: name,
      hand: [],
      id: localState.playerId,
      isHost: false
    }).then(() => {
      listenToRoom();
      showScreen('screen-lobby');
    }).catch(err => alert("Error: " + err.message));
  });
}

function listenToRoom() {
  if (!db || !localState.roomCode) return;
  const roomRef = db.ref('rooms/' + localState.roomCode);
  roomRef.on('value', snapshot => {
    const data = snapshot.val();
    if (!data) return;

    if (data.status === 'LOBBY') {
      updateLobbyUI(data);
    } else if (data.status === 'PLAYING') {
      showScreen('screen-game');
      renderGameTable(data);
    }
  });
}

function updateLobbyUI(data) {
  document.getElementById('lobby-code-display').textContent = localState.roomCode;
  const playersList = Object.values(data.players || {});
  const ul = document.getElementById('lobby-players-list');
  ul.innerHTML = '';
  playersList.forEach(p => {
    const li = document.createElement('li');
    li.textContent = `${p.name} ${p.id === data.host ? '👑' : ''}`;
    ul.appendChild(li);
  });

  document.getElementById('player-count').textContent = playersList.length;
  const startBtn = document.getElementById('btn-start-game');
  const waitingMsg = document.getElementById('waiting-msg');

  if (localState.isHost) {
    if (startBtn) startBtn.style.display = 'block';
    if (waitingMsg) waitingMsg.style.display = 'none';
  } else {
    if (startBtn) startBtn.style.display = 'none';
    if (waitingMsg) waitingMsg.style.display = 'block';
  }
}

// GENERACIÓN DE MAZO EXCLUSIVAMENTE CON CARTAS SUMATORIAS (+2, +4, +5)
function generateDeck() {
  const colors = ['rojo', 'azul', 'verde', 'amarillo'];
  const deck = [];

  colors.forEach(color => {
    deck.push({ color, type: 'plus', value: 2, label: '+2' });
    deck.push({ color, type: 'plus', value: 2, label: '+2' });
    deck.push({ color, type: 'plus', value: 5, label: '+5' });
  });

  deck.push({ color: 'negro', type: 'wild', value: 4, label: '+4' });
  deck.push({ color: 'negro', type: 'wild', value: 4, label: '+4' });
  deck.push({ color: 'negro', type: 'wild', value: 4, label: '+4' });

  return shuffleDeck(deck);
}

function shuffleDeck(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function startGame() {
  let deck = generateDeck();
  const roomRef = db.ref('rooms/' + localState.roomCode);

  roomRef.once('value', snapshot => {
    const data = snapshot.val();
    const playerIds = Object.keys(data.players);

    playerIds.forEach(id => {
      data.players[id].hand = deck.splice(0, 7);
    });

    let topCard = deck.pop();
    while (topCard.color === 'negro') {
      deck.unshift(topCard);
      topCard = deck.pop();
    }

    roomRef.update({
      status: 'PLAYING',
      deck: deck,
      topCard: topCard,
      activeColor: topCard.color,
      playerOrder: playerIds,
      turnIndex: 0,
      stackCount: topCard.value,
      direction: 1,
      players: data.players
    });
  });
}

function createCardHTML(card) {
  return `
    <span class="card-corner top">${card.label}</span>
    <div class="diamond-frame">
      <div class="diamond-content">${card.label}</div>
    </div>
    <span class="card-corner bottom">${card.label}</span>
  `;
}

function renderGameTable(data) {
  const playerOrder = data.playerOrder || [];
  const currentPlayerId = playerOrder[data.turnIndex];

  document.getElementById('turn-display').textContent = data.players[currentPlayerId]?.name || '---';
  
  const colorInd = document.getElementById('active-color-indicator');
  colorInd.className = `color-badge c-${data.activeColor}`;
  document.getElementById('active-color-text').textContent = data.activeColor.toUpperCase();
  document.getElementById('stack-display').textContent = `+${data.stackCount || 0}`;

  const topEl = document.getElementById('top-card');
  topEl.className = `unocard c-${data.topCard.color}`;
  topEl.innerHTML = createCardHTML(data.topCard);

  const oppZone = document.getElementById('opponents-zone');
  oppZone.innerHTML = '';
  playerOrder.forEach(id => {
    if (id === localState.playerId) return;
    const oppData = data.players[id];
    const box = document.createElement('div');
    box.className = `opponent-box ${id === currentPlayerId ? 'active-turn' : ''}`;
    box.innerHTML = `
      <span class="opp-name">${oppData.name}</span>
      <span class="opp-cards">${oppData.hand ? oppData.hand.length : 0} C.</span>
    `;
    oppZone.appendChild(box);
  });

  const myHand = data.players[localState.playerId]?.hand || [];
  document.getElementById('my-card-count').textContent = myHand.length;

  const carousel = document.getElementById('my-hand');
  carousel.innerHTML = '';

  myHand.forEach((card, index) => {
    const cardEl = document.createElement('div');
    cardEl.className = `unocard c-${card.color}`;
    cardEl.innerHTML = createCardHTML(card);
    cardEl.onclick = () => handleCardPlay(index, card, data);
    carousel.appendChild(cardEl);
  });
}

function handleCardPlay(handIndex, card, roomData) {
  if (roomData.playerOrder[roomData.turnIndex] !== localState.playerId) {
    return alert("No es tu turno.");
  }

  const isValid = card.color === 'negro' || card.color === roomData.activeColor || card.label === roomData.topCard.label;
  if (!isValid) {
    return alert("La carta no coincide en color o valor (+2, +4, +5).");
  }

  executeMove(handIndex, card.color === 'negro' ? roomData.activeColor : card.color);
}

function executeMove(handIndex, chosenColor) {
  const roomRef = db.ref('rooms/' + localState.roomCode);

  roomRef.once('value', snapshot => {
    const data = snapshot.val();
    const myHand = data.players[localState.playerId].hand;
    const playedCard = myHand.splice(handIndex, 1)[0];

    let newStack = (data.stackCount || 0) + playedCard.value;
    let nextTurn = (data.turnIndex + 1) % data.playerOrder.length;

    roomRef.update({
      topCard: playedCard,
      activeColor: chosenColor,
      stackCount: newStack,
      turnIndex: nextTurn,
      [`players/${localState.playerId}/hand`]: myHand
    });
  });
}

function drawCardCurrentPlayer() {
  const roomRef = db.ref('rooms/' + localState.roomCode);

  roomRef.once('value', snapshot => {
    const data = snapshot.val();
    if (data.playerOrder[data.turnIndex] !== localState.playerId) {
      return alert("No es tu turno de robar.");
    }

    let deck = data.deck || generateDeck();
    let myHand = data.players[localState.playerId].hand || [];
    const drawAmount = data.stackCount > 0 ? data.stackCount : 1;

    for (let i = 0; i < drawAmount; i++) {
      if (deck.length === 0) deck = generateDeck();
      myHand.push(deck.pop());
    }

    const nextTurn = (data.turnIndex + 1) % data.playerOrder.length;

    roomRef.update({
      deck: deck,
      stackCount: 0,
      turnIndex: nextTurn,
      [`players/${localState.playerId}/hand`]: myHand
    });
  });
}

function sayUno() {
  alert("¡Has gritado UNO!");
}