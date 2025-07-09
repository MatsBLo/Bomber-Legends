const socket = io(); // <--- A ÚNICA DECLARAÇÃO, LOGO NO COMEÇO
let myId = null;
let otherPlayers = {};
let isOnlineGame = false;
let isLoopRunning = false; // Flag para garantir que o loop só rode uma vez

// --- REFERÊNCIAS PARA AS NOVAS TELAS DE RODADA ---
const roundOverScreen = document.getElementById('round-over-screen');
const roundOverMessageEl = document.getElementById('round-over-message');

// --- VARIÁVEIS DE ESTADO DE JOGO ---
let selectedGameMode = null;
let selectedMap = null;
let isGameOver = false;
let isPaused = false;

// --- VARIÁVEIS GLOBAIS DE ENTIDADES DO JOGO ---
let bombs = [];
let explosions = [];
let activeTraps = [];
let trapAoeEffects = [];
let grid = [];
let enemy = null;
var matchTimerInterval = null;

// --- PAINEL DE ESTATÍSTICAS DA SESSÃO ---
socket.on('sessionUpdate', (sessionData) => {
    const statsPanel = document.getElementById('session-stats');
    const totalMatchesEl = document.getElementById('total-matches');
    const playerListEl = document.getElementById('player-list');

    // Se sessionData for nulo ou vazio, a sessão acabou. Esconda o painel.
    if (!sessionData || Object.keys(sessionData.players).length === 0) {
        if (statsPanel) statsPanel.style.display = 'none';
        if (totalMatchesEl) totalMatchesEl.textContent = '0';
        if (playerListEl) playerListEl.innerHTML = '';
        return;
    }
    
    // Se chegou aqui, há dados. Mostre e atualize o painel.
    if (statsPanel) statsPanel.style.display = 'block';
    if (totalMatchesEl) totalMatchesEl.textContent = sessionData.totalMatchesInSession;
    
    if (playerListEl) {
        playerListEl.innerHTML = ''; // Limpa a lista antiga
        for (const playerId in sessionData.players) {
            const player = sessionData.players[playerId];
            const listItem = document.createElement('li');
            listItem.textContent = `${player.username}: Vitórias ${player.wins} / Partidas ${player.matchesPlayed}`;
            if (playerId === socket.id) {
                listItem.style.fontWeight = 'bold';
                listItem.style.color = 'yellow';
            }
            playerListEl.appendChild(listItem);
        }
    }
});

import {
    menuScreen,
    onlineButton,
    onlineScreen,
    roomsButton,
    roomsLobbyScreen,
    roomsBackButton,
    createRoomButton,
    createRoomScreen,
    roomNameInput,
    roomMapSelect,
    confirmCreateRoomButton,
    createRoomBackButton,
    canvas,
    ctx,
    actionButtons,
    bombButton,
    trapButton,
    pauseButton,
    pauseMenu,
    resumeButton,
    exitToMenuButton,
    gameOverScreen,
    gameOverMessageEl,
    restartButton,
    menuButton,
    matchTimerEl,
    gameImages,
    explosionSound,
    powerupSound,
    deathSound,
    CHARACTER_SKINS,
    // Constantes do jogo
    TILE_SIZE,
    GRID_COLS,
    GRID_ROWS,
    BOMB_TIMER,
    FREEZE_DURATION,
    EXPLOSION_DURATION,
    TRAP_AOE_DURATION
} from './constants.js';

// Log de diagnóstico para verificar se as constantes foram carregadas corretamente.
console.log(`[DEBUG] Constantes carregadas: TILE_SIZE=${TILE_SIZE}, GRID_COLS=${GRID_COLS}, GRID_ROWS=${GRID_ROWS}`);

document.addEventListener('DOMContentLoaded', function() {
    // Sempre esconder timer e estatísticas ao mostrar o menu principal
    function hideSessionStatsAndTimer() {
        const statsPanel = document.getElementById('session-stats');
        if (statsPanel) statsPanel.style.display = 'none';
        // Só esconde o timer se NÃO estiver em partida online ativa
        if (typeof matchTimerEl !== 'undefined' && matchTimerEl && (!isOnlineGame || isGameOver)) {
            matchTimerEl.style.display = 'none';
            console.log('[TIMER] Timer ocultado por hideSessionStatsAndTimer');
        }
    }
    // Garante que ao clicar no botão do menu, também esconde tudo
    if (menuButton) {
        menuButton.addEventListener('click', hideSessionStatsAndTimer);
    }
    // Garante que ao clicar no botão "Voltar ao Menu" do menu de pausa, também esconde tudo
    if (exitToMenuButton) {
        exitToMenuButton.addEventListener('click', hideSessionStatsAndTimer);
    }
    // Garante que ao clicar no botão "Voltar ao Menu" do menu de opções in-game, também esconde tudo
    document.body.addEventListener('click', function(e) {
        if (e.target && e.target.id === 'ingame-exit-menu-btn') {
            hideSessionStatsAndTimer();
        }
    });
    // --- BOTÃO SALAS ---
    if (roomsButton && roomsLobbyScreen && onlineScreen) {
        roomsButton.addEventListener('click', function() {
            onlineScreen.style.display = 'none';
            roomsLobbyScreen.style.display = 'flex';
        });
    }

    // --- BOTÃO BOMBA (CLIQUE/TOQUE) ---
    if (bombButton) {
        bombButton.addEventListener('click', function(e) {
            e.preventDefault();
            placeBomb();
        });
        bombButton.addEventListener('touchstart', function(e) {
            e.preventDefault();
            placeBomb();
        }, { passive: false });
    }

    // --- BOTÃO TREINO SOLO (MENU INICIAL) ---
    if (typeof trainingButton !== 'undefined' && trainingButton && menuScreen) {
        trainingButton.addEventListener('click', function() {
            menuScreen.style.display = 'none';
            // Inicia o modo solo (batalha offline)
            startGame('batalha', 'map1');
        });
    }

    // --- BOTÃO RECOMEÇAR (GAME OVER) ---
    if (restartButton) {
        restartButton.addEventListener('click', function() {
            // Reinicia o jogo conforme o modo anterior
            if (isOnlineGame) {
                // No online, pede para o servidor reiniciar a partida
                socket.emit('requestRestart');
                // Opcional: pode mostrar "Aguardando outros jogadores..." se quiser
            } else {
                // No offline, reinicia localmente
                startGame(selectedGameMode || 'batalha', selectedMap || 'map1');
            }
        });
    }

    // --- BOTÃO VOLTAR NA TELA DE SALAS ---
    if (roomsBackButton && roomsLobbyScreen && onlineScreen) {
        roomsBackButton.addEventListener('click', function() {
            roomsLobbyScreen.style.display = 'none';
            onlineScreen.style.display = 'flex';
        });
    }

    // --- BOTÃO CRIAR SALA NA TELA DE SALAS ---
    if (createRoomButton && createRoomScreen && roomsLobbyScreen) {
        createRoomButton.addEventListener('click', function() {
            roomsLobbyScreen.style.display = 'none';
            createRoomScreen.style.display = 'flex';
            if (roomNameInput) roomNameInput.value = '';
            if (roomMapSelect) roomMapSelect.value = 'map1';
        });
    }

    // --- BOTÃO VOLTAR NA TELA DE CRIAÇÃO DE SALA ---
    if (createRoomBackButton && createRoomScreen && roomsLobbyScreen) {
        createRoomBackButton.addEventListener('click', function() {
            createRoomScreen.style.display = 'none';
            roomsLobbyScreen.style.display = 'flex';
        });
    }

    // --- BOTÃO CONFIRMAR CRIAÇÃO DE SALA ---
    if (confirmCreateRoomButton && createRoomScreen) {
        confirmCreateRoomButton.addEventListener('click', function() {
            const roomName = roomNameInput ? roomNameInput.value.trim() : '';
            const map = roomMapSelect ? roomMapSelect.value : 'map1';
            if (!roomName) {
                alert('Digite um nome para a sala.');
                return;
            }
            // Envia para o servidor a criação da sala
            socket.emit('createRoom', { roomName, map });
        });
    }

    // Recebe confirmação de sala criada e já entra na sala (inicia partida online)
    socket.on('roomCreated', ({ roomName, map }) => {
        if (createRoomScreen) createRoomScreen.style.display = 'none';
        if (roomsLobbyScreen) roomsLobbyScreen.style.display = 'none';
        
        // Pega o nome do jogador do campo de input
        const playerNameInput = document.getElementById('player-name-input');
        const playerName = playerNameInput ? playerNameInput.value.trim() || 'Jogador' : 'Jogador';
        
        // Entra na sala criada (inicia fluxo multiplayer)
        socket.emit('joinGame', { roomName: roomName, playerName: playerName });
    });
    const settingsButton = document.getElementById('settings-button');
    const settingsScreen = document.getElementById('settings-screen');
    const closeSettingsButton = document.getElementById('close-settings-button');
    const musicVolume = document.getElementById('music-volume');
    const musicVolumeValue = document.getElementById('music-volume-value');
    const bgMusic = document.getElementById('bg-music');
    const toggleMusicButton = document.getElementById('toggle-music-button');

    // --- BOTÃO ONLINE ---
    if (onlineButton && onlineScreen && menuScreen) {
        onlineButton.addEventListener('click', function() {
            menuScreen.style.display = 'none';
            onlineScreen.style.display = 'flex';
        });
    }

    let musicEnabled = true;
    let lastVolume = 0.5;

    // Função para abrir o menu de configurações
    function openSettings(fromScreen) {
        if (settingsScreen) settingsScreen.style.display = 'flex';
        if (fromScreen) fromScreen.style.display = 'none';
    }
    // Função para fechar o menu de configurações
    function closeSettings(toScreen) {
        if (settingsScreen) settingsScreen.style.display = 'none';
        if (toScreen) toScreen.style.display = 'flex';
    }

    if (settingsButton && settingsScreen && menuScreen && closeSettingsButton && musicVolume && musicVolumeValue && bgMusic && toggleMusicButton) {
        settingsButton.addEventListener('click', function() {
            openSettings(menuScreen);
        });
        closeSettingsButton.addEventListener('click', function() {
            closeSettings(menuScreen);
        });
        // Atualiza o valor do volume
        musicVolume.addEventListener('input', function() {
            if (musicEnabled) {
                bgMusic.volume = parseFloat(musicVolume.value);
            }
            musicVolumeValue.textContent = Math.round(musicVolume.value * 100) + '%';
            lastVolume = parseFloat(musicVolume.value);
        });
        // Botão de ligar/desligar música
        toggleMusicButton.addEventListener('click', function() {
            musicEnabled = !musicEnabled;
            if (musicEnabled) {
                bgMusic.volume = lastVolume;
                bgMusic.muted = false;
                toggleMusicButton.textContent = 'Desligar Música';
            } else {
                bgMusic.muted = true;
                toggleMusicButton.textContent = 'Ligar Música';
            }
        });
        // Inicializa valor
        musicVolumeValue.textContent = Math.round(musicVolume.value * 100) + '%';
        bgMusic.volume = parseFloat(musicVolume.value);
        toggleMusicButton.textContent = 'Desligar Música';
    }

    // --- BOTÃO CONFIGURAÇÕES IN-GAME (ONLINE) ---
    // Usa o botão já existente no canto superior esquerdo (pauseButton)
    if (pauseButton) {
        pauseButton.title = 'Opções';
        pauseButton.innerText = '⚙️';
        pauseButton.style.position = 'absolute';
        pauseButton.style.top = '24px';
        pauseButton.style.left = '24px';
        pauseButton.style.zIndex = '1200';
        pauseButton.style.width = '48px';
        pauseButton.style.height = '48px';
        pauseButton.style.borderRadius = '50%';
        pauseButton.style.fontSize = '2em';
        pauseButton.style.background = 'rgba(255,255,255,0.95)';
        pauseButton.style.border = 'none';
        pauseButton.style.cursor = 'pointer';
        pauseButton.style.display = 'none';
    }
    // Mostra ou esconde o botão conforme o modo de jogo
    function updateIngameSettingsButton() {
        if (isOnlineGame && !isGameOver && !isPaused && canvas && canvas.style.display === 'block') {
            if (pauseButton) pauseButton.style.display = 'flex';
        } else {
            if (pauseButton) pauseButton.style.display = 'none';
        }
    }
    setInterval(updateIngameSettingsButton, 300);

    // Ao clicar, mostra um menu simples de opções (só "Voltar ao Menu")
    let ingameOptionsMenu = document.getElementById('ingame-options-menu');
    if (!ingameOptionsMenu) {
        ingameOptionsMenu = document.createElement('div');
        ingameOptionsMenu.id = 'ingame-options-menu';
        ingameOptionsMenu.style.position = 'fixed';
        ingameOptionsMenu.style.top = '50%';
        ingameOptionsMenu.style.left = '50%';
        ingameOptionsMenu.style.transform = 'translate(-50%, -50%)';
        ingameOptionsMenu.style.background = 'rgba(0,0,0,0.92)';
        ingameOptionsMenu.style.padding = '32px 32px 24px 32px';
        ingameOptionsMenu.style.borderRadius = '18px';
        ingameOptionsMenu.style.zIndex = '1300';
        ingameOptionsMenu.style.display = 'none';
        ingameOptionsMenu.style.boxShadow = '0 8px 32px #0008';
        ingameOptionsMenu.innerHTML = `
            <h2 style='color:white; font-size:2rem; margin-bottom:18px;'>Opções</h2>
            <button id="ingame-exit-menu-btn" style="font-size:1.1rem;padding:12px 32px;margin-bottom:10px;display:block;width:100%;border-radius:8px;">Voltar ao Menu</button>
            <button id="ingame-cancel-btn" style="font-size:1rem;padding:8px 32px;display:block;width:100%;border-radius:8px;">Cancelar</button>
        `;
        document.body.appendChild(ingameOptionsMenu);
    }
    if (pauseButton) {
        pauseButton.onclick = function() {
            ingameOptionsMenu.style.display = 'block';
        };
    }
    // Fecha o menu ao clicar em cancelar
    ingameOptionsMenu.addEventListener('click', function(e) {
        if (e.target && e.target.id === 'ingame-cancel-btn') {
            ingameOptionsMenu.style.display = 'none';
        }
        if (e.target && e.target.id === 'ingame-exit-menu-btn') {
            ingameOptionsMenu.style.display = 'none';
            showMenu();
        }
    });

    // --- LÓGICA DE MÚSICA DE FUNDO ---
    // Tocar música de fundo após interação do usuário
    if (bgMusic) {
        const playMusic = () => {
            bgMusic.volume = 0.5; // volume moderado
            bgMusic.play().catch(e => console.error("Autoplay da música bloqueado:", e));
            // Remove o listener para não tocar de novo
            document.removeEventListener('click', playMusic, true);
            document.removeEventListener('touchstart', playMusic, true);
        };
        // Adiciona para clique e toque para maior compatibilidade mobile
        document.addEventListener('click', playMusic, true);
        document.addEventListener('touchstart', playMusic, true);
    }
});

// [MULTIPLAYER] INICIALIZAÇÃO E VARIÁVEIS DE REDE
// (Removido duplicidade de declaração do socket e variáveis globais)


function playSound(sound) { sound.currentTime = 0; sound.play().catch(error => console.log(`Erro ao tocar som: ${error}`)); }
function loadImage(key, src) { return new Promise((resolve, reject) => { const img = new Image(); img.onload = () => { gameImages[key] = img; resolve(); }; img.onerror = () => reject(`Erro ao carregar a imagem: ${src}`); img.src = src; }); }


async function loadAllImages() {
    try {
        await Promise.all(Object.entries(CHARACTER_SKINS).map(([key, src]) => loadImage(key, src)));
        await Promise.all([
            loadImage('player', 'https://files.catbox.moe/x7aph0.PNG'),
            loadImage('otherPlayer', 'https://files.catbox.moe/x7aph0.PNG'),
            loadImage('indestructibleBlock', 'Arquivos/Imagens/Blocos/blocoindestrutível.png (2).png'),
            loadImage('freeBlock', 'Arquivos/Imagens/Blocos/blocolivre.png.png'),
            loadImage('bomb', 'Arquivos/Imagens/Itens/bomba.png.png')
        ]);
        console.log("Todas as imagens foram carregadas com sucesso!");
        window._imagesLoaded = true;
    } catch (error) { console.error(error); }
}

// Garante que as imagens estejam carregadas antes de iniciar qualquer jogo
if (!window._imagesLoaded) {
    window._imagesLoaded = false;
    loadAllImages();
}


// --- LÓGICA DE MAPA E INICIALIZAÇÃO ---
let player = {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    speed: 0,
    dx: 0,
    dy: 0,
    explosionRange: 2,
    trapCount: 0,
    isFrozen: false,
    frozenUntil: 0,
    maxBombs: 2,
    activeBombCount: 0,
    isAlive: false, // Start as not alive until game starts
    facingDirection: -1,
    hasShield: false,
    shieldEndTime: 0,
    skin: 'player',
    flyingBombs: 0
};
function resetPlayer(playerData) {
    const defaultSkin = Object.keys(CHARACTER_SKINS)[0] || 'player';
    // Valores padrão para todas as propriedades essenciais do player
    const defaultPlayer = {
        x: TILE_SIZE * 1.5,
        y: TILE_SIZE * 1.5,
        width: TILE_SIZE * 0.7,
        height: TILE_SIZE * 0.9,
        speed: 0.9,
        dx: 0,
        dy: 0,
        explosionRange: 2,
        trapCount: 0,
        isFrozen: false,
        frozenUntil: 0,
        maxBombs: 2,
        activeBombCount: 0,
        isAlive: true,
        facingDirection: -1,
        hasShield: false,
        shieldUntil: 0,
        skin: defaultSkin,
        flyingBombs: 0
    };
    // Faz merge dos dados recebidos do servidor com os valores padrão
    player = Object.assign({}, defaultPlayer, playerData || {});
    if (!player.skin) player.skin = defaultSkin;
    // Garante que valores numéricos não fiquem como undefined ou NaN
    if (typeof player.maxBombs !== 'number' || isNaN(player.maxBombs)) player.maxBombs = 2;
    if (typeof player.activeBombCount !== 'number' || isNaN(player.activeBombCount)) player.activeBombCount = 0;
    if (typeof player.explosionRange !== 'number' || isNaN(player.explosionRange)) player.explosionRange = 2;
    if (typeof player.trapCount !== 'number' || isNaN(player.trapCount)) player.trapCount = 0;
    if (typeof player.flyingBombs !== 'number' || isNaN(player.flyingBombs)) player.flyingBombs = 0;
    if (typeof player.speed !== 'number' || isNaN(player.speed)) player.speed = 0.9;
}
function initializeEnemy() { enemy = { x: TILE_SIZE * (GRID_COLS - 1.5), y: TILE_SIZE * (GRID_ROWS - 1.5), width: TILE_SIZE * 0.7, height: TILE_SIZE * 0.9, speed: 1.5, dx: 0, dy: 0, isAlive: true, lastDirectionChange: 0, directionChangeInterval: 2000 }; }
function createGrid(mapId) { let mapChoice=mapId;if(mapChoice==='random'){mapChoice=Math.random()<0.5?'map1':'map2';}grid=[];for(let r=0;r<GRID_ROWS;r++){grid[r]=[];for(let c=0;c<GRID_COLS;c++){grid[r][c]=0;}}if(mapChoice==='map1'){for(let r=0;r<GRID_ROWS;r++){for(let c=0;c<GRID_COLS;c++){if(r%2===0&&c%2===0)grid[r][c]=1;}}}else if(mapChoice==='map2'){const mapBlueprint=[ {r:2,c:2},{r:2,c:3},{r:2,c:6},{r:2,c:8},{r:2,c:11},{r:2,c:12},{r:4,c:4},{r:4,c:5},{r:4,c:9},{r:4,c:10},{r:5,c:2},{r:5,c:6},{r:5,c:8},{r:5,c:12},{r:6,c:2},{r:6,c:6},{r:6,c:8},{r:6,c:12},{r:7,c:4},{r:7,c:5},{r:7,c:9},{r:7,c:10},{r:9,c:2},{r:9,c:3},{r:9,c:6},{r:9,c:8},{r:9,c:11},{r:9,c:12}, ];mapBlueprint.forEach(pos=>{grid[pos.r][pos.c]=1;});}for(let r=0;r<GRID_ROWS;r++){for(let c=0;c<GRID_COLS;c++){if(r===0||r===GRID_ROWS-1||c===0||c===GRID_COLS-1){grid[r][c]=1;}else if(grid[r][c]===0){grid[r][c]=Math.random()<0.75?2:0;}}}grid[1][1]=0;grid[1][2]=0;grid[2][1]=0;grid[GRID_ROWS-2][GRID_COLS-2]=0;grid[GRID_ROWS-2][GRID_COLS-3]=0;grid[GRID_ROWS-3][GRID_COLS-2]=0; }

// --- DESENHO ---
function drawIndestructibleWall(x, y) {
    const img = gameImages['indestructibleBlock'];
    if (img instanceof HTMLImageElement) {
        ctx.drawImage(img, x, y, TILE_SIZE, TILE_SIZE);
    } else {
        // Fallback para o desenho original se a imagem não estiver carregada
        ctx.fillStyle = '#6c757d';
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + TILE_SIZE, y);
        ctx.lineTo(x + TILE_SIZE, y + TILE_SIZE);
        ctx.lineTo(x, y + TILE_SIZE);
        ctx.lineTo(x, y);
        ctx.fill();
        ctx.fillStyle = '#adb5bd';
        ctx.fillRect(x + 5, y + 5, 8, 8);
    }
}

function drawFreeBlock(x, y) {
    const img = gameImages['freeBlock'];
    if (img instanceof HTMLImageElement) {
        ctx.drawImage(img, x, y, TILE_SIZE, TILE_SIZE);
    } else {
        // Fallback para o fundo verde se a imagem não estiver carregada
        ctx.fillStyle = '#3a8f4a';
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
    }
}
function drawDestructibleBlock(x, y) { ctx.fillStyle = '#b5651d'; ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE); ctx.strokeStyle = '#663300'; ctx.lineWidth = 2; ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE); ctx.beginPath(); ctx.moveTo(x, y + TILE_SIZE / 2); ctx.lineTo(x + TILE_SIZE, y + TILE_SIZE / 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x + TILE_SIZE / 2, y); ctx.lineTo(x + TILE_SIZE / 2, y + TILE_SIZE / 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x + TILE_SIZE / 2 - (TILE_SIZE / 4) , y + TILE_SIZE / 2); ctx.lineTo(x + TILE_SIZE / 2 - (TILE_SIZE / 4), y + TILE_SIZE); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x + TILE_SIZE / 2 + (TILE_SIZE / 4) , y + TILE_SIZE / 2); ctx.lineTo(x + TILE_SIZE / 2 + (TILE_SIZE / 4), y + TILE_SIZE); ctx.stroke(); }
function drawBombs() {
    const now = Date.now();
    bombs.forEach(bomb => {
        const x = bomb.col * TILE_SIZE;
        const y = bomb.row * TILE_SIZE;
        
        // Calcula o tempo decorrido desde que a bomba foi colocada
        const timeElapsed = now - bomb.placeTime;
        
        // Animação de pulsação: aumenta e diminui o tamanho a cada segundo
        const pulseSpeed = 1000; // 1 segundo por ciclo
        const pulseIntensity = 0.08; // 8% de variação no tamanho (reduzido de 20% para 8%)
        const pulse = Math.sin((timeElapsed / pulseSpeed) * Math.PI * 2) * pulseIntensity + 1;
        
        // Tamanho base da bomba (aumentado)
        const baseSize = TILE_SIZE * 1.2; // Aumentado de 0.8 para 1.2
        const currentSize = baseSize * pulse;
        
        // Posição central da bomba
        const centerX = x + TILE_SIZE / 2;
        const centerY = y + TILE_SIZE / 2;
        
        // Desenha a imagem da bomba
        const img = gameImages['bomb'];
        if (img instanceof HTMLImageElement) {
            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.drawImage(img, -currentSize/2, -currentSize/2, currentSize, currentSize);
            ctx.restore();
        } else {
            // Fallback para o desenho original se a imagem não estiver carregada
            const flash = Math.floor(timeElapsed / 200) % 2 === 0;
            ctx.fillStyle = flash ? 'black' : 'grey';
            ctx.beginPath();
            ctx.arc(centerX, centerY, currentSize/2, 0, 2 * Math.PI);
            ctx.fill();
            ctx.strokeStyle = 'orange';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(x + TILE_SIZE - 5, y + 5);
            ctx.stroke();
        }
    });
}
function drawExplosions() { ctx.fillStyle = '#ff9e00'; explosions.forEach(exp => { ctx.fillRect(exp.col * TILE_SIZE, exp.row * TILE_SIZE, TILE_SIZE, TILE_SIZE); }); }
function drawCharacter(character, imageKey) {
    if (!character || !character.isAlive) return;
    const scale = 1.8, w = TILE_SIZE * scale, h = TILE_SIZE * scale; // Aumentado de 1.3 para 1.8
    const feetY = character.y + character.height / 2;
    
    // Animação de caminhada - balanço suave para cima e para baixo
    let walkAnimationOffsetY = 0;
    let walkAnimationOffsetX = 0;
    const isMoving = (character.dx !== 0 || character.dy !== 0);
    
    if (isMoving) {
        // Cria um efeito de balanço baseado no tempo
        const walkSpeed = 3.5; // Velocidade da animação (aumentada um pouco)
        const walkAmplitudeY = 1.2; // Altura do balanço vertical (aumentada um pouco)
        const walkAmplitudeX = 0.2; // Altura do balanço lateral (aumentada um pouco)
        
        const time = Date.now() * 0.01;
        walkAnimationOffsetY = Math.sin(time * walkSpeed) * walkAmplitudeY;
        walkAnimationOffsetX = Math.sin(time * walkSpeed * 1.3) * walkAmplitudeX; // Movimento lateral suave
    } else {
        // Animação sutil de "respirar" quando parado
        const breathSpeed = 1.2; // Velocidade da respiração (aumentada um pouco)
        const breathAmplitude = 0.4; // Altura da respiração (aumentada um pouco)
        const time = Date.now() * 0.01;
        walkAnimationOffsetY = Math.sin(time * breathSpeed) * breathAmplitude;
    }
    
    const drawY = (feetY - h) + TILE_SIZE / 4 + walkAnimationOffsetY;
    const drawX = character.x - w / 2 + walkAnimationOffsetX;
    
    ctx.save();
    try {
        const img = gameImages[imageKey];
        if (img instanceof HTMLImageElement) {
            // Adiciona uma leve rotação quando está se movendo
            if (isMoving) {
                const rotationSpeed = 0.25; // Velocidade da rotação (aumentada um pouco)
                const rotationAmplitude = 0.005; // Amplitude da rotação (aumentada um pouco)
                const rotation = Math.sin(Date.now() * 0.01 * rotationSpeed) * rotationAmplitude;
                
                // Adiciona uma leve variação de escala para simular "pulo" do movimento
                const scaleSpeed = 2.5; // Velocidade da variação de escala (aumentada um pouco)
                const scaleAmplitude = 0.015; // Amplitude da variação de escala (aumentada um pouco)
                const scaleVariation = 1 + Math.sin(Date.now() * 0.01 * scaleSpeed) * scaleAmplitude;
                
                ctx.translate(character.x, drawY + h / 2);
                ctx.rotate(rotation);
                ctx.scale(scaleVariation, scaleVariation);
                ctx.translate(-character.x, -(drawY + h / 2));
            }
            
            if (character.facingDirection === 1) {
                ctx.scale(-1, 1);
                ctx.drawImage(img, -drawX - w, drawY, w, h);
            } else {
                ctx.drawImage(img, drawX, drawY, w, h);
            }
        } else {
            // Desenha um placeholder se a imagem não está pronta
            ctx.fillStyle = '#888';
            ctx.fillRect(drawX, drawY, w, h);
        }
    } finally {
        ctx.restore();
    }
    
    // Efeito visual de congelamento
    if (character.isFrozen) {
        const visualCenterY = drawY + h / 2;
        ctx.fillStyle = 'rgba(173, 216, 230, 0.5)';
        ctx.beginPath();
        ctx.arc(character.x, visualCenterY, character.width, 0, 2 * Math.PI);
        ctx.fill();
    }
    
    // Efeito visual de escudo
    if (character.hasShield && (!character.shieldUntil || Date.now() < character.shieldUntil)) {
        const visualCenterY = drawY + h / 2;
        ctx.save();
        ctx.strokeStyle = '#00e6ff';
        ctx.lineWidth = 5;
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.arc(character.x, visualCenterY, character.width * 0.9, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.restore();
    }
}
function drawPlayer() {
    // Verifica se o player existe antes de tentar desenhá-lo
    if (!player) return;
    
    // Usa a skin do player, se existir
    const skinKey = player.skin && gameImages[player.skin] ? player.skin : 'player';
    drawCharacter(player, skinKey);
}
function drawOtherPlayers() {
    for(const id in otherPlayers) {
        const op = otherPlayers[id];
        const skinKey = op.skin && gameImages[op.skin] ? op.skin : 'otherPlayer';
        drawCharacter(op, skinKey);
    }
}
function drawEnemy() { if (enemy && enemy.isAlive) { ctx.fillStyle = '#c1121f'; ctx.fillRect(enemy.x - enemy.width / 2 + 5, enemy.y - enemy.height / 2 + 18, enemy.width - 10, enemy.height - 20); ctx.fillStyle = '#780000'; ctx.beginPath(); ctx.arc(enemy.x, enemy.y - 4, enemy.width / 2, 0, 2 * Math.PI); ctx.fill(); }}
function drawFireItem(x,y){ ctx.fillStyle='#d90429';ctx.beginPath();ctx.arc(x+TILE_SIZE/2,y+TILE_SIZE/1.5,TILE_SIZE/3,0,2*Math.PI);ctx.fill();ctx.fillStyle='#ff9e00';ctx.beginPath();ctx.arc(x+TILE_SIZE/2,y+TILE_SIZE/1.8,TILE_SIZE/4,0,2*Math.PI);ctx.fill();ctx.fillStyle='#fefae0';ctx.beginPath();ctx.arc(x+TILE_SIZE/2,y+TILE_SIZE/2.2,TILE_SIZE/6,0,2*Math.PI);ctx.fill();}
function drawTrapItem(x, y) { ctx.fillStyle = '#8338ec'; ctx.beginPath(); ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, TILE_SIZE / 3, 0, 2 * Math.PI); ctx.fill(); ctx.fillStyle = '#3a0ca3'; ctx.beginPath(); ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, TILE_SIZE / 6, 0, 2 * Math.PI); ctx.fill(); }
function drawActiveTraps() { activeTraps.forEach(trap => { const x = trap.col * TILE_SIZE, y = trap.row * TILE_SIZE; const flash = Math.floor((Date.now() - trap.placeTime) / 300) % 2 === 0; ctx.strokeStyle = flash ? '#ff00f4' : '#8338ec'; ctx.lineWidth = 4; ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE); }); }
function drawBombItem(x, y) { ctx.fillStyle = 'black'; ctx.beginPath(); ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, TILE_SIZE / 3, 0, 2 * Math.PI); ctx.fill(); ctx.fillStyle = 'white'; ctx.font = 'bold 16px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('B', x + TILE_SIZE / 2, y + TILE_SIZE / 2); }
function drawSpeedItem(x, y) { ctx.fillStyle = '#CD7F32'; ctx.fillRect(x + 10, y + 12, TILE_SIZE / 2, TILE_SIZE / 1.8); ctx.fillStyle = '#A0522D'; ctx.fillRect(x + 10, y + 28, TILE_SIZE / 1.5, TILE_SIZE / 4); }
function drawShieldItem(x, y) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, TILE_SIZE / 3, 0, 2 * Math.PI);
    ctx.fillStyle = '#00e6ff';
    ctx.globalAlpha = 0.7;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#0077b6';
    ctx.stroke();
    ctx.restore();
}
function drawTrapAoe() { ctx.fillStyle = 'rgba(131, 56, 236, 0.4)'; trapAoeEffects.forEach(effect => { ctx.fillRect(effect.col * TILE_SIZE, effect.row * TILE_SIZE, TILE_SIZE, TILE_SIZE); }); }
function drawFlyingBombItem(x, y) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, TILE_SIZE / 3, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffb703';
    ctx.globalAlpha = 0.8;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#fb8500';
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + TILE_SIZE / 2, y + TILE_SIZE / 2);
    ctx.lineTo(x + TILE_SIZE / 2, y + TILE_SIZE / 6);
    ctx.strokeStyle = '#023047';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
}
// Corrigido: else if do escudo deve estar dentro do loop de desenho dos itens
function drawGame() {
    ctx.fillStyle = '#3a8f4a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!grid || grid.length === 0) return;
    for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
            const val = grid[r][c];
            // Sempre desenhe o fundo primeiro, exceto para paredes
            if (val !== 1 && val !== 2) {
                drawFreeBlock(c * TILE_SIZE, r * TILE_SIZE);
            }
            // Depois desenhe o que for necessário
            if (val === 1) drawIndestructibleWall(c * TILE_SIZE, r * TILE_SIZE);
            else if (val === 2) drawDestructibleBlock(c * TILE_SIZE, r * TILE_SIZE);
            else if (val === 4) drawFireItem(c * TILE_SIZE, r * TILE_SIZE);
            else if (val === 5) drawTrapItem(c * TILE_SIZE, r * TILE_SIZE);
            else if (val === 6) drawBombItem(c * TILE_SIZE, r * TILE_SIZE);
            else if (val === 7) drawSpeedItem(c * TILE_SIZE, r * TILE_SIZE);
            else if (val === 8) drawShieldItem(c * TILE_SIZE, r * TILE_SIZE);
            else if (val === 9) drawFlyingBombItem(c * TILE_SIZE, r * TILE_SIZE);
            // Não precisa de else para 0, pois já desenhou o fundo
        }
    }
    drawTrapAoe();
    drawBombs();
    drawActiveTraps();
    drawExplosions();
    
    // Verifica se o jogador atual é um espectador
    const isSpectator = player && player.isSpectator;
    
    // Só desenha o player se existir e não for espectador
    if (player && !isSpectator) {
        drawPlayer();
    }
    
    if (isOnlineGame) drawOtherPlayers();
    else drawEnemy();
    
    // Só desenha o HUD se não for espectador
    if (!isSpectator) {
        drawHUD();
    }
}
function drawHUD() { 
    if (!player || typeof player.speed === 'undefined') return; 
    
    const iconSize = 20, padding = 10, itemWidth = 55, hudHeight = 35; 
    const totalWidth = (itemWidth * 4) + (padding * 3); 
    const startX = canvas.width - totalWidth; 
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'; 
    ctx.fillRect(startX, 0, totalWidth, hudHeight); 
    ctx.fillStyle = 'white'; 
    ctx.font = '16px "Press Start 2P"'; 
    ctx.textAlign = 'left'; 
    ctx.textBaseline = 'middle'; 
    const textOffset = 25, yPos = hudHeight / 2; 
    let xPos = startX + padding; 
    ctx.fillStyle = 'black'; 
    ctx.beginPath(); 
    ctx.arc(xPos + iconSize / 2, yPos, iconSize / 2.5, 0, 2 * Math.PI); 
    ctx.fill(); 
    ctx.fillStyle = 'white'; 
    ctx.fillText(`${player.maxBombs - player.activeBombCount}`, xPos + textOffset, yPos + 2); 
    xPos += itemWidth; 
    ctx.fillStyle = '#d90429'; 
    ctx.beginPath(); 
    ctx.moveTo(xPos, yPos + 8); 
    ctx.lineTo(xPos + iconSize, yPos + 8); 
    ctx.lineTo(xPos + iconSize / 2, yPos - 8); 
    ctx.closePath(); 
    ctx.fill(); 
    ctx.fillStyle = 'white'; 
    ctx.fillText(`${player.explosionRange}`, xPos + textOffset, yPos + 2); 
    xPos += itemWidth; 
    ctx.fillStyle = '#fceabb'; 
    ctx.fillRect(xPos, yPos - 8, iconSize - 5, iconSize - 4); 
    ctx.fillRect(xPos + iconSize - 10, yPos + 2, iconSize / 2, iconSize / 2); 
    ctx.fillStyle = 'white'; 
    ctx.fillText(`${player.speed.toFixed(1)}`, xPos + textOffset, yPos + 2); 
    xPos += itemWidth; 
    ctx.fillStyle = '#ffb703'; 
    ctx.beginPath(); 
    ctx.arc(xPos + iconSize / 2, yPos, iconSize / 2.5, 0, 2 * Math.PI); 
    ctx.fill(); 
    ctx.fillStyle = 'white'; 
    ctx.fillText(`${player.flyingBombs || 0}`, xPos + textOffset, yPos + 2); 
    xPos += itemWidth; 
}
function getPlayerGridPos() { if (!player || typeof player.x === 'undefined') return {}; const logicalY = player.y + player.height / 4; const col = Math.floor(player.x / TILE_SIZE); const row = Math.floor(logicalY / TILE_SIZE); return { col, row }; }
// --- LÓGICA DE UPDATE ---
function updatePlayer() {
    handleMovement();
    if (!player || !player.isAlive || player.isFrozen) return;

    const prevX = player.x, prevY = player.y, prevFacing = player.facingDirection;

    const nextX = player.x + player.dx * player.speed;
    if (!collides(nextX, player.y, player)) player.x = nextX;

    const nextY = player.y + player.dy * player.speed;
    if (!collides(player.x, nextY, player)) player.y = nextY;

    if (player.dx > 0) player.facingDirection = 1;
    else if (player.dx < 0) player.facingDirection = -1;

    if (isOnlineGame && (player.x !== prevX || player.y !== prevY || player.facingDirection !== prevFacing)) {
        socket.emit('playerUpdate', { x: player.x, y: player.y, facingDirection: player.facingDirection });
    }

    const { col, row } = getPlayerGridPos();
    if (grid[row] && grid[row][col] > 3) {
        playSound(powerupSound);
        if (isOnlineGame) {
            socket.emit('collectItem', { row, col });
        } else {
            const itemType = grid[row][col];
            if (itemType === 4) player.explosionRange++;
            else if (itemType === 5) {
                player.trapCount++;
                updateTrapButton();
            } else if (itemType === 6) {
                player.maxBombs++;
                updateBombButton();
            } else if (itemType === 7) {
                player.speed += 0.06;
            } else if (itemType === 8) { // Adiciona lógica para coletar o escudo
                player.hasShield = true;
                player.shieldEndTime = Date.now() + 6000; // Escudo dura 6 segundos
            } else if (itemType === 9) {
                player.flyingBombs = (player.flyingBombs || 0) + 1;
                updateFlyingBombButton();
            }
            grid[row][col] = 0; // Remove o item do grid no modo offline
        }
    }
}
function collides(x, y, entity) { if (!grid || grid.length === 0) return true; const corners = [ { x: x - entity.width/2+4, y: y-entity.height/2+20 }, { x: x + entity.width/2-4, y: y-entity.height/2+20 }, { x: x - entity.width/2+4, y: y + entity.height/2-4 }, { x: x + entity.width/2-4, y: y + entity.height/2-4 } ]; for (const corner of corners) { const col = Math.floor(corner.x / TILE_SIZE), row = Math.floor(corner.y / TILE_SIZE); if (!grid[row]) return true; const tile = grid[row][col]; if (tile === 1 || tile === 2) return true; if (tile === 3) { const bomb = bombs.find(b => b.row === row && b.col === col); if (bomb && bomb.isSolid) return true; } } return false; }
function updateBombSolidity() { 
    if (!player || !player.isAlive) return; 
    
    bombs.forEach(bomb => { 
        if (bomb.isSolid) return; 
        const bombRect = { 
            left: bomb.col * TILE_SIZE, 
            right: (bomb.col + 1) * TILE_SIZE, 
            top: bomb.row * TILE_SIZE, 
            bottom: (bomb.row + 1) * TILE_SIZE 
        }; 
        const playerRect = { 
            left: player.x - player.width / 2, 
            right: player.x + player.width / 2, 
            top: player.y - player.height / 2 + 20, 
            bottom: player.y + player.height / 2 
        }; 
        if (playerRect.right <= bombRect.left || playerRect.left >= bombRect.right || playerRect.bottom <= bombRect.top || playerRect.top >= bombRect.bottom) { 
            bomb.isSolid = true; 
            if (isOnlineGame) socket.emit('bombNowSolid', { row: bomb.row, col: bomb.col }); 
        } 
    }); 
}
function updateEnemy() { if(!enemy||!enemy.isAlive)return;const now=Date.now();if(now-enemy.lastDirectionChange>enemy.directionChangeInterval){const rand=Math.random();if(rand<0.25){enemy.dx=1;enemy.dy=0;}else if(rand<0.5){enemy.dx=-1;enemy.dy=0;}else if(rand<0.75){enemy.dx=0;enemy.dy=1;}else{enemy.dx=0;enemy.dy=-1;}enemy.lastDirectionChange=now;}const nextX=enemy.x+enemy.dx*enemy.speed;const nextY=enemy.y+enemy.dy*enemy.speed;if(!collides(nextX,enemy.y,enemy)){enemy.x=nextX;}else{enemy.lastDirectionChange=0;}if(!collides(enemy.x,nextY,enemy)){enemy.y=nextY;}else{enemy.lastDirectionChange=0;} }
function updateExplosions() { const now = Date.now(); for (let i = explosions.length - 1; i >= 0; i--) { if (now - explosions[i].time >= EXPLOSION_DURATION) explosions.splice(i, 1); } }
function updateTrapAoeEffects() { const now = Date.now(); for (let i = trapAoeEffects.length - 1; i >= 0; i--) { if (now - trapAoeEffects[i].time >= TRAP_AOE_DURATION) trapAoeEffects.splice(i, 1); } }
// Nova função para gerenciar a duração do escudo
function updateShieldStatus() {
    // Se não há player ou não há escudo, não faz nada
    if (!player || !player.hasShield) return;
    
    // Se o escudo expirou
    if (Date.now() >= player.shieldEndTime) {
        player.hasShield = false;
        player.shieldEndTime = 0;
        console.log("Escudo expirou."); // Log apenas quando realmente expira
        // No modo online, idealmente o servidor notificaria sobre a expiração do escudo.
        // Se o servidor não fizer isso, pode ser necessário emitir um evento aqui.
    }
}


function placeBomb() {
    // Verifica se o player existe
    if (!player) return;
    
    // Garante que activeBombCount nunca fique indefinido ou NaN
    if (typeof player.activeBombCount !== 'number' || isNaN(player.activeBombCount)) player.activeBombCount = 0;
    if ((player.maxBombs - player.activeBombCount) <= 0 || !player.isAlive) return;
    const { col, row } = getPlayerGridPos();
    if (!grid[row] || grid[row][col] !== 0) return;

    if (isOnlineGame) {
        socket.emit('placeBomb', { row, col });
    } else {
        player.activeBombCount++;
        updateBombButton();
        bombs.push({ col, row, placeTime: Date.now(), range: player.explosionRange, isSolid: false });
        grid[row][col] = 3; // Marca a posição como ocupada por uma bomba
    }
}
function placeTrap() { 
    if (!player || player.trapCount <= 0 || !player.isAlive) return; 
    const { col, row } = getPlayerGridPos(); 
    if (!grid[row] || grid[row][col] !== 0) return; 
    socket.emit('placeTrap', { row, col }); 
}
function updateTrapButton() { 
    if (!player) return; 
    trapButton.innerText = `Armadilha\n(${player.trapCount})`; 
    trapButton.disabled = player.trapCount <= 0; 
    trapButton.style.display = player.trapCount > 0 ? 'block' : 'none'; 
}
function updateBombButton() { 
    if (!player) return; 
    bombButton.innerText = `Bomba (${player.maxBombs - player.activeBombCount})`; 
    bombButton.disabled = (player.maxBombs - player.activeBombCount) <= 0; 
}
function checkGameState() {
    if (isGameOver || isOnlineGame || !player) return;

    explosions.forEach(exp => {
        // Verifica colisão do jogador com explosão
        if (player.isAlive) {
            const { col, row } = getPlayerGridPos();
            if (col === exp.col && row === exp.row) {
                if (player.hasShield) { // Se tiver escudo, remove o escudo e sobrevive
                    player.hasShield = false;
                    player.shieldEndTime = 0;
                    console.log("Escudo protegeu contra explosão!"); // Opcional: log
                } else { // Se não tiver escudo, morre
                    playSound(deathSound);
                    player.isAlive = false;
                    endGame("Game Over");
                }
            }
        }

        // Verifica colisão do inimigo com explosão (apenas no modo offline)
        if (enemy && enemy.isAlive) {
            const eCol = Math.floor(enemy.x / TILE_SIZE), eRow = Math.floor(enemy.y / TILE_SIZE);
            if (eCol === exp.col && eRow === exp.row) {
                enemy.isAlive = false;
                if (selectedGameMode === 'batalha' ) { // No modo offline 'batalha' (contra inimigo), vencer
                    endGame("Voce Venceu!");
                }
            }
        }

        // Verifica se a explosão atinge um bloco destrutível (valor 2)
        if (grid[exp.row] && grid[exp.row][exp.col] === 2) {
            grid[exp.row][exp.col] = 0; // Destroi o bloco

            // Chance de spawnar um item (ajuste a probabilidade conforme necessário)
            if (Math.random() < 0.2) { // 20% de chance de spawnar um item
                const itemTypes = [4, 5, 6, 7, 8, 9]; // 4: Fire, 5: Trap, 6: Bomb, 7: Speed, 8: Shield, 9: Flying Bomb
                const randomItemType = itemTypes[Math.floor(Math.random() * itemTypes.length)];
                grid[exp.row][exp.col] = randomItemType; // Coloca o item no grid
            }
        }
    });
}
// EM CLIENT.JS - SUBSTITUA SUA FUNÇÃO ATUAL POR ESTA VERSÃO CORRIGIDA E FINAL

function checkOnlinePlayerState() {
    // Se o jogo acabou ou o jogador já está morto (confirmado pelo servidor), não faz nada.
    if (isGameOver || !player || !player.isAlive) return;

    // A única responsabilidade do cliente no modo online é verificar se ele colidiu
    // com uma explosão ENQUANTO tem um escudo, para que o efeito visual do
    // escudo sumindo seja imediato.
    explosions.forEach(exp => {
        const { col, row } = getPlayerGridPos();
        
        // A colisão só importa se o jogador TEM um escudo.
        if (player.hasShield && col === exp.col && row === exp.row) {
            
            // Se colidiu com escudo, remove o escudo localmente.
            // O servidor fará a mesma coisa e enviará uma atualização de stats,
            // mas fazer isso localmente evita o delay visual.
            player.hasShield = false;
            player.shieldEndTime = 0;
            
            // NÃO EXISTE MAIS O BLOCO 'ELSE'.
            // O cliente não faz NADA se colidir sem escudo.
            // Ele espera o comando 'playerDied' do servidor para morrer.
        }
    });
}

// --- CONTROLE DE JOGO E TELAS ---
export function showScreen(screen) {
    document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
    document.querySelectorAll('#game-canvas, #action-buttons, #pause-button').forEach(el => el.style.display = 'none');
    
    // Esconde apenas a tela de preparação de partida
    const preparingMatchScreen = document.getElementById('preparing-match-screen');
    if (preparingMatchScreen) preparingMatchScreen.style.display = 'none';
    
    // NÃO esconde o painel de espectador - ele deve permanecer visível
    // const spectatorScreen = document.getElementById('spectator-screen');
    // if (spectatorScreen) spectatorScreen.style.display = 'none';
    
    screen.style.display = 'flex';
}
function showMenu() {
    // Esconde a mensagem de respawn, se estiver visível
    const respawnMessageEl = document.getElementById('respawn-message');
    if (respawnMessageEl) respawnMessageEl.style.display = 'none';
    // 1. Avisa ao servidor que você está saindo da partida/sessão.
    if (isOnlineGame) {
        socket.emit('leaveGame');
    }

    // 2. Para o loop de renderização do jogo.
    isLoopRunning = false;
    isOnlineGame = false; // Define que não estamos mais em um jogo online

    // 3. Esconde elementos do jogo e mostra o menu principal.
    showScreen(menuScreen);
    if (pauseMenu) pauseMenu.style.display = 'none';
    if (typeof matchTimerEl !== 'undefined' && matchTimerEl) matchTimerEl.style.display = 'none';

    // Esconde painel de estatísticas da sessão (garante sumiço imediato)
    const statsPanel = document.getElementById('session-stats');
    if (statsPanel) {
        statsPanel.style.display = 'none';
        // Limpa também o conteúdo para evitar "flash" ao voltar
        const totalMatchesEl = document.getElementById('total-matches');
        const playerListEl = document.getElementById('player-list');
        if (totalMatchesEl) totalMatchesEl.textContent = '0';
        if (playerListEl) playerListEl.innerHTML = '';
    }

    // Para o timer multiplayer, se estiver rodando
    if (typeof matchTimerInterval !== 'undefined' && matchTimerInterval) {
        clearInterval(matchTimerInterval);
        matchTimerInterval = null;
    }
    matchTimeLeft = null;

    // Remove o joystick se ele existir
    const joystick = document.querySelector('.joystick-overlay');
    if (joystick) joystick.remove();
    
    // Garante que o botão de pausa/configurações suma ao sair para o menu
    if (pauseButton) pauseButton.style.display = 'none';
    // Garante que os botões de ação sumam
    if (actionButtons) actionButtons.style.display = 'none';
    // Garante que o canvas suma
    if (canvas) canvas.style.display = 'none';
    // Garante que o menu de opções in-game suma
    const ingameOptionsMenu = document.getElementById('ingame-options-menu');
    if (ingameOptionsMenu) ingameOptionsMenu.style.display = 'none';
}
function pauseGame() {
    if (isGameOver) return; // A única checagem é se o jogo já acabou

    // No modo online, o jogo continua rodando no fundo, mas o menu aparece
    if (!isOnlineGame) {
        isPaused = true; // Só pausamos de verdade no modo offline
    }

    pauseMenu.style.display = 'flex';
}
function resumeGame() { isPaused = false; pauseMenu.style.display = 'none'; }
function revivePlayerSolo() {
    // Limpa bombas, explosões, armadilhas, etc
    bombs = [];
    explosions = [];
    activeTraps = [];
    trapAoeEffects = [];
    // Limpa bomba do grid na posição inicial
    const startCol = 1, startRow = 1;
    if (grid[startRow] && (grid[startRow][startCol] === 3 || grid[startRow][startCol] > 3)) {
        grid[startRow][startCol] = 0;
    }
    // Reseta o player com valores padrão
    resetPlayer();
    player.isAlive = true;
    player.isFrozen = false;
    player.activeBombCount = 0;
    player.trapCount = 0;
    player.maxBombs = 2;
    player.explosionRange = 2;
    player.flyingBombs = 0;
    player.x = TILE_SIZE * 1.5;
    player.y = TILE_SIZE * 1.5;
    player.dx = 0;
    player.dy = 0;
    // Atualiza botões
    updateBombButton();
    updateTrapButton();
    updateFlyingBombButton && updateFlyingBombButton();
    isGameOver = false;
    // Esconde tela de game over e mostra o canvas
    if (gameOverScreen) gameOverScreen.style.display = 'none';
    if (canvas) canvas.style.display = 'block';
    if (actionButtons) actionButtons.style.display = 'flex';
    if (pauseButton) pauseButton.style.display = 'block';
    // Reinicia o loop
    isLoopRunning = true;
    requestAnimationFrame(gameLoop);
    // Se online, avisa o servidor que reviveu
    if (isOnlineGame) {
        socket.emit('playerRevived', {
            x: player.x,
            y: player.y,
            width: player.width,
            height: player.height,
            speed: player.speed,
            dx: player.dx,
            dy: player.dy,
            explosionRange: player.explosionRange,
            trapCount: player.trapCount,
            isFrozen: player.isFrozen,
            frozenUntil: player.frozenUntil,
            maxBombs: player.maxBombs,
            activeBombCount: player.activeBombCount,
            isAlive: player.isAlive,
            facingDirection: player.facingDirection,
            hasShield: player.hasShield,
            shieldEndTime: player.shieldEndTime,
            skin: player.skin,
            flyingBombs: player.flyingBombs
        });
    }
}

function endGame(message) {
    isGameOver = true;
    isLoopRunning = false;
    pauseButton.style.display = 'none';
    actionButtons.style.display = 'none';
    gameOverMessageEl.innerText = message;
    showScreen(gameOverScreen);

    // Renascimento automático após 5 segundos (solo ou sozinho)
    if (!isOnlineGame || (isOnlineGame && Object.keys(otherPlayers).length === 0)) {
        setTimeout(() => {
            // CORREÇÃO: Usa a função correta que preserva power-ups
            if (isOnlineGame && Object.keys(otherPlayers).length === 0) {
                respawnPlayerInPlace(); // Preserva power-ups no modo online solo
            } else {
                revivePlayerSolo(); // Reset completo para modo offline
            }
        }, 5000);
    }
}

// DICA: Se "Empate" aparece quando deveria ser "Game Over", ajuste a lógica do servidor (index.js) para garantir que:
// - Se só UM jogador morreu, envie "Game Over" só para ele, e "Você Venceu!" para o outro.
// - Só envie "Empate!" se TODOS morrerem ao mesmo tempo.

function gameLoop() {
    // Permite limpar explosões mesmo após a morte, até o revive
    if (!isLoopRunning) return;

    if (isGameOver) {
        updateExplosions();
        updateTrapAoeEffects();
        drawGame();
        requestAnimationFrame(gameLoop);
        return;
    }

    if (isPaused && !isOnlineGame) {
        requestAnimationFrame(gameLoop);
        return;
    }

    // Funções de atualização que rodam em ambos os modos
    updatePlayer();
    updateExplosions();
    updateTrapAoeEffects();
    updateBombSolidity(); // A lógica de solidez da bomba é necessária em ambos os modos
    updateShieldStatus(); // Adiciona a atualização do status do escudo

    if (isOnlineGame) {
        // No modo online, o cliente verifica seu próprio estado contra os dados do servidor
        checkOnlinePlayerState();
    } else {
        // No modo offline, o cliente gerencia tudo
        if (selectedGameMode === 'batalha') updateEnemy();
        checkGameState(); // A função original que checa jogador E inimigo
    }
    // Se o tempo acabou, reinicia a partida automaticamente
    if (typeof matchTimeLeft === 'number' && matchTimeLeft <= 0 && !isGameOver) {
        setTimeout(() => {
            if (!isOnlineGame && isGameOver) {
                startGame(selectedGameMode || 'batalha', selectedMap || 'map1');
            }
        }, 1000);
        isGameOver = true;
    }

    drawGame();
    requestAnimationFrame(gameLoop);
}

function setupJoystick() { 
    if(document.querySelector('.joystick-overlay'))return;
    const joystickContainer=document.createElement('div');
    joystickContainer.className='joystick-overlay';
    joystickContainer.style.cssText="position:absolute; bottom:0; left:0; width:100%; height:100%; z-index:10;";
    document.body.appendChild(joystickContainer);
    const manager=nipplejs.create({zone:joystickContainer,mode:'static',position:{left:'100px',bottom:'100px'},color:'white',size:100,threshold:0.2});
    manager.on('move',(evt,data)=>{
        if(player&&data.vector){
            const length=Math.sqrt(data.vector.x*data.vector.x+data.vector.y*data.vector.y);
            player.dx=data.vector.x/length;
            player.dy=-data.vector.y/length;
        }
    });
    manager.on('end',()=>{
        if(player){
            player.dx=0;
            player.dy=0;
        }
    }); 
}
function handlePlaceBomb(event) { event.preventDefault(); placeBomb(); }
function handlePlaceTrap(event) { event.preventDefault(); placeTrap(); }
async function startGame(mode, mapId) {
    // Aguarda as imagens carregarem antes de iniciar o jogo
    if (!window._imagesLoaded) {
        await new Promise(resolve => {
            const check = () => window._imagesLoaded ? resolve() : setTimeout(check, 50);
            check();
        });
    }

    // Esta função agora só lida com modos offline
    selectedGameMode = mode;
    selectedMap = mapId;
    isOnlineGame = false; // <-- Sempre false aqui
    isGameOver = false;
    isPaused = false;

    // Limpa estado do jogo anterior
    bombs = [];
    explosions = [];
    activeTraps = [];
    trapAoeEffects = [];
    
    // Configura a UI para o jogo
    document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
    canvas.style.display = 'block';
    actionButtons.style.display = 'flex';
    pauseButton.style.display = 'block';

    // Define o tamanho do canvas
    canvas.width = TILE_SIZE * GRID_COLS;
    canvas.height = TILE_SIZE * GRID_ROWS;

    // Inicializa os elementos do jogo offline
    createGrid(selectedMap);
    resetPlayer();
    if (mode === 'batalha') {
        initializeEnemy();
    }
    
    // Atualiza a UI e controles
    updateTrapButton();
    updateBombButton();
    updateFlyingBombButton(); // Chame esta também
    setupJoystick();

    // Inicia o loop do jogo
    if (!isLoopRunning) {
        isLoopRunning = true;
        gameLoop();
    }
}

// --- [MULTIPLAYER] SOCKET EVENT HANDLERS ---
socket.on('connect', () => { myId = socket.id; console.log('Conectado ao servidor com ID:', myId); });

socket.on('gameStart', (data) => {
    // Log de diagnóstico para verificar os dados recebidos do servidor
    console.log('[gameStart] Evento recebido:', data);

    // Validação robusta dos dados essenciais da partida
    if (!data || !data.grid || !data.players) {
        console.error('[gameStart] Dados da partida inválidos recebidos do servidor.', data);
        alert('Erro ao iniciar a partida. Retornando ao menu.');
        showMenu(); // Função que retorna o usuário para a tela de menu principal
        return;
    }

    // Esconde a tela de "game over" ou "loading" se estiverem visíveis
    if (gameOverScreen) gameOverScreen.style.display = 'none';
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) loadingScreen.style.display = 'none';
    
    // ---> Adicione esta linha para esconder a tela de fim de rodada <---
    if (roundOverScreen) roundOverScreen.style.display = 'none';
    
    // ---> Adicione esta linha para esconder a tela de espectador <---
    const spectatorScreen = document.getElementById('spectator-screen');
    if (spectatorScreen) spectatorScreen.style.display = 'none';
    
    // Reseta a mensagem do espectador para o padrão
    const spectatorMessage = document.getElementById('spectator-message');
    if (spectatorMessage) {
        spectatorMessage.innerHTML = `
            Você entrou durante uma partida em andamento.<br>
            Aguarde a próxima rodada para jogar!
        `;
    }
    
    // Esconde a notificação de morte se estiver visível
    const deathNotification = document.getElementById('death-notification');
    if (deathNotification) {
        deathNotification.style.display = 'none';
    }

    // 1. Limpa completamente o estado do jogo anterior
    isGameOver = false;
    isPaused = false;
    bombs = [];
    explosions = [];
    activeTraps = [];
    trapAoeEffects = [];
    otherPlayers = {};

    // 2. Define o novo estado do jogo com base nos dados do servidor
    grid = data.grid;
    isOnlineGame = true;

    // 3. Configura o canvas com o tamanho correto do grid
    canvas.width = TILE_SIZE * GRID_COLS;
    canvas.height = TILE_SIZE * GRID_ROWS;

    // 4. Configura os jogadores
    for (const id in data.players) {
        if (id === myId) {
            resetPlayer(data.players[id]); // Sua função `resetPlayer` já lida com isso
            // Se o jogador era espectador e agora se tornou ativo, mostra uma mensagem
            if (player && player.isSpectator === false) {
                console.log('[gameStart] Espectador se tornou jogador ativo!');
                // Pode adicionar uma notificação visual aqui se desejar
            }
        } else {
            otherPlayers[id] = data.players[id];
        }
    }
    // Garante que o objeto 'player' não seja nulo se ele for o único na sala
    if (!player && data.players[myId]) {
        resetPlayer(data.players[myId]);
    }

    // 5. Atualiza a interface do usuário (HUD, botões de ação)
    updateBombButton();
    updateTrapButton();
    updateFlyingBombButton();
    setupJoystick(); // Configura o joystick para mobile

    // 6. Mostra os elementos corretos da tela de jogo
    if (canvas) canvas.style.display = 'block';
    if (actionButtons) actionButtons.style.display = 'flex';
    if (pauseButton) pauseButton.style.display = 'block';

    // 7. Inicia o game loop de forma segura para evitar múltiplas instâncias
    if (!isLoopRunning) {
        isLoopRunning = true;
        console.log('[gameStart] Iniciando o game loop.');
        gameLoop();
    } else {
        console.warn('[gameStart] Tentativa de iniciar um game loop que já está rodando.');
    }
});

// Função para mostrar tela de carregando
function showLoadingScreen() {
    let loadingScreen = document.getElementById('loading-screen');
    if (!loadingScreen) {
        loadingScreen = document.createElement('div');
        loadingScreen.id = 'loading-screen';
        loadingScreen.style.position = 'fixed';
        loadingScreen.style.top = '0';
        loadingScreen.style.left = '0';
        loadingScreen.style.width = '100vw';
        loadingScreen.style.height = '100vh';
        loadingScreen.style.background = 'rgba(0,0,0,0.85)';
        loadingScreen.style.display = 'flex';
        loadingScreen.style.alignItems = 'center';
        loadingScreen.style.justifyContent = 'center';
        loadingScreen.style.zIndex = '9999';
        loadingScreen.innerHTML = `<h1 style='color:white;font-size:2.5rem;'>Carregando próxima partida...</h1>`;
        document.body.appendChild(loadingScreen);
    } else {
        loadingScreen.style.display = 'flex';
    }
}
// REMOVIDO: Esta lógica não é mais necessária com a nova arquitetura de salas
// socket.on('newPlayer', (pData) => {
//     if (pData.id !== myId) {
//         // Se já existe outro player, significa que alguém entrou durante a partida
//         if (Object.keys(otherPlayers).length === 0 && !isGameOver) {
//             // Encerra a partida atual imediatamente
//             isLoopRunning = false;
//             isGameOver = true;
//             // Mostra tela de carregando
//             showLoadingScreen();
//         }
//         otherPlayers[pData.id] = pData;
//     }
// });
socket.on('playerMoved', (data) => { if (data.id !== myId && otherPlayers[data.id]) Object.assign(otherPlayers[data.id], data); });
socket.on('bombPlaced', (bombData) => { bombs.push(bombData); grid[bombData.row][bombData.col] = 3; });
socket.on('bombExploded', (data) => { bombs = bombs.filter(b => b.row !== data.row || b.col !== data.col); });
socket.on('explosion', (data) => { playSound(explosionSound); data.explosions.forEach(exp => explosions.push({ ...exp, time: Date.now() })); });
socket.on('gridUpdate', (data) => { if(grid[data.row]) grid[data.row][data.col] = data.newValue; });
socket.on('playerStatsUpdate', (data) => {
    if (data.id === myId) {
        // Atualiza apenas as propriedades que NÃO são isAlive no player local
        for (const key in data.stats) {
            if (key !== 'isAlive') {
                player[key] = data.stats[key];
            }
        }
        updateBombButton();
        updateTrapButton();
        updateFlyingBombButton(); // <-- Atualiza o botão da bomba voadora
    } else if (otherPlayers[data.id]) {
        // Para outros jogadores, pode atualizar tudo normalmente
        Object.assign(otherPlayers[data.id], data.stats);
    }
});
socket.on('playerDied', (data) => {
    playSound(deathSound);
    const target = data.id === myId ? player : otherPlayers[data.id];
    if (target) {
        target.isAlive = false;
    }



    // Se for o player local que morreu...
    if (data.id === myId) {
        // ... e ele está online e sozinho...
        if (isOnlineGame && Object.keys(otherPlayers).length === 0) {
            handlePlayerDeathOnlineSolo(); // Chama nossa função de respawn (já corrigida).
        } else {
            // Se morreu em uma partida com outros jogadores, aguarda o servidor
            // enviar o evento 'spectatorMode' para se tornar espectador
            // NÃO para o loop aqui - deixa o servidor decidir
            console.log('[playerDied] Jogador local morreu. Aguardando transição para espectador...');
            
            // Mostra uma mensagem temporária de que morreu
            const spectatorScreen = document.getElementById('spectator-screen');
            if (spectatorScreen && spectatorScreen.style.display === 'flex') {
                const deathNotification = document.getElementById('death-notification');
                if (deathNotification) {
                    deathNotification.style.display = 'block';
                    setTimeout(() => {
                        if (deathNotification) {
                            deathNotification.style.display = 'none';
                        }
                    }, 3000);
                }
            }
        }
    }
});
socket.on('playerDisconnected', (data) => { 
    delete otherPlayers[data.id]; 
});
socket.on('gameOver', (data) => {
    isLoopRunning = false;
    endGame(data.message);
    // Esconde timer
    matchTimerEl.style.display = 'none';
    matchTimeLeft = null;
    if (matchTimerInterval) clearInterval(matchTimerInterval);
    matchTimerInterval = null;
});

// OUVINTE PARA O NOVO EVENTO DE FIM DE RODADA
socket.on('roundOver', (data) => {
    console.log('[roundOver] Evento recebido:', data);
    
    // Para o loop do jogo para mostrar a tela de resultado
    isLoopRunning = false; 

    // Esconde os botões de ação e o canvas
    if (actionButtons) actionButtons.style.display = 'none';
    if (pauseButton) pauseButton.style.display = 'none';
    if (canvas) canvas.style.display = 'none';

    // Esconde timer
    if (matchTimerEl) matchTimerEl.style.display = 'none';
    if (matchTimerInterval) clearInterval(matchTimerInterval);
    matchTimerInterval = null;

    // Mostra a mensagem e a tela de fim de rodada
    if (roundOverMessageEl) roundOverMessageEl.innerText = data.message;
    if (roundOverScreen) roundOverScreen.style.display = 'flex';
});

// --- EVENTOS DO MODO ESPECTADOR ---
socket.on('spectatorMode', (data) => {
    console.log('[spectatorMode] Evento recebido:', data);
    
    // Para qualquer loop de jogo ativo
    isLoopRunning = false;
    
    // Esconde elementos de jogo
    if (actionButtons) actionButtons.style.display = 'none';
    if (pauseButton) pauseButton.style.display = 'none';
    if (canvas) canvas.style.display = 'none';
    if (gameOverScreen) gameOverScreen.style.display = 'none';
    if (roundOverScreen) roundOverScreen.style.display = 'none';
    
    // Configura o estado do jogo para visualização
    grid = data.grid;
    isOnlineGame = true;
    
    // Configura o canvas
    canvas.width = TILE_SIZE * GRID_COLS;
    canvas.height = TILE_SIZE * GRID_ROWS;
    canvas.style.display = 'block';
    
    // Configura os jogadores (apenas para visualização)
    otherPlayers = {};
    for (const id in data.players) {
        if (id === myId) {
            // O espectador não tem um player ativo
            player = null;
        } else {
            otherPlayers[id] = data.players[id];
        }
    }
    
    // Mostra a tela de espectador (pequena caixinha)
    const spectatorScreen = document.getElementById('spectator-screen');
    if (spectatorScreen) spectatorScreen.style.display = 'block';
    
    // Esconde os controles do jogador (botões de ação e pausa)
    if (actionButtons) actionButtons.style.display = 'none';
    if (pauseButton) pauseButton.style.display = 'none';
    
    // Verifica se o jogador era ativo e morreu (para mostrar mensagem específica)
    const wasActivePlayer = player && !player.isSpectator;
    if (wasActivePlayer) {
        const spectatorMessage = document.getElementById('spectator-message');
        if (spectatorMessage) {
            spectatorMessage.innerHTML = `
                Você morreu durante a partida!<br>
                Aguarde a próxima rodada para jogar novamente.
            `;
        }
        
        // Mostra a notificação de morte
        const deathNotification = document.getElementById('death-notification');
        if (deathNotification) {
            deathNotification.style.display = 'block';
            // Esconde a notificação após 5 segundos
            setTimeout(() => {
                if (deathNotification) {
                    deathNotification.style.display = 'none';
                }
            }, 5000);
        }
    }
    
    // Inicia o timer do espectador se houver tempo restante
    if (data.matchTimeLeft > 0) {
        // Inicia o loop de visualização (sem controles)
        if (!isLoopRunning) {
            isLoopRunning = true;
            spectatorGameLoop();
        }
    }
});

socket.on('spectatorJoined', (data) => {
    console.log('[spectatorJoined] Novo espectador:', data);
    // Adiciona o espectador à lista de outros jogadores para visualização
    otherPlayers[data.id] = {
        ...data,
        isSpectator: true,
        isAlive: false
    };
});



// Loop de jogo para espectadores (apenas visualização)
function spectatorGameLoop() {
    if (!isLoopRunning) return;
    
    // Atualiza explosões e efeitos (necessário para que não fiquem travados)
    updateExplosions();
    updateTrapAoeEffects();
    
    // Desenha o jogo
    drawGame();
    
    // Continua o loop
    requestAnimationFrame(spectatorGameLoop);
}



socket.on('trapPlaced', (trapData) => { activeTraps.push(trapData); });
socket.on('trapRemoved', (data) => { activeTraps = activeTraps.filter(t => t.row !== data.row || t.col !== data.col); });
socket.on('trapTriggered', (data) => { data.aoeArea.forEach(tile => trapAoeEffects.push({ ...tile, time: Date.now() })); });

socket.on('playerRespawnedUpdate', (data) => {
    if (otherPlayers[data.id]) {
        otherPlayers[data.id].isAlive = data.isAlive;
        otherPlayers[data.id].x = data.x;
        otherPlayers[data.id].y = data.y;
    }
});

// --- TIMER MULTIPLAYER ---
// O servidor pode emitir o tempo restante (em segundos)
var matchTimeLeft = null;
// (Removido qualquer let/var duplicado de matchTimerInterval)
socket.on('matchTimer', (data) => {
    // LOG DE DEPURAÇÃO: evento recebido
    console.log('[matchTimer] Evento recebido:', data, 'isOnlineGame:', isOnlineGame, 'isGameOver:', isGameOver);
    // Só exibe/atualiza o timer se estiver realmente em uma partida online ativa
    if (!isOnlineGame || isGameOver) {
        console.log('[matchTimer] Ignorado porque não está em partida online ativa.');
        matchTimerEl.style.display = 'none';
        if (matchTimerInterval) clearInterval(matchTimerInterval);
        matchTimerInterval = null;
        matchTimeLeft = null;
        return;
    }
    if (typeof data.timeLeft === 'number') {
        matchTimeLeft = data.timeLeft;
        console.log('[matchTimer] Atualizando timer para', matchTimeLeft, 'segundos.');
        if (matchTimeLeft > 0) {
            matchTimerEl.style.display = 'block';
            matchTimerEl.textContent = formatMatchTime(matchTimeLeft);
            console.log('[TIMER] Timer exibido:', matchTimerEl.textContent, 'Display:', matchTimerEl.style.display);
            if (matchTimerInterval) clearInterval(matchTimerInterval);
            matchTimerInterval = setInterval(() => {
                // Só atualiza se ainda está em partida
                if (!isOnlineGame || isGameOver) {
                    console.log('[matchTimer] Parando timer porque saiu da partida ou acabou.');
                    matchTimerEl.style.display = 'none';
                    clearInterval(matchTimerInterval);
                    matchTimerInterval = null;
                    matchTimeLeft = null;
                    return;
                }
                if (matchTimeLeft > 0) {
                    matchTimeLeft--;
                    matchTimerEl.textContent = formatMatchTime(matchTimeLeft);
                    matchTimerEl.style.display = 'block'; // reforça exibição
                } else {
                    console.log('[matchTimer] Timer chegou a zero.');
                    matchTimerEl.style.display = 'none';
                    clearInterval(matchTimerInterval);
                    matchTimerInterval = null;
                }
            }, 1000);
        } else {
            console.log('[matchTimer] Tempo <= 0, escondendo timer.');
            matchTimerEl.style.display = 'none';
            if (matchTimerInterval) clearInterval(matchTimerInterval);
            matchTimerInterval = null;
        }
    } else {
        console.log('[matchTimer] Dados inválidos recebidos:', data);
    }
});

function formatMatchTime(seconds) {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
}

// Adiciona botão de bomba voadora
let flyingBombButton;
// Garante que actionButtons está definido
// actionButtons já é importado de constants.js
if (!document.getElementById('flying-bomb-button')) {
    flyingBombButton = document.createElement('button');
    flyingBombButton.id = 'flying-bomb-button';
    flyingBombButton.innerText = 'Bomba Voadora';
    flyingBombButton.style.display = 'none';
    flyingBombButton.style.background = '#ffb703';
    flyingBombButton.style.color = '#222';
    flyingBombButton.style.fontWeight = 'bold';
    flyingBombButton.style.fontSize = '0.7rem';
    flyingBombButton.style.width = '80px';
    flyingBombButton.style.height = '80px';
    flyingBombButton.style.borderRadius = '50%';
    flyingBombButton.style.marginBottom = '8px';
    flyingBombButton.style.border = '3px solid #fb8500';
    flyingBombButton.style.boxShadow = '0 2px 8px #0004';
    flyingBombButton.style.transition = 'all 0.1s';
    actionButtons.insertBefore(flyingBombButton, actionButtons.firstChild);
} else {
    flyingBombButton = document.getElementById('flying-bomb-button');
}

function updateFlyingBombButton() {
    if (!player) return;
    flyingBombButton.innerText = `Bomba Voadora\n(${player.flyingBombs || 0})`;
    flyingBombButton.disabled = !player.flyingBombs || player.flyingBombs <= 0 || !player.isAlive || player.isFrozen;
    flyingBombButton.style.display = player.flyingBombs > 0 && player.isAlive && !player.isSpectator ? 'block' : 'none';
}

function handlePlaceFlyingBomb(e) {
    if (e) e.preventDefault();
    if (!player || !player.isAlive || player.isFrozen || !player.flyingBombs || player.flyingBombs <= 0) return;
    // Determina a direção baseada no último movimento válido
    let dir;
    if (player.dy < 0) dir = 2; // Cima
    else if (player.dy > 0) dir = 3; // Baixo
    else if (player.facingDirection === 1) dir = 1; // Direita
    else if (player.facingDirection === -1) dir = 0; // Esquerda
    else dir = 1; // Padrão: direita
    socket.emit('useFlyingBomb', { dir });
}

flyingBombButton.addEventListener('touchstart', handlePlaceFlyingBomb, { passive: false });
flyingBombButton.addEventListener('click', handlePlaceFlyingBomb);





// Atalhos de teclado para movimentação, bomba, armadilha e bomba voadora
const keyState = {};

// Objeto global para rastrear o estado das teclas
const keys = {
    w: false,
    a: false,
    s: false,
    d: false,
    arrowup: false,
    arrowdown: false,
    arrowleft: false,
    arrowright: false,
    ' ': false,
    e: false,
    o: false
};

window.addEventListener('keydown', (e) => {
    if (!e || typeof e.key !== 'string') return;
    const key = e.key.toLowerCase();
    if (keys.hasOwnProperty(key)) {
        keys[key] = true;
    }
    // Ações (bomba, armadilha, bomba voadora)
    if ((key === ' ' || key === 'spacebar' || key === 'space') && !e.repeat) {
        e.preventDefault();
        placeBomb();
    }
    if (key === 'e' && !e.repeat) {
        placeTrap();
    }
    if (key === 'o' && !e.repeat) {
        handlePlaceFlyingBomb(e);
    }
});

window.addEventListener('keyup', (e) => {
    if (!e || typeof e.key !== 'string') return;
    const key = e.key.toLowerCase();
    if (keys.hasOwnProperty(key)) {
        keys[key] = false;
    }
});

// Função para processar o movimento baseado no estado das teclas
function handleMovement() {
    if (!player || !player.isAlive || player.isFrozen) return;
    // Reset dx/dy
    player.dx = 0;
    player.dy = 0;
    // Vertical
    if (keys.w || keys.arrowup) player.dy = -1;
    else if (keys.s || keys.arrowdown) player.dy = 1;
    // Horizontal
    if (keys.a || keys.arrowleft) player.dx = -1;
    else if (keys.d || keys.arrowright) player.dx = 1;
}

function handlePlayerDeathOnlineSolo() {
    console.log('[DEATH] Morte em modo de aquecimento. Agendando respawn.');

    // 1. Mostra a mensagem de respawn
    const respawnMessageEl = document.getElementById('respawn-message');
    if (respawnMessageEl) {
        respawnMessageEl.innerText = 'Você morreu! Revivendo em 5 segundos...';
        respawnMessageEl.style.display = 'block';
    }

    // 2. PARE o loop do jogo TEMPORARIAMENTE para o jogador morto.
    // Isso evita que o "fantasma" do jogador se mova ou colete itens.
    isLoopRunning = false;

    // 3. Agende o renascimento usando a função leve e correta
    setTimeout(() => {
        respawnPlayerInPlace(); // <--- GARANTA QUE ESTÁ CHAMANDO ESTA FUNÇÃO
    }, 5000);
}

// ===================================================================
// --- NOVA FUNÇÃO DE RESPAWN (A SOLUÇÃO PRINCIPAL) ---
// ===================================================================
function respawnPlayerInPlace() {
    console.log('[RESPAWN] Iniciando respawn do jogador...');

    // 1. Esconde a mensagem de "revivendo"
    const respawnMessageEl = document.getElementById('respawn-message');
    if (respawnMessageEl) respawnMessageEl.style.display = 'none';

    // 2. Define o estado do jogador como vivo e o reposiciona
    player.isAlive = true;
    player.isFrozen = false;
    player.x = TILE_SIZE * 1.5; // Posição inicial
    player.y = TILE_SIZE * 1.5;
    player.dx = 0;
    player.dy = 0;
    
    // !! IMPORTANTE: Note que NÃO estamos resetando player.speed, 
    // player.maxBombs, ou player.explosionRange aqui. Isso preserva seus power-ups.

    // 3. Garante que o loop de jogo esteja rodando
    if (!isLoopRunning) {
        isLoopRunning = true;
        gameLoop();
    }
    
    // 4. Avisa ao servidor que o jogador renasceu
    if (isOnlineGame) {
        socket.emit('playerRespawned', {
            x: player.x,
            y: player.y,
            isAlive: true
        });
    }

    console.log('[RESPAWN] Jogador renasceu com power-ups preservados.');
}

// Evento para atualizar outros jogadores quando alguém renasce
socket.on('playerRespawnedUpdate', (data) => {
    if (otherPlayers[data.id]) {
        otherPlayers[data.id].isAlive = data.isAlive;
        otherPlayers[data.id].x = data.x;
        otherPlayers[data.id].y = data.y;
    }
});

// --- GERENCIAMENTO DE LISTA DE SALAS ---

// Localize a tela do lobby de salas no seu HTML
const roomsListContainer = document.getElementById('rooms-list-container'); // Você precisa criar este div no seu HTML

// Função para atualizar o lobby com a lista de salas recebida
function updateRoomsLobby(rooms) {
    if (!roomsListContainer) return;

    roomsListContainer.innerHTML = ''; // Limpa a lista antiga

    if (rooms.length === 0) {
        roomsListContainer.innerHTML = '<p>Nenhuma sala disponível. Crie uma!</p>';
        return;
    }

    rooms.forEach(room => {
        const roomElement = document.createElement('div');
        roomElement.className = 'room-item';
        
        // Texto com informações da sala
        const roomInfo = document.createElement('span');
        roomInfo.textContent = `${room.name} - Mapa: ${room.map} - Jogadores: ${room.playerCount}/4 - Status: ${room.status}`;
        
        // Botão para entrar na sala
        const joinButton = document.createElement('button');
        joinButton.textContent = 'Entrar';
        joinButton.onclick = () => {
            // Lógica para entrar na sala
            // Esconde a tela de lobby e emite o evento para o servidor
            if (roomsLobbyScreen) roomsLobbyScreen.style.display = 'none';
            const playerNameInput = document.getElementById('player-name-input');
            const playerName = playerNameInput ? playerNameInput.value.trim() || 'Jogador' : 'Jogador';
            socket.emit('joinGame', { roomName: room.name, playerName: playerName });
        };
        
        roomElement.appendChild(roomInfo);
        roomElement.appendChild(joinButton);
        roomsListContainer.appendChild(roomElement);
    });
}

// Ouvinte para o evento que o servidor agora envia
socket.on('roomsListUpdate', (rooms) => {
    console.log('Lista de salas recebida:', rooms);
    updateRoomsLobby(rooms);
});

// Referências para a tela de preparação
const preparingMatchScreen = document.getElementById('preparing-match-screen');
const preparingMatchMessageEl = document.getElementById('preparing-match-message');

// Ouvinte para o evento de preparação da partida
if (typeof socket !== 'undefined') {
    socket.on('preparingMatch', (data) => {
        // Esconde o jogo atual (seja aquecimento ou menu)
        if (typeof isLoopRunning !== 'undefined') isLoopRunning = false;
        if (typeof canvas !== 'undefined' && canvas) canvas.style.display = 'none';
        if (typeof actionButtons !== 'undefined' && actionButtons) actionButtons.style.display = 'none';

        // Mostra a tela de preparação
        if (preparingMatchScreen) preparingMatchScreen.style.display = 'flex';
        
        // Inicia a contagem regressiva na tela
        let countdown = data.countdown;
        if (preparingMatchMessageEl) {
            preparingMatchMessageEl.innerText = `A partida começa em ${countdown}...`;
        }
        
        const countdownInterval = setInterval(() => {
            countdown--;
            if (preparingMatchMessageEl) {
                preparingMatchMessageEl.innerText = `A partida começa em ${countdown}...`;
            }
            if (countdown <= 0) {
                clearInterval(countdownInterval);
                if (preparingMatchMessageEl) {
                    preparingMatchMessageEl.innerText = `Começando!`;
                }
            }
        }, 1000);
    });

    // Modifique o seu 'gameStart' para esconder essa nova tela
    socket.on('gameStart', (data) => {
        // ... seu código existente do gameStart ...
        if (preparingMatchScreen) preparingMatchScreen.style.display = 'none';
        // ... o resto do seu código ...
    });
}

if (typeof socket !== 'undefined') {
    // ... outros listeners ...

    socket.on('revertedToWarmingUp', (data) => {
        console.log("Recebido evento 'revertedToWarmingUp':", data.message);

        // 1. Esconde TODAS as telas de sobreposição (game over, round over, etc.)
        if (gameOverScreen) gameOverScreen.style.display = 'none';
        if (roundOverScreen) roundOverScreen.style.display = 'none';
        
        // 2. Esconde o timer da partida, pois não estamos mais em uma partida oficial
        if (matchTimerEl) matchTimerEl.style.display = 'none';
        if (matchTimerInterval) {
            clearInterval(matchTimerInterval);
            matchTimerInterval = null;
        }

        // 3. Atualiza o estado local do jogo com os dados do servidor
        grid = data.grid;
        otherPlayers = {}; // Limpa outros jogadores
        // O seu próprio jogador já deve estar correto no objeto 'player'

        // 4. Garante que a UI do jogo esteja visível e o loop rodando
        if (canvas) canvas.style.display = 'block';
        if (actionButtons) actionButtons.style.display = 'flex';
        if (!isLoopRunning) {
            isLoopRunning = true;
            gameLoop();
        }
        
        // Opcional: Mostrar uma notificação temporária
        const notificationEl = document.getElementById('respawn-message');
        if (notificationEl) {
            notificationEl.innerText = data.message;
            notificationEl.style.display = 'block';
            setTimeout(() => {
                notificationEl.style.display = 'none';
            }, 4000);
        }
    });
}




