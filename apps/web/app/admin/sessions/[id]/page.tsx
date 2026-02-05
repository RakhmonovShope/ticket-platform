'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { TariffEditor } from '../../../components/sessions/TariffEditor';
import type { Session, CreateTariffInput, AutoAssignInput } from '../../../components/sessions/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function SessionDetailPage() {
  const params = useParams();
  const sessionId = params.id as string;

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch session data
  const fetchSession = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/sessions/${sessionId}`);
      if (!response.ok) throw new Error('Failed to fetch session');
      const data = await response.json();
      setSession(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sessionId) {
      fetchSession();
    }
  }, [sessionId]);

  // Tariff actions
  const handleTariffCreate = async (tariff: CreateTariffInput) => {
    const response = await fetch(`${API_URL}/api/sessions/${sessionId}/tariffs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tariff),
    });
    if (!response.ok) throw new Error('Failed to create tariff');
  };

  const handleTariffUpdate = async (tariffId: string, data: Partial<CreateTariffInput>) => {
    const response = await fetch(`${API_URL}/api/sessions/${sessionId}/tariffs/${tariffId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update tariff');
  };

  const handleTariffDelete = async (tariffId: string) => {
    const response = await fetch(`${API_URL}/api/sessions/${sessionId}/tariffs/${tariffId}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete tariff');
  };

  const handleSeatsAssign = async (tariffId: string, seatIds: string[]) => {
    const response = await fetch(`${API_URL}/api/sessions/${sessionId}/tariffs/${tariffId}/seats`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seatIds }),
    });
    if (!response.ok) throw new Error('Failed to assign seats');
  };

  const handleAutoAssign = async (input: AutoAssignInput) => {
    const response = await fetch(`${API_URL}/api/sessions/${sessionId}/tariffs/auto-assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw new Error('Failed to auto-assign');
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading session...</div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>
          <h2>Error</h2>
          <p>{error || 'Session not found'}</p>
          <Link href="/admin/sessions" style={styles.backLink}>
            ← Back to Sessions
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <Link href="/admin/sessions" style={styles.backLinkHeader}>
            ← Back to Sessions
          </Link>
          <div style={styles.headerInfo}>
            <h1 style={styles.title}>{session.name}</h1>
            <div style={styles.meta}>
              <span style={styles.statusBadge} data-status={session.status}>
                {session.status}
              </span>
              <span style={styles.venue}>{session.venue?.name}</span>
              <span style={styles.date}>
                {new Date(session.startTime).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Tariff Editor */}
      <main style={styles.main}>
        <TariffEditor
          session={session}
          onTariffCreate={handleTariffCreate}
          onTariffUpdate={handleTariffUpdate}
          onTariffDelete={handleTariffDelete}
          onSeatsAssign={handleSeatsAssign}
          onAutoAssign={handleAutoAssign}
          onRefresh={fetchSession}
          isReadOnly={session.status !== 'DRAFT'}
        />
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
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    fontSize: 18,
    color: '#6b7280',
  },
  error: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    textAlign: 'center',
    color: '#dc2626',
  },
  header: {
    backgroundColor: '#1f2937',
    padding: '16px 24px',
  },
  headerContent: {
    maxWidth: 1400,
    margin: '0 auto',
  },
  backLinkHeader: {
    color: '#9ca3af',
    textDecoration: 'none',
    fontSize: 13,
  },
  backLink: {
    display: 'inline-block',
    marginTop: 16,
    color: '#2563eb',
    textDecoration: 'none',
  },
  headerInfo: {
    marginTop: 8,
  },
  title: {
    margin: 0,
    fontSize: 24,
    fontWeight: 600,
    color: '#ffffff',
  },
  meta: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    marginTop: 8,
  },
  statusBadge: {
    padding: '4px 12px',
    fontSize: 12,
    fontWeight: 500,
    borderRadius: 20,
    backgroundColor: '#374151',
    color: '#9ca3af',
  },
  venue: {
    fontSize: 14,
    color: '#d1d5db',
  },
  date: {
    fontSize: 14,
    color: '#9ca3af',
  },
  main: {
    maxWidth: 1400,
    margin: '0 auto',
    padding: 24,
  },
};
