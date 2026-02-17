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

*   **🖱️ Pan**: Click and drag (Desktop) or **One-Finger Drag** (Mobile) to move the board.
*   **🔍 Zoom**: Use the **Mouse Wheel** (Desktop) or **Pinch-to-Zoom** (Mobile) to scale the board.
*   **🛠️ Build**: Click **Vertices** to build Settlements/Cities and **Edges** to build Roads. Valid locations pulse with cyan/gold highlights after your roll.
*   **🎲 Actions**: Use the control bar to **Roll Dice**, **End Turn**, or perform **Trades**.

## 🏆 Game Mechanics

### 1. Building & Scoring
*   **Settlement (1 VP)**: Costs 1 Wood, 1 Brick, 1 Sheep, 1 Wheat.
*   **City (2 VP)**: Costs 3 Ore, 2 Wheat (Upgrades an existing Settlement).
*   **Roads**: Costs 1 Wood, 1 Brick. Used to expand your reach.
*   **Longest Road (+2 VP)**: Awarded to the player with the longest continuous path (min 5).

### 2. Trading
*   **Bank Trade**: Trade resources at the bank (default 4:1). Rate improves to 3:1 or 2:1 by building on **Ports**.
*   **Player Trade**: Propose custom trades to AI opponents. You can specify exactly what to **Give** and **Get**. Skilled AI will evaluate trades based on their current needs and surplus.

### 3. The Robber & Manual Discarding
*   **Rolling a 7**: Pauses the game for a special phase:
    *   **Manual Discard**: Any player (human or AI) with more than 7 cards must select exactly half of their hand to lose.
    *   **Move Robber**: The current player moves the grey Robber to block a hex from producing resources.
    *   **Steal**: The current player chooses an opponent on that hex to steal 1 random resource from.
*   **Friendly Robber**: When enabled, the Robber cannot target players with 2 VP or fewer.

### 4. AI Strategy Tiers
*   **Beginner**: Slow, random, and might "forget" to build roads.
*   **Skilled**: Managed expansion and sensible trading.
*   **Master**: Aggressive expansion, strategic card hoarding, and ruthless road-blocking.

## ✨ Advanced Features

*   **Fixed Centered Modals**: A reconstructed UI ensures all trade, discard, and robber menus are centered and accessible on any device.
*   **Victory Screen**: Once a player reaches the target score, a dedicated victory panel appears with options to **Replay** (same settings) or start a **New Game**.
*   **Concurrency Control**: A `turnToken` system ensures that delayed AI actions never bleed into human turns, providing a glitch-free turn-based experience.
*   **Visual Dimming**: The game board automatically dims when a modal is active, keeping focus on vital decisions while keeping the HUD visible.

## 🛠 Technical Overview

*   **Engine**: Custom logic engine built with zero dependencies.
*   **Language**: Vanilla JavaScript (ES6+), HTML5 Canvas, CSS Flexbox/Grid.
*   **Coordinates**: Axial $(q, r)$ math for grid operations.
*   **Rendering**: Camera system supporting infinite panning and 0.3x to 3.0x zoom.
*   **Scaling**: Responsive scaling logic that adjusts the HUD and interaction thresholds for mobile vs. desktop viewports.

---
*Created with focus on clean logic and modular design.*
