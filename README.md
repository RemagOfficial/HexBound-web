# [HexBound - Hex-Grid Strategy Simulation](https://remagofficial.github.io/HexBound-web/)

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
*   **✨ Dice Visuals**: Experience a high-polish dice system with a centralized animation that follows a **Roll, Grow, Pause, and Fade** sequence for maximum clarity.

## � Multiplayer (Online Sync)

HexBound now supports **Real-Time Multiplayer** across different browsers using Google Firebase. 

### 1. Connecting
*   **Host a Match**: Enter a unique **Match ID** in the menu and click **SYNC**. Since you are the first one there, you become the **Host**. Configure your game settings and click **Start Game**.
*   **Join a Match**: Enter the same **Match ID** provided by the host and click **SYNC**. You will see "Waiting for Host..." until the game is initialized.
*   **Abandon Game**: Use the red **Abandon** button to leave a match. If the Host abandons, the match data is deleted from the server and all guests are returned to the menu.

### 2. Synchronization Architecture
*   **Authority Model**: To prevent desync, all **AI logic** and **Dice rolls** are calculated on the Host's machine and pushed to the Guest.
*   **Efficiency**: The engine uses a **1.5s Debounce** for non-critical writes (like building roads). This groups multiple moves into a single database write to stay within Firestore free-tier limits.
*   **Immediate Sync**: Critical actions like **Roll Dice** and **End Turn** are pushed instantly to ensure a smooth turn-based transition.

### 3. Local Setup (CORS Bypass)
*   To support the `file://` protocol without CORS errors, the game uses `firebase-config.js`. 
*   Simply update the global `window.hexboundFirebaseConfig` object in that file with your own Firebase project credentials to enable multiplayer on your local machine.

## 🏆 Game Mechanics

### 1. Building & Scoring
*   **Settlement (1 VP)**: Costs 1 Wood, 1 Brick, 1 Sheep, 1 Wheat.
*   **City (2 VP)**: Costs 3 Ore, 2 Wheat (Upgrades an existing Settlement).
*   **Roads**: Costs 1 Wood, 1 Brick. Used to expand your reach.
*   **Development Cards**: Costs 1 Ore, 1 Sheep, 1 Wheat. Bought at random.
*   **Longest Road (+2 VP)**: Awarded to the player with the longest continuous path (min 5).
*   **Largest Army (+2 VP)**: Awarded to the player who has played the most Knight cards (min 3).

### 2. Trading & Ports
*   **Bank Trade**: Trade resources at the bank (default 4:1). Rate improves to 3:1 (Generic Port) or 2:1 (Specialized Port).
*   **Bank Scarcity**: The bank has a limited supply (19-24 per resource). If a resource is depleted, rolls will not distribute it until cards are returned!
*   **Player Trade**: Propose custom trades to AI or Human opponents. 
*   **Multiplayer Trading**: Proposing a trade to a human player in a synced match triggers a real-time modal on their screen with a countdown timer.

### 3. Expansion Mechanics (5-6 Players)
*   **Dynamic Scaling**: The deck size and bank resources automatically scale when 5 or 6 players are in the session (Large Board only).
*   **Development Cards**: 
    *   **Knight**: Move the Robber and steal from an adjacent player.
    *   **Progress Cards**: Road Building (2 free roads), Year of Plenty/Invention (2 resources), and Monopoly (Take all resources of one type from others).
    *   **Victory Points**: Hidden +1 VP cards.

### 4. The Robber & Manual Discarding
*   **Rolling a 7**: Pauses the game for a special phase:
    *   **Manual Discard**: Any player (human or AI) with more than 7 cards must select exactly half of their hand to lose.
    *   **Move Robber**: The current player moves the grey Robber to block a hex from producing resources.
    *   **Steal**: The current player chooses an opponent on that hex to steal 1 random resource from.
*   **Friendly Robber**: When enabled, the Robber cannot target players with 2 VP or fewer.

### 5. AI Strategy Tiers
*   **Beginner**: Slow, random, and might "forget" to build roads.
*   **Skilled**: Managed expansion and sensible trading.
*   **Master**: Aggressive expansion, strategic card hoarding, and ruthless road-blocking.

## ✨ Advanced Features

*   **Fixed Centered Modals**: A reconstructed UI ensures all trade, discard, and robber menus are centered and accessible on any device.
*   **Victory Screen**: Once a player reaches the target score, a dedicated victory panel appears with options to **Replay** (same settings) or start a **New Game**.
*   **Concurrency Control**: A `turnToken` system ensures that delayed AI actions never bleed into human turns, providing a glitch-free turn-based experience.
*   **Visual Dimming**: The game board automatically dims when a modal is active, keeping focus on vital decisions while keeping the HUD visible.
*   **Interactive Rules**: A toggleable, scrolling rules panel built directly into the UI for quick reference during play.
*   **Dynamic Backgrounds**: The sea buffer dynamically adjusts based on board size to prevent clipping of ports and border tiles.
*   **Online Status Indicator**: A real-time connectivity dot and Match ID display located in the Action Panel for easy reference.

## 🛠 Technical Overview

*   **Engine**: Custom logic engine built with zero dependencies.
*   **Backend**: Firebase Firestore for real-time state synchronization.
*   **Language**: Vanilla JavaScript (ES6+), HTML5 Canvas, CSS Flexbox/Grid.
*   **Coordinates**: Axial $(q, r)$ math for grid operations.
*   **Rendering**: Camera system supporting infinite panning and 0.3x to 3.0x zoom.
*   **Scaling**: Responsive scaling logic that adjusts the HUD and interaction thresholds for mobile vs. desktop viewports.

---
*Created with focus on clean logic and modular design.*
