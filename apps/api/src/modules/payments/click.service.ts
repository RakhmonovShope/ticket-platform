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
  CLICK_CONFIG,
  CLICK_ERRORS,
  ClickPrepareInput,
  ClickCompleteInput,
  ClickPrepareResponse,
  ClickCompleteResponse,
  PaymentUrlResponse,
} from './payment.types.js';
import {
  PaymentNotFoundError,
  BookingNotFoundError,
  InvalidSignatureError,
  CannotPerformOperationError,
  createClickErrorResponse,
  createClickPrepareSuccessResponse,
  createClickCompleteSuccessResponse,
} from './payment.errors.js';

const prisma = new PrismaClient();

// ============================================================================
// CLICK SERVICE
// ============================================================================

class ClickService {
  private static instance: ClickService;

  private constructor() {}

  public static getInstance(): ClickService {
    if (!ClickService.instance) {
      ClickService.instance = new ClickService();
    }
    return ClickService.instance;
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
      (p) => p.provider === PaymentProvider.CLICK && p.status === PaymentStatus.PENDING
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
        provider: PaymentProvider.CLICK,
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
    const params = new URLSearchParams({
      service_id: CLICK_CONFIG.serviceId,
      merchant_id: CLICK_CONFIG.merchantId,
      merchant_user_id: CLICK_CONFIG.merchantUserId,
      amount: amount.toString(),
      transaction_param: paymentId, // merchant_trans_id
      return_url: CLICK_CONFIG.returnUrl,
    });

    const paymentUrl = `${CLICK_CONFIG.baseUrl}?${params.toString()}`;

    return {
      paymentId,
      paymentUrl,
      provider: 'CLICK',
      amount,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes
    };
  }

  // ==========================================================================
  // PREPARE PAYMENT (Webhook from Click)
  // ==========================================================================

  async preparePayment(input: ClickPrepareInput): Promise<ClickPrepareResponse> {
    const {
      click_trans_id,
      service_id,
      click_paydoc_id,
      merchant_trans_id,
      amount,
      action,
      error,
      sign_time,
      sign_string,
    } = input;

    // Verify signature
    const expectedSign = this.generateSignature({
      click_trans_id,
      service_id,
      merchant_trans_id,
      amount,
      action,
      sign_time,
    });

    if (sign_string !== expectedSign) {
      await this.logTransaction(
        merchant_trans_id,
        TransactionType.PREPARE,
        amount,
        input,
        undefined,
        TransactionStatus.FAILED,
        CLICK_ERRORS.SIGN_CHECK_FAILED,
        'Invalid signature'
      );

      return {
        click_trans_id,
        merchant_trans_id,
        merchant_prepare_id: 0,
        error: CLICK_ERRORS.SIGN_CHECK_FAILED,
        error_note: 'SIGN CHECK FAILED',
      };
    }

    // Check for Click error
    if (error < 0) {
      await this.logTransaction(
        merchant_trans_id,
        TransactionType.PREPARE,
        amount,
        input,
        String(click_trans_id),
        TransactionStatus.FAILED,
        error,
        'Click reported error'
      );

      return {
        click_trans_id,
        merchant_trans_id,
        merchant_prepare_id: 0,
        error: error,
        error_note: 'Click error',
      };
    }

    // Find payment
    const payment = await prisma.payment.findUnique({
      where: { id: merchant_trans_id },
      include: { booking: true },
    });

    if (!payment) {
      await this.logTransaction(
        merchant_trans_id,
        TransactionType.PREPARE,
        amount,
        input,
        String(click_trans_id),
        TransactionStatus.FAILED,
        CLICK_ERRORS.USER_NOT_FOUND,
        'Payment not found'
      );

      return {
        click_trans_id,
        merchant_trans_id,
        merchant_prepare_id: 0,
        error: CLICK_ERRORS.USER_NOT_FOUND,
        error_note: 'User not found',
      };
    }

    // Validate amount
    const expectedAmount = Number(payment.amount);
    if (Math.abs(amount - expectedAmount) > 0.01) {
      await this.logTransaction(
        payment.id,
        TransactionType.PREPARE,
        amount,
        input,
        String(click_trans_id),
        TransactionStatus.FAILED,
        CLICK_ERRORS.INCORRECT_PARAMETER,
        `Amount mismatch: expected ${expectedAmount}, got ${amount}`
      );

      return {
        click_trans_id,
        merchant_trans_id,
        merchant_prepare_id: 0,
        error: CLICK_ERRORS.INCORRECT_PARAMETER,
        error_note: 'Incorrect amount',
      };
    }

    // Check if already paid
    if (payment.status === PaymentStatus.COMPLETED) {
      await this.logTransaction(
        payment.id,
        TransactionType.PREPARE,
        amount,
        input,
        String(click_trans_id),
        TransactionStatus.FAILED,
        CLICK_ERRORS.ALREADY_PAID,
        'Already paid'
      );

      return {
        click_trans_id,
        merchant_trans_id,
        merchant_prepare_id: 0,
        error: CLICK_ERRORS.ALREADY_PAID,
        error_note: 'Already paid',
      };
    }

    // Check if cancelled
    if (payment.status === PaymentStatus.CANCELLED) {
      await this.logTransaction(
        payment.id,
        TransactionType.PREPARE,
        amount,
        input,
        String(click_trans_id),
        TransactionStatus.FAILED,
        CLICK_ERRORS.TRANSACTION_CANCELLED,
        'Transaction cancelled'
      );

      return {
        click_trans_id,
        merchant_trans_id,
        merchant_prepare_id: 0,
        error: CLICK_ERRORS.TRANSACTION_CANCELLED,
        error_note: 'Transaction cancelled',
      };
    }

    // Check booking status
    if (payment.booking.status !== BookingStatus.PENDING) {
      await this.logTransaction(
        payment.id,
        TransactionType.PREPARE,
        amount,
        input,
        String(click_trans_id),
        TransactionStatus.FAILED,
        CLICK_ERRORS.TRANSACTION_CANCELLED,
        'Booking not pending'
      );

      return {
        click_trans_id,
        merchant_trans_id,
        merchant_prepare_id: 0,
        error: CLICK_ERRORS.TRANSACTION_CANCELLED,
        error_note: 'Booking not available',
      };
    }

    // Update payment with Click transaction ID
    await prisma.payment.update({
      where: { id: payment.id },
      data: { externalId: String(click_trans_id) },
    });

    // Log successful prepare
    const transaction = await prisma.paymentTransaction.create({
      data: {
        paymentId: payment.id,
        provider: PaymentProvider.CLICK,
        type: TransactionType.PREPARE,
        amount,
        status: TransactionStatus.SUCCESS,
        externalId: String(click_trans_id),
        requestData: input as object,
        idempotencyKey: `click_prepare_${click_trans_id}`,
      },
    });

    return createClickPrepareSuccessResponse(
      click_trans_id,
      merchant_trans_id,
      parseInt(transaction.id.replace(/\D/g, '').slice(0, 10)) || Date.now()
    );
  }

  // ==========================================================================
  // COMPLETE PAYMENT (Webhook from Click)
  // ==========================================================================

  async completePayment(input: ClickCompleteInput): Promise<ClickCompleteResponse> {
    const {
      click_trans_id,
      service_id,
      click_paydoc_id,
      merchant_trans_id,
      merchant_prepare_id,
      amount,
      action,
      error,
      sign_time,
      sign_string,
    } = input;

    // Verify signature (for complete, include merchant_prepare_id)
    const expectedSign = this.generateSignature({
      click_trans_id,
      service_id,
      merchant_trans_id,
      merchant_prepare_id,
      amount,
      action,
      sign_time,
    });

    if (sign_string !== expectedSign) {
      await this.logTransaction(
        merchant_trans_id,
        TransactionType.COMPLETE,
        amount,
        input,
        undefined,
        TransactionStatus.FAILED,
        CLICK_ERRORS.SIGN_CHECK_FAILED,
        'Invalid signature'
      );

      return {
        click_trans_id,
        merchant_trans_id,
        merchant_confirm_id: 0,
        error: CLICK_ERRORS.SIGN_CHECK_FAILED,
        error_note: 'SIGN CHECK FAILED',
      };
    }

    // Check for Click error
    if (error < 0) {
      // Click is reporting an error - cancel the transaction
      const payment = await prisma.payment.findUnique({
        where: { id: merchant_trans_id },
        include: { booking: { include: { seat: true } } },
      });

      if (payment && payment.status === PaymentStatus.PENDING) {
        await prisma.$transaction(async (tx) => {
          await tx.payment.update({
            where: { id: payment.id },
            data: { status: PaymentStatus.FAILED },
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
      }

      await this.logTransaction(
        merchant_trans_id,
        TransactionType.COMPLETE,
        amount,
        input,
        String(click_trans_id),
        TransactionStatus.FAILED,
        error,
        'Click error'
      );

      return {
        click_trans_id,
        merchant_trans_id,
        merchant_confirm_id: 0,
        error: error,
        error_note: 'Transaction failed',
      };
    }

    // Find payment
    const payment = await prisma.payment.findUnique({
      where: { id: merchant_trans_id },
      include: { booking: { include: { seat: true } } },
    });

    if (!payment) {
      await this.logTransaction(
        merchant_trans_id,
        TransactionType.COMPLETE,
        amount,
        input,
        String(click_trans_id),
        TransactionStatus.FAILED,
        CLICK_ERRORS.TRANSACTION_NOT_FOUND,
        'Payment not found'
      );

      return {
        click_trans_id,
        merchant_trans_id,
        merchant_confirm_id: 0,
        error: CLICK_ERRORS.TRANSACTION_NOT_FOUND,
        error_note: 'Transaction not found',
      };
    }

    // Check if already completed (idempotency)
    if (payment.status === PaymentStatus.COMPLETED) {
      const existingTransaction = await prisma.paymentTransaction.findFirst({
        where: {
          paymentId: payment.id,
          type: TransactionType.COMPLETE,
          status: TransactionStatus.SUCCESS,
        },
      });

      return {
        click_trans_id,
        merchant_trans_id,
        merchant_confirm_id: parseInt(existingTransaction?.id.replace(/\D/g, '').slice(0, 10) || '0') || Date.now(),
        error: CLICK_ERRORS.SUCCESS,
        error_note: 'Success',
      };
    }

    // Check if cancelled
    if (payment.status === PaymentStatus.CANCELLED) {
      await this.logTransaction(
        payment.id,
        TransactionType.COMPLETE,
        amount,
        input,
        String(click_trans_id),
        TransactionStatus.FAILED,
        CLICK_ERRORS.TRANSACTION_CANCELLED,
        'Transaction cancelled'
      );

      return {
        click_trans_id,
        merchant_trans_id,
        merchant_confirm_id: 0,
        error: CLICK_ERRORS.TRANSACTION_CANCELLED,
        error_note: 'Transaction cancelled',
      };
    }

    // Verify prepare was done
    const prepareTransaction = await prisma.paymentTransaction.findFirst({
      where: {
        paymentId: payment.id,
        type: TransactionType.PREPARE,
        status: TransactionStatus.SUCCESS,
      },
    });

    if (!prepareTransaction) {
      await this.logTransaction(
        payment.id,
        TransactionType.COMPLETE,
        amount,
        input,
        String(click_trans_id),
        TransactionStatus.FAILED,
        CLICK_ERRORS.TRANSACTION_NOT_FOUND,
        'Prepare not found'
      );

      return {
        click_trans_id,
        merchant_trans_id,
        merchant_confirm_id: 0,
        error: CLICK_ERRORS.TRANSACTION_NOT_FOUND,
        error_note: 'Prepare transaction not found',
      };
    }

    // Complete payment
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

    // Log successful complete
    const transaction = await prisma.paymentTransaction.create({
      data: {
        paymentId: payment.id,
        provider: PaymentProvider.CLICK,
        type: TransactionType.COMPLETE,
        amount,
        status: TransactionStatus.SUCCESS,
        externalId: String(click_trans_id),
        requestData: input as object,
        idempotencyKey: `click_complete_${click_trans_id}`,
      },
    });

    return createClickCompleteSuccessResponse(
      click_trans_id,
      merchant_trans_id,
      parseInt(transaction.id.replace(/\D/g, '').slice(0, 10)) || Date.now()
    );
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

    // Note: Click refunds are typically manual or via API call to Click
    // This handles the internal state update
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

  private generateSignature(params: {
    click_trans_id: number;
    service_id: number;
    merchant_trans_id: string;
    merchant_prepare_id?: number;
    amount: number;
    action: number;
    sign_time: string;
  }): string {
    const {
      click_trans_id,
      service_id,
      merchant_trans_id,
      merchant_prepare_id,
      amount,
      action,
      sign_time,
    } = params;

    // Click signature format depends on action
    // For prepare (action=0): click_trans_id + service_id + SECRET_KEY + merchant_trans_id + amount + action + sign_time
    // For complete (action=1): click_trans_id + service_id + SECRET_KEY + merchant_trans_id + merchant_prepare_id + amount + action + sign_time

    let signString = `${click_trans_id}${service_id}${CLICK_CONFIG.secretKey}${merchant_trans_id}`;

    if (action === 1 && merchant_prepare_id !== undefined) {
      signString += String(merchant_prepare_id);
    }

    signString += `${amount}${action}${sign_time}`;

    return crypto.createHash('md5').update(signString).digest('hex');
  }

  private async logTransaction(
    paymentId: string,
    type: TransactionType,
    amount: number,
    requestData: unknown,
    externalId?: string,
    status: TransactionStatus = TransactionStatus.PENDING,
    errorCode?: number,
    errorMessage?: string
  ): Promise<void> {
    try {
      await prisma.paymentTransaction.create({
        data: {
          paymentId,
          provider: PaymentProvider.CLICK,
          type,
          amount,
          status,
          externalId,
          requestData: requestData as object,
          errorCode: errorCode?.toString(),
          errorMessage,
          idempotencyKey: externalId ? `click_${type}_${externalId}` : undefined,
        },
      });
    } catch (error) {
      // Ignore unique constraint errors for idempotency
      if ((error as any)?.code !== 'P2002') {
        console.error('Failed to log transaction:', error);
      }
    }
  }
}

export const clickService = ClickService.getInstance();
