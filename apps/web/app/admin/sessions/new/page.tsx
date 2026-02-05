'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SessionForm } from '../../../components/sessions/SessionForm';
import type { CreateSessionInput } from '../../../components/sessions/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function NewSessionPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (data: CreateSessionInput) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Failed to create session');
      }

      const session = await response.json();
      router.push(`/admin/sessions/${session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    router.push('/admin/sessions');
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <Link href="/admin/sessions" style={styles.backLink}>
            ← Back to Sessions
          </Link>
          <h1 style={styles.title}>Create New Session</h1>
        </div>
      </header>

      <main style={styles.main}>
        {error && (
          <div style={styles.error}>
            {error}
          </div>
        )}

        <SessionForm
          session={null}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isLoading={isLoading}
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
  header: {
    backgroundColor: '#1f2937',
    padding: '16px 24px',
  },
  headerContent: {
    maxWidth: 800,
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
  main: {
    maxWidth: 800,
    margin: '0 auto',
    padding: '32px 24px',
  },
  error: {
    padding: 16,
    marginBottom: 24,
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: 8,
    color: '#dc2626',
  },
};
