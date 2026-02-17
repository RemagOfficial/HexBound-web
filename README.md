# HexBound - Hex-Grid Strategy Simulation

HexBound is a browser-based, high-performance strategy game and simulation engine inspired by classic hex-grid board games. Built using vanilla JavaScript and HTML5 Canvas, it features a robust AI system, dynamic board generation, and a fully automated "Only Bots" mode for theoretical game analysis.

## 🚀 Quick Start

1.  Open [index.html](index.html) in any modern web browser.
2.  Configure your session in the **Start Menu**:
    *   **AI Opponents**: Play with up to 5 AI players (6 players total).
    *   **Board Size**: Small (7 hexes), Standard (19 hexes), or Large (37 hexes).
    *   **AI Difficulty**: Choose from **Beginner** (Slow/Random), **Skilled** (Balanced), or **Master** (Aggressive/Strategic).
    *   **Only Bots Mode**: Toggle this to watch a fully automated simulation with a 5-second auto-restart loop.
3.  Click **Start Game** to begin the match.

## 🎮 Controls

*   **🖱️ Pan**: Click and drag to move the board.
*   **🔍 Zoom**: Use the **Mouse Wheel** to zoom (centered on your cursor).
*   **🛠️ Build**: Click **Vertices** to build Settlements/Cities and **Edges** to build Roads. Valid locations pulse with cyan/gold highlights during your turn.
*   **🎲 Actions**: Use the bottom control bar to **Roll Dice**, **End Turn**, or perform **Bank Trades (4:1)**.

## 🏆 Game Mechanics

### 1. Building & Scoring
*   **Settlement (1 VP)**: Costs 1 Wood, 1 Brick, 1 Sheep, 1 Wheat.
*   **City (2 VP)**: Costs 3 Ore, 2 Wheat (Upgrades an existing Settlement).
*   **Roads**: Costs 1 Wood, 1 Brick. Used to expand your reach.
*   **Longest Road (+2 VP)**: Awarded to the first player with a continuous path of 5+ roads. If another player builds a longer path, they steal the bonus!

### 2. The Robber & Friendly Rule
*   **Rolling a 7**: Triggers the Robber. 
    *   Players with > 7 resources must discard half.
    *   The current player moves the Robber to block a hex and steals 1 resource from an adjacent opponent.
*   **Friendly Robber**: When enabled, the Robber cannot be placed on hexes affecting players with 2 VP or fewer.

### 3. AI Strategy Tiers
*   **Beginner**: Plays slowly and makes semi-random building choices.
*   **Skilled**: Balanced resource management and expansion.
*   **Master**: Fast-paced, aggressive expansion, and high-priority targeting of the Longest Road bonus.

## ✨ Advanced Features

*   **Stats Panel (Top-Right)**: A compact summary of all players' Victory Points (VP), Road Length (RD), Total Resources (RES), and a live reverse-chronological **History Log**.
*   **Only Bots Mode**: A simulation mode where all players (including Player 0) are controlled by AI. The game automatically restarts 5 seconds after a winner is declared.
*   **Recursive Pathfinding**: Implements a Depth-First Search (DFS) algorithm to calculate complex road networks while accounting for opponent "road-breaking" settlements.
*   **Visual Affordance**: Smooth animations for dice rolls and pulsing build-site indicators (hidden during bot turns for a clean spectator experience).

## 🛠 Technical Overview

*   **Engine**: Custom logic engine built with zero dependencies.
*   **Coordinates**: Axial $(q, r)$ math for grid operations.
*   **Rendering**: Optimized HTML5 Canvas with a camera system supporting infinite panning and 0.3x to 3.0x zoom.
*   **Performance**: Monolithic architecture ensures high-speed execution even with 6 Master-tier AIs and Large board sizes.

---
*Created with focus on clean logic and modular design.*
