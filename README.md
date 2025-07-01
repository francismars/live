# 🕹️ Chain Duel Live

## Project Summary
Chain Duel Live is an online multiplayer 1v1 snake-style dueling game built for the web. It features skill-based gameplay, a ranked MMR system, Lightning payments (LNbits), and Nostr-based identity (no email/password).
---

## Features
- ⚔️ 1v1 snake-style duels
- 🧠 Skill-based with MMR/ranked system
- ⚡ Lightning payments (LNbits integration)
- 🧑‍💻 Identity via Nostr keys (NIP-07 extension or manual key input)
- 🖥️ Modern web stack, minimalist retro design
- 🧩 Modular, scalable monorepo structure

---

## Tech Stack
| Area         | Stack                                                      |
|--------------|------------------------------------------------------------|
| Frontend     | Vite + React + TypeScript + Tailwind                       |
| Auth/Identity| Nostr (NIP-07 extension or manual key input)               |
| Networking   | WebSocket (Socket.IO), Nostr DMs, optional relays          |
| Payments     | Lightning (LNbits API)                                     |
| Backend      | Node.js + Express + TypeScript                             |
| DB           | SQLite or PostgreSQL with Drizzle ORM                      |
| Dev Tooling  | pnpm + TurboRepo + ESLint + Prettier + SWC                |

---

## Monorepo Structure
```
chainduellive/
  apps/
    backend/      # Node.js/Express backend (TypeScript)
    frontend/     # Vite/React frontend (TypeScript)
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