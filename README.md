# Ticket Platform

A real-time ticket booking platform with interactive seat selection, built with modern technologies.

## Tech Stack

### Frontend
- **React 18** - UI library
- **Next.js 16** - React framework
- **TypeScript** - Type safety
- **TailwindCSS** - Styling
- **Zustand** - State management
- **React Query** - Server state
- **Socket.io-client** - Real-time updates

### Backend
- **Node.js** - Runtime
- **Express** - HTTP server
- **TypeScript** - Type safety
- **Prisma** - ORM
- **PostgreSQL** - Database
- **Redis** - Caching & sessions
- **Socket.io** - Real-time server

### Infrastructure
- **pnpm** - Package manager
- **Turborepo** - Monorepo build system
- **Docker** - Containerization
- **GitHub Actions** - CI/CD

## Project Structure

```
ticket-platform/
├── apps/
│   ├── web/              # Next.js frontend
│   ├── api/              # Express backend
│   └── docs/             # Documentation site
├── packages/
│   ├── ui/               # Shared UI components
│   ├── database/         # Prisma schema & client
│   ├── shared-types/     # Shared TypeScript types
│   ├── eslint-config/    # ESLint configurations
│   └── typescript-config/# TypeScript configurations
├── docker-compose.yml    # Local development services
├── turbo.json           # Turborepo configuration
└── pnpm-workspace.yaml  # Workspace configuration
```

## Quick Start

### Prerequisites

- Node.js >= 18
- pnpm >= 9
- Docker & Docker Compose (for local services)

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/ticket-platform.git
   cd ticket-platform
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start local services (PostgreSQL & Redis)**
   ```bash
   pnpm docker:up
   ```

5. **Set up the database**
   ```bash
   pnpm db:push      # Push schema to database
   pnpm db:seed      # Seed with sample data (optional)
   ```

6. **Start development servers**
   ```bash
   pnpm dev
   ```

   This starts:
   - Web frontend at http://localhost:3000
   - API backend at http://localhost:3001
   - WebSocket server at ws://localhost:3001

## Available Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start all apps in development mode |
| `pnpm build` | Build all apps for production |
| `pnpm lint` | Lint all packages |
| `pnpm test` | Run tests |
| `pnpm format` | Format code with Prettier |
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:push` | Push schema to database |
| `pnpm db:migrate` | Run migrations |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm docker:up` | Start Docker services |
| `pnpm docker:down` | Stop Docker services |
| `pnpm clean` | Clean build artifacts |

## Features

### Venue Management
- Create and manage venues with custom seat layouts
- Visual venue designer with drag-and-drop
- Support for multiple sections and seat types

### Session Management
- Create events/sessions for venues
- Set session times and status
- Automatic seat duplication from venue

### Tariff System
- Multiple pricing tiers per session
- Visual seat-to-tariff assignment
- Auto-assign strategies

### Real-time Booking
- Interactive seat map with live updates
- 10-minute reservation timeout
- WebSocket-powered seat status sync

### Payments
- Payme integration (Uzbekistan)
- Click integration (Uzbekistan)
- Full and partial refunds
- Sandbox mode for testing

## Environment Variables

See [.env.example](.env.example) for all available configuration options.

## Docker Services

```bash
# Start core services (PostgreSQL + Redis)
pnpm docker:up

# Start with admin tools (pgAdmin, Redis Commander, Mailhog)
docker compose --profile tools up -d

# View logs
pnpm docker:logs

# Stop services
pnpm docker:down
```

### Service Ports
- PostgreSQL: 5432
- Redis: 6379
- pgAdmin: 5050 (when using tools profile)
- Redis Commander: 8081 (when using tools profile)
- Mailhog: 8025 (when using tools profile)

## Contributing

1. Create a feature branch from `develop`
2. Make your changes
3. Run `pnpm lint && pnpm test`
4. Create a pull request

### Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

[optional body]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`

## License

MIT
