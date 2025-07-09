# 🕹️ Chain Duel Live

## Project Summary
Chain Duel Live is an online multiplayer 1v1 snake-style dueling game built for the web. It features skill-based gameplay, Lightning payments (LNbits), and Nostr-based identity (no email/password). Players compete in real-time snake battles where eating food steals sats from opponents.
---

## Features
- ⚔️ 1v1 snake-style duels with real-time gameplay
- 🧠 Skill-based competitive gameplay
- ⚡ Lightning payments (LNbits integration) for buy-ins
- 🧑‍💻 Identity via Nostr keys (NIP-07 extension or manual key input)
- 🖥️ Modern web stack with minimalist retro design
- 🧩 Modular, scalable monorepo structure
- 📊 Real-time sats distribution tracking
- 🎮 Lobby system with ready-up mechanics
- ⏱️ 3-second countdown before game start

---

## Tech Stack
| Area         | Stack                                                      |
|--------------|------------------------------------------------------------|
| Frontend     | Vite + React + TypeScript + Tailwind                       |
| Auth/Identity| Nostr (NIP-07 extension or manual key input)               |
| Networking   | WebSocket (Socket.IO), Nostr DMs, optional relays          |
| Payments     | Lightning (LNbits API)                                     |
| Backend      | Node.js + Express + TypeScript                             |
| DB           | In-memory (game state) + SQLite/PostgreSQL for persistence |
| Dev Tooling  | pnpm + TurboRepo + ESLint + Prettier + SWC                |

---

## Monorepo Structure
```
chainduellive/
  apps/
    backend/      # Node.js/Express backend (TypeScript)
      src/
        game/     # Snake game engine
        index.ts  # Main server with Socket.IO
    frontend/     # Vite/React frontend (TypeScript)
      src/
        components/
          game/   # Game components (GamePage, SnakeGame)
          menu/   # Menu components (MainMenu, GameLobby)
          shared/ # Shared hooks and utilities
  package.json    # Monorepo root
  pnpm-workspace.yaml
  README.md
```

---

## Setup & Development

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+ recommended)
- [pnpm](https://pnpm.io/) (monorepo package manager)
- [Git](https://git-scm.com/)
- [LNbits](https://github.com/lnbits/lnbits) (for Lightning payments - optional)

### Install dependencies
```sh
pnpm install
```

### Start the development servers
From the monorepo root:
```sh
pnpm run dev      # Start both frontend and backend concurrently
```
- The `dev` script in the root `package.json` uses `concurrently` to run both frontend and backend together for a smooth development workflow.

You can also run them individually:
```sh
pnpm run dev:frontend   # Start frontend only
pnpm run dev:backend    # Start backend only
```

### Environment Variables
Create a `.env` file in the backend directory:
```sh
LNBITS_API_URL=http://localhost:5000
LNBITS_ADMIN_KEY=your_admin_key_here
LNBITS_WEBHOOK_SECRET=your_webhook_secret_here
```

### Lint & Format
```sh
pnpm --filter frontend lint
```

---

## Contribution Guidelines
- Use feature branches for new features or fixes.
- Keep code modular and organized by feature/type.
- Use clear, descriptive commit messages.
- Run linting and tests before pushing.
- Open a pull request for review.

---

## License
MIT