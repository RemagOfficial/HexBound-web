/**
 * HexBound - Board Logic
 * Handles hex math, board generation, terrain distribution, and topological structure (vertices/edges).
 */

export const HEX_TYPES = {
  WOOD: { name: 'Wood', color: '#228B22' },   // Forest
  BRICK: { name: 'Brick', color: '#B22222' },  // Hills
  SHEEP: { name: 'Sheep', color: '#90EE90' },  // Pasture
  WHEAT: { name: 'Wheat', color: '#FFD700' },  // Fields
  ORE: { name: 'Ore', color: '#708090' },    // Mountains
  DESERT: { name: 'Desert', color: '#F4A460' }
};

export class Hex {
  constructor(q, r, terrain, number) {
    this.q = q; // Axial q
    this.r = r; // Axial r
    this.terrain = terrain;
    this.number = number;
    this.vertices = []; // Array of indices/keys for adjacent vertices
    this.edges = [];    // Array of indices/keys for adjacent edges
  }
}

export class Vertex {
  constructor(id, x, y) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.ownerId = null; // Player ID (0, 1, 2, 3)
    this.isCity = false;
    this.hexes = []; // Hexes sharing this vertex
  }
}

export class Edge {
  constructor(id, v1, v2) {
    this.id = id;
    this.v1 = v1; // Vertex ID
    this.v2 = v2; // Vertex ID
    this.ownerId = null; // Player ID
  }
}

export class Board {
  constructor() {
    this.hexes = new Map(); // key 'q,r' -> Hex
    this.vertices = new Map(); // key 'v_x,y' -> Vertex
    this.edges = new Map();    // key 'v1_v2' -> Edge
    this.radius = 2; // Standard 19-hex Catan board is radius 2 (dist from center)
    this.hexSize = 50; // Size for math calculations

    this.generateBoard();
  }

  generateBoard() {
    const terrainPool = [
      ...Array(4).fill(HEX_TYPES.WOOD),
      ...Array(4).fill(HEX_TYPES.SHEEP),
      ...Array(4).fill(HEX_TYPES.WHEAT),
      ...Array(3).fill(HEX_TYPES.BRICK),
      ...Array(3).fill(HEX_TYPES.ORE),
      HEX_TYPES.DESERT
    ].sort(() => Math.random() - 0.5);

    const numberPool = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12].sort(() => Math.random() - 0.5);

    let numberIdx = 0;
    let terrainIdx = 0;

    // Create hexes
    for (let q = -this.radius; q <= this.radius; q++) {
      for (let r = Math.max(-this.radius, -q - this.radius); r <= Math.min(this.radius, -q + this.radius); r++) {
        const terrain = terrainPool[terrainIdx++];
        const number = (terrain === HEX_TYPES.DESERT) ? null : numberPool[numberIdx++];
        const hex = new Hex(q, r, terrain, number);
        this.hexes.set(`${q},${r}`, hex);
      }
    }

    // Build topology (vertices and edges)
    this.hexes.forEach(hex => {
      const hexVertices = this.getHexVertexPositions(hex.q, hex.r);
      const hexVertexKeys = [];

      hexVertices.forEach((pos, i) => {
        // Precision handling for keys
        const vx = Math.round(pos.x * 100) / 100;
        const vy = Math.round(pos.y * 100) / 100;
        const vKey = `${vx},${vy}`;

        if (!this.vertices.has(vKey)) {
          const v = new Vertex(vKey, vx, vy);
          this.vertices.set(vKey, v);
        }
        const vertex = this.vertices.get(vKey);
        vertex.hexes.push(hex);
        hex.vertices.push(vKey);
        hexVertexKeys.push(vKey);
      });

      // Edges (between adjacent vertices in hex)
      for (let i = 0; i < 6; i++) {
        const v1 = hexVertexKeys[i];
        const v2 = hexVertexKeys[(i + 1) % 6];
        const edgeKey = [v1, v2].sort().join('|');

        if (!this.edges.has(edgeKey)) {
          this.edges.set(edgeKey, new Edge(edgeKey, v1, v2));
        }
        hex.edges.push(edgeKey);
      }
    });
  }

  getHexVertexPositions(q, r) {
    const center = this.hexToPixel(q, r);
    const vertices = [];
    for (let i = 0; i < 6; i++) {
        // Flat-top hex vertices
        const angle_deg = 60 * i;
        const angle_rad = Math.PI / 180 * angle_deg;
        vertices.push({
            x: center.x + this.hexSize * Math.cos(angle_rad),
            y: center.y + this.hexSize * Math.sin(angle_rad)
        });
    }
    return vertices;
  }

  hexToPixel(q, r) {
    // Math for flat-top hexes
    const x = this.hexSize * (3/2 * q);
    const y = this.hexSize * (Math.sqrt(3)/2 * q + Math.sqrt(3) * r);
    return { x, y };
  }

  getVertex(id) { return this.vertices.get(id); }
  getEdge(id) { return this.edges.get(id); }
  getHex(q, r) { return this.hexes.get(`${q},${r}`); }

  getNeighborsOfVertex(vKey) {
    // Returns vertex keys connected by an edge
    const neighbors = new Set();
    this.edges.forEach(edge => {
      if (edge.v1 === vKey) neighbors.add(edge.v2);
      if (edge.v2 === vKey) neighbors.add(edge.v1);
    });
    return Array.from(neighbors);
  }

  getEdgesOfVertex(vKey) {
    const edges = [];
    this.edges.forEach(edge => {
        if (edge.v1 === vKey || edge.v2 === vKey) edges.push(edge);
    });
    return edges;
  }
}
