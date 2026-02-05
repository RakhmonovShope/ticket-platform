# @repo/shared-types

Shared TypeScript types for the ticket booking platform.

## Installation

This package is internal to the monorepo and is automatically linked.

```json
{
  "dependencies": {
    "@repo/shared-types": "workspace:*"
  }
}
```

## Usage

```typescript
// Import all types
import { User, Session, Booking, PaymentStatus } from '@repo/shared-types';

// Import API-specific types
import { CreateSessionRequest, SessionDetailResponse } from '@repo/shared-types/api';

// Import socket event types
import { ClientToServerEvents, ServerToClientEvents } from '@repo/shared-types/socket';
```

## Package Structure

```
src/
├── index.ts    # Common entities and enums
├── api.ts      # API request/response types
└── socket.ts   # WebSocket event types
```

## Type Categories

### Entities (index.ts)
- `User` - User account
- `Venue` - Venue with seat layout
- `Session` - Event/session
- `Seat` - Individual seat
- `Tariff` - Pricing tier
- `Booking` - Seat reservation
- `Payment` - Payment transaction

### Enums (index.ts)
- `UserRole` - ADMIN, MANAGER, USER
- `SessionStatus` - DRAFT, ACTIVE, SOLD_OUT, CANCELLED, COMPLETED
- `SeatStatus` - AVAILABLE, RESERVED, OCCUPIED, DISABLED, HIDDEN
- `BookingStatus` - PENDING, CONFIRMED, CANCELLED, EXPIRED
- `PaymentProvider` - PAYME, CLICK, UZCARD
- `PaymentStatus` - PENDING, COMPLETED, FAILED, CANCELLED

### API Types (api.ts)
- Request types (Create*, Update*, *Query)
- Response types (*Response, *DetailResponse)
- Pagination helpers

### Socket Types (socket.ts)
- `ClientToServerEvents` - Events sent from client
- `ServerToClientEvents` - Events received from server
- Payload types for each event

## Building

```bash
# Build the package
pnpm build

# Watch mode during development
pnpm dev
```

## Contributing

When adding new types:
1. Add the type to the appropriate file
2. Export it from `index.ts` if it's a common type
3. Update this README if adding new categories
