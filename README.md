# HexBound - Hex-Grid Strategy Game

HexBound is a browser-based, single-player strategy game inspired by classic hex-grid board games. Built using vanilla JavaScript and HTML5 Canvas, it focuses on clean logic and local performance.

## 🚀 Quick Start

1.  Open `index.html` in any modern web browser.
2.  Follow the on-screen instructions for the **Initial Phase**.
3.  Objective: Be the first player to reach **10 Victory Points**.

## 🎮 Game Phases

### 1. Initial Phase (Snake Order)
*   Each player places 2 Settlements and 2 Roads.
*   The turn order follows a "snake" pattern: Player 1-2-3-4, then 4-3-2-1.
*   **Action**: Click an empty vertex for a Settlement, then click an adjacent edge for a Road.

### 2. Play Phase
*   **Roll Dice**: Determine which hexes produce resources.
*   **Collect Resources**: 
    *   **Wood**: Forests
    *   **Brick**: Hills
    *   **Sheep**: Pastures
    *   **Wheat**: Fields
    *   **Ore**: Mountains
*   **Build**: Use resources to expand your network.
*   **End Turn**: Pass control to the next player.

## 📜 Building Rules

*   **Settlements (1 VP)**: Must be at least two edges away from any other structure (yours or AI's). Must connect to your road network.
*   **Roads**: Must connect to your existing settlements, cities, or roads.
*   **Cities (2 VP)**: Upgraded from existing settlements. They produce **double** resources.

## ⚖️ Current Limitations

As a prototype, several advanced features of standard hex games are omitted:
*   **No Trading**: You must rely solely on your own resource production.
*   **Simplified AI**: AI players will perform their initial placements but only roll and end their turn during the play phase. They do not build or strategize.
*   **No Robber**: Rolling a 7 skips resource distribution but does not trigger a robber move or resource theft.
*   **No Development Cards**: Action cards and "Largest Army" bonuses are not included.
*   **No Ports/Maritime Trade**: Resource exchange is not available.
*   **Single Session**: No saving or loading is supported.

## 🛠 Technical Details

*   **Logic**: Uses Axial $(q, r)$ coordinates for hex-grid math.
*   **Rendering**: 100% HTML5 Canvas with geometric primitives.
*   **Architecture**: Strict separation between `GameState` (logic) and `CanvasRenderer` (visuals).
*   **Portability**: Monolithic `main.js` to bypass `file://` protocol CORS restrictions, allowing the game to run locally without a server.
