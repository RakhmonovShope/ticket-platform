'use client';

import Link from 'next/link';

export default function Home() {
  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>🎫 Ticket Platform</h1>
        <p style={styles.subtitle}>Real-time ticket booking system</p>
      </header>

      <main style={styles.main}>
        <div style={styles.grid}>
          {/* Admin Section */}
          <Link href="/admin" style={styles.card}>
            <div style={styles.cardIcon}>⚙️</div>
            <h2 style={styles.cardTitle}>Admin Dashboard</h2>
            <p style={styles.cardDesc}>Manage venues, sessions, and view analytics</p>
          </Link>

          {/* Venue Designer */}
          <Link href="/admin/venues/designer" style={styles.card}>
            <div style={styles.cardIcon}>🏛️</div>
            <h2 style={styles.cardTitle}>Venue Designer</h2>
            <p style={styles.cardDesc}>Create and edit venue seat layouts</p>
          </Link>

          {/* Sessions */}
          <Link href="/admin/sessions" style={styles.card}>
            <div style={styles.cardIcon}>📅</div>
            <h2 style={styles.cardTitle}>Sessions</h2>
            <p style={styles.cardDesc}>Manage events and tariff assignments</p>
          </Link>

          {/* Seat Map */}
          <Link href="/booking" style={styles.card}>
            <div style={styles.cardIcon}>🪑</div>
            <h2 style={styles.cardTitle}>Seat Selection</h2>
            <p style={styles.cardDesc}>Interactive seat map for booking</p>
          </Link>

          {/* Payments Test */}
          <Link href="/admin/payments/test" style={styles.card}>
            <div style={styles.cardIcon}>💳</div>
            <h2 style={styles.cardTitle}>Payment Test</h2>
            <p style={styles.cardDesc}>Test Payme and Click integrations</p>
          </Link>

          {/* API Health */}
          <a href="http://localhost:3001/health" target="_blank" style={styles.card}>
            <div style={styles.cardIcon}>🔌</div>
            <h2 style={styles.cardTitle}>API Status</h2>
            <p style={styles.cardDesc}>Check API server health</p>
          </a>
        </div>
      </main>

      <footer style={styles.footer}>
        <p>Built with Next.js, Express, Prisma, Socket.io</p>
      </footer>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    backgroundColor: '#f9fafb',
  },
  header: {
    padding: '48px 24px',
    textAlign: 'center',
    backgroundColor: '#1f2937',
    color: '#ffffff',
  },
  title: {
    margin: 0,
    fontSize: 36,
    fontWeight: 700,
  },
  subtitle: {
    margin: '8px 0 0',
    fontSize: 18,
    color: '#9ca3af',
  },
  main: {
    flex: 1,
    padding: '48px 24px',
    maxWidth: 1200,
    margin: '0 auto',
    width: '100%',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: 24,
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    padding: 24,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    border: '1px solid #e5e7eb',
    textDecoration: 'none',
    color: 'inherit',
    transition: 'transform 0.2s, box-shadow 0.2s',
    cursor: 'pointer',
  },
  cardIcon: {
    fontSize: 40,
    marginBottom: 16,
  },
  cardTitle: {
    margin: '0 0 8px',
    fontSize: 20,
    fontWeight: 600,
    color: '#1f2937',
  },
  cardDesc: {
    margin: 0,
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 1.5,
  },
  footer: {
    padding: '24px',
    textAlign: 'center',
    borderTop: '1px solid #e5e7eb',
    color: '#6b7280',
    fontSize: 14,
  },
};
