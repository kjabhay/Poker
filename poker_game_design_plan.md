# Online Multiplayer Poker Game — System Design & Step-by-Step GenAI Implementation Plan (Koyeb + MongoDB Atlas)

This document outlines the complete system architecture, database schema, state machine logic, and a step-by-step prompt engineering roadmap to build and deploy a real-time multiplayer Texas Hold'em Poker game (using virtual coins) on **[Koyeb's Free Tier](https://www.koyeb.com/docs/reference/instances)** and **[MongoDB Atlas (M0 Free Tier)](https://www.mongodb.com/cloud/atlas)**.

## 1. Tech Stack & Koyeb Free-Tier Strategy

To deploy cleanly on Koyeb's Free Web Service (`0.1 vCPU, 512 MB RAM, 2 GB SSD`) and MongoDB Atlas M0 without running into WebSocket drops or CORS headaches, we use a **Single-Service Monolithic Architecture**:

| Layer | Technology | Why It Fits Your Use Case |
| :--- | :--- | :--- |
| **Frontend** | React (Vite) + Tailwind CSS | Fast UI rendering for cards, chip stacks, dealer button, and action controls. |
| **Real-Time Transport** | Socket.IO (`socket.io` + `socket.io-client`) | [Native bi-directional WebSockets on Koyeb](https://www.koyeb.com/tutorials/using-websockets-with-socketio-and-nodejs-on-koyeb) for lobbies, card dealing, and betting turns. |
| **Backend Runtime** | Node.js + Express (Port `8000`) | Serves the `/api/ping` health check, compiled React static files, and Socket.IO server on Koyeb's default port `8000`. |
| **Database** | MongoDB Atlas (M0 Free Tier) + Mongoose | Stores persistent room logs, player profiles/coin balances, and recovery snapshots (512 MB limit). |
| **Poker Engine** | Server-side CSPRNG (`crypto.randomInt`) + `pokersolver` | Cryptographically secure shuffling ("AI Dealer") and deterministic 7-card hand evaluation. |
| **Hosting** | [Koyeb (Free Eco Instance)](https://www.koyeb.com/docs/reference/instances) | Bare-metal microVM with native WebSockets, automatic GitHub buildpack deployments, and ~2–5s wake-up from scale-to-zero. |

### Crucial Koyeb + MongoDB Atlas Free-Tier Optimizations

1. **Single Koyeb Web Service (No CORS Issues)**: Express serves the compiled React `client/dist/` folder in production on `process.env.PORT || 8000` (Koyeb's default exposed port). Both HTTP and WebSockets share the exact same `.koyeb.app` domain and port.
2. **Preventing Koyeb Scale-to-Zero Sleep During Active Games**: Koyeb's Free Instance enters light sleep after ~5 minutes of zero HTTP traffic (waking up in ~2–5 seconds on the next request). To keep the microVM continuously awake while players are seated at a table, the React client sends a lightweight `GET /api/ping` every **3 minutes**—which also satisfies Koyeb's built-in TCP/HTTP health check.
3. **In-Memory Active State + MongoDB Snapshots**: Writing every single chip movement to MongoDB M0 adds network latency. Active hand state lives in an in-memory `Map<roomCode, RoomState>` on the Koyeb Node server, while MongoDB stores room creation, player coin balances, and end-of-hand snapshots (with a 24-hour TTL index so your 512 MB database never fills up).

## 2. User Flow & Game Rules Architecture

### Screen 1: Landing Page (Join or Create)

* **Top Section**: Player enters their **Display Name** (persisted in `localStorage` along with a unique `playerId` UUID for seamless page-refresh reconnection).
* **Option A — Create Room**: Generates a unique 6-character room code (e.g., `PKR842`) and transitions the creator to the **Host Lobby**.
* **Option B — Enter Code**: Player inputs an existing 6-character code and joins the room's waiting lobby.

### Screen 2: Host Configuration Lobby

* **Host Controls** (visible only to the Room Creator):
  * **Starting Stack / Total Buy-in Coins**: Default `1,000` virtual coins per player (configurable, e.g., `500` to `50,000`).
  * **Small Blind / Big Blind**: Configurable (e.g., `10 / 20`).
  * **Number of Card Decks**: Configurable (`1` standard 52-card deck by default, or `2+` decks for custom multi-deck mode).
* **Waiting Players List**: Real-time list showing connected players (2 to 9 players per table).
* **Start Game Button**: Enabled for the Host once at least 2 players are seated.

### Screen 3: The Poker Table & "AI Dealer" Loop

1. **Dealer Coin (Button) Rotation**: Moves clockwise (`(dealerIdx + 1) % activePlayers.length`) at the start of every hand.
2. **Blinds Posting**: Small Blind (`dealerIdx + 1`) and Big Blind (`dealerIdx + 2`) are automatically deducted and placed into the pot.
3. **AI Dealer Shuffle & Deal**:
   * Constructs `N` decks (`52 * numDecks` cards).
   * Shuffles using the **Fisher-Yates algorithm** backed by Node's cryptographic `crypto.randomInt()` so card order cannot be predicted.
   * Deals 2 private hole cards to each player. **Security Rule**: The server only emits a player's private hole cards to their specific `socket.id`; other players only receive `{ cardCount: 2 }`.
4. **Betting Rounds**:
   * **Pre-Flop** → **Flop** (3 community cards) → **Turn** (1 card) → **River** (1 card) → **Showdown**.
   * **Player Actions**:
     * **Fold**: Forfeit current hand and pot eligibility.
     * **Check**: Pass action when `currentBet === player.currentRoundBet`.
     * **Call**: Match `currentBet - player.currentRoundBet` (or go All-In if stack is smaller).
     * **Bet / Raise**: Increase `currentBet` (minimum raise = previous raise size or Big Blind).
     * **All-In**: Push entire remaining coin stack into the pot (triggers side-pot calculation if needed).
5. **Showdown & Pot Distribution**:
   * If 1 player remains unfolded, they win the pot immediately without revealing cards.
   * If 2+ players reach Showdown, the server evaluates each player's best 5-card hand from the 7 available cards (2 hole + 5 community), awards the main/side pots, logs the result to MongoDB, and pauses 5 seconds before rotating the Dealer Coin for the next hand.

## 3. Data Models (In-Memory State & MongoDB Schema)

### Room & Game State Schema

```javascript
{
  roomCode: "PKR842",
  hostId: "uuid-player-1",
  status: "LOBBY", // "LOBBY" | "PREFLOP" | "FLOP" | "TURN" | "RIVER" | "SHOWDOWN"
  config: {
    startingCoins: 1000,
    numDecks: 1,
    smallBlind: 10,
    bigBlind: 20,
    turnTimeLimitSec: 30
  },
  dealerIdx: 0,
  currentTurnIdx: 2,
  pot: 30,
  currentHighestBet: 20,
  minRaise: 20,
  communityCards: ["Ah", "Kd", "7s"], // Empty during PREFLOP
  deck: [...], // Server-only! Stripped before broadcasting to clients
  players: [
    {
      playerId: "uuid-player-1",
      socketId: "socket-xyz",
      name: "Rahul",
      seatIndex: 0,
      coins: 990,
      currentBet: 10,
      totalHandBet: 10,
      holeCards: ["As", "Ad"], // Sent ONLY to Rahul's client
      status: "ACTIVE", // "ACTIVE" | "FOLDED" | "ALL_IN" | "OUT"
      isConnected: true
    }
  ]
}
```

### Socket.IO Event Contract

| Direction | Event Name | Payload | Description |
| :--- | :--- | :--- | :--- |
| **Client → Server** | `room:create` | `{ name, playerId, config }` | Creates room and assigns caller as Host. |
| **Client → Server** | `room:join` | `{ roomCode, name, playerId }` | Joins lobby or reconnects to active seat. |
| **Client → Server** | `room:updateConfig` | `{ roomCode, startingCoins, numDecks, smallBlind, bigBlind }` | Host updates lobby settings before start. |
| **Client → Server** | `game:start` | `{ roomCode }` | Host triggers the first hand. |
| **Client → Server** | `game:action` | `{ roomCode, action: 'FOLD'\|'CHECK'\|'CALL'\|'RAISE', amount }` | Active player submits their turn decision. |
| **Server → Client** | `room:state` | `{ sanitizedRoomState }` | Broadcasts public table state (hides deck & others' cards). |
| **Server → Client** | `player:holeCards` | `{ holeCards: ['Ah', 'Kh'] }` | Private emission to individual socket with their 2 cards. |
| **Server → Client** | `game:showdown` | `{ winners, winningHands, potBreakdown }` | Announces hand winner(s) and reveals showdown cards. |
| **Server → Client** | `error:message` | `{ message }` | Validation error (e.g., invalid room code, out-of-turn action). |

## 4. Recommended Project Folder Structure

```text
poker-online/
├── package.json              # Root scripts + engines field for Koyeb Node.js buildpack
├── .env                      # PORT=8000, MONGODB_URI
├── server/
│   ├── index.js              # Express + Socket.IO entry point (binds 0.0.0.0:8000)
│   ├── db.js                 # MongoDB Atlas connection & Mongoose Room model
│   ├── socketHandlers.js     # Socket.IO event listeners (join, create, action)
│   └── engine/
│       ├── deck.js           # Multi-deck generator & Fisher-Yates CSPRNG shuffle
│       ├── pokerGame.js      # State machine (blinds, betting rounds, side pots)
│       └── evaluator.js      # Hand evaluator wrapper (handles 1 or N decks)
└── client/
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── App.jsx           # Router between Landing, Lobby, and PokerTable
        ├── socket.js         # Socket.IO client singleton + 3-min Koyeb keep-alive
        └── components/
            ├── Landing.jsx   # Name input + Create Room / Enter Code cards
            ├── Lobby.jsx     # Host config (pot/coins, decks, blinds) + player list
            ├── PokerTable.jsx# Oval table, dealer coin, community cards, pot display
            └── ActionBar.jsx # Fold, Check, Call, Raise slider buttons
```

## 5. Step-by-Step GenAI Coding Roadmap (Copy-Paste Prompts)

Build this application cleanly in **6 sequential steps** using any GenAI coding assistant (ChatGPT, Claude, Cursor, or Gemini). Complete and test each step before moving to the next.

### Step 1: Project Scaffolding & MongoDB Connection (Configured for Koyeb)

**Goal**: Set up the monorepo, Express server on port `8000`, Socket.IO, and MongoDB Atlas connection.

> **Prompt 1 (Copy & Paste into GenAI):**
> "I am building a multiplayer online Texas Hold'em poker game (using virtual coins) to deploy as a single Web Service on Koyeb's Free Tier with MongoDB Atlas free tier.
>
> Please generate the initial backend setup inside a `server/` folder and root `package.json`:
> 1. Root `package.json` with `"engines": { "node": ">=20.0.0" }`, build/start scripts for Koyeb, and dependencies: `express`, `socket.io`, `mongoose`, `cors`, `dotenv`, `pokersolver`.
> 2. `server/db.js`: Connect to `process.env.MONGODB_URI` with Mongoose. Create a `Room` schema with fields: `roomCode` (unique string), `hostId`, `config` (`startingCoins`, `numDecks`, `smallBlind`, `bigBlind`), `status`, `players` array, and a `createdAt` field with a 24-hour TTL index (`expires: 86400`) so the free MongoDB tier never fills up.
> 3. `server/index.js`: Set up an Express server attached to an HTTP server and Socket.IO listening on `process.env.PORT || 8000` and host `'0.0.0.0'` (required by Koyeb). Add a `GET /api/ping` health-check endpoint for Koyeb health checks. In production, serve static files from `../client/dist`.
> Provide complete, runnable code for these files."

### Step 2: The "AI Dealer" Engine (Multi-Deck Shuffle & Hand Evaluator)

**Goal**: Write pure, testable JavaScript modules for shuffling `N` decks and evaluating hands BEFORE wiring up sockets.

> **Prompt 2 (Copy & Paste into GenAI):**
> "Now create the server-side AI Dealer modules inside `server/engine/`:
> 1. `server/engine/deck.js`: Write a `createAndShuffleDeck(numDecks = 1)` function. It should generate `numDecks` standard 52-card decks (formatted like `'Ah'`, `'Td'`, `'2c'`) and shuffle them using the Fisher-Yates algorithm with Node's `crypto.randomInt()` for cryptographically fair shuffling.
> 2. `server/engine/evaluator.js`: Write a `evaluateShowdown(players, communityCards)` function using the `pokersolver` library (`Hand.solve` and `Hand.winners`). Note: since `numDecks` can be > 1, handle edge cases where identical cards appear (or prevent five-of-a-kind crash in `pokersolver` by deduplicating identical suit+rank cards within a single player's 7-card pool before solving). Return the winning player IDs and a human-readable description of the winning hand (e.g., `'Full House, Aces full of Kings'`)."

### Step 3: Core Poker State Machine (Blinds, Turns, Betting Rounds & Side Pots)

**Goal**: Build the authoritative server-side game loop that manages the dealer coin, blinds, betting actions, and street progression.

> **Prompt 3 (Copy & Paste into GenAI):**
> "Create `server/engine/pokerGame.js` that manages a room's state machine in memory and syncs snapshots to MongoDB. Include methods for:
> 1. `startNewHand(room)`:
>    * Rotate `dealerIdx` clockwise to the next player with `coins > 0`.
>    * Deduct Small Blind (`dealerIdx + 1`) and Big Blind (`dealerIdx + 2`), handling heads-up (2-player) rule where Dealer is Small Blind.
>    * Call `createAndShuffleDeck(room.config.numDecks)` and deal 2 hole cards to each active player.
>    * Set `status = 'PREFLOP'` and `currentTurnIdx` to the player left of the Big Blind.
> 2. `handlePlayerAction(room, playerId, action, raiseAmount)`:
>    * Validate that `room.players[room.currentTurnIdx].playerId === playerId`.
>    * Support `'FOLD'`, `'CHECK'`, `'CALL'`, and `'RAISE'` (plus automatic `'ALL_IN'` if call/raise >= player's remaining coins).
>    * Advance `currentTurnIdx` to the next active, non-folded, non-all-in player.
> 3. `checkRoundCompletion(room)`:
>    * If only 1 unfolded player remains, award them the pot immediately and trigger end-of-hand.
>    * If all active players have acted and matched `currentHighestBet` (or are all-in), advance to the next street: `'PREFLOP'` -> `'FLOP'` (deal 3 community cards) -> `'TURN'` (deal 1) -> `'RIVER'` (deal 1) -> `'SHOWDOWN'`.
>    * Reset per-street `currentBet = 0` and set `currentTurnIdx` to the first active player left of the Dealer.
> 4. `sanitizeStateForClient(room, viewerPlayerId)`:
>    * Return a deep copy of `room` with `deck` removed, and hide other players' `holeCards` (replace with `['BACK', 'BACK']`) unless `room.status === 'SHOWDOWN'` and the player did not fold."

### Step 4: Socket.IO Lobby & Game Event Handlers

**Goal**: Connect the poker engine to Socket.IO rooms so players can create codes, configure settings, join, and play.

> **Prompt 4 (Copy & Paste into GenAI):**
> "Create `server/socketHandlers.js` and wire it into `server/index.js`.
> Maintain an in-memory `Map` of active rooms (`rooms.set(roomCode, roomState)`) backed up to MongoDB on room creation and at the end of each hand.
> Implement these Socket.IO events:
> * `room:create({ name, playerId, config })`: Generate a random 6-character uppercase alphanumeric `roomCode`, add the creator as `hostId` and seat 0, and emit `room:state`.
> * `room:join({ roomCode, name, playerId })`: Allow new players to join if `status === 'LOBBY'`, or allow existing players with matching `playerId` to reconnect and reclaim their seat if they refreshed the browser.
> * `room:updateConfig({ roomCode, playerId, config })`: Only allow if `playerId === room.hostId` and `status === 'LOBBY'`. Update `startingCoins` (total buy-in coins per player), `numDecks`, `smallBlind`, and `bigBlind`, updating all seated players' `coins` to `startingCoins`.
> * `game:start({ roomCode, playerId })`: Verify host, require >= 2 players, call `startNewHand(room)`, and broadcast personalized `sanitizeStateForClient(room, p.playerId)` to each connected socket in the room.
> * `game:action({ roomCode, playerId, action, amount })`: Process action via `handlePlayerAction`, broadcast updated state, and if a hand finishes, wait 5 seconds (`setTimeout`) before automatically calling `startNewHand` for the next round."

### Step 5: React Frontend — Landing Page & Host Configuration Lobby

**Goal**: Build the entry experience where players type their name, create/join a code, and the host sets the pot/coins and deck count.

> **Prompt 5 (Copy & Paste into GenAI):**
> "Now let's build the React + Tailwind CSS frontend inside `client/`.
> Create:
> 1. `client/src/socket.js`: Initialize `socket.io-client` (connecting to `window.location.origin` in production or `http://localhost:8000` in dev). Generate and store a persistent `playerId` UUID in `localStorage`. Also set up a `setInterval` that fetches `/api/ping` every 3 minutes so Koyeb's scale-to-zero never puts the instance to sleep while a tab is open.
> 2. `client/src/components/Landing.jsx`:
>    * Top section: A clean input field for **Player Name** (required).
>    * Below it, two side-by-side cards:
>      * **Start New Room**: Button that emits `room:create` with the player's name.
>      * **Enter Room Code**: 6-character code input + 'Join Game' button that emits `room:join`.
> 3. `client/src/components/Lobby.jsx`:
>    * Displays the 6-character **Room Code** with a 'Copy Code' button.
>    * Shows the live list of joined players and their starting coin stack.
>    * If the current user is the **Room Host**, show editable configuration inputs for:
>      * **Starting Coins / Buy-In per Player** (e.g., 1000)
>      * **Number of Card Decks** (dropdown: 1, 2, 3, or 4 decks)
>      * **Small / Big Blind** (e.g., 10 / 20)
>      * **Start Poker Game** button (enabled when 2+ players are in the lobby)."

### Step 6: React Frontend — The Interactive Poker Table & Deployment

**Goal**: Build the oval poker table UI, dealer coin indicator, card animations, and betting controls, then deploy to Koyeb.

> **Prompt 6 (Copy & Paste into GenAI):**
> "Create `client/src/components/PokerTable.jsx` and `ActionBar.jsx` using Tailwind CSS:
> 1. **Table Layout (`PokerTable.jsx`)**:
>    * A green felt oval table in the center displaying the **Total Pot Coins**, **Current Street** (`PREFLOP`, `FLOP`, `TURN`, `RIVER`, `SHOWDOWN`), and the 5 **Community Card** slots in the middle.
>    * Position up to 9 player seats around the perimeter, rotating the array so the current local player is always centered at the bottom seat.
>    * Display each player's Name, Remaining Coins, Current Round Bet, Status badge (`FOLDED`, `ALL-IN`), a glowing ring on the active turn player, and a gold **'D' Dealer Coin** icon next to `players[dealerIdx]`.
>    * Render face-up cards for the local player (and showdown players) with suit colors (red ♥/♦, black ♠/♣) and card backs for opponents.
> 2. **Betting Controls (`ActionBar.jsx`)**:
>    * Enabled only when `currentTurnIdx` matches the local player.
>    * Buttons for **Fold**, **Check / Call** (dynamically showing the exact call amount), and **Raise To** with a range slider from `minRaise` up to the player's remaining coin stack (All-In).
>    * Include a banner overlay during `SHOWDOWN` announcing the winner(s) and their winning hand description before the next hand begins."

## 6. Deployment Checklist for Koyeb & MongoDB Atlas (Free Tier)

1. **MongoDB Atlas (M0 Free Tier)**:
   * Create a free cluster on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
   * Under **Database Access**, create a database user and copy the connection string (`mongodb+srv://...`).
   * Under **Network Access**, add `0.0.0.0/0` (Allow Access from Anywhere) so Koyeb's microVM outbound IPs can connect.
2. **Root `package.json` Build & Start Scripts (Koyeb Buildpack Ready)**:
   Ensure your root `package.json` includes `engines` and these exact scripts so Koyeb's Node.js buildpack compiles both client and server automatically:
   ```json
   {
     "engines": {
       "node": ">=20.0.0"
     },
     "scripts": {
       "build": "npm install --include=dev --prefix client && npm run build --prefix client",
       "start": "node server/index.js"
     }
   }
   ```
3. **Koyeb Free Web Service Setup**:
   * Push your repository to GitHub, sign in to [Koyeb](https://app.koyeb.com/), and click **Create Web Service** → **GitHub**.
   * **Builder**: Select **Buildpack** (override **Build command** to `npm run build` and **Run command** to `npm start`).
   * **Instance Type**: Select **Eco → Free** (`0.1 vCPU, 512 MB RAM, $0/month`).
   * **Environment Variables**:
     * `PORT` = `8000`
     * `NODE_ENV` = `production`
     * `MONGODB_URI` = your MongoDB Atlas connection string (`mongodb+srv://...`)
   * **Exposed Ports & Health Checks**: Set Port to `8000` (Public HTTP/WS) and set the HTTP Health Check path to `/api/ping`.
4. **Testing Multiplayer**:
   * Open your deployed `https://<your-app-name>-<your-org>.koyeb.app` URL in one normal browser window and one Incognito window, create a room, copy the 6-character code, configure the coins and deck count, and play a full hand!