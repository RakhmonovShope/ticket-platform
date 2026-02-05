'use client';

import Link from 'next/link';
import { PaymentTestPanel } from '../../../components/payments/PaymentTestPanel';

export default function PaymentTestPage() {
  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <Link href="/admin" style={styles.backLink}>
            ← Back to Admin
          </Link>
          <h1 style={styles.title}>Payment Integration Test</h1>
          <p style={styles.subtitle}>
            Test Payme and Click payment flows in sandbox mode
          </p>
        </div>
      </header>

      {/* Test Panel */}
      <main style={styles.main}>
        <PaymentTestPanel />
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#111827',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  header: {
    padding: '16px 24px',
    borderBottom: '1px solid #374151',
  },
  headerContent: {
    maxWidth: 1400,
    margin: '0 auto',
  },
  backLink: {
    color: '#9ca3af',
    textDecoration: 'none',
    fontSize: 13,
  },
  title: {
    margin: '8px 0 0',
    fontSize: 24,
    fontWeight: 600,
    color: '#ffffff',
  },
  subtitle: {
    margin: '4px 0 0',
    fontSize: 14,
    color: '#9ca3af',
  },
  main: {
    height: 'calc(100vh - 120px)',
  },
};
