# API Server

Express.js backend for the ticket booking platform.

## Features

- RESTful API endpoints
- WebSocket server for real-time updates
- Prisma ORM with PostgreSQL
- Redis for caching and session storage
- Payment integrations (Payme, Click)

## Project Structure

```
src/
├── main.ts              # Application entry point
├── middleware/          # Express middleware
│   ├── auth.ts         # JWT authentication
│   └── error-handler.ts # Global error handling
├── modules/
│   ├── venues/         # Venue management
│   ├── sessions/       # Session/event management
│   ├── bookings/       # Booking system
│   └── payments/       # Payment integrations
├── services/
│   └── redis.service.ts # Redis client
├── socket/
│   ├── socket.server.ts # Socket.io setup
│   └── socket.auth.ts   # Socket authentication
└── jobs/
    └── expiration.job.ts # Booking expiration
```

## API Endpoints

### Venues
- `GET /api/venues` - List venues
- `POST /api/venues` - Create venue
- `GET /api/venues/:id` - Get venue details
- `PUT /api/venues/:id` - Update venue
- `DELETE /api/venues/:id` - Delete venue

### Sessions
- `GET /api/sessions` - List sessions
- `POST /api/sessions` - Create session
- `GET /api/sessions/:id` - Get session details
- `PUT /api/sessions/:id` - Update session
- `POST /api/sessions/:id/publish` - Publish session
- `POST /api/sessions/:id/cancel` - Cancel session
- `POST /api/sessions/:id/duplicate` - Duplicate session

### Tariffs
- `GET /api/sessions/:id/tariffs` - Get tariffs
- `POST /api/sessions/:id/tariffs` - Create tariff
- `PUT /api/sessions/:id/tariffs/:tariffId` - Update tariff
- `PUT /api/sessions/:id/tariffs/:tariffId/seats` - Assign seats

### Payments
- `POST /api/payments` - Create payment
- `GET /api/payments/:id` - Get payment status
- `POST /api/payments/refund` - Refund payment
- `POST /api/payments/payme/callback` - Payme webhook
- `POST /api/payments/click/prepare` - Click prepare webhook
- `POST /api/payments/click/complete` - Click complete webhook

## Development

```bash
# Start development server
pnpm dev

# Run tests
pnpm test

# Type check
pnpm check-types

# Lint
pnpm lint
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 3001) |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | JWT signing secret |
| `CORS_ORIGIN` | Allowed CORS origins |

See root `.env.example` for all variables.
