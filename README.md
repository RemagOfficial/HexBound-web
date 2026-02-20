# [HexBound - Hex-Grid Strategy Simulation](https://remagofficial.github.io/HexBound-web/)

HexBound is a browser-based, high-performance strategy game and simulation engine inspired by classic hex-grid board games. Built using vanilla JavaScript and HTML5 Canvas, it features a robust AI system, dynamic board generation, and a fully automated "Only Bots" mode for theoretical game analysis.

## 🚀 Quick Start

1.  Open [index.html](index.html) in any modern web browser.
2.  Choose your game mode from the **Main Menu**:
    *   **Standard**: Classic hex-grid setup with a fixed board size.
    *   **Expanding Board (Experimental)**: A survival-mode where the map grows radially over time until it reaches a massive scale, followed by environmental decay.
3.  Configure your session in the **Setup Menu**:
    *   **AI Opponents**: Play with up to 37 AI players (38 players total).
    *   **Board Size**: Small (7 hexes), Standard (19 hexes), Large (37 hexes), Extra Large (61 hexes), Colossal (91 hexes), or **Hell (1141 hexes)**.
    *   **Expansion Frequency**: (Expanding Mode only) Control how often the board grows (from 1 to 5 rotations).
    *   **Hazard Sliders**: (Expanding Mode only) Customize the **New Hex Desert Chance** and **Tile Decay (Wither) Chance** (0-50%).
    *   **AI Difficulty**: Choose from **Beginner** (Slow/Random), **Skilled** (Balanced), or **Master** (Aggressive/Strategic).
    *   **Win Points**: Set target scores from **3 to 25** (Standard) or **14 to 30** (Expanding Board) to suit your desired playtime.
    *   **Multi-Robber Mode**: Enable this to start every desert with a robber. Requires a two-phase selection (Pick Robber -> Pick Destination).
    *   **Only Bots Mode (Auto-Battle)**: Toggle this to watch a fully automated simulation.
    *   **Friendly Robber (Safe at 2 pts)**: Protect new players from being robbed early.
4.  Click **Start Game** to begin the match.

## 🎮 Controls

*   **🖱️ Pan**: Click and drag (Desktop) or **One-Finger Drag** (Mobile) to move the board.
*   **🔍 Zoom**: Use the **Mouse Wheel** (Desktop) or **Pinch-to-Zoom** (Mobile) to scale the board. Supports extreme wide-angle viewing (**0.05x**) for massive maps.
*   **🛠️ Build**: Click **Vertices** to build Settlements/Cities and **Edges** to build Roads. Valid locations pulse with cyan/gold highlights after your roll.
*   **🎲 Actions**: Use the control bar to **Roll Dice**, **End Turn**, or perform **Trades**.
*   **✨ Toggleable Dice Visuals**: Experience a high-polish dice system with a centralized animation. Late-game performance can be optimized via the **"Dice Anim"** checkbox in the game controls, allowing for instant rolls on massive boards.

## 🏝 Expanding Board (Experimental Mode)

This mode transforms the game into a survival-horror strategy where the very ground beneath your feet can perish.

### 1. Radial Growth
The board begins at a tiny radius of **2** and expands outward every few rotations. The new hexes are generated with weighted resource distributions and randomized number tokens based on their distance from the center.

### 2. World Death & Desertification
*   **Expansion Cap**: Growth stops permanently at **Radius 25**.
*   **Clumped Hazards**: New hexes have a chance to be **Deserts** from the start, controlled by user sliders.
*   **The Wither**: Existing tiles have a chance to "wither" into Deserts, especially once the board stops growing. The rate of decay accelerates over time, increasing its probability and frequency.
*   **Live Analytics**: The UI displays real-time **Radius** and **Desert Percentage** metrics.

### 3. Player Elimination
*   **Soft-Lock Detection**: Players are automatically eliminated if they lose all viable resource sources (bordered by deserts), have no building materials, and no way to trade for help.
*   **Total Defeat**: If the environment wins (everyone is eliminated before reaching the VP goal), the game concludes with a special **"THE DESERT WINS!"** victory screen in a sandy orange theme.
*   **The Survival Challenge**: If you are the last player remaining, you must still reach the target score to win. If the desert consumes your last resources before you hit the limit, you will also be eliminated, resulting in a **Total Defeat**.

### 4. End-Game Visualization
For both singleplayer and multiplayer matches, a **Desertification Trend Graph** is displayed on the victory screen, tracking the world's decline from the first rotation to the final turn. Guests in synchronized matches will see the same trend data as the host.

## 🌐 Multiplayer (Online Sync)

HexBound supports **Real-Time Multiplayer** across different browsers using Google Firebase. 

### 1. Connecting
*   **Host a Match**: Select **Multiplayer** -> **Host Game**. Enter your character name, a unique **Match ID** (e.g., `cool-room-123`), and configure the board settings. Once in the **Lobby**, wait for players to join and then click **Start Game**.
*   **Join a Match**: Select **Multiplayer** -> **Join Game**. Enter your character name and the exact match code from the host. You'll be connected to the lobby instantly.
*   **Multiplayer Expansion**: In **Expanding Board** mode, the board grows and rotations are tracked globally. Even if the first player (Host) is eliminated, the board will continue to grow correctly as the turn cycle wraps around.
*   **Persistent Names**: Your preferred username is saved and synchronized across all menus automatically.
*   **Abandon Game**: If the Host abandons, the match is deleted from the server and all guests are returned to the menu. 

### 2. Synchronization Architecture
*   **Efficiency**: The engine uses a **1.5s Debounce** for non-critical writes (like building roads). This groups multiple moves into a single database write to stay within Firestore free-tier limits.
*   **Immediate Sync**: Critical actions like **Roll Dice** and **End Turn** are pushed instantly to ensure a smooth turn-based transition.

### 3. Local Setup (CORS Bypass)
*   To support the `file://` protocol without CORS errors, the game uses `firebase-config.js`. 
*   Simply update the global `window.hexboundFirebaseConfig` object in that file with your own Firebase project credentials to enable multiplayer on your local machine.

## 🏆 Game Mechanics

### 1. Building & Scoring
*   **Turn Tracking**: Every game features a **"Turns"** counter in the top-right HUD. A turn represents one full **Rotation** through all active players.
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

### 3. Expansion Mechanics (5-38 Players)
*   **Dynamic Scaling**: The deck size and bank resources automatically scale to support up to 38 players.
    *   **Bank Resources**: Up to 200 per type for "Hell" games.
    *   **Dev Deck**: Up to 100+ Knight cards to manage dozens of active robbers.
*   **Hell Mode (Radius 19)**: A massive 1,141-hex battlefield designed for target scores up to 100 VP. Includes ultra-wide camera support (**0.05x zoom**) to maintain perspective. *Note: Playing with the full 38 players is a chaotic endurance test and may take several real-world days to conclude.*
*   **Multi-Robbers**: Every desert starts with a robber. Players must first select which robber to move, then choose its destination.
*   **Development Cards**: 
    *   **Knight**: Move one of the many Robbers and steal from an adjacent player.
    *   **Progress Cards**: Road Building (2 free roads), Year of Plenty/Invention (2 resources), and Monopoly (Take all resources of one type from others).
    *   **Victory Points**: Hidden +1 VP cards. Increase to 20+ cards on giant maps.

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

*   **Integrated Logo Branding**: The main menu and in-game HUD now feature official branding from the `assets/` folder.
*   **Toast Notification System**: Replaced intrusive alerts and technical console errors with a clean, animated toast notification system for game status and error reporting.
*   **Fixed Resource Ordering**: Resources in the Action Panel and Bank Stock are always sorted by type (Wood, Brick, Sheep, Wheat, Ore) for better muscle memory.
*   **Mobile-First Safe Area Support**: Added `env(safe-area-inset-bottom)` support to ensure UI controls never collide with Android navigation buttons or iOS home bars.
*   **Sync-Ready Usernames**: Names typed in any menu field are automatically saved to `localStorage` and synced across all setup screens.
*   **Fixed Centered Modals**: A reconstructed UI ensures all trade, discard, and robber menus are centered and accessible on any device.
*   **Victory Screen**: Once a player reaches the target score, a dedicated victory panel appears with options to **Replay** (same settings) or start a **New Game**.

## 🛠 Technical Overview

*   **Monolithic Engine**: The core game logic and canvas rendering have been consolidated into a single, high-performance `main.js` file to support `file://` execution without CORS issues.
*   **Core Backend**: Firebase Firestore for real-time state synchronization.
*   **Language**: Vanilla JavaScript (ES6+), HTML5 Canvas, CSS Flexbox/Grid.
*   **Coordinates**: Axial $(q, r)$ math for grid operations.
*   **Rendering**: Camera system supporting infinite panning and 0.3x to 3.0x zoom.
*   **Scaling**: Responsive scaling logic that adjusts the HUD and interaction thresholds for mobile vs. desktop viewports.

---
*Created with focus on clean logic and modular design.*
