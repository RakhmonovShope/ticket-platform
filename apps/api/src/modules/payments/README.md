# Payments Module

Payment integrations for Uzbekistan payment providers.

## Supported Providers

### Payme

[Payme](https://payme.uz) is a popular mobile payment app in Uzbekistan.

**Integration Flow:**
1. Client calls `POST /api/payments` to create payment
2. Server generates Payme URL and returns it
3. Client redirects/opens Payme payment page
4. Payme sends callbacks to server (JSON-RPC)
5. Server updates payment and booking status

**Callbacks:**
- `CheckPerformTransaction` - Validate order
- `CreateTransaction` - Create transaction
- `PerformTransaction` - Complete payment
- `CancelTransaction` - Cancel/refund
- `CheckTransaction` - Check status
- `GetStatement` - Get transaction list

### Click

[Click](https://click.uz) is another popular payment solution in Uzbekistan.

**Integration Flow:**
1. Client calls `POST /api/payments` to create payment
2. Server generates Click URL and returns it
3. Client redirects to Click payment page
4. Click calls `prepare` webhook to validate
5. User completes payment on Click
6. Click calls `complete` webhook
7. Server updates payment and booking status

## Configuration

```env
# Payme
PAYME_MERCHANT_ID=your-merchant-id
PAYME_SECRET_KEY=your-secret-key
PAYME_TEST_SECRET_KEY=your-test-secret-key
PAYME_SANDBOX=true

# Click
CLICK_MERCHANT_ID=your-merchant-id
CLICK_SERVICE_ID=your-service-id
CLICK_SECRET_KEY=your-secret-key
CLICK_MERCHANT_USER_ID=your-user-id
CLICK_SANDBOX=true
```

## Testing

### Sandbox Mode

Both providers support sandbox mode for testing:
- Set `PAYME_SANDBOX=true` and use test credentials
- Set `CLICK_SANDBOX=true` and use test credentials

### Test UI

The frontend includes a test panel (`PaymentTestPanel`) that allows:
- Simulating successful payments
- Simulating failed payments
- Viewing payment event logs

## API Endpoints

### Create Payment
```http
POST /api/payments
Content-Type: application/json

{
  "bookingId": "uuid",
  "amount": 100000,
  "provider": "PAYME" | "CLICK"
}
```

Response:
```json
{
  "paymentId": "uuid",
  "paymentUrl": "https://checkout.paycom.uz/...",
  "provider": "PAYME",
  "amount": 100000,
  "expiresAt": "2026-02-05T12:00:00Z"
}
```

### Get Payment Status
```http
GET /api/payments/:id
```

### Refund Payment
```http
POST /api/payments/refund
Content-Type: application/json

{
  "paymentId": "uuid",
  "amount": 50000,  // optional, full refund if omitted
  "reason": "Customer request"
}
```

## Security

- Payme uses Basic Auth with base64 encoded credentials
- Click uses MD5 signature verification
- All webhooks validate signatures before processing
- Idempotency keys prevent double processing

## Error Codes

### Payme
| Code | Description |
|------|-------------|
| -31001 | Invalid amount |
| -31003 | Transaction not found |
| -31050 | Order not found |
| -32504 | Unauthorized |

### Click
| Code | Description |
|------|-------------|
| 0 | Success |
| -1 | Sign check failed |
| -4 | Already paid |
| -5 | User not found |
| -6 | Transaction not found |
| -9 | Transaction cancelled |
