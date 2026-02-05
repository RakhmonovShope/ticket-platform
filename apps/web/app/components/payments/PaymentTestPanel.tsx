'use client';

import { useState } from 'react';
import { PaymentMethodSelector } from './PaymentMethodSelector';
import type { PaymentStatusResponse, PaymentProvider } from '../../hooks/payments/types';

// ============================================================================
// PAYMENT TEST PANEL
// ============================================================================

interface PaymentTestPanelProps {
  onClose?: () => void;
}

export function PaymentTestPanel({ onClose }: PaymentTestPanelProps) {
  const [testBookingId] = useState(`test_booking_${Date.now()}`);
  const [testAmount, setTestAmount] = useState(100000);
  const [selectedProviders, setSelectedProviders] = useState<PaymentProvider[]>(['PAYME', 'CLICK']);
  const [lastPayment, setLastPayment] = useState<PaymentStatusResponse | null>(null);
  const [lastError, setLastError] = useState<Error | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${timestamp}] ${message}`, ...prev].slice(0, 50));
  };

  const handleSuccess = (payment: PaymentStatusResponse) => {
    setLastPayment(payment);
    setLastError(null);
    addLog(`✅ Payment successful: ${payment.paymentId}`);
  };

  const handleError = (error: Error) => {
    setLastError(error);
    addLog(`❌ Payment error: ${error.message}`);
  };

  const handleCancel = () => {
    addLog('⚠️ Payment cancelled by user');
  };

  const toggleProvider = (provider: PaymentProvider) => {
    setSelectedProviders((prev) =>
      prev.includes(provider)
        ? prev.filter((p) => p !== provider)
        : [...prev, provider]
    );
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h2 style={styles.title}>🧪 Payment Test Panel</h2>
        {onClose && (
          <button onClick={onClose} style={styles.closeButton}>
            ✕
          </button>
        )}
      </div>

      <div style={styles.layout}>
        {/* Configuration Panel */}
        <div style={styles.configPanel}>
          <h3 style={styles.sectionTitle}>Configuration</h3>

          {/* Test Booking ID */}
          <div style={styles.field}>
            <label style={styles.label}>Test Booking ID</label>
            <input
              type="text"
              value={testBookingId}
              readOnly
              style={styles.input}
            />
          </div>

          {/* Amount */}
          <div style={styles.field}>
            <label style={styles.label}>Amount (UZS)</label>
            <input
              type="number"
              value={testAmount}
              onChange={(e) => setTestAmount(Number(e.target.value))}
              style={styles.input}
              min={1000}
              step={1000}
            />
          </div>

          {/* Quick Amount Presets */}
          <div style={styles.presets}>
            {[10000, 50000, 100000, 500000, 1000000].map((amt) => (
              <button
                key={amt}
                onClick={() => setTestAmount(amt)}
                style={{
                  ...styles.presetButton,
                  backgroundColor: testAmount === amt ? '#2563eb' : '#f3f4f6',
                  color: testAmount === amt ? '#ffffff' : '#374151',
                }}
              >
                {(amt / 1000).toLocaleString()}K
              </button>
            ))}
          </div>

          {/* Provider Selection */}
          <div style={styles.field}>
            <label style={styles.label}>Enabled Providers</label>
            <div style={styles.checkboxGroup}>
              <label style={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={selectedProviders.includes('PAYME')}
                  onChange={() => toggleProvider('PAYME')}
                />
                <span>Payme</span>
              </label>
              <label style={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={selectedProviders.includes('CLICK')}
                  onChange={() => toggleProvider('CLICK')}
                />
                <span>Click</span>
              </label>
            </div>
          </div>

          {/* Test Instructions */}
          <div style={styles.instructions}>
            <h4 style={styles.instructionsTitle}>How to Test</h4>
            <ol style={styles.instructionsList}>
              <li>Select a payment method</li>
              <li>Click the payment button</li>
              <li>Use the "Simulate Success" or "Simulate Failure" buttons</li>
              <li>Check the logs below for events</li>
            </ol>
          </div>
        </div>

        {/* Payment Panel */}
        <div style={styles.paymentPanel}>
          <PaymentMethodSelector
            bookingId={testBookingId}
            amount={testAmount}
            onSuccess={handleSuccess}
            onError={handleError}
            onCancel={handleCancel}
            testMode={true}
            enabledProviders={selectedProviders}
          />
        </div>

        {/* Results Panel */}
        <div style={styles.resultsPanel}>
          <h3 style={styles.sectionTitle}>Results</h3>

          {/* Last Payment */}
          {lastPayment && (
            <div style={styles.resultCard}>
              <h4 style={styles.resultTitle}>Last Successful Payment</h4>
              <pre style={styles.resultJson}>
                {JSON.stringify(lastPayment, null, 2)}
              </pre>
            </div>
          )}

          {/* Last Error */}
          {lastError && (
            <div style={{ ...styles.resultCard, borderColor: '#fecaca' }}>
              <h4 style={{ ...styles.resultTitle, color: '#dc2626' }}>Last Error</h4>
              <p style={styles.errorMessage}>{lastError.message}</p>
            </div>
          )}

          {/* Event Logs */}
          <div style={styles.logsSection}>
            <div style={styles.logsHeader}>
              <h4 style={styles.logsTitle}>Event Logs</h4>
              <button
                onClick={() => setLogs([])}
                style={styles.clearLogsButton}
              >
                Clear
              </button>
            </div>
            <div style={styles.logs}>
              {logs.length === 0 ? (
                <p style={styles.noLogs}>No events yet</p>
              ) : (
                logs.map((log, i) => (
                  <div key={i} style={styles.logEntry}>
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: '#f9fafb',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 24px',
    backgroundColor: '#1f2937',
    color: '#ffffff',
  },
  title: {
    margin: 0,
    fontSize: 20,
    fontWeight: 600,
  },
  closeButton: {
    padding: '8px 12px',
    fontSize: 16,
    color: '#9ca3af',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: '300px 1fr 350px',
    gap: 24,
    padding: 24,
    flex: 1,
    overflow: 'hidden',
  },
  configPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    padding: 20,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    overflow: 'auto',
  },
  paymentPanel: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: 20,
  },
  resultsPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    padding: 20,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    overflow: 'hidden',
  },
  sectionTitle: {
    margin: 0,
    fontSize: 14,
    fontWeight: 600,
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: 500,
    color: '#4b5563',
  },
  input: {
    padding: '10px 12px',
    fontSize: 14,
    border: '1px solid #d1d5db',
    borderRadius: 8,
    outline: 'none',
  },
  presets: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
  },
  presetButton: {
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 500,
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  checkboxGroup: {
    display: 'flex',
    gap: 16,
  },
  checkbox: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 14,
    cursor: 'pointer',
  },
  instructions: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#eff6ff',
    borderRadius: 8,
  },
  instructionsTitle: {
    margin: '0 0 8px 0',
    fontSize: 13,
    fontWeight: 600,
    color: '#1e40af',
  },
  instructionsList: {
    margin: 0,
    paddingLeft: 20,
    fontSize: 12,
    color: '#3b82f6',
    lineHeight: 1.6,
  },
  resultCard: {
    padding: 12,
    backgroundColor: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
  },
  resultTitle: {
    margin: '0 0 8px 0',
    fontSize: 13,
    fontWeight: 600,
    color: '#22c55e',
  },
  resultJson: {
    margin: 0,
    padding: 8,
    backgroundColor: '#ffffff',
    borderRadius: 4,
    fontSize: 11,
    fontFamily: 'monospace',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    maxHeight: 150,
    overflow: 'auto',
  },
  errorMessage: {
    margin: 0,
    fontSize: 13,
    color: '#dc2626',
  },
  logsSection: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  },
  logsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  logsTitle: {
    margin: 0,
    fontSize: 13,
    fontWeight: 600,
    color: '#374151',
  },
  clearLogsButton: {
    padding: '4px 8px',
    fontSize: 11,
    color: '#6b7280',
    backgroundColor: '#f3f4f6',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
  },
  logs: {
    flex: 1,
    padding: 8,
    backgroundColor: '#1f2937',
    borderRadius: 8,
    overflow: 'auto',
    fontFamily: 'monospace',
    fontSize: 11,
  },
  noLogs: {
    margin: 0,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  logEntry: {
    padding: '4px 0',
    color: '#d1d5db',
    borderBottom: '1px solid #374151',
  },
};

export default PaymentTestPanel;
