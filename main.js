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
  DESERT: { name: 'Desert', color: '#F4A460' },
  WATER: { name: 'Water', color: '#2980b9' }
};

const PLAYER_COLORS = ['#0099ff', '#ff4444', '#ffcc00', '#ffffff', '#e67e22', '#9b59b6', '#2ecc71', '#e91e63', '#1abc9c', '#800000', '#ff00ff', '#00ffff', '#990000', '#006600', '#000099', '#666666', '#ff80ed', '#fa8072', '#00ff00', '#ff0000', '#0000ff', '#b0e0e6', '#da70d6', '#ffa500', '#4b0082', '#808000', '#008080', '#ffdab9', '#c0c0c0', '#40e0d0', '#800080', '#00bfff', '#7cfc00', '#ff1493', '#ffd700', '#8b4513', '#556b2f', '#00ced1', '#483d8b', '#2f4f4f'];

const COSTS = {
  ROAD: { WOOD: 1, BRICK: 1 },
  SETTLEMENT: { WOOD: 1, BRICK: 1, SHEEP: 1, WHEAT: 1 },
  CITY: { ORE: 3, WHEAT: 2 },
  DEV_CARD: { ORE: 1, SHEEP: 1, WHEAT: 1 }
};

const DEV_CARD_TYPES = {
  KNIGHT: { name: 'Knight', desc: 'Move the robber and steal 1 resource.' },
  ROAD_BUILDING: { name: 'Road Building', desc: 'Place 2 free roads.' },
  YEAR_OF_PLENTY: { name: 'Year of Plenty', desc: 'Take any 2 resources from the bank.' },
  MONOPOLY: { name: 'Monopoly', desc: 'Claim all of 1 resource from other players.' },
  VP: { name: 'Victory Point', desc: 'Adds 1 to your victory points.' }
};

// --- STATISTICS ---
const STATS_KEY = "hexbound_global_stats";
const DEFAULT_SECTION = { games: 0, wins: 0, losses: 0, turns: 0, vp: 0, settlements: 0, cities: 0, roads: 0, devCards: 0 };
const DEFAULT_STATS = {
    total: { ...DEFAULT_SECTION },
    standard: { ...DEFAULT_SECTION },
    expanding: { ...DEFAULT_SECTION },
    battleRoyale: { ...DEFAULT_SECTION },
    singleplayer: { ...DEFAULT_SECTION },
    multiplayer: { ...DEFAULT_SECTION }
};

let recordedGameId = null;

function loadStats() {
    const data = localStorage.getItem(STATS_KEY);
    const defaults = JSON.parse(JSON.stringify(DEFAULT_STATS));
    if (!data) return defaults;
    try {
        const stored = JSON.parse(data);
        const merge = (target, source) => {
            if (!source) return target;
            return { ...target, ...source };
        };
        return {
            total: merge(defaults.total, stored.total),
            standard: merge(defaults.standard, stored.standard),
            expanding: merge(defaults.expanding, stored.expanding),
            battleRoyale: merge(defaults.battleRoyale, stored.battleRoyale),
            singleplayer: merge(defaults.singleplayer, stored.singleplayer),
            multiplayer: merge(defaults.multiplayer, stored.multiplayer)
        };
    } catch(e) { return defaults; }
}

function saveStats(stats) {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

function recordGameResult(gs) {
    // DO NOT record stats if it's an "Only Bots" simulation, a non-started lobby, or no actual human is in the session
    if (isOnlyBotsMode || !gs.started || gs.players.every(p => p.isBot)) return;
    if (gameSync.localPlayerId === null || gameSync.localPlayerId === undefined) return;
    
    // Use gameId or matchId as unique ID
    const gid = gs.gameId || gameSync.matchId;
    if (!gid || recordedGameId === gid) return;
    recordedGameId = gid;

    const p = gs.players[gameSync.localPlayerId];
    if (!p || p.isBot) return;

    const stats = loadStats();
    const isExpanding = (gs.gameMode === 'Expanding Board (Experimental)');
    const isBR = (gs.gameMode === 'Battle Royale');
    
    let modeKey = 'standard';
    if (isExpanding) modeKey = 'expanding';
    else if (isBR) modeKey = 'battleRoyale';

    const connectionKey = gameSync.isMultiplayer ? 'multiplayer' : 'singleplayer';

    [stats.total, stats[modeKey], stats[connectionKey]].forEach(s => {
        if (!s) return;
        s.games++;
        if (gs.winner && gs.winner.id === p.id) s.wins++;
        else s.losses++;
        s.turns += gs.rotations;
        s.vp += p.calculateVP(gs.longestRoadHolderId, gs.largestArmyHolderId);
        s.settlements += (p.totalSettlementsBuilt || 0);
        s.cities += (p.totalCitiesBuilt || 0);
        s.roads += (p.totalRoadsBuilt || 0);
        s.devCards += (p.totalDevCardsUsed || 0);
    });

    saveStats(stats);
    showToast("Game results recorded in Vault of Records.", "info");
}

function updateStatsUI() {
    const stats = loadStats();
    const container = document.getElementById('stats-content');
    if (!container) return;

    const sections = [
        { label: 'ALL MODES (TOTALS)', data: stats.total, color: '#9b59b6', fullWidth: true },
        { label: 'SINGLEPLAYER', data: stats.singleplayer, color: '#2ecc71' },
        { label: 'MULTIPLAYER', data: stats.multiplayer, color: '#3498db' },
        { label: 'STANDARD MODE', data: stats.standard, color: '#95a5a6' },
        { label: 'EXPANDING BOARD', data: stats.expanding, color: '#f4a460' },
        { label: 'BATTLE ROYALE', data: stats.battleRoyale, color: '#e74c3c' }
    ];

    container.innerHTML = sections.map(sec => {
        if (!sec.data) return "";
        const winRate = sec.data.games > 0 ? Math.round((sec.data.wins / sec.data.games) * 100) : 0;
        const avgTurns = sec.data.games > 0 ? Math.round(sec.data.turns / sec.data.games) : 0;
        const avgVP = sec.data.games > 0 ? (sec.data.vp / sec.data.games).toFixed(1) : "0.0";
        const gridSpan = sec.fullWidth ? "grid-column: span 2;" : "";
        
        return `
            <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 10px; border-left: 5px solid ${sec.color}; ${gridSpan}">
                <div style="color: ${sec.color}; font-weight: bold; font-size: 14px; margin-bottom: 10px;">${sec.label}</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                    <div style="font-size: 11px; color: #aaa;">GAMES: <b style="color: #fff;">${sec.data.games}</b></div>
                    <div style="font-size: 11px; color: #aaa;">WINS: <b style="color: #2ecc71;">${sec.data.wins}</b></div>
                    <div style="font-size: 11px; color: #aaa;">WIN RATE: <b style="color: #fff;">${winRate}%</b></div>
                    <div style="font-size: 11px; color: #aaa;">LOSSES: <b style="color: #e74c3c;">${sec.data.losses}</b></div>
                    <div style="font-size: 11px; color: #aaa;">TOTAL TURNS: <b style="color: #fff;">${sec.data.turns}</b></div>
                    <div style="font-size: 11px; color: #aaa;">AVG VP: <b style="color: #fff;">${avgVP}</b></div>
                </div>
                <!-- Infrastructure Stats -->
                <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.1); display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                    <div style="font-size: 11px; color: #aaa;">ROADS BUILT: <b style="color: #fff;">${sec.data.roads || 0}</b></div>
                    <div style="font-size: 11px; color: #aaa;">SETTLEMENTS: <b style="color: #fff;">${sec.data.settlements || 0}</b></div>
                    <div style="font-size: 11px; color: #aaa;">CITIES BUILT: <b style="color: #fff;">${sec.data.cities || 0}</b></div>
                    <div style="font-size: 11px; color: #aaa;">DEV CARDS PLAYED: <b style="color: #fff;">${sec.data.devCards || 0}</b></div>
                </div>
            </div>
        `;
    }).join("");
}

// --- LOGIC: BOARD ---
class Vertex {
  constructor(id, x, y) {
    this.id = id; this.x = x; this.y = y;
    this.ownerId = null; this.isCity = false; this.hexes = [];
    this.port = null;
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
    this.ports = new Map();
    this.radius = radius;
    this.hexSize = 50;
    this.generateBoard();
    this.generatePorts();
  }

  toJSON() {
    const compactHexes = {};
    const typeNames = Object.keys(HEX_TYPES);
    this.hexes.forEach((h, k) => {
        compactHexes[k] = [typeNames.indexOf(Object.keys(HEX_TYPES).find(nk => HEX_TYPES[nk] === h.terrain)), h.number];
    });
    
    const compactVertices = {};
    this.vertices.forEach((v, k) => {
        if (v.ownerId !== null || v.isCity) {
            compactVertices[k] = [v.ownerId, v.isCity ? 1 : 0];
        }
    });

    const compactEdges = {};
    this.edges.forEach((e, k) => {
        if (e.ownerId !== null) {
            compactEdges[k] = e.ownerId;
        }
    });

    return {
      radius: this.radius,
      hexes: compactHexes,
      vertices: compactVertices,
      edges: compactEdges
    };
  }

  fromJSON(data) {
    this.radius = data.radius;
    this.generateBoard(data.hexes); // Regenerate base board with saved hex data

    if (data.vertices) {
      Object.entries(data.vertices).forEach(([k, [ownerId, isCity]]) => {
        const v = this.vertices.get(k);
        if (v) {
          v.ownerId = ownerId;
          v.isCity = !!isCity;
        }
      });
    }

    if (data.edges) {
      Object.entries(data.edges).forEach(([k, ownerId]) => {
        const e = this.edges.get(k);
        if (e) e.ownerId = ownerId;
      });
    }
  }

  static fromJSON(data) {
    const board = new Board(data.radius);
    board.fromJSON(data);
    return board;
  }

  isVertexInOuterRings(vKey, numRings) {
    const v = this.vertices.get(vKey);
    if (!v) return false;
    // A hex with max(abs(q), abs(r), abs(-q-r)) is in ring R.
    return v.hexes.some(h => {
        const ring = Math.max(Math.abs(h.q), Math.abs(h.r), Math.abs(-h.q - h.r));
        return ring >= (this.radius - numRings + 1);
    });
  }

  getVertexRing(vKey) {
    const v = this.vertices.get(vKey);
    if (!v) return 99;
    let minRing = 99;
    v.hexes.forEach(h => {
        const ring = Math.max(Math.abs(h.q), Math.abs(h.r), Math.abs(-h.q - h.r));
        if (ring < minRing) minRing = ring;
    });
    return minRing;
  }

  generateBoard(compactHexes = null) {
    this.hexes.clear();
    this.vertices.clear();
    this.edges.clear();
    this.ports.clear();

    const allKeys = [];
    for (let q = -this.radius; q <= this.radius; q++) {
      for (let r = Math.max(-this.radius, -q - this.radius); r <= Math.min(this.radius, -q + this.radius); r++) {
        allKeys.push(`${q},${r}`);
      }
    }

    if (compactHexes) {
      const typeKeys = Object.keys(HEX_TYPES);
      allKeys.forEach(key => {
        const [q, r] = key.split(',').map(Number);
        const [tIdx, num] = compactHexes[key];
        this.hexes.set(key, { q, r, terrain: HEX_TYPES[typeKeys[tIdx]], number: num, vertices: [], edges: [] });
      });
    } else {
      // 1. Determine Desert Count based on board size (Radius)
      let numDeserts = 1;
      if (this.radius === 3) numDeserts = 2; // Large
      else if (this.radius === 4) numDeserts = 3; // XL
      else if (this.radius === 5) numDeserts = 5; // Colossal
      else if (this.radius >= 19) numDeserts = 40; // Hell
      else if (this.radius >= 6) numDeserts = 10; // Mega (if ever added)

      // 2. Place Deserts sparsely (not adjacent if possible)
      const desertKeys = [];
      const shuffledKeys = [...allKeys].sort(() => Math.random() - 0.5);
      for (const key of shuffledKeys) {
          if (desertKeys.length >= numDeserts) break;
          const [q, r] = key.split(',').map(Number);
          const neighbors = [
              `${q+1},${r}`, `${q-1},${r}`, `${q},${r+1}`, 
              `${q},${r-1}`, `${q+1},${r-1}`, `${q-1},${r+1}`
          ];
          // Ensure no neighbor is already a desert
          if (!neighbors.some(nk => desertKeys.includes(nk))) {
              desertKeys.push(key);
          }
      }
      // Fallback: If map is too small for sparse deserts (unlikely for our sizes), just take first randoms
      if (desertKeys.length < numDeserts) {
          for (const key of shuffledKeys) {
              if (desertKeys.length >= numDeserts) break;
              if (!desertKeys.includes(key)) desertKeys.push(key);
          }
      }

      // 3. Prepare Terrain and Number pools for other hexes
      const nonDesertKeys = allKeys.filter(k => !desertKeys.includes(k));
      const terrainTypes = Object.values(HEX_TYPES).filter(t => t.name !== 'Water' && t.name !== 'Desert');
      let terrainPool = [];
      for (let i = 0; i < nonDesertKeys.length; i++) {
          terrainPool.push(terrainTypes[i % terrainTypes.length]);
      }
      terrainPool.sort(() => Math.random() - 0.5);

      const possibleNums = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12];
      let numberPool = [];
      for (let i = 0; i < nonDesertKeys.length; i++) {
          numberPool.push(possibleNums[i % possibleNums.length]);
      }
      numberPool.sort(() => Math.random() - 0.5);

      // 4. Assign Hexes
      let tIdx = 0, nIdx = 0;
      allKeys.forEach(key => {
          const [q, r] = key.split(',').map(Number);
          if (desertKeys.includes(key)) {
              this.hexes.set(key, { q, r, terrain: HEX_TYPES.DESERT, number: null, vertices: [], edges: [] });
          } else {
              this.hexes.set(key, { q, r, terrain: terrainPool[tIdx++], number: numberPool[nIdx++], vertices: [], edges: [] });
          }
      });
    }

    // 5. Build Vertices and Edges
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

    this.generatePorts();
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

  generatePorts() {
    this.ports = new Map();
    const edgeToHexes = new Map();
    this.hexes.forEach(h => {
        h.edges.forEach(eId => {
            if (!edgeToHexes.has(eId)) edgeToHexes.set(eId, []);
            edgeToHexes.get(eId).push(h);
        });
    });

    const coastlineEdges = Array.from(this.edges.values()).filter(e => {
        const hs = edgeToHexes.get(e.id);
        return hs && hs.length === 1;
    });
    
    coastlineEdges.sort((a,b) => {
        const v1a = this.getVertex(a.v1), v2a = this.getVertex(a.v2);
        const v1b = this.getVertex(b.v1), v2b = this.getVertex(b.v2);
        return Math.atan2((v1a.y + v2a.y), (v1a.x + v2a.x)) - Math.atan2((v1b.y + v2b.y), (v1b.x + v2b.x));
    });

    const portTypes = ['ALL', 'WOOD', 'ALL', 'BRICK', 'ALL', 'SHEEP', 'ALL', 'WHEAT', 'ALL', 'ORE'];
    for (let i = 0; i < coastlineEdges.length; i += 4) {
        const e = coastlineEdges[i];
        if (!e) continue;
        const type = portTypes[(i/4) % portTypes.length];
        const port = { id: `port_${i}`, type, v1: e.v1, v2: e.v2 };
        this.ports.set(port.id, port);
        this.getVertex(e.v1).port = port;
        this.getVertex(e.v2).port = port;
    }
  }
}

// --- LOGIC: PLAYER ---
class Player {
  constructor(id, name, color, isBot = false) {
    this.id = id; this.name = name; this.color = color; this.isBot = isBot;
    this.resources = { WOOD: 0, BRICK: 0, SHEEP: 0, WHEAT: 0, ORE: 0 };
    this.settlements = []; this.cities = []; this.roads = []; 
    this.victoryPoints = 0; this.visibleVP = 0;
    this.waitingForSettlement = false; // Memory for AI to save resources
    this.devCards = []; // Owned but unplayed cards (except VP)
    this.playedKnights = 0;
    this.newDevCardThisTurnIdx = -1; // Prevent playing a card on the same turn it was bought
    this.isEliminated = false;

    // --- Statistics for Vault ---
    this.totalSettlementsBuilt = 0;
    this.totalCitiesBuilt = 0;
    this.totalRoadsBuilt = 0;
    this.totalDevCardsUsed = 0;
  }

  toJSON() {
    return {
      id: this.id, name: this.name, color: this.color,
      resources: this.resources,
      settlements: this.settlements, cities: this.cities, roads: this.roads,
      totalSettlementsBuilt: this.totalSettlementsBuilt || 0,
      totalCitiesBuilt: this.totalCitiesBuilt || 0,
      totalRoadsBuilt: this.totalRoadsBuilt || 0,
      totalDevCardsUsed: this.totalDevCardsUsed || 0,
      victoryPoints: this.victoryPoints, visibleVP: this.visibleVP,
      playedKnights: this.playedKnights,
      isEliminated: !!this.isEliminated,
      devCards: this.devCards.map(c => ({ t: c.type, b: c.boughtTurn })),
      newDevCardThisTurnIdx: this.newDevCardThisTurnIdx,
      waitingForSettlement: this.waitingForSettlement
    };
  }

  fromJSON(data) {
    const oldIsBot = this.isBot;
    Object.assign(this, data);
    
    // Ensure stats are handled
    this.totalSettlementsBuilt = data.totalSettlementsBuilt || 0;
    this.totalCitiesBuilt = data.totalCitiesBuilt || 0;
    this.totalRoadsBuilt = data.totalRoadsBuilt || 0;
    this.totalDevCardsUsed = data.totalDevCardsUsed || 0;

    if (data.devCards) {
        this.devCards = data.devCards.map(c => ({
            type: c.t,
            boughtTurn: c.b,
            ...DEV_CARD_TYPES[c.t]
        }));
    }

    if (gameSync.isHost) {
        // Host restores bot state locally based on name prefix (AI/Bot)
        // If a human guest replaces a bot, their name won't match, so isBot becomes false.
        this.isBot = (this.name && (this.name.startsWith("AI ") || this.name.startsWith("Bot "))) ? true : false;
        // If it was already a bot and name didn't change, we keep it true.
    } else {
        // Guests treat everyone as human.
        this.isBot = false;
    }
  }

  static fromJSON(data) {
    const p = new Player(data.id, data.name, data.color, data.isBot);
    p.fromJSON(data);
    return p;
  }

  canAfford(cost) { return Object.entries(cost).every(([res, amt]) => (this.resources[res] || 0) >= amt); }
  hasResources(map) { return Object.entries(map).every(([res, amt]) => (this.resources[res] || 0) >= amt); }
  spend(cost) { Object.entries(cost).forEach(([res, amt]) => this.resources[res] -= amt); }
  receive(res, amt = 1) { if (this.resources[res] !== undefined) this.resources[res] += amt; }
  calculateVP(longestRoadHolderId, largestArmyHolderId) { 
    const vpCardsCount = this.devCards.filter(c => c.type === 'VP').length;
    this.visibleVP = this.settlements.length + (this.cities.length * 2); 
    if (longestRoadHolderId !== null && longestRoadHolderId !== undefined && longestRoadHolderId === this.id) this.visibleVP += 2;
    if (largestArmyHolderId !== null && largestArmyHolderId !== undefined && largestArmyHolderId === this.id) this.visibleVP += 2;
    this.victoryPoints = this.visibleVP + vpCardsCount;
    return this.victoryPoints; 
  }
}

// --- LOGIC: RULES ---
class Rules {
  static canPlaceSettlement(board, vKey, player, phase, gameMode = 'Standard') {
    const v = board.getVertex(vKey);
    if (!v || v.ownerId !== null) return false;
    
    // Battle Royale: Initial placements restricted to outer 4 rings
    if (gameMode === 'Battle Royale' && phase === 'INITIAL') {
        if (!board.isVertexInOuterRings(vKey, 4)) return false;
    }

    const adjE = board.getEdgesOfVertex(vKey);
    if (adjE.some(e => {
        const otherV = (e.v1 === vKey) ? e.v2 : e.v1;
        return board.getVertex(otherV).ownerId !== null;
    })) return false;
    return phase === 'INITIAL' ? true : adjE.some(e => e.ownerId === player.id);
  }
  static canPlaceRoad(board, eKey, player, phase, gameMode = 'Standard') {
    const e = board.getEdge(eKey);
    if (!e || e.ownerId !== null) return false;

    // Battle Royale: Initial roads restricted to outer rings too
    if (gameMode === 'Battle Royale' && phase === 'INITIAL') {
        if (!board.isVertexInOuterRings(e.v1, 4) && !board.isVertexInOuterRings(e.v2, 4)) return false;
    }

    if (board.getVertex(e.v1).ownerId === player.id || board.getVertex(e.v2).ownerId === player.id) return true;
    return board.getEdgesOfVertex(e.v1).some(oe => oe.ownerId === player.id) || board.getEdgesOfVertex(e.v2).some(oe => oe.ownerId === player.id);
  }
}

// --- LOGIC: GAMESTATE ---
class GameState {
  constructor(board, players, targetScore = 10, friendlyRobber = false, aiDifficulty = 'Normal', multiRobber = false, gameMode = 'Standard', expansionInterval = '2', desertNewChance = 0.1, desertDecayChance = 0.2, brShrinkInterval = 3, brGraceRotations = 5, brDiscardLimit = 16) {
    this.board = board; this.players = players; this.currentPlayerIdx = 0;
    this.targetScore = targetScore; this.friendlyRobber = friendlyRobber;
    this.aiDifficulty = aiDifficulty;
    this.multiRobber = multiRobber;
    this.gameMode = gameMode;
    this.expansionInterval = expansionInterval;
    this.desertNewChance = desertNewChance;
    this.desertDecayChance = desertDecayChance;
    this.brShrinkInterval = brShrinkInterval;
    this.brGraceRotations = brGraceRotations;
    this.brDiscardLimit = brDiscardLimit;
    this.nextExpansionRotations = 0; // Will be set after first rotation or game start
    this.maxRadiusCycles = 0; // Tracks cycles after hitting radius 25
    this.phase = 'INITIAL'; this.dice = [1, 1]; this.history = [];
    this.initialPlacements = 0; this.winner = null; this.hasRolled = false;
    this.pendingSettlement = null; this.movingRobber = false;
    this.selectedRobberIdx = null; // Used for multi-robber phase
    this.waitingToPickVictim = false;
    this.longestRoadHolderId = null;
    this.longestRoadLength = 4; 
    
    const desertHexes = Array.from(board.hexes.keys()).filter(k => board.hexes.get(k).terrain === HEX_TYPES.DESERT);
    if (this.multiRobber) {
        this.robberHexIds = [...desertHexes];
    } else {
        this.robberHexIds = [desertHexes[Math.floor(Math.random() * desertHexes.length)]];
    }
    
    this.diceAnim = { value: [1, 1], timer: 0 };
    this.activeTrade = null;
    this.tradeTimer = null;
    this.turnToken = 0;
    this.gameId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    this.rotations = 0;
    this.totalTurns = 0;
    this.turnsInRotation = 0;
    this.waitingForDiscards = []; // Array of ids who must discard
    this.aiTradeAttempts = 0; // Track AI trade attempts per turn
    this.playedDevCardThisTurn = false;
    this.pendingRoads = 0;
    this.started = false;
    this.effects = []; // Animation effects queue (e.g. pulse for destroyed buildings)

    // Track desert percentage history for victory graph
    this.desertHistory = [];
    if (this.gameMode === 'Expanding Board (Experimental)') {
        const hexes = Array.from(this.board.hexes.values());
        const desertCount = hexes.filter(h => h.terrain === HEX_TYPES.DESERT).length;
        this.desertHistory.push(Math.round((desertCount / hexes.length) * 100));
    }

    if (this.gameMode === 'Expanding Board (Experimental)') {
        this.nextExpansionRotations = this.calculateNextExpansion();
    }
    
    // Bank Resources initialization
    // Standard (4p): 19, Large (6p): 24, XL (8p): 30, Colossal (10p): 36, Hell: 200
    let resCount = 19;
    if (this.board.radius >= 19) resCount = 200;
    else if (this.players.length > 8) resCount = 36;
    else if (this.players.length > 6) resCount = 30;
    else if (this.players.length > 4) resCount = 24;
    this.bankResources = { WOOD: resCount, BRICK: resCount, SHEEP: resCount, WHEAT: resCount, ORE: resCount };

    // Development Cards Deck
    this.devCardDeck = [];
    const pCount = this.players.length;
    let knightCount = 14;
    let progressCount = 2;
    let vpCount = 5;

    if (this.board.radius >= 19) { knightCount = 100; progressCount = 15; vpCount = 20; }
    else if (pCount > 8) { knightCount = 32; progressCount = 5; }
    else if (pCount > 6) { knightCount = 26; progressCount = 4; }
    else if (pCount > 4) { knightCount = 20; progressCount = 3; }

    for (let i = 0; i < knightCount; i++) this.devCardDeck.push({ type: 'KNIGHT', ...DEV_CARD_TYPES.KNIGHT });
    for (let i = 0; i < progressCount; i++) {
        this.devCardDeck.push({ type: 'ROAD_BUILDING', ...DEV_CARD_TYPES.ROAD_BUILDING });
        
        const yopCard = { type: 'YEAR_OF_PLENTY', ...DEV_CARD_TYPES.YEAR_OF_PLENTY };
        if (i >= 2) yopCard.name = 'Invention'; // Expansion version of Year of Plenty
        this.devCardDeck.push(yopCard);
        
        this.devCardDeck.push({ type: 'MONOPOLY', ...DEV_CARD_TYPES.MONOPOLY });
    }
    for (let i = 0; i < vpCount; i++) this.devCardDeck.push({ type: 'VP', ...DEV_CARD_TYPES.VP });
    this.devCardDeck.sort(() => Math.random() - 0.5);

    this.largestArmyHolderId = null;
    this.largestArmySize = 2; // Need 3 to take it
    
    this.log(`Initial Phase: Goal is ${targetScore} Points (${aiDifficulty} AI)`);
    if (this.gameMode === 'Expanding Board (Experimental)') {
        this.log(`Mode: Expanding Board (Every ${this.expansionInterval === 'Random' ? 'Random' : this.expansionInterval} rotations)`);
    }
  }

  calculateNextExpansion() {
      // If expansion interval is set to Random, pick a number between 1 and 4 
      // (leaning towards 2-3 to keep it playable but surprising)
      if (this.expansionInterval === 'Random') {
          const weights = [1, 2, 2, 3, 3, 4]; // Every 1 to 4 rotations
          return this.rotations + weights[Math.floor(Math.random() * weights.length)];
      }
      return this.rotations + parseInt(this.expansionInterval);
  }

  toJSON() {
    return {
      board: this.board.toJSON(),
      players: this.players.map(p => p.toJSON()),
      currentPlayerIdx: (this.currentPlayerIdx === undefined) ? null : this.currentPlayerIdx,
      phase: (this.phase === undefined) ? 'INITIAL' : this.phase,
      turnToken: (this.turnToken === undefined) ? 0 : this.turnToken,
      rotations: this.rotations || 0,
      turnsInRotation: this.turnsInRotation || 0,
      hasRolled: !!this.hasRolled,
      dice: this.dice || [1, 1],
      robberHexIds: (this.robberHexIds === undefined) ? [] : this.robberHexIds,
      multiRobber: !!this.multiRobber,
      gameMode: this.gameMode || 'Standard',
      expansionInterval: this.expansionInterval || '2',
      desertNewChance: this.desertNewChance || 0,
      desertDecayChance: this.desertDecayChance || 0,
      brShrinkInterval: this.brShrinkInterval || 3,
      brGraceRotations: this.brGraceRotations || 5,
      brDiscardLimit: this.brDiscardLimit || 16,
      nextExpansionInterval: this.nextExpansionInterval || 0,
      maxRadiusCycles: this.maxRadiusCycles || 0,
      nextExpansionRotations: this.nextExpansionRotations || 0,
      selectedRobberIdx: (this.selectedRobberIdx === undefined) ? null : this.selectedRobberIdx,
      movingRobber: !!this.movingRobber,
      waitingToPickVictim: !!this.waitingToPickVictim,
      waitingForDiscards: this.waitingForDiscards || [],
      playedDevCardThisTurn: !!this.playedDevCardThisTurn,
      history: (this.history || []).slice(-50), // Only keep last 50 log entries
      winner: (this.winner === undefined) ? null : this.winner,
      bankResources: this.bankResources || {},
      devCardDeck: (this.devCardDeck || []).map(c => c.type), // Only store types
      largestArmyHolderId: (this.largestArmyHolderId === undefined) ? null : this.largestArmyHolderId,
      largestArmySize: this.largestArmySize,
      longestRoadHolderId: (this.longestRoadHolderId === undefined) ? null : this.longestRoadHolderId,
      longestRoadLength: this.longestRoadLength,
      activeTrade: (this.activeTrade === undefined) ? null : this.activeTrade,
      aiTradeAttempts: (this.aiTradeAttempts === undefined) ? 0 : this.aiTradeAttempts,
      pendingRoads: (this.pendingRoads === undefined) ? 0 : this.pendingRoads,
      pendingSettlement: (this.pendingSettlement === undefined) ? null : this.pendingSettlement,
      initialPlacements: (this.initialPlacements === undefined) ? 0 : this.initialPlacements,
      targetScore: (this.targetScore === undefined) ? 10 : this.targetScore,
      friendlyRobber: !!this.friendlyRobber,
      aiDifficulty: this.aiDifficulty || 'Normal',
      desertHistory: this.desertHistory || [],
      started: !!this.started
    };
  }

  fromJSON(data) {
    const oldIdx = this.currentPlayerIdx;
    const oldToken = this.turnToken;

    this.board.fromJSON(data.board);
    data.players.forEach((pData, idx) => {
        if (!this.players[idx]) {
            this.players[idx] = Player.fromJSON(pData);
        }
        const wasBot = this.players[idx].isBot;
        this.players[idx].fromJSON(pData);
        // If a human became a bot (via abandonment), the host should now drive their turn
        if (!wasBot && this.players[idx].isBot && gameSync.isHost) {
            if (this.waitingForDiscards.includes(idx)) {
                const totalRes = Object.values(this.players[idx].resources).reduce((a, b) => a + b, 0);
                setTimeout(() => this.aiDiscard(idx, Math.max(1, Math.ceil(totalRes / 2))), 1000);
            } else if (this.currentPlayerIdx === idx) {
                const token = this.turnToken;
                if (this.phase === 'INITIAL') {
                    setTimeout(() => { if (token === this.turnToken) this.aiInitial(); }, 1000);
                } else if (!this.winner) {
                    setTimeout(() => { if (token === this.turnToken) this.aiTurn(); }, 1000);
                }
            }
        }
    });
    // Copy other fields
    Object.keys(data).forEach(key => {
        if (key !== 'board' && key !== 'players' && typeof data[key] !== 'function') {
            this[key] = data[key];
        }
    });

    // Expand devCardDeck from types
    if (data.devCardDeck) {
        this.devCardDeck = data.devCardDeck.map(type => ({
            type: type,
            ...DEV_CARD_TYPES[type]
        }));
    }

    // WAKE UP AI: If turn changed to a bot and we are the host, trigger AI logic
    if (gameSync.isHost && (this.currentPlayerIdx !== oldIdx || this.turnToken !== oldToken)) {
        if (this.currentPlayer.isBot && !this.winner) {
            const token = this.turnToken;
            if (this.phase === 'INITIAL') {
                setTimeout(() => { if (token === this.turnToken) this.aiInitial(); }, 1000);
            } else {
                setTimeout(() => { if (token === this.turnToken) this.aiTurn(); }, 1000);
            }
        }
    }
  }

  static fromJSON(data) {
    const board = Board.fromJSON(data.board);
    const players = data.players.map(pData => Player.fromJSON(pData));
    const gs = new GameState(board, players, data.targetScore, data.friendlyRobber, data.aiDifficulty, data.multiRobber, data.gameMode, data.expansionInterval || '2', data.desertNewChance || 0, data.desertDecayChance || 0, data.brShrinkInterval || 3, data.brGraceRotations || 5, data.brDiscardLimit || 16);
    gs.fromJSON(data);
    return gs;
  }

  buyDevCard(p) {
    if (!p.canAfford(COSTS.DEV_CARD) || this.devCardDeck.length === 0) return false;
    this.returnResources(p, COSTS.DEV_CARD);
    const card = this.devCardDeck.pop();
    card.boughtTurn = this.turnToken;
    p.devCards.push(card);
    this.log(`${p.name} bought a Development Card`);
    return true;
  }

  playDevCard(p, idx) {
    if (this.playedDevCardThisTurn) return false;
    const card = p.devCards[idx];
    if (card.type === 'VP') return false; 
    if (card.boughtTurn >= this.turnToken) return false;

    this.playedDevCardThisTurn = true;
    p.devCards.splice(idx, 1);
    p.totalDevCardsUsed++;
    this.log(`${p.name} played a ${card.name} card`);

    switch (card.type) {
      case 'KNIGHT':
        p.playedKnights++;
        this.startRobberPhase();
        this.updateLargestArmy();
        break;
      case 'ROAD_BUILDING':
        this.pendingRoads = 2;
        this.log(`${p.name} can place 2 free roads!`);
        break;
      case 'YEAR_OF_PLENTY':
        if (p.isBot) {
           const resources = ['WOOD', 'BRICK', 'SHEEP', 'WHEAT', 'ORE'].filter(r => this.bankResources[r] > 0);
           for (let i = 0; i < 2; i++) {
             if (resources.length > 0) {
               const r = resources[Math.floor(Math.random() * resources.length)];
               this.giveResources(p, r, 1);
             }
           }
        } else {
           this.showYearOfPlentyMenu();
        }
        break;
      case 'MONOPOLY':
        if (p.isBot) {
           const res = ['WOOD', 'BRICK', 'SHEEP', 'WHEAT', 'ORE'][Math.floor(Math.random() * 5)];
           this.monopolyResource(p, res);
        } else {
           this.showMonopolyMenu();
        }
        break;
    }
    return true;
  }

  updateLargestArmy() {
    let changed = false;
    this.players.forEach(p => {
      if (p.playedKnights > this.largestArmySize) {
        this.largestArmySize = p.playedKnights;
        if (this.largestArmyHolderId !== p.id) {
            this.largestArmyHolderId = p.id;
            this.log(`${p.name} is now the Largest Army Holder!`);
            changed = true;
        }
      }
    });
    if (changed) {
        this.players.forEach(p => p.calculateVP(this.longestRoadHolderId, this.largestArmyHolderId));
        this.checkWinner();
    }
  }

  monopolyResource(p, res) {
    let totalTaken = 0;
    this.players.forEach(other => {
      if (other.id !== p.id) {
        const amt = other.resources[res] || 0;
        if (amt > 0) {
          other.resources[res] -= amt;
          p.resources[res] += amt;
          totalTaken += amt;
        }
      }
    });
    this.log(`${p.name} took all ${totalTaken} ${res} via Monopoly!`);
  }

  showYearOfPlentyMenu() {
    this.openResourcePicker("Pick 1st Resource", (res1) => {
        this.giveResources(this.players[gameSync.localPlayerId], res1, 1);
        setTimeout(() => {
            this.openResourcePicker("Pick 2nd Resource", (res2) => {
                this.giveResources(this.players[gameSync.localPlayerId], res2, 1);
                setupTradeUI();
                setupDevCardUI();
            });
        }, 300);
    });
  }

  showMonopolyMenu() {
    this.openResourcePicker("Pick Resource to Steal", (res) => {
        this.monopolyResource(this.players[gameSync.localPlayerId], res);
        setupTradeUI();
        setupDevCardUI();
    });
  }

  openResourcePicker(title, onPick) {
    document.getElementById('picker-title').innerText = title;
    const controls = document.getElementById('picker-controls');
    controls.innerHTML = '';
    const resources = ['WOOD', 'BRICK', 'SHEEP', 'WHEAT', 'ORE'];
    
    resources.forEach(res => {
        const btn = document.createElement('button');
        btn.innerText = res;
        btn.style.background = '#3498db';
        btn.onclick = (e) => {
            e.stopPropagation();
            resourcePickerPanel.style.display = 'none';
            onPick(res);
        };
        controls.appendChild(btn);
    });

    cancelPickerBtn.onclick = () => {
        resourcePickerPanel.style.display = 'none';
    };

    resourcePickerPanel.style.display = 'flex';
  }

  giveResources(player, res, amt = 1) {
    if (this.bankResources[res] === undefined) return;
    const actual = Math.min(amt, this.bankResources[res]);
    if (actual > 0) {
      player.receive(res, actual);
      this.bankResources[res] -= actual;
    }
    if (actual < amt) {
      this.log(`⚠️ Bank out of ${res}! ${player.name} missed ${amt - actual}`);
    }
  }

  getHexesControlledBy(player) {
    const controlled = [];
    this.board.hexes.forEach((h, id) => {
        const owns = h.vertices.some(vk => this.board.getVertex(vk).ownerId === player.id);
        if (owns) controlled.push(id);
    });
    return controlled;
  }

  returnResources(player, cost) {
    Object.entries(cost).forEach(([res, amt]) => {
      player.resources[res] -= amt;
      this.bankResources[res] += amt;
    });
  }

  get currentPlayer() { return this.players[this.currentPlayerIdx]; }
  log(msg) { 
    this.history.push(msg); 
    if (this.history.length > 50) this.history.shift(); 
  }
  
  nextTurn() {
    this.turnToken++;
    this.totalTurns++;
    
    // Find the next player who isn't eliminated
    const oldIdx = this.currentPlayerIdx;
    let nextIdx = (oldIdx + 1) % this.players.length;
    let attempts = 0;
    while (this.players[nextIdx].isEliminated && attempts < this.players.length) {
        nextIdx = (nextIdx + 1) % this.players.length;
        attempts++;
    }
    this.currentPlayerIdx = nextIdx;
    
    // Board Expansion & Cycle Handling:
    // A rotation has passed if we wrapped around through index 0 (even if P0 is eliminated)
    const passedZero = (this.currentPlayerIdx <= oldIdx);

    if (passedZero) {
        this.rotations++;
        if (this.gameMode === 'Expanding Board (Experimental)' && this.rotations >= this.nextExpansionRotations && this.rotations > 0) {
            this.expandBoard();
            this.nextExpansionRotations = this.calculateNextExpansion();
        }

        // Battle Royale Shrinking
        if (this.gameMode === 'Battle Royale' && this.rotations > parseInt(this.brGraceRotations)) {
            const rotationsInBR = this.rotations - parseInt(this.brGraceRotations);
            if (rotationsInBR % parseInt(this.brShrinkInterval) === 0) {
                this.shrinkBoard();
            }
        }

        // Record desert history trend per rotation for the victory graph
        if (this.gameMode === 'Expanding Board (Experimental)') {
          const hexes = Array.from(this.board.hexes.values());
          const desertCount = hexes.filter(h => h.terrain === HEX_TYPES.DESERT).length;
          const currentPct = Math.round((desertCount / hexes.length) * 100);
          this.desertHistory.push(currentPct);
        }
    }

    this.hasRolled = false;
    this.aiTradeAttempts = 0; // Reset for the next player
    this.playedDevCardThisTurn = false;
    
    // Clear any leftover trades from previous turn
    if (this.activeTrade) this.clearTrade();

    this.players.forEach(p => p.calculateVP(this.longestRoadHolderId, this.largestArmyHolderId));
    
    // Elimination check for Expanding Board or Battle Royale
    if ((this.gameMode === 'Expanding Board (Experimental)' || this.gameMode === 'Battle Royale') && this.phase === 'PLAY') {
        this.checkEliminations();
    }

    this.checkWinner();
    if (this.winner) return;

    this.log(`${this.currentPlayer.name}'s turn`);
    
    // Check if Human trade UI should show
    if (!this.currentPlayer.isBot && typeof setupTradeUI === 'function') {
        setupTradeUI();
    }
    
    // Multiplayer Sync on Turn Change
    if (gameSync.isMultiplayer) gameSync.update(this, true);

    if (this.currentPlayer.isBot && !this.winner) {
      const token = this.turnToken;
      setTimeout(() => { if (token === this.turnToken) this.aiTurn(); }, 1000);
    }
  }

  expandBoard() {
    const MAX_EXPANSION_RADIUS = 25;
    const canExpandByRadius = this.board.radius < MAX_EXPANSION_RADIUS;

    if (canExpandByRadius) {
        this.log("⚠️ THE WORLD IS GROWING! The board has expanded.");
        const oldRadius = this.board.radius;
        
        // 1. Identify "Edge" objects before expansion
        // A coastline vertex has a port or touches only 1 hex or is just generally at the boundary
        const edgeTolerance = 5;
        const maxDist = Math.max(...Array.from(this.board.vertices.values()).map(v => Math.hypot(v.x, v.y)));
        
        const edgePieces = {
            settlements: [],
            cities: [],
            roads: [],
            ports: []
        };

        this.players.forEach(p => {
            p.settlements.forEach(vId => {
                const v = this.board.getVertex(vId);
                if (v && Math.hypot(v.x, v.y) > maxDist - edgeTolerance) edgePieces.settlements.push({ pId: p.id, oldV: v });
            });
            p.cities.forEach(vId => {
                const v = this.board.getVertex(vId);
                if (v && Math.hypot(v.x, v.y) > maxDist - edgeTolerance) edgePieces.cities.push({ pId: p.id, oldV: v });
            });
            p.roads.forEach(eId => {
                const e = this.board.getEdge(eId);
                const v1 = this.board.getVertex(e.v1), v2 = this.board.getVertex(e.v2);
                if (e && Math.hypot(v1.x + v2.x, v1.y + v2.y) / 2 > maxDist - edgeTolerance) edgePieces.roads.push({ pId: p.id, oldE: e });
            });
        });

        // 2. Increase Radius and Add Hexes
        this.board.radius++;
        const newRadius = this.board.radius;
        const terrainTypes = Object.values(HEX_TYPES).filter(t => t.name !== 'Water' && t.name !== 'Desert');
        const possibleNums = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12];
        
        // Random chance for an existing internal hex to wither into a Desert
        // This pushes players towards the expanding edge to find new resources
        if (this.desertDecayChance > 0 && Math.random() < this.desertDecayChance) {
            const hexKeys = Array.from(this.board.hexes.keys());
            const targetKey = hexKeys[Math.floor(Math.random() * hexKeys.length)];
            const targetHex = this.board.hexes.get(targetKey);
            if (targetHex && targetHex.terrain !== HEX_TYPES.DESERT) {
                this.log(`⚠️ DISASTER: The resource hex at ${targetKey} has withered into a desert!`);
                targetHex.terrain = HEX_TYPES.DESERT;
                targetHex.number = null;
                // If multi-robber is enabled, add a new robber to this new desert
                if (this.multiRobber) {
                    this.robberHexIds.push(targetKey);
                }
            }
        }

        for (let q = -newRadius; q <= newRadius; q++) {
            for (let r = Math.max(-newRadius, -q - newRadius); r <= Math.min(newRadius, -q + newRadius); r++) {
                const key = `${q},${r}`;
                if (!this.board.hexes.has(key)) {
                    // Chance for new hexes to be Deserts
                    const isDesert = this.desertNewChance > 0 && Math.random() < this.desertNewChance;
                    if (isDesert) {
                        this.board.hexes.set(key, { q, r, terrain: HEX_TYPES.DESERT, number: null, vertices: [], edges: [] });
                        if (this.multiRobber) {
                            this.robberHexIds.push(key);
                            this.log("Extra Robber spawned on new desert.");
                        }
                    } else {
                        const terrain = terrainTypes[Math.floor(Math.random() * terrainTypes.length)];
                        const number = possibleNums[Math.floor(Math.random() * possibleNums.length)];
                        this.board.hexes.set(key, { q, r, terrain, number, vertices: [], edges: [] });
                    }
                }
            }
        }

        // 3. Re-calculate internal structures
        // Clear and rebuild Maps while preserving reference to hexes (which we just expanded)
        const oldHexes = this.board.hexes;
        this.board.vertices.clear();
        this.board.edges.clear();
        oldHexes.forEach(hex => {
            hex.vertices = []; hex.edges = []; // Reset hex links
            const hexVertices = this.board.getHexVertexPositions(hex.q, hex.r);
            const hexVKeys = [];
            hexVertices.forEach(pos => {
                const vx = Math.round(pos.x * 100) / 100;
                const vy = Math.round(pos.y * 100) / 100;
                const vKey = `${vx},${vy}`;
                if (!this.board.vertices.has(vKey)) {
                    this.board.vertices.set(vKey, new Vertex(vKey, vx, vy));
                }
                const v = this.board.vertices.get(vKey);
                if (!v.hexes.includes(hex)) v.hexes.push(hex);
                hex.vertices.push(vKey);
                hexVKeys.push(vKey);
            });

            for (let i = 0; i < 6; i++) {
                const v1 = hexVKeys[i], v2 = hexVKeys[(i + 1) % 6];
                const eKey = [v1, v2].sort().join('|');
                if (!this.board.edges.has(eKey)) this.board.edges.set(eKey, new Edge(eKey, v1, v2));
                hex.edges.push(eKey);
            }
        });

        // 4. Restore Internal and Handle Pushed Pieces
        // Current players already have IDs pointing to $(x,y)$.
        // Internal pieces stay exactly where they were by virtue of coordinate consistency.
        // Edge pieces need to be moved to the new maximum distance.
        const scale = (oldRadius + 1) / oldRadius;
        const newVertices = Array.from(this.board.vertices.values());
        const newEdges = Array.from(this.board.edges.values());

        edgePieces.settlements.forEach(s => {
            const nx = s.oldV.x * scale, ny = s.oldV.y * scale;
            let nearest = newVertices[0]; let minDist = Infinity;
            newVertices.forEach(nv => {
                const d = Math.hypot(nv.x - nx, nv.y - ny);
                if (d < minDist) { minDist = d; nearest = nv; }
            });
            const p = this.players[s.pId];
            p.settlements = p.settlements.map(id => id === s.oldV.id ? nearest.id : id);
            this.board.getVertex(nearest.id).ownerId = s.pId;
        });

        edgePieces.cities.forEach(c => {
            const nx = c.oldV.x * scale, ny = c.oldV.y * scale;
            let nearest = newVertices[0]; let minDist = Infinity;
            newVertices.forEach(nv => {
                const d = Math.hypot(nv.x - nx, nv.y - ny);
                if (d < minDist) { minDist = d; nearest = nv; }
            });
            const p = this.players[c.pId];
            p.cities = p.cities.map(id => id === c.oldV.id ? nearest.id : id);
            const v = this.board.getVertex(nearest.id);
            v.ownerId = c.pId; v.isCity = true;
        });

        edgePieces.roads.forEach(r => {
            const v1 = this.board.getVertex(r.oldE.v1), v2 = this.board.getVertex(r.oldE.v2);
            const midXR = (v1.x + v2.x) / 2, midYR = (v1.y + v2.y) / 2;
            const nx = midXR * scale, ny = midYR * scale;
            let nearest = newEdges[0]; let minDist = Infinity;
            newEdges.forEach(ne => {
                const nv1 = this.board.getVertex(ne.v1), nv2 = this.board.getVertex(ne.v2);
                const midX = (nv1.x + nv2.x) / 2, midY = (nv1.y + nv2.y) / 2;
                const d = Math.hypot(midX - nx, midY - ny);
                if (d < minDist) { minDist = d; nearest = ne; }
            });
            const p = this.players[r.pId];
            p.roads = p.roads.map(id => id === r.oldE.id ? nearest.id : id);
            nearest.ownerId = r.pId;
        });
    } else {
        // Radius limit reached, we ONLY apply the wither/decay logic, but faster
        // AND getting more hostile over time
        this.maxRadiusCycles++;
        
        // Probability increases by 10% each cycle after reaching max size, capped at 100%
        const bonusProb = this.maxRadiusCycles * 0.1;
        const currentDecayChance = Math.min(1.0, (this.desertDecayChance * 2) + bonusProb);
        
        // Number of attempts also increases over time (starts at 3, +1 every 2 cycles)
        const deathSpeed = 3 + Math.floor(this.maxRadiusCycles / 2);

        if (this.maxRadiusCycles % 3 === 0) {
            this.log(`💀 THE SPREAD ACCELERATES: The wasteland continues to grow...`);
        }

        for (let i = 0; i < deathSpeed; i++) {
            if (this.desertDecayChance > 0 && Math.random() < currentDecayChance) {
                const hexKeys = Array.from(this.board.hexes.keys());
                const targetKey = hexKeys[Math.floor(Math.random() * hexKeys.length)];
                const targetHex = this.board.hexes.get(targetKey);
                if (targetHex && targetHex.terrain !== HEX_TYPES.DESERT) {
                    this.log(`⚠️ DISASTER: THE WORLD IS DYING! The hex at ${targetKey} has withered into a desert!`);
                    targetHex.terrain = HEX_TYPES.DESERT;
                    targetHex.number = null;
                    if (this.multiRobber) {
                        this.robberHexIds.push(targetKey);
                    }
                }
            }
        }
    }

    // 5. Place pieces that were internal
    this.players.forEach(p => {
        p.settlements.forEach(vId => { 
            const v = this.board.getVertex(vId);
            if (v) v.ownerId = p.id;
        });
        p.cities.forEach(vId => { 
            const v = this.board.getVertex(vId);
            if (v) { v.ownerId = p.id; v.isCity = true; }
        });
        p.roads.forEach(eId => { 
            const e = this.board.getEdge(eId);
            if (e) e.ownerId = p.id;
        });
    });

    this.board.generatePorts();
    if (gameSync.isMultiplayer && gameSync.isHost) gameSync.update(this, true);
  }

  shrinkBoard() {
    if (this.board.radius <= 2) return;
    this.board.radius--;
    this.log(`⚠️ THE CIRCLE IS SHRINKING! New radius: ${this.board.radius}`);

    const newRadius = this.board.radius;
    const removedHexKeys = [];
    this.board.hexes.forEach((h, k) => {
        const ring = Math.max(Math.abs(h.q), Math.abs(h.r), Math.abs(-h.q - h.r));
        if (ring > newRadius) {
            removedHexKeys.push(k);
        }
    });

    const oldRobberCount = this.robberHexIds.length;

    // 1. Remove hexes
    removedHexKeys.forEach(k => {
        const h = this.board.hexes.get(k);
        // Clean up robber
        this.robberHexIds = this.robberHexIds.filter(id => id !== k);
        this.board.hexes.delete(k);
    });

    // Ensure all robbers that were on deleted tiles move back onto the board
    const robbersToRelocate = oldRobberCount - this.robberHexIds.length;
    if (robbersToRelocate > 0) {
        this.log(`⚠️ ${robbersToRelocate} robber(s) were forced to relocate as the world shrank.`);
        
        // Find safe hexes: Deserts first, then any hex that doesn't currently have a robber
        const remainingKeys = Array.from(this.board.hexes.keys());
        const remainingDeserts = remainingKeys.filter(k => this.board.hexes.get(k).terrain === HEX_TYPES.DESERT);

        for (let i = 0; i < robbersToRelocate; i++) {
            // Find a spot that doesn't already have one of our remaining robbers
            const spots = (remainingDeserts.length > 0 ? remainingDeserts : remainingKeys)
                .filter(k => !this.robberHexIds.includes(k));
            
            if (spots.length > 0) {
                const pick = spots[Math.floor(Math.random() * spots.length)];
                this.robberHexIds.push(pick);
            } else {
                // If every single hex is already blocked by a robber (possible in end-game Multi-Robber),
                // this specific robber is simply removed from the game.
                this.log("⚠️ A robber has vanished into the shrinking void!");
            }
        }
    }

    if (newRadius <= 2) {
        this.log(`🔥 THE BOARD HAS FULLY SHRUNK! Final circle reached!`);
    }

    // 2. Clear vertices and edges and rebuild based on remaining hexes
    // A vertex survives if any of its hexes survive.
    this.board.vertices.forEach((v, k) => {
        v.hexes = v.hexes.filter(h => this.board.hexes.has(`${h.q},${h.r}`));
        if (v.hexes.length === 0) {
            // Vertex is gone. Check for building destruction.
            this.players.forEach(p => {
                if (p.settlements.includes(k) || p.cities.includes(k)) {
                    // Add destruction pulse effect
                    this.effects.push({
                        type: 'pulse',
                        x: v.x,
                        y: v.y,
                        color: p.color,
                        life: 60,
                        maxLife: 60
                    });
                }
                p.settlements = p.settlements.filter(s => s !== k);
                p.cities = p.cities.filter(c => c !== k);
            });
            this.board.vertices.delete(k);
        }
    });

    this.board.edges.forEach((e, k) => {
        if (!this.board.vertices.has(e.v1) || !this.board.vertices.has(e.v2)) {
            // Edge coordinate is gone. Check for road destruction
            this.players.forEach(p => {
                if (p.roads.includes(k)) {
                    // Pulse at center of edge
                    const v1 = this.board.getVertex(e.v1);
                    const v2 = this.board.getVertex(e.v2);
                    if (v1 && v2) {
                        this.effects.push({
                            type: 'pulse',
                            x: (v1.x + v2.x) / 2,
                            y: (v1.y + v2.y) / 2,
                            color: p.color,
                            life: 40,
                            maxLife: 40
                        });
                    }
                }
                p.roads = p.roads.filter(id => id !== k);
            });
            this.board.edges.delete(k);
        } else {
          // Check if it's still linked to any remaining hexes
          const hs1 = Array.from(this.board.hexes.values()).filter(h => h.edges.includes(k));
          if (hs1.length === 0) {
            this.players.forEach(p => { p.roads = p.roads.filter(id => id !== k); });
            this.board.edges.delete(k);
          }
        }
    });

    // Re-generate ports based on new coastline
    this.board.generatePorts();
    
    // Final check for eliminations
    this.checkEliminations();

    if (gameSync.isMultiplayer && gameSync.isHost) gameSync.update(this, true);
  }

  aiTurn() {
    if (gameSync.isMultiplayer && !gameSync.isHost) return;
    if (this.winner || !this.currentPlayer.isBot || this.hasRolled) return;
    this.rollDice();
    if (gameSync.isMultiplayer && gameSync.isHost) gameSync.update(this, true);
    
    // Check if we need to discard or move robber (rollDice handles it, but we might need to wait)
    let delay = 1500;
    if (this.dice[0] + this.dice[1] === 7) delay = 3500; // Longer delay for robber movement/discarding

    const token = this.turnToken;
    setTimeout(() => { if (token === this.turnToken) this.aiContinueTurn(); }, delay);
  }

  aiContinueTurn() {
    if (gameSync.isMultiplayer && !gameSync.isHost) return;
    // Basic turn safety
    if (this.winner || !this.currentPlayer.isBot || this.phase !== 'PLAY') return;

    // Wait if we are still resolving a 7-roll (discards or robber movement)
    if (this.waitingForDiscards.length > 0 || this.movingRobber || this.waitingToPickVictim) {
        const token = this.turnToken;
        setTimeout(() => { if (token === this.turnToken) this.aiContinueTurn(); }, 1000);
        return;
    }

    this.aiPlay();
    
    // Check if we just proposed a trade to a human player
    const isWaitingOnHumanTrade = this.activeTrade && !this.players[this.activeTrade.targetId].isBot;

    if (!isWaitingOnHumanTrade && !this.waitingToPickVictim && !this.movingRobber) {
        // End turn after small delay
        const token = this.turnToken;
        setTimeout(() => { 
            if (token === this.turnToken) {
                this.nextTurn(); 
                if (gameSync.isMultiplayer && gameSync.isHost) gameSync.update(this, true);
            }
        }, 1000);
    }
    // Sync intermediate state (e.g. after building)
    if (gameSync.isMultiplayer && gameSync.isHost) gameSync.update(this);
  }

  aiPlayDevCards() {
    const p = this.currentPlayer;
    if (this.playedDevCardThisTurn || p.devCards.length === 0) return;

    // AI strategy for playing cards
    const knight = p.devCards.find(c => c.type === 'KNIGHT' && c.boughtTurn < this.turnToken);
    if (knight) {
        // Play knight if someone is blocking a good tile
        const ourHexes = Array.from(this.board.hexes.keys()).filter(id => {
            const h = this.board.hexes.get(id);
            return h.vertices.some(vk => this.board.getVertex(vk).ownerId === p.id);
        });
        if (ourHexes.some(id => this.robberHexIds.includes(id))) {
            this.playDevCard(p, p.devCards.indexOf(knight));
            return;
        }
        // Or if we are close to largest army and someone else has it
        if (this.largestArmyHolderId !== p.id && p.playedKnights >= this.largestArmySize - 1) {
            this.playDevCard(p, p.devCards.indexOf(knight));
            return;
        }
    }

    const roadBuilding = p.devCards.find(c => c.type === 'ROAD_BUILDING' && c.boughtTurn < this.turnToken);
    if (roadBuilding) {
        // Play if we have a spot to build a settlement but need 2 roads to reach it
        const allEdges = Array.from(this.board.edges.keys()).filter(e => Rules.canPlaceRoad(this.board, e, p, this.phase, this.gameMode));
        if (allEdges.length > 0) {
            this.playDevCard(p, p.devCards.indexOf(roadBuilding));
            return;
        }
    }

    const yearOfPlenty = p.devCards.find(c => c.type === 'YEAR_OF_PLENTY' && c.boughtTurn < this.turnToken);
    if (yearOfPlenty) {
        // Play if we are missing exactly 1 or 2 resources for a settlement or city
        const neededForSettle = (p.resources.WOOD < 1 ? 1 : 0) + (p.resources.BRICK < 1 ? 1 : 0) + (p.resources.SHEEP < 1 ? 1 : 0) + (p.resources.WHEAT < 1 ? 1 : 0);
        if (neededForSettle <= 2 && neededForSettle > 0) {
            this.playDevCard(p, p.devCards.indexOf(yearOfPlenty));
            return;
        }
    }

    const monopoly = p.devCards.find(c => c.type === 'MONOPOLY' && c.boughtTurn < this.turnToken);
    if (monopoly) {
        // Play if we know other players have a lot of one resource (aggregated count check)
        const resources = ['WOOD', 'BRICK', 'SHEEP', 'WHEAT', 'ORE'];
        resources.forEach(r => {
            let total = 0;
            this.players.forEach(other => { if(other.id !== p.id) total += other.resources[r]; });
            if (total >= 4) {
                 this.playDevCard(p, p.devCards.indexOf(monopoly));
                 return;
            }
        });
    }
  }

  getVertexValue(vKey) {
    const v = this.board.getVertex(vKey);
    let value = 0;
    v.hexes.forEach(h => {
        if (h.number) {
            // Standard Catan number probability: 6/8 are best, 2/12 are worst
            const dots = 6 - Math.abs(7 - h.number);
            value += dots;
        }
    });
    // Boost value for ports to encourage expansion/trading in PLAY phase
    // Discourage starting on a port in INITIAL phase unless tiles are amazing
    if (v.port && this.aiDifficulty !== 'Beginner') {
        value += (this.phase === 'INITIAL') ? -1.5 : 1.5;
    }
    
    // Expanding Board: Strongly boost preference for edge/coastline tiles to ensure growth
    if (this.gameMode === 'Expanding Board (Experimental)' && this.aiDifficulty !== 'Beginner') {
        const dist = Math.hypot(v.x, v.y);
        const maxDist = (this.board.radius + 1) * 1.5 * (this.board.hexSize || 50);
        // Extreme preference for expanding - bots will "race" to the edge
        value += (dist / maxDist) * 7.5; 
    }

    // Battle Royale: Strategy for survival
    if (this.gameMode === 'Battle Royale' && this.aiDifficulty !== 'Beginner') {
        const ring = this.board.getVertexRing(vKey);
        
        if (this.phase === 'INITIAL') {
            // Setup phase: Hard restriction to outer 4 rings (+15 preference for inner ring)
            if (ring < this.board.radius - 3) return -100;
            value += (this.board.radius - ring) * 5; 
        } else {
            // Move inwards! The center is the only safe place.
            // Massive bonus for moving towards the center (The Winner's Circle)
            // Using a quadratic formula to create a strong pull that increases as they get closer.
            value += Math.pow(this.board.radius - ring, 2) * 2.0; 

            if (ring <= 2) {
                value += 500; // Extra massive push to actually reach the center rings
            }

            // Hazard Warning: Severe penalty for building near the current world edge
            if (ring >= this.board.radius - 2) {
                value -= 100; // Increased penalty to prevent edge-huggers
            }
        }
    }

    return value;
  }

  aiPlay() {
    const p = this.currentPlayer;
    const diff = this.aiDifficulty;
    let madeAction = true;
    let loops = 0;

    // AI strategy for playing development cards is called at start of play phase
    this.aiPlayDevCards();

    // Beginner skips turn phase early 20% of the time to be more "forgetful"
    // However, they won't skip if they are holding too many resources (fear of robber)
    const initialTotal = Object.values(p.resources).reduce((a, b) => a + b, 0);
    const discardLimit = (this.gameMode === 'Battle Royale' ? this.brDiscardLimit : 7);
    if (diff === 'Beginner' && initialTotal <= discardLimit && Math.random() > 0.8) return;

    while (madeAction && loops < 20) {
        madeAction = false;
        loops++;

        // Don't take actions if we're currently waiting for a trade
        if (this.activeTrade) return;

        const resources = ['WOOD', 'BRICK', 'SHEEP', 'WHEAT', 'ORE'];
        const totalRes = Object.values(p.resources).reduce((a, b) => a + b, 0);
        const overLimit = totalRes > discardLimit;

        // Find what we need most for next build
        const needs = [];
        if (!p.canAfford(COSTS.SETTLEMENT)) {
            if (p.resources.WOOD < 1) needs.push('WOOD');
            if (p.resources.BRICK < 1) needs.push('BRICK');
            if (p.resources.SHEEP < 1) needs.push('SHEEP');
            if (p.resources.WHEAT < 1) needs.push('WHEAT');
        } else if (p.settlements.length > 0 && !p.canAfford(COSTS.CITY)) {
            if (p.resources.ORE < 3) needs.push('ORE');
            if (p.resources.WHEAT < 2) needs.push('WHEAT');
        }

        // If over the resource limit, Skilled/Master bots will also focus on anything they are missing to burn resources
        if (overLimit && diff !== 'Beginner') {
            // Also need Road components if we have high surplus to burn
            if (p.resources.WOOD < 1) needs.push('WOOD');
            if (p.resources.BRICK < 1) needs.push('BRICK');
            
            resources.forEach(r => {
                if (p.resources[r] === 0 && !needs.includes(r)) needs.push(r);
            });
            // If still no needs or just over limit, pick anything that isn't the surplus we might trade
            if (needs.length === 0 || totalRes > (discardLimit + 2)) {
                // Finally, just pick the resources we have the absolute least of
                const sorted = [...resources].sort((a,b) => p.resources[a] - p.resources[b]);
                sorted.forEach(r => { if (!needs.includes(r)) needs.push(r); });
            }
        }

        // 1. PREFER PLAYER TRADING (Up to 3 attempts if we need something)
        if (needs.length > 0 && this.aiTradeAttempts < 3 && diff !== 'Beginner') {
            // Find a need that other players might actually have (simplified)
            const targetNeed = needs.find(n => !p.resources[n] || p.resources[n] < 2);
            if (targetNeed) {
                // If over limit, bot is willing to trade away anything that isn't their primary "need"
                const surplus = resources.find(r => p.resources[r] > (overLimit ? 0 : 1) && !needs.includes(r)); 
                if (surplus) {
                    this.aiTradeAttempts++;
                    const others = this.players.filter(other => other.id !== p.id);
                    // AI picks a target (usually human but maybe others bots if many players)
                    const target = others[Math.floor(Math.random() * others.length)];
                    
                    // 1-for-1 proposal
                    const give = { [surplus]: 1 };
                    const get = { [targetNeed]: 1 };
                    
                    if (this.proposePlayerTrade(target.id, give, get, true)) {
                        // If target is human, return and wait for result
                        if (!target.isBot) {
                            return; // PAUSE AI logic here until trade resolved
                        }
                        // If target is bot, loop will continue once trade resolves (via setTimeout in proposePlayerTrade)
                        // but since loop is sync, we break it for now.
                        madeAction = true;
                        continue; 
                    }
                }
            }
        }

        // 2. BANK TRADING (Only if player trades exhausted or not possible)
        if (!madeAction) {
            for (const from of resources) {
                const trRate = this.getTradeRate(p, from);
                // Standard trade buffer: Master 0, Skilled 2, Beginner 3
                let tradeThreshold = (diff === 'Master') ? trRate : (diff === 'Skilled' ? trRate + 2 : trRate + 3);
                
                // If we have a specific need we are trading for, Skilled bots are slightly more willing to use their buffer
                if (needs.length > 0 && diff !== 'Beginner') {
                   tradeThreshold = Math.max(trRate, tradeThreshold - 1);
                }

                if (p.resources[from] >= tradeThreshold && needs.length > 0) {
                    const validNeed = needs.find(n => n !== from && this.bankResources[n] > 0);
                    if (validNeed) {
                        this.returnResources(p, { [from]: trRate });
                        this.giveResources(p, validNeed, 1);
                        this.log(`${p.name} traded ${trRate} ${from} for 1 ${validNeed}`);
                        madeAction = true;
                        break;
                    }
                }
            }
        }
        if (madeAction) continue;

        // 3. BUILD CITY - Priority for VP and resource boost
        const inExpMode = (this.gameMode === 'Expanding Board (Experimental)');
        const inBRMode = (this.gameMode === 'Battle Royale');
        const canSettleNow = p.canAfford(COSTS.SETTLEMENT) && Array.from(this.board.vertices.keys()).some(v => Rules.canPlaceSettlement(this.board, v, p, this.phase, this.gameMode));
        
        // Battle Royale Holding Pattern: if we are safe, we stay put to save resources for disasters
        const structures = [...p.settlements, ...p.cities];
        const myBestRing = structures.length > 0 ? Math.min(...structures.map(id => this.board.getVertexRing(id))) : 99;
        const isOnEdge = structures.some(id => this.board.getVertexRing(id) >= this.board.radius - 1);
        const alreadySafe = inBRMode && myBestRing <= 2;
        const overHoldLimit = totalRes > (discardLimit + 4);
        const shouldSkipBuilding = alreadySafe && !isOnEdge && !overHoldLimit;

        if (shouldSkipBuilding) {
           // Skip expansion, go straight to dev cards or trade to stay safe/burn extra
        } else {
          if (p.canAfford(COSTS.CITY) && p.settlements.length > 0) {
            // In Expanding/BR mode, bots prioritize Settlements over Cities to claim space or reach the center
            const settleWeight = (inExpMode || inBRMode) ? 0.8 : 0.4;
            if ((inExpMode || inBRMode) && canSettleNow && Math.random() < settleWeight) {
                // Skip city this loop to let the settlement logic below catch it
            } else {
                // Master picks the settlement on highest value tiles
                let bestS = p.settlements[0];
                if (diff === 'Master') {
                    let maxVal = -1;
                    p.settlements.forEach(sid => {
                        const val = this.getVertexValue(sid);
                        if (val > maxVal) { maxVal = val; bestS = sid; }
                    });
                } else {
                    // Beginner/Skilled pick random/first to be less optimal but still active
                    bestS = p.settlements[Math.floor(Math.random() * p.settlements.length)];
                }
                this.build('CITY', bestS);
                p.waitingForSettlement = false;
                madeAction = true;
                continue;
            }
          }

          // 3. BUILD SETTLEMENT
          if (p.canAfford(COSTS.SETTLEMENT)) {
            const allVertices = Array.from(this.board.vertices.keys()).filter(v => Rules.canPlaceSettlement(this.board, v, p, this.phase, this.gameMode));
            
            // In Battle Royale, don't just build a settlement because it's available.
            // If it's too far from the center, we might prefer to save wood/brick for more roads.
            let shouldBuildSettle = allVertices.length > 0;
            if (allVertices.length > 0 && inBRMode && diff !== 'Beginner') {
                const structures = [...p.settlements, ...p.cities];
                const myBestRing = structures.length > 0 ? 
                    Math.min(...structures.map(id => this.board.getVertexRing(id))) : 99;
                const bestSettleRing = Math.min(...allVertices.map(v => this.board.getVertexRing(v)));
                
                // URGENT: If our structures are on the edge, or we only have ONE structure left, 
                // we MUST settle inward immediately to avoid elimination.
                const isOnlyStructure = structures.length <= 1;
                const isOnEdge = structures.some(id => this.board.getVertexRing(id) >= this.board.radius - 1);
                const urgentMigration = (isOnlyStructure || isOnEdge) && bestSettleRing < myBestRing;

                // Only settle if it's much closer to the center than our current best, or if it's in the safe zone (Ring <= 2)
                // or if we have a surplus of resources (overLimit)
                const isSignificantImprovement = bestSettleRing < myBestRing - 4;
                const isSafeZone = bestSettleRing <= 2;
                const alreadySafe = myBestRing <= 2;
                const highResources = overLimit || totalRes > (discardLimit + 4);
                
                // If we are already safe (in center 2 rings) and NOT on the edge,
                // we should stop expanding to save resources, UNLESS we have too many.
                if (alreadySafe && !isOnEdge && !highResources) {
                    shouldBuildSettle = false;
                } else if (!urgentMigration && !isSignificantImprovement && !isSafeZone && !highResources) {
                    shouldBuildSettle = false;
                }
            }

            if (shouldBuildSettle) {
                let bestV;
                if (diff === 'Master') {
                    bestV = allVertices.reduce((max, curr) => this.getVertexValue(curr) > this.getVertexValue(max) ? curr : max);
                } else {
                    bestV = allVertices[Math.floor(Math.random() * allVertices.length)];
                }
                this.build('SETTLEMENT', bestV);
                p.waitingForSettlement = false;
                madeAction = true;
                continue;
            }
          }

          // 4. BUILD ROAD - Logic refined to stop road-spamming when saving for a settlement
          if (p.canAfford(COSTS.ROAD)) {
            const allEdges = Array.from(this.board.edges.keys()).filter(e => Rules.canPlaceRoad(this.board, e, p, this.phase, this.gameMode));
            if (allEdges.length > 0) {
                // Check if we currently have a valid spot to build a settlement
                const hasSettlementSpot = Array.from(this.board.vertices.keys()).some(v => Rules.canPlaceSettlement(this.board, v, p, this.phase, this.gameMode));
                
                // LONGEST ROAD STRATEGY: 
                // Skilled/Master AI will prioritize roads if they are close to taking or need to defend Longest Road
                const currentLongest = this.longestRoadLength;
                const myLongest = this.calculateLongestPath(p.id);
                let prioritizeRoad = false;
                if (diff !== 'Beginner' && myLongest >= 3) {
                    if (this.longestRoadHolderId !== p.id && myLongest >= currentLongest - 1) prioritizeRoad = true;
                    if (this.longestRoadHolderId === p.id && myLongest <= currentLongest + 1) prioritizeRoad = true;
                }

                // SAVING LOGIC: If we have a spot to build a settlement, don't build a road 
                // UNLESS we have "spare" resources or we are prioritizing Longest Road or we are holding too many resources
                const missingSetRes = p.resources.WOOD < 1 || p.resources.BRICK < 1 || p.resources.SHEEP < 1 || p.resources.WHEAT < 1;
                let canSaveForSettlement = hasSettlementSpot && missingSetRes && !prioritizeRoad;

                // In Expanding mode or Battle Royale, bots are more reckless with roads to race for edges or the center
                // In Battle Royale, we basically NEVER want to save for a settlement unless we are already at the goal.
                const brGoalDist = (p.settlements.length > 0 || p.cities.length > 0) ? 
                    Math.min(...[...p.settlements, ...p.cities].map(id => this.board.getVertexRing(id))) : 20;

                if (this.gameMode === 'Battle Royale') {
                    // EMERGENCY: If our structures are on the edge, we MUST save for a settlement to escape.
                    const structures = [...p.settlements, ...p.cities];
                    const isOnEdge = structures.some(id => this.board.getVertexRing(id) >= this.board.radius - 1);
                    const isOnlyStructure = structures.length <= 1;

                    if ((isOnEdge || isOnlyStructure) && hasSettlementSpot && missingSetRes) {
                         // Emergency escape: save resources for the settlement
                         canSaveForSettlement = true;
                    } else if (brGoalDist > 3 || Math.random() < 0.95) {
                        canSaveForSettlement = false;
                    }
                } else if (inExpMode && Math.random() < 0.85) {
                    canSaveForSettlement = false;
                }

                if (canSaveForSettlement && !overLimit) {
                    if (diff === 'Beginner') {
                        // Beginner waits one turn before building a road if a settlement spot is available
                        if (!p.waitingForSettlement) {
                            p.waitingForSettlement = true;
                            this.log(`${p.name} is saving for a settlement...`);
                            continue; 
                        } else { p.waitingForSettlement = false; }
                    } else {
                        // Skilled/Master always save
                        // continue; // Commented out to be careful with scope
                    }
                } else { // Proceed with road build
                    let bestE;
                    if (diff === 'Master' || (inBRMode && diff !== 'Beginner')) {
                        const sortedEdges = allEdges.sort((a,b) => {
                            const ea = this.board.getEdge(a), eb = this.board.getEdge(b);
                            const va = Math.max(this.getVertexValue(ea.v1), this.getVertexValue(ea.v2));
                            const vb = Math.max(this.getVertexValue(eb.v1), this.getVertexValue(eb.v2));
                            return vb - va;
                        });
                        bestE = sortedEdges[0];
                    } else {
                        bestE = allEdges[Math.floor(Math.random() * allEdges.length)];
                    }
                    this.build('ROAD', bestE);
                    madeAction = true;
                    continue;
                }
            }
          }
        }

        // 5. BUY DEV CARD
        if (p.canAfford(COSTS.DEV_CARD) && this.devCardDeck.length > 0) {
            // Master AI will buy cards more aggressively if they have excess resources
            let cardChance = (diff === 'Master') ? 1.0 : (diff === 'Skilled' ? 0.6 : 0.3);
            let shouldBuy = Math.random() < cardChance;
            
            // In Expanding board, cards are vital if the path is blocked
            if (inExpMode && p.victoryPoints >= 10) shouldBuy = true;
            
            // If we are over limit, the bot is more likely to buy a card to burn resources
            if (overLimit) shouldBuy = true;

            // Don't buy if saving for a city/settlement unless over limit
            // Survival check for Battle Royale: If on edge or only 1 base, don't gamble on cards if we can build a safe base soon.
            let inSurvivalMode = false;
            if (inBRMode && diff !== 'Beginner') {
                const structures = [...p.settlements, ...p.cities];
                const isOnEdge = structures.some(id => this.board.getVertexRing(id) >= this.board.radius - 1);
                if (isOnEdge || structures.length <= 1) inSurvivalMode = true;
            }

            if (shouldBuy && (!needs.includes('ORE') && !needs.includes('SHEEP') && !needs.includes('WHEAT') || overLimit)) {
                if (inSurvivalMode && !overLimit) {
                    // Skip dev cards in survival mode unless we have way too many resources
                } else if (this.buyDevCard(p)) {
                    madeAction = true;
                    continue;
                }
            }
        }

        // 6. PANIC/FEAR TRADE (Only if over limit and nothing else worked)
        if (!madeAction && overLimit) {
            // Panic chance is higher in Expanding mode as resource needs are urgent
            let basePanic = (diff === 'Master') ? 1.0 : (diff === 'Skilled' ? 0.5 : 0.1);
            let panicChance = inExpMode ? Math.min(1.0, basePanic + 0.3) : basePanic;
            if (Math.random() < panicChance) {
                for (const from of resources) {
                    const trRate = this.getTradeRate(p, from);
                    if (p.resources[from] >= trRate) {
                        const targetNeed = needs.find(n => n !== from && this.bankResources[n] > 0) || 
                                           resources.find(r => r !== from && this.bankResources[r] > 0);
                        if (targetNeed) {
                            this.returnResources(p, { [from]: trRate });
                            this.giveResources(p, targetNeed, 1);
                            this.log(`${p.name} panic-traded ${trRate} ${from} for 1 ${targetNeed} (Fear: Robber)`);
                            madeAction = true;
                            break;
                        }
                    }
                }
            }
        }
    }
  }

  rollDice() {
    if (this.hasRolled) return;
    this.dice = [Math.floor(Math.random()*6)+1, Math.floor(Math.random()*6)+1];
    
    // Look at the in-game UI element for the animation setting
    const animToggle = document.getElementById('toggleDiceAnim');
    const shouldAnimate = animToggle ? animToggle.checked : true;
    
    this.diceAnim = { value: [...this.dice], timer: shouldAnimate ? 102 : 1 };
    
    const tot = this.dice[0] + this.dice[1];
    this.log(`${this.currentPlayer.name} rolled ${tot}`);
    this.hasRolled = true;
    if (typeof setupTradeUI === 'function') setupTradeUI();

    if (tot === 7) {
      this.log('Roll 7!');
      this.waitingForDiscards = [];
      const discardLimit = (this.gameMode === 'Battle Royale' ? this.brDiscardLimit : 7);
      this.players.forEach(p => {
        const totalRes = Object.values(p.resources).reduce((a,b) => a+b, 0);
        if (totalRes > discardLimit) {
            const count = Math.ceil(totalRes / 2);
            this.waitingForDiscards.push(p.id);
            if (p.isBot) {
                setTimeout(() => this.aiDiscard(p.id, count), 1000 + Math.random() * 1000);
            }
        }
      });
      
      if (this.waitingForDiscards.length > 0) {
          const humanNeedsDiscard = this.waitingForDiscards.includes(gameSync.localPlayerId) && !isOnlyBotsMode;
          if (humanNeedsDiscard) {
              const totalRes = Object.values(this.players[gameSync.localPlayerId].resources).reduce((a,b) => a+b, 0);
              if (typeof setupDiscardUI === 'function') setupDiscardUI(Math.ceil(totalRes / 2));
          }
      } else {
          this.startRobberPhase();
      }
    } else {
      this.board.hexes.forEach((h, id) => {
        if (h.number === tot && !this.robberHexIds.includes(id)) {
          h.vertices.forEach(vk => {
            const v = this.board.getVertex(vk);
            if (v.ownerId !== null) {
              this.giveResources(this.players[v.ownerId], h.terrain.name.toUpperCase(), v.isCity ? 2 : 1);
            }
          });
        }
      });
    }
  }

  aiDiscard(playerId, count) {
    if (gameSync.isMultiplayer && !gameSync.isHost) return;
    const p = this.players[playerId];
    const diff = this.aiDifficulty;
    
    for (let i = 0; i < count; i++) {
        let resTypes = Object.keys(p.resources).filter(k => p.resources[k] > 0);
        if (resTypes.length === 0) break;

        let resToDiscard;
        if (diff === 'Beginner') {
            resToDiscard = resTypes[Math.floor(Math.random() * resTypes.length)];
        } else {
            // Skilled/Master: Discard the resource they have the most of
            resToDiscard = resTypes.reduce((a, b) => p.resources[a] > p.resources[b] ? a : b);
        }
        this.returnResources(p, { [resToDiscard]: 1 });
    }
    
    this.log(`${p.name} discarded ${count} cards.`);
    this.confirmDiscard(playerId);
    if (gameSync.isMultiplayer && gameSync.isHost) gameSync.update(this, true);
  }

  confirmDiscard(playerId) {
    this.waitingForDiscards = this.waitingForDiscards.filter(id => id !== playerId);
    if (this.waitingForDiscards.length === 0) {
        this.startRobberPhase();
    }
  }

  startRobberPhase() {
    this.log('Moving Robber...');
    if (!this.currentPlayer.isBot) {
      this.movingRobber = true;
      this.selectedRobberIdx = (this.multiRobber) ? null : 0;
    } else {
      this.aiMoveRobber();
    }
  }

  aiMoveRobber() {
    if (gameSync.isMultiplayer && !gameSync.isHost) return;
    
    // 1. Pick which robber to move (if multiple)
    let robberToMoveIdx = 0;
    if (this.multiRobber) {
        // AI: Prefer moving a robber that blocks OUR best production or a high-value tile
        const p = this.players[this.currentPlayerIdx];
        const ourHexes = Array.from(this.board.hexes.keys()).filter(k => {
            const h = this.board.hexes.get(k);
            return h.vertices.some(vk => this.board.getVertex(vk).ownerId === p.id);
        });
        
        // Find which robber is on one of our hexes
        const myBlockedIdx = this.robberHexIds.findIndex(rid => ourHexes.includes(rid));
        if (myBlockedIdx !== -1) {
            robberToMoveIdx = myBlockedIdx;
        } else {
            // Otherwise move a random one, but lean towards the one that moved least recently or is on a desert
            robberToMoveIdx = Math.floor(Math.random() * this.robberHexIds.length);
        }
    }
    this.selectedRobberIdx = robberToMoveIdx;

    // 2. Pick destination
    const hexKeys = Array.from(this.board.hexes.keys()).filter(k => !this.robberHexIds.includes(k));
    let bestHex = null;
    let maxScore = -1;

    for (const key of hexKeys) {
      const h = this.board.hexes.get(key);
      if (h.terrain === HEX_TYPES.DESERT) continue;

      // Friendly Robber check: cannot place if ANY player on hex has <= 2 VP
      if (this.friendlyRobber) {
        const hasProtectedPlayer = h.vertices.some(vk => {
          const v = this.board.getVertex(vk);
          return v.ownerId !== null && v.ownerId !== this.currentPlayerIdx && this.players[v.ownerId].victoryPoints <= 2;
        });
        if (hasProtectedPlayer) continue;
      }

      let hexScore = 0;
      h.vertices.forEach(vk => {
        const v = this.board.getVertex(vk);
        if (v.ownerId !== null && v.ownerId !== this.currentPlayerIdx) {
          hexScore += v.isCity ? 2 : 1;
        }
      });

      if (hexScore > maxScore) {
        maxScore = hexScore;
        bestHex = key;
      }
    }

    if (!bestHex) {
      // Fallback: Pick a random hex that doesn't violate friendly robber (if possible)
      const safeHexes = hexKeys.filter(k => {
        if (!this.friendlyRobber) return true;
        const h = this.board.hexes.get(k);
        return !h.vertices.some(vk => {
          const v = this.board.getVertex(vk);
          return v.ownerId !== null && v.ownerId !== this.currentPlayerIdx && this.players[v.ownerId].victoryPoints <= 2;
        });
      });
      bestHex = safeHexes.length > 0 ? safeHexes[Math.floor(Math.random() * safeHexes.length)] : hexKeys[Math.floor(Math.random() * hexKeys.length)];
    }

    this.moveRobber(bestHex);
  }

  moveRobber(hexId) {
    if (this.selectedRobberIdx === null) return;
    if (this.robberHexIds.includes(hexId)) return;
    
    const oldPos = this.robberHexIds[this.selectedRobberIdx];
    this.robberHexIds[this.selectedRobberIdx] = hexId;
    this.movingRobber = false;
    this.selectedRobberIdx = null;

    const oldHex = this.board.hexes.get(oldPos);
    const newHex = this.board.hexes.get(hexId);
    const oldName = oldHex ? oldHex.terrain.name : "the abyss";
    const newName = newHex ? newHex.terrain.name : "the unknown";

    this.log(`Robber moved from ${oldName} to ${newName}`);

    // Find players to rob
    const victims = [];
    if (newHex) {
        newHex.vertices.forEach(vk => {
          const v = this.board.getVertex(vk);
          if (v && v.ownerId !== null && v.ownerId !== this.currentPlayerIdx) {
            const victim = this.players[v.ownerId];
            // Friendly robber check: only rob players with > 2 points
            if (this.friendlyRobber && victim.victoryPoints <= 2) return;
            
            // Only add if they have resources to steal
            const totalRes = Object.values(victim.resources).reduce((a, b) => a + b, 0);
            if (totalRes > 0 && !victims.includes(victim)) {
              victims.push(victim);
            }
          }
        });
    }

    if (victims.length === 0) {
      this.log("No valid players to rob.");
      if (gameSync.isMultiplayer) gameSync.update(this, true);
      return;
    }

    if (!this.currentPlayer.isBot) {
      // Human selection
      if (victims.length === 1) {
        this.robPlayer(victims[0]);
      } else {
        this.waitingToPickVictim = true;
        if (typeof setupRobberUI === 'function') setupRobberUI(victims);
        if (gameSync.isMultiplayer) gameSync.update(this, true); // Sync that we are waiting
      }
    } else {
      // AI picks player with most resources
      const target = victims.reduce((prev, curr) => {
        const prevRes = Object.values(prev.resources).reduce((a, b) => a + b, 0);
        const currRes = Object.values(curr.resources).reduce((a, b) => a + b, 0);
        return currRes > prevRes ? curr : prev;
      });
      this.robPlayer(target);
    }
  }

  robPlayer(target) {
    this.waitingToPickVictim = false;
    const resTypes = Object.keys(target.resources).filter(k => target.resources[k] > 0);
    if (resTypes.length === 0) {
      if (gameSync.isMultiplayer) gameSync.update(this, true);
      return;
    }

    const r = resTypes[Math.floor(Math.random() * resTypes.length)];
    target.resources[r]--;
    this.currentPlayer.resources[r]++;
    this.log(`${this.currentPlayer.name} stole 1 ${r} from ${target.name}`);
    if (gameSync.isMultiplayer) gameSync.update(this, true);
  }

  getTradeRate(player, res) {
    let rate = 4;
    player.settlements.concat(player.cities).forEach(vKey => {
      const v = this.board.getVertex(vKey);
      if (v.port) {
        if (v.port.type === 'ALL' && rate > 3) rate = 3;
        if (v.port.type === res && rate > 2) rate = 2;
      }
    });
    return rate;
  }

  tradeWithBank(fromRes, toRes) {
    const p = this.currentPlayer;
    const rate = this.getTradeRate(p, fromRes);
    if (!p.isBot && p.resources[fromRes] >= rate) {
      if (this.bankResources[toRes] > 0) {
        this.returnResources(p, { [fromRes]: rate });
        this.giveResources(p, toRes, 1);
        this.log(`Traded ${rate} ${fromRes} for 1 ${toRes}`);
        return true;
      } else {
        this.log(`Bank is out of ${toRes}!`);
        return false;
      }
    }
    return false;
  }

  proposePlayerTrade(targetId, give, get, isAI = false) {
    const sender = this.currentPlayer;
    const target = this.players[targetId];

    // sender check (always happens)
    if (!sender.hasResources(give)) {
      if (!isAI) this.log(`You don't have enough resources to trade.`);
      return false;
    }

    // Knowledge Check: 
    // If Human is sender, we check target immediately and fail if they don't have the items.
    if (!isAI && !target.hasResources(get)) {
        this.log(`${target.name} doesn't have the resources you requested.`);
        return false;
    }

    // If AI is sender and target is Human, check immediately to avoid flickering UI.
    // If the human doesn't have the items, the AI will silently fail this attempt and try something else.
    if (isAI && !target.isBot && !target.hasResources(get)) {
        return false;
    }

    this.activeTrade = { senderId: sender.id, targetId, give, get, timeRemaining: 20 };
    this.log(`${sender.name} proposed a trade to ${target.name}`);

    // If AI proposed to another Bot, we keep the small delay for "thinking" before rejection
    if (isAI && target.isBot && !target.hasResources(get)) {
        setTimeout(() => {
            this.log(`${target.name} doesn't have those resources.`);
            this.clearTrade();
        }, 1000);
        return true; 
    }

    if (this.tradeTimer) clearInterval(this.tradeTimer);
    this.tradeTimer = setInterval(() => {
        this.activeTrade.timeRemaining--;
        if (this.activeTrade.timeRemaining <= 0) {
            this.declinePlayerTrade();
        }
    }, 1000);

    // If AI logic if target is bot
    if (target.isBot) {
        const token = this.turnToken;
        setTimeout(() => { if (token === this.turnToken) this.aiEvaluateTrade(); }, 1000);
    }
    return true;
  }

  aiEvaluateTrade() {
    if (gameSync.isMultiplayer && !gameSync.isHost) return;
    if (!this.activeTrade) return;
    const t = this.activeTrade;
    const target = this.players[t.targetId];

    // AI is simplistic: if it has surplus (count > 2) for what is asked and wants what is offered (count < 1), it accepts.
    // Or just 50% chance for now to make it playable.
    let accept = false;
    // But only if they can afford it
    if (target.hasResources(t.get)) {
       const counts = Object.values(t.get).reduce((a,b)=>a+b, 0);
       const offers = Object.values(t.give).reduce((a,b)=>a+b, 0);
       // Accept if getting more than giving, or 30% chance.
       if (offers > counts) accept = true;
       else if (Math.random() > 0.7) accept = true;
    }

    if (accept) {
        this.acceptPlayerTrade();
    } else {
        this.declinePlayerTrade();
    }
  }

  acceptPlayerTrade() {
    if (!this.activeTrade) return;
    const t = this.activeTrade;
    const p1 = this.players[t.senderId];
    const p2 = this.players[t.targetId];

    // Double check availability
    if (p1.hasResources(t.give) && p2.hasResources(t.get)) {
        Object.entries(t.give).forEach(([r, a]) => { p1.resources[r] -= a; p2.resources[r] += a; });
        Object.entries(t.get).forEach(([r, a]) => { p2.resources[r] -= a; p1.resources[r] += a; });
        this.log(`${p2.name} accepted the trade!`);
    } else {
        this.log(`Trade failed: Someone no longer has the resources.`);
    }

    this.clearTrade();
  }

  declinePlayerTrade() {
    if (!this.activeTrade) return;
    this.log(`${this.players[this.activeTrade.targetId].name} declined the trade.`);
    this.clearTrade();
  }

  clearTrade() {
    const wasAITurn = this.currentPlayer.isBot && this.phase === 'PLAY';
    const token = this.turnToken;
    if (this.tradeTimer) clearInterval(this.tradeTimer);
    this.activeTrade = null;
    this.tradeTimer = null;

    // RESUME AI turn if it was their turn
    if (wasAITurn && !this.winner) {
        setTimeout(() => { if (token === this.turnToken) this.aiContinueTurn(); }, 1000);
    }
  }

  build(type, id) {
    const p = this.currentPlayer;
    let success = false;
    if (this.phase === 'INITIAL') {
      if (type === 'SETTLEMENT' && !this.pendingSettlement) {
        if (Rules.canPlaceSettlement(this.board, id, p, this.phase, this.gameMode)) {
          const v = this.board.getVertex(id);
          v.ownerId = p.id; p.settlements.push(id);
          p.totalSettlementsBuilt++;
          this.pendingSettlement = id; this.log('Place road');
          success = true;
          
          if (this.initialPlacements >= this.players.length) {
            v.hexes.forEach(h => {
              if (h.terrain !== HEX_TYPES.DESERT) {
                this.giveResources(p, h.terrain.name.toUpperCase(), 1);
              }
            });
          }
        }
      } else if (type === 'ROAD' && this.pendingSettlement) {
        const e = this.board.getEdge(id);
        if (e.ownerId === null && (e.v1 === this.pendingSettlement || e.v2 === this.pendingSettlement)) {
          e.ownerId = p.id; p.roads.push(id); 
          p.totalRoadsBuilt++;
          this.updateLongestRoad();
          this.finishInitial();
          success = true;
        }
      }
    } else if (this.hasRolled) {
      if (type === 'SETTLEMENT' && p.canAfford(COSTS.SETTLEMENT) && Rules.canPlaceSettlement(this.board, id, p, this.phase, this.gameMode)) {
        this.board.getVertex(id).ownerId = p.id; p.settlements.push(id); 
        p.totalSettlementsBuilt++;
        this.returnResources(p, COSTS.SETTLEMENT); this.log('Built Settlement');
        success = true;
      } else if (type === 'ROAD' && p.canAfford(COSTS.ROAD) && Rules.canPlaceRoad(this.board, id, p, this.phase, this.gameMode)) {
        this.board.getEdge(id).ownerId = p.id; p.roads.push(id); 
        p.totalRoadsBuilt++;
        this.returnResources(p, COSTS.ROAD); this.log('Built Road');
        this.updateLongestRoad();
        success = true;
      } else if (type === 'CITY' && p.canAfford(COSTS.CITY)) {
        const v = this.board.getVertex(id);
        if (v.ownerId === p.id && !v.isCity) { 
            v.isCity = true; p.cities.push(id); p.settlements = p.settlements.filter(s => s !== id); 
            p.totalCitiesBuilt++;
            this.returnResources(p, COSTS.CITY); this.log('Built City'); 
            success = true;
        }
      }
    }
    this.players.forEach(pl => pl.calculateVP(this.longestRoadHolderId, this.largestArmyHolderId));
    this.checkWinner();
    if (!this.currentPlayer.isBot && typeof setupTradeUI === 'function') setupTradeUI();
    return success;
  }

  finishInitial() {
    this.turnToken++;
    this.pendingSettlement = null; this.initialPlacements++;
    const numPlayers = this.players.length;
    // Order: 0, 1, 2... then reverse ...2, 1, 0
    let order = [];
    for (let i = 0; i < numPlayers; i++) order.push(i);
    for (let i = numPlayers - 1; i >= 0; i--) order.push(i);

    if (this.initialPlacements < numPlayers * 2) {
      this.currentPlayerIdx = order[this.initialPlacements];
      if (this.currentPlayer.isBot) {
        const token = this.turnToken;
        setTimeout(() => { if (token === this.turnToken) this.aiInitial(); }, 1000);
      }
    } else { 
      this.phase = 'PLAY'; this.currentPlayerIdx = 0; this.log('Play Phase Started!'); 
      this.players.forEach(p => p.calculateVP(this.longestRoadHolderId, this.largestArmyHolderId));
      if (this.currentPlayer.isBot && (!gameSync.isMultiplayer || gameSync.isHost)) {
        const token = this.turnToken;
        setTimeout(() => { if (token === this.turnToken) this.aiTurn(); }, 1000);
      }
    }
  }

  aiInitial() {
    if (gameSync.isMultiplayer && !gameSync.isHost) return;
    const keys = Array.from(this.board.vertices.keys()).filter(k => 
      Rules.canPlaceSettlement(this.board, k, this.currentPlayer, 'INITIAL', this.gameMode)
    );
    if (keys.length === 0) {
      this.log(`${this.currentPlayer.name} found no space to build.`);
      this.finishInitial();
      return;
    }

    let bestV;
    const diff = this.aiDifficulty;
    if (diff === 'Master') {
        bestV = keys.reduce((max, curr) => this.getVertexValue(curr) > this.getVertexValue(max) ? curr : max);
    } else if (diff === 'Skilled' || diff === 'Normal') {
        // Sort and pick from top 3 for some variety
        keys.sort((a,b) => this.getVertexValue(b) - this.getVertexValue(a));
        bestV = keys[Math.floor(Math.random() * Math.min(3, keys.length))];
    } else {
        bestV = keys[Math.floor(Math.random() * keys.length)];
    }

    this.build('SETTLEMENT', bestV);
    
    // AI picks road direction towards another potentially valuable spot
    const adjEdges = this.board.getEdgesOfVertex(bestV);
    let bestE = adjEdges[0].id;
    if (diff !== 'Beginner') {
        let maxVal = -1;
        adjEdges.forEach(e => {
            const otherV = (e.v1 === bestV) ? e.v2 : e.v1;
            const val = this.getVertexValue(otherV);
            if (val > maxVal) { maxVal = val; bestE = e.id; }
        });
    } else {
        bestE = adjEdges[Math.floor(Math.random() * adjEdges.length)].id;
    }
    this.build('ROAD', bestE);
    
    if (gameSync.isMultiplayer && gameSync.isHost) gameSync.update(this, true);
  }

  updateLongestRoad() {
    let newHolderId = this.longestRoadHolderId;
    let maxLength = this.longestRoadLength;

    this.players.forEach(p => {
        const pathLen = this.calculateLongestPath(p.id);
        if (pathLen > maxLength) {
            maxLength = pathLen;
            newHolderId = p.id;
        }
    });

    if (newHolderId !== this.longestRoadHolderId) {
        this.longestRoadHolderId = newHolderId;
        this.longestRoadLength = maxLength;
        this.log(`Longest Road: ${this.players[newHolderId].name} (${this.longestRoadLength} segments)`);
        this.players.forEach(p => p.calculateVP(this.longestRoadHolderId, this.largestArmyHolderId));
        this.checkWinner();
    }
  }

  calculateLongestPath(playerId) {
    const p = this.players[playerId];
    if (p.roads.length === 0) return 0;

    const playerVertices = new Set();
    p.roads.forEach(eId => {
        const e = this.board.getEdge(eId);
        playerVertices.add(e.v1);
        playerVertices.add(e.v2);
    });

    let maxSimplePath = 0;
    playerVertices.forEach(vId => {
        maxSimplePath = Math.max(maxSimplePath, this.dfsRoad(vId, new Set(), playerId));
    });
    return maxSimplePath;
  }

  dfsRoad(vId, visitedEdges, playerId) {
    const v = this.board.getVertex(vId);
    if (v.ownerId !== null && v.ownerId !== playerId) return 0;

    const adjEdges = this.board.getEdgesOfVertex(vId);
    let maxSub = 0;
    for (const e of adjEdges) {
        if (e.ownerId === playerId && !visitedEdges.has(e.id)) {
            const nextV = (e.v1 === vId) ? e.v2 : e.v1;
            visitedEdges.add(e.id);
            maxSub = Math.max(maxSub, 1 + this.dfsRoad(nextV, visitedEdges, playerId));
            visitedEdges.delete(e.id);
        }
    }
    return maxSub;
  }

  checkEliminations() {
    this.players.forEach(p => {
        if (p.isEliminated || p.id === -1) return;

        // BATTLE ROYALE: Primary check is the presence of structures
        if (this.gameMode === 'Battle Royale') {
            if (p.settlements.length === 0 && p.cities.length === 0) {
                this.log(`💀 ${p.name} has been wiped out and eliminated!`);
                p.isEliminated = true;
                this.destroyPlayerPieces(p);
                return;
            }
        }

        // Condition 1: Can they generate resources?
        let hasPotentialIncome = false;
        const structures = [...p.settlements, ...p.cities];
        structures.forEach(vId => {
            const v = this.board.getVertex(vId);
            if (!v) return;
            v.hexes.forEach(hex => {
                // If it's a resource hex with a number, there is income potential
                if (hex.terrain !== HEX_TYPES.DESERT && hex.terrain !== HEX_TYPES.WATER && hex.number !== null) {
                    hasPotentialIncome = true;
                }
            });
        });

        if (hasPotentialIncome) return; // Not eliminated if they have income

        // Condition 2: Can they build anything right now?
        const canBuildNow = p.canAfford(COSTS.ROAD) || 
                            p.canAfford(COSTS.SETTLEMENT) || 
                            p.canAfford(COSTS.CITY) || 
                            p.canAfford(COSTS.DEV_CARD);
        
        if (canBuildNow) return; // Not eliminated if they have resources to build something

        // Condition 3: Can they trade to get what they need?
        const resources = ['WOOD', 'BRICK', 'SHEEP', 'WHEAT', 'ORE'];
        for (const res of resources) {
            const rate = this.getTradeRate(p, res);
            if (p.resources[res] >= rate) return; // Can still trade for something
        }

        this.log(`💀 ${p.name} has no resources or buildable terrain left and is eliminated.`);
        p.isEliminated = true;
        this.destroyPlayerPieces(p);
    });

    const activePlayers = this.players.filter(p => !p.isEliminated);
    if (activePlayers.length === 0 && !this.winner) {
        this.winner = { name: (this.gameMode === 'Battle Royale' ? "The Circle" : "The Desert"), id: -1, color: "#f4a460", isEnvironment: true };
        this.log(`🏜️ TOTAL DEFEAT: All players have been eliminated. ${this.winner.name} wins.`);
    } else if (this.gameMode === 'Battle Royale' && activePlayers.length === 1 && this.phase === 'PLAY' && !this.winner) {
        this.winner = activePlayers[0];
        this.winner.id = activePlayers[0].id;
        this.log(`🏆 VICTORY ROYALE! ${this.winner.name} is the last survivor!`);
    }
  }

  destroyPlayerPieces(player) {
    this.board.vertices.forEach(v => {
        if (v.ownerId === player.id) {
            v.ownerId = null; v.isCity = false;
        }
    });
    this.board.edges.forEach(e => {
        if (e.ownerId === player.id) e.ownerId = null;
    });
    player.settlements = []; player.cities = []; player.roads = [];
  }

  checkWinner() { 
    if (this.gameMode === 'Battle Royale') {
        // Only allow a winner when board has fully shrunk
        if (this.board.radius > 2) return;

        const winners = this.players.filter(p => {
            if (p.id === -1 || p.isEliminated) return false;
            // Winner if they have ANY settlement/city in the center 2-radius board (Ring 0, 1, or 2)
            const pieces = [...p.settlements, ...p.cities];
            return pieces.some(vKey => this.board.getVertexRing(vKey) <= 2);
        });

        if (winners.length > 0) {
            // In the rare case of simultaneous multiple winners, the first one in the list (or current player if they are one of them) wins
            this.winner = winners.includes(this.currentPlayer) ? this.currentPlayer : winners[0];
            this.log(`🏆 THE CENTER HAS BEEN REACHED! ${this.winner.name} wins Battle Royale!`);
            
            // If only bots mode, restart after 5 seconds
            const allBots = this.players.filter(pl => pl.id !== -1).every(pl => pl.isBot);
            if (allBots) {
                this.log(`Game Over! Restarting in 5s...`);
                setTimeout(() => {
                    const replayBtn = document.getElementById('replayBtn');
                    if (replayBtn) replayBtn.click();
                }, 5000);
            }
        }
        return;
    }

    this.players.forEach(p => { 
        if (p.id === -1) return; // "The Desert" is not a player
        if (p.calculateVP(this.longestRoadHolderId, this.largestArmyHolderId) >= this.targetScore) {
            if (!this.winner) {
                this.winner = p;
                // If only bots mode, restart after 5 seconds
                const allBots = this.players.filter(pl => pl.id !== -1).every(pl => pl.isBot);
                if (allBots) {
                    this.log(`Game Over! Restarting in 5s...`);
                    // Use the replay button's logic which preserves the Only Bots settings
                    setTimeout(() => {
                        const replayBtn = document.getElementById('replayBtn');
                        if (replayBtn) replayBtn.click();
                    }, 5000);
                }
            }
        }
    }); 
  }
}

// --- RENDER: CANVAS ---
class CanvasRenderer {
  constructor(canvas, board) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d');
    this.board = board;
    const initialZoom = (this.board.radius <= 2) ? 1.0 : (2 / this.board.radius);
    this.camera = { x: 0, y: 0, zoom: initialZoom };
    this.diceCanvas = document.getElementById('diceCanvas');
    this.diceCtx = this.diceCanvas ? this.diceCanvas.getContext('2d') : null;
    this.logo = new Image();
    this.logo.src = 'assets/HexBound_logo.png';
  }
  render(gs, hover) {
    // Check if user still wants animation; if not, finish immediately
    const animToggle = document.getElementById('toggleDiceAnim');
    const shouldAnimate = animToggle ? animToggle.checked : true;
    if (!shouldAnimate && gs.diceAnim.timer > 1) {
        gs.diceAnim.timer = 1;
    }

    if (gs.diceAnim.timer > 0) {
        gs.diceAnim.timer--;
        // Randomize dice values during the "shaking" phase (first 0.5s / 30 frames)
        if (gs.diceAnim.timer > 72) {
            // Slower roll speed: update every 8 frames instead of 4
            if (gs.diceAnim.timer % 8 === 0) {
                gs.diceAnim.value = [Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1];
            }
        } else {
            // Lock in the real values for the pause and fade phase (last 72 frames)
            gs.diceAnim.value = [...gs.dice];
        }
    }
    
    // Update permanent dice display
    if (this.diceCtx) {
        this.diceCtx.clearRect(0, 0, this.diceCanvas.width, this.diceCanvas.height);
        const diceSize = 80;
        // Show real values once rolling ends (after 30 frames)
        const currentDice = (gs.diceAnim.timer > 72) ? gs.diceAnim.value : gs.dice;
        this.drawDiceToCtx(this.diceCtx, 10, 10, currentDice[0], diceSize);
        this.drawDiceToCtx(this.diceCtx, 10 + diceSize + 20, 10, currentDice[1], diceSize);
    }

    this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
    const isHumanTurn = gs.currentPlayerIdx === gameSync.localPlayerId && !gs.currentPlayer.isBot;
    
    this.ctx.save();
    // Centralize and apply pan/zoom
    this.ctx.translate(this.canvas.width/2 + this.camera.x, this.canvas.height/2 + this.camera.y);
    this.ctx.scale(this.camera.zoom, this.camera.zoom);

    // Draw Sea Background (Scales with board size: +3.0 hexes beyond the furthest vertex)
    // Rotated by 30 degrees (PI/6) to match the pointy-topped silhouette of the hex grid
    const seaSize = (this.board.radius * Math.sqrt(3) + 3.0) * this.board.hexSize;
    this.drawPoly(0, 0, 6, seaSize, HEX_TYPES.WATER.color, false, Math.PI / 6);

    this.board.hexes.forEach((h, id) => {
      const p = this.board.hexToPixel(h.q, h.r);
      const px = p.x, py = p.y;
      
      // Battle Royale: Highlight the "Winner's Circle" (Center 2 radius) boundary
      const ring = Math.max(Math.abs(h.q), Math.abs(h.r), Math.abs(-h.q - h.r));
      const isWinnerCircle = gs.gameMode === 'Battle Royale' && ring <= 2;

      this.drawPoly(px, py, 6, this.board.hexSize, h.terrain.color, isHumanTurn && hover?.id === `${h.q},${h.r}`);
      
      if (isWinnerCircle) {
          const neighbors = [
              {q: h.q+1, r: h.r},   // East
              {q: h.q,   r: h.r+1}, // South
              {q: h.q-1, r: h.r+1}, // SW
              {q: h.q-1, r: h.r},   // West
              {q: h.q,   r: h.r-1}, // North
              {q: h.q+1, r: h.r-1}  // NE
          ];

          this.ctx.save();
          // Adjust size slightly inward to ensure it stays on the hex and isn't clipped
          const s = this.board.hexSize - 4;
          neighbors.forEach((nb, i) => {
              const nbKey = `${nb.q},${nb.r}`;
              const neighbor = this.board.hexes.get(nbKey);
              // If neighbor is outside Ring 2 or doesn't exist, this is a boundary side
              const nbRing = neighbor ? Math.max(Math.abs(nb.q), Math.abs(nb.r), Math.abs(-nb.q - nb.r)) : 100;

              if (nbRing > 2) {
                  const a1 = 2 * Math.PI * i / 6;
                  const a2 = 2 * Math.PI * (i + 1) / 6;
                  
                  // Add a dark stroke underneath the gold dash to ensure visibility on all backgrounds
                  this.ctx.strokeStyle = '#000'; this.ctx.lineWidth = 6;
                  this.ctx.beginPath();
                  this.ctx.moveTo(px + s * Math.cos(a1), py + s * Math.sin(a1));
                  this.ctx.lineTo(px + s * Math.cos(a2), py + s * Math.sin(a2));
                  this.ctx.stroke();

                  // Draw the gold dash on top
                  this.ctx.strokeStyle = '#ffd700'; this.ctx.lineWidth = 4;
                  this.ctx.setLineDash([12, 6]);
                  this.ctx.beginPath();
                  this.ctx.moveTo(px + s * Math.cos(a1), py + s * Math.sin(a1));
                  this.ctx.lineTo(px + s * Math.cos(a2), py + s * Math.sin(a2));
                  this.ctx.stroke();
                  this.ctx.setLineDash([]);
              }
          });
          this.ctx.restore();
      }

      // Draw number circle (including blank one for Desert)
      this.ctx.fillStyle = '#fff';
      this.ctx.strokeStyle = '#000';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath(); 
      this.ctx.arc(px, py, 15, 0, Math.PI * 2); 
      this.ctx.fill(); 
      this.ctx.stroke();

      if (h.number) {
        this.ctx.fillStyle = (h.number === 6 || h.number === 8) ? 'red' : 'black'; 
        this.ctx.font = 'bold 16px Arial'; 
        this.ctx.textAlign = 'center'; 
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(h.number, px, py);
      }
    });

    this.board.edges.forEach(e => {
      const v1 = this.board.getVertex(e.v1), v2 = this.board.getVertex(e.v2);
      const isOwned = e.ownerId !== null;
      const canAffordRoad = (gs.phase === 'INITIAL' && gs.pendingSettlement) || (gs.phase === 'PLAY' && gs.hasRolled && gs.currentPlayer.canAfford(COSTS.ROAD));
      
      let isValidRoad = false;
      if (isHumanTurn && !isOwned) {
        if (gs.pendingRoads > 0) {
            isValidRoad = Rules.canPlaceRoad(this.board, e.id, gs.currentPlayer, gs.phase, gs.gameMode);
        } else if (canAffordRoad) {
            if (gs.phase === 'INITIAL') isValidRoad = (e.v1 === gs.pendingSettlement || e.v2 === gs.pendingSettlement);
            else isValidRoad = Rules.canPlaceRoad(this.board, e.id, gs.currentPlayer, gs.phase, gs.gameMode);
        }
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
      } else if (isHumanTurn && hover?.id === e.id) {
        let showHover = (gs.pendingRoads <= 0 || Rules.canPlaceRoad(this.board, e.id, gs.currentPlayer, gs.phase, gs.gameMode));
        if (showHover) {
            this.ctx.strokeStyle = 'rgba(255,255,255,0.5)';
            this.ctx.lineWidth = 6;
            this.ctx.beginPath(); this.ctx.moveTo(x1, y1); this.ctx.lineTo(x2, y2); this.ctx.stroke();
        }
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

    this.board.ports.forEach(port => {
      const v1 = this.board.getVertex(port.v1);
      const v2 = this.board.getVertex(port.v2);
      const cx = (v1.x + v2.x) / 2, cy = (v1.y + v2.y) / 2;
      const angle = Math.atan2(cy, cx);
      
      // Fixed offset of 40 pixels from the board edge
      const px = cx + Math.cos(angle) * 40;
      const py = cy + Math.sin(angle) * 40;

      this.ctx.strokeStyle = 'rgba(255,255,255,0.6)'; this.ctx.lineWidth = 4;
      this.ctx.beginPath(); this.ctx.moveTo(v1.x, v1.y); this.ctx.lineTo(px, py); this.ctx.lineTo(v2.x, v2.y); this.ctx.stroke();

      this.ctx.fillStyle = (port.type === 'ALL') ? '#fff' : (HEX_TYPES[port.type]?.color || '#fff');
      this.ctx.beginPath(); this.ctx.arc(px, py, 8, 0, Math.PI * 2); this.ctx.fill();
      this.ctx.strokeStyle = '#000'; this.ctx.lineWidth = 1; this.ctx.stroke();
      
      this.ctx.fillStyle = '#000'; this.ctx.font = 'bold 8px Arial'; this.ctx.textAlign = 'center'; this.ctx.textBaseline = 'middle';
      this.ctx.fillText(port.type === 'ALL' ? '3:1' : '2:1', px, py);
    });

    this.board.vertices.forEach(v => {
        const px = v.x, py = v.y;
        const isOwned = v.ownerId !== null;
        const canAffordSettle = (gs.phase === 'INITIAL' && !gs.pendingSettlement) || (gs.phase === 'PLAY' && gs.hasRolled && gs.currentPlayer.canAfford(COSTS.SETTLEMENT));
        let canSettle = (isHumanTurn && !isOwned && canAffordSettle && Rules.canPlaceSettlement(this.board, v.id, gs.currentPlayer, gs.phase, gs.gameMode));
        let canUpgrade = (isHumanTurn && isOwned && v.ownerId === gs.currentPlayerIdx && !v.isCity && gs.currentPlayer.canAfford(COSTS.CITY) && gs.hasRolled);

        if (gs.pendingRoads > 0) {
            canSettle = false;
            canUpgrade = false;
        }

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
        } else if (isHumanTurn && hover?.id === v.id && gs.pendingRoads <= 0) {
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

    // --- Draw Robbers (On top of everything built) ---
    this.board.hexes.forEach((h, id) => {
      const p = this.board.hexToPixel(h.q, h.r);
      const px = p.x, py = p.y;
      
      const robberIdx = gs.robberHexIds.indexOf(id);
      if (robberIdx !== -1) {
        const isSelected = gs.selectedRobberIdx === robberIdx;
        this.ctx.fillStyle = isSelected ? 'cyan' : 'rgba(50,50,50,0.8)';
        this.ctx.beginPath(); this.ctx.arc(px, py + 10, 10, 0, Math.PI*2); this.ctx.fill();
        this.ctx.strokeStyle = isSelected ? '#000' : '#fff'; this.ctx.lineWidth = 2; this.ctx.stroke();
      }

      // Selection/Placement highlight
      if (gs.movingRobber && !gs.currentPlayer.isBot) {
        if (gs.multiRobber && gs.selectedRobberIdx === null) {
          // Highlight existing robbers to pick one
          if (robberIdx !== -1) {
            this.ctx.strokeStyle = 'cyan'; this.ctx.lineWidth = 3;
            this.ctx.beginPath(); this.ctx.arc(px, py + 10, 15, 0, Math.PI*2); this.ctx.stroke();
          }
        } else if (!gs.robberHexIds.includes(id)) {
          // Highlight placement destinations
          this.ctx.strokeStyle = 'cyan'; this.ctx.lineWidth = 3;
          this.ctx.setLineDash([5, 5]);
          this.ctx.beginPath(); this.ctx.arc(px, py, 43, 0, Math.PI*2); this.ctx.stroke();
          this.ctx.setLineDash([]);
        }
      }
    });

    // --- Draw VFX Effects ---
    gs.effects.forEach((eff, i) => {
      if (eff.type === 'pulse') {
        const progress = eff.life / eff.maxLife;
        const radius = (1 - progress) * 80;
        this.ctx.strokeStyle = eff.color;
        this.ctx.lineWidth = progress * 10;
        this.ctx.globalAlpha = progress;
        this.ctx.beginPath();
        this.ctx.arc(eff.x, eff.y, radius, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.globalAlpha = 1.0;
        eff.life--;
      }
    });
    gs.effects = gs.effects.filter(eff => eff.life > 0);

    this.ctx.restore();

    // Backdrop for Canvas UI (Action Panel & Stats)
    // If a modal is active or we are waiting for discards, dim the board but not the canvas header/footer UI
    const isAnyModalVisible = (tradePanel.style.display === 'flex' || 
                              playerTradePanel.style.display === 'flex' || 
                              robberPanel.style.display === 'flex' || 
                              tradeOfferPanel.style.display === 'flex' ||
                              discardPanel.style.display === 'flex' ||
                              document.getElementById('victory-panel').style.display === 'flex');
    
    if (isAnyModalVisible) {
        this.ctx.fillStyle = 'rgba(0,0,0,0.35)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    this.drawUI(gs);

    if (gs.diceAnim.timer > 0) {
        // Fade out only in the last 0.4s (24 frames)
        const opacity = Math.min(1, gs.diceAnim.timer / 24);
        this.ctx.globalAlpha = opacity;

        // Growth effect: Scale up by 25% after the dice stop rolling
        let sizeScale = 1.0;
        if (gs.diceAnim.timer <= 72) {
            // Grow over 15 frames immediately after the "shaking" ends
            const growthProgress = Math.min(1, (72 - gs.diceAnim.timer) / 15);
            sizeScale = 1.0 + (growthProgress * 0.25);
        }

        const centerX = this.canvas.width / 2, centerY = this.canvas.height / 2;
        const baseSize = 100;
        const size = baseSize * sizeScale;

        // Added a bit more spacing (15px) to accommodate the larger scale
        this.drawDice(centerX - size - 15, centerY - size/2, gs.diceAnim.value[0], size);
        this.drawDice(centerX + 15, centerY - size/2, gs.diceAnim.value[1], size);
        this.ctx.globalAlpha = 1.0;
    }
  }
  drawPoly(x,y,s,sz,c,h, rotation = 0) {
    this.ctx.fillStyle=c; this.ctx.strokeStyle=h?'yellow':'#000'; this.ctx.lineWidth=h?4:2;
    this.ctx.beginPath(); for(let i=0;i<s;i++){const a=rotation + 2*Math.PI*i/s; this.ctx.lineTo(x+sz*Math.cos(a), y+sz*Math.sin(a));} this.ctx.closePath(); this.ctx.fill(); this.ctx.stroke();
  }
  drawDice(x, y, value, size = 35) {
    this.drawDiceToCtx(this.ctx, x, y, value, size);
  }
  drawDiceToCtx(ctx, x, y, value, size = 35) {
    const radius = size * 0.15; // Rounded corners
    ctx.fillStyle = '#eee';
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + size - radius, y);
    ctx.quadraticCurveTo(x + size, y, x + size, y + radius);
    ctx.lineTo(x + size, y + size - radius);
    ctx.quadraticCurveTo(x + size, y + size, x + size - radius, y + size);
    ctx.lineTo(x + radius, y + size);
    ctx.quadraticCurveTo(x, y + size, x, y + size - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#333';
    ctx.lineWidth = size / 20;
    ctx.stroke();

    ctx.fillStyle = '#000';
    const dot = size / 10;
    const mid = size / 2;
    const q1 = size / 4;
    const q3 = (size / 4) * 3;

    const drawDotToCtx = (cx, cy, r) => {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
    };

    if (value === 1 || value === 3 || value === 5) drawDotToCtx(x + mid, y + mid, dot);
    if (value >= 2) { drawDotToCtx(x + q1, y + q1, dot); drawDotToCtx(x + q3, y + q3, dot); }
    if (value >= 4) { drawDotToCtx(x + q3, y + q1, dot); drawDotToCtx(x + q1, y + q3, dot); }
    if (value === 6) { drawDotToCtx(x + q1, y + mid, dot); drawDotToCtx(x + q3, y + mid, dot); }
  }
  drawDot(x, y, r) { this.ctx.beginPath(); this.ctx.arc(x, y, r, 0, Math.PI * 2); this.ctx.fill(); }

  drawUI(gs) {
    const isMobile = this.canvas.width < 768;

    // --- LEFT PANEL: TURN & ACTION ---
    const ACTION_WIDTH = isMobile ? 130 : 180;
    const ACTION_HEIGHT = isMobile ? 320 : 380;
    this.ctx.fillStyle = 'rgba(50,50,50,0.75)';
    this.ctx.fillRect(10, 10, ACTION_WIDTH, ACTION_HEIGHT);
    this.ctx.strokeStyle = '#fff'; this.ctx.lineWidth = 1; this.ctx.strokeRect(10, 10, ACTION_WIDTH, ACTION_HEIGHT);

    this.ctx.fillStyle = '#fff';
    this.ctx.font = isMobile ? 'bold 12px Arial' : 'bold 16px Arial';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';
    
    let logoOffset = isMobile ? 40 : 45;
    if (this.logo.complete) {
        const logoW = isMobile ? 110 : 140;
        const logoH = (this.logo.height / this.logo.width) * logoW;
        const logoX = 10 + (ACTION_WIDTH - logoW) / 2;
        this.ctx.drawImage(this.logo, logoX, 15, logoW, logoH);
        logoOffset = 15 + logoH + (isMobile ? 5 : 10);
    } else {
        this.ctx.fillText('HEXBOUND', 20, 20);
    }

    if (gs.movingRobber && !gs.currentPlayer.isBot) {
      this.ctx.fillStyle = '#f1c40f';
      this.ctx.font = isMobile ? 'bold 10px Arial' : 'bold 11px Arial';
      this.ctx.fillText('MOVE ROBBER', 20, logoOffset);
    } else {
      this.ctx.font = isMobile ? '10px Arial' : '12px Arial';
      this.ctx.fillStyle = gs.currentPlayer.color;
      this.ctx.fillText(gs.currentPlayer.name, 20, logoOffset);
    }

    let ly = logoOffset + (isMobile ? 22 : 28);
    const human = gs.players[gameSync.localPlayerId];
    const humanTotal = Object.values(human.resources).reduce((a, b) => a + b, 0);
    const discardLimit = (gs.gameMode === 'Battle Royale' ? gs.brDiscardLimit : 7);
    
    this.ctx.fillStyle = humanTotal > discardLimit ? '#ff4444' : '#fff'; // Red if at risk
    this.ctx.font = isMobile ? 'bold 10px Arial' : 'bold 11px Arial';
    this.ctx.fillText(humanTotal > discardLimit ? 'YOUR RESOURCES: ⚠️' : 'YOUR RESOURCES:', 20, ly);
    
    this.ctx.font = isMobile ? '9px Arial' : '11px Arial';
    const resources = ['WOOD', 'BRICK', 'SHEEP', 'WHEAT', 'ORE'];
    resources.forEach(r => {
      const v = human.resources[r] || 0;
      ly += isMobile ? 12 : 15;
      this.ctx.fillText(`${r}: ${v}`, 30, ly);
    });

    ly += isMobile ? 15 : 20;
    this.ctx.fillStyle = '#aaa';
    this.ctx.font = isMobile ? 'bold 10px Arial' : 'bold 11px Arial';
    this.ctx.fillText('BANK RESOURCES:', 20, ly);
    this.ctx.font = isMobile ? '9px Arial' : '11px Arial';
    resources.forEach(r => {
      const v = gs.bankResources[r] || 0;
      ly += isMobile ? 12 : 15;
      this.ctx.fillText(`${r}: ${v}`, 30, ly);
    });

    // Online Status Indicator
    if (gameSync.isMultiplayer) {
      ly += isMobile ? 20 : 25;
      this.ctx.fillStyle = '#2ecc71';
      this.ctx.beginPath(); this.ctx.arc(25, ly + 5, 4, 0, Math.PI*2); this.ctx.fill();
      this.ctx.fillStyle = '#fff';
      this.ctx.font = isMobile ? '9px Arial' : '11px Arial';
      this.ctx.textAlign = 'left';
      this.ctx.fillText(`ID: ${gameSync.matchId}`, 35, ly);
    }

    document.getElementById('gameAbandonBtn').style.display = 'block';

    if (gs.friendlyRobber) {
      this.ctx.fillStyle = '#00ffcc';
      this.ctx.font = isMobile ? 'italic 9px Arial' : 'italic 10px Arial';
      this.ctx.fillText('🛡️ Friendly', 20, ACTION_HEIGHT - 10);
    }

    // --- RIGHT PANEL: GAME STATS ---
    const STATS_WIDTH = isMobile ? 180 : 300;
    const rx = this.canvas.width - STATS_WIDTH - 10;
    const ry = 10;
    
    // Calculate height based on players and history (history hidden on mobile)
    const historyCount = isMobile ? 0 : 10;
    const STATS_HEIGHT = (isMobile ? 50 : 110) + (gs.players.length * (isMobile ? 16 : 20)) + (historyCount * 14);
    
    this.ctx.fillStyle = 'rgba(40,40,40,0.8)';
    this.ctx.fillRect(rx, ry, STATS_WIDTH, STATS_HEIGHT);
    this.ctx.strokeStyle = '#fff'; this.ctx.lineWidth = 1; this.ctx.strokeRect(rx, ry, STATS_WIDTH, STATS_HEIGHT);

    this.ctx.fillStyle = '#fff';
    this.ctx.font = isMobile ? 'bold 11px Arial' : 'bold 14px Arial';
    this.ctx.fillText('GAME STATS', rx + 15, ry + 15);

    // Desert percentage, radius, and turn tracking
    let statusText = "";
    if (gs.gameMode === 'Expanding Board (Experimental)') {
        const hexes = Array.from(gs.board.hexes.values());
        const desertCount = hexes.filter(h => h.terrain === HEX_TYPES.DESERT).length;
        const desertPct = Math.round((desertCount / hexes.length) * 100);
        statusText = `R:${gs.board.radius} | D:${desertPct}% | T:${gs.totalTurns} (R:${gs.rotations})`;
    } else if (gs.gameMode === 'Battle Royale') {
        statusText = `R:${gs.board.radius} | T:${gs.totalTurns} (R:${gs.rotations})`;
    } else {
        statusText = `Turns: ${gs.totalTurns} (R:${gs.rotations})`;
    }
    
    this.ctx.fillStyle = (gs.gameMode === 'Expanding Board (Experimental)') ? '#f4a460' : 
                         (gs.gameMode === 'Battle Royale' ? '#e74c3c' : '#fff');
    this.ctx.font = isMobile ? 'bold 9px Arial' : 'bold 11px Arial';
    const textWidth = this.ctx.measureText(statusText).width;
    this.ctx.fillText(statusText, rx + STATS_WIDTH - textWidth - 15, ry + 15);

    // Header for Table
    this.ctx.font = isMobile ? '8px Arial' : '10px Arial';
    this.ctx.fillStyle = '#aaa';
    this.ctx.fillText('PLAYER', rx + 15, ry + (isMobile ? 30 : 40));
    this.ctx.fillText(gs.gameMode === 'Battle Royale' ? 'RING' : 'VP', rx + (isMobile ? 100 : 160), ry + (isMobile ? 30 : 40));
    this.ctx.fillText('RD', rx + (isMobile ? 123 : 188), ry + (isMobile ? 30 : 40));
    this.ctx.fillText('DEV', rx + (isMobile ? 143 : 213), ry + (isMobile ? 30 : 40));
    this.ctx.fillText('RES', rx + (isMobile ? 168 : 253), ry + (isMobile ? 30 : 40));

    let py = ry + (isMobile ? 45 : 60);
    gs.players.forEach(p => {
      this.ctx.fillStyle = p.isEliminated ? '#444' : p.color; // Darken if eliminated
      this.ctx.font = isMobile ? 'bold 10px Arial' : 'bold 12px Arial';
      let nameText = p.name;
      if (gs.longestRoadHolderId === p.id) nameText += ' 🏆';
      if (gs.largestArmyHolderId === p.id) nameText += ' ⚔️';
      if (p.isEliminated) nameText = '💀 ' + nameText;
      this.ctx.fillText(nameText.substring(0, isMobile ? 10 : 20), rx + 15, py);
      
      this.ctx.fillStyle = p.isEliminated ? '#444' : '#fff';
      this.ctx.font = isMobile ? '10px Arial' : '12px Arial';
      
      let statValue = "";
      if (gs.gameMode === 'Battle Royale') {
          const pieces = [...p.settlements, ...p.cities];
          if (pieces.length === 0) {
              statValue = "—";
          } else {
              const bestRing = Math.min(...pieces.map(vk => gs.board.getVertexRing(vk)));
              statValue = bestRing === 0 ? "★" : bestRing.toString();
          }
      } else {
          let vpText = `${p.visibleVP}`;
          const vpCardsCount = p.devCards.filter(c => c.type === 'VP').length;
          if (vpCardsCount > 0 && (p.id === gameSync.localPlayerId || gs.winner)) {
            vpText += ` (${p.visibleVP + vpCardsCount})`;
          }
          statValue = vpText;
      }
      this.ctx.fillText(statValue, rx + (isMobile ? 100 : 160), py);

      this.ctx.fillText(gs.calculateLongestPath(p.id), rx + (isMobile ? 123 : 188), py);
      this.ctx.fillText(p.devCards.length.toString(), rx + (isMobile ? 143 : 213), py);
      const totalRes = Object.values(p.resources).reduce((a, b) => a + b, 0);
      const discardLimit = (gs.gameMode === 'Battle Royale' ? gs.brDiscardLimit : 7);
      
      if (totalRes > discardLimit) {
        this.ctx.fillStyle = '#ff4444'; // Red for danger
        this.ctx.font = isMobile ? 'bold 10px Arial' : 'bold 12px Arial';
        this.ctx.fillText(totalRes + ' ⚠️', rx + (isMobile ? 168 : 253), py);
      } else {
        this.ctx.fillStyle = '#fff';
        this.ctx.fillText(totalRes, rx + (isMobile ? 168 : 253), py);
      }
      py += isMobile ? 16 : 20;
    });

    // History Section (Hidden on mobile)
    if (!isMobile) {
        py += 10;
        this.ctx.strokeStyle = '#555';
        this.ctx.beginPath(); this.ctx.moveTo(rx + 10, py); this.ctx.lineTo(rx + STATS_WIDTH - 10, py); this.ctx.stroke();
        py += 10;
        this.ctx.fillStyle = '#fff';
        this.ctx.font = 'bold 12px Arial';
        this.ctx.fillText('HISTORY', rx + 15, py);
        py += 18;
        this.ctx.font = '10px Arial';
        this.ctx.fillStyle = '#ccc';
        const recentHistory = gs.history.slice(-historyCount).reverse();
        recentHistory.forEach(h => {
          const displayLog = h.length > 55 ? h.substring(0, 52) + '...' : h;
          this.ctx.fillText(displayLog, rx + 15, py);
          py += 14;
        });
    }

    if (gs.winner) { 
        this.ctx.fillStyle='rgba(0,0,0,0.85)'; 
        this.ctx.fillRect(0,0,this.canvas.width,this.canvas.height); 
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
    this.lastTouchDist = 0;

    canvas.addEventListener('mousemove', e => this.move(e));
    canvas.addEventListener('mousedown', e => this.down(e));
    canvas.addEventListener('mouseup', e => this.up(e));
    canvas.addEventListener('wheel', e => this.wheel(e), { passive: false });
    
    // Touch Events
    canvas.addEventListener('touchstart', e => this.touchStart(e), { passive: false });
    canvas.addEventListener('touchmove', e => this.touchMove(e), { passive: false });
    canvas.addEventListener('touchend', e => this.touchEnd(e), { passive: false });

    // Prevent context menu on right click to allow for panning
    canvas.addEventListener('contextmenu', e => e.preventDefault());
  }

  isAnyModalVisible() {
    return (tradePanel.style.display === 'flex' || 
            playerTradePanel.style.display === 'flex' || 
            robberPanel.style.display === 'flex' || 
            tradeOfferPanel.style.display === 'flex' || 
            discardPanel.style.display === 'flex' ||
            resourcePickerPanel.style.display === 'flex');
  }

  getGameXY(e) {
    const r = this.canvas.getBoundingClientRect();
    const sx = (e.clientX || (e.touches && e.touches[0].clientX)) - r.left;
    const sy = (e.clientY || (e.touches && e.touches[0].clientY)) - r.top;
    // Inverse of: screen = (game * zoom) + center + camera
    const gx = (sx - this.canvas.width / 2 - this.ren.camera.x) / this.ren.camera.zoom;
    const gy = (sy - this.canvas.height / 2 - this.ren.camera.y) / this.ren.camera.zoom;
    return { x: gx, y: gy };
  }

  touchStart(e) {
    if (this.isAnyModalVisible()) return;
    e.preventDefault();
    this.isDragging = true;
    this.dragMoved = false;
    if (e.touches.length === 1) {
        this.lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2) {
        this.lastTouchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    }
  }

  touchMove(e) {
    if (this.isAnyModalVisible()) return;
    e.preventDefault();
    if (!this.isDragging) return;

    if (e.touches.length === 1) {
        const dx = e.touches[0].clientX - this.lastMouse.x;
        const dy = e.touches[0].clientY - this.lastMouse.y;
        this.ren.camera.x += dx;
        this.ren.camera.y += dy;
        this.lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        if (Math.hypot(dx, dy) > 5) this.dragMoved = true;
    } else if (e.touches.length === 2) {
        const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        if (this.lastTouchDist > 0) {
            const ratio = dist / this.lastTouchDist;
            const oldZoom = this.ren.camera.zoom;
            // Removed heavy damping to allow for faster zooming on large boards
            const newZoom = Math.min(Math.max(0.05, oldZoom * ratio), 3.0);
            
            this.ren.camera.zoom = newZoom;
        }
        this.lastTouchDist = dist;
        this.dragMoved = true;
    }
  }

  touchEnd(e) {
    if (this.isAnyModalVisible()) return;
    e.preventDefault();
    this.isDragging = false;
    if (!this.dragMoved) {
        // Find hover manually since mousemove isn't firing constantly on touch
        const touch = e.changedTouches[0];
        const { x, y } = this.getGameXY(touch);
        this.updateHover(x, y);
        this.click();
    }
  }

  updateHover(x, y) {
    if (this.isAnyModalVisible()) { this.hover = null; return; }
    this.hover = null;
    const isMobile = this.canvas.width < 768;
    const baseVertex = isMobile ? 25 : 15;
    const baseEdge = isMobile ? 20 : 10;
    
    const vertexThreshold = baseVertex / Math.max(0.5, this.ren.camera.zoom);
    const edgeThreshold = baseEdge / Math.max(0.5, this.ren.camera.zoom);

    this.board.vertices.forEach(v => { 
        if (Math.hypot(x - v.x, y - v.y) < vertexThreshold) this.hover = { type: 'vertex', id: v.id }; 
    });
    if (!this.hover) this.board.edges.forEach(e => {
        const v1 = this.board.getVertex(e.v1), v2 = this.board.getVertex(e.v2);
        if (Math.hypot(x - (v1.x + v2.x) / 2, y - (v1.y + v2.y) / 2) < edgeThreshold) this.hover = { type: 'edge', id: e.id };
    });
    if (!this.hover) this.board.hexes.forEach(h => {
        const p = this.board.hexToPixel(h.q, h.r);
        if (Math.hypot(x - p.x, y - p.y) < (isMobile ? 50 : 40)) this.hover = { type: 'hex', id: `${h.q},${h.r}` };
    });
  }

  move(e) {
    if (this.isAnyModalVisible()) { this.hover = null; return; }
    if (this.isDragging) {
      const dx = e.clientX - this.lastMouse.x;
      const dy = e.clientY - this.lastMouse.y;
      this.ren.camera.x += dx;
      this.ren.camera.y += dy;
      this.lastMouse = { x: e.clientX, y: e.clientY };
      if (Math.hypot(dx, dy) > 2) this.dragMoved = true;
    }

    const { x, y } = this.getGameXY(e);
    this.updateHover(x, y);
  }

  down(e) {
    if (this.isAnyModalVisible()) return;
    if (e.button !== 0 && e.button !== 2) return; // Only left/right click
    this.isDragging = true;
    this.dragMoved = false;
    this.lastMouse = { x: e.clientX, y: e.clientY };
  }

  up(e) {
    if (this.isAnyModalVisible()) return;
    if (!this.isDragging) return;
    this.isDragging = false;
    if (!this.dragMoved) {
        this.click();
    }
  }

  wheel(e) {
    if (this.isAnyModalVisible()) return;
    e.preventDefault();
    
    const delta = -e.deltaY;
    const oldZoom = this.ren.camera.zoom;
    
    // Smooth multiplicative zoom that respects scroll wheel speed
    // 0.0015 provides a good balance between speed and precision
    const zoomFactor = Math.exp(delta * 0.0015);
    const newZoom = Math.min(Math.max(0.05, oldZoom * zoomFactor), 3.0);
    
    // Zoom towards mouse position
    const r = this.canvas.getBoundingClientRect();
    const mx = e.clientX - r.left - this.canvas.width / 2;
    const my = e.clientY - r.top - this.canvas.height / 2;

    // Adjust camera pan to keep mouse over the same game spot
    this.ren.camera.x -= (mx - this.ren.camera.x) * (newZoom / oldZoom - 1);
    this.ren.camera.y -= (my - this.ren.camera.y) * (newZoom / oldZoom - 1);
    this.ren.camera.zoom = newZoom;
  }

  async click() {
    if(!this.gs || this.gs.currentPlayer.isBot || !this.hover) return;

    // AUTHORITY CHECK: Only the player whose turn it is can click to build/move
    if (this.gs.currentPlayerIdx !== gameSync.localPlayerId) {
        return; 
    }
    
    // Block interaction if any modal is active
    if (this.isAnyModalVisible()) return;
    
    let stateChanged = false;
    if(this.gs.movingRobber) {
        if(this.hover.type==='hex') {
            const h = this.board.hexes.get(this.hover.id);
            const robberIdx = this.gs.robberHexIds.indexOf(this.hover.id);

            // Phase 1: Pick a robber (if not already picked)
            if (this.gs.multiRobber && this.gs.selectedRobberIdx === null) {
                if (robberIdx !== -1) {
                    this.gs.selectedRobberIdx = robberIdx;
                    this.gs.log('Robber selected. Now pick a new hex.');
                    stateChanged = true;
                } else {
                    this.gs.log('Pick a hex that currently has a robber.');
                }
            } 
            // Phase 2: Move the picked robber
            else {
                if (this.gs.robberHexIds.includes(this.hover.id)) {
                    this.gs.log('Robber must move to a hex with no robbers.');
                    return;
                }

                if(this.gs.friendlyRobber) {
                    const affected = h.vertices.some(vk => {
                        const v = this.board.getVertex(vk);
                        return v.ownerId !== null && v.ownerId !== gameSync.localPlayerId && this.gs.players[v.ownerId].victoryPoints <= 2;
                    });
                    if(affected) { 
                        this.gs.log('Friendly Robber: Cannot target players with <= 2 points.'); 
                        return;
                    }
                }
                
                this.gs.moveRobber(this.hover.id);
                stateChanged = true;
            }
        }
    } else if (this.gs.pendingRoads > 0) {
        if (this.hover.type === 'edge') {
            const e = this.board.getEdge(this.hover.id);
            if (e.ownerId === null && Rules.canPlaceRoad(this.board, this.hover.id, this.gs.players[gameSync.localPlayerId], this.gs.phase, this.gs.gameMode)) {
                e.ownerId = gameSync.localPlayerId; 
                this.gs.players[gameSync.localPlayerId].roads.push(this.hover.id);
                this.gs.updateLongestRoad();
                this.gs.pendingRoads--;
                this.gs.log(`Placed free road! ${this.gs.pendingRoads} remaining.`);
                if (this.gs.pendingRoads === 0) this.gs.log('Finished playing Road Building.');
                stateChanged = true;
            }
        }
    } else if(this.hover.type==='vertex' && !this.gs.winner) {
        const v = this.board.getVertex(this.hover.id);
        const res = v.ownerId===null ? this.gs.build('SETTLEMENT', this.hover.id) : this.gs.build('CITY', this.hover.id);
        if (res !== false) stateChanged = true;
    } else if(this.hover.type==='edge' && !this.gs.winner) {
        const res = this.gs.build('ROAD', this.hover.id);
        if (res !== false) stateChanged = true;
    }

    if (stateChanged && gameSync.isMultiplayer) {
        await gameSync.update(this.gs);
    }
  }
}

// --- MAIN ---
const canvas = document.getElementById('gameCanvas');
const rollBtn = document.getElementById('rollBtn');
const endBtn = document.getElementById('endBtn');
const startGameBtn = document.getElementById('startGameBtn');
const menuOverlay = document.getElementById('menu-overlay');
const gameInterface = document.getElementById('game-interface');

// UI Screens
const mainMenu = document.getElementById('main-menu');
const singleplayerMenu = document.getElementById('singleplayer-menu');
const multiplayerMenu = document.getElementById('multiplayer-choice-menu');
const hostMenu = document.getElementById('host-menu');
const joinMenu = document.getElementById('join-menu');
const lobbyMenu = document.getElementById('lobby-menu');
const statsMenu = document.getElementById('stats-menu');

function showScreen(screen) {
    if (!screen) return;
    [mainMenu, singleplayerMenu, multiplayerMenu, hostMenu, joinMenu, lobbyMenu, statsMenu].forEach(s => {
        if (s) s.style.display = 'none';
    });
    screen.style.display = 'block';
}

// Settings in Solo
const boardSolo = document.getElementById('boardSizeSolo');
const aiCountSelect = document.getElementById('aiCount');
const winSolo = document.getElementById('winPointsSolo');
const winSoloVal = document.getElementById('winPointsValueSolo');

// Settings in Host
const boardHost = document.getElementById('boardSizeHost');
const winHost = document.getElementById('winPointsHost');
const winHostVal = document.getElementById('winPointsValueHost');

function updateMenuOptions() {
  const limits = { '1': 8, '2': 15, '3': 25, '4': 35, '5': 50, '19': 100, '20': 100 };
  const playerCap = { '1': 3, '2': 4, '3': 6, '4': 8, '5': 10, '19': 38, '20': 40 };

  const isExpSolo = (gmSolo && gmSolo.value === 'Expanding Board (Experimental)');
  const isExpHost = (gmHost && gmHost.value === 'Expanding Board (Experimental)');

  // Solo limits
  if (boardSolo && winSolo) {
      const radiusVal = boardSolo.value;
      const maxPlayers = playerCap[radiusVal] || 4;
      // Clamp based on available distinct colors to prevent duplicates if possible, 
      // but allow up to the map's capacity
      const effectiveMaxPlayers = Math.min(maxPlayers, PLAYER_COLORS.length);
      const maxAIs = effectiveMaxPlayers - 1;

      Array.from(aiCountSelect.options).forEach(opt => {
        const val = parseInt(opt.value);
        const disabled = val > maxAIs;
        opt.disabled = disabled;
        opt.style.display = disabled ? 'none' : 'block';
      });
      if (parseInt(aiCountSelect.value) > maxAIs) aiCountSelect.value = maxAIs.toString();
      
      const maxPoints = isExpSolo ? 30 : (limits[radiusVal] || 15);
      winSolo.max = maxPoints;
      winSolo.min = isExpSolo ? "14" : "3";
      if (parseInt(winSolo.value) > maxPoints) winSolo.value = maxPoints;
      if (parseInt(winSolo.value) < parseInt(winSolo.min)) winSolo.value = winSolo.min;
      if (winSoloVal) winSoloVal.innerText = winSolo.value;
  }

  // Host limits
  if (boardHost && winHost) {
      const radiusVal = boardHost.value;
      const maxPoints = isExpHost ? 30 : (limits[radiusVal] || 15);
      winHost.max = maxPoints;
      winHost.min = isExpHost ? "14" : "3";
      if (parseInt(winHost.value) > maxPoints) winHost.value = maxPoints;
      if (parseInt(winHost.value) < parseInt(winHost.min)) winHost.value = winHost.min;
      if (winHostVal) winHostVal.innerText = winHost.value;
  }

  // Desert Chance labels Solo
  const dNewS = document.getElementById('desertNewSolo');
  const dNewValS = document.getElementById('desertNewValueSolo');
  if (dNewS && dNewValS) dNewValS.innerText = dNewS.value;
  const dDecayS = document.getElementById('desertDecaySolo');
  const dDecayValS = document.getElementById('desertDecayValueSolo');
  if (dDecayS && dDecayValS) dDecayValS.innerText = dDecayS.value;

  // Desert Chance labels Host
  const dNewH = document.getElementById('desertNewHost');
  const dNewValH = document.getElementById('desertNewValueHost');
  if (dNewH && dNewValH) dNewValH.innerText = dNewH.value;
  const dDecayH = document.getElementById('desertDecayHost');
  const dDecayValH = document.getElementById('desertDecayValueHost');
  if (dDecayH && dDecayValH) dDecayValH.innerText = dDecayH.value;

  // Battle Royale labels
  const brGraceS = document.getElementById('brGraceSolo');
  const brGraceValS = document.getElementById('brGraceValueSolo');
  if (brGraceS && brGraceValS) brGraceValS.innerText = brGraceS.value;
  const brGraceH = document.getElementById('brGraceHost');
  const brGraceValH = document.getElementById('brGraceValueHost');
  if (brGraceH && brGraceValH) brGraceValH.innerText = brGraceH.value;

  const brDiscardS = document.getElementById('brDiscardSolo');
  const brDiscardValS = document.getElementById('brDiscardValueSolo');
  if (brDiscardS && brDiscardValS) brDiscardValS.innerText = brDiscardS.value;
  const brDiscardH = document.getElementById('brDiscardHost');
  const brDiscardValH = document.getElementById('brDiscardValueHost');
  if (brDiscardH && brDiscardValH) brDiscardValH.innerText = brDiscardH.value;
}

if (boardSolo) boardSolo.onchange = updateMenuOptions;
if (boardHost) boardHost.onchange = updateMenuOptions;
if (winSolo) winSolo.oninput = updateMenuOptions;
if (winHost) winHost.oninput = updateMenuOptions;

// Track oninput for desert sliders
document.getElementById('desertNewSolo').oninput = updateMenuOptions;
document.getElementById('desertDecaySolo').oninput = updateMenuOptions;
document.getElementById('desertNewHost').oninput = updateMenuOptions;
document.getElementById('desertDecayHost').oninput = updateMenuOptions;
document.getElementById('brGraceSolo').oninput = updateMenuOptions;
document.getElementById('brGraceHost').oninput = updateMenuOptions;
document.getElementById('brDiscardSolo').oninput = updateMenuOptions;
document.getElementById('brDiscardHost').oninput = updateMenuOptions;

// Toggle board size visibility based on game mode
const gmSolo = document.getElementById('gameModeSolo');
const gmHost = document.getElementById('gameModeHost');
const bsSoloGroup = document.getElementById('boardSizeSoloGroup');
const bsHostGroup = document.getElementById('boardSizeHostGroup');
const eiSoloGroup = document.getElementById('expansionIntervalSoloGroup');
const eiHostGroup = document.getElementById('expansionIntervalHostGroup');
const edSoloGroup = document.getElementById('expansionDesertSoloGroup');
const edHostGroup = document.getElementById('expansionDesertHostGroup');
const brSoloOptions = document.getElementById('brOptionsSolo');
const brHostOptions = document.getElementById('brOptionsHost');

function updateModeVisibility() {
    if (gmSolo && bsSoloGroup && eiSoloGroup && edSoloGroup && brSoloOptions) {
        const isExp = (gmSolo.value === 'Expanding Board (Experimental)');
        const isBR = (gmSolo.value === 'Battle Royale');
        bsSoloGroup.style.display = (isExp || isBR) ? 'none' : 'block';
        eiSoloGroup.style.display = isExp ? 'block' : 'none';
        edSoloGroup.style.display = isExp ? 'block' : 'none';
        brSoloOptions.style.display = isBR ? 'block' : 'none';
        
        if (isBR) {
            document.getElementById('boardSizeSolo').value = "20";
            document.getElementById('aiCount').value = "39";
        }
        
        const wpInput = document.getElementById('winPointsSolo');
        const wpValue = document.getElementById('winPointsValueSolo');
        if (wpInput) {
            wpInput.min = isExp ? "14" : "3";
            if (parseInt(wpInput.value) < parseInt(wpInput.min)) {
                wpInput.value = wpInput.min;
                if (wpValue) wpValue.innerText = wpInput.value;
            }
        }
    }
    if (gmHost && bsHostGroup && eiHostGroup && edHostGroup && brHostOptions) {
        const isExp = (gmHost.value === 'Expanding Board (Experimental)');
        const isBR = (gmHost.value === 'Battle Royale');
        bsHostGroup.style.display = (isExp || isBR) ? 'none' : 'block';
        eiHostGroup.style.display = isExp ? 'block' : 'none';
        edHostGroup.style.display = isExp ? 'block' : 'none';
        brHostOptions.style.display = isBR ? 'block' : 'none';

        if (isBR) {
            document.getElementById('boardSizeHost').value = "20";
        }

        const wpInput = document.getElementById('winPointsHost');
        const wpValue = document.getElementById('winPointsValueHost');
        if (wpInput) {
            wpInput.min = isExp ? "14" : "3";
            if (parseInt(wpInput.value) < parseInt(wpInput.min)) {
                wpInput.value = wpInput.min;
                if (wpValue) wpValue.innerText = wpInput.value;
            }
        }
    }
}

if (gmSolo) gmSolo.onchange = () => { updateModeVisibility(); updateMenuOptions(); };
if (gmHost) gmHost.onchange = () => { updateModeVisibility(); updateMenuOptions(); };

updateMenuOptions();
updateModeVisibility();

// Toast notification helper
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span>${message}</span>
        <span style="margin-left: 15px; cursor: pointer; opacity: 0.7;" onclick="this.parentElement.remove()">&times;</span>
    `;
    
    container.appendChild(toast);
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
        toast.style.animation = 'toast-out 0.3s ease-in forwards';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// --- BUTTON CLICK HANDLERS ---
// Navigation handlers moved to end of file for consistency with previous edits.

const tradePanel = document.getElementById('trade-panel');
const tradeGiveContainer = document.getElementById('trade-give');
const tradeGetContainer = document.getElementById('trade-get');
const tradeGetLabel = document.getElementById('trade-get-label');
const tradeBtn = document.getElementById('tradeBtn');
const bankTradeBtn = document.getElementById('bankTradeBtn');
const buyDevBtn = document.getElementById('buyDevBtn');
const devCardContainer = document.getElementById('dev-card-container');
const playerTradePanel = document.getElementById('player-trade-panel');
const tradeTargetSelect = document.getElementById('tradeTarget');
const tradeGiveControls = document.getElementById('trade-give-controls');
const tradeGetControls = document.getElementById('trade-get-controls');
const sendTradeBtn = document.getElementById('sendTradeBtn');
const cancelTradeBtn = document.getElementById('cancelTradeBtn');
const tradeOfferPanel = document.getElementById('trade-offer-panel');
const discardPanel = document.getElementById('discard-panel');
const victoryPanel = document.getElementById('victory-panel');
const discardControls = document.getElementById('discard-controls');
const confirmDiscardBtn = document.getElementById('confirmDiscardBtn');
const resourcePickerPanel = document.getElementById('resource-picker-panel');
const cancelPickerBtn = document.getElementById('cancelPickerBtn');

let tradeGiveSelection = null;
let playerTradeOffer = { WOOD: 0, BRICK: 0, SHEEP: 0, WHEAT: 0, ORE: 0 };
let playerTradeWants = { WOOD: 0, BRICK: 0, SHEEP: 0, WHEAT: 0, ORE: 0 };
let discardSelection = { WOOD: 0, BRICK: 0, SHEEP: 0, WHEAT: 0, ORE: 0 };
let isProposingTrade = false;
let isTradingWithBank = false;

function setupDiscardUI(totalToDiscard) {
    if (!gs) return;
    const p = gs.players[gameSync.localPlayerId];
    const resources = ['WOOD', 'BRICK', 'SHEEP', 'WHEAT', 'ORE'];
    Object.keys(discardSelection).forEach(r => discardSelection[r] = 0);
    
    document.getElementById('discard-count-total').innerText = totalToDiscard;
    
    const updateDiscardPanel = () => {
        const currentDiscarded = Object.values(discardSelection).reduce((a,b) => a+b, 0);
        const remaining = totalToDiscard - currentDiscarded;
        document.getElementById('discard-remaining').innerText = remaining;
        confirmDiscardBtn.disabled = remaining !== 0;

        discardControls.innerHTML = '';
        resources.forEach(res => {
            if (p.resources[res] === 0) return;

            const div = document.createElement('div');
            div.style.display = 'flex'; div.style.alignItems = 'center'; div.style.justifyContent = 'space-between';
            div.style.gap = '10px'; div.style.background = 'rgba(0,0,0,0.3)'; div.style.padding = '5px 10px'; div.style.borderRadius = '4px';

            const name = document.createElement('span');
            name.innerText = `${res} (${p.resources[res]})`;
            name.style.fontSize = '12px';

            const ctrls = document.createElement('div');
            ctrls.style.display = 'flex'; ctrls.style.alignItems = 'center'; ctrls.style.gap = '8px';

            const val = document.createElement('span');
            val.innerText = discardSelection[res];
            val.style.fontWeight = 'bold'; val.style.minWidth = '15px'; val.style.textAlign = 'center';

            const minus = document.createElement('button');
            minus.innerText = '-'; minus.style.padding = '2px 8px'; minus.style.fontSize = '12px'; minus.style.background = '#e74c3c';
            minus.onclick = () => { if(discardSelection[res] > 0) { discardSelection[res]--; updateDiscardPanel(); } };

            const plus = document.createElement('button');
            plus.innerText = '+'; plus.style.padding = '2px 8px'; plus.style.fontSize = '12px'; plus.style.background = '#2ecc71';
            plus.onclick = () => { 
                if(discardSelection[res] < p.resources[res] && currentDiscarded < totalToDiscard) { 
                    discardSelection[res]++; 
                    updateDiscardPanel(); 
                } 
            };

            ctrls.appendChild(minus);
            ctrls.appendChild(val);
            ctrls.appendChild(plus);
            div.appendChild(name);
            div.appendChild(ctrls);
            discardControls.appendChild(div);
        });
    };

    confirmDiscardBtn.onclick = async () => {
        gs.returnResources(p, discardSelection);
        gs.log(`You discarded ${totalToDiscard} cards.`);
        gs.confirmDiscard(gameSync.localPlayerId);
        if(gameSync.isMultiplayer) await gameSync.update(gs);
    };

    updateDiscardPanel();
}

function setupTradeUI() {
    if (!gs || gs.currentPlayer.isBot) return;
    
    // Reset any active UI states
    isTradingWithBank = false;
    isProposingTrade = false;
    setupDevCardUI(); 

    const p = gs.currentPlayer;
    const resources = ['WOOD', 'BRICK', 'SHEEP', 'WHEAT', 'ORE'];
    
    buyDevBtn.disabled = !p.canAfford(COSTS.DEV_CARD) || gs.devCardDeck.length === 0 || !gs.hasRolled;
    buyDevBtn.style.opacity = buyDevBtn.disabled ? '0.5' : '1.0';

    // Bank Trade UI Reset
    tradeGiveContainer.innerHTML = '';
    tradeGetContainer.innerHTML = '';
    tradeGiveSelection = null;
    tradeGetContainer.style.display = 'none';
    tradeGetLabel.style.display = 'none';

    resources.forEach(fromRes => {
        const rate = gs.getTradeRate(p, fromRes);
        const affordable = p.resources[fromRes] >= rate;
        const btn = document.createElement('button');
        btn.innerText = `Give ${rate} ${fromRes}`;
        btn.style.fontSize = '9px'; btn.style.padding = '4px 6px';
        btn.style.background = affordable ? '#2ecc71' : '#666';
        btn.style.opacity = affordable ? '1.0' : '0.5';
        btn.disabled = !affordable;
        
        btn.onclick = () => {
          Array.from(tradeGiveContainer.children).forEach((b, i) => {
             const res = resources[i];
             const rRate = gs.getTradeRate(p, res);
             b.style.background = (p.resources[res] >= rRate) ? '#2ecc71' : '#666';
             b.style.border = 'none';
          });
          btn.style.background = '#27ae60';
          btn.style.border = '2px solid gold';
          tradeGiveSelection = fromRes;
          showTradeGetOptions(fromRes);
        };
        tradeGiveContainer.appendChild(btn);
    });

    bankTradeBtn.onclick = () => {
        const p = gs.currentPlayer;
        const resources = ['WOOD', 'BRICK', 'SHEEP', 'WHEAT', 'ORE'];
        const canTrade = resources.some(r => p.resources[r] >= gs.getTradeRate(p, r));

        if (!canTrade) {
            gs.log("Bank Trade: You don't have enough resources to trade with the bank (need 4 of a kind, or less with ports).");
            return;
        }
        isTradingWithBank = true;
    };

    buyDevBtn.onclick = async () => {
        if (gs.buyDevCard(gs.currentPlayer)) {
           setupTradeUI();
           setupDevCardUI(); 
           if(gameSync.isMultiplayer) await gameSync.update(gs);
        } else {
           gs.log("Bank: Out of Development Cards or not enough resources!");
        }
    };

    // Player Trade Button Handler
    tradeBtn.onclick = () => {
        const p = gs.currentPlayer;
        const totalRes = Object.values(p.resources).reduce((a, b) => a + b, 0);
        if (totalRes === 0) {
            gs.log("Trade: You have no resources to offer.");
            return;
        }
        isProposingTrade = true;
        setupPlayerTradeUI();
    };
}

function setupDevCardUI() {
    if (!gs || gs.currentPlayerIdx !== gameSync.localPlayerId) {
        devCardContainer.style.display = 'none';
        return;
    }
    const p = gs.currentPlayer;
    devCardContainer.innerHTML = '';
    
    if (p.devCards.length === 0) {
        devCardContainer.style.display = 'none';
        return;
    }

    devCardContainer.style.display = 'flex';
    p.devCards.forEach((card, idx) => {
        const div = document.createElement('div');
        div.className = 'dev-card';
        div.style.background = '#34495e';
        div.style.border = '1px solid #7f8c8d';
        div.style.borderRadius = '4px';
        div.style.padding = '5px';
        div.style.minWidth = '80px';
        div.style.cursor = 'pointer';
        div.style.display = 'flex';
        div.style.flexDirection = 'column';
        div.style.alignItems = 'center';
        div.style.gap = '2px';

        const name = document.createElement('span');
        name.innerText = card.name;
        name.style.fontWeight = 'bold'; name.style.fontSize = '10px';
        name.style.color = '#f1c40f';

        const desc = document.createElement('span');
        desc.innerText = card.desc;
        desc.style.fontSize = '8px'; desc.style.textAlign = 'center';
        desc.style.color = '#ecf0f1';

        div.appendChild(name);
        div.appendChild(desc);

        const canPlay = card.type !== 'VP' && card.boughtTurn < gs.turnToken && !gs.playedDevCardThisTurn && gs.hasRolled && !gs.movingRobber;
        div.style.opacity = canPlay ? '1.0' : '0.5';
        
        if (canPlay) {
            div.onclick = async () => {
                if (gs.playDevCard(p, idx)) {
                    setupDevCardUI();
                    setupTradeUI();
                    if (gameSync.isMultiplayer) await gameSync.update(gs);
                }
            };
        } else if (card.type === 'VP') {
            div.style.border = '2px solid gold';
            div.style.cursor = 'default';
        } else if (card.boughtTurn === gs.turnToken) {
            const label = document.createElement('span');
            label.innerText = '(New)'; label.style.fontSize = '8px'; label.style.color = '#e67e22';
            div.appendChild(label);
        }

        devCardContainer.appendChild(div);
    });
}

function setupPlayerTradeUI() {
    if (!gs) return;
    const p = gs.currentPlayer;
    const resources = ['WOOD', 'BRICK', 'SHEEP', 'WHEAT', 'ORE'];
    
    // Reset selections
    Object.keys(playerTradeOffer).forEach(r => playerTradeOffer[r] = 0);
    Object.keys(playerTradeWants).forEach(r => playerTradeWants[r] = 0);
    
    // Build Target Selector
    tradeTargetSelect.innerHTML = '';
    gs.players.forEach(other => {
        if (other.id !== p.id) {
            const opt = document.createElement('option');
            opt.value = other.id;
            opt.innerText = other.name;
            tradeTargetSelect.appendChild(opt);
        }
    });

    // Build Controls for Give/Get
    const buildControls = (container, state, isGive) => {
        container.innerHTML = '';
        resources.forEach(res => {
            const div = document.createElement('div');
            div.style.display = 'flex'; div.style.alignItems = 'center'; div.style.justifyContent = 'space-between';
            div.style.gap = '5px'; div.style.width = '100%';
            
        const resLabel = document.createElement('span');
        resLabel.innerText = res;
        resLabel.style.fontSize = '11px'; resLabel.style.color = '#fff';
        
        const count = isGive ? 0 : '?'; // Hide specific count, show if player can propose
        const val = document.createElement('span');
        val.innerText = '0';
        val.style.fontSize = '14px'; val.style.fontWeight = 'bold';
        val.style.minWidth = '20px'; val.style.textAlign = 'center';

        const btnGroup = document.createElement('div');
        btnGroup.style.display = 'flex'; btnGroup.style.gap = '4px';

        const plus = document.createElement('button');
        plus.innerText = '+'; plus.style.padding = '2px 8px'; plus.style.fontSize = '12px';
        plus.style.background = '#2ecc71';
        plus.onclick = () => {
          if (isGive && playerTradeOffer[res] >= p.resources[res]) return;
          state[res]++;
          val.innerText = state[res];
        };

        const minus = document.createElement('button');
        minus.innerText = '-'; minus.style.padding = '2px 9px'; minus.style.fontSize = '12px';
        minus.style.background = '#e74c3c';
        minus.onclick = () => {
          if (state[res] > 0) state[res]--;
          val.innerText = state[res];
        };

        btnGroup.appendChild(minus);
        btnGroup.appendChild(plus);
        
        div.appendChild(resLabel);
        div.appendChild(val);
        div.appendChild(btnGroup);
        container.appendChild(div);
      });
    };

    buildControls(tradeGiveControls, playerTradeOffer, true);
    buildControls(tradeGetControls, playerTradeWants, false);

    playerTradePanel.style.display = 'flex';
}

sendTradeBtn.onclick = async () => {
    const targetId = parseInt(tradeTargetSelect.value);
    const give = {}; Object.entries(playerTradeOffer).forEach(([r, a]) => { if (a > 0) give[r] = a; });
    const get = {}; Object.entries(playerTradeWants).forEach(([r, a]) => { if (a > 0) get[r] = a; });
    
    if (Object.keys(give).length === 0 && Object.keys(get).length === 0) {
        showToast("Select resources for the trade!", "warning");
        return;
    }

    if (gs.proposePlayerTrade(targetId, give, get)) {
        isProposingTrade = false;
        playerTradePanel.style.display = 'none';
        if(gameSync.isMultiplayer) await gameSync.update(gs);
    } 
};

cancelTradeBtn.onclick = () => {
    isProposingTrade = false;
    playerTradePanel.style.display = 'none';
};

document.getElementById('acceptTradeBtn').onclick = async () => {
    if (gs.activeTrade) {
        gs.acceptPlayerTrade();
        if(gameSync.isMultiplayer) await gameSync.update(gs);
    }
};

document.getElementById('declineTradeBtn').onclick = async () => {
    if (gs.activeTrade) {
        gs.declinePlayerTrade();
        if(gameSync.isMultiplayer) await gameSync.update(gs);
    }
};

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
        btn.onclick = async () => {
            if(!gs.tradeWithBank(fromRes, toRes)) {
                const rate = gs.getTradeRate(gs.currentPlayer, fromRes);
                showToast(`Not enough ${fromRes}! Need at least ${rate}.`, "warning");
                setupTradeUI(); // Reset if somehow they don't have enough now
            } else {
                setupTradeUI(); // Refresh state after trade
                if (gameSync.isMultiplayer) await gameSync.update(gs);
            }
        };
        tradeGetContainer.appendChild(btn);
    });
}

const robberPanel = document.getElementById('robber-panel');
const robberVictims = document.getElementById('robber-victims');

function setupRobberUI(victims) {
    if (!gs || gs.currentPlayerIdx !== gameSync.localPlayerId) return;
    robberVictims.innerHTML = '';
    
    victims.forEach(v => {
        const btn = document.createElement('button');
        btn.innerText = v.name;
        btn.style.background = v.color;
        btn.style.color = '#fff';
        btn.style.textShadow = '1px 1px 2px #000';
        btn.onclick = async () => {
            gs.robPlayer(v);
            if(gameSync.isMultiplayer) await gameSync.update(gs);
        };
        robberVictims.appendChild(btn);
    });
}

function resize() { 
  canvas.width = window.innerWidth; 
  canvas.height = window.innerHeight; 
}
window.addEventListener('resize', resize); resize();

let board, players, gs, ren, inp;
let lastGameConfig = null;
let isOnlyBotsMode = false;

// --- ONLINE: FIREBASE SYNC ---
class GameSync {
    constructor() {
        this.db = null;
        this.matchId = null;
        this.localPlayerId = 0; 
        this.isMultiplayer = false;
        this.isHost = true; 
        this.gameRef = null;
        this.unsubscribe = null;
        this.lastPushedJson = null;
        this.updateTimeout = null;
        this.pendingUpdate = null;
    }

    saveSession() {
        if (!this.matchId) return;
        const myName = getProfileName();
        // Session storage is tab-specific, allowing multi-local testing
        sessionStorage.setItem('hexbound_session', JSON.stringify({
            matchId: this.matchId,
            playerName: myName,
            isHost: this.isHost,
            localPlayerId: this.localPlayerId
        }));
    }

    getSession() {
        const s = sessionStorage.getItem('hexbound_session');
        if (!s) return null;
        try { return JSON.parse(s); } catch(e) { return null; }
    }

    clearSession() {
        sessionStorage.removeItem('hexbound_session');
    }

    async init() {
        if (this.db) return true; // Already initialized

        try {
            // First check for global object (loaded via script to avoid file:// CORS issues)
            let config = window.hexboundFirebaseConfig;
            
            // Fallback to fetch if not found (useful for web-server environments)
            if (!config) {
                console.log("Config not found in window, attempting fetch...");
                const resp = await fetch('firebase-config.json');
                config = await resp.json();
            }

            if (!config || config.apiKey === "YOUR_API_KEY") {
                console.warn("Firebase not configured correctly. Check your firebase-config.js/json");
                return false;
            }
            if (!firebase.apps.length) firebase.initializeApp(config);
            this.db = firebase.firestore();
            return true;
        } catch (e) {
            return false;
        }
    }

    async getPublicMatches() {
        if (!this.db) {
            const ok = await this.init();
            if (!ok) return [];
        }
        try {
            // Get all matches. In a production app, you might want to filter by "started: false"
            // or a manual "public" flag. For now, since it's a small app, we'll list current active matches.
            const querySnapshot = await this.db.collection('matches').limit(20).get();
            const matches = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();

                // Skip private matches and those with no players
                if (data.isPrivate === true) return;

                if (data.players && data.players.length > 0) {
                    matches.push({
                        id: doc.id,
                        host: data.players[0].name || "Unknown",
                        playerCount: data.players.length,
                        radius: data.board ? data.board.radius : 2,
                        mode: data.gameMode || 'Standard',
                        started: data.started || false
                    });
                }
            });
            return matches;
        } catch (e) {
            console.error("Error fetching matches:", e);
            return [];
        }
    }

    async joinMatch(id, onUpdate, mustExist = false, initialConfig = null) {
        this.matchId = id;
        this.gameRef = this.db.collection('matches').doc(id);
        this.isMultiplayer = true;
        let myName = getProfileName();
        localStorage.setItem('hexbound_playername', myName);
        
        try {
            await this.db.runTransaction(async (transaction) => {
                const doc = await transaction.get(this.gameRef);
                const session = this.getSession();
                
                if (!doc.exists) {
                    if (mustExist) throw new Error("Match not found. Please check your Match ID.");

                    this.isHost = true;
                    this.localPlayerId = 0;
                    
                    const br = initialConfig?.boardRadius || 2;
                    const wp = initialConfig?.winPoints || 10;
                    const fr = initialConfig?.friendlyRobber || false;
                    const mr = initialConfig?.multiRobber || false;
                    const gm = initialConfig?.gameMode || 'Standard';
                    const ei = initialConfig?.expansionInterval || '2';
                    const brsi = initialConfig?.brShrinkInterval || 3;
                    const brgr = initialConfig?.brGraceRotations || 5;
                    const brdl = initialConfig?.brDiscardLimit || 16;
                    const isPrivate = initialConfig?.isPrivate || false;

                    const p0 = new Player(0, myName, PLAYER_COLORS[0], false);
                    const initialBoard = new Board(br);
                    const initialGs = new GameState(initialBoard, [p0], wp, fr, "Skilled", mr, gm, ei, 0.1, 0.2, brsi, brgr, brdl);
                    const data = initialGs.toJSON();
                    data.isPrivate = isPrivate; // Store private flag at root of document
                    
                    transaction.set(this.gameRef, data);
                } else {
                    const data = doc.data();
                    const tempGs = GameState.fromJSON(data);
                    const playerCap = { '1': 3, '2': 4, '3': 6, '4': 8, '5': 10, '19': 38 };
                    const maxPlayers = playerCap[tempGs.board.radius] || 6;

                    if (session && session.matchId === id) {
                        this.isHost = session.isHost;
                        this.localPlayerId = session.localPlayerId;
                    } else {
                        this.isHost = false;
                        
                        // Handle name collision
                        const nameExists = tempGs.players.some(p => p.name === myName && !p.isBot);
                        if (nameExists) {
                            let count = 2;
                            let baseName = myName;
                            while (tempGs.players.some(p => p.name === `${baseName} (${count})`)) count++;
                            myName = `${baseName} (${count})`;
                            // Note: we can't easily sync back to the join UI here but we save it to storage
                            localStorage.setItem('hexbound_playername', myName);
                        }

                        let idx = tempGs.players.findIndex(p => p.name === myName);
                        if (idx === -1) {
                            // Online games don't have bots anymore, but we'll leave the takeover logic just in case an AI slot was somehow created
                            idx = tempGs.players.findIndex(p => p.name.startsWith("Guest ") || p.name.startsWith("Player "));
                            if (idx !== -1) {
                                tempGs.players[idx].name = myName;
                                if (tempGs.players[idx].isBot) tempGs.players[idx].isBot = false;
                            } else if (tempGs.players.length < maxPlayers) {
                                idx = tempGs.players.length;
                                tempGs.players.push(new Player(idx, myName, PLAYER_COLORS[idx % PLAYER_COLORS.length], false));
                            } else {
                                throw new Error("Game is full!");
                            }
                        }
                        this.localPlayerId = idx;
                        transaction.update(this.gameRef, { players: tempGs.players.map(p => p.toJSON()) });
                    }
                }
            });

            this.saveSession();
            document.getElementById('syncStatus').innerText = `${this.isHost ? 'Host' : 'Joined'}: Match ${id}`;
            document.getElementById('syncStatus').style.color = this.isHost ? '#2ecc71' : '#3498db';
            
            // Online games are humans-only: disable bot settings
            document.getElementById('aiCount').value = "0";
            document.getElementById('aiCount').disabled = true;
            document.getElementById('onlyBots').checked = false;
            document.getElementById('onlyBots').disabled = true;
            document.getElementById('aiDifficulty').disabled = true;

            const lobbyAbandonBtn = document.getElementById('lobbyAbandonBtn');
            lobbyAbandonBtn.style.display = 'block';
            lobbyAbandonBtn.innerText = this.isHost ? "Abandon Game" : "Leave Game";

            if (!this.isHost) {
                startGameBtn.style.display = 'none';
                document.getElementById('menuTitle').innerText = "Waiting for Host...";
            } else {
                startGameBtn.style.display = 'block';
                document.getElementById('menuTitle').innerText = "Match Lobby";
            }

            const finalDoc = await this.gameRef.get();
            if (finalDoc.exists) onUpdate(GameState.fromJSON(finalDoc.data()));

        } catch (e) {
            throw e;
        }

        if (this.unsubscribe) this.unsubscribe();
        this.unsubscribe = this.gameRef.onSnapshot((snap) => {
            if (snap.exists) {
                const data = snap.data();
                if (this.lastPushedJson && JSON.stringify(data) === this.lastPushedJson) return;
                onUpdate(GameState.fromJSON(data));
            } else if (this.isMultiplayer && !this.isHost) {
                // The host has deleted the match
                this.abandonMatch(true); 
                showToast("The host has abandoned the game.", "warning");
                
                // Full UI Reset
                gs = null;
                gameInterface.style.display = 'none';
                menuOverlay.style.display = 'flex';
                showScreen(multiplayerMenu);
                
                // Reset Lobby UI
                const syncBtn = document.getElementById('joinConfirmBtn');
                if (syncBtn) {
                  syncBtn.innerText = "Join Game";
                  syncBtn.disabled = false;
                }
                document.getElementById('syncStatus').innerText = "Not synced.";
                document.getElementById('syncStatus').style.color = "#999";
                document.getElementById('playerCountDisplay').style.display = 'none';
                document.getElementById('menuTitle').innerText = "HEXBOUND";
                startGameBtn.style.display = 'block';
            }
        });
        return true;
    }

    async update(gameState, immediate = false) {
        if (!this.isMultiplayer || !this.gameRef) return;
        
        this.pendingUpdate = gameState;
        
        if (immediate) {
            if (this.updateTimeout) {
                clearTimeout(this.updateTimeout);
                this.updateTimeout = null;
            }
            return await this.performUpdate();
        }

        if (!this.updateTimeout) {
            this.updateTimeout = setTimeout(() => {
                this.performUpdate();
                this.updateTimeout = null;
            }, 1500); // 1.5-second debounce for general actions
        }
    }

    async performUpdate() {
        if (!this.pendingUpdate || !this.gameRef) return;
        try {
            const data = this.pendingUpdate.toJSON();
            const jsonStr = JSON.stringify(data);
            if (jsonStr === this.lastPushedJson) return; // No real change
            
            this.lastPushedJson = jsonStr;
            await this.gameRef.set(data);
            this.pendingUpdate = null;
        } catch (e) {
            showToast("Sync failed. Check connection.", "error");
        }
    }

    async abandonMatch(skipSync = false) {
        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
            this.updateTimeout = null;
        }
        this.pendingUpdate = null;
        this.clearSession();
        if (!this.gameRef) return;
        
        if (this.isHost) {
            try {
                // If it's a "clean" abandon by host, delete the match entirely
                await this.gameRef.delete();
            } catch (e) {
                showToast("Failed to end game on server.", "error");
            }
        } else if (gs && !skipSync) {
            // Player is leaving an online game.
            // Since we aren't allowing bots, we just log that they left.
            const me = gs.players[this.localPlayerId];
            gs.log(`${me.name} left the game.`);
            // Note: In a humans-only game, the turn will likely be stuck if they leave during it.
            // But this satisfies the "no bots" requirement.
            await this.update(gs, true);
        }

        if (this.unsubscribe) this.unsubscribe();
        this.matchId = null;
        this.gameRef = null;
        this.unsubscribe = null;
        this.isMultiplayer = false;
        this.isHost = true;
        this.lastPushedJson = null;

        // Re-enable bot settings for local games
        document.getElementById('aiCount').disabled = false;
        document.getElementById('onlyBots').disabled = false;
        document.getElementById('aiDifficulty').disabled = false;
    }
}

const gameSync = new GameSync();

function getProfileName() {
    // Check which menu is visible and grab name from there, or fall back to any non-empty input
    const solo = document.getElementById('playerNameSolo').value.trim();
    const host = document.getElementById('playerNameHost').value.trim();
    const join = document.getElementById('playerNameJoin').value.trim();

    if (singleplayerMenu.style.display !== 'none') return solo || "Human";
    if (hostMenu.style.display !== 'none') return host || "Host";
    if (joinMenu.style.display !== 'none') return join || "Guest";
    
    // Fallback if none of the specific menus are active
    return solo || host || join || localStorage.getItem('hexbound_playername') || "Human";
}

// Initial Name Population
(function () {
    const savedName = localStorage.getItem('hexbound_playername');
    if (savedName) {
        ['playerNameSolo', 'playerNameHost', 'playerNameJoin'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = savedName;
        });
    }
    
    // Sync all name fields when one changes
    const syncNames = (e) => {
        const newName = e.target.value;
        ['playerNameSolo', 'playerNameHost', 'playerNameJoin'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = newName;
        });
        localStorage.setItem('hexbound_playername', newName);
    };

    ['playerNameSolo', 'playerNameHost', 'playerNameJoin'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.oninput = syncNames;
    });
})();

function resetGame(config) {
  lastGameConfig = config;
  isOnlyBotsMode = config.onlyBots;
  let { aiCount, boardRadius, winPoints, friendlyRobber, multiRobber, aiDifficulty, onlyBots, gameMode, expansionInterval, desertNewChance, desertDecayChance, brShrinkInterval, brGraceRotations, brDiscardLimit } = config;
  
  // Enforce minimum 14 VP for Expanding Board
  if (gameMode === 'Expanding Board (Experimental)' && winPoints < 14) {
      winPoints = 14;
  }

  const myName = getProfileName();
  localStorage.setItem('hexbound_playername', myName);
  
  gameSync.saveSession();

  // Update rule text
  const ruleWinEl = document.getElementById('ruleWinPoints');
  const ruleRobberEl = document.getElementById('ruleRobber7');
  
  if (gameMode === 'Battle Royale') {
      ruleWinEl.innerHTML = `<strong>Victory:</strong> Reach the Center (Ring 0-1).`;
      if (ruleRobberEl) {
          ruleRobberEl.innerHTML = `<strong>The Robber (7):</strong> If you roll a 7, everyone with >${brDiscardLimit} cards must discard half. Then move the robber & steal.`;
      }
  } else {
      ruleWinEl.innerHTML = `<strong>Victory:</strong> Reach ${winPoints} points.`;
      if (ruleRobberEl) {
          ruleRobberEl.innerHTML = `<strong>The Robber (7):</strong> If you roll a 7, everyone with >7 cards must discard half. Then move the robber & steal.`;
      }
  }

  board = new Board(boardRadius);
  let players = [];
  
  if (onlyBots && !gameSync.isMultiplayer) {
    for (let i = 0; i <= aiCount; i++) {
        players.push(new Player(i, `AI ${i}`, PLAYER_COLORS[i % PLAYER_COLORS.length], true));
    }
  } else {
    // Preserve existing human players in lobby, but reset their game state
    let humanPlayers = (gs && gs.players) ? gs.players.filter(p => !p.isBot) : [];
    
    if (humanPlayers.length === 0) {
        players.push(new Player(0, myName, PLAYER_COLORS[0], false));
    } else {
        players = humanPlayers.map((p, idx) => new Player(idx, p.name, p.color, false));
        // Ensure our name matches what's in the input
        if (players[gameSync.localPlayerId]) {
            players[gameSync.localPlayerId].name = myName;
        }
    }

    // Append AI bots up to aiCount (Only for solo games)
    if (!gameSync.isMultiplayer) {
      for (let i = 0; i < aiCount; i++) {
          const nextIdx = players.length;
          players.push(new Player(nextIdx, `AI ${nextIdx}`, PLAYER_COLORS[nextIdx % PLAYER_COLORS.length], true));
      }
    }
  }

  // Final sanitization of IDs to match indices
  players.forEach((p, idx) => p.id = idx);

  gs = new GameState(board, players, winPoints, friendlyRobber, aiDifficulty, multiRobber, gameMode, expansionInterval, desertNewChance, desertDecayChance, brShrinkInterval, brGraceRotations, brDiscardLimit);
  gs.started = true;
  ren = new CanvasRenderer(canvas, board);
  inp = new InputHandler(canvas, board, gs, ren);
  setupTradeUI();

  menuOverlay.style.display = 'none';
  gameInterface.style.display = 'block';
  resize(); // Trigger resize to ensure canvas fits
  
  // Kickstart bots if player 0 is a bot
  if (players[0].isBot) {
    setTimeout(() => gs.aiInitial(), 1000);
  }
}

function drawDesertGraph(history) {
    const canvas = document.getElementById('desertGraph');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    
    // Smooth the line points for a better look
    const maxVal = Math.max(...history, 50); 
    const minVal = 0; 
    const range = maxVal || 1;

    ctx.clearRect(0, 0, w, h);
    
    // Grid lines (25%, 50%, 75%)
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    [0.25, 0.5, 0.75].forEach(p => {
        const y = h - h * p;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    });

    if (history.length < 1) return;

    // Draw the main line
    ctx.strokeStyle = '#f4a460';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    
    const getX = (i) => (i / Math.max(1, history.length - 1)) * (w - 30) + 15;
    const getY = (val) => h - ((val / range) * (h - 40)) - 20;

    history.forEach((val, i) => {
        const x = getX(i);
        const y = getY(val);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Fill underneath
    ctx.lineTo(getX(history.length - 1), h);
    ctx.lineTo(getX(0), h);
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(244, 164, 96, 0.3)');
    grad.addColorStop(1, 'rgba(244, 164, 96, 0)');
    ctx.fillStyle = grad;
    ctx.fill();
    
    // Points & Labels
    history.forEach((val, i) => {
        const x = getX(i);
        const y = getY(val);
        
        ctx.fillStyle = '#f4a460';
        ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
        
        // Show labels for first, last, and substantial changes
        if (i === 0 || i === history.length - 1 || Math.abs(history[i] - history[i-1]) > 5) {
            ctx.fillStyle = '#fff';
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`${val}%`, x, y - 10);
        }
    });
}

// --- BUTTON CLICK HANDLERS ---

// Navigation
const navBtns = {
    'showSingleplayerBtn': singleplayerMenu,
    'showMultiplayerBtn': multiplayerMenu,
    'showHostMenuBtn': hostMenu,
    'showJoinMenuBtn': joinMenu
};

Object.entries(navBtns).forEach(([id, screen]) => {
    const btn = document.getElementById(id);
    if (btn) btn.onclick = () => showScreen(screen);
});

const showStatsBtn = document.getElementById('showStatsBtn');
if (showStatsBtn) {
    showStatsBtn.onclick = () => {
        updateStatsUI();
        showScreen(statsMenu);
    };
}

const clearStatsBtn = document.getElementById('clearStatsBtn');
if (clearStatsBtn) {
    clearStatsBtn.onclick = () => {
        if (confirm("This will permanently ERASE all of your game records. Are you sure?")) {
            saveStats(DEFAULT_STATS);
            updateStatsUI();
            showToast("Records purged.", "info");
        }
    };
}

// Back buttons
document.querySelectorAll('.back-btn').forEach(btn => {
    btn.onclick = async () => {
        const currentId = btn.closest('.menu-card').id;
        if (currentId === 'singleplayer-menu' || currentId === 'multiplayer-choice-menu' || currentId === 'stats-menu') {
            showScreen(mainMenu);
        } else if (currentId === 'host-menu' || currentId === 'join-menu') {
            showScreen(multiplayerMenu);
        } else if (currentId === 'lobby-menu') {
            if (confirm("Leave this lobby?")) {
                await gameSync.abandonMatch();
                showScreen(multiplayerMenu);
            }
        }
    };
});

const startSoloBtn = document.getElementById('startSoloBtn');
if (startSoloBtn) {
    startSoloBtn.onclick = () => {
        const gm = document.getElementById('gameModeSolo').value;
        const config = {
            aiCount: parseInt(document.getElementById('aiCount').value),
            gameMode: gm,
            expansionInterval: document.getElementById('expansionIntervalSolo').value,
            desertNewChance: parseInt(document.getElementById('desertNewSolo').value) / 100,
            desertDecayChance: parseInt(document.getElementById('desertDecaySolo').value) / 100,
            brShrinkInterval: parseInt(document.getElementById('brShrinkIntervalSolo').value),
            brGraceRotations: parseInt(document.getElementById('brGraceSolo').value),
            brDiscardLimit: parseInt(document.getElementById('brDiscardSolo').value),
            boardRadius: (gm === 'Expanding Board (Experimental)') ? 2 : parseInt(document.getElementById('boardSizeSolo').value),
            winPoints: parseInt(document.getElementById('winPointsSolo').value),
            friendlyRobber: document.getElementById('friendlyRobberSolo').checked,
            multiRobber: document.getElementById('multiRobberSolo').checked,
            aiDifficulty: document.getElementById('aiDifficulty').value,
            onlyBots: document.getElementById('onlyBots').checked
        };

        const myName = document.getElementById('playerNameSolo').value.trim() || "Human";
        gameSync.isMultiplayer = false; 
        gameSync.isHost = true;
        gameSync.matchId = null;

        resetGame(config);
    };
}

const createMatchBtn = document.getElementById('createMatchBtn');
if (createMatchBtn) {
    createMatchBtn.onclick = async () => {
    const mid = document.getElementById('matchIdHost').value.trim();
    if (!mid) {
        showToast("Please enter a Match ID", "error");
        return;
    }
    
    const ok = await gameSync.init();
    if (!ok) {
        showToast("Firebase connection failed.", "error");
        return;
    }

    try {
        const gm = document.getElementById('gameModeHost').value;
        const initialConfig = {
            gameMode: gm,
            expansionInterval: document.getElementById('expansionIntervalHost').value,
            desertNewChance: parseInt(document.getElementById('desertNewHost').value) / 100,
            desertDecayChance: parseInt(document.getElementById('desertDecayHost').value) / 100,
            brShrinkInterval: parseInt(document.getElementById('brShrinkIntervalHost').value),
            brGraceRotations: parseInt(document.getElementById('brGraceHost').value),
            brDiscardLimit: parseInt(document.getElementById('brDiscardHost').value),
            boardRadius: (gm === 'Expanding Board (Experimental)') ? 2 : parseInt(document.getElementById('boardSizeHost').value),
            winPoints: parseInt(document.getElementById('winPointsHost').value),
            friendlyRobber: document.getElementById('friendlyRobberHost').checked,
            multiRobber: document.getElementById('multiRobberHost').checked,
            isPrivate: document.getElementById('privateMatchHost').checked
        };
        await gameSync.joinMatch(mid, (remoteGs) => {
            if (menuOverlay.style.display !== 'none') {
                showScreen(lobbyMenu);
                document.getElementById('lobbyMatchId').innerText = `Lobby: ${mid}`;
                const countEl = document.getElementById('playerCountDisplay');
                const humanCount = remoteGs.players.filter(p => p && !p.isBot).length;
                countEl.innerText = `${humanCount} Player${humanCount !== 1 ? 's' : ''} Connected`;
                countEl.style.display = 'block';
                
                // Guests don't see Start Game button
                startGameBtn.style.display = gameSync.isHost ? 'block' : 'none';
            }

            if (!gs) {
                gs = remoteGs;
                ren = new CanvasRenderer(canvas, gs.board);
                inp = new InputHandler(canvas, gs.board, gs, ren);
                setupTradeUI();
                if (gs.started) {
                    menuOverlay.style.display = 'none';
                    gameInterface.style.display = 'block';
                    resize();
                }
            } else {
                gs.fromJSON(remoteGs.toJSON());
                if (gs.started && menuOverlay.style.display !== 'none') {
                    menuOverlay.style.display = 'none';
                    gameInterface.style.display = 'block';
                    resize();
                }
            }
        }, false, initialConfig);
    } catch (e) {
        showToast(e.message, "error");
    }
    };
}

document.getElementById('joinConfirmBtn').onclick = async () => {
    const mid = document.getElementById('matchIdJoin').value.trim();
    if (!mid) {
        showToast("Please enter a Match ID", "error");
        return;
    }
    
    const ok = await gameSync.init();
    if (!ok) {
        showToast("Firebase connection failed.", "error");
        return;
    }

    try {
        // Use the mustExist flag here
        await gameSync.joinMatch(mid, (remoteGs) => {
            if (menuOverlay.style.display !== 'none') {
                showScreen(lobbyMenu);
                document.getElementById('lobbyMatchId').innerText = `Lobby: ${mid}`;
                const countEl = document.getElementById('playerCountDisplay');
                const humanCount = remoteGs.players.filter(p => p && !p.isBot).length;
                countEl.innerText = `${humanCount} Player${humanCount !== 1 ? 's' : ''} Connected`;
                countEl.style.display = 'block';

                // Guests don't see Start Game button
                startGameBtn.style.display = gameSync.isHost ? 'block' : 'none';
            }

            if (!gs) {
                gs = remoteGs;
                ren = new CanvasRenderer(canvas, gs.board);
                inp = new InputHandler(canvas, gs.board, gs, ren);
                setupTradeUI();
                if (gs.started) {
                    menuOverlay.style.display = 'none';
                    gameInterface.style.display = 'block';
                    resize();
                }
            } else {
                gs.fromJSON(remoteGs.toJSON());
                if (gs.started && menuOverlay.style.display !== 'none') {
                    menuOverlay.style.display = 'none';
                    gameInterface.style.display = 'block';
                    resize();
                }
            }
        }, true);
    } catch (e) {
        showToast(e.message, "error");
    }
};

startGameBtn.onclick = async () => {
  const gm = document.getElementById('gameModeHost').value;
  const config = {
    aiCount: 0,
    gameMode: gm,
    expansionInterval: document.getElementById('expansionIntervalHost').value,
    desertNewChance: parseInt(document.getElementById('desertNewHost').value) / 100,
    desertDecayChance: parseInt(document.getElementById('desertDecayHost').value) / 100,
    brShrinkInterval: parseInt(document.getElementById('brShrinkIntervalHost').value),
    brGraceRotations: parseInt(document.getElementById('brGraceHost').value),
    brDiscardLimit: parseInt(document.getElementById('brDiscardHost').value),
    boardRadius: (gm === 'Expanding Board (Experimental)') ? 2 : parseInt(document.getElementById('boardSizeHost').value),
    winPoints: parseInt(document.getElementById('winPointsHost').value),
    friendlyRobber: document.getElementById('friendlyRobberHost').checked,
    multiRobber: document.getElementById('multiRobberHost').checked,
    aiDifficulty: 'Skilled',
    onlyBots: false
  };

  if (!gameSync.isHost) {
      showToast("Only the host can start the game.", "error");
      return;
  }
  
  gameSync.isMultiplayer = true;
  resetGame(config);
  await gameSync.update(gs);
};

document.getElementById('replayBtn').onclick = () => {
  if (lastGameConfig) {
      resetGame(lastGameConfig);
  }
};


document.getElementById('newGameBtn').onclick = () => {
  gs = null;
  gameInterface.style.display = 'none';
  menuOverlay.style.display = 'flex';
  showScreen(mainMenu);
};

const handleAbandon = async () => {
    if (confirm(gameSync.isHost ? "Are you sure? This will end the game for everyone!" : "Are you sure you want to leave?")) {
        // Record as a loss if it's a game we're currently in
        if (gs && !gs.winner) {
            recordGameResult(gs);
        }
        
        await gameSync.abandonMatch();
        gs = null;
        gameInterface.style.display = 'none';
        menuOverlay.style.display = 'flex';
        showScreen(mainMenu);
    }
};

document.getElementById('lobbyAbandonBtn').onclick = handleAbandon;
document.getElementById('gameAbandonBtn').onclick = handleAbandon;

// --- Game Browser Logic ---
async function refreshGameBrowser() {
    const listEl = document.getElementById('game-list');
    const btn = document.getElementById('refreshGamesBtn');
    if (!listEl || !btn) return;

    btn.innerText = "Searching...";
    btn.disabled = true;

    try {
        const matches = await gameSync.getPublicMatches();
        listEl.innerHTML = '';

        if (matches.length === 0) {
            listEl.innerHTML = '<p style="color: #666; font-size: 11px; text-align: center; margin: 10px 0;">No active games found.</p>';
        } else {
            matches.forEach(m => {
                const playerCap = { '1': 3, '2': 4, '3': 6, '4': 8, '5': 10, '19': 38 };
                const max = playerCap[m.radius] || 6;
                const isFull = m.playerCount >= max;

                const item = document.createElement('div');
                item.style.padding = '8px';
                item.style.marginBottom = '5px';
                item.style.background = 'rgba(255,255,255,0.05)';
                item.style.borderRadius = '4px';
                item.style.display = 'flex';
                item.style.alignItems = 'center';
                item.style.justifyContent = 'space-between';
                item.style.cursor = isFull && !m.started ? 'not-allowed' : 'pointer';
                item.style.transition = 'background 0.2s';
                
                // Change background on hover if not full
                if (!isFull || m.started) {
                  item.onmouseenter = () => item.style.background = 'rgba(255,255,255,0.15)';
                  item.onmouseleave = () => item.style.background = 'rgba(255,255,255,0.05)';
                }

                const info = document.createElement('div');
                info.innerHTML = `
                    <div style="font-weight: bold; font-size: 13px; color: #3498db;">${m.id} <span style="font-weight: normal; color: #7f8c8d; font-size: 11px;">(Host: ${m.host})</span></div>
                    <div style="font-size: 10px; color: #aaa;">${m.mode} • ${m.playerCount}/${max} Players ${m.started ? '<b style="color:#e74c3c;">(Started)</b>' : '<b style="color:#2ecc71;">(Lobby)</b>'}</div>
                `;

                const joinBtn = document.createElement('button');
                joinBtn.innerText = isFull && !m.started ? "Full" : "Join";
                joinBtn.style.padding = '4px 8px';
                joinBtn.style.fontSize = '10px';
                joinBtn.style.background = (m.started || isFull) ? '#7f8c8d' : '#2ecc71';
                joinBtn.disabled = m.started || isFull;

                item.onclick = () => {
                   if (!m.started && !isFull) {
                     document.getElementById('matchIdJoin').value = m.id;
                     document.getElementById('joinConfirmBtn').click();
                   }
                };

                item.appendChild(info);
                item.appendChild(joinBtn);
                listEl.appendChild(item);
            });
        }
    } catch (e) {
        showToast("Failed to refresh games.", "error");
    } finally {
        btn.innerText = "Refresh List";
        btn.disabled = false;
    }
}

document.getElementById('refreshGamesBtn').onclick = refreshGameBrowser;

// --- Game Execution ---

rollBtn.onclick = async () => { 
  if(gs && !gs.currentPlayer.isBot && !gs.hasRolled && !gs.movingRobber) {
    gs.rollDice(); 
    if(gameSync.isMultiplayer) await gameSync.update(gs, true);
  }
};
endBtn.onclick = async () => { 
  if(gs && !gs.currentPlayer.isBot && gs.hasRolled && !gs.movingRobber) {
    gs.nextTurn(); 
    if(gameSync.isMultiplayer) await gameSync.update(gs, true);
  }
};
document.getElementById('resetCamBtn').onclick = () => { if(ren) { ren.camera = { x: 0, y: 0, zoom: 1.0 }; } };

// Handle accidental disconnects for guests
window.addEventListener('beforeunload', (e) => {
    // 1. Only warn and record if there is an ongoing game with human players
    if (gs && gs.started && !gs.winner) {
        const hasHuman = gs.players.filter(p => p.id !== -1).some(p => !p.isBot);
        if (hasHuman) {
            // Logic for marking statistics as a loss, fulfilling the "same as abandoning" requirement
            // Record now; if they cancel, they were already warned it counts as an abandonment.
            recordGameResult(gs);

            // Trigger the browser's standard confirmation dialog
            const warnMsg = "Refreshing or leaving will exit your current match and count it as an abandonment/loss. Your statistics will reflect this immediately.";
            e.preventDefault();
            e.returnValue = warnMsg;
        }
    }

    if (gameSync.isMultiplayer && gs) {
        // If host, this will (attempt to) delete the match. If guest, it reverts them to a bot.
        // Even if the async call doesn't finish, we rely on the next load's detection to clean up.
        gameSync.abandonMatch();
    }
});

// Auto-Sync on Page Load
(async function checkStoredSession() {
    const session = JSON.parse(sessionStorage.getItem('hexbound_session'));
    if (!session) return;
    
    // If the player was the host, we'll follow the rule to "abandon" (cancel the saved session and go to menu)
    // This wipes the match-to-be-abandoned or lets the host start over cleanly.
    if (session.isHost) {
        console.log("Host refresh detected. Cleaning up...");
        const ok = await gameSync.init();
        if (ok) {
            gameSync.matchId = session.matchId;
            gameSync.gameRef = gameSync.db.collection('matches').doc(session.matchId);
            gameSync.isHost = true;
            await gameSync.abandonMatch(); // Deletes match from DB and clears local storage
            console.log("Legacy host match deleted.");
        }
        return;
    }

    // If the player was a guest, we attempt to auto-rejoin
    const ok = await gameSync.init();
    if (!ok) return;

    // Simulate clicking the SYNC button
    const mIdInput = document.getElementById('matchIdJoin');
    const pNameInput = document.getElementById('playerNameJoin');
    const joinBtn = document.getElementById('joinConfirmBtn');

    if (mIdInput && pNameInput && joinBtn) {
        mIdInput.value = session.matchId;
        pNameInput.value = session.playerName;
        joinBtn.onclick();
    }
})();

function loop() {
  requestAnimationFrame(loop);
  if (!gs) {
      // Keep UI elements hidden if no game is active
      gameInterface.style.display = 'none';
      return;
  }
  ren.render(gs, inp.hover);

  const isHumanTurn = gs.currentPlayerIdx === gameSync.localPlayerId && !gs.currentPlayer.isBot;
  const inRobberActions = gs.movingRobber || gs.waitingToPickVictim;
  const inDiscardActions = gs.waitingForDiscards.length > 0;
  const isWinning = gs.winner !== null;

  // Update turn indicator UI
  const turnIndicator = document.getElementById('turn-indicator');
  const turnText = document.getElementById('turn-text');
  const turnDot = document.getElementById('turn-color-dot');
  
  if (gs && !isWinning) {
      turnIndicator.style.display = 'flex';
      const activeP = gs.currentPlayer;
      
      if (isHumanTurn) {
          // Extra visual feedback when it's your turn (unless it's just a bot simulation)
          turnIndicator.className = isOnlyBotsMode ? '' : 'your-turn';
          turnText.innerText = "YOUR TURN";
      } else {
          turnIndicator.className = '';
          turnText.innerText = `${activeP.name.toUpperCase()}'S TURN`;
      }
      turnDot.style.backgroundColor = activeP.color;
  } else {
      turnIndicator.style.display = 'none';
  }

  const inTradeActions = gs.activeTrade !== null || isProposingTrade || isTradingWithBank;
  const resources = ['WOOD', 'BRICK', 'SHEEP', 'WHEAT', 'ORE'];

  const canTradeBank = isHumanTurn && resources.some(r => gs.currentPlayer.resources[r] >= gs.getTradeRate(gs.currentPlayer, r));
  const canTradePlayer = isHumanTurn && Object.values(gs.currentPlayer.resources).some(v => v > 0);

  rollBtn.disabled = gs.phase!=='PLAY' || !isHumanTurn || gs.hasRolled || inRobberActions || inTradeActions || inDiscardActions || isWinning || gs.pendingRoads > 0;
  endBtn.disabled = gs.phase!=='PLAY' || !isHumanTurn || !gs.hasRolled || inRobberActions || inTradeActions || inDiscardActions || isWinning || gs.pendingRoads > 0;
  bankTradeBtn.disabled = !canTradeBank || gs.phase!=='PLAY' || !isHumanTurn || !gs.hasRolled || inRobberActions || isTradingWithBank || isProposingTrade || inDiscardActions || isWinning || gs.pendingRoads > 0;
  tradeBtn.disabled = !canTradePlayer || gs.phase!=='PLAY' || !isHumanTurn || !gs.hasRolled || inRobberActions || isProposingTrade || isTradingWithBank || inDiscardActions || isWinning || gs.pendingRoads > 0;
  
  tradePanel.style.display = (gs.phase === 'PLAY' && isHumanTurn && !inRobberActions && !inDiscardActions && isTradingWithBank && !isWinning) ? 'flex' : 'none';
  playerTradePanel.style.display = (gs.phase === 'PLAY' && isHumanTurn && !inRobberActions && !inDiscardActions && isProposingTrade && !isWinning) ? 'flex' : 'none';
  robberPanel.style.display = (gs.phase === 'PLAY' && isHumanTurn && gs.waitingToPickVictim && !isWinning) ? 'flex' : 'none';
  const humanInDiscard = gs.waitingForDiscards.includes(gameSync.localPlayerId) && !isOnlyBotsMode;
  if (humanInDiscard && discardPanel.style.display === 'none' && !isWinning) {
      const p = gs.players[gameSync.localPlayerId];
      if (p) {
        const tr = Object.values(p.resources).reduce((a, b) => a + b, 0);
        if (tr > 0) setupDiscardUI(Math.ceil(tr / 2));
      }
  }
  discardPanel.style.display = (humanInDiscard && !isWinning) ? 'flex' : 'none';
  
  if (isWinning) {
      recordGameResult(gs);

      if (victoryPanel.style.display !== 'flex') {
          victoryPanel.style.display = 'flex';
          const victNameEl = document.getElementById('victory-name');
          const turnCountEl = document.getElementById('victory-turns');
          
          if (gs.winner.isEnvironment) {
              victNameEl.innerText = "THE DESERT WINS!";
              victNameEl.style.color = "#f4a460";
              victNameEl.style.textShadow = "0 0 20px rgba(244, 164, 96, 0.5)";
          } else if (gs.gameMode === 'Battle Royale') {
              victNameEl.innerText = `${gs.winner.name.toUpperCase()} REACHED THE CENTER!`;
              victNameEl.style.color = "gold";
              victNameEl.style.textShadow = "0 0 20px rgba(255, 215, 0, 0.5)";
          } else {
              victNameEl.innerText = `${gs.winner.name.toUpperCase()} WINS!`;
              victNameEl.style.color = "gold";
              victNameEl.style.textShadow = "0 0 20px rgba(255, 215, 0, 0.5)";
          }

          turnCountEl.innerText = `The game lasted ${gs.totalTurns} turns (${gs.rotations} rounds).`;
          turnCountEl.style.display = 'block';
          
          const graphContainer = document.getElementById('desert-graph-container');
          if (gs.gameMode === 'Expanding Board (Experimental)' && gs.desertHistory && gs.desertHistory.length > 1) {
              graphContainer.style.display = 'flex';
              drawDesertGraph(gs.desertHistory);
          } else {
              graphContainer.style.display = 'none';
          }
      }
  } else {
      victoryPanel.style.display = 'none';
  }

  // Handle Player Trade Panel visibility
  if (gs.activeTrade && !isWinning) {
      // In Only Bots mode, we should never show human trade UI
      const isTargetLocalHuman = gs.activeTrade.targetId === gameSync.localPlayerId && !isOnlyBotsMode;
      if (isTargetLocalHuman && !inDiscardActions) {
          tradeOfferPanel.style.display = 'flex';
          document.getElementById('trade-offer-player').innerText = `${gs.players[gs.activeTrade.senderId].name} wants to trade!`;
          const giveStr = Object.entries(gs.activeTrade.give).map(([r, a]) => `${a} ${r}`).join(', ');
          const getStr = Object.entries(gs.activeTrade.get).map(([r, a]) => `${a} ${r}`).join(', ');
          document.getElementById('trade-offer-give').innerText = giveStr;
          document.getElementById('trade-offer-get').innerText = getStr;
          document.getElementById('trade-timer-bar').style.width = `${(gs.activeTrade.timeRemaining / 20) * 100}%`;
      } else {
          tradeOfferPanel.style.display = 'none';
      }
  } else {
      tradeOfferPanel.style.display = 'none';
  }
}

requestAnimationFrame(loop);
