'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SessionList } from '../../components/sessions/SessionList';

export default function SessionsPage() {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <Link href="/admin" style={styles.backLink}>← Back to Admin</Link>
          <h1 style={styles.title}>Sessions Management</h1>
        </div>
      </header>

      <main style={styles.main}>
        {selectedSessionId ? (
          <div>
            <button 
              onClick={() => setSelectedSessionId(null)}
              style={styles.backButton}
            >
              ← Back to List
            </button>
            <Link 
              href={`/admin/sessions/${selectedSessionId}`}
              style={styles.viewLink}
            >
              View Full Session Details →
            </Link>
          </div>
        ) : (
          <SessionList
            onSessionSelect={(id) => setSelectedSessionId(id)}
            onCreateSession={() => {
              window.location.href = '/admin/sessions/new';
            }}
          />
        )}
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
    maxWidth: 1200,
    margin: '0 auto',
    padding: 24,
  },
  backButton: {
    padding: '8px 16px',
    marginBottom: 16,
    fontSize: 14,
    color: '#374151',
    backgroundColor: '#ffffff',
    border: '1px solid #d1d5db',
    borderRadius: 8,
    cursor: 'pointer',
  },
  viewLink: {
    display: 'inline-block',
    marginLeft: 16,
    padding: '8px 16px',
    fontSize: 14,
    color: '#ffffff',
    backgroundColor: '#2563eb',
    borderRadius: 8,
    textDecoration: 'none',
  },
};
