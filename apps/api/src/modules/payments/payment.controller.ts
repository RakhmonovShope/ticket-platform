import { Request, Response, NextFunction } from 'express';
import { PrismaClient, PaymentProvider } from '@prisma/client';
import { ZodError } from 'zod';
import { paymeService } from './payme.service.js';
import { clickService } from './click.service.js';
import {
  CreatePaymentSchema,
  PaymeCallbackSchema,
  ClickPrepareSchema,
  ClickCompleteSchema,
  RefundPaymentSchema,
  CheckPaymentSchema,
  PaymentStatusResponse,
  TransactionLogEntry,
} from './payment.types.js';
import { PaymentNotFoundError } from './payment.errors.js';

const prisma = new PrismaClient();

// ============================================================================
// PAYMENT CONTROLLER
// ============================================================================

class PaymentController {
  // ==========================================================================
  // CREATE PAYMENT
  // ==========================================================================

  async createPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const input = CreatePaymentSchema.parse(req.body);
      const { bookingId, amount, provider } = input;

      let result;

      if (provider === 'PAYME') {
        result = await paymeService.createPayment(bookingId, amount);
      } else if (provider === 'CLICK') {
        result = await clickService.createPayment(bookingId, amount);
      } else {
        return res.status(400).json({ message: 'Unsupported payment provider' });
      }

      // Emit websocket event for payment created
      const io = req.app.get('io');
      if (io) {
        io.emit('payment_created', {
          paymentId: result.paymentId,
          bookingId,
          provider,
          amount,
        });
      }

      res.status(201).json(result);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          message: 'Validation failed',
          errors: error.errors,
        });
      }
      next(error);
    }
  }

  // ==========================================================================
  // PAYME CALLBACK (JSON-RPC)
  // ==========================================================================

  async paymeCallback(req: Request, res: Response, next: NextFunction) {
    try {
      const body = PaymeCallbackSchema.parse(req.body);
      const { method, params, id } = body;

      const result = await paymeService.handleCallback(
        method,
        params,
        id,
        req.headers.authorization
      );

      // Emit websocket events based on method
      if ('result' in result) {
        const io = req.app.get('io');
        if (io) {
          if (method === 'PerformTransaction') {
            io.emit('payment_completed', {
              paymentId: params.id,
              provider: 'PAYME',
            });
          } else if (method === 'CancelTransaction') {
            io.emit('payment_cancelled', {
              paymentId: params.id,
              provider: 'PAYME',
            });
          }
        }
      }

      res.json(result);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: {
            code: -32700,
            message: { uz: 'Invalid JSON', ru: 'Неверный JSON', en: 'Invalid JSON' },
          },
          id: null,
        });
      }
      next(error);
    }
  }

  // ==========================================================================
  // PAYME CHECK STATUS
  // ==========================================================================

  async paymeCheckStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { paymentId } = CheckPaymentSchema.parse(req.body);

      const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
        include: {
          transactions: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!payment) {
        throw new PaymentNotFoundError(paymentId);
      }

      const response: PaymentStatusResponse = {
        paymentId: payment.id,
        bookingId: payment.bookingId,
        provider: payment.provider as any,
        status: payment.status as any,
        amount: Number(payment.amount),
        externalId: payment.externalId,
        paidAt: payment.paidAt?.toISOString() || null,
        refundedAmount: payment.refundedAmount ? Number(payment.refundedAmount) : null,
        refundedAt: payment.refundedAt?.toISOString() || null,
        transactions: payment.transactions.map(
          (t): TransactionLogEntry => ({
            id: t.id,
            type: t.type as any,
            status: t.status as any,
            externalId: t.externalId,
            errorCode: t.errorCode,
            errorMessage: t.errorMessage,
            createdAt: t.createdAt.toISOString(),
          })
        ),
      };

      res.json(response);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          message: 'Validation failed',
          errors: error.errors,
        });
      }
      next(error);
    }
  }

  // ==========================================================================
  // CLICK PREPARE (Webhook)
  // ==========================================================================

  async clickPrepare(req: Request, res: Response, next: NextFunction) {
    try {
      const input = ClickPrepareSchema.parse(req.body);
      const result = await clickService.preparePayment(input);

      res.json(result);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.json({
          click_trans_id: req.body.click_trans_id || 0,
          merchant_trans_id: req.body.merchant_trans_id || '',
          merchant_prepare_id: 0,
          error: -8,
          error_note: 'Error in request from click',
        });
      }
      next(error);
    }
  }

  // ==========================================================================
  // CLICK COMPLETE (Webhook)
  // ==========================================================================

  async clickComplete(req: Request, res: Response, next: NextFunction) {
    try {
      const input = ClickCompleteSchema.parse(req.body);
      const result = await clickService.completePayment(input);

      // Emit websocket event on success
      if (result.error === 0) {
        const io = req.app.get('io');
        if (io) {
          io.emit('payment_completed', {
            paymentId: input.merchant_trans_id,
            provider: 'CLICK',
          });
        }
      }

      res.json(result);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.json({
          click_trans_id: req.body.click_trans_id || 0,
          merchant_trans_id: req.body.merchant_trans_id || '',
          merchant_confirm_id: 0,
          error: -8,
          error_note: 'Error in request from click',
        });
      }
      next(error);
    }
  }

  // ==========================================================================
  // GET PAYMENT STATUS
  // ==========================================================================

  async getPaymentStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const payment = await prisma.payment.findUnique({
        where: { id },
        include: {
          booking: {
            include: {
              session: true,
              seat: true,
            },
          },
          transactions: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!payment) {
        throw new PaymentNotFoundError(id);
      }

      const response: PaymentStatusResponse = {
        paymentId: payment.id,
        bookingId: payment.bookingId,
        provider: payment.provider as any,
        status: payment.status as any,
        amount: Number(payment.amount),
        externalId: payment.externalId,
        paidAt: payment.paidAt?.toISOString() || null,
        refundedAmount: payment.refundedAmount ? Number(payment.refundedAmount) : null,
        refundedAt: payment.refundedAt?.toISOString() || null,
        transactions: payment.transactions.map(
          (t): TransactionLogEntry => ({
            id: t.id,
            type: t.type as any,
            status: t.status as any,
            externalId: t.externalId,
            errorCode: t.errorCode,
            errorMessage: t.errorMessage,
            createdAt: t.createdAt.toISOString(),
          })
        ),
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================================================
  // LIST PAYMENTS
  // ==========================================================================

  async listPayments(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        bookingId,
        provider,
        status,
        page = '1',
        limit = '20',
      } = req.query;

      const where: any = {};

      if (bookingId) where.bookingId = bookingId;
      if (provider) where.provider = provider as PaymentProvider;
      if (status) where.status = status;

      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
      const take = parseInt(limit as string);

      const [payments, total] = await Promise.all([
        prisma.payment.findMany({
          where,
          include: {
            booking: {
              include: {
                session: { select: { id: true, name: true } },
                seat: { select: { id: true, row: true, number: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take,
        }),
        prisma.payment.count({ where }),
      ]);

      res.json({
        payments: payments.map((p) => ({
          id: p.id,
          bookingId: p.bookingId,
          provider: p.provider,
          status: p.status,
          amount: Number(p.amount),
          externalId: p.externalId,
          paidAt: p.paidAt?.toISOString(),
          createdAt: p.createdAt.toISOString(),
          booking: {
            session: p.booking.session,
            seat: p.booking.seat,
          },
        })),
        total,
        page: parseInt(page as string),
        totalPages: Math.ceil(total / take),
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================================================
  // REFUND
  // ==========================================================================

  async refundPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const input = RefundPaymentSchema.parse(req.body);
      const { paymentId, amount, reason } = input;

      const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
      });

      if (!payment) {
        throw new PaymentNotFoundError(paymentId);
      }

      let result;

      if (payment.provider === PaymentProvider.PAYME) {
        result = await paymeService.refund(paymentId, amount, reason);
      } else if (payment.provider === PaymentProvider.CLICK) {
        result = await clickService.refund(paymentId, amount, reason);
      } else {
        return res.status(400).json({ message: 'Unsupported payment provider' });
      }

      // Emit websocket event
      const io = req.app.get('io');
      if (io) {
        io.emit('payment_refunded', {
          paymentId,
          refundedAmount: result.refundedAmount,
          provider: payment.provider,
        });
      }

      res.json({
        paymentId,
        refundedAmount: result.refundedAmount,
        status: 'refunded',
        refundedAt: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          message: 'Validation failed',
          errors: error.errors,
        });
      }
      next(error);
    }
  }

  // ==========================================================================
  // GET TRANSACTION LOGS
  // ==========================================================================

  async getTransactionLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const { paymentId } = req.params;
      const { provider, type, status, page = '1', limit = '50' } = req.query;

      const where: any = {};

      if (paymentId) where.paymentId = paymentId;
      if (provider) where.provider = provider;
      if (type) where.type = type;
      if (status) where.status = status;

      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
      const take = parseInt(limit as string);

      const [transactions, total] = await Promise.all([
        prisma.paymentTransaction.findMany({
          where,
          include: {
            payment: {
              select: { id: true, bookingId: true, amount: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take,
        }),
        prisma.paymentTransaction.count({ where }),
      ]);

      res.json({
        transactions: transactions.map((t) => ({
          id: t.id,
          paymentId: t.paymentId,
          provider: t.provider,
          type: t.type,
          status: t.status,
          amount: Number(t.amount),
          externalId: t.externalId,
          errorCode: t.errorCode,
          errorMessage: t.errorMessage,
          retryCount: t.retryCount,
          createdAt: t.createdAt.toISOString(),
          payment: {
            id: t.payment.id,
            bookingId: t.payment.bookingId,
            amount: Number(t.payment.amount),
          },
        })),
        total,
        page: parseInt(page as string),
        totalPages: Math.ceil(total / take),
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================================================
  // RETRY FAILED WEBHOOK
  // ==========================================================================

  async retryWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      const { transactionId } = req.params;

      const transaction = await prisma.paymentTransaction.findUnique({
        where: { id: transactionId },
        include: { payment: true },
      });

      if (!transaction) {
        return res.status(404).json({ message: 'Transaction not found' });
      }

      if (transaction.status === 'SUCCESS') {
        return res.status(400).json({ message: 'Transaction already successful' });
      }

      if (transaction.retryCount >= transaction.maxRetries) {
        return res.status(400).json({
          message: `Maximum retries (${transaction.maxRetries}) exceeded`,
        });
      }

      // Update retry count
      await prisma.paymentTransaction.update({
        where: { id: transactionId },
        data: { retryCount: transaction.retryCount + 1 },
      });

      // Retry logic would depend on the transaction type
      // For now, just return the updated transaction
      res.json({
        message: 'Retry initiated',
        transactionId,
        retryCount: transaction.retryCount + 1,
        maxRetries: transaction.maxRetries,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const paymentController = new PaymentController();
