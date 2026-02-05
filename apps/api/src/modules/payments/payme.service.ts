import crypto from 'crypto';
import {
  PrismaClient,
  PaymentProvider,
  PaymentStatus,
  TransactionType,
  TransactionStatus,
  BookingStatus,
  SeatStatus,
} from '@prisma/client';
import {
  PAYME_CONFIG,
  PAYME_ERRORS,
  PaymeMethod,
  PaymeCheckPerformParams,
  PaymeCreateTransactionParams,
  PaymePerformTransactionParams,
  PaymeCancelTransactionParams,
  PaymeCheckTransactionParams,
  PaymeGetStatementParams,
  PaymeResponse,
  PaymentUrlResponse,
} from './payment.types.js';
import {
  PaymentNotFoundError,
  BookingNotFoundError,
  InvalidAmountError,
  InvalidSignatureError,
  TransactionNotFoundError,
  CannotPerformOperationError,
  AlreadyPaidError,
  AlreadyCancelledError,
  createPaymeErrorResponse,
  createPaymeSuccessResponse,
} from './payment.errors.js';

const prisma = new PrismaClient();

// Transaction timeout: 12 hours (Payme standard)
const TRANSACTION_TIMEOUT_MS = 12 * 60 * 60 * 1000;

// ============================================================================
// PAYME SERVICE
// ============================================================================

class PaymeService {
  private static instance: PaymeService;

  private constructor() {}

  public static getInstance(): PaymeService {
    if (!PaymeService.instance) {
      PaymeService.instance = new PaymeService();
    }
    return PaymeService.instance;
  }

  // ==========================================================================
  // CREATE PAYMENT
  // ==========================================================================

  async createPayment(bookingId: string, amount: number): Promise<PaymentUrlResponse> {
    // Validate booking
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { payments: true },
    });

    if (!booking) {
      throw new BookingNotFoundError(bookingId);
    }

    if (booking.status !== BookingStatus.PENDING) {
      throw new CannotPerformOperationError(`Booking is ${booking.status}`);
    }

    // Check for existing pending payment
    const existingPayment = booking.payments.find(
      (p) => p.provider === PaymentProvider.PAYME && p.status === PaymentStatus.PENDING
    );

    if (existingPayment) {
      // Return existing payment URL
      return this.generatePaymentUrl(existingPayment.id, amount);
    }

    // Create new payment
    const payment = await prisma.payment.create({
      data: {
        bookingId,
        amount,
        provider: PaymentProvider.PAYME,
        status: PaymentStatus.PENDING,
        userId: booking.userId,
      },
    });

    // Log transaction
    await this.logTransaction(payment.id, TransactionType.CREATE, amount, {
      bookingId,
      amount,
    });

    return this.generatePaymentUrl(payment.id, amount);
  }

  // ==========================================================================
  // GENERATE PAYMENT URL
  // ==========================================================================

  private generatePaymentUrl(paymentId: string, amount: number): PaymentUrlResponse {
    // Amount in tiyin (1 UZS = 100 tiyin)
    const amountInTiyin = Math.round(amount * 100);

    // Encode payment ID for Payme
    const encodedAccount = Buffer.from(
      `m=${PAYME_CONFIG.merchantId};ac.order_id=${paymentId};a=${amountInTiyin}`
    ).toString('base64');

    const paymentUrl = `${PAYME_CONFIG.baseUrl}/${encodedAccount}`;

    return {
      paymentId,
      paymentUrl,
      provider: 'PAYME',
      amount,
      expiresAt: new Date(Date.now() + TRANSACTION_TIMEOUT_MS).toISOString(),
    };
  }

  // ==========================================================================
  // CALLBACK HANDLER (JSON-RPC)
  // ==========================================================================

  async handleCallback(
    method: PaymeMethod,
    params: Record<string, unknown>,
    requestId: number | string,
    authHeader: string | undefined
  ): Promise<PaymeResponse> {
    // Verify authorization
    if (!this.verifyAuth(authHeader)) {
      return createPaymeErrorResponse(PAYME_ERRORS.UNAUTHORIZED, requestId);
    }

    try {
      switch (method) {
        case 'CheckPerformTransaction':
          return await this.checkPerformTransaction(params as unknown as PaymeCheckPerformParams, requestId);

        case 'CreateTransaction':
          return await this.createTransaction(params as unknown as PaymeCreateTransactionParams, requestId);

        case 'PerformTransaction':
          return await this.performTransaction(params as unknown as PaymePerformTransactionParams, requestId);

        case 'CancelTransaction':
          return await this.cancelTransaction(params as unknown as PaymeCancelTransactionParams, requestId);

        case 'CheckTransaction':
          return await this.checkTransaction(params as unknown as PaymeCheckTransactionParams, requestId);

        case 'GetStatement':
          return await this.getStatement(params as unknown as PaymeGetStatementParams, requestId);

        default:
          return createPaymeErrorResponse(PAYME_ERRORS.CANNOT_PERFORM, requestId);
      }
    } catch (error) {
      console.error('Payme callback error:', error);
      return createPaymeErrorResponse(PAYME_ERRORS.CANNOT_PERFORM, requestId);
    }
  }

  // ==========================================================================
  // CHECK PERFORM TRANSACTION
  // ==========================================================================

  private async checkPerformTransaction(
    params: PaymeCheckPerformParams,
    requestId: number | string
  ): Promise<PaymeResponse> {
    const paymentId = params.account?.order_id;

    if (!paymentId) {
      return createPaymeErrorResponse(PAYME_ERRORS.ORDER_NOT_FOUND, requestId);
    }

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { booking: true },
    });

    if (!payment) {
      return createPaymeErrorResponse(PAYME_ERRORS.ORDER_NOT_FOUND, requestId);
    }

    // Validate amount (convert from tiyin to UZS)
    const expectedAmountTiyin = Math.round(Number(payment.amount) * 100);
    if (params.amount !== expectedAmountTiyin) {
      return createPaymeErrorResponse(PAYME_ERRORS.INVALID_AMOUNT, requestId);
    }

    // Check booking status
    if (payment.booking.status !== BookingStatus.PENDING) {
      return createPaymeErrorResponse(PAYME_ERRORS.CANNOT_PERFORM, requestId);
    }

    // Check payment status
    if (payment.status === PaymentStatus.COMPLETED) {
      return createPaymeErrorResponse(PAYME_ERRORS.ALREADY_DONE, requestId);
    }

    if (payment.status === PaymentStatus.CANCELLED) {
      return createPaymeErrorResponse(PAYME_ERRORS.CANNOT_PERFORM, requestId);
    }

    await this.logTransaction(payment.id, TransactionType.CHECK, Number(payment.amount), params);

    return createPaymeSuccessResponse({ allow: true }, requestId);
  }

  // ==========================================================================
  // CREATE TRANSACTION
  // ==========================================================================

  private async createTransaction(
    params: PaymeCreateTransactionParams,
    requestId: number | string
  ): Promise<PaymeResponse> {
    const paymentId = params.account?.order_id;
    const paymeTransactionId = params.id;

    if (!paymentId) {
      return createPaymeErrorResponse(PAYME_ERRORS.ORDER_NOT_FOUND, requestId);
    }

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { booking: true, transactions: true },
    });

    if (!payment) {
      return createPaymeErrorResponse(PAYME_ERRORS.ORDER_NOT_FOUND, requestId);
    }

    // Check for existing transaction with same Payme ID
    const existingTransaction = payment.transactions.find(
      (t) => t.externalId === paymeTransactionId
    );

    if (existingTransaction) {
      // Return existing transaction details (idempotency)
      return createPaymeSuccessResponse(
        {
          create_time: existingTransaction.createdAt.getTime(),
          transaction: payment.id,
          state: this.getPaymeState(payment.status),
        },
        requestId
      );
    }

    // Validate amount
    const expectedAmountTiyin = Math.round(Number(payment.amount) * 100);
    if (params.amount !== expectedAmountTiyin) {
      return createPaymeErrorResponse(PAYME_ERRORS.INVALID_AMOUNT, requestId);
    }

    // Check if payment already has a different Payme transaction
    const otherTransaction = payment.transactions.find(
      (t) => t.externalId && t.externalId !== paymeTransactionId && t.type === TransactionType.CREATE
    );

    if (otherTransaction) {
      // Check if the other transaction is still valid (within timeout)
      const elapsed = Date.now() - otherTransaction.createdAt.getTime();
      if (elapsed < TRANSACTION_TIMEOUT_MS) {
        return createPaymeErrorResponse(PAYME_ERRORS.CANNOT_PERFORM, requestId);
      }
    }

    // Check payment status
    if (payment.status === PaymentStatus.COMPLETED) {
      return createPaymeErrorResponse(PAYME_ERRORS.ALREADY_DONE, requestId);
    }

    if (payment.status === PaymentStatus.CANCELLED) {
      return createPaymeErrorResponse(PAYME_ERRORS.CANNOT_PERFORM, requestId);
    }

    // Update payment with Payme transaction ID
    const now = new Date();
    await prisma.payment.update({
      where: { id: paymentId },
      data: { externalId: paymeTransactionId },
    });

    // Log transaction
    await this.logTransaction(
      payment.id,
      TransactionType.CREATE,
      Number(payment.amount),
      params,
      paymeTransactionId
    );

    return createPaymeSuccessResponse(
      {
        create_time: now.getTime(),
        transaction: payment.id,
        state: 1, // Created
      },
      requestId
    );
  }

  // ==========================================================================
  // PERFORM TRANSACTION
  // ==========================================================================

  private async performTransaction(
    params: PaymePerformTransactionParams,
    requestId: number | string
  ): Promise<PaymeResponse> {
    const paymeTransactionId = params.id;

    const payment = await prisma.payment.findFirst({
      where: { externalId: paymeTransactionId },
      include: { booking: { include: { seat: true } } },
    });

    if (!payment) {
      return createPaymeErrorResponse(PAYME_ERRORS.TRANSACTION_NOT_FOUND, requestId);
    }

    // Already completed
    if (payment.status === PaymentStatus.COMPLETED) {
      return createPaymeSuccessResponse(
        {
          perform_time: payment.paidAt?.getTime() || Date.now(),
          transaction: payment.id,
          state: 2, // Completed
        },
        requestId
      );
    }

    // Cancelled
    if (payment.status === PaymentStatus.CANCELLED) {
      return createPaymeErrorResponse(PAYME_ERRORS.CANNOT_PERFORM, requestId);
    }

    // Check transaction timeout
    const transaction = await prisma.paymentTransaction.findFirst({
      where: { paymentId: payment.id, externalId: paymeTransactionId },
      orderBy: { createdAt: 'asc' },
    });

    if (transaction) {
      const elapsed = Date.now() - transaction.createdAt.getTime();
      if (elapsed > TRANSACTION_TIMEOUT_MS) {
        // Cancel due to timeout
        await this.cancelPaymentInternal(payment.id, 'Transaction timeout');
        return createPaymeErrorResponse(PAYME_ERRORS.CANNOT_PERFORM, requestId);
      }
    }

    // Perform payment
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      // Update payment
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.COMPLETED,
          paidAt: now,
        },
      });

      // Update booking
      await tx.booking.update({
        where: { id: payment.bookingId },
        data: { status: BookingStatus.CONFIRMED },
      });

      // Update seat status
      await tx.seat.update({
        where: { id: payment.booking.seatId },
        data: { status: SeatStatus.OCCUPIED },
      });
    });

    // Log transaction
    await this.logTransaction(
      payment.id,
      TransactionType.CONFIRM,
      Number(payment.amount),
      params,
      paymeTransactionId,
      TransactionStatus.SUCCESS
    );

    return createPaymeSuccessResponse(
      {
        perform_time: now.getTime(),
        transaction: payment.id,
        state: 2, // Completed
      },
      requestId
    );
  }

  // ==========================================================================
  // CANCEL TRANSACTION
  // ==========================================================================

  private async cancelTransaction(
    params: PaymeCancelTransactionParams,
    requestId: number | string
  ): Promise<PaymeResponse> {
    const paymeTransactionId = params.id;
    const reason = params.reason;

    const payment = await prisma.payment.findFirst({
      where: { externalId: paymeTransactionId },
      include: { booking: { include: { seat: true } } },
    });

    if (!payment) {
      return createPaymeErrorResponse(PAYME_ERRORS.TRANSACTION_NOT_FOUND, requestId);
    }

    // Already cancelled
    if (payment.status === PaymentStatus.CANCELLED) {
      const cancelTransaction = await prisma.paymentTransaction.findFirst({
        where: { paymentId: payment.id, type: TransactionType.CANCEL },
        orderBy: { createdAt: 'desc' },
      });

      return createPaymeSuccessResponse(
        {
          cancel_time: cancelTransaction?.createdAt.getTime() || Date.now(),
          transaction: payment.id,
          state: payment.paidAt ? -2 : -1, // -2: cancelled after complete, -1: cancelled before complete
        },
        requestId
      );
    }

    const wasCompleted = payment.status === PaymentStatus.COMPLETED;
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      // Update payment
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.CANCELLED,
          refundedAmount: wasCompleted ? payment.amount : null,
          refundedAt: wasCompleted ? now : null,
          refundReason: `Payme cancel reason: ${reason}`,
        },
      });

      // If was completed, need to refund - update booking and seat
      if (wasCompleted) {
        await tx.booking.update({
          where: { id: payment.bookingId },
          data: { status: BookingStatus.CANCELLED },
        });

        await tx.seat.update({
          where: { id: payment.booking.seatId },
          data: { status: SeatStatus.AVAILABLE },
        });
      } else {
        // Just cancel the pending booking
        await tx.booking.update({
          where: { id: payment.bookingId },
          data: { status: BookingStatus.CANCELLED },
        });

        await tx.seat.update({
          where: { id: payment.booking.seatId },
          data: { status: SeatStatus.AVAILABLE },
        });
      }
    });

    // Log transaction
    await this.logTransaction(
      payment.id,
      TransactionType.CANCEL,
      Number(payment.amount),
      params,
      paymeTransactionId,
      TransactionStatus.SUCCESS
    );

    return createPaymeSuccessResponse(
      {
        cancel_time: now.getTime(),
        transaction: payment.id,
        state: wasCompleted ? -2 : -1,
      },
      requestId
    );
  }

  // ==========================================================================
  // CHECK TRANSACTION
  // ==========================================================================

  private async checkTransaction(
    params: PaymeCheckTransactionParams,
    requestId: number | string
  ): Promise<PaymeResponse> {
    const paymeTransactionId = params.id;

    const payment = await prisma.payment.findFirst({
      where: { externalId: paymeTransactionId },
    });

    if (!payment) {
      return createPaymeErrorResponse(PAYME_ERRORS.TRANSACTION_NOT_FOUND, requestId);
    }

    const createTransaction = await prisma.paymentTransaction.findFirst({
      where: { paymentId: payment.id, type: TransactionType.CREATE },
      orderBy: { createdAt: 'asc' },
    });

    const cancelTransaction = await prisma.paymentTransaction.findFirst({
      where: { paymentId: payment.id, type: TransactionType.CANCEL },
      orderBy: { createdAt: 'desc' },
    });

    return createPaymeSuccessResponse(
      {
        create_time: createTransaction?.createdAt.getTime() || payment.createdAt.getTime(),
        perform_time: payment.paidAt?.getTime() || 0,
        cancel_time: cancelTransaction?.createdAt.getTime() || 0,
        transaction: payment.id,
        state: this.getPaymeState(payment.status),
        reason: payment.refundReason ? parseInt(payment.refundReason.split(':')[0]) || null : null,
      },
      requestId
    );
  }

  // ==========================================================================
  // GET STATEMENT
  // ==========================================================================

  private async getStatement(
    params: PaymeGetStatementParams,
    requestId: number | string
  ): Promise<PaymeResponse> {
    const from = new Date(params.from);
    const to = new Date(params.to);

    const payments = await prisma.payment.findMany({
      where: {
        provider: PaymentProvider.PAYME,
        createdAt: {
          gte: from,
          lte: to,
        },
        externalId: { not: null },
      },
      include: {
        transactions: {
          where: { type: TransactionType.CREATE },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    });

    const transactions = payments.map((payment) => ({
      id: payment.externalId,
      time: payment.transactions[0]?.createdAt.getTime() || payment.createdAt.getTime(),
      amount: Math.round(Number(payment.amount) * 100),
      account: { order_id: payment.id },
      create_time: payment.transactions[0]?.createdAt.getTime() || payment.createdAt.getTime(),
      perform_time: payment.paidAt?.getTime() || 0,
      cancel_time: payment.refundedAt?.getTime() || 0,
      transaction: payment.id,
      state: this.getPaymeState(payment.status),
      reason: null,
    }));

    return createPaymeSuccessResponse({ transactions }, requestId);
  }

  // ==========================================================================
  // REFUND
  // ==========================================================================

  async refund(
    paymentId: string,
    amount?: number,
    reason?: string
  ): Promise<{ success: boolean; refundedAmount: number }> {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { booking: { include: { seat: true } } },
    });

    if (!payment) {
      throw new PaymentNotFoundError(paymentId);
    }

    if (payment.status !== PaymentStatus.COMPLETED) {
      throw new CannotPerformOperationError('Payment is not completed');
    }

    const paidAmount = Number(payment.amount);
    const alreadyRefunded = Number(payment.refundedAmount || 0);
    const maxRefundable = paidAmount - alreadyRefunded;
    const refundAmount = amount || maxRefundable;

    if (refundAmount > maxRefundable) {
      throw new CannotPerformOperationError(
        `Maximum refundable amount is ${maxRefundable}`
      );
    }

    const isFullRefund = refundAmount === maxRefundable;
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: paymentId },
        data: {
          refundedAmount: alreadyRefunded + refundAmount,
          refundedAt: now,
          refundReason: reason || 'Manual refund',
          status: isFullRefund ? PaymentStatus.CANCELLED : PaymentStatus.COMPLETED,
        },
      });

      if (isFullRefund) {
        await tx.booking.update({
          where: { id: payment.bookingId },
          data: { status: BookingStatus.CANCELLED },
        });

        await tx.seat.update({
          where: { id: payment.booking.seatId },
          data: { status: SeatStatus.AVAILABLE },
        });
      }
    });

    await this.logTransaction(
      paymentId,
      TransactionType.REFUND,
      refundAmount,
      { amount: refundAmount, reason },
      undefined,
      TransactionStatus.SUCCESS
    );

    return { success: true, refundedAmount: refundAmount };
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  private verifyAuth(authHeader: string | undefined): boolean {
    if (!authHeader) return false;

    try {
      const [type, credentials] = authHeader.split(' ');
      if (type !== 'Basic') return false;

      const decoded = Buffer.from(credentials, 'base64').toString('utf-8');
      const [login, password] = decoded.split(':');

      const expectedKey = PAYME_CONFIG.isSandbox
        ? PAYME_CONFIG.testSecretKey
        : PAYME_CONFIG.secretKey;

      return login === 'Paycom' && password === expectedKey;
    } catch {
      return false;
    }
  }

  private getPaymeState(status: PaymentStatus): number {
    switch (status) {
      case PaymentStatus.PENDING:
        return 1; // Created
      case PaymentStatus.COMPLETED:
        return 2; // Completed
      case PaymentStatus.CANCELLED:
        return -1; // Cancelled (simplified)
      case PaymentStatus.FAILED:
        return -1;
      default:
        return 0;
    }
  }

  private async cancelPaymentInternal(paymentId: string, reason: string): Promise<void> {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { booking: { include: { seat: true } } },
    });

    if (!payment) return;

    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: paymentId },
        data: { status: PaymentStatus.CANCELLED },
      });

      await tx.booking.update({
        where: { id: payment.bookingId },
        data: { status: BookingStatus.CANCELLED },
      });

      await tx.seat.update({
        where: { id: payment.booking.seatId },
        data: { status: SeatStatus.AVAILABLE },
      });
    });

    await this.logTransaction(
      paymentId,
      TransactionType.CANCEL,
      Number(payment.amount),
      { reason },
      undefined,
      TransactionStatus.SUCCESS
    );
  }

  private async logTransaction(
    paymentId: string,
    type: TransactionType,
    amount: number,
    requestData: unknown,
    externalId?: string,
    status: TransactionStatus = TransactionStatus.PENDING
  ): Promise<void> {
    await prisma.paymentTransaction.create({
      data: {
        paymentId,
        provider: PaymentProvider.PAYME,
        type,
        amount,
        status,
        externalId,
        requestData: requestData as object,
        idempotencyKey: externalId ? `payme_${type}_${externalId}` : undefined,
      },
    });
  }
}

export const paymeService = PaymeService.getInstance();
