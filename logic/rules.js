export class Rules {
  static canPlaceSettlement(board, vKey, player, initialPhase = false) {
    const vertex = board.getVertex(vKey);
    if (!vertex || vertex.ownerId !== null) return false;

    // Distance Rule: No settlement within 1 edge distance
    const adjacentEdges = board.getEdgesOfVertex(vKey);
    for (const edge of adjacentEdges) {
        const otherV = (edge.v1 === vKey) ? edge.v2 : edge.v1;
        if (board.getVertex(otherV).ownerId !== null) return false;
    }

    if (initialPhase) return true;

    // Connectivity Rule: Must be connected to own road
    const edges = board.getEdgesOfVertex(vKey);
    return edges.some(edge => edge.ownerId === player.id);
  }

  static canPlaceRoad(board, eKey, player, initialPhase = false) {
    const edge = board.getEdge(eKey);
    if (!edge || edge.ownerId !== null) return false;

    // Connectivity Rule: Must connect to own settlement, city, or other road
    const v1 = board.getVertex(edge.v1);
    const v2 = board.getVertex(edge.v2);

    if (v1.ownerId === player.id || v2.ownerId === player.id) return true;

    const v1Edges = board.getEdgesOfVertex(edge.v1);
    const v2Edges = board.getEdgesOfVertex(edge.v2);

    return v1Edges.some(e => e.ownerId === player.id) || 
           v2Edges.some(e => e.ownerId === player.id);
  }

  static canPlaceCity(board, vKey, player) {
    const vertex = board.getVertex(vKey);
    return vertex && vertex.ownerId === player.id && !vertex.isCity;
  }
}
