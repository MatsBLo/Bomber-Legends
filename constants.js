// --- ELEMENTOS E CONFIGURAÇÕES ---

export const createRoomScreen = document.getElementById('create-room-screen');
export const createRoomBackButton = document.getElementById('create-room-back-button');
export const roomNameInput = document.getElementById('room-name-input');
export const roomMapSelect = document.getElementById('room-map-select');
export const confirmCreateRoomButton = document.getElementById('confirm-create-room-button');
export const menuScreen = document.getElementById('menu-screen');
export const onlineButton = document.getElementById('online-button');
export const trainingButton = document.getElementById('training-button');
export const onlineScreen = document.getElementById('online-screen');
export const matchmakingButton = document.getElementById('matchmaking-button');
export const roomsButton = document.getElementById('rooms-button');
export const onlineBackButton = document.getElementById('online-back-button');
export const roomsLobbyScreen = document.getElementById('rooms-lobby-screen');
export const createRoomButton = document.getElementById('create-room-button');
export const roomsBackButton = document.getElementById('rooms-back-button');
export const mapSelectScreen = document.getElementById('map-select-screen');
export const map1Button = document.getElementById('map1-button');
export const map2Button = document.getElementById('map2-button');
export const map3Button = document.getElementById('map3-button');
export const randomMapButton = document.getElementById('random-map-button');
export const canvas = document.getElementById('game-canvas');
export const ctx = canvas.getContext('2d');
export const actionButtons = document.getElementById('action-buttons');
export const bombButton = document.getElementById('bomb-button');
export const trapButton = document.getElementById('trap-button');
export const pauseButton = document.getElementById('pause-button');
export const pauseMenu = document.getElementById('pause-menu');
export const resumeButton = document.getElementById('resume-button');
export const exitToMenuButton = document.getElementById('exit-to-menu-button');
export const gameOverScreen = document.getElementById('game-over-screen');
export const gameOverMessageEl = document.getElementById('game-over-message');
export const roundOverScreen = document.getElementById('round-over-screen');
export const roundOverMessageEl = document.getElementById('round-over-message');

export const menuButton = document.getElementById('menu-button');
export const restartButton = document.getElementById('restart-button');

export const matchTimerEl = document.getElementById('match-timer');

// --- CONSTANTES DO JOGO ---
export const TILE_SIZE = 40;
export const GRID_COLS = 15;
export const GRID_ROWS = 13;
export const BOMB_TIMER = 3000; // Duração em ms para uma bomba explodir
export const EXPLOSION_DURATION = 600; // Duração do fogo na tela
export const FREEZE_DURATION = 3000; // Duração do congelamento
export const TRAP_AOE_DURATION = 600; // Duração do efeito da armadilha

// Lista de skins e seus caminhos (por enquanto usando a pasta Imagens/Bonecos)
export const CHARACTER_SKINS = {
    'bonecovermelho.png.png': 'Arquivos/Imagens/Bonecos/bonecovermelho.png.png',
    'bonecoverde.png.png': 'Arquivos/Imagens/Bonecos/bonecoverde.png.png',
    'bonecoazul.png.png': 'Arquivos/Imagens/Bonecos/bonecoazul.png.png',
    'bonecoamarelo.png.png': 'Arquivos/Imagens/Bonecos/bonecoamarelo.png.png'
};

// --- GERENCIAMENTO DE IMAGENS E SONS ---
export const gameImages = {};
export const explosionSound = new Audio('https://files.catbox.moe/8970wg.mp3');
export const powerupSound = new Audio('https://files.catbox.moe/j9cv73.mp3');
export const deathSound = new Audio('https://files.catbox.moe/uks1ph.mp3');
explosionSound.volume = 0.18; powerupSound.volume = 0.18; deathSound.volume = 0.18;