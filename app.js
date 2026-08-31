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

    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }

    db = firebase.database();

    isFirebaseConnected = true;

  }

} catch (e) {

  console.warn(
    "Modo local activo.",
    e
  );

}


/* =========================================================
   VARIABLES DEL JUGADOR
========================================================= */

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

/*
  CAMBIO IMPORTANTE:
  Antes:
  hasUsedSkill = false

  Ahora:
  Cada jugador dispone de 3 usos.
*/

const MAX_SKILL_USES = 3;

let currentRoomCode = null;

let roomRef = null;

let chatRef = null;

let currentGameState = null;

let knownPlayers = {};


/* =========================================================
   MASCOTAS
========================================================= */

let llamaClicks = 0;

let loroClicks = 0;

/* El loro necesita 10 clics */

const LORO_REQUIRED_CLICKS = 10;

/* La llama mantiene 40 clics */

const LLAMA_REQUIRED_CLICKS = 40;


/* =========================================================
   TURNO
========================================================= */

let turnTimer = null;

let timeLeft = 10;

let pendingWildCard = null;


/* =========================================================
   VOZ / WEBRTC
========================================================= */

let localStream = null;

let isMicOn = false;

let peerConnections = {};

const rtcConfig = {

  iceServers: [
    {
      urls:
        'stun:stun.l.google.com:19302'
    }
  ]

};


/* =========================================================
   CARTAS
========================================================= */

const COLORS = [
  'rojo',
  'azul',
  'verde',
  'amarillo'
];


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


/* =========================================================
   SALIDA DE LA PÁGINA
========================================================= */

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


/* =========================================================
   UTILIDADES
========================================================= */

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


/* =========================================================
   HISTORIAL
========================================================= */

function initHistory() {

  if (
    !isFirebaseConnected ||
    !db
  ) {
    return;
  }


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
              <li>
                👤
                <b>${item.name}</b>
                (${item.skill})
              </li>
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


/* =========================================================
   INICIO
========================================================= */

document.addEventListener(
  'DOMContentLoaded',
  () => {

    initHistory();

    updateSkillDisplay();

  }
);


/* =========================================================
   SELECCIÓN DE AVATAR
========================================================= */

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


/* =========================================================
   CAMBIAR PANTALLA
========================================================= */

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


/* =========================================================
   NOMBRE
========================================================= */

function getPlayerName() {

  const input =
    document.getElementById(
      'player-name-input'
    );


  if (!input) {
    return null;
  }


  const value =
    input.value.trim();


  if (!value) {

    alert(
      'Por favor, ingresa tu apodo de jugador.'
    );

    return null;

  }


  myPlayerName = value;


  const nameDisplay =
    document.getElementById(
      'my-name-display'
    );


  const avatarDisplay =
    document.getElementById(
      'my-avatar-display'
    );


  const skillDisplay =
    document.getElementById(
      'my-skill-display'
    );


  if (nameDisplay) {
    nameDisplay.innerText =
      myPlayerName;
  }


  if (avatarDisplay) {
    avatarDisplay.src =
      selectedAvatarUrl;
  }


  if (skillDisplay) {
    skillDisplay.innerText =
      selectedSkill;
  }


  return myPlayerName;

}


/* =========================================================
   GENERAR MAZO
========================================================= */

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


/* =========================================================
   CREAR SALA
========================================================= */

function createRoom() {

  if (!getPlayerName()) {
    return;
  }


  const code =
    Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase();


  currentRoomCode = code;


  const initialData = {

    code,

    host:
      myPlayerId,

    status:
      'waiting',

    stack:
      0,

    activeColor:
      'rojo',

    currentTurnIndex:
      0,

    turnOrder:
      [myPlayerId],

    topCard:
      null,

    deck:
      generateDeck(),

    winnerName:
      null,

    players: {

      [myPlayerId]: {

        id:
          myPlayerId,

        name:
          myPlayerName,

        avatar:
          selectedAvatarUrl,

        skill:
          selectedSkill,

        hand:
          [],

        isHost:
          true,

        /*
          NUEVO:
          3 usos de habilidad.
        */

        skillUses:
          MAX_SKILL_USES

      }

    }

  };


  if (
    isFirebaseConnected &&
    db
  ) {

    roomRef =
      db.ref(
        'rooms/' + code
      );


    roomRef
      .set(initialData)
      .then(
        () => {

          listenToRoom();

          listenToChat();

          initVoiceSignaling();

          showScreen(
            'screen-lobby'
          );

        }
      );

  } else {

    currentGameState =
      initialData;

    document.getElementById(
      'lobby-code-display'
    ).innerText =
      currentRoomCode;

    updateUI();

    showScreen(
      'screen-lobby'
    );

  }

}


/* =========================================================
   UNIRSE A SALA
========================================================= */

function joinRoom() {

  if (!getPlayerName()) {
    return;
  }


  const input =
    document.getElementById(
      'room-code-input'
    );


  const code =
    input.value
      .trim()
      .toUpperCase();


  if (!code) {

    alert(
      'Por favor ingresa un código válido.'
    );

    return;

  }


  currentRoomCode =
    code;


  if (
    isFirebaseConnected &&
    db
  ) {

    roomRef =
      db.ref(
        'rooms/' + code
      );


    roomRef.once(
      'value',
      snapshot => {

        if (!snapshot.exists()) {

          alert(
            'La sala ingresada no existe.'
          );

          return;

        }


        const players =
          snapshot.val().players ||
          {};


        if (
          Object.keys(players).length >= 4
        ) {

          alert(
            'La sala ya está llena.'
          );

          return;

        }


        roomRef
          .child(
            'players/' +
            myPlayerId
          )
          .set({

            id:
              myPlayerId,

            name:
              myPlayerName,

            avatar:
              selectedAvatarUrl,

            skill:
              selectedSkill,

            hand:
              [],

            isHost:
              false,

            skillUses:
              MAX_SKILL_USES

          })
          .then(
            () => {

              listenToRoom();

              listenToChat();

              initVoiceSignaling();

              showScreen(
                'screen-lobby'
              );

            }
          );

      }
    );

  }

}


/* =========================================================
   ESCUCHAR SALA
========================================================= */

function listenToRoom() {

  const codeDisplay =
    document.getElementById(
      'lobby-code-display'
    );


  if (codeDisplay) {

    codeDisplay.innerText =
      currentRoomCode;

  }


  if (!roomRef) {
    return;
  }


  roomRef.on(
    'value',
    snapshot => {

      if (!snapshot.exists()) {
        return;
      }


      currentGameState =
        snapshot.val();


      const activePlayers =
        currentGameState.players ||
        {};


      Object.keys(
        knownPlayers
      ).forEach(
        playerId => {

          if (
            !activePlayers[playerId]
          ) {

            showToastNotification(
              `${knownPlayers[playerId]} abandonó la partida`
            );

          }

        }
      );


      knownPlayers = {};


      Object.values(
        activePlayers
      ).forEach(
        player => {

          knownPlayers[
            player.id
          ] =
            player.name;

        }
      );


      updateUI();

    }
  );

}


/* =========================================================
   CHAT
========================================================= */

function listenToChat() {

  if (
    !currentRoomCode ||
    !isFirebaseConnected ||
    !db
  ) {
    return;
  }


  chatRef =
    db.ref(
      'chats/' +
      currentRoomCode
    );


  chatRef.on(
    'child_added',
    snapshot => {

      const msgData =
        snapshot.val();


      renderL4DMessage(
        msgData
      );


      renderLobbyMessage(
        msgData
      );


      if (
        msgData.sender === 'SISTEMA' &&
        msgData.text &&
        msgData.text.includes(
          'abandonó'
        )
      ) {

        showToastNotification(
          msgData.text
        );

      }

    }
  );

}


/* =========================================================
   CHAT LOBBY
========================================================= */

function handleLobbyChatKey(event) {

  if (
    event.key !== 'Enter'
  ) {
    return;
  }


  const input =
    document.getElementById(
      'lobby-chat-input'
    );


  if (!input) {
    return;
  }


  const text =
    input.value.trim();


  if (!text) {
    return;
  }


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
        myPlayerName,

      text

    });

  } else {

    renderLobbyMessage({

      sender:
        myPlayerName,

      text

    });

  }


  input.value = '';

}


/* =========================================================
   RENDER CHAT LOBBY
========================================================= */

function renderLobbyMessage(
  msgData
) {

  const container =
    document.getElementById(
      'lobby-chat-messages'
    );


  if (!container) {
    return;
  }


  const msgEl =
    document.createElement(
      'div'
    );


  msgEl.className =
    'chat-msg';


  msgEl.innerHTML =
    `<b>${msgData.sender}:</b> ${msgData.text}`;


  container.appendChild(
    msgEl
  );


  container.scrollTop =
    container.scrollHeight;

}


/* =========================================================
   CHAT PARTIDA
========================================================= */

function handleChatKey(event) {

  if (
    event.key !== 'Enter'
  ) {
    return;
  }


  const input =
    document.getElementById(
      'l4d-chat-input'
    );


  if (!input) {
    return;
  }


  const text =
    input.value.trim();


  if (!text) {
    return;
  }


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
        myPlayerName,

      text

    });

  } else {

    renderL4DMessage({

      sender:
        myPlayerName,

      text

    });

  }


  input.value = '';

}


/* =========================================================
   RENDER CHAT PARTIDA
========================================================= */

function renderL4DMessage(
  msgData
) {

  const container =
    document.getElementById(
      'l4d-chat-messages'
    );


  if (!container) {
    return;
  }


  const msgEl =
    document.createElement(
      'div'
    );


  msgEl.className =
    'chat-msg';


  msgEl.innerHTML =
    `<b>${msgData.sender}:</b> ${msgData.text}`;


  container.appendChild(
    msgEl
  );


  container.scrollTop =
    container.scrollHeight;

}


/* =========================================================
   MICRÓFONO
========================================================= */

async function toggleMicrophone() {

  const btn =
    document.getElementById(
      'btn-mic-toggle'
    );


  const text =
    document.getElementById(
      'mic-status-text'
    );


  if (!btn || !text) {
    return;
  }


  if (!isMicOn) {

    try {

      localStream =
        await navigator
          .mediaDevices
          .getUserMedia({

            audio: true,

            video: false

          });


      isMicOn = true;


      btn.className =
        'mic-chat-btn btn-mic-on';


      text.innerText =
        'On';


      Object.keys(
        peerConnections
      ).forEach(
        playerId => {

          localStream
            .getTracks()
            .forEach(
              track => {

                try {

                  peerConnections[
                    playerId
                  ].addTrack(
                    track,
                    localStream
                  );

                } catch (error) {

                  console.warn(
                    'No se pudo agregar pista:',
                    error
                  );

                }

              }
            );

        }
      );


      showToastNotification(
        '🎤 Micrófono activado.'
      );

    } catch (err) {

      console.error(
        err
      );

      alert(
        'No se pudo activar el micrófono. Revisa los permisos del navegador.'
      );

    }

  } else {

    if (localStream) {

      localStream
        .getTracks()
        .forEach(
          track =>
            track.stop()
        );

    }


    isMicOn = false;


    btn.className =
      'mic-chat-btn btn-mic-off';


    text.innerText =
      'Off';


    showToastNotification(
      '🎤 Micrófono desactivado.'
    );

  }

}


/* =========================================================
   WEBRTC
========================================================= */

function initVoiceSignaling() {

  if (
    !isFirebaseConnected ||
    !db ||
    !currentRoomCode
  ) {
    return;
  }


  const signalRef =
    db.ref(
      `signals/${currentRoomCode}/${myPlayerId}`
    );


  signalRef.on(
    'child_added',
    async snapshot => {

      const data =
        snapshot.val();


      const fromId =
        data.from;


      if (!fromId) {
        return;
      }


      if (
        !peerConnections[fromId]
      ) {

        createPeerConnection(
          fromId
        );

      }


      const pc =
        peerConnections[fromId];


      try {

        if (data.offer) {

          await pc.setRemoteDescription(
            new RTCSessionDescription(
              data.offer
            )
          );


          const answer =
            await pc.createAnswer();


          await pc.setLocalDescription(
            answer
          );


          db.ref(
            `signals/${currentRoomCode}/${fromId}`
          ).push({

            from:
              myPlayerId,

            answer

          });

        }

        else if (data.answer) {

          await pc.setRemoteDescription(
            new RTCSessionDescription(
              data.answer
            )
          );

        }

        else if (data.candidate) {

          await pc.addIceCandidate(
            new RTCIceCandidate(
              data.candidate
            )
          );

        }

      } catch (error) {

        console.warn(
          'Error WebRTC:',
          error
        );

      }

    }
  );

}


/* =========================================================
   CREAR CONEXIÓN
========================================================= */

function createPeerConnection(
  targetPlayerId
) {

  const pc =
    new RTCPeerConnection(
      rtcConfig
    );


  peerConnections[
    targetPlayerId
  ] = pc;


  if (localStream) {

    localStream
      .getTracks()
      .forEach(
        track => {

          pc.addTrack(
            track,
            localStream
          );

        }
      );

  }


  pc.onicecandidate =
    event => {

      if (
        event.candidate &&
        db &&
        currentRoomCode
      ) {

        db.ref(
          `signals/${currentRoomCode}/${targetPlayerId}`
        ).push({

          from:
            myPlayerId,

          candidate:
            event.candidate

        });

      }

    };


  pc.ontrack =
    event => {

      let audio =
        document.getElementById(
          `audio_${targetPlayerId}`
        );


      if (!audio) {

        audio =
          document.createElement(
            'audio'
          );

        audio.id =
          `audio_${targetPlayerId}`;

        audio.autoplay =
          true;

        document.body.appendChild(
          audio
        );

      }


      audio.srcObject =
        event.streams[0];

    };


  return pc;

}


/* =========================================================
   INICIAR PARTIDA
========================================================= */

function startGame() {

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


      /*
        NUEVO:
        Todos empiezan con 3 habilidades.
      */

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


/* =========================================================
   ACTUALIZAR UI
========================================================= */

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


/* =========================================================
   TIMER
========================================================= */

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


/* =========================================================
   TABLERO
========================================================= */

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


  updateSkillDisplay();

}


/* =========================================================
   OPONENTES
========================================================= */

function renderOpponentsQuadrant(
  turnPlayerId
) {

  const zoneTop =
    document.getElementById(
      'opponents-top'
    );


  const zoneLeft =
    document.getElementById(
      'opponents-left'
    );


  const zoneRight =
    document.getElementById(
      'opponents-right'
    );


  if (
    !zoneTop ||
    !zoneLeft ||
    !zoneRight
  ) {
    return;
  }


  zoneTop.innerHTML =
    '';

  zoneLeft.innerHTML =
    '';

  zoneRight.innerHTML =
    '';


  const opponents =
    Object.values(
      currentGameState.players ||
      {}
    )
      .filter(
        player =>
          player.id !==
          myPlayerId
      );


  opponents.forEach(
    (player, index) => {

      const isTurn =
        player.id ===
        turnPlayerId;


      const cardCount =
        player.hand
          ? player.hand.length
          : 0;


      const oppEl =
        document.createElement(
          'div'
        );


      oppEl.className =
        `opponent-mini-card ${
          isTurn
            ? 'active-turn'
            : ''
        }`;


      oppEl.innerHTML = `

        <img
          src="${player.avatar}"
          class="opp-avatar"
          alt="${player.name}"
        >

        <div
          class="text-left"
          style="width:100%;"
        >

          <div
            class="opp-name"
            style="
              font-size:.7rem;
              font-weight:bold;
            "
          >
            ${player.name}
          </div>

          <div
            style="
              font-size:.58rem;
              color:var(--text-muted);
            "
          >
            ${cardCount} cartas
          </div>

        </div>

      `;


      if (index === 0) {

        zoneLeft.appendChild(
          oppEl
        );

      }

      else if (index === 1) {

        zoneRight.appendChild(
          oppEl
        );

      }

      else {

        zoneTop.appendChild(
          oppEl
        );

      }

    }
  );

}


/* =========================================================
   MI MANO
========================================================= */

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


/* =========================================================
   JUGAR CARTA
========================================================= */

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


/* =========================================================
   COLOR
========================================================= */

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


/* =========================================================
   EFECTO DE CARTA
========================================================= */

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


  /*
    IMPORTANTE:

    Solo jugar una carta hasta 0
    permite ganar.

    El loro nunca puede producir
    este estado porque solo funciona
    cuando hay más de 1 carta.
  */

  if (
    myHand.length === 0
  ) {

    currentGameState.status =
      'finished';


    currentGameState.winnerName =
      myPlayerName;


    saveWinnerToHistory(
      myPlayerName
    );


    if (roomRef) {

      roomRef.update(
        currentGameState
      );

    } else {

      updateUI();

    }


    return;

  }


  nextTurn(
    skipTurn
  );

}


/* =========================================================
   HISTORIAL GANADOR
========================================================= */

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


/* =========================================================
   SIGUIENTE TURNO
========================================================= */

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


/* =========================================================
   ROBAR CARTA
========================================================= */

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


/* =========================================================
   UNO
========================================================= */

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


/* =========================================================
   VOLVER AL LOBBY
========================================================= */

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


/* =========================================================
   MASCOTAS
========================================================= */

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


/* =========================================================
   MOVER MASCOTAS
========================================================= */

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


/* =========================================================
   LLAMA
========================================================= */

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


  /*
    Castigo de la llama:
    si intentas usarla con 1 carta,
    recibes 20 cartas.
  */

  if (
    hand.length === 1
  ) {

    alert(
      '⚠️ ¡ABUSO DE MASCOTA DETECTADO! Recibes un castigo de 20 cartas.'
    );


    let deck =
      [
        ...(currentGameState.deck ||
        [])
      ];


    for (
      let i = 0;
      i < 20;
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


/* =========================================================
   LORO
========================================================= */

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


  /*
    NUEVO:
    10 clics.
  */

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


  /*
    REGLA IMPORTANTE:

    Con 1 carta el loro ya no
    puede quitar nada.

    Con 2 cartas sí puede quitar
    una y dejarte en 1.

    De esta manera nunca puede
    hacerte ganar directamente.
  */

  if (
    hand.length <= 1
  ) {

    showToastNotification(
      '🦜 El Loro ya no puede ayudarte. ¡Tienes 1 carta! Ahora debes jugarla para ganar.'
    );


    return;

  }


  /*
    Elimina exactamente 1 carta.
  */

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


/* =========================================================
   GUARDAR MANO
========================================================= */

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


/* =========================================================
   HABILIDADES
========================================================= */

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


  /*
    Compatibilidad con salas antiguas.

    Si una sala fue creada con
    la versión anterior y no tiene
    skillUses, la inicializamos en 3.
  */

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


  /* =======================================================
     ESCUDO
  ======================================================== */

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


  /* =======================================================
     ESPIONAJE
  ======================================================== */

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


  /* =======================================================
     ROBO RÁPIDO
  ======================================================== */

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


  /* =======================================================
     PURGA
  ======================================================== */

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


    /*
      Quitamos 2 cartas aleatorias.
    */

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


  /* =======================================================
     DESCONTAR USO
  ======================================================== */

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


/* =========================================================
   MOSTRAR USOS DE HABILIDAD
========================================================= */

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


/* =========================================================
   UTILIDAD: ACTUALIZAR TEXTO
========================================================= */

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