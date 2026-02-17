# HexBound - Hex-Grid Strategy Game

HexBound is a browser-based, single-player strategy game inspired by classic hex-grid board games. Built using vanilla JavaScript and HTML5 Canvas, it focuses on clean logic, interactive feedback, and local performance.

## 🚀 Quick Start

1.  Open `index.html` in any modern web browser.
2.  Configure your game in the **Start Menu**:
    *   **AI Opponents**: Play against 1 to 3 AI players.
    *   **Board Size**: Choose from Small (7 hexes), Standard (19 hexes), or Large (37 hexes).
    *   **Victory Points**: Set your goal from 3 to 25 points.
    *   **Friendly Robber**: Protect players with 2 points or fewer from the Robber.
3.  Click **Start Game** and follow the on-screen instructions for the **Initial Phase**.

## 🎮 Controls

*   **🖱️ Pan**: Click and drag your mouse to move the board.
*   **🔍 Zoom**: Use the **Mouse Wheel** to zoom in and out (centered on your cursor).
*   **🔄 Reset View**: Click the **Reset View** button in the control panel to return to the default view.
*   **🛠️ Build**: Click **Vertices** to build Settlements/Cities and **Edges** to build Roads. Valid build locations pulse with a cyan glow.

## 🎲 Game Layers

### 1. Initial Phase (Snake Order)
*   Players place 2 Settlements and 2 Roads in a "snake" pattern (e.g., 1-2-3-3-2-1).
*   The second settlement placement grants immediate resources from adjacent hexes.

### 2. Play Phase
*   **Roll Dice**: Determine which hexes produce resources based on their assigned number.
*   **The Robber (7)**: If a 7 is rolled, players with more than 7 resources must discard half. The current player then moves the Robber to a new hex, blocking its production.
*   **Bank Trading (4:1)**: Use the dedicated **Bank Trade** panel to exchange 4 of one resource for 1 of another. The UI dynamically highlights affordable options.
*   **Build & Expand**: Spend resources to build Roads, Settlements, and Cities.
    *   **Roads**: 1 Wood, 1 Brick
    *   **Settlement (1 VP)**: 1 Wood, 1 Brick, 1 Sheep, 1 Wheat
    *   **City (2 VP)**: 3 Ore, 2 Wheat (Upgrades an existing Settlement)

## ✨ Features

*   **Reactive UI**: Trade buttons and build highlights update in real-time as your resources change.
*   **Visual Affordance**: Buildable locations pulse with cyan highlights, and settlement upgrades glow gold when affordable.
*   **Dynamic Board Generation**: Procedurally generated maps that scale based on your chosen size.
*   **Friendly Robber**: Optional setting to prevent "bullying" players who haven't gained more than 2 victory points.
*   **Clean Architecture**: Separation of concerns between `Board` logic, `GameState`, and the `CanvasRenderer`.

## 🛠 Technical Details

*   **Coordinates**: Uses Axial $(q, r)$ coordinate math for efficient hex-grid operations.
*   **Zero Dependencies**: Procedural generation and rendering using 100% vanilla JavaScript and HTML5 Canvas.
*   **Portability**: Monolithic file structure prevents `file://` protocol CORS issues, making it playable directly from your local filesystem.

## ⚖️ Roadmap & Limitations

*   **AI Strategy**: Current AI players roll dice and move the Robber strategically, but do not yet build structures.
*   **Development Cards**: Future updates will include "Knight" and "Victory Point" cards.
*   **Port Trading**: Specialized 2:1 and 3:1 maritime trade routes at the board edges.
