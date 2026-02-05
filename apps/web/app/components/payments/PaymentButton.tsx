'use client';

import { useState, useCallback } from 'react';
import { usePayment } from '../../hooks/payments/use-payment';
import type { PaymentButtonProps, PaymentProvider } from '../../hooks/payments/types';

// ============================================================================
// PROVIDER CONFIG
// ============================================================================

const PROVIDER_CONFIG: Record<
  PaymentProvider,
  {
    name: string;
    logo: string;
    color: string;
    bgColor: string;
    hoverBgColor: string;
  }
> = {
  PAYME: {
    name: 'Payme',
    logo: '💳',
    color: '#ffffff',
    bgColor: '#00CDAC',
    hoverBgColor: '#00B89C',
  },
  CLICK: {
    name: 'Click',
    logo: '📱',
    color: '#ffffff',
    bgColor: '#0066FF',
    hoverBgColor: '#0052CC',
  },
};

// ============================================================================
// PAYMENT BUTTON COMPONENT
// ============================================================================

export function PaymentButton({
  bookingId,
  amount,
  provider,
  onSuccess,
  onError,
  onCancel,
  disabled = false,
  className = '',
  testMode = false,
}: PaymentButtonProps) {
  const [step, setStep] = useState<'idle' | 'creating' | 'waiting' | 'success' | 'error'>('idle');

  const {
    isLoading,
    isProcessing,
    error,
    payment,
    createPayment,
    openPaymentWindow,
    reset,
    simulateSuccess,
    simulateFailure,
  } = usePayment({
    provider,
    onSuccess: (p) => {
      setStep('success');
      onSuccess?.(p);
    },
    onError: (e) => {
      setStep('error');
      onError?.(e);
    },
    onCancel: () => {
      setStep('idle');
      onCancel?.();
    },
    testMode,
  });

  const config = PROVIDER_CONFIG[provider];

  // Handle payment click
  const handleClick = useCallback(async () => {
    try {
      setStep('creating');
      await createPayment(bookingId, amount);
      setStep('waiting');
      openPaymentWindow();
    } catch (err) {
      setStep('error');
    }
  }, [bookingId, amount, createPayment, openPaymentWindow]);

  // Handle retry
  const handleRetry = useCallback(() => {
    reset();
    setStep('idle');
  }, [reset]);

  // Format amount for display
  const formattedAmount = new Intl.NumberFormat('uz-UZ', {
    style: 'decimal',
    minimumFractionDigits: 0,
  }).format(amount);

  // Render based on step
  const renderContent = () => {
    switch (step) {
      case 'creating':
        return (
          <>
            <LoadingSpinner />
            <span>Creating payment...</span>
          </>
        );

      case 'waiting':
        return (
          <>
            <LoadingSpinner />
            <span>Waiting for payment...</span>
          </>
        );

      case 'success':
        return (
          <>
            <CheckIcon />
            <span>Payment successful!</span>
          </>
        );

      case 'error':
        return (
          <>
            <ErrorIcon />
            <span>Payment failed</span>
          </>
        );

      default:
        return (
          <>
            <span style={styles.logo}>{config.logo}</span>
            <span>Pay with {config.name}</span>
            <span style={styles.amount}>{formattedAmount} UZS</span>
          </>
        );
    }
  };

  const isDisabled = disabled || isLoading || isProcessing || step === 'success';

  return (
    <div style={styles.container} className={className}>
      <button
        onClick={step === 'error' ? handleRetry : handleClick}
        disabled={isDisabled}
        style={{
          ...styles.button,
          backgroundColor: step === 'error' ? '#dc2626' : step === 'success' ? '#22c55e' : config.bgColor,
          color: config.color,
          opacity: isDisabled ? 0.7 : 1,
          cursor: isDisabled ? 'not-allowed' : 'pointer',
        }}
      >
        {renderContent()}
      </button>

      {step === 'error' && error && (
        <p style={styles.errorText}>{error.message}</p>
      )}

      {/* Test mode controls */}
      {testMode && step === 'waiting' && (
        <div style={styles.testControls}>
          <button onClick={simulateSuccess} style={styles.testButton}>
            ✓ Simulate Success
          </button>
          <button
            onClick={() => simulateFailure()}
            style={{ ...styles.testButton, backgroundColor: '#dc2626' }}
          >
            ✗ Simulate Failure
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// ICONS
// ============================================================================

function LoadingSpinner() {
  return (
    <svg
      style={styles.spinner}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="10" opacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round">
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 12 12"
          to="360 12 12"
          dur="1s"
          repeatCount="indefinite"
        />
      </path>
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  button: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: '14px 24px',
    fontSize: 16,
    fontWeight: 600,
    border: 'none',
    borderRadius: 12,
    transition: 'all 0.2s',
    minWidth: 280,
  },
  logo: {
    fontSize: 20,
  },
  amount: {
    marginLeft: 'auto',
    fontWeight: 700,
    opacity: 0.9,
  },
  spinner: {
    animation: 'spin 1s linear infinite',
  },
  errorText: {
    margin: 0,
    fontSize: 13,
    color: '#dc2626',
    textAlign: 'center',
  },
  testControls: {
    display: 'flex',
    gap: 8,
    marginTop: 8,
  },
  testButton: {
    flex: 1,
    padding: '8px 12px',
    fontSize: 12,
    fontWeight: 500,
    color: '#ffffff',
    backgroundColor: '#22c55e',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
  },
};

export default PaymentButton;
