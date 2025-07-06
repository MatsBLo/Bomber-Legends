// ...existing code...
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- CONSTANTES DO JOGO ---
const TILE_SIZE = 40;
const GRID_COLS = 15;
const GRID_ROWS = 13;
const BOMB_TIMER = 5000;
const TRAP_TIMER = 5000;
const FREEZE_DURATION = 5000;
const CHAIN_REACTION_DELAY = 100;
const FIRE_POWERUP_CHANCE = 0.20;
const TRAP_POWERUP_CHANCE = 0.05;
const BOMB_POWERUP_CHANCE = 0.20;
const SPEED_POWERUP_CHANCE = 0.20;
const SHIELD_POWERUP_CHANCE = 0.05; // Chance do item de escudo (metade do original)
const FLYING_BOMB_POWERUP_CHANCE = 0.05; // Chance da bomba voadora
const SHIELD_DURATION = 5000; // Duração do escudo em ms
const FLYING_BOMB_RANGE = 3; // Distância padrão da bomba voadora
const SERVER_TICK_RATE = 1000 / 30; // 30 updates por segundo
// --- PONTOS DE SPAWN ---
const spawnPoints = [
    { x: TILE_SIZE * 1.5, y: TILE_SIZE * 1.5 }, // Canto Superior Esquerdo
    { x: TILE_SIZE * (GRID_COLS - 1.5), y: TILE_SIZE * (GRID_ROWS - 1.5) }, // Canto Inferior Direito
    { x: TILE_SIZE * (GRID_COLS - 1.5), y: TILE_SIZE * 1.5 }, // Canto Superior Direito
    { x: TILE_SIZE * 1.5, y: TILE_SIZE * (GRID_ROWS - 1.5) }  // Canto Inferior Esquerdo
];

// ---> ADICIONE ESTE NOVO BLOCO ABAIXO <---
const DEFAULT_PLAYER_STATS = {
    width: TILE_SIZE * 0.7,
    height: TILE_SIZE * 0.9,
    speed: 0.9,
    dx: 0,
    dy: 0,
    explosionRange: 2,
    trapCount: 0,
    maxBombs: 2,
    activeBombCount: 0,
    isAlive: true,
    isFrozen: false,
    frozenUntil: 0,
    facingDirection: -1,
    hasShield: false,
    shieldUntil: 0,
    flyingBombs: 0
};
// ------------------------------------------

// --- ESTADO GLOBAL DO SERVIDOR ---
const matchTimerDuration = 90 * 1000; // 1:30 em ms
const CHARACTER_SKINS = [
    'bonecovermelho.png.png',
    'bonecoverde.png.png',
    'bonecoazul.png.png',
    'bonecoamarelo.png.png'
];

// --- FUNÇÕES DE LÓGICA DO JOGO ---
function resetGameState(room) {
    console.log(`[${room.name}] Resetando estado da partida para a próxima rodada.`);
    const freshState = initializeRoomState(room.map);

    // Reseta as propriedades do jogo, mas mantém a estrutura da sala
    room.gameState = freshState.gameState;
    room.grid = freshState.grid;
    room.bombs = freshState.bombs;
    room.activeTraps = freshState.activeTraps;
    room.players = freshState.players; // Limpa os jogadores para a próxima partida
    room.availableSkins = freshState.availableSkins;

    // Limpa timers específicos da sala
    if (room.gameOverTimeout) clearTimeout(room.gameOverTimeout);
    if (room.matchTimer) clearTimeout(room.matchTimer);

    room.gameOverTimeout = null;
    room.matchTimer = null;
    room.matchTimerStart = null;
}

/**
 * Cria e retorna um objeto de estado inicial para uma nova partida/sala.
 * @param {string} mapPreference - O ID do mapa para gerar o grid.
 * @returns {object} O objeto de estado inicial da sala.
 */
function initializeRoomState(mapPreference) {
    return {
        gameState: 'waiting',
        grid: createGrid(mapPreference),
        bombs: [],
        activeTraps: [],
        players: {},
        matchTimer: null,
        matchTimerStart: null,
        availableSkins: [...CHARACTER_SKINS],
        gameOverTimeout: null
    };
}

// Envia o tempo restante para todos os jogadores conectados
function emitMatchTimerToAll(room) {
    if (room.matchTimerStart && room.gameState === 'playing') {
        const now = Date.now();
        const timeLeft = Math.max(0, Math.ceil((room.matchTimerStart + matchTimerDuration - now) / 1000));
        console.log(`[${room.name}] Enviando timer: ${timeLeft}s para ${Object.keys(room.players).length} jogadores`);
        io.to(room.name).emit('matchTimer', { timeLeft });
    } else {
        // Se a partida não está rolando, envia 0 para parar o timer do cliente
        console.log(`[${room.name}] Parando timer - partida não está rolando`);
        io.to(room.name).emit('matchTimer', { timeLeft: 0 });
    }
}

// =========================================================================
// == SUBSTITUA A SUA FUNÇÃO createGrid INTEIRA POR ESTA VERSÃO CORRIGIDA ===
// =========================================================================
function createGrid(mapId) {
    let newGrid = [];
    let mapChoice = mapId;
    if (mapChoice === 'random') {
        const maps = ['map1', 'map2', 'map3'];
        mapChoice = maps[Math.floor(Math.random() * maps.length)];
    }

    // Passo 1: Cria uma grade totalmente vazia (valor 0)
    for (let r = 0; r < GRID_ROWS; r++) {
        newGrid[r] = [];
        for (let c = 0; c < GRID_COLS; c++) {
            newGrid[r][c] = 0;
        }
    }

    // Passo 2: Adiciona os blocos INDESTRUTÍVEIS específicos de cada mapa
    if (mapChoice === 'map1') {
        for (let r = 1; r < GRID_ROWS - 1; r++) {
            for (let c = 1; c < GRID_COLS - 1; c++) {
                if (r % 2 === 0 && c % 2 === 0) newGrid[r][c] = 1;
            }
        }
    } else if (mapChoice === 'map2') {
        const mapBlueprint = [ {r:2, c:2}, {r:2, c:3}, {r:2, c:6}, {r:2, c:8}, {r:2, c:11}, {r:2, c:12}, {r:4, c:4}, {r:4, c:5}, {r:4, c:9}, {r:4, c:10}, {r:5, c:2}, {r:5, c:6}, {r:5, c:8}, {r:5, c:12}, {r:6, c:2}, {r:6, c:6}, {r:6, c:8}, {r:6, c:12}, {r:7, c:4}, {r:7, c:5}, {r:7, c:9}, {r:7, c:10}, {r:9, c:2}, {r:9, c:3}, {r:9, c:6}, {r:9, c:8}, {r:9, c:11}, {r:9, c:12} ];
        mapBlueprint.forEach(pos => { if (newGrid[pos.r]) newGrid[pos.r][pos.c] = 1; });
    } else if (mapChoice === 'map3') {
        const mapBlueprint = [ {r:2,c:3}, {r:3,c:3}, {r:4,c:3}, {r:5,c:3}, {r:6,c:3}, {r:7,c:3}, {r:8,c:3}, {r:9,c:3}, {r:10, c:3}, {r:2,c:7}, {r:3,c:7}, {r:4,c:7}, {r:6,c:7}, {r:7,c:7}, {r:8,c:7}, {r:9,c:7}, {r:10, c:7}, {r:2,c:11}, {r:3,c:11}, {r:4,c:11}, {r:5,c:11}, {r:6,c:11}, {r:7,c:11}, {r:8,c:11}, {r:9,c:11}, {r:10, c:11}, {r:3,c:5}, {r:3,c:9}, {r:9,c:5}, {r:9,c:9} ];
        mapBlueprint.forEach(pos => { if (newGrid[pos.r]) newGrid[pos.r][pos.c] = 1; });
    }

    // Passo 3: Preenche o resto do espaço VAZIO (0) com blocos DESTRUTÍVEIS (2)
    for (let r = 1; r < GRID_ROWS - 1; r++) {
        for (let c = 1; c < GRID_COLS - 1; c++) {
            if (newGrid[r][c] === 0) { // Só preenche se o espaço estiver vazio
                newGrid[r][c] = Math.random() < 0.75 ? 2 : 0;
            }
        }
    }

    // Passo 4: Limpa a área de spawn dos jogadores (sempre por último)
    const spawnAreasToClear = [ {r: 1, c: 1}, {r: 1, c: 2}, {r: 2, c: 1}, {r: GRID_ROWS - 2, c: GRID_COLS - 2}, {r: GRID_ROWS - 2, c: GRID_COLS - 3}, {r: GRID_ROWS - 3, c: GRID_COLS - 2}, {r: 1, c: GRID_COLS - 2}, {r: 1, c: GRID_COLS - 3}, {r: 2, c: GRID_COLS - 2}, {r: GRID_ROWS - 2, c: 1}, {r: GRID_ROWS - 2, c: 2}, {r: GRID_ROWS - 3, c: 1} ];
    spawnAreasToClear.forEach(pos => { if (newGrid[pos.r]) newGrid[pos.r][pos.c] = 0; });

    // Passo 5: Cria a borda EXTERNA (sempre por último, para sobrepor tudo)
    for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
            if (r === 0 || r === GRID_ROWS - 1 || c === 0 || c === GRID_COLS - 1) {
                newGrid[r][c] = 1;
            }
        }
    }

    return newGrid;
}

function createPlayer(id, room) {
    if (!room || !room.availableSkins) {
        throw new Error('Room or availableSkins is not defined for new player');
    }

    if (room.availableSkins.length === 0) {
        // Se acabaram as skins, recicla a lista
        room.availableSkins = [...CHARACTER_SKINS];
    }
    
    const playerIndex = Object.keys(room.players).length;
    const pos = spawnPoints[playerIndex % spawnPoints.length];

    const skinIdx = Math.floor(Math.random() * room.availableSkins.length);
    const skin = room.availableSkins.splice(skinIdx, 1)[0];

    return {
        id: id,
        ...pos,
        ...DEFAULT_PLAYER_STATS, // <-- Usa a constante com todos os status padrão
        skin: skin
    };
}

// =========================================================================
// == SUBSTITUA SUA FUNÇÃO checkWinCondition POR ESTA ======================
// =========================================================================
function checkWinCondition(room) {
    if (room.gameState !== 'playing') return;

    const alivePlayers = Object.values(room.players).filter(p => p.isAlive);
    
    if (alivePlayers.length <= 1) {
        room.gameState = 'finished';
        if (room.matchTimer) clearTimeout(room.matchTimer);
        if (room.gameOverTimeout) clearTimeout(room.gameOverTimeout);

        let winnerId = alivePlayers.length === 1 ? alivePlayers[0].id : null;

        // --- ATUALIZAÇÃO DE ESTATÍSTICAS ---
        if (room.sessionStats) {
            if (winnerId && room.sessionStats.players[winnerId]) {
                room.sessionStats.players[winnerId].wins++;
            }
            // A contagem de partida jogada agora vai para startNewRound
        }

        Object.keys(room.players).forEach(playerId => {
            let message = (playerId === winnerId) ? "Você Venceu a Rodada!" : (winnerId === null) ? "Empate!" : "Você Perdeu a Rodada.";
            io.to(playerId).emit('roundOver', { message: message });
        });

        setTimeout(() => {
            if (rooms[room.name] && Object.keys(room.players).length >= 2) {
                startNewRound(room);
            }
        }, 5000);
    } else {
        // Ainda há 2 ou mais jogadores vivos - os mortos viram espectadores
        const deadPlayers = Object.values(room.players).filter(p => !p.isAlive);
        
        deadPlayers.forEach(deadPlayer => {
            // Marca o jogador morto como espectador
            room.players[deadPlayer.id].isSpectator = true;
            
            // Envia o estado atual do jogo para o jogador morto como espectador
            io.to(deadPlayer.id).emit('spectatorMode', {
                grid: room.grid,
                players: room.players,
                gameState: room.gameState,
                matchTimeLeft: room.matchTimerStart ? Math.max(0, Math.ceil((room.matchTimerStart + matchTimerDuration - Date.now()) / 1000)) : 0
            });
            
            console.log(`[${room.name}] Jogador ${deadPlayer.username || deadPlayer.id} morto virou espectador.`);
        });
    }
}

// ---> CRIE ESTA NOVA FUNÇÃO AUXILIAR no seu `index.js` <---
function startNewRound(room) {
    console.log(`[${room.name}] Iniciando nova rodada.`);
    
    // Limpa qualquer timer da rodada anterior para evitar execuções duplicadas
    if (room.gameOverTimeout) {
        clearTimeout(room.gameOverTimeout);
        room.gameOverTimeout = null;
    }

    // 1. Reseta o mapa e as entidades do jogo (bombas, armadilhas)
    room.grid = createGrid(room.map);
    room.bombs = [];
    room.activeTraps = [];

    // --- ATUALIZAÇÃO DE ESTATÍSTICAS DA SESSÃO ---
    if (room.sessionStats) {
        room.sessionStats.totalMatchesInSession++;
        Object.keys(room.players).forEach(playerId => {
            if (room.sessionStats.players[playerId]) {
                room.sessionStats.players[playerId].matchesPlayed++;
            }
        });
        io.to(room.name).emit('sessionUpdate', room.sessionStats);
    }

    // 2. Reseta o estado de CADA jogador para os valores padrão de forma limpa
    // E converte espectadores em jogadores ativos
    Object.values(room.players).forEach((player, index) => {
        const spawnPoint = spawnPoints[index % spawnPoints.length];
        const originalId = player.id;
        const originalSkin = player.skin;
        const originalUsername = player.username;
        
        // --- LOG DE DIAGNÓSTICO #1: O ESTADO ANTES DO RESET ---
        console.log(`[DEBUG] ANTES do reset para ${player.username || player.id}: Speed=${player.speed}, Bombs=${player.maxBombs}, ExplosionRange=${player.explosionRange}, isSpectator=${player.isSpectator}`);
        
        // ---- AQUI ESTÁ A CORREÇÃO PRINCIPAL E DEFINITIVA ----
        // Recria o objeto do jogador do zero, usando a constante de status padrão.
        // NÃO chama mais createPlayer(), evitando os efeitos colaterais com a lista de skins.
        room.players[originalId] = {
            id: originalId,
            skin: originalSkin,
            username: originalUsername,
            ...spawnPoint,           // Pega as novas coordenadas x e y
            ...DEFAULT_PLAYER_STATS, // Pega TODOS os status padrão (velocidade, bombas, etc.)
            isSpectator: false       // Converte espectadores em jogadores ativos
        };
        
        // --- LOG DE DIAGNÓSTICO #2: O ESTADO IMEDIATAMENTE APÓS O RESET ---
        console.log(`[DEBUG] DEPOIS do reset para ${room.players[originalId].username || room.players[originalId].id}: Speed=${room.players[originalId].speed}, Bombs=${room.players[originalId].maxBombs}, ExplosionRange=${room.players[originalId].explosionRange}, isSpectator=${room.players[originalId].isSpectator}`);
    });

    // 3. Reinicia o estado e o timer da partida
    room.gameState = 'playing';
    room.matchTimerStart = Date.now();
    
    // 4. Envia o evento de início da rodada para os clientes
    // --- LOG DE DIAGNÓSTICO #3: O ESTADO FINAL ANTES DE ENVIAR PARA OS CLIENTES ---
    console.log('[DEBUG] Dados FINAIS sendo enviados no gameStart:', JSON.stringify(room.players, null, 2));
    
    io.to(room.name).emit('gameStart', {
        grid: room.grid,
        players: room.players,
        gameState: room.gameState
    });
    
    emitMatchTimerToAll(room);

    // 5. Agenda o fim da partida por tempo (para o caso de empate)
    room.gameOverTimeout = setTimeout(() => {
        if (room.gameState === 'playing') {
            console.log(`[${room.name}] Tempo da partida esgotado. Declarando empate.`);
            room.gameState = 'finished';
            // Atualiza estatísticas no empate também
            if(room.sessionStats) {
                io.to(room.name).emit('sessionUpdate', room.sessionStats);
            }
            io.to(room.name).emit('roundOver', { message: "Tempo Esgotado! Empate!" });
            setTimeout(() => {
                if (rooms[room.name] && Object.keys(room.players).length >= 2) {
                    startNewRound(room);
                }
            }, 5000);
        }
    }, matchTimerDuration);
}

function explode(bomb, room, chainDelay = 0) {
    const owner = room.players[bomb.ownerId];
    if (owner) {
        owner.activeBombCount = Math.max(0, owner.activeBombCount - 1);
        io.to(room.name).emit('playerStatsUpdate', { id: owner.id, stats: owner });
    }
    io.to(room.name).emit('bombExploded', { row: bomb.row, col: bomb.col });
    setTimeout(() => {
        if (room.grid[bomb.row] && room.grid[bomb.row][bomb.col] === 3) {
            room.grid[bomb.row][bomb.col] = 0;
            io.to(room.name).emit('gridUpdate', { row: bomb.row, col: bomb.col, newValue: 0 });
        }
        const explosionArea = [{ col: bomb.col, row: bomb.row }];
        const directions = [[0, -1], [0, 1], [-1, 0], [1, 0]];
        directions.forEach(dir => {
            for (let i = 1; i <= bomb.range; i++) {
                const row = bomb.row + dir[1] * i; const col = bomb.col + dir[0] * i;
                if (!room.grid[row] || room.grid[row][col] === 1) break;
                explosionArea.push({ col, row });
                if (room.grid[row][col] === 3) {
                    const nextBombIndex = room.bombs.findIndex(b => b.row === row && b.col === col);
                    if (nextBombIndex > -1) {
                        const nextBomb = room.bombs.splice(nextBombIndex, 1)[0];
                        explode(nextBomb, room, chainDelay + CHAIN_REACTION_DELAY);
                    }
                }
                if (room.grid[row][col] >= 4) {
                    room.grid[row][col] = 0; io.to(room.name).emit('gridUpdate', { row, col, newValue: 0 }); break;
                }
                if (room.grid[row][col] === 2) {
                    room.grid[row][col] = 0; const dropRNG = Math.random(); let c = 0;
                    if (dropRNG < (c += FIRE_POWERUP_CHANCE)) room.grid[row][col] = 4;
                    else if (dropRNG < (c += BOMB_POWERUP_CHANCE)) room.grid[row][col] = 6;
                    else if (dropRNG < (c += SPEED_POWERUP_CHANCE)) room.grid[row][col] = 7;
                    else if (dropRNG < (c += TRAP_POWERUP_CHANCE)) room.grid[row][col] = 5;
                    else if (dropRNG < (c += SHIELD_POWERUP_CHANCE)) room.grid[row][col] = 8;
                    else if (dropRNG < (c += FLYING_BOMB_POWERUP_CHANCE)) room.grid[row][col] = 9;
                    io.to(room.name).emit('gridUpdate', { row, col, newValue: room.grid[row][col] }); break;
                }
            }
        });
        io.to(room.name).emit('explosion', { explosions: explosionArea });
        let anyPlayerDied = false;
        explosionArea.forEach(exp => {
            for (const id in room.players) {
                const p = room.players[id];
                if (p.isAlive) {
                    const pCol = Math.floor(p.x / TILE_SIZE);
                    const pRow = Math.floor((p.y + p.height / 4) / TILE_SIZE);
                    if (pCol === exp.col && pRow === exp.row) {
                        if (p.hasShield && Date.now() < p.shieldUntil) {
                            p.hasShield = false;
                            p.shieldUntil = 0;
                            io.to(room.name).emit('playerStatsUpdate', { id: p.id, stats: p });
                            io.to(room.name).emit('shieldBroken', { id: p.id });
                        } else {
                            p.isAlive = false;
                            anyPlayerDied = true;
                            io.to(room.name).emit('playerDied', { id: p.id });
                        }
                    }
                }
            }
        });
        if (anyPlayerDied) checkWinCondition(room);
    }, chainDelay);
}

function triggerTrap(trap, room) {
    io.to(room.name).emit('trapRemoved', { row: trap.row, col: trap.col });
    const aoeArea = [];
    for (let r = trap.row - 2; r <= trap.row + 2; r++) {
        for (let c = trap.col - 2; c <= trap.col + 2; c++) {
            if (r >= 0 && r < GRID_ROWS && c >= 0 && c < GRID_COLS) {
                aoeArea.push({ col: c, row: r });
            }
        }
    }
    io.to(room.name).emit('trapTriggered', { aoeArea });

    aoeArea.forEach(aoeTile => {
        for (const id in room.players) {
            const p = room.players[id];
            if (p.isAlive && !p.isFrozen) {
                const pCol = Math.floor(p.x / TILE_SIZE); const pRow = Math.floor((p.y + p.height / 4) / TILE_SIZE);
                if (pCol === aoeTile.col && pRow === aoeTile.row) {
                    p.isFrozen = true;
                    p.frozenUntil = Date.now() + FREEZE_DURATION;
                    io.to(room.name).emit('playerStatsUpdate', { id: p.id, stats: p });
                    setTimeout(() => {
                        if (room.players[p.id]) {
                            room.players[p.id].isFrozen = false;
                            io.to(room.name).emit('playerStatsUpdate', { id: p.id, stats: room.players[p.id] });
                        }
                    }, FREEZE_DURATION);
                }
            }
        }
    });
}

/**
 * Executa um "tick" de lógica de jogo para uma sala específica.
 * Verifica bombas e armadilhas expiradas.
 * @param {object} room - O objeto da sala a ser atualizado.
 */
function updateRoomState(room) {
    // O loop agora roda se a sala estiver em aquecimento OU jogando oficialmente.
    if (room.gameState !== 'playing' && room.gameState !== 'warming_up') {
        return; // Se a sala está 'finished' ou 'waiting', não faz nada.
    }

    const now = Date.now();

    // Loop de verificação de bombas
    for (let i = room.bombs.length - 1; i >= 0; i--) {
        const bomb = room.bombs[i];
        if (now - bomb.placeTime >= BOMB_TIMER) {
            const [explodedBomb] = room.bombs.splice(i, 1);
            explode(explodedBomb, room);
        }
    }

    // Loop de verificação de armadilhas
    for (let i = room.activeTraps.length - 1; i >= 0; i--) {
        const trap = room.activeTraps[i];
        if (now - trap.placeTime >= TRAP_TIMER) {
            const [triggeredTrap] = room.activeTraps.splice(i, 1);
            triggerTrap(triggeredTrap, room);
        }
    }
    // Removido o envio do timer daqui!
}

// Cada sala agora tem seu próprio game loop individual
// O game loop global foi removido para evitar conflitos


app.use(express.static(path.join(__dirname, '')));
app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'index.html')); });

// ========================================================================
// == SUBSTITUA TODO O SEU BLOCO io.on PELO CÓDIGO ABAIXO ==================
// ========================================================================
// --- GERENCIAMENTO DE SALAS ---
const rooms = {};
let globalSessionStats = null; // Renomeado para maior clareza

// Função auxiliar para obter uma lista pública e limpa das salas
function getPublicRoomsList() {
    return Object.values(rooms).map(room => ({
        name: room.name,
        map: room.map,
        playerCount: room.playersSockets.length,
        status: room.gameState
    }));
}

function handlePlayerExit(socket) {
    const socketId = socket.id;
    const roomName = socket.data?.roomName;

    if (!roomName || !rooms[roomName]) return;
    
    const room = rooms[roomName];
    console.log(`[${room.name}] Jogador ${socketId} saiu. Processando saída...`);

    // Lógica para remover o jogador da partida e da lista de sockets
    const playerWhoLeft = room.players[socketId];
    if (playerWhoLeft && playerWhoLeft.skin) {
        room.availableSkins.push(playerWhoLeft.skin);
    }
    delete room.players[socketId];
    room.playersSockets = room.playersSockets.filter(id => id !== socketId);
    io.to(room.name).emit('playerDisconnected', { id: socketId });

    // --- PONTO CRÍTICO DA LÓGICA ---
    const remainingPlayersCount = Object.keys(room.players).length;

    // Cenário 1: A sala ficou vazia.
    if (remainingPlayersCount === 0) {
        console.log(`[${room.name}] Sala está vazia e será deletada.`);
        if(room.gameLoopInterval) clearInterval(room.gameLoopInterval);
        if (room.timerInterval) clearInterval(room.timerInterval); // Limpa o intervalo do timer
        delete rooms[roomName];
    } 
    // Cenário 2: A sala agora só tem 1 jogador (regredir para aquecimento).
    else if (remainingPlayersCount === 1 && (room.gameState === 'playing' || room.gameState === 'finished')) {
        console.log(`[${room.name}] Apenas um jogador restou. Revertendo para o modo de aquecimento.`);
        
        // ---- AQUI ESTÁ A LÓGICA DE LIMPEZA DA SESSÃO ----
        if(room.sessionStats) {
            delete room.sessionStats;
            console.log(`[${room.name}] Sessão de estatísticas terminada.`);
            // Notifica o cliente para esconder o painel
            io.to(room.name).emit('sessionUpdate', null); 
        }
        // ----------------------------------------------------

        room.gameState = 'warming_up';
        
        // Para o timer da partida, se ele estiver rodando
        if (room.matchTimer) clearTimeout(room.matchTimer);
        
        // Envia um evento especial para o cliente restante, informando a mudança de estado
        const remainingPlayerId = Object.keys(room.players)[0];
        io.to(remainingPlayerId).emit('revertedToWarmingUp', {
            message: "Oponente desconectou. Modo de treino reativado.",
            players: room.players,
            grid: room.grid // Envia o estado atual do mapa
        });
    } 
    // Cenário 3: Ainda há 2 ou mais jogadores (a partida continua).
    else if (remainingPlayersCount >= 2 && room.gameState === 'playing') {
        console.log(`[${room.name}] Jogador saiu, mas a partida continua.`);
        checkWinCondition(room); // Agora sim, podemos checar se a saída resultou em um vencedor
    }

    // Atualiza a lista de salas para todos no lobby
    io.emit('roomsListUpdate', getPublicRoomsList());
}

io.on('connection', (socket) => {
    console.log(`Jogador conectado: ${socket.id}`);
    
    // --> CORREÇÃO IMPORTANTE AQUI <--
    // Assim que um jogador se conecta, envie a ele a lista atual de salas.
    socket.emit('roomsListUpdate', getPublicRoomsList());

    socket.on('createRoom', ({ roomName, map }) => {
        if (!roomName || rooms[roomName]) {
            socket.emit('roomError', { message: 'Nome de sala inválido ou já existe.' });
            return;
        }

        const newRoom = {
            name: roomName,
            map,
            playersSockets: [], // Inicia vazio, o jogador entra com 'joinGame'
            ...initializeRoomState(map) // Inicializa grid, bombas, etc.
        };
        
        // Adiciona um game loop específico para esta sala
        newRoom.gameLoopInterval = setInterval(() => updateRoomState(newRoom), SERVER_TICK_RATE);
        newRoom.timerInterval = setInterval(() => {
            if (newRoom.gameState === 'playing') {
                emitMatchTimerToAll(newRoom);
            }
        }, 1000);

        rooms[roomName] = newRoom;
        
        console.log(`Sala criada: ${roomName} (mapa: ${map}) por ${socket.id}`);
        socket.emit('roomCreated', { roomName, map }); // Avisa que foi criada
        
        // --> CORREÇÃO IMPORTANTE AQUI <--
        // Após criar uma sala, avise a TODOS sobre a nova lista.
        io.emit('roomsListUpdate', getPublicRoomsList());
    });

    socket.on('joinGame', (data) => {
        const roomName = data.roomName;
        const room = rooms[roomName];
        if (!room) {
            socket.emit('roomError', { message: 'A sala não existe mais.' });
            return;
        }

        const playerName = data.playerName || `Jogador ${socket.id.substring(0, 5)}`;
        socket.join(roomName);
        socket.data.roomName = roomName;
        room.playersSockets.push(socket.id);

        // Cria o objeto do jogador
        room.players[socket.id] = createPlayer(socket.id, room);
        room.players[socket.id].username = playerName; // Atribui o nome
        
        const numPlayers = Object.keys(room.players).length;

        if (numPlayers === 1) {
            // PRIMEIRO JOGADOR: Modo de aquecimento, como antes.
            room.gameState = 'warming_up';
            console.log(`[${room.name}] Jogador ${playerName} (${socket.id}) entrou. Modo de aquecimento iniciado.`);
            // Envia o estado inicial apenas para este jogador
            socket.emit('gameStart', { grid: room.grid, players: room.players, gameState: room.gameState });
        
        } else if (numPlayers >= 2 && room.gameState === 'warming_up') {
            // SEGUNDO JOGADOR ENTROU: Inicia a transição para a partida oficial.
            console.log(`[${room.name}] Segundo jogador ${playerName} (${socket.id}) entrou. Preparando partida oficial.`);
            
            // ---- CRIAÇÃO DA SESSÃO DE ESTATÍSTICAS ----
            console.log(`[${room.name}] Criando nova sessão de estatísticas.`);
            room.sessionStats = {
                totalMatchesInSession: 0,
                players: {}
            };
            Object.values(room.players).forEach(player => {
                room.sessionStats.players[player.id] = {
                    username: player.username,
                    wins: 0,
                    matchesPlayed: 0
                };
            });
            
            // 1. Avisa a todos os clientes para mostrarem a tela de "preparando"
            io.to(room.name).emit('preparingMatch', { countdown: 3 });

            // 2. Após a contagem, inicia a partida de verdade
            setTimeout(() => {
                // Verifica se a sala ainda é válida antes de iniciar
                if (!rooms[room.name] || Object.keys(rooms[room.name].players).length < 2) {
                    console.log(`[${room.name}] Jogadores saíram durante a preparação. Partida cancelada.`);
                    if(room.sessionStats) delete room.sessionStats;
                    return;
                }

                // ---- AQUI ESTÁ A MUDANÇA-CHAVE E A SOLUÇÃO DEFINITIVA ----
                // Em vez de repetir a lógica, simplesmente chamamos a função
                // centralizada que já faz tudo corretamente.
                startNewRound(room);

            }, 3000); // 3000ms = 3 segundos de contagem
        } else if (room.gameState === 'playing') {
            // JOGADOR ENTROU DURANTE UMA PARTIDA EM ANDAMENTO: Modo espectador
            console.log(`[${room.name}] Jogador ${playerName} (${socket.id}) entrou durante partida em andamento. Colocando como espectador.`);
            
            // Marca o jogador como espectador
            room.players[socket.id].isSpectator = true;
            room.players[socket.id].isAlive = false; // Espectadores não podem jogar
            
            // Adiciona às estatísticas da sessão se existir
            if (room.sessionStats && !room.sessionStats.players[socket.id]) {
                room.sessionStats.players[socket.id] = {
                    username: playerName,
                    wins: 0,
                    matchesPlayed: 0
                };
                io.to(room.name).emit('sessionUpdate', room.sessionStats);
            }
            
            // Envia o estado atual do jogo para o espectador
            socket.emit('spectatorMode', {
                grid: room.grid,
                players: room.players,
                gameState: room.gameState,
                matchTimeLeft: room.matchTimerStart ? Math.max(0, Math.ceil((room.matchTimerStart + matchTimerDuration - Date.now()) / 1000)) : 0
            });
            
            // Notifica outros jogadores sobre o novo espectador
            socket.to(room.name).emit('spectatorJoined', { 
                id: socket.id, 
                username: playerName,
                skin: room.players[socket.id].skin 
            });
        }
    });
    
    // --- LÓGICA DE RESPAWN PARA O MODO DE AQUECIMENTO ---
    socket.on('playerRespawned', (data) => {
        const room = rooms[socket.data.roomName];
        if (!room || room.gameState !== 'warming_up') return;
        
        const player = room.players[socket.id];
        if (player) {
            player.isAlive = data.isAlive;
            player.x = data.x;
            player.y = data.y;
            // Não precisa notificar outros, pois não há outros jogadores
            console.log(`[${room.name}] Jogador ${socket.id} renasceu no modo de aquecimento.`);
        }
    });

    // --- AÇÕES DENTRO DO JOGO ---
    socket.on('playerUpdate', (data) => {
        const room = rooms[socket.data.roomName];
        const player = room?.players[socket.id];
        if (player) {
            Object.assign(player, data);
            socket.to(room.name).emit('playerMoved', { id: socket.id, ...data });
        }
    });
    
    socket.on('placeBomb', (data) => {
        const room = rooms[socket.data.roomName];
        const p = room?.players[socket.id];
        if (!p || p.activeBombCount >= p.maxBombs || !p.isAlive || (room.grid[data.row] && room.grid[data.row][data.col] !== 0)) return;
        
        p.activeBombCount++;
        const bomb = { ownerId: socket.id, ...data, range: p.explosionRange, placeTime: Date.now(), isSolid: false };
        room.bombs.push(bomb);
        room.grid[data.row][data.col] = 3;
        
        io.to(room.name).emit('bombPlaced', bomb);
        io.to(room.name).emit('playerStatsUpdate', { id: socket.id, stats: { activeBombCount: p.activeBombCount } });
    });

    socket.on('placeTrap', (data) => {
        const room = rooms[socket.data.roomName];
        if (!room || (room.gameState !== 'playing' && room.gameState !== 'warming_up')) return;
        const p = room.players[socket.id];
        if (!p || p.trapCount <= 0 || !p.isAlive || (room.grid[data.row] && room.grid[data.row][data.col] !== 0)) return;
        p.trapCount--;
        const trap = { ownerId: socket.id, ...data, placeTime: Date.now() };
        room.activeTraps.push(trap);
        io.to(room.name).emit('trapPlaced', trap);
        io.to(room.name).emit('playerStatsUpdate', { id: socket.id, stats: { trapCount: p.trapCount } });
    });

    socket.on('collectItem', (data) => {
        const room = rooms[socket.data.roomName];
        if (!room || (room.gameState !== 'playing' && room.gameState !== 'warming_up')) return;
        const p = room.players[socket.id];
        if (!p || !p.isAlive) return;
        const itemType = room.grid[data.row] ? room.grid[data.row][data.col] : 0;
        if (itemType < 4) return;
        
        room.grid[data.row][data.col] = 0;
        io.to(room.name).emit('gridUpdate', { row: data.row, col: data.col, newValue: 0 });
        const updatedStats = {};
        if (itemType === 4) { p.explosionRange++; updatedStats.explosionRange = p.explosionRange; }
        else if (itemType === 5) { p.trapCount++; updatedStats.trapCount = p.trapCount; }
        else if (itemType === 6) { p.maxBombs++; updatedStats.maxBombs = p.maxBombs; }
        else if (itemType === 7) { p.speed += 0.1; updatedStats.speed = p.speed; }
        else if (itemType === 8) {
            p.hasShield = true;
            p.shieldUntil = Date.now() + SHIELD_DURATION;
            updatedStats.hasShield = p.hasShield;
            updatedStats.shieldUntil = p.shieldUntil;
        }
        else if (itemType === 9) { p.flyingBombs = (p.flyingBombs || 0) + 1; updatedStats.flyingBombs = p.flyingBombs; }
        io.to(room.name).emit('playerStatsUpdate', { id: socket.id, stats: updatedStats });
    });

    socket.on('bombNowSolid', (data) => {
        const room = rooms[socket.data.roomName];
        if (!room) return;
        const bomb = room.bombs.find(b => b.row === data.row && b.col === data.col);
        if (bomb) bomb.isSolid = true;
    });

    socket.on('useFlyingBomb', (data) => {
        const room = rooms[socket.data.roomName];
        if (!room || room.gameState !== 'playing') return;

        const p = room.players[socket.id];
        if (!p || !p.isAlive || !p.flyingBombs || p.flyingBombs <= 0) return;

        const dir = typeof data.dir === 'number' ? data.dir : 1;
        let dx = 0, dy = 0;
        if (dir === 0) dx = -1; else if (dir === 1) dx = 1; else if (dir === 2) dy = -1; else if (dir === 3) dy = 1;
        
        let px = Math.floor(p.x / TILE_SIZE);
        let py = Math.floor((p.y + p.height / 4) / TILE_SIZE);
        let found = false, target = null;

        for (let dist = FLYING_BOMB_RANGE; dist >= 1; dist--) {
            let tx = px + dx * dist; let ty = py + dy * dist;
            if (room.grid[ty] && room.grid[ty][tx] === 0) {
                target = { row: ty, col: tx }; found = true; break;
            }
        }
        if (!found) {
            for (let dist = FLYING_BOMB_RANGE + 1; dist < Math.max(GRID_ROWS, GRID_COLS); dist++) {
                let tx = px + dx * dist; let ty = py + dy * dist;
                if (room.grid[ty] && room.grid[ty][tx] === 0) { target = { row: ty, col: tx }; found = true; break; }
            }
        }
        if (found && target) {
            p.flyingBombs--;
            const bomb = { ownerId: socket.id, row: target.row, col: target.col, range: p.explosionRange, placeTime: Date.now(), isSolid: false };
            room.bombs.push(bomb);
            room.grid[target.row][target.col] = 3;
            io.to(room.name).emit('bombPlaced', bomb);
            io.to(room.name).emit('playerStatsUpdate', { id: socket.id, stats: { flyingBombs: p.flyingBombs } });
        }
    });

    socket.on('leaveGame', () => {
        handlePlayerExit(socket);
    });

    socket.on('disconnect', () => {
        handlePlayerExit(socket);
    });
});
// ==================================================================
// == ATÉ AQUI ======================================================
// ==================================================================
const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => { console.log(`Servidor Multiplayer rodando na porta ${PORT}`); });
