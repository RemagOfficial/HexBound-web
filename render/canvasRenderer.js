export class CanvasRenderer {
  constructor(canvas, board) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.board = board;
    this.offset = { x: canvas.width / 2, y: canvas.height / 2 };
  }

  resize() {
    this.offset = { x: this.canvas.width / 2, y: this.canvas.height / 2 };
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  render(gameState, hoverState = null) {
    this.clear();
    this.drawHexes(hoverState);
    this.drawEdges(gameState, hoverState);
    this.drawVertices(gameState, hoverState);
    this.drawUI(gameState);
  }

  drawHexes(hoverState) {
    this.board.hexes.forEach(hex => {
      const { x, y } = this.board.hexToPixel(hex.q, hex.r);
      const px = x + this.offset.x;
      const py = y + this.offset.y;

      const isHovered = (hoverState?.type === 'hex' && hoverState.id === `${hex.q},${hex.r}`);
      this.drawPolygon(px, py, 6, this.board.hexSize, hex.terrain.color, isHovered);

      // Dice number
      if (hex.number) {
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.beginPath();
        this.ctx.arc(px, py, 15, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.fillStyle = (hex.number === 6 || hex.number === 8) ? '#FF0000' : '#000000';
        this.ctx.font = 'bold 16px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(hex.number.toString(), px, py);
      }
    });
  }

  drawPolygon(x, y, sides, size, color, isHighlighted) {
    this.ctx.fillStyle = color;
    this.ctx.strokeStyle = '#000';
    this.ctx.lineWidth = 2;
    if (isHighlighted) {
      this.ctx.lineWidth = 4;
      this.ctx.strokeStyle = '#FFFF00';
    }

    this.ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const angle = (2 * Math.PI * i) / sides;
      const px = x + size * Math.cos(angle);
      const py = y + size * Math.sin(angle);
      if (i === 0) this.ctx.moveTo(px, py); else this.ctx.lineTo(px, py);
    }
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();
  }

  drawVertices(gameState, hoverState) {
    this.board.vertices.forEach(v => {
      const px = v.x + this.offset.x;
      const py = v.y + this.offset.y;

      const isHovered = (hoverState?.type === 'vertex' && hoverState.id === v.id);
      
      if (v.ownerId !== null) {
        const player = gameState.players[v.ownerId];
        this.ctx.fillStyle = player.color;
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 2;
        if (v.isCity) {
            this.ctx.fillRect(px - 10, py - 10, 20, 20);
            this.ctx.strokeRect(px - 10, py - 10, 20, 20);
        } else {
            this.ctx.beginPath();
            this.ctx.arc(px, py, 8, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
        }
      } else if (isHovered) {
          this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
          this.ctx.beginPath();
          this.ctx.arc(px, py, 8, 0, Math.PI * 2);
          this.ctx.fill();
      }
    });
  }

  drawEdges(gameState, hoverState) {
    this.board.edges.forEach(e => {
        const v1 = this.board.getVertex(e.v1);
        const v2 = this.board.getVertex(e.v2);

        const x1 = v1.x + this.offset.x;
        const y1 = v1.y + this.offset.y;
        const x2 = v2.x + this.offset.x;
        const y2 = v2.y + this.offset.y;

        const isHovered = (hoverState?.type === 'edge' && hoverState.id === e.id);

        if (e.ownerId !== null) {
            const player = gameState.players[e.ownerId];
            this.ctx.strokeStyle = player.color;
            this.ctx.lineWidth = 10;
            this.ctx.beginPath();
            this.ctx.moveTo(x1, y1);
            this.ctx.lineTo(x2, y2);
            this.ctx.stroke();
            // Draw black outline
            this.ctx.strokeStyle = '#000';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
        } else if (isHovered) {
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            this.ctx.lineWidth = 8;
            this.ctx.beginPath();
            this.ctx.moveTo(x1, y1);
            this.ctx.lineTo(x2, y2);
            this.ctx.stroke();
        }
    });
  }

  drawUI(gameState) {
    this.ctx.fillStyle = '#333';
    this.ctx.fillRect(10, 10, 250, 450);
    this.ctx.strokeStyle = '#fff';
    this.ctx.strokeRect(10, 10, 250, 450);

    this.ctx.fillStyle = '#fff';
    this.ctx.font = 'bold 20px Arial';
    this.ctx.fillText('HEXBOUND', 20, 40);

    const player = gameState.currentPlayer;
    const isHuman = gameState.currentPlayerIdx === 0;
    this.ctx.fillStyle = player.color;
    this.ctx.font = '16px Arial';
    this.ctx.fillText(`Turn: ${player.name} (${gameState.phase})`, 25, 75);
    
    this.ctx.fillStyle = '#fff';
    this.ctx.font = '14px Arial';
    let y = 105;
    this.ctx.fillText('RESOURCES:', 25, y);
    Object.entries(player.resources).forEach(([res, val]) => {
        y += 20;
        this.ctx.fillText(`- ${res}: ${val}`, 35, y);
    });

    y += 30;
    this.ctx.fillText('VICTORY POINTS:', 25, y);
    gameState.players.forEach((p, i) => {
        y += 20;
        this.ctx.fillStyle = p.color;
        this.ctx.fillText(`${p.name}: ${p. victoryPoints}`, 35, y);
    });

    // History Log
    y += 40;
    this.ctx.fillStyle = '#fff';
    this.ctx.fillText('HISTORY:', 25, y);
    this.ctx.font = '12px Courier New';
    gameState.history.forEach(log => {
        y += 18;
        this.ctx.fillText(log, 25, y);
    });

    if (gameState.winner) {
        this.ctx.fillStyle = 'rgba(0,0,0,0.8)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = '#FFD700';
        this.ctx.font = 'bold 48px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`${gameState.winner.name} WINS!`, this.canvas.width/2, this.canvas.height/2);
    }
  }
}
