class ShieldItem {
	constructor(x, y) {
		this.x = x;
		this.y = y;
	}

	// Aplica o efeito do item no jogador
	applyEffect(player) {
		player.activateShield(5000); // Ativa o escudo por 5 segundos
	}
}

module.exports = ShieldItem;