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
  constructor() {
    this.hexes = new Map();
    this.vertices = new Map();
    this.edges = new Map();
    this.radius = 2;
    this.hexSize = 50;
    this.generateBoard();
  }

  generateBoard() {
    const terrainPool = [
      ...Array(4).fill(HEX_TYPES.WOOD), ...Array(4).fill(HEX_TYPES.SHEEP),
      ...Array(4).fill(HEX_TYPES.WHEAT), ...Array(3).fill(HEX_TYPES.BRICK),
      ...Array(3).fill(HEX_TYPES.ORE), HEX_TYPES.DESERT
    ].sort(() => Math.random() - 0.5);

    const numberPool = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12].sort(() => Math.random() - 0.5);

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
    this.resources = { WOOD: 2, BRICK: 2, SHEEP: 2, WHEAT: 2, ORE: 0 };
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
  constructor(board, players) {
    this.board = board; this.players = players; this.currentPlayerIdx = 0;
    this.phase = 'INITIAL'; this.dice = [1, 1]; this.history = [];
    this.initialPlacements = 0; this.winner = null; this.hasRolled = false; this.pendingSettlement = null;
    this.log('Initial Phase: Place Settlement then Road');
  }
  get currentPlayer() { return this.players[this.currentPlayerIdx]; }
  log(msg) { this.history.unshift(msg); if (this.history.length > 5) this.history.pop(); }
  
  nextTurn() {
    this.currentPlayerIdx = (this.currentPlayerIdx + 1) % 4;
    this.hasRolled = false;
    this.players.forEach(p => p.calculateVP());
    this.checkWinner();
    this.log(`${this.currentPlayer.name}'s turn`);
    if (this.currentPlayerIdx !== 0 && !this.winner) {
      setTimeout(() => { this.rollDice(); setTimeout(() => this.nextTurn(), 1000); }, 1000);
    }
  }

  rollDice() {
    this.dice = [Math.floor(Math.random()*6)+1, Math.floor(Math.random()*6)+1];
    const tot = this.dice[0] + this.dice[1];
    this.log(`Rolled ${tot}`);
    this.board.hexes.forEach(h => {
      if (h.number === tot) h.vertices.forEach(vk => {
        const v = this.board.getVertex(vk);
        if (v.ownerId !== null) this.players[v.ownerId].receive(h.terrain.name.toUpperCase(), v.isCity ? 2 : 1);
      });
    });
    this.hasRolled = true;
  }

  build(type, id) {
    const p = this.currentPlayer;
    if (this.phase === 'INITIAL') {
      if (type === 'SETTLEMENT' && !this.pendingSettlement) {
        if (this.board.getVertex(id).ownerId === null) {
          this.board.getVertex(id).ownerId = p.id; p.settlements.push(id);
          this.pendingSettlement = id; this.log('Place road');
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
  }

  finishInitial() {
    this.pendingSettlement = null; this.initialPlacements++;
    const order = [0, 1, 2, 3, 3, 2, 1, 0];
    if (this.initialPlacements < 8) {
      this.currentPlayerIdx = order[this.initialPlacements];
      if (this.currentPlayerIdx !== 0) setTimeout(() => this.aiInitial(), 1000);
    } else { this.phase = 'PLAY'; this.currentPlayerIdx = 0; this.log('Play Phase Started!'); }
  }

  aiInitial() {
    const keys = Array.from(this.board.vertices.keys()).sort(() => Math.random() - 0.5);
    for (const k of keys) {
      if (Rules.canPlaceSettlement(this.board, k, this.currentPlayer, 'INITIAL')) {
        this.build('SETTLEMENT', k);
        this.build('ROAD', this.board.getEdgesOfVertex(k)[0].id);
        break;
      }
    }
  }

  checkWinner() { this.players.forEach(p => { if (p.calculateVP() >= 10) this.winner = p; }); }
}

// --- RENDER: CANVAS ---
class CanvasRenderer {
  constructor(canvas, board) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d');
    this.board = board; this.offset = { x: canvas.width/2, y: canvas.height/2 };
  }
  render(gs, hover) {
    this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
    this.board.hexes.forEach(h => {
      const p = this.board.hexToPixel(h.q, h.r);
      const px = p.x + this.offset.x, py = p.y + this.offset.y;
      this.drawPoly(px, py, 6, this.board.hexSize, h.terrain.color, hover?.id === `${h.q},${h.r}`);
      if (h.number) {
        this.ctx.fillStyle = '#fff'; this.ctx.beginPath(); this.ctx.arc(px,py,15,0,Math.PI*2); this.ctx.fill();
        this.ctx.fillStyle = (h.number===6||h.number===8)?'red':'black'; 
        this.ctx.font='bold 16px Arial'; 
        this.ctx.textAlign='center'; 
        this.ctx.textBaseline='middle';
        this.ctx.fillText(h.number, px, py);
      }
    });
    this.board.edges.forEach(e => {
      const v1 = this.board.getVertex(e.v1), v2 = this.board.getVertex(e.v2);
      this.ctx.strokeStyle = e.ownerId !== null ? gs.players[e.ownerId].color : (hover?.id === e.id ? 'rgba(255,255,255,0.5)' : 'transparent');
      if (this.ctx.strokeStyle !== 'transparent') {
        this.ctx.lineWidth = 10; this.ctx.beginPath(); this.ctx.moveTo(v1.x+this.offset.x, v1.y+this.offset.y); this.ctx.lineTo(v2.x+this.offset.x, v2.y+this.offset.y); this.ctx.stroke();
      }
    });
    this.board.vertices.forEach(v => {
        const px = v.x + this.offset.x, py = v.y + this.offset.y;
        if (v.ownerId !== null) {
            this.ctx.fillStyle = gs.players[v.ownerId].color;
            if (v.isCity) this.ctx.fillRect(px-10, py-10, 20, 20); else { this.ctx.beginPath(); this.ctx.arc(px, py, 8, 0, Math.PI*2); this.ctx.fill(); }
        } else if (hover?.id === v.id) {
            this.ctx.fillStyle = 'rgba(255,255,255,0.5)'; this.ctx.beginPath(); this.ctx.arc(px, py, 8, 0, Math.PI*2); this.ctx.fill();
        }
    });
    this.drawUI(gs);
  }
  drawPoly(x,y,s,sz,c,h) {
    this.ctx.fillStyle=c; this.ctx.strokeStyle=h?'yellow':'#000'; this.ctx.lineWidth=h?4:2;
    this.ctx.beginPath(); for(let i=0;i<s;i++){const a=2*Math.PI*i/s; this.ctx.lineTo(x+sz*Math.cos(a), y+sz*Math.sin(a));} this.ctx.closePath(); this.ctx.fill(); this.ctx.stroke();
  }
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

    this.ctx.font='14px Arial'; 
    let y=55;
    this.ctx.fillStyle=gs.currentPlayer.color; 
    this.ctx.fillText(`Turn: ${gs.currentPlayer.name}`, 25, y);
    
    y+=25; 
    this.ctx.fillStyle='#fff'; 
    this.ctx.fillText('Resources:', 25, y);
    Object.entries(gs.currentPlayer.resources).forEach(([r,v]) => { 
        y+=18; 
        this.ctx.fillText(`${r}: ${v}`, 35, y); 
    });

    y+=35; 
    this.ctx.fillText('Scores:', 25, y);
    gs.players.forEach(p => { 
        y+=18; 
        this.ctx.fillStyle=p.color; 
        this.ctx.fillText(`${p.name}: ${p.victoryPoints}`, 35, y); 
    });

    y+=35; 
    this.ctx.fillStyle='#fff';
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
    canvas.addEventListener('mousemove', e => this.move(e));
    canvas.addEventListener('click', () => this.click());
  }
  move(e) {
    const r = this.canvas.getBoundingClientRect();
    const x = e.clientX-r.left-this.ren.offset.x, y = e.clientY-r.top-this.ren.offset.y;
    this.hover = null;
    this.board.vertices.forEach(v => { if (Math.hypot(x-v.x, y-v.y)<15) this.hover = { type:'vertex', id:v.id }; });
    if(!this.hover) this.board.edges.forEach(e => {
        const v1=this.board.getVertex(e.v1), v2=this.board.getVertex(e.v2);
        if(Math.hypot(x-(v1.x+v2.x)/2, y-(v1.y+v2.y)/2)<10) this.hover = { type:'edge', id:e.id };
    });
    if(!this.hover) this.board.hexes.forEach(h => {
        const p = this.board.hexToPixel(h.q, h.r);
        if(Math.hypot(x-p.x, y-p.y)<40) this.hover = { type:'hex', id:`${h.q},${h.r}` };
    });
  }
  click() {
    if(this.gs.currentPlayerIdx!==0 || !this.hover) return;
    if(this.hover.type==='vertex') {
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

function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener('resize', resize); resize();

const board = new Board();
const players = [new Player(0, 'Human', '#0099ff'), new Player(1,'AI 1','#ff4444'), new Player(2,'AI 2','#ffcc00'), new Player(3,'AI 3','#ffffff')];
const gs = new GameState(board, players);
const ren = new CanvasRenderer(canvas, board);
const inp = new InputHandler(canvas, board, gs, ren);

rollBtn.onclick = () => { if(!gs.hasRolled) gs.rollDice(); };
endBtn.onclick = () => { if(gs.hasRolled) gs.nextTurn(); };

function loop() {
  ren.render(gs, inp.hover);
  rollBtn.disabled = gs.phase!=='PLAY' || gs.currentPlayerIdx!==0 || gs.hasRolled;
  endBtn.disabled = gs.phase!=='PLAY' || gs.currentPlayerIdx!==0 || !gs.hasRolled;
  requestAnimationFrame(loop);
}
loop();
