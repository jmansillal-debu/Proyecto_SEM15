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
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    db = firebase.database();
    listenToGlobalWinners();
  } catch (error) {
    console.error("Error Firebase:", error);
  }
}
initializeDatabase();

let localState = {
  roomCode: '',
  playerId: '',
  playerName: '',
  isHost: false,
  unreadCount: 0
};

function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(screenId);
  if (target) target.classList.add('active');
}

/* HISTORIAL DE GANADORES EN TIEMPO REAL */
function listenToGlobalWinners() {
  if (!db) return;
  db.ref('winners_history').limitToLast(8).on('value', snapshot => {
    const ul = document.getElementById('winners-history-list');
    ul.innerHTML = '';
    const data = snapshot.val();
    if (!data) {
      ul.innerHTML = '<li class="empty-msg">No hay victorias aún.</li>';
      return;
    }
    Object.values(data).reverse().forEach(w => {
      const li = document.createElement('li');
      li.className = 'winner-item';
      li.innerHTML = `<span>👑 ${w.name}</span> <small>${w.date}</small>`;
      ul.appendChild(li);
    });
  });
}

function registerWinner(winnerName) {
  if (!db) return;
  db.ref('winners_history').push({
    name: winnerName,
    date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  });
}

/* SALA Y LOBBY */
function createRoom() {
  const name = document.getElementById('player-name-input').value.trim();
  if (!name) return alert("Ingresa tu apodo.");
  
  localState.playerName = name;
  localState.playerId = 'p_' + Math.random().toString(36).substring(2, 7);
  localState.roomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
  localState.isHost = true;

  db.ref('rooms/' + localState.roomCode).set({
    status: 'LOBBY',
    host: localState.playerId,
    turnIndex: 0,
    activeColor: 'rojo',
    stackCount: 0,
    players: {
      [localState.playerId]: { name, hand: [], id: localState.playerId }
    }
  }).then(() => {
    listenToRoom();
    showScreen('screen-lobby');
  });
}

function joinRoom() {
  const name = document.getElementById('player-name-input').value.trim();
  const code = document.getElementById('room-code-input').value.trim().toUpperCase();
  if (!name || !code) return alert("Ingresa apodo y código.");

  localState.playerName = name;
  localState.playerId = 'p_' + Math.random().toString(36).substring(2, 7);
  localState.roomCode = code;

  db.ref(`rooms/${code}`).once('value', snapshot => {
    if (!snapshot.exists()) return alert("Mesa no encontrada.");
    
    db.ref(`rooms/${code}/players/${localState.playerId}`).set({
      name, hand: [], id: localState.playerId
    }).then(() => {
      listenToRoom();
      showScreen('screen-lobby');
    });
  });
}

/* GENERAR MAZO SOLAMENTE CON CARTAS SUMATORIAS (+2, +4, +5) */
function generateDeck() {
  const colors = ['rojo', 'azul', 'verde', 'amarillo'];
  const deck = [];

  colors.forEach(color => {
    deck.push({ color, value: 2, label: '+2' });
    deck.push({ color, value: 2, label: '+2' });
    deck.push({ color, value: 5, label: '+5' });
  });

  for (let i = 0; i < 4; i++) {
    deck.push({ color: 'negro', value: 4, label: '+4' });
  }

  return shuffleDeck(deck);
}

function shuffleDeck(array) {
  return array.sort(() => Math.random() - 0.5);
}

function startGame() {
  let deck = generateDeck();
  const roomRef = db.ref('rooms/' + localState.roomCode);

  roomRef.once('value', snapshot => {
    const data = snapshot.val();
    const playerIds = Object.keys(data.players);

    playerIds.forEach(id => {
      data.players[id].hand = deck.splice(0, 5);
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
      players: data.players
    });
  });
}

function listenToRoom() {
  const roomRef = db.ref('rooms/' + localState.roomCode);
  roomRef.on('value', snapshot => {
    const data = snapshot.val();
    if (!data) return;

    if (data.status === 'LOBBY') {
      document.getElementById('lobby-code-display').textContent = localState.roomCode;
      const players = Object.values(data.players || {});
      document.getElementById('player-count').textContent = players.length;
      document.getElementById('lobby-players-list').innerHTML = players.map(p => `<li>${p.name}</li>`).join('');
      document.getElementById('btn-start-game').style.display = localState.isHost ? 'block' : 'none';
      document.getElementById('waiting-msg').style.display = localState.isHost ? 'none' : 'block';
    } else if (data.status === 'PLAYING') {
      showScreen('screen-game');
      renderGameTable(data);
    }
  });

  db.ref(`chats/${localState.roomCode}`).on('child_added', snapshot => {
    const msg = snapshot.val();
    appendChatMessage(msg);
  });
}

function createCardHTML(card) {
  return `
    <span class="card-corner top">${card.label}</span>
    <div class="card-inner">${card.label}</div>
    <span class="card-corner bottom">${card.label}</span>
  `;
}

function renderGameTable(data) {
  const playerOrder = data.playerOrder || [];
  const currentPlayerId = playerOrder[data.turnIndex];

  document.getElementById('turn-display').textContent = data.players[currentPlayerId]?.name || '---';
  document.getElementById('active-color-indicator').className = `color-dot c-${data.activeColor}`;
  document.getElementById('stack-display').textContent = `+${data.stackCount || 0}`;

  const topEl = document.getElementById('top-card');
  topEl.className = `unocard c-${data.topCard.color}`;
  topEl.innerHTML = createCardHTML(data.topCard);

  /* OPONENTES CON CARTAS VISIBLES EN DORSO */
  const oppZone = document.getElementById('opponents-zone');
  oppZone.innerHTML = '';
  playerOrder.forEach(id => {
    if (id === localState.playerId) return;
    const oppData = data.players[id];
    const handCount = oppData.hand ? oppData.hand.length : 0;
    
    let backCardsHTML = '';
    for (let i = 0; i < Math.min(handCount, 6); i++) {
      backCardsHTML += '<div class="mini-card-back"></div>';
    }

    const cardBox = document.createElement('div');
    cardBox.className = `opponent-card ${id === currentPlayerId ? 'active' : ''}`;
    cardBox.innerHTML = `
      <span class="opp-name">${oppData.name} (${handCount})</span>
      <div class="opp-hand-visual">${backCardsHTML}</div>
    `;
    oppZone.appendChild(cardBox);
  });

  /* MI MANO DE CARTAS */
  const myHand = data.players[localState.playerId]?.hand || [];
  document.getElementById('my-card-count').textContent = myHand.length;

  const carousel = document.getElementById('my-hand');
  carousel.innerHTML = '';

  myHand.forEach((card, index) => {
    const cardEl = document.createElement('div');
    cardEl.className = `unocard c-${card.color}`;
    cardEl.innerHTML = createCardHTML(card);
    cardEl.onclick = () => playCard(index, card, data);
    carousel.appendChild(cardEl);
  });

  /* VERIFICAR SI HAY GANADOR */
  playerOrder.forEach(id => {
    if (data.players[id].hand && data.players[id].hand.length === 0) {
      alert(`¡${data.players[id].name} ha ganado la partida!`);
      if (localState.isHost) registerWinner(data.players[id].name);
    }
  });
}

function playCard(handIndex, card, roomData) {
  if (roomData.playerOrder[roomData.turnIndex] !== localState.playerId) {
    return alert("No es tu turno.");
  }

  const isValid = card.color === 'negro' || card.color === roomData.activeColor || card.label === roomData.topCard.label;
  if (!isValid) return alert("Carta invalida. Debe coincidir color o valor (+2, +4, +5).");

  const roomRef = db.ref('rooms/' + localState.roomCode);
  const myHand = roomData.players[localState.playerId].hand;
  const played = myHand.splice(handIndex, 1)[0];

  const nextTurn = (roomData.turnIndex + 1) % roomData.playerOrder.length;

  roomRef.update({
    topCard: played,
    activeColor: played.color === 'negro' ? roomData.activeColor : played.color,
    stackCount: roomData.stackCount + played.value,
    turnIndex: nextTurn,
    [`players/${localState.playerId}/hand`]: myHand
  });
}

/* OBLIGACIÓN DE RECOGER CARTAS SI NO PUEDE SUMAR */
function drawCardCurrentPlayer() {
  const roomRef = db.ref('rooms/' + localState.roomCode);

  roomRef.once('value', snapshot => {
    const data = snapshot.val();
    if (data.playerOrder[data.turnIndex] !== localState.playerId) return alert("No es tu turno.");

    let myHand = data.players[localState.playerId].hand || [];
    let deck = data.deck || generateDeck();

    /* VERIFICA SI EL JUGADOR TIENE CON QUÉ RESPONDER A LA SUMA */
    const canDefend = myHand.some(c => c.color === 'negro' || c.color === data.activeColor || c.label === data.topCard.label);

    if (data.stackCount > 0 && canDefend) {
      return alert("¡Tienes cartas para sumar! Debes jugar una carta de suma (+2, +4, +5).");
    }

    const drawCount = data.stackCount > 0 ? data.stackCount : 1;
    for (let i = 0; i < drawCount; i++) {
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

function sayUno() { alert("¡GRITASTE UNO!"); }

/* SISTEMA CHAT TIPO MESSENGER */
function toggleChat() {
  const box = document.getElementById('chat-box');
  box.classList.toggle('hidden');
  if (!box.classList.contains('hidden')) {
    localState.unreadCount = 0;
    document.getElementById('chat-badge').textContent = '0';
  }
}

function sendChatMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text || !localState.roomCode) return;

  db.ref(`chats/${localState.roomCode}`).push({
    sender: localState.playerName,
    text: text
  });
  input.value = '';
}

function handleChatKey(e) {
  if (e.key === 'Enter') sendChatMessage();
}

function appendChatMessage(msg) {
  const container = document.getElementById('chat-messages');
  const el = document.createElement('div');
  el.className = 'chat-msg';
  el.innerHTML = `<strong>${msg.sender}</strong> ${msg.text}`;
  container.appendChild(el);
  container.scrollTop = container.scrollHeight;

  const box = document.getElementById('chat-box');
  if (box.classList.contains('hidden')) {
    localState.unreadCount++;
    document.getElementById('chat-badge').textContent = localState.unreadCount;
  }
}