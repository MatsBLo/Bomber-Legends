// Listener para atualizar o painel de estatísticas da sessão
// (Certifique-se de que este código seja executado após a conexão do socket)

if (typeof socket !== 'undefined') {
    socket.on('sessionUpdate', (sessionData) => {
        console.log('Recebida atualização da sessão:', sessionData);

        const statsPanel = document.getElementById('session-stats');
        const totalMatchesEl = document.getElementById('total-matches');
        const playerListEl = document.getElementById('player-list');

        if (!sessionData) {
            if (statsPanel) statsPanel.style.display = 'none';
            return;
        }

        if (statsPanel) statsPanel.style.display = 'block';
        if (totalMatchesEl) totalMatchesEl.textContent = sessionData.totalMatchesInSession;
        if (playerListEl) {
            playerListEl.innerHTML = '';
            for (const playerId in sessionData.players) {
                const player = sessionData.players[playerId];
                const listItem = document.createElement('li');
                listItem.textContent = `${player.username}: Vitórias ${player.wins} / Partidas ${player.matchesPlayed}`;
                // Destaca o próprio jogador
                if (typeof socket !== 'undefined' && playerId === socket.id) {
                    listItem.style.fontWeight = 'bold';
                    listItem.style.color = 'yellow';
                }
                playerListEl.appendChild(listItem);
            }
        }
    });
}
