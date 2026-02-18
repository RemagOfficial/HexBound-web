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
    return {
      radius: this.radius,
      hexes: Object.fromEntries(this.hexes),
      vertices: Object.fromEntries(Array.from(this.vertices.entries()).map(([k, v]) => [k, { 
          id: v.id, x: v.x, y: v.y, ownerId: v.ownerId, isCity: v.isCity, 
          port: v.port, hexes: v.hexes.map(h => `${h.q},${h.r}`) 
      }])),
      edges: Object.fromEntries(Array.from(this.edges.entries()).map(([k, v]) => [k, { 
          id: v.id, v1: v.v1, v2: v.v2, ownerId: v.ownerId 
      }])),
      ports: Object.fromEntries(this.ports)
    };
  }

  fromJSON(data) {
    this.hexes = new Map(Object.entries(data.hexes));
    this.vertices = new Map(Object.entries(data.vertices).map(([k, v]) => {
        const vertex = new Vertex(v.id, v.x, v.y);
        vertex.ownerId = v.ownerId;
        vertex.isCity = v.isCity;
        vertex.port = v.port;
        vertex._tempHexKeys = v.hexes;
        return [k, vertex];
    }));
    this.edges = new Map(Object.entries(data.edges).map(([k, v]) => {
        const edge = new Edge(v.id, v.v1, v.v2);
        edge.ownerId = v.ownerId;
        return [k, edge];
    }));
    this.ports = new Map(Object.entries(data.ports));

    // Re-link vertex hexes
    this.vertices.forEach(v => {
        v.hexes = v._tempHexKeys.map(key => this.hexes.get(key));
        delete v._tempHexKeys;
    });
  }

  static fromJSON(data) {
    const board = new Board(data.radius);
    board.fromJSON(data);
    return board;
  }

  generateBoard() {
    const totalHexes = 3 * this.radius * (this.radius + 1) + 1;
    const terrainTypes = Object.values(HEX_TYPES).filter(t => t.name !== 'Water');
    
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
  }

  toJSON() {
    return { ...this };
  }

  fromJSON(data) {
    Object.assign(this, data);
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
    if (longestRoadHolderId === this.id) this.visibleVP += 2;
    if (largestArmyHolderId === this.id) this.visibleVP += 2;
    this.victoryPoints = this.visibleVP + vpCardsCount;
    return this.victoryPoints; 
  }
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
  constructor(board, players, targetScore = 10, friendlyRobber = false, aiDifficulty = 'Normal') {
    this.board = board; this.players = players; this.currentPlayerIdx = 0;
    this.targetScore = targetScore; this.friendlyRobber = friendlyRobber;
    this.aiDifficulty = aiDifficulty;
    this.phase = 'INITIAL'; this.dice = [1, 1]; this.history = [];
    this.initialPlacements = 0; this.winner = null; this.hasRolled = false;
    this.pendingSettlement = null; this.movingRobber = false;
    this.waitingToPickVictim = false;
    this.longestRoadHolderId = null;
    this.longestRoadLength = 4; 
    this.robberHexId = Array.from(board.hexes.keys()).find(k => board.hexes.get(k).terrain === HEX_TYPES.DESERT);
    this.diceAnim = { value: [1, 1], timer: 0 };
    this.activeTrade = null;
    this.tradeTimer = null;
    this.turnToken = 0;
    this.waitingForDiscards = []; // Array of ids who must discard
    this.aiTradeAttempts = 0; // Track AI trade attempts per turn
    this.playedDevCardThisTurn = false;
    this.pendingRoads = 0;
    
    // Bank Resources initialization
    const resCount = (this.players.length > 4) ? 24 : 19;
    this.bankResources = { WOOD: resCount, BRICK: resCount, SHEEP: resCount, WHEAT: resCount, ORE: resCount };

    // Development Cards Deck
    this.devCardDeck = [];
    const isLargeGame = this.players.length > 4;
    const knightCount = isLargeGame ? 20 : 14;
    const progressCount = isLargeGame ? 3 : 2;
    const vpCount = 5;

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
  }

  toJSON() {
    return {
      ...this,
      board: this.board.toJSON(),
      players: this.players.map(p => p.toJSON())
    };
  }

  fromJSON(data) {
    this.board.fromJSON(data.board);
    data.players.forEach((pData, idx) => {
        this.players[idx].fromJSON(pData);
    });
    // Copy other fields
    Object.keys(data).forEach(key => {
        if (key !== 'board' && key !== 'players' && typeof data[key] !== 'function') {
            this[key] = data[key];
        }
    });
  }

  static fromJSON(data) {
    const board = Board.fromJSON(data.board);
    const players = data.players.map(pData => Player.fromJSON(pData));
    const gs = new GameState(board, players, data.targetScore, data.friendlyRobber, data.aiDifficulty);
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
    this.log(`${p.name} played a ${card.name} card`);

    switch (card.type) {
      case 'KNIGHT':
        p.playedKnights++;
        this.movingRobber = true;
        this.waitingToPickVictim = true;
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
    this.players.forEach(p => {
      if (p.playedKnights > this.largestArmySize) {
        this.largestArmySize = p.playedKnights;
        if (this.largestArmyHolderId !== p.id) {
            this.largestArmyHolderId = p.id;
            this.log(`${p.name} is now the Largest Army Holder!`);
        }
      }
    });
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
        this.giveResources(this.players[0], res1, 1);
        setTimeout(() => {
            this.openResourcePicker("Pick 2nd Resource", (res2) => {
                this.giveResources(this.players[0], res2, 1);
                setupTradeUI();
                setupDevCardUI();
            });
        }, 300);
    });
  }

  showMonopolyMenu() {
    this.openResourcePicker("Pick Resource to Steal", (res) => {
        this.monopolyResource(this.players[0], res);
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
    this.currentPlayerIdx = (this.currentPlayerIdx + 1) % this.players.length;
    this.hasRolled = false;
    this.aiTradeAttempts = 0; // Reset for the next player
    this.playedDevCardThisTurn = false;
    
    // Clear any leftover trades from previous turn
    if (this.activeTrade) this.clearTrade();

    this.players.forEach(p => p.calculateVP(this.longestRoadHolderId, this.largestArmyHolderId));
    this.checkWinner();
    if (this.winner) return;

    this.log(`${this.currentPlayer.name}'s turn`);
    
    // Check if Human trade UI should show
    if (!this.currentPlayer.isBot && typeof setupTradeUI === 'function') {
        setupTradeUI();
    }
    
    // Multiplayer Sync on Turn Change
    if (gameSync.isMultiplayer && gameSync.isHost) gameSync.update(this, true);

    if (this.currentPlayer.isBot && !this.winner) {
      const token = this.turnToken;
      setTimeout(() => { if (token === this.turnToken) this.aiTurn(); }, 1000);
    }
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
        if (ourHexes.includes(this.robberHexId)) {
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
        const allEdges = Array.from(this.board.edges.keys()).filter(e => Rules.canPlaceRoad(this.board, e, p));
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
    if (diff === 'Beginner' && initialTotal <= 7 && Math.random() > 0.8) return;

    while (madeAction && loops < 20) {
        madeAction = false;
        loops++;

        // Don't take actions if we're currently waiting for a trade
        if (this.activeTrade) return;

        const resources = ['WOOD', 'BRICK', 'SHEEP', 'WHEAT', 'ORE'];
        const totalRes = Object.values(p.resources).reduce((a, b) => a + b, 0);
        const overLimit = totalRes > 7;

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

        // If over 7 resources, Skilled/Master bots will also focus on anything they are missing to burn resources
        if (overLimit && diff !== 'Beginner') {
            // Also need Road components if we have high surplus to burn
            if (p.resources.WOOD < 1) needs.push('WOOD');
            if (p.resources.BRICK < 1) needs.push('BRICK');
            
            resources.forEach(r => {
                if (p.resources[r] === 0 && !needs.includes(r)) needs.push(r);
            });
            // If still no needs or just over limit, pick anything that isn't the surplus we might trade
            if (needs.length === 0 || totalRes > 9) {
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
        if (p.canAfford(COSTS.CITY) && p.settlements.length > 0) {
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

        // 3. BUILD SETTLEMENT
        if (p.canAfford(COSTS.SETTLEMENT)) {
            const allVertices = Array.from(this.board.vertices.keys()).filter(v => Rules.canPlaceSettlement(this.board, v, p, 'PLAY'));
            if (allVertices.length > 0) {
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
            const allEdges = Array.from(this.board.edges.keys()).filter(e => Rules.canPlaceRoad(this.board, e, p));
            if (allEdges.length > 0) {
                // Check if we currently have a valid spot to build a settlement
                const hasSettlementSpot = Array.from(this.board.vertices.keys()).some(v => Rules.canPlaceSettlement(this.board, v, p, 'PLAY'));
                
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
                const canSaveForSettlement = hasSettlementSpot && missingSetRes && !prioritizeRoad;

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
                        continue;
                    }
                }

                let bestE;
                if (diff === 'Master') {
                    bestE = allEdges.reduce((max, curr) => {
                        const e_curr = this.board.getEdge(curr), e_max = this.board.getEdge(max);
                        const val_curr = Math.max(this.getVertexValue(e_curr.v1), this.getVertexValue(e_curr.v2));
                        const val_max = Math.max(this.getVertexValue(e_max.v1), this.getVertexValue(e_max.v2));
                        return val_curr > val_max ? curr : max;
                    });
                } else {
                    bestE = allEdges[Math.floor(Math.random() * allEdges.length)];
                }
                this.build('ROAD', bestE);
                madeAction = true;
                continue;
            }
        }

        // 5. BUY DEV CARD
        if (p.canAfford(COSTS.DEV_CARD) && this.devCardDeck.length > 0) {
            // Master AI will buy cards more aggressively if they have excess resources
            let shouldBuy = (diff === 'Master') ? true : (diff === 'Skilled' ? Math.random() > 0.4 : Math.random() > 0.7);
            
            // If we are over limit, the bot is more likely to buy a card to burn resources
            if (overLimit) shouldBuy = true;

            // Don't buy if saving for a city/settlement unless over limit
            if (shouldBuy && (!needs.includes('ORE') && !needs.includes('SHEEP') && !needs.includes('WHEAT') || overLimit)) {
                if (this.buyDevCard(p)) {
                    madeAction = true;
                    continue;
                }
            }
        }

        // 6. PANIC/FEAR TRADE (Only if over limit and nothing else worked)
        if (!madeAction && overLimit) {
            let panicChance = (diff === 'Master') ? 1.0 : (diff === 'Skilled' ? 0.5 : 0.1);
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
    this.diceAnim = { value: [...this.dice], timer: 102 };
    const tot = this.dice[0] + this.dice[1];
    this.log(`${this.currentPlayer.name} rolled ${tot}`);
    this.hasRolled = true;
    if (typeof setupTradeUI === 'function') setupTradeUI();

    if (tot === 7) {
      this.log('Roll 7!');
      this.waitingForDiscards = [];
      this.players.forEach(p => {
        const totalRes = Object.values(p.resources).reduce((a,b) => a+b, 0);
        if (totalRes > 7) {
            const count = Math.floor(totalRes / 2);
            this.waitingForDiscards.push(p.id);
            if (p.isBot) {
                setTimeout(() => this.aiDiscard(p.id, count), 1000 + Math.random() * 1000);
            }
        }
      });
      
      if (this.waitingForDiscards.length > 0) {
          const humanNeedsDiscard = this.waitingForDiscards.includes(0) && !isOnlyBotsMode;
          if (humanNeedsDiscard) {
              const totalRes = Object.values(this.players[0].resources).reduce((a,b) => a+b, 0);
              if (typeof setupDiscardUI === 'function') setupDiscardUI(Math.floor(totalRes / 2));
          }
      } else {
          this.startRobberPhase();
      }
    } else {
      this.board.hexes.forEach((h, id) => {
        if (h.number === tot && id !== this.robberHexId) {
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
    } else {
      this.aiMoveRobber();
    }
  }

  aiMoveRobber() {
    if (gameSync.isMultiplayer && !gameSync.isHost) return;
    const hexKeys = Array.from(this.board.hexes.keys()).filter(k => k !== this.robberHexId);
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
    if (hexId === this.robberHexId) return;
    this.robberHexId = hexId;
    this.movingRobber = false;
    const h = this.board.hexes.get(hexId);
    this.log(`Robber moved to ${h.terrain.name}`);

    // Find players to rob
    const victims = [];
    h.vertices.forEach(vk => {
      const v = this.board.getVertex(vk);
      if (v.ownerId !== null && v.ownerId !== this.currentPlayerIdx) {
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

    if (victims.length === 0) {
      this.log("No valid players to rob.");
      return;
    }

    if (!this.currentPlayer.isBot) {
      // Human selection
      if (victims.length === 1) {
        this.robPlayer(victims[0]);
      } else {
        this.waitingToPickVictim = true;
        if (typeof setupRobberUI === 'function') setupRobberUI(victims);
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
    if (resTypes.length === 0) return;

    const r = resTypes[Math.floor(Math.random() * resTypes.length)];
    target.resources[r]--;
    this.currentPlayer.resources[r]++;
    this.log(`${this.currentPlayer.name} stole 1 ${r} from ${target.name}`);
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
        if (this.board.getVertex(id).ownerId === null) {
          const v = this.board.getVertex(id);
          v.ownerId = p.id; p.settlements.push(id);
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
          this.updateLongestRoad();
          this.finishInitial();
          success = true;
        }
      }
    } else if (this.hasRolled) {
      if (type === 'SETTLEMENT' && p.canAfford(COSTS.SETTLEMENT) && Rules.canPlaceSettlement(this.board, id, p, 'PLAY')) {
        this.board.getVertex(id).ownerId = p.id; p.settlements.push(id); this.returnResources(p, COSTS.SETTLEMENT); this.log('Built Settlement');
        success = true;
      } else if (type === 'ROAD' && p.canAfford(COSTS.ROAD) && Rules.canPlaceRoad(this.board, id, p)) {
        this.board.getEdge(id).ownerId = p.id; p.roads.push(id); this.returnResources(p, COSTS.ROAD); this.log('Built Road');
        this.updateLongestRoad();
        success = true;
      } else if (type === 'CITY' && p.canAfford(COSTS.CITY)) {
        const v = this.board.getVertex(id);
        if (v.ownerId === p.id && !v.isCity) { 
            v.isCity = true; p.cities.push(id); p.settlements = p.settlements.filter(s => s !== id); 
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
      Rules.canPlaceSettlement(this.board, k, this.currentPlayer, 'INITIAL')
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
        this.players.forEach(p => p.calculateVP(this.longestRoadHolderId));
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

  checkWinner() { 
    this.players.forEach(p => { 
        if (p.calculateVP(this.longestRoadHolderId, this.largestArmyHolderId) >= this.targetScore) {
            if (!this.winner) {
                this.winner = p;
                // If only bots mode, restart after 5 seconds
                const allBots = this.players.every(pl => pl.isBot);
                if (allBots) {
                    this.log(`Game Over! Restarting in 5s...`);
                    setTimeout(() => startGameBtn.onclick(), 5000);
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
    this.camera = { x: 0, y: 0, zoom: 1.0 };
    this.diceCanvas = document.getElementById('diceCanvas');
    this.diceCtx = this.diceCanvas ? this.diceCanvas.getContext('2d') : null;
  }
  render(gs, hover) {
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
    const isHumanTurn = !gs.currentPlayer.isBot;
    
    this.ctx.save();
    // Centralize and apply pan/zoom
    this.ctx.translate(this.canvas.width/2 + this.camera.x, this.canvas.height/2 + this.camera.y);
    this.ctx.scale(this.camera.zoom, this.camera.zoom);

    // Draw Sea Background (Dynamic buffer based on board radius)
    const seaBuffer = this.board.radius >= 3 ? 2.25 : 1.9;
    const seaSize = (this.board.radius + seaBuffer) * this.board.hexSize * 1.5;
    this.drawPoly(0, 0, 6, seaSize, HEX_TYPES.WATER.color, false);

    this.board.hexes.forEach((h, id) => {
      const p = this.board.hexToPixel(h.q, h.r);
      const px = p.x, py = p.y;
      this.drawPoly(px, py, 6, this.board.hexSize, h.terrain.color, isHumanTurn && hover?.id === `${h.q},${h.r}`);
      
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
      
      if (gs.robberHexId === id) {
        this.ctx.fillStyle = 'rgba(50,50,50,0.8)';
        this.ctx.beginPath(); this.ctx.arc(px, py + 10, 10, 0, Math.PI*2); this.ctx.fill();
        this.ctx.strokeStyle = '#fff'; this.ctx.lineWidth = 2; this.ctx.stroke();
      }
      if (gs.movingRobber && !gs.currentPlayer.isBot && gs.robberHexId !== id) {
        this.ctx.strokeStyle = 'cyan'; this.ctx.lineWidth = 3;
        this.ctx.setLineDash([5, 5]);
        this.ctx.beginPath(); this.ctx.arc(px, py, 40, 0, Math.PI*2); this.ctx.stroke();
        this.ctx.setLineDash([]);
      }
    });

    this.board.edges.forEach(e => {
      const v1 = this.board.getVertex(e.v1), v2 = this.board.getVertex(e.v2);
      const isOwned = e.ownerId !== null;
      const canAffordRoad = (gs.phase === 'INITIAL' && gs.pendingSettlement) || (gs.phase === 'PLAY' && gs.hasRolled && gs.currentPlayer.canAfford(COSTS.ROAD));
      
      let isValidRoad = false;
      if (isHumanTurn && !isOwned && canAffordRoad) {
        if (gs.phase === 'INITIAL') isValidRoad = (e.v1 === gs.pendingSettlement || e.v2 === gs.pendingSettlement);
        else isValidRoad = Rules.canPlaceRoad(this.board, e.id, gs.currentPlayer);
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

    this.board.ports.forEach(port => {
      const v1 = this.board.getVertex(port.v1);
      const v2 = this.board.getVertex(port.v2);
      const cx = (v1.x + v2.x) / 2, cy = (v1.y + v2.y) / 2;
      const angle = Math.atan2(cy, cx);
      const ox = Math.cos(angle) * 28, oy = Math.sin(angle) * 28;

      this.ctx.strokeStyle = 'rgba(255,255,255,0.6)'; this.ctx.lineWidth = 4;
      this.ctx.beginPath(); this.ctx.moveTo(v1.x, v1.y); this.ctx.lineTo(cx + ox, cy + oy); this.ctx.lineTo(v2.x, v2.y); this.ctx.stroke();

      this.ctx.fillStyle = (port.type === 'ALL') ? '#fff' : (HEX_TYPES[port.type]?.color || '#fff');
      this.ctx.beginPath(); this.ctx.arc(cx + ox, cy + oy, 8, 0, Math.PI * 2); this.ctx.fill();
      this.ctx.strokeStyle = '#000'; this.ctx.lineWidth = 1; this.ctx.stroke();
      
      this.ctx.fillStyle = '#000'; this.ctx.font = 'bold 8px Arial'; this.ctx.textAlign = 'center'; this.ctx.textBaseline = 'middle';
      this.ctx.fillText(port.type === 'ALL' ? '3:1' : '2:1', cx + ox, cy + oy);
    });

    this.board.vertices.forEach(v => {
        const px = v.x, py = v.y;
        const isOwned = v.ownerId !== null;
        const canAffordSettle = (gs.phase === 'INITIAL' && !gs.pendingSettlement) || (gs.phase === 'PLAY' && gs.hasRolled && gs.currentPlayer.canAfford(COSTS.SETTLEMENT));
        const canSettle = (isHumanTurn && !isOwned && canAffordSettle && Rules.canPlaceSettlement(this.board, v.id, gs.currentPlayer, gs.phase));
        const canUpgrade = (isHumanTurn && isOwned && v.ownerId === gs.currentPlayerIdx && !v.isCity && gs.currentPlayer.canAfford(COSTS.CITY) && gs.hasRolled);

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
        } else if (isHumanTurn && hover?.id === v.id) {
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
  drawPoly(x,y,s,sz,c,h) {
    this.ctx.fillStyle=c; this.ctx.strokeStyle=h?'yellow':'#000'; this.ctx.lineWidth=h?4:2;
    this.ctx.beginPath(); for(let i=0;i<s;i++){const a=2*Math.PI*i/s; this.ctx.lineTo(x+sz*Math.cos(a), y+sz*Math.sin(a));} this.ctx.closePath(); this.ctx.fill(); this.ctx.stroke();
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
    const ACTION_HEIGHT = isMobile ? 280 : 320;
    this.ctx.fillStyle = 'rgba(50,50,50,0.75)';
    this.ctx.fillRect(10, 10, ACTION_WIDTH, ACTION_HEIGHT);
    this.ctx.strokeStyle = '#fff'; this.ctx.lineWidth = 1; this.ctx.strokeRect(10, 10, ACTION_WIDTH, ACTION_HEIGHT);

    this.ctx.fillStyle = '#fff';
    this.ctx.font = isMobile ? 'bold 12px Arial' : 'bold 16px Arial';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';
    this.ctx.fillText('HEXBOUND', 20, 20);

    if (gs.movingRobber && !gs.currentPlayer.isBot) {
      this.ctx.fillStyle = '#f1c40f';
      this.ctx.font = isMobile ? 'bold 10px Arial' : 'bold 11px Arial';
      this.ctx.fillText('MOVE ROBBER', 20, isMobile ? 40 : 45);
    } else {
      this.ctx.font = isMobile ? '10px Arial' : '12px Arial';
      this.ctx.fillStyle = gs.currentPlayer.color;
      this.ctx.fillText(gs.currentPlayer.name, 20, isMobile ? 40 : 45);
    }

    let ly = isMobile ? 65 : 70;
    const human = gs.players[0];
    const humanTotal = Object.values(human.resources).reduce((a, b) => a + b, 0);
    
    this.ctx.fillStyle = humanTotal > 7 ? '#ff4444' : '#fff'; // Red if at risk
    this.ctx.font = isMobile ? 'bold 10px Arial' : 'bold 11px Arial';
    this.ctx.fillText(humanTotal > 7 ? 'YOUR RESOURCES: ⚠️' : 'YOUR RESOURCES:', 20, ly);
    
    this.ctx.font = isMobile ? '9px Arial' : '11px Arial';
    Object.entries(human.resources).forEach(([r, v]) => {
      ly += isMobile ? 12 : 15;
      this.ctx.fillText(`${r}: ${v}`, 30, ly);
    });

    ly += isMobile ? 15 : 20;
    this.ctx.fillStyle = '#aaa';
    this.ctx.font = isMobile ? 'bold 10px Arial' : 'bold 11px Arial';
    this.ctx.fillText('BANK RESOURCES:', 20, ly);
    this.ctx.font = isMobile ? '9px Arial' : '11px Arial';
    Object.entries(gs.bankResources).forEach(([r, v]) => {
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
      document.getElementById('abandonBtn').style.display = 'block';
    } else {
      document.getElementById('abandonBtn').style.display = 'none';
    }

    if (gs.friendlyRobber) {
      this.ctx.fillStyle = '#00ffcc';
      this.ctx.font = isMobile ? 'italic 9px Arial' : 'italic 10px Arial';
      this.ctx.fillText('🛡️ Friendly', 20, ACTION_HEIGHT - 10);
    }

    // --- RIGHT PANEL: GAME STATS ---
    const STATS_WIDTH = isMobile ? 180 : 240;
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

    // Header for Table
    this.ctx.font = isMobile ? '8px Arial' : '10px Arial';
    this.ctx.fillStyle = '#aaa';
    this.ctx.fillText('PLAYER', rx + 15, ry + (isMobile ? 30 : 40));
    this.ctx.fillText('VP', rx + (isMobile ? 100 : 120), ry + (isMobile ? 30 : 40));
    this.ctx.fillText('RD', rx + (isMobile ? 123 : 148), ry + (isMobile ? 30 : 40));
    this.ctx.fillText('DEV', rx + (isMobile ? 143 : 173), ry + (isMobile ? 30 : 40));
    this.ctx.fillText('RES', rx + (isMobile ? 168 : 203), ry + (isMobile ? 30 : 40));

    let py = ry + (isMobile ? 45 : 60);
    gs.players.forEach(p => {
      this.ctx.fillStyle = p.color;
      this.ctx.font = isMobile ? 'bold 10px Arial' : 'bold 12px Arial';
      let nameText = p.name;
      if (gs.longestRoadHolderId === p.id) nameText += ' 🏆';
      if (gs.largestArmyHolderId === p.id) nameText += ' ⚔️';
      this.ctx.fillText(nameText.substring(0, isMobile ? 10 : 12), rx + 15, py);
      
      this.ctx.fillStyle = '#fff';
      this.ctx.font = isMobile ? '10px Arial' : '12px Arial';
      
      let vpText = `${p.visibleVP}`;
      const vpCardsCount = p.devCards.filter(c => c.type === 'VP').length;
      if (vpCardsCount > 0 && (p.id === 0 || gs.winner)) {
        vpText += ` (${p.visibleVP + vpCardsCount})`;
      }
      this.ctx.fillText(vpText, rx + (isMobile ? 100 : 120), py);

      this.ctx.fillText(gs.calculateLongestPath(p.id), rx + (isMobile ? 123 : 148), py);
      this.ctx.fillText(p.devCards.length.toString(), rx + (isMobile ? 143 : 173), py);
      const totalRes = Object.values(p.resources).reduce((a, b) => a + b, 0);
      
      if (totalRes > 7) {
        this.ctx.fillStyle = '#ff4444'; // Red for danger
        this.ctx.font = isMobile ? 'bold 10px Arial' : 'bold 12px Arial';
        this.ctx.fillText(totalRes + ' ⚠️', rx + (isMobile ? 168 : 203), py);
      } else {
        this.ctx.fillStyle = '#fff';
        this.ctx.fillText(totalRes, rx + (isMobile ? 168 : 203), py);
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
          const displayLog = h.length > 40 ? h.substring(0, 37) + '...' : h;
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
        const delta = dist - this.lastTouchDist;
        const zoomSpeed = 0.01;
        const oldZoom = this.ren.camera.zoom;
        const newZoom = Math.min(Math.max(0.3, oldZoom + delta * zoomSpeed), 3.0);
        
        this.ren.camera.zoom = newZoom;
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

  async click() {
    if(!this.gs || this.gs.currentPlayer.isBot || !this.hover) return;
    
    // Block interaction if any modal is active
    if (this.isAnyModalVisible()) return;
    
    let stateChanged = false;
    if(this.gs.movingRobber) {
        if(this.hover.type==='hex') {
            if (this.hover.id === this.gs.robberHexId) {
                this.gs.log('Robber must move to a different hex.');
                return;
            }
            const h = this.board.hexes.get(this.hover.id);

            if(this.gs.friendlyRobber) {
                const affected = h.vertices.some(vk => {
                    const v = this.board.getVertex(vk);
                    // Friendly Robber: Cannot place on hex affecting ANY other player with <= 2 points
                    return v.ownerId !== null && v.ownerId !== 0 && this.gs.players[v.ownerId].victoryPoints <= 2;
                });
                if(affected) { 
                    this.gs.log('Friendly Robber: Cannot target players with <= 2 points.'); 
                    return; 
                }
            }
            this.gs.moveRobber(this.hover.id);
            stateChanged = true;
        }
    } else if (this.gs.pendingRoads > 0) {
        if (this.hover.type === 'edge') {
            const e = this.board.getEdge(this.hover.id);
            if (e.ownerId === null && Rules.canPlaceRoad(this.board, this.hover.id, this.gs.players[0])) {
                e.ownerId = 0; 
                this.gs.players[0].roads.push(this.hover.id);
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
const boardSizeSelect = document.getElementById('boardSize');
const aiCountSelect = document.getElementById('aiCount');
const winPointsInput = document.getElementById('winPoints');
const winPointsValue = document.getElementById('winPointsValue');
const winLimitHint = document.getElementById('winLimitHint');

function updateMenuOptions() {
  const isLarge = boardSizeSelect.value === '3';
  
  // Restriction: 4 and 5 bots only on Large (3)
  Array.from(aiCountSelect.options).forEach(opt => {
    const val = parseInt(opt.value);
    if (val > 3) {
      opt.disabled = !isLarge;
      opt.style.display = isLarge ? 'block' : 'none';
    }
  });
  
  // If current AI selection is now invalid, snap back to 3
  if (!isLarge && parseInt(aiCountSelect.value) > 3) {
    aiCountSelect.value = '3';
  }

  // Update win point limits
  const limits = { '1': 8, '2': 15, '3': 25 };
  const max = limits[boardSizeSelect.value] || 15;
  winPointsInput.max = max;
  winLimitHint.innerText = `Max: ${max} points for this size`;
  if (parseInt(winPointsInput.value) > max) winPointsInput.value = max;
  winPointsValue.innerText = winPointsInput.value;
}
boardSizeSelect.addEventListener('change', updateMenuOptions);
winPointsInput.addEventListener('input', () => {
    winPointsValue.innerText = winPointsInput.value;
});
updateMenuOptions();

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
    const p = gs.players[0];
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
        gs.confirmDiscard(0);
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
    if (!gs || gs.currentPlayerIdx !== 0) {
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
        alert("Select resources for the trade!");
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
                alert(`Not enough ${fromRes}! Need at least ${rate}.`);
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
    if (!gs || gs.currentPlayerIdx !== 0) return;
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

    async init() {
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
            console.error("Firebase init failed:", e);
            return false;
        }
    }

    async joinMatch(id, onUpdate) {
        this.matchId = id;
        this.gameRef = this.db.collection('matches').doc(id);
        this.isMultiplayer = true;
        
        try {
            const doc = await this.gameRef.get();
            if (!doc.exists) {
                this.isHost = true;
                document.getElementById('syncStatus').innerText = `Host: Match ${id}`;
                document.getElementById('syncStatus').style.color = '#2ecc71';
            } else {
                this.isHost = false;
                document.getElementById('syncStatus').innerText = `Joined: Match ${id}`;
                document.getElementById('syncStatus').style.color = '#3498db';
                // Trigger initial state load
                const data = doc.data();
                if (data) onUpdate(GameState.fromJSON(data));
            }
        } catch (e) {
            console.error("Permissions error: check your Firestore rules!", e);
            alert("Permissions Error: Ensure your Firestore rules are set to Test Mode or allow reads/writes to 'matches' collection.");
            throw e;
        }

        // Setup real-time listener
        if (this.unsubscribe) this.unsubscribe();
        this.unsubscribe = this.gameRef.onSnapshot((snap) => {
            if (snap.exists) {
                const data = snap.data();
                // Avoid re-applying what we just pushed
                if (this.lastPushedJson && JSON.stringify(data) === this.lastPushedJson) return;
                
                onUpdate(GameState.fromJSON(data));
            } else if (this.isMultiplayer && !this.isHost && gs) {
                // If the game disappeared and we aren't the one who closed it
                alert("The host has abandoned the game.");
                this.abandonMatch();
                gs = null;
                gameInterface.style.display = 'none';
                menuOverlay.style.display = 'flex';
                // Reset sync UI
                const syncBtn = document.getElementById('joinMatchBtn');
                syncBtn.innerText = "SYNC";
                syncBtn.disabled = false;
                document.getElementById('syncStatus').innerText = "Not synced.";
                document.getElementById('syncStatus').style.color = "#999";
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
            console.error("Firebase update failed:", e);
        }
    }

    async abandonMatch() {
        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
            this.updateTimeout = null;
        }
        this.pendingUpdate = null;
        if (!this.gameRef) return;
        if (this.isHost) {
            try {
                await this.gameRef.delete();
                console.log("Match deleted from Firebase (Host abandoned)");
            } catch (e) {
                console.error("Failed to delete match:", e);
            }
        }
        if (this.unsubscribe) this.unsubscribe();
        this.matchId = null;
        this.gameRef = null;
        this.unsubscribe = null;
        this.isMultiplayer = false;
        this.isHost = true;
        this.lastPushedJson = null;
    }
}

const gameSync = new GameSync();

function resetGame(config) {
  lastGameConfig = config;
  isOnlyBotsMode = config.onlyBots;
  const { aiCount, boardRadius, winPoints, friendlyRobber, aiDifficulty, onlyBots } = config;

  // Update rule text
  document.getElementById('ruleWinPoints').innerHTML = `<strong>Victory:</strong> Reach ${winPoints} points.`;

  board = new Board(boardRadius);
  const colors = ['#0099ff', '#ff4444', '#ffcc00', '#ffffff', '#e67e22', '#9b59b6'];
  players = [];
  
  if (onlyBots) {
    for (let i = 0; i <= aiCount; i++) {
        players.push(new Player(i, `Bot ${i}`, colors[i % colors.length], true));
    }
  } else {
    players.push(new Player(0, 'Human', colors[0], false));
    for (let i = 0; i < aiCount; i++) {
        players.push(new Player(i + 1, `AI ${i + 1}`, colors[(i + 1) % colors.length], true));
    }
  }

  gs = new GameState(board, players, winPoints, friendlyRobber, aiDifficulty);
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

// --- Game Execution ---

startGameBtn.onclick = async () => {
  const config = {
    aiCount: parseInt(document.getElementById('aiCount').value),
    boardRadius: parseInt(document.getElementById('boardSize').value),
    winPoints: parseInt(document.getElementById('winPoints').value),
    friendlyRobber: document.getElementById('friendlyRobber').checked,
    aiDifficulty: document.getElementById('aiDifficulty').value,
    onlyBots: document.getElementById('onlyBots').checked
  };
  
  // If we aren't already synced, this is a local solo-only game
  if (!gameSync.matchId) {
    gameSync.isMultiplayer = false; 
    gameSync.isHost = true;
  } else {
      gameSync.isMultiplayer = true;
      gameSync.isHost = true; // Whoever clicks Start is the one driving the initial setup
  }

  resetGame(config);
  if (gameSync.isMultiplayer) await gameSync.update(gs);
};

document.getElementById('joinMatchBtn').onclick = async () => {
  const mid = document.getElementById('matchId').value.trim();
  if (!mid) {
      alert("Please enter a Match ID");
      return;
  }
  
  const ok = await gameSync.init();
  if (!ok) {
      alert("Failed to initialize Firebase. check your firebase-config.json and SDK imports.");
      return;
  }

  const btn = document.getElementById('joinMatchBtn');
  btn.innerText = "Connecting...";
  btn.disabled = true;

  try {
      await gameSync.joinMatch(mid, (remoteGs) => {
          if (!gs) {
              // Initial load of a shared game
              gs = remoteGs;
              ren = new CanvasRenderer(canvas, gs.board);
              inp = new InputHandler(canvas, gs.board, gs, ren);
              setupTradeUI();
              menuOverlay.style.display = 'none';
              gameInterface.style.display = 'block';
              resize();
          } else {
              // Update existing game state
              gs.fromJSON(remoteGs.toJSON());
          }
      });

      // If we are the first one, we might need to "host" a game state
      // We'll check if the snapshot was empty or if we need to push a new one
      // For simplicity, if we clicked SYNC and its still the menu, we'll start a default game and push it
      if (menuOverlay.style.display !== 'none' && gameSync.isHost) {
          const config = {
              aiCount: parseInt(document.getElementById('aiCount').value) || 1,
              boardRadius: parseInt(document.getElementById('boardSize').value) || 3,
              winPoints: parseInt(document.getElementById('winPoints').value) || 10,
              friendlyRobber: document.getElementById('friendlyRobber').checked,
              aiDifficulty: document.getElementById('aiDifficulty').value,
              onlyBots: false
          };
          resetGame(config);
          await gameSync.update(gs);
      } else if (menuOverlay.style.display !== 'none' && !gameSync.isHost) {
          // If we are NOT the host, we should wait for the host's data to arrive via onSnapshot
          btn.innerText = "Waiting for Host...";
          btn.disabled = true;
      }
  } catch (err) {
      console.error(err);
      alert("Error syncing match: " + err.message);
      btn.innerText = "SYNC";
      btn.disabled = false;
  }
};

document.getElementById('replayBtn').onclick = () => {
  if (lastGameConfig) {
      resetGame(lastGameConfig);
  }
};

document.getElementById('newGameBtn').onclick = () => {
  gs = null; // Stop the loop/game logic
  gameInterface.style.display = 'none';
  menuOverlay.style.display = 'flex';
};

document.getElementById('abandonBtn').onclick = async () => {
  if (confirm(gameSync.isHost ? "Are you sure? This will end the game for everyone!" : "Are you sure you want to leave?")) {
      await gameSync.abandonMatch();
      gs = null;
      gameInterface.style.display = 'none';
      menuOverlay.style.display = 'flex';
      // Reset Join UI state
      const syncBtn = document.getElementById('joinMatchBtn');
      syncBtn.innerText = "SYNC";
      syncBtn.disabled = false;
      document.getElementById('syncStatus').innerText = "Not synced.";
      document.getElementById('syncStatus').style.color = "#999";
  }
};

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

function loop() {
  requestAnimationFrame(loop);
  if (!gs) {
      // Keep UI elements hidden if no game is active
      gameInterface.style.display = 'none';
      return;
  }
  ren.render(gs, inp.hover);

  const isHumanTurn = !gs.currentPlayer.isBot;
  const inRobberActions = gs.movingRobber || gs.waitingToPickVictim;
  const inDiscardActions = gs.waitingForDiscards.length > 0;
  const isWinning = gs.winner !== null;
  const inTradeActions = gs.activeTrade !== null || isProposingTrade || isTradingWithBank;
  const resources = ['WOOD', 'BRICK', 'SHEEP', 'WHEAT', 'ORE'];

  const canTradeBank = isHumanTurn && resources.some(r => gs.currentPlayer.resources[r] >= gs.getTradeRate(gs.currentPlayer, r));
  const canTradePlayer = isHumanTurn && Object.values(gs.currentPlayer.resources).some(v => v > 0);

  rollBtn.disabled = gs.phase!=='PLAY' || !isHumanTurn || gs.hasRolled || inRobberActions || inTradeActions || inDiscardActions || isWinning;
  endBtn.disabled = gs.phase!=='PLAY' || !isHumanTurn || !gs.hasRolled || inRobberActions || inTradeActions || inDiscardActions || isWinning;
  bankTradeBtn.disabled = !canTradeBank || gs.phase!=='PLAY' || !isHumanTurn || !gs.hasRolled || inRobberActions || isTradingWithBank || isProposingTrade || inDiscardActions || isWinning;
  tradeBtn.disabled = !canTradePlayer || gs.phase!=='PLAY' || !isHumanTurn || !gs.hasRolled || inRobberActions || isProposingTrade || isTradingWithBank || inDiscardActions || isWinning;
  
  tradePanel.style.display = (gs.phase === 'PLAY' && isHumanTurn && !inRobberActions && !inDiscardActions && isTradingWithBank && !isWinning) ? 'flex' : 'none';
  playerTradePanel.style.display = (gs.phase === 'PLAY' && isHumanTurn && !inRobberActions && !inDiscardActions && isProposingTrade && !isWinning) ? 'flex' : 'none';
  robberPanel.style.display = (gs.phase === 'PLAY' && isHumanTurn && gs.waitingToPickVictim && !isWinning) ? 'flex' : 'none';
  const humanInDiscard = gs.waitingForDiscards.includes(0) && !isOnlyBotsMode;
  discardPanel.style.display = (humanInDiscard && !isWinning) ? 'flex' : 'none';
  
  if (isWinning) {
      victoryPanel.style.display = 'flex';
      document.getElementById('victory-name').innerText = `${gs.winner.name.toUpperCase()} WINS!`;
  } else {
      victoryPanel.style.display = 'none';
  }

  // Handle Player Trade Panel visibility
  if (gs.activeTrade && !isWinning) {
      const isTargetHuman = !gs.players[gs.activeTrade.targetId].isBot;
      if (isTargetHuman && !inDiscardActions) {
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
