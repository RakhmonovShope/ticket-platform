import { Router } from 'express';
import { paymentController } from './payment.controller.js';

const router = Router();

// ============================================================================
// PAYMENT ROUTES
// ============================================================================

/**
 * Create Payment
 * POST /api/payments
 * Body: { bookingId, amount, provider: "PAYME" | "CLICK" }
 */
router.post('/', paymentController.createPayment.bind(paymentController));

/**
 * Get Payment Status
 * GET /api/payments/:id
 */
router.get('/:id', paymentController.getPaymentStatus.bind(paymentController));

/**
 * List Payments
 * GET /api/payments
 * Query: { bookingId?, provider?, status?, page?, limit? }
 */
router.get('/', paymentController.listPayments.bind(paymentController));

/**
 * Refund Payment
 * POST /api/payments/refund
 * Body: { paymentId, amount?, reason }
 */
router.post('/refund', paymentController.refundPayment.bind(paymentController));

// ============================================================================
// PAYME ROUTES
// ============================================================================

/**
 * Payme Callback (JSON-RPC)
 * POST /api/payments/payme/callback
 * This is called by Payme servers
 * Handles: CheckPerformTransaction, CreateTransaction, PerformTransaction, etc.
 */
router.post('/payme/callback', paymentController.paymeCallback.bind(paymentController));

/**
 * Payme Check Status
 * POST /api/payments/payme/check
 * Body: { paymentId }
 */
router.post('/payme/check', paymentController.paymeCheckStatus.bind(paymentController));

// ============================================================================
// CLICK ROUTES
// ============================================================================

/**
 * Click Prepare (Webhook)
 * POST /api/payments/click/prepare
 * Called by Click servers to prepare payment
 */
router.post('/click/prepare', paymentController.clickPrepare.bind(paymentController));

/**
 * Click Complete (Webhook)
 * POST /api/payments/click/complete
 * Called by Click servers to complete payment
 */
router.post('/click/complete', paymentController.clickComplete.bind(paymentController));

// ============================================================================
// TRANSACTION LOGS
// ============================================================================

/**
 * Get Transaction Logs for a Payment
 * GET /api/payments/:paymentId/transactions
 */
router.get(
  '/:paymentId/transactions',
  paymentController.getTransactionLogs.bind(paymentController)
);

/**
 * Retry Failed Webhook
 * POST /api/payments/transactions/:transactionId/retry
 */
router.post(
  '/transactions/:transactionId/retry',
  paymentController.retryWebhook.bind(paymentController)
);

export { router as paymentRoutes };
