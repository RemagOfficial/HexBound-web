export class GameState {
  constructor(board, players) {
    this.board = board;
    this.players = players;
    this.currentPlayerIdx = 0;
    this.phase = 'INITIAL';
    this.dice = [1, 1];
    this.history = [];
    this.initialPlacements = 0;
    this.winner = null;
    this.hasRolled = false;
    this.pendingSettlement = null;
    this.log('Phase: Initial Placement. Place 1 Settlement, then 1 adjacent Road.');
  }

  get currentPlayer() { return this.players[this.currentPlayerIdx]; }

  log(msg) {
    this.history.unshift(msg);
    if (this.history.length > 5) this.history.pop();
  }

  nextTurn() {
    this.checkWinner();
    this.currentPlayerIdx = (this.currentPlayerIdx + 1) % 4;
    this.hasRolled = false;
    this.log(`${this.currentPlayer.name}'s turn`);

    if (this.currentPlayerIdx !== 0 && !this.winner) {
      setTimeout(() => {
        this.rollDice();
        setTimeout(() => this.nextTurn(), 1500);
      }, 1000);
    }
  }

  rollDice() {
    this.dice = [Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1];
    const total = this.dice[0] + this.dice[1];
    this.log(`Rolled a ${total}`);
    this.distributeResources(total);
    this.hasRolled = true;
  }

  distributeResources(total) {
    this.board.hexes.forEach(hex => {
      if (hex.number === total) {
        hex.vertices.forEach(vKey => {
          const vertex = this.board.getVertex(vKey);
          if (vertex.ownerId !== null) {
            const player = this.players[vertex.ownerId];
            const amount = vertex.isCity ? 2 : 1;
            player.receive(hex.terrain.name.toUpperCase(), amount);
          }
        });
      }
    });
  }

  build(type, id) {
    const player = this.currentPlayer;
    if (this.phase === 'INITIAL') {
      if (type === 'SETTLEMENT') {
        if (!this.pendingSettlement) {
          const v = this.board.getVertex(id);
          if (v.ownerId === null) {
            v.ownerId = player.id;
            player.settlements.push(id);
            this.pendingSettlement = id;
            this.log('Place adjacent road');
          }
        }
      } else if (type === 'ROAD' && this.pendingSettlement) {
        const edge = this.board.getEdge(id);
        if (edge.ownerId === null && (edge.v1 === this.pendingSettlement || edge.v2 === this.pendingSettlement)) {
          edge.ownerId = player.id;
          player.roads.push(id);
          this.finishInitialPlacement();
        }
      }
      return;
    }

    if (this.phase === 'PLAY' && this.hasRolled) {
      if (type === 'SETTLEMENT') {
        const cost = { WOOD: 1, BRICK: 1, SHEEP: 1, WHEAT: 1 };
        if (player.canAfford(cost)) {
          const vertex = this.board.getVertex(id);
          vertex.ownerId = player.id;
          player.settlements.push(id);
          player.spend(cost);
          this.log('Built Settlement');
        }
      } else if (type === 'ROAD') {
        const cost = { WOOD: 1, BRICK: 1 };
        if (player.canAfford(cost)) {
          const edge = this.board.getEdge(id);
          edge.ownerId = player.id;
          player.roads.push(id);
          player.spend(cost);
          this.log('Built Road');
        }
      } else if (type === 'CITY') {
        const cost = { ORE: 3, WHEAT: 2 };
        if (player.canAfford(cost)) {
          const vertex = this.board.getVertex(id);
          vertex.isCity = true;
          player.cities.push(id);
          player.settlements = player.settlements.filter(s => s !== id);
          player.spend(cost);
          this.log('Built City');
        }
      }
      this.checkWinner();
    }
  }

  finishInitialPlacement() {
    this.pendingSettlement = null;
    this.initialPlacements++;

    const turnOrder = [0, 1, 2, 3, 3, 2, 1, 0];
    if (this.initialPlacements < 8) {
      this.currentPlayerIdx = turnOrder[this.initialPlacements];
      this.log(`${this.currentPlayer.name}'s placement`);
      if (this.currentPlayerIdx !== 0) {
        setTimeout(() => this.dumbAIInitialPlacement(), 1000);
      }
    } else {
      this.phase = 'PLAY';
      this.currentPlayerIdx = 0;
      this.log('Play Phase Started!');
    }
  }

  dumbAIInitialPlacement() {
    const vertices = Array.from(this.board.vertices.keys()).sort(() => Math.random() - 0.5);
    for (const vKey of vertices) {
      const v = this.board.getVertex(vKey);
      if (v.ownerId === null) {
        // Distance rule simplified for AI
        const adj = this.board.getEdgesOfVertex(vKey);
        const near = adj.some(e => {
            const ov = (e.v1 === vKey) ? e.v2 : e.v1;
            return this.board.getVertex(ov).ownerId !== null;
        });
        if (near) continue;

        this.build('SETTLEMENT', vKey);
        this.build('ROAD', adj[0].id);
        break;
      }
    }
  }

  checkWinner() {
    this.players.forEach(p => {
      if (p.calculateVP() >= 10) this.winner = p;
    });
  }
}
