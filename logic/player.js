export const PLAYER_COLORS = ['#0000FF', '#FF0000', '#FFA500', '#FFFFFF']; // Blue, Red, Orange, White
export const RESOURCE_TYPES = ['WOOD', 'BRICK', 'SHEEP', 'WHEAT', 'ORE'];

export const COSTS = {
  ROAD: { WOOD: 1, BRICK: 1 },
  SETTLEMENT: { WOOD: 1, BRICK: 1, SHEEP: 1, WHEAT: 1 },
  CITY: { ORE: 3, WHEAT: 2 }
};

export class Player {
  constructor(id, name, color) {
    this.id = id;
    this.name = name;
    this.color = color;
    this.resources = {
      WOOD: 2,
      BRICK: 2,
      SHEEP: 2,
      WHEAT: 2,
      ORE: 0
    };
    this.settlements = []; // vertex keys
    this.cities = [];     // vertex keys
    this.roads = [];      // edge keys
    this.victoryPoints = 0;
  }

  canAfford(cost) {
    for (const [res, amount] of Object.entries(cost)) {
      if ((this.resources[res] || 0) < amount) return false;
    }
    return true;
  }

  spend(cost) {
    if (!this.canAfford(cost)) return false;
    for (const [res, amount] of Object.entries(cost)) {
      this.resources[res] -= amount;
    }
    return true;
  }

  receive(resType, amount = 1) {
    if (this.resources[resType] !== undefined) {
      this.resources[resType] += amount;
    }
  }

  calculateVP() {
    this.victoryPoints = this.settlements.length + (this.cities.length * 2);
    return this.victoryPoints;
  }
}
