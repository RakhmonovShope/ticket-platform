'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  PaymentProvider,
  PaymentUrlResponse,
  PaymentStatusResponse,
  RefundInput,
  RefundResponse,
  UsePaymentOptions,
  UsePaymentReturn,
} from './types';

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const POLL_INTERVAL = 3000; // 3 seconds
const MAX_POLL_ATTEMPTS = 60; // 3 minutes max

// ============================================================================
// API FUNCTIONS
// ============================================================================

async function createPaymentApi(
  bookingId: string,
  amount: number,
  provider: PaymentProvider
): Promise<PaymentUrlResponse> {
  const response = await fetch(`${API_URL}/api/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bookingId, amount, provider }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create payment');
  }

  return response.json();
}

async function checkPaymentStatusApi(paymentId: string): Promise<PaymentStatusResponse> {
  const response = await fetch(`${API_URL}/api/payments/${paymentId}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to check payment status');
  }

  return response.json();
}

async function refundPaymentApi(input: RefundInput): Promise<RefundResponse> {
  const response = await fetch(`${API_URL}/api/payments/refund`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to refund payment');
  }

  return response.json();
}

// ============================================================================
// USE PAYMENT HOOK
// ============================================================================

export function usePayment(options: UsePaymentOptions): UsePaymentReturn {
  const { provider, onSuccess, onError, onCancel, testMode = false } = options;

  // State
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [payment, setPayment] = useState<PaymentStatusResponse | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);

  // Refs
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollAttemptsRef = useRef(0);
  const paymentWindowRef = useRef<Window | null>(null);
  const paymentIdRef = useRef<string | null>(null);

  // Cleanup polling
  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    pollAttemptsRef.current = 0;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
      if (paymentWindowRef.current && !paymentWindowRef.current.closed) {
        paymentWindowRef.current.close();
      }
    };
  }, [stopPolling]);

  // Poll for payment status
  const startPolling = useCallback(
    (paymentId: string) => {
      stopPolling();
      paymentIdRef.current = paymentId;

      const poll = async () => {
        try {
          pollAttemptsRef.current++;

          if (pollAttemptsRef.current > MAX_POLL_ATTEMPTS) {
            stopPolling();
            const timeoutError = new Error('Payment verification timeout');
            setError(timeoutError);
            onError?.(timeoutError);
            return;
          }

          const status = await checkPaymentStatusApi(paymentId);
          setPayment(status);

          if (status.status === 'COMPLETED') {
            stopPolling();
            setIsProcessing(false);
            onSuccess?.(status);
          } else if (status.status === 'CANCELLED' || status.status === 'FAILED') {
            stopPolling();
            setIsProcessing(false);
            if (status.status === 'CANCELLED') {
              onCancel?.();
            } else {
              const failError = new Error('Payment failed');
              setError(failError);
              onError?.(failError);
            }
          }
        } catch (err) {
          console.error('Polling error:', err);
          // Continue polling on transient errors
        }
      };

      // Initial poll
      poll();
      // Set up interval
      pollIntervalRef.current = setInterval(poll, POLL_INTERVAL);
    },
    [stopPolling, onSuccess, onError, onCancel]
  );

  // Create payment
  const createPayment = useCallback(
    async (bookingId: string, amount: number): Promise<PaymentUrlResponse> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await createPaymentApi(bookingId, amount, provider);
        setPaymentUrl(result.paymentUrl);
        paymentIdRef.current = result.paymentId;
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        onError?.(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [provider, onError]
  );

  // Check status
  const checkStatus = useCallback(
    async (paymentId: string): Promise<PaymentStatusResponse> => {
      setIsLoading(true);
      setError(null);

      try {
        const status = await checkPaymentStatusApi(paymentId);
        setPayment(status);
        return status;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Refund
  const refund = useCallback(
    async (input: RefundInput): Promise<RefundResponse> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await refundPaymentApi(input);
        // Refresh payment status
        if (paymentIdRef.current) {
          const status = await checkPaymentStatusApi(paymentIdRef.current);
          setPayment(status);
        }
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Open payment window
  const openPaymentWindow = useCallback(() => {
    if (!paymentUrl) {
      console.warn('No payment URL available');
      return;
    }

    setIsProcessing(true);

    // Calculate window position (centered)
    const width = 600;
    const height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    // Open popup window
    paymentWindowRef.current = window.open(
      paymentUrl,
      'payment_window',
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
    );

    // Start polling for status
    if (paymentIdRef.current) {
      startPolling(paymentIdRef.current);
    }

    // Monitor window close
    const checkWindowClosed = setInterval(() => {
      if (paymentWindowRef.current?.closed) {
        clearInterval(checkWindowClosed);
        // Continue polling a bit more after window closes
        setTimeout(() => {
          if (isProcessing && !payment?.status?.match(/COMPLETED|FAILED|CANCELLED/)) {
            // User closed window without completing - might still complete via webhook
          }
        }, 5000);
      }
    }, 500);
  }, [paymentUrl, startPolling, isProcessing, payment?.status]);

  // Reset state
  const reset = useCallback(() => {
    stopPolling();
    setIsLoading(false);
    setIsProcessing(false);
    setError(null);
    setPayment(null);
    setPaymentUrl(null);
    paymentIdRef.current = null;
  }, [stopPolling]);

  // Test mode: simulate success
  const simulateSuccess = useCallback(() => {
    if (!testMode) {
      console.warn('simulateSuccess only works in test mode');
      return;
    }

    const mockPayment: PaymentStatusResponse = {
      paymentId: paymentIdRef.current || `test_${Date.now()}`,
      bookingId: 'test_booking',
      provider,
      status: 'COMPLETED',
      amount: 100000,
      externalId: `test_ext_${Date.now()}`,
      paidAt: new Date().toISOString(),
      refundedAmount: null,
      refundedAt: null,
      transactions: [
        {
          id: `test_tx_${Date.now()}`,
          type: 'CONFIRM',
          status: 'SUCCESS',
          externalId: `test_ext_${Date.now()}`,
          errorCode: null,
          errorMessage: null,
          createdAt: new Date().toISOString(),
        },
      ],
    };

    setPayment(mockPayment);
    setIsProcessing(false);
    stopPolling();
    onSuccess?.(mockPayment);
  }, [testMode, provider, stopPolling, onSuccess]);

  // Test mode: simulate failure
  const simulateFailure = useCallback(
    (errorMessage = 'Payment failed (simulated)') => {
      if (!testMode) {
        console.warn('simulateFailure only works in test mode');
        return;
      }

      const mockPayment: PaymentStatusResponse = {
        paymentId: paymentIdRef.current || `test_${Date.now()}`,
        bookingId: 'test_booking',
        provider,
        status: 'FAILED',
        amount: 100000,
        externalId: null,
        paidAt: null,
        refundedAmount: null,
        refundedAt: null,
        transactions: [
          {
            id: `test_tx_${Date.now()}`,
            type: 'CONFIRM',
            status: 'FAILED',
            externalId: null,
            errorCode: 'TEST_ERROR',
            errorMessage,
            createdAt: new Date().toISOString(),
          },
        ],
      };

      const err = new Error(errorMessage);
      setPayment(mockPayment);
      setError(err);
      setIsProcessing(false);
      stopPolling();
      onError?.(err);
    },
    [testMode, provider, stopPolling, onError]
  );

  return {
    // State
    isLoading,
    isProcessing,
    error,
    payment,
    paymentUrl,

    // Actions
    createPayment,
    checkStatus,
    refund,
    openPaymentWindow,
    reset,

    // Test mode
    simulateSuccess,
    simulateFailure,
  };
}

export default usePayment;
