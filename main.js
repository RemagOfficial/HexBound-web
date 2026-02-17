/**
 * HexBound - Monolithic Game Script
 * Merged to support file:// protocol (no CORS issues)
 */

// --- CONSTANTS ---
const HEX_TYPES = {
  WOOD: { name: 'Wood', color: '#228B22' },
  BRICK: { name: 'Brick', color: '#B22222' },
  SHEEP: { name: 'Sheep', color: '#90EE90' },
  WHEAT: { name: 'Wheat', color: '#FFD700' },
  ORE: { name: 'Ore', color: '#708090' },
  DESERT: { name: 'Desert', color: '#F4A460' }
};

const COSTS = {
  ROAD: { WOOD: 1, BRICK: 1 },
  SETTLEMENT: { WOOD: 1, BRICK: 1, SHEEP: 1, WHEAT: 1 },
  CITY: { ORE: 3, WHEAT: 2 }
};

// --- LOGIC: BOARD ---
class Vertex {
  constructor(id, x, y) {
    this.id = id; this.x = x; this.y = y;
    this.ownerId = null; this.isCity = false; this.hexes = [];
  }
}

class Edge {
  constructor(id, v1, v2) {
    this.id = id; this.v1 = v1; this.v2 = v2; this.ownerId = null;
  }
}

class Board {
  constructor(radius = 2) {
    this.hexes = new Map();
    this.vertices = new Map();
    this.edges = new Map();
    this.radius = radius;
    this.hexSize = 50;
    this.generateBoard();
  }

  generateBoard() {
    const totalHexes = 3 * this.radius * (this.radius + 1) + 1;
    const terrainTypes = Object.values(HEX_TYPES);
    
    // Create broad pool evenly then fill up to totalHexes
    let terrainPool = [];
    for (let i = 0; i < totalHexes; i++) {
        // Desert is last in types, but let's just use it sparingly
        if (i === 0) terrainPool.push(HEX_TYPES.DESERT);
        else terrainPool.push(terrainTypes[(i % (terrainTypes.length - 1))]);
    }
    terrainPool.sort(() => Math.random() - 0.5);

    // Number pool (skipping 7 for robber mechanism if implemented)
    const possibleNums = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12];
    let numberPool = [];
    for (let i = 0; i < totalHexes - 1; i++) {
        numberPool.push(possibleNums[i % possibleNums.length]);
    }
    numberPool.sort(() => Math.random() - 0.5);

    let nIdx = 0, tIdx = 0;
    for (let q = -this.radius; q <= this.radius; q++) {
      for (let r = Math.max(-this.radius, -q - this.radius); r <= Math.min(this.radius, -q + this.radius); r++) {
        const terrain = terrainPool[tIdx++];
        const number = (terrain === HEX_TYPES.DESERT) ? null : numberPool[nIdx++];
        this.hexes.set(`${q},${r}`, { q, r, terrain, number, vertices: [], edges: [] });
      }
    }

    this.hexes.forEach(hex => {
      const hexVertices = this.getHexVertexPositions(hex.q, hex.r);
      const hexVKeys = [];
      hexVertices.forEach(pos => {
        const vx = Math.round(pos.x * 100) / 100;
        const vy = Math.round(pos.y * 100) / 100;
        const vKey = `${vx},${vy}`;
        if (!this.vertices.has(vKey)) this.vertices.set(vKey, new Vertex(vKey, vx, vy));
        const v = this.vertices.get(vKey);
        v.hexes.push(hex);
        hex.vertices.push(vKey);
        hexVKeys.push(vKey);
      });

      for (let i = 0; i < 6; i++) {
        const v1 = hexVKeys[i], v2 = hexVKeys[(i + 1) % 6];
        const eKey = [v1, v2].sort().join('|');
        if (!this.edges.has(eKey)) this.edges.set(eKey, new Edge(eKey, v1, v2));
        hex.edges.push(eKey);
      }
    });
  }

  getHexVertexPositions(q, r) {
    const center = this.hexToPixel(q, r);
    const v = [];
    for (let i = 0; i < 6; i++) {
      const rad = Math.PI / 180 * (60 * i);
      v.push({ x: center.x + this.hexSize * Math.cos(rad), y: center.y + this.hexSize * Math.sin(rad) });
    }
    return v;
  }

  hexToPixel(q, r) {
    return { x: this.hexSize * (1.5 * q), y: this.hexSize * (Math.sqrt(3)/2 * q + Math.sqrt(3) * r) };
  }

  getVertex(id) { return this.vertices.get(id); }
  getEdge(id) { return this.edges.get(id); }
  getEdgesOfVertex(vKey) {
    const res = [];
    this.edges.forEach(e => { if (e.v1 === vKey || e.v2 === vKey) res.push(e); });
    return res;
  }
}

// --- LOGIC: PLAYER ---
class Player {
  constructor(id, name, color) {
    this.id = id; this.name = name; this.color = color;
    this.resources = { WOOD: 0, BRICK: 0, SHEEP: 0, WHEAT: 0, ORE: 0 };
    this.settlements = []; this.cities = []; this.roads = []; this.victoryPoints = 0;
  }
  canAfford(cost) { return Object.entries(cost).every(([res, amt]) => (this.resources[res] || 0) >= amt); }
  spend(cost) { Object.entries(cost).forEach(([res, amt]) => this.resources[res] -= amt); }
  receive(res, amt = 1) { if (this.resources[res] !== undefined) this.resources[res] += amt; }
  calculateVP() { this.victoryPoints = this.settlements.length + (this.cities.length * 2); return this.victoryPoints; }
}

// --- LOGIC: RULES ---
class Rules {
  static canPlaceSettlement(board, vKey, player, phase) {
    const v = board.getVertex(vKey);
    if (!v || v.ownerId !== null) return false;
    const adjE = board.getEdgesOfVertex(vKey);
    if (adjE.some(e => {
        const otherV = (e.v1 === vKey) ? e.v2 : e.v1;
        return board.getVertex(otherV).ownerId !== null;
    })) return false;
    return phase === 'INITIAL' ? true : adjE.some(e => e.ownerId === player.id);
  }
  static canPlaceRoad(board, eKey, player) {
    const e = board.getEdge(eKey);
    if (!e || e.ownerId !== null) return false;
    if (board.getVertex(e.v1).ownerId === player.id || board.getVertex(e.v2).ownerId === player.id) return true;
    return board.getEdgesOfVertex(e.v1).some(oe => oe.ownerId === player.id) || board.getEdgesOfVertex(e.v2).some(oe => oe.ownerId === player.id);
  }
}

// --- LOGIC: GAMESTATE ---
class GameState {
  constructor(board, players, targetScore = 10, friendlyRobber = false) {
    this.board = board; this.players = players; this.currentPlayerIdx = 0;
    this.targetScore = targetScore; this.friendlyRobber = friendlyRobber;
    this.phase = 'INITIAL'; this.dice = [1, 1]; this.history = [];
    this.initialPlacements = 0; this.winner = null; this.hasRolled = false;
    this.pendingSettlement = null; this.movingRobber = false;
    this.robberHexId = Array.from(board.hexes.keys()).find(k => board.hexes.get(k).terrain === HEX_TYPES.DESERT);
    this.diceAnim = { value: [1, 1], timer: 0 };
    this.log(`Initial Phase: Goal is ${targetScore} Points`);
  }
  get currentPlayer() { return this.players[this.currentPlayerIdx]; }
  log(msg) { this.history.unshift(msg); if (this.history.length > 5) this.history.pop(); }
  
  nextTurn() {
    this.currentPlayerIdx = (this.currentPlayerIdx + 1) % this.players.length;
    this.hasRolled = false;
    this.players.forEach(p => p.calculateVP());
    this.checkWinner();
    this.log(`${this.currentPlayer.name}'s turn`);
    if (this.currentPlayerIdx === 0 && typeof setupTradeUI === 'function') setupTradeUI();
    if (this.currentPlayerIdx !== 0 && !this.winner) {
      setTimeout(() => { this.rollDice(); setTimeout(() => this.nextTurn(), 1000); }, 1000);
    }
  }

  rollDice() {
    this.dice = [Math.floor(Math.random()*6)+1, Math.floor(Math.random()*6)+1];
    this.diceAnim = { value: [...this.dice], timer: 120 };
    const tot = this.dice[0] + this.dice[1];
    this.log(`Rolled ${tot}`);
    this.hasRolled = true;
    if (typeof setupTradeUI === 'function') setupTradeUI();

    if (tot === 7) {
      this.log('Roll 7! Moving Robber...');
      // Discard half if > 7 cards
      this.players.forEach(p => {
        let totalRes = Object.values(p.resources).reduce((a,b) => a+b, 0);
        if (totalRes > 7) {
            let discardCount = Math.floor(totalRes / 2);
            this.log(`${p.name} discards ${discardCount} cards`);
            for(let i=0; i<discardCount; i++) {
                let resTypes = Object.keys(p.resources).filter(k => p.resources[k] > 0);
                let r = resTypes[Math.floor(Math.random()*resTypes.length)];
                p.resources[r]--;
            }
        }
      });
      if (this.currentPlayerIdx === 0) {
        this.movingRobber = true;
      } else {
        this.aiMoveRobber();
      }
    } else {
      this.board.hexes.forEach((h, id) => {
        if (h.number === tot && id !== this.robberHexId) {
          h.vertices.forEach(vk => {
            const v = this.board.getVertex(vk);
            if (v.ownerId !== null) this.players[v.ownerId].receive(h.terrain.name.toUpperCase(), v.isCity ? 2 : 1);
          });
        }
      });
    }
  }

  aiMoveRobber() {
    const hexKeys = Array.from(this.board.hexes.keys()).filter(k => k !== this.robberHexId);
    let bestHex = hexKeys[Math.floor(Math.random() * hexKeys.length)];
    // Simple AI heuristic: try to pick a hex with other player settlements
    for (const key of hexKeys) {
      const h = this.board.hexes.get(key);
      if (h.terrain === HEX_TYPES.DESERT) continue;
      const scores = h.vertices.map(vk => {
        const v = this.board.getVertex(vk);
        if (v.ownerId !== null && v.ownerId !== this.currentPlayerIdx) {
            // Friendly robber: avoid players with few points
            if (this.friendlyRobber && this.players[v.ownerId].victoryPoints <= 2) return -100;
            return v.isCity ? 2 : 1;
        }
        return 0;
      });
      if (scores.reduce((a,b)=>a+b, 0) > 0) { bestHex = key; break; }
    }
    this.moveRobber(bestHex);
  }

  moveRobber(hexId) {
    if (hexId === this.robberHexId) return;
    this.robberHexId = hexId;
    this.movingRobber = false;
    this.log(`Robber moved to ${this.board.hexes.get(hexId).terrain.name}`);
  }

  tradeWithBank(fromRes, toRes) {
    const p = this.players[0]; // Human only trade for simplicity for now
    if (this.currentPlayerIdx === 0 && p.resources[fromRes] >= 4) {
      p.resources[fromRes] -= 4;
      p.resources[toRes] += 1;
      this.log(`Traded 4 ${fromRes} for 1 ${toRes}`);
      return true;
    }
    return false;
  }

  build(type, id) {
    const p = this.currentPlayer;
    if (this.phase === 'INITIAL') {
      if (type === 'SETTLEMENT' && !this.pendingSettlement) {
        if (this.board.getVertex(id).ownerId === null) {
          const v = this.board.getVertex(id);
          v.ownerId = p.id; p.settlements.push(id);
          this.pendingSettlement = id; this.log('Place road');
          
          if (this.initialPlacements >= this.players.length) {
            v.hexes.forEach(h => {
              if (h.terrain !== HEX_TYPES.DESERT) p.receive(h.terrain.name.toUpperCase(), 1);
            });
          }
        }
      } else if (type === 'ROAD' && this.pendingSettlement) {
        const e = this.board.getEdge(id);
        if (e.ownerId === null && (e.v1 === this.pendingSettlement || e.v2 === this.pendingSettlement)) {
          e.ownerId = p.id; p.roads.push(id); this.finishInitial();
        }
      }
    } else if (this.hasRolled) {
      if (type === 'SETTLEMENT' && p.canAfford(COSTS.SETTLEMENT) && Rules.canPlaceSettlement(this.board, id, p, 'PLAY')) {
        this.board.getVertex(id).ownerId = p.id; p.settlements.push(id); p.spend(COSTS.SETTLEMENT); this.log('Built Settlement');
      } else if (type === 'ROAD' && p.canAfford(COSTS.ROAD) && Rules.canPlaceRoad(this.board, id, p)) {
        this.board.getEdge(id).ownerId = p.id; p.roads.push(id); p.spend(COSTS.ROAD); this.log('Built Road');
      } else if (type === 'CITY' && p.canAfford(COSTS.CITY)) {
        const v = this.board.getVertex(id);
        if (v.ownerId === p.id && !v.isCity) { v.isCity = true; p.cities.push(id); p.settlements = p.settlements.filter(s => s !== id); p.spend(COSTS.CITY); this.log('Built City'); }
      }
    }
    if (this.currentPlayerIdx === 0 && typeof setupTradeUI === 'function') setupTradeUI();
  }

  finishInitial() {
    this.pendingSettlement = null; this.initialPlacements++;
    const numPlayers = this.players.length;
    // Order: 0, 1, 2... then reverse ...2, 1, 0
    let order = [];
    for (let i = 0; i < numPlayers; i++) order.push(i);
    for (let i = numPlayers - 1; i >= 0; i--) order.push(i);

    if (this.initialPlacements < numPlayers * 2) {
      this.currentPlayerIdx = order[this.initialPlacements];
      if (this.currentPlayerIdx !== 0) setTimeout(() => this.aiInitial(), 1000);
    } else { this.phase = 'PLAY'; this.currentPlayerIdx = 0; this.log('Play Phase Started!'); }
  }

  aiInitial() {
    const keys = Array.from(this.board.vertices.keys()).sort(() => Math.random() - 0.5);
    for (const k of keys) {
      if (Rules.canPlaceSettlement(this.board, k, this.currentPlayer, 'INITIAL')) {
        this.build('SETTLEMENT', k);
        const edges = this.board.getEdgesOfVertex(k);
        this.build('ROAD', edges[Math.floor(Math.random() * edges.length)].id);
        break;
      }
    }
  }

  checkWinner() { this.players.forEach(p => { if (p.calculateVP() >= this.targetScore) this.winner = p; }); }
}

// --- RENDER: CANVAS ---
class CanvasRenderer {
  constructor(canvas, board) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d');
    this.board = board;
    this.camera = { x: 0, y: 0, zoom: 1.0 };
  }
  render(gs, hover) {
    if (gs.diceAnim.timer > 0) gs.diceAnim.timer--;
    this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
    
    this.ctx.save();
    // Centralize and apply pan/zoom
    this.ctx.translate(this.canvas.width/2 + this.camera.x, this.canvas.height/2 + this.camera.y);
    this.ctx.scale(this.camera.zoom, this.camera.zoom);

    this.board.hexes.forEach((h, id) => {
      const p = this.board.hexToPixel(h.q, h.r);
      const px = p.x, py = p.y;
      this.drawPoly(px, py, 6, this.board.hexSize, h.terrain.color, hover?.id === `${h.q},${h.r}`);
      if (h.number) {
        this.ctx.fillStyle = '#fff'; this.ctx.beginPath(); this.ctx.arc(px,py,15,0,Math.PI*2); this.ctx.fill();
        this.ctx.fillStyle = (h.number===6||h.number===8)?'red':'black'; 
        this.ctx.font='bold 16px Arial'; 
        this.ctx.textAlign='center'; 
        this.ctx.textBaseline='middle';
        this.ctx.fillText(h.number, px, py);
      }
      if (gs.robberHexId === id) {
        this.ctx.fillStyle = 'rgba(50,50,50,0.8)';
        this.ctx.beginPath(); this.ctx.arc(px, py + 10, 10, 0, Math.PI*2); this.ctx.fill();
        this.ctx.strokeStyle = '#fff'; this.ctx.lineWidth = 2; this.ctx.stroke();
      }
      if (gs.movingRobber && gs.currentPlayerIdx === 0 && gs.robberHexId !== id) {
        this.ctx.strokeStyle = 'cyan'; this.ctx.lineWidth = 3;
        this.ctx.setLineDash([5, 5]);
        this.ctx.beginPath(); this.ctx.arc(px, py, 40, 0, Math.PI*2); this.ctx.stroke();
        this.ctx.setLineDash([]);
      }
    });

    this.board.edges.forEach(e => {
      const v1 = this.board.getVertex(e.v1), v2 = this.board.getVertex(e.v2);
      const isOwned = e.ownerId !== null;
      const isHumanTurn = gs.currentPlayerIdx === 0;
      const canAffordRoad = (gs.phase === 'INITIAL' && gs.pendingSettlement) || (gs.phase === 'PLAY' && gs.hasRolled && gs.players[0].canAfford(COSTS.ROAD));
      
      let isValidRoad = false;
      if (isHumanTurn && !isOwned && canAffordRoad) {
        if (gs.phase === 'INITIAL') isValidRoad = (e.v1 === gs.pendingSettlement || e.v2 === gs.pendingSettlement);
        else isValidRoad = Rules.canPlaceRoad(this.board, e.id, gs.players[0]);
      }
      
      const x1 = v1.x, y1 = v1.y, x2 = v2.x, y2 = v2.y;

      // Draw road with border
      if (isOwned) {
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 10;
        this.ctx.beginPath(); this.ctx.moveTo(x1, y1); this.ctx.lineTo(x2, y2); this.ctx.stroke();
        this.ctx.strokeStyle = gs.players[e.ownerId].color;
        this.ctx.lineWidth = 6;
        this.ctx.stroke();
      } else if (hover?.id === e.id) {
        this.ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        this.ctx.lineWidth = 6;
        this.ctx.beginPath(); this.ctx.moveTo(x1, y1); this.ctx.lineTo(x2, y2); this.ctx.stroke();
      }

      // Draw buildable highlight
      if (isValidRoad) {
        this.ctx.globalAlpha = 0.5 + 0.3 * Math.sin(Date.now() / 150);
        this.ctx.strokeStyle = '#00ffff'; 
        this.ctx.lineWidth = 6;
        this.ctx.setLineDash([5, 5]);
        this.ctx.beginPath(); this.ctx.moveTo(x1, y1); this.ctx.lineTo(x2, y2); this.ctx.stroke();
        this.ctx.setLineDash([]);
        this.ctx.globalAlpha = 1.0;
      }
    });

    this.board.vertices.forEach(v => {
        const px = v.x, py = v.y;
        const isOwned = v.ownerId !== null;
        const isHumanTurn = gs.currentPlayerIdx === 0;
        const canAffordSettle = (gs.phase === 'INITIAL' && !gs.pendingSettlement) || (gs.phase === 'PLAY' && gs.hasRolled && gs.players[0].canAfford(COSTS.SETTLEMENT));
        const canSettle = (isHumanTurn && !isOwned && canAffordSettle && Rules.canPlaceSettlement(this.board, v.id, gs.players[0], gs.phase));
        const canUpgrade = (isHumanTurn && isOwned && v.ownerId === 0 && !v.isCity && gs.players[0].canAfford(COSTS.CITY) && gs.hasRolled);

        if (isOwned) {
            this.ctx.fillStyle = gs.players[v.ownerId].color;
            this.ctx.strokeStyle = '#000';
            this.ctx.lineWidth = 2;
            if (v.isCity) {
                this.ctx.fillRect(px-11, py-11, 22, 22); 
                this.ctx.strokeRect(px-11, py-11, 22, 22);
            } else { 
                this.ctx.beginPath(); this.ctx.arc(px, py, 9, 0, Math.PI*2); this.ctx.fill(); this.ctx.stroke(); 
            }
        } else if (hover?.id === v.id) {
            this.ctx.fillStyle = 'rgba(255,255,255,0.5)'; this.ctx.beginPath(); this.ctx.arc(px, py, 8, 0, Math.PI*2); this.ctx.fill();
        }

        // Highlight buildable
        if (canSettle || canUpgrade) {
          const pulse = 0.5 + 0.3 * Math.sin(Date.now() / 150);
          this.ctx.globalAlpha = pulse;
          this.ctx.fillStyle = canUpgrade ? '#ffd700' : '#00ffff'; 
          this.ctx.beginPath();
          this.ctx.arc(px, py, canUpgrade ? 14 : 12, 0, Math.PI * 2);
          this.ctx.fill();
          this.ctx.strokeStyle = '#fff';
          this.ctx.lineWidth = 2;
          this.ctx.stroke();
          this.ctx.globalAlpha = 1.0;
        }
    });
    this.ctx.restore();

    this.drawUI(gs);

    if (gs.diceAnim.timer > 0) {
        const opacity = Math.min(1, gs.diceAnim.timer / 30);
        this.ctx.globalAlpha = opacity;
        const centerX = this.canvas.width / 2, centerY = this.canvas.height / 2;
        const size = 100;
        this.drawDice(centerX - size - 10, centerY - size/2, gs.diceAnim.value[0], size);
        this.drawDice(centerX + 10, centerY - size/2, gs.diceAnim.value[1], size);
        this.ctx.globalAlpha = 1.0;
    }
  }
  drawPoly(x,y,s,sz,c,h) {
    this.ctx.fillStyle=c; this.ctx.strokeStyle=h?'yellow':'#000'; this.ctx.lineWidth=h?4:2;
    this.ctx.beginPath(); for(let i=0;i<s;i++){const a=2*Math.PI*i/s; this.ctx.lineTo(x+sz*Math.cos(a), y+sz*Math.sin(a));} this.ctx.closePath(); this.ctx.fill(); this.ctx.stroke();
  }
  drawDice(x, y, value, size = 35) {
    this.ctx.fillStyle = '#eee';
    this.ctx.fillRect(x, y, size, size);
    this.ctx.strokeStyle = '#333';
    this.ctx.lineWidth = size / 20;
    this.ctx.strokeRect(x, y, size, size);

    this.ctx.fillStyle = '#000';
    const dot = size / 8;
    const mid = size / 2;
    const q1 = size / 4;
    const q3 = (size / 4) * 3;

    if (value === 1 || value === 3 || value === 5) this.drawDot(x + mid, y + mid, dot);
    if (value >= 2) { this.drawDot(x + q1, y + q1, dot); this.drawDot(x + q3, y + q3, dot); }
    if (value >= 4) { this.drawDot(x + q3, y + q1, dot); this.drawDot(x + q1, y + q3, dot); }
    if (value === 6) { this.drawDot(x + q1, y + mid, dot); this.drawDot(x + q3, y + mid, dot); }
  }
  drawDot(x, y, r) { this.ctx.beginPath(); this.ctx.arc(x, y, r, 0, Math.PI * 2); this.ctx.fill(); }

  drawUI(gs) {
    const PANEL_WIDTH = 260;
    const PANEL_HEIGHT = 460;
    this.ctx.fillStyle='#333'; this.ctx.fillRect(10,10,PANEL_WIDTH,PANEL_HEIGHT);
    this.ctx.strokeStyle='#fff'; this.ctx.lineWidth=1; this.ctx.strokeRect(10,10,PANEL_WIDTH,PANEL_HEIGHT);

    this.ctx.fillStyle='#fff'; 
    this.ctx.font='bold 18px Arial'; 
    this.ctx.textAlign='left'; 
    this.ctx.textBaseline='top';
    this.ctx.fillText('HEXBOUND', 25, 25);

    if (gs.movingRobber && gs.currentPlayerIdx === 0) {
      this.ctx.fillStyle = '#f1c40f';
      this.ctx.font = 'bold 14px Arial';
      this.ctx.fillText('CLICK A HEX TO MOVE ROBBER', 25, 55);
    } else {
      this.ctx.font='14px Arial'; 
      let y=55;
      this.ctx.fillStyle=gs.currentPlayer.color; 
      this.ctx.fillText(`Turn: ${gs.currentPlayer.name}`, 25, y);
    }
    
    let y = 85;
    this.drawDice(25, y, gs.dice[0]);
    this.drawDice(70, y, gs.dice[1]);
    
    y+=45; 
    this.ctx.fillStyle='#fff'; 
    this.ctx.fillText('Your Resources:', 25, y);
    // Only show resources for Human (id 0) during their turn, OR if it's the current player
    // User asked to "only see their resources not the ais resources during their turns"
    // We'll show the Human's resources always, and AI resources never.
    const human = gs.players[0];
    Object.entries(human.resources).forEach(([r,v]) => { 
        y+=18; 
        this.ctx.fillText(`${r}: ${v}`, 35, y); 
    });

    y+=16; 
    this.ctx.fillStyle='#fff';
    this.ctx.fillText('Scores:', 25, y);
    gs.players.forEach(p => { 
        y+=18; 
        this.ctx.fillStyle = p.color; 
        this.ctx.fillText(`${p.name}: ${p.victoryPoints}`, 35, y); 
    });

    if (gs.friendlyRobber) {
      y += 24;
      this.ctx.fillStyle = '#00ffcc';
      this.ctx.font = 'italic 11px Arial';
      this.ctx.fillText('🛡️ Friendly Robber Active', 25, y);
    }

    y+=28; 
    this.ctx.fillStyle='#fff';
    this.ctx.font='14px Arial';
    this.ctx.fillText('History:', 25, y);
    this.ctx.fillStyle='#aaa'; 
    this.ctx.font='11px Arial';
    gs.history.forEach(h => { 
        const displayLog = h.length > 35 ? h.substring(0, 32) + '...' : h;
        y+=16; 
        this.ctx.fillText(displayLog, 25, y); 
    });

    if (gs.winner) { 
        this.ctx.fillStyle='rgba(0,0,0,0.8)'; 
        this.ctx.fillRect(0,0,this.canvas.width,this.canvas.height); 
        this.ctx.fillStyle='gold'; 
        this.ctx.font='bold 40px Arial'; 
        this.ctx.textAlign='center'; 
        this.ctx.textBaseline='middle';
        this.ctx.fillText(`${gs.winner.name} WINS!`, this.canvas.width/2, this.canvas.height/2); 
    }
  }
}

// --- INPUT ---
class InputHandler {
  constructor(canvas, board, gs, ren) {
    this.canvas = canvas; this.board = board; this.gs = gs; this.ren = ren; this.hover = null;
    this.isDragging = false;
    this.dragMoved = false;
    this.lastMouse = { x: 0, y: 0 };

    canvas.addEventListener('mousemove', e => this.move(e));
    canvas.addEventListener('mousedown', e => this.down(e));
    canvas.addEventListener('mouseup', e => this.up(e));
    canvas.addEventListener('wheel', e => this.wheel(e), { passive: false });
    
    // Prevent context menu on right click to allow for panning
    canvas.addEventListener('contextmenu', e => e.preventDefault());
  }

  getGameXY(e) {
    const r = this.canvas.getBoundingClientRect();
    const sx = e.clientX - r.left;
    const sy = e.clientY - r.top;
    // Inverse of: screen = (game * zoom) + center + camera
    const gx = (sx - this.canvas.width / 2 - this.ren.camera.x) / this.ren.camera.zoom;
    const gy = (sy - this.canvas.height / 2 - this.ren.camera.y) / this.ren.camera.zoom;
    return { x: gx, y: gy };
  }

  move(e) {
    if (this.isDragging) {
      const dx = e.clientX - this.lastMouse.x;
      const dy = e.clientY - this.lastMouse.y;
      this.ren.camera.x += dx;
      this.ren.camera.y += dy;
      this.lastMouse = { x: e.clientX, y: e.clientY };
      if (Math.hypot(dx, dy) > 2) this.dragMoved = true;
    }

    const { x, y } = this.getGameXY(e);
    this.hover = null;
    
    // Adjust hitboxes based on zoom - some things should stay clickable
    const vertexThreshold = 15 / Math.max(0.5, this.ren.camera.zoom);
    const edgeThreshold = 10 / Math.max(0.5, this.ren.camera.zoom);

    this.board.vertices.forEach(v => { 
        if (Math.hypot(x - v.x, y - v.y) < vertexThreshold) this.hover = { type: 'vertex', id: v.id }; 
    });
    if (!this.hover) this.board.edges.forEach(e => {
        const v1 = this.board.getVertex(e.v1), v2 = this.board.getVertex(e.v2);
        if (Math.hypot(x - (v1.x + v2.x) / 2, y - (v1.y + v2.y) / 2) < edgeThreshold) this.hover = { type: 'edge', id: e.id };
    });
    if (!this.hover) this.board.hexes.forEach(h => {
        const p = this.board.hexToPixel(h.q, h.r);
        if (Math.hypot(x - p.x, y - p.y) < 40) this.hover = { type: 'hex', id: `${h.q},${h.r}` };
    });
  }

  down(e) {
    this.isDragging = true;
    this.dragMoved = false;
    this.lastMouse = { x: e.clientX, y: e.clientY };
  }

  up(e) {
    this.isDragging = false;
    if (!this.dragMoved) {
        this.click();
    }
  }

  wheel(e) {
    e.preventDefault();
    const zoomSpeed = 0.001;
    const delta = -e.deltaY;
    const oldZoom = this.ren.camera.zoom;
    const newZoom = Math.min(Math.max(0.3, oldZoom + delta * zoomSpeed), 3.0);
    
    // Zoom towards mouse position
    const r = this.canvas.getBoundingClientRect();
    const mx = e.clientX - r.left - this.canvas.width / 2;
    const my = e.clientY - r.top - this.canvas.height / 2;

    // Adjust camera pan to keep mouse over the same game spot
    this.ren.camera.x -= (mx - this.ren.camera.x) * (newZoom / oldZoom - 1);
    this.ren.camera.y -= (my - this.ren.camera.y) * (newZoom / oldZoom - 1);
    this.ren.camera.zoom = newZoom;
  }

  click() {
    if(this.gs.currentPlayerIdx!==0 || !this.hover) return;
    if(this.gs.movingRobber) {
        if(this.hover.type==='hex') {
            const h = this.board.hexes.get(this.hover.id);
            if(this.gs.friendlyRobber) {
                const affected = h.vertices.some(vk => {
                    const v = this.board.getVertex(vk);
                    return v.ownerId !== null && v.ownerId !== 0 && this.gs.players[v.ownerId].victoryPoints <= 2;
                });
                if(affected) { this.gs.log('Cannot rob: Friendly Robber (players safe at <= 2 pts)'); return; }
            }
            this.gs.moveRobber(this.hover.id);
        }
    } else if(this.hover.type==='vertex') {
        const v = this.board.getVertex(this.hover.id);
        if(v.ownerId===null) this.gs.build('SETTLEMENT', this.hover.id);
        else if(v.ownerId===0) this.gs.build('CITY', this.hover.id);
    } else if(this.hover.type==='edge') this.gs.build('ROAD', this.hover.id);
  }
}

// --- MAIN ---
const canvas = document.getElementById('gameCanvas');
const rollBtn = document.getElementById('rollBtn');
const endBtn = document.getElementById('endBtn');
const startGameBtn = document.getElementById('startGameBtn');
const menuOverlay = document.getElementById('menu-overlay');
const gameInterface = document.getElementById('game-interface');
const boardSizeSelect = document.getElementById('boardSize');
const winPointsInput = document.getElementById('winPoints');
const winPointsValue = document.getElementById('winPointsValue');
const winLimitHint = document.getElementById('winLimitHint');

function updateWinPointsLimit() {
  const limits = { '1': 8, '2': 15, '3': 25 };
  const max = limits[boardSizeSelect.value] || 15;
  winPointsInput.max = max;
  winLimitHint.innerText = `Max: ${max} points for this size`;
  if (parseInt(winPointsInput.value) > max) winPointsInput.value = max;
  winPointsValue.innerText = winPointsInput.value;
}
boardSizeSelect.addEventListener('change', updateWinPointsLimit);
winPointsInput.addEventListener('input', () => {
    winPointsValue.innerText = winPointsInput.value;
});
updateWinPointsLimit();

const tradePanel = document.getElementById('trade-panel');
const tradeGiveContainer = document.getElementById('trade-give');
const tradeGetContainer = document.getElementById('trade-get');
const tradeGetLabel = document.getElementById('trade-get-label');
let tradeGiveSelection = null;

function setupTradeUI() {
    if (!gs || gs.currentPlayerIdx !== 0) return;
    const p = gs.players[0];
    const resources = ['WOOD', 'BRICK', 'SHEEP', 'WHEAT', 'ORE'];
    tradeGiveContainer.innerHTML = '';
    tradeGetContainer.innerHTML = '';
    tradeGiveSelection = null;
    tradeGetContainer.style.display = 'none';
    tradeGetLabel.style.display = 'none';

    resources.forEach(fromRes => {
        const affordable = p.resources[fromRes] >= 4;
        const btn = document.createElement('button');
        btn.innerText = `Give 4 ${fromRes}`;
        btn.style.fontSize = '9px'; btn.style.padding = '4px 6px';
        btn.style.background = affordable ? '#2ecc71' : '#666';
        btn.style.opacity = affordable ? '1.0' : '0.5';
        btn.disabled = !affordable;
        
        btn.onclick = () => {
          // Highlight selection
          Array.from(tradeGiveContainer.children).forEach((b, i) => {
             const res = resources[i];
             b.style.background = (p.resources[res] >= 4) ? '#2ecc71' : '#666';
             b.style.border = 'none';
          });
          btn.style.background = '#27ae60'; // Darker green for selection
          btn.style.border = '2px solid gold';
          tradeGiveSelection = fromRes;
          showTradeGetOptions(fromRes);
        };
        tradeGiveContainer.appendChild(btn);
    });
}

function showTradeGetOptions(fromRes) {
    const resources = ['WOOD', 'BRICK', 'SHEEP', 'WHEAT', 'ORE'];
    tradeGetContainer.innerHTML = '';
    tradeGetContainer.style.display = 'flex';
    tradeGetLabel.style.display = 'block';

    resources.filter(r => r !== fromRes).forEach(toRes => {
        const btn = document.createElement('button');
        btn.innerText = `Get 1 ${toRes}`;
        btn.style.fontSize = '9px'; btn.style.padding = '4px 6px';
        btn.style.background = '#0099ff'; // Blue for GET buttons
        btn.onclick = () => {
            if(!gs.tradeWithBank(fromRes, toRes)) {
                alert(`Not enough ${fromRes}! Need at least 4.`);
                setupTradeUI(); // Reset if somehow they don't have enough now
            } else {
                setupTradeUI(); // Refresh state after trade
            }
        };
        tradeGetContainer.appendChild(btn);
    });
}

function resize() { 
  canvas.width = window.innerWidth; 
  canvas.height = window.innerHeight; 
}
window.addEventListener('resize', resize); resize();

let board, players, gs, ren, inp;

startGameBtn.onclick = () => {
  const aiCount = parseInt(document.getElementById('aiCount').value);
  const boardRadius = parseInt(document.getElementById('boardSize').value);
  const winPoints = parseInt(document.getElementById('winPoints').value);
  const friendlyRobber = document.getElementById('friendlyRobber').checked;

  // Update rule text
  document.getElementById('ruleWinPoints').innerHTML = `<strong>Victory:</strong> Reach ${winPoints} points.`;

  board = new Board(boardRadius);
  players = [new Player(0, 'Human', '#0099ff')];
  const colors = ['#ff4444', '#ffcc00', '#ffffff'];
  for (let i = 0; i < aiCount; i++) {
    players.push(new Player(i + 1, `AI ${i + 1}`, colors[i]));
  }

  gs = new GameState(board, players, winPoints, friendlyRobber);
  ren = new CanvasRenderer(canvas, board);
  inp = new InputHandler(canvas, board, gs, ren);
  setupTradeUI();

  menuOverlay.style.display = 'none';
  gameInterface.style.display = 'block';
  resize(); // Trigger resize to ensure canvas fits
  requestAnimationFrame(loop);
};

rollBtn.onclick = () => { if(gs && !gs.hasRolled && !gs.movingRobber) gs.rollDice(); };
endBtn.onclick = () => { if(gs && gs.hasRolled && !gs.movingRobber) gs.nextTurn(); };
document.getElementById('resetCamBtn').onclick = () => { if(ren) { ren.camera = { x: 0, y: 0, zoom: 1.0 }; } };

function loop() {
  if (!gs) return;
  ren.render(gs, inp.hover);
  rollBtn.disabled = gs.phase!=='PLAY' || gs.currentPlayerIdx!==0 || gs.hasRolled || gs.movingRobber;
  endBtn.disabled = gs.phase!=='PLAY' || gs.currentPlayerIdx!==0 || !gs.hasRolled || gs.movingRobber;
  tradePanel.style.display = (gs.phase === 'PLAY' && gs.currentPlayerIdx === 0 && !gs.movingRobber) ? 'flex' : 'none';
  requestAnimationFrame(loop);
}
