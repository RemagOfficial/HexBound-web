export class InputHandler {
  constructor(canvas, board, gameState, renderer) {
    this.canvas = canvas;
    this.board = board;
    this.gameState = gameState;
    this.renderer = renderer;
    this.hoverState = null; // { type: 'hex'|'vertex'|'edge', id: string }

    this.init();
  }

  init() {
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('click', (e) => this.handleClick(e));
  }

  getMousePos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left - this.renderer.offset.x,
      y: e.clientY - rect.top - this.renderer.offset.y
    };
  }

  handleMouseMove(e) {
    const pos = this.getMousePos(e);
    let found = null;

    // Check vertices (highest priority)
    this.board.vertices.forEach(v => {
      const dist = Math.sqrt((pos.x - v.x)**2 + (pos.y - v.y)**2);
      if (dist < 15 && !found) found = { type: 'vertex', id: v.id };
    });

    // Check edges
    if (!found) {
        this.board.edges.forEach(edge => {
            const v1 = this.board.getVertex(edge.v1);
            const v2 = this.board.getVertex(edge.v2);
            const mx = (v1.x + v2.x) / 2;
            const my = (v1.y + v2.y) / 2;
            const dist = Math.sqrt((pos.x - mx)**2 + (pos.y - my)**2);
            if (dist < 10 && !found) found = { type: 'edge', id: edge.id };
        });
    }

    // Check hexes
    if (!found) {
        this.board.hexes.forEach(hex => {
            const pixel = this.board.hexToPixel(hex.q, hex.r);
            const dist = Math.sqrt((pos.x - pixel.x)**2 + (pos.y - pixel.y)**2);
            if (dist < this.board.hexSize * 0.8 && !found) found = { type: 'hex', id: `${hex.q},${hex.r}` };
        });
    }

    this.hoverState = found;
  }

  handleClick(e) {
    if (this.gameState.winner) return;

    // Only human can click to build
    if (this.gameState.currentPlayerIdx !== 0) return;

    if (!this.hoverState) return;

    const player = this.gameState.currentPlayer;

    if (this.hoverState.type === 'vertex') {
        const vKey = this.hoverState.id;
        const vertex = this.board.getVertex(vKey);

        if (vertex.ownerId === null) {
            // Check building settlement
            if (this.gameState.phase === 'INITIAL') {
                // In initial phase, build settlement and wait for road
                player.settlements.push(vKey);
                vertex.ownerId = player.id;
                this.gameState.pendingSettlement = vKey;
                this.gameState.log('Place adjacent road');
            } else if (player.canAfford({ WOOD:1, BRICK:1, SHEEP:1, WHEAT:1 })) {
                const { Rules } = require('../logic/rules.js'); // Assuming we can use it or it's accessible
                // For simplicity, let's assume we use shared logic
                // I will add a method to gameState to handle high-level build logic
                this.emitBuild('SETTLEMENT', vKey);
            }
        } else if (vertex.ownerId === player.id && !vertex.isCity) {
            // Check upgrading city
            this.emitBuild('CITY', vKey);
        }
    } else if (this.hoverState.type === 'edge') {
        const eKey = this.hoverState.id;
        this.emitBuild('ROAD', eKey);
    }
  }

  emitBuild(type, id) {
    // This will be handled by main orchestrator or GameState
    window.dispatchEvent(new CustomEvent('game-action', { detail: { type, id } }));
  }
}
