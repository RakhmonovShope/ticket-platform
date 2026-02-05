'use client';

import { useState } from 'react';
import { PaymentButton } from './PaymentButton';
import type { PaymentMethodSelectorProps, PaymentProvider } from '../../hooks/payments/types';

// ============================================================================
// PAYMENT METHOD SELECTOR
// ============================================================================

export function PaymentMethodSelector({
  bookingId,
  amount,
  onSuccess,
  onError,
  onCancel,
  disabled = false,
  className = '',
  testMode = false,
  enabledProviders = ['PAYME', 'CLICK'],
}: PaymentMethodSelectorProps) {
  const [selectedProvider, setSelectedProvider] = useState<PaymentProvider | null>(null);

  // Format amount for display
  const formattedAmount = new Intl.NumberFormat('uz-UZ', {
    style: 'decimal',
    minimumFractionDigits: 0,
  }).format(amount);

  return (
    <div style={styles.container} className={className}>
      {/* Header */}
      <div style={styles.header}>
        <h3 style={styles.title}>Select Payment Method</h3>
        <p style={styles.amount}>
          Total: <strong>{formattedAmount} UZS</strong>
        </p>
      </div>

      {/* Provider Selection */}
      {!selectedProvider && (
        <div style={styles.providers}>
          {enabledProviders.includes('PAYME') && (
            <button
              onClick={() => setSelectedProvider('PAYME')}
              disabled={disabled}
              style={styles.providerCard}
            >
              <div style={styles.providerLogo}>
                <PaymeLogo />
              </div>
              <div style={styles.providerInfo}>
                <span style={styles.providerName}>Payme</span>
                <span style={styles.providerDesc}>Pay with Payme app or card</span>
              </div>
              <ChevronRight />
            </button>
          )}

          {enabledProviders.includes('CLICK') && (
            <button
              onClick={() => setSelectedProvider('CLICK')}
              disabled={disabled}
              style={styles.providerCard}
            >
              <div style={{ ...styles.providerLogo, backgroundColor: '#0066FF' }}>
                <ClickLogo />
              </div>
              <div style={styles.providerInfo}>
                <span style={styles.providerName}>Click</span>
                <span style={styles.providerDesc}>Pay with Click app or card</span>
              </div>
              <ChevronRight />
            </button>
          )}
        </div>
      )}

      {/* Selected Provider Payment */}
      {selectedProvider && (
        <div style={styles.paymentSection}>
          <button
            onClick={() => setSelectedProvider(null)}
            style={styles.backButton}
          >
            <ChevronLeft />
            <span>Back to payment methods</span>
          </button>

          <PaymentButton
            bookingId={bookingId}
            amount={amount}
            provider={selectedProvider}
            onSuccess={onSuccess}
            onError={onError}
            onCancel={() => {
              setSelectedProvider(null);
              onCancel?.();
            }}
            disabled={disabled}
            testMode={testMode}
          />
        </div>
      )}

      {/* Secure Payment Notice */}
      <div style={styles.secureNotice}>
        <LockIcon />
        <span>Secure payment powered by {selectedProvider || 'certified providers'}</span>
      </div>

      {/* Test Mode Indicator */}
      {testMode && (
        <div style={styles.testBadge}>
          🧪 Test Mode Active
        </div>
      )}
    </div>
  );
}

// ============================================================================
// LOGOS
// ============================================================================

function PaymeLogo() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
      <rect x="2" y="5" width="20" height="14" rx="2" stroke="white" strokeWidth="2" fill="none" />
      <line x1="2" y1="10" x2="22" y2="10" stroke="white" strokeWidth="2" />
    </svg>
  );
}

function ClickLogo() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
      <rect x="5" y="2" width="14" height="20" rx="2" stroke="white" strokeWidth="2" fill="none" />
      <circle cx="12" cy="18" r="1" fill="white" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function ChevronLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
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
    gap: 20,
    padding: 24,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
    maxWidth: 400,
  },
  header: {
    textAlign: 'center',
  },
  title: {
    margin: '0 0 4px 0',
    fontSize: 20,
    fontWeight: 600,
    color: '#1a1a1a',
  },
  amount: {
    margin: 0,
    fontSize: 24,
    color: '#4b5563',
  },
  providers: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  providerCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    backgroundColor: '#f9fafb',
    border: '2px solid #e5e7eb',
    borderRadius: 12,
    cursor: 'pointer',
    transition: 'all 0.2s',
    textAlign: 'left',
  },
  providerLogo: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 48,
    backgroundColor: '#00CDAC',
    borderRadius: 12,
  },
  providerInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  providerName: {
    fontSize: 16,
    fontWeight: 600,
    color: '#1a1a1a',
  },
  providerDesc: {
    fontSize: 13,
    color: '#6b7280',
  },
  paymentSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  backButton: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: 0,
    fontSize: 14,
    color: '#6b7280',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
  },
  secureNotice: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 12,
    borderTop: '1px solid #e5e7eb',
    fontSize: 12,
    color: '#9ca3af',
  },
  testBadge: {
    padding: '8px 12px',
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 500,
    color: '#92400e',
    textAlign: 'center',
  },
};

export default PaymentMethodSelector;
