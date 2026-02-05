'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Stats {
  venues: number;
  sessions: number;
  bookings: number;
  revenue: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        // Fetch basic stats from API
        const [venuesRes, sessionsRes] = await Promise.all([
          fetch(`${API_URL}/api/venues`),
          fetch(`${API_URL}/api/sessions`),
        ]);

        const venues = await venuesRes.json();
        const sessions = await sessionsRes.json();

        setStats({
          venues: venues.venues?.length || venues.length || 0,
          sessions: sessions.sessions?.length || sessions.total || 0,
          bookings: 0,
          revenue: 0,
        });
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <Link href="/" style={styles.backLink}>← Back</Link>
          <h1 style={styles.title}>Admin Dashboard</h1>
        </div>
      </header>

      <main style={styles.main}>
        {/* Stats Cards */}
        <div style={styles.statsGrid}>
          <div style={styles.statCard}>
            <span style={styles.statValue}>{loading ? '...' : stats?.venues}</span>
            <span style={styles.statLabel}>Venues</span>
          </div>
          <div style={styles.statCard}>
            <span style={styles.statValue}>{loading ? '...' : stats?.sessions}</span>
            <span style={styles.statLabel}>Sessions</span>
          </div>
          <div style={styles.statCard}>
            <span style={styles.statValue}>{loading ? '...' : stats?.bookings}</span>
            <span style={styles.statLabel}>Bookings</span>
          </div>
          <div style={styles.statCard}>
            <span style={{ ...styles.statValue, color: '#22c55e' }}>
              {loading ? '...' : `${stats?.revenue?.toLocaleString()} UZS`}
            </span>
            <span style={styles.statLabel}>Revenue</span>
          </div>
        </div>

        {/* Quick Actions */}
        <h2 style={styles.sectionTitle}>Quick Actions</h2>
        <div style={styles.actionsGrid}>
          <Link href="/admin/venues" style={styles.actionCard}>
            <span style={styles.actionIcon}>🏛️</span>
            <span style={styles.actionTitle}>Manage Venues</span>
            <span style={styles.actionDesc}>View and edit venues</span>
          </Link>

          <Link href="/admin/venues/designer" style={styles.actionCard}>
            <span style={styles.actionIcon}>✏️</span>
            <span style={styles.actionTitle}>Venue Designer</span>
            <span style={styles.actionDesc}>Create seat layouts</span>
          </Link>

          <Link href="/admin/sessions" style={styles.actionCard}>
            <span style={styles.actionIcon}>📅</span>
            <span style={styles.actionTitle}>Sessions</span>
            <span style={styles.actionDesc}>Manage events</span>
          </Link>

          <Link href="/admin/sessions/new" style={styles.actionCard}>
            <span style={styles.actionIcon}>➕</span>
            <span style={styles.actionTitle}>New Session</span>
            <span style={styles.actionDesc}>Create new event</span>
          </Link>

          <Link href="/admin/payments" style={styles.actionCard}>
            <span style={styles.actionIcon}>💳</span>
            <span style={styles.actionTitle}>Payments</span>
            <span style={styles.actionDesc}>View transactions</span>
          </Link>

          <Link href="/admin/payments/test" style={styles.actionCard}>
            <span style={styles.actionIcon}>🧪</span>
            <span style={styles.actionTitle}>Payment Test</span>
            <span style={styles.actionDesc}>Test integrations</span>
          </Link>
        </div>
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f3f4f6',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  header: {
    backgroundColor: '#1f2937',
    padding: '16px 24px',
  },
  headerContent: {
    maxWidth: 1200,
    margin: '0 auto',
    display: 'flex',
    alignItems: 'center',
    gap: 24,
  },
  backLink: {
    color: '#9ca3af',
    textDecoration: 'none',
    fontSize: 14,
  },
  title: {
    margin: 0,
    fontSize: 24,
    fontWeight: 600,
    color: '#ffffff',
  },
  main: {
    maxWidth: 1200,
    margin: '0 auto',
    padding: 24,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 16,
    marginBottom: 32,
  },
  statCard: {
    display: 'flex',
    flexDirection: 'column',
    padding: 20,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  statValue: {
    fontSize: 28,
    fontWeight: 700,
    color: '#1f2937',
  },
  statLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: '#1f2937',
    marginBottom: 16,
  },
  actionsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 16,
  },
  actionCard: {
    display: 'flex',
    flexDirection: 'column',
    padding: 20,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    border: '1px solid #e5e7eb',
    textDecoration: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  },
  actionIcon: {
    fontSize: 32,
    marginBottom: 12,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: '#1f2937',
  },
  actionDesc: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
  },
};
