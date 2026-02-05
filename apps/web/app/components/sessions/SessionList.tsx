'use client';

import { useState, useEffect, useCallback } from 'react';
import type { SessionListItem, SessionQuery, SessionStatus, Venue } from './types';

// ============================================================================
// TYPES
// ============================================================================

interface SessionListProps {
  onSessionSelect: (sessionId: string) => void;
  onCreateSession: () => void;
}

interface PaginatedResponse {
  sessions: SessionListItem[];
  total: number;
  page: number;
  totalPages: number;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function fetchSessions(query: SessionQuery): Promise<PaginatedResponse> {
  const params = new URLSearchParams();

  if (query.status) params.append('status', query.status);
  if (query.venueId) params.append('venueId', query.venueId);
  if (query.search) params.append('search', query.search);
  if (query.startDate) params.append('startDate', query.startDate);
  if (query.endDate) params.append('endDate', query.endDate);
  if (query.page) params.append('page', String(query.page));
  if (query.limit) params.append('limit', String(query.limit));
  if (query.sortBy) params.append('sortBy', query.sortBy);
  if (query.sortOrder) params.append('sortOrder', query.sortOrder);

  const response = await fetch(`${API_URL}/api/sessions?${params}`);
  if (!response.ok) throw new Error('Failed to fetch sessions');
  return response.json();
}

async function fetchVenues(): Promise<Venue[]> {
  const response = await fetch(`${API_URL}/api/venues`);
  if (!response.ok) throw new Error('Failed to fetch venues');
  const data = await response.json();
  return data.venues || data;
}

async function publishSession(sessionId: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/sessions/${sessionId}/publish`, {
    method: 'POST',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to publish session');
  }
}

async function cancelSession(sessionId: string, reason?: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/sessions/${sessionId}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to cancel session');
  }
}

async function duplicateSession(sessionId: string): Promise<void> {
  const now = new Date();
  const startTime = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // +1 week
  const endTime = new Date(startTime.getTime() + 3 * 60 * 60 * 1000); // +3 hours

  const response = await fetch(`${API_URL}/api/sessions/${sessionId}/duplicate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
    }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to duplicate session');
  }
}

async function deleteSession(sessionId: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/sessions/${sessionId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete session');
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

export function SessionList({ onSessionSelect, onCreateSession }: SessionListProps) {
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [filters, setFilters] = useState<SessionQuery>({
    status: undefined,
    venueId: undefined,
    search: '',
    page: 1,
    limit: 10,
    sortBy: 'startTime',
    sortOrder: 'desc',
  });

  // Load sessions
  const loadSessions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchSessions(filters);
      setSessions(data.sessions);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Load venues for filter
  useEffect(() => {
    fetchVenues()
      .then(setVenues)
      .catch((err) => console.error('Failed to load venues:', err));
  }, []);

  // Reload sessions when filters change
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Handle publish
  const handlePublish = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to publish this session?')) return;

    try {
      await publishSession(sessionId);
      loadSessions();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to publish');
    }
  };

  // Handle cancel
  const handleCancel = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const reason = prompt('Enter cancellation reason (optional):');
    if (reason === null) return; // User cancelled the prompt

    try {
      await cancelSession(sessionId, reason || undefined);
      loadSessions();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to cancel');
    }
  };

  // Handle duplicate
  const handleDuplicate = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Create a duplicate of this session?')) return;

    try {
      await duplicateSession(sessionId);
      loadSessions();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to duplicate');
    }
  };

  // Handle delete
  const handleDelete = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this session? This cannot be undone.')) return;

    try {
      await deleteSession(sessionId);
      loadSessions();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h2 style={styles.title}>Sessions</h2>
        <button onClick={onCreateSession} style={styles.createButton}>
          + New Session
        </button>
      </div>

      {/* Filters */}
      <div style={styles.filters}>
        <input
          type="text"
          placeholder="Search sessions..."
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
          style={styles.searchInput}
        />

        <select
          value={filters.status || ''}
          onChange={(e) =>
            setFilters({
              ...filters,
              status: (e.target.value as SessionStatus) || undefined,
              page: 1,
            })
          }
          style={styles.filterSelect}
        >
          <option value="">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="ACTIVE">Active</option>
          <option value="SOLD_OUT">Sold Out</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="COMPLETED">Completed</option>
        </select>

        <select
          value={filters.venueId || ''}
          onChange={(e) => setFilters({ ...filters, venueId: e.target.value || undefined, page: 1 })}
          style={styles.filterSelect}
        >
          <option value="">All Venues</option>
          {venues.map((venue) => (
            <option key={venue.id} value={venue.id}>
              {venue.name}
            </option>
          ))}
        </select>

        <select
          value={`${filters.sortBy}-${filters.sortOrder}`}
          onChange={(e) => {
            const [sortBy, sortOrder] = e.target.value.split('-') as [
              SessionQuery['sortBy'],
              SessionQuery['sortOrder'],
            ];
            setFilters({ ...filters, sortBy, sortOrder });
          }}
          style={styles.filterSelect}
        >
          <option value="startTime-desc">Start Time (Newest)</option>
          <option value="startTime-asc">Start Time (Oldest)</option>
          <option value="createdAt-desc">Created (Newest)</option>
          <option value="createdAt-asc">Created (Oldest)</option>
          <option value="name-asc">Name (A-Z)</option>
          <option value="name-desc">Name (Z-A)</option>
        </select>
      </div>

      {/* Error */}
      {error && <div style={styles.error}>{error}</div>}

      {/* Loading */}
      {loading && <div style={styles.loading}>Loading sessions...</div>}

      {/* Session List */}
      {!loading && sessions.length === 0 && (
        <div style={styles.empty}>
          <p>No sessions found</p>
          <p style={{ fontSize: 13, color: '#6b7280' }}>
            Create a new session to get started
          </p>
        </div>
      )}

      {!loading && sessions.length > 0 && (
        <div style={styles.list}>
          {sessions.map((session) => (
            <div
              key={session.id}
              onClick={() => onSessionSelect(session.id)}
              style={styles.sessionCard}
            >
              <div style={styles.sessionHeader}>
                <h3 style={styles.sessionName}>{session.name}</h3>
                <span style={{ ...styles.statusBadge, ...getStatusStyles(session.status) }}>
                  {session.status}
                </span>
              </div>

              <div style={styles.sessionMeta}>
                <span style={styles.metaItem}>
                  <VenueIcon />
                  {session.venue.name}
                </span>
                <span style={styles.metaItem}>
                  <CalendarIcon />
                  {formatDate(session.startTime)}
                </span>
                <span style={styles.metaItem}>
                  <ClockIcon />
                  {formatTime(session.startTime)} - {formatTime(session.endTime)}
                </span>
              </div>

              <div style={styles.sessionStats}>
                <span style={styles.statItem}>
                  {session._count.seats} seats
                </span>
                <span style={styles.statItem}>
                  {session._count.bookings} bookings
                </span>
              </div>

              <div style={styles.sessionActions}>
                {session.status === 'DRAFT' && (
                  <>
                    <button
                      onClick={(e) => handlePublish(session.id, e)}
                      style={styles.actionButton}
                    >
                      Publish
                    </button>
                    <button
                      onClick={(e) => handleDelete(session.id, e)}
                      style={{ ...styles.actionButton, color: '#dc2626' }}
                    >
                      Delete
                    </button>
                  </>
                )}
                {session.status === 'ACTIVE' && (
                  <button
                    onClick={(e) => handleCancel(session.id, e)}
                    style={{ ...styles.actionButton, color: '#dc2626' }}
                  >
                    Cancel
                  </button>
                )}
                <button
                  onClick={(e) => handleDuplicate(session.id, e)}
                  style={styles.actionButton}
                >
                  Duplicate
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={styles.pagination}>
          <button
            onClick={() => setFilters({ ...filters, page: (filters.page || 1) - 1 })}
            disabled={(filters.page || 1) <= 1}
            style={{
              ...styles.pageButton,
              opacity: (filters.page || 1) <= 1 ? 0.5 : 1,
            }}
          >
            Previous
          </button>

          <span style={styles.pageInfo}>
            Page {filters.page || 1} of {totalPages} ({total} total)
          </span>

          <button
            onClick={() => setFilters({ ...filters, page: (filters.page || 1) + 1 })}
            disabled={(filters.page || 1) >= totalPages}
            style={{
              ...styles.pageButton,
              opacity: (filters.page || 1) >= totalPages ? 0.5 : 1,
            }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// HELPERS
// ============================================================================

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatusStyles(status: SessionStatus): React.CSSProperties {
  switch (status) {
    case 'DRAFT':
      return { backgroundColor: '#f3f4f6', color: '#4b5563' };
    case 'ACTIVE':
      return { backgroundColor: '#dcfce7', color: '#166534' };
    case 'SOLD_OUT':
      return { backgroundColor: '#fef3c7', color: '#92400e' };
    case 'CANCELLED':
      return { backgroundColor: '#fee2e2', color: '#991b1b' };
    case 'COMPLETED':
      return { backgroundColor: '#e0e7ff', color: '#3730a3' };
    default:
      return {};
  }
}

// ============================================================================
// ICONS
// ============================================================================

function VenueIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      style={{ marginRight: 4 }}
    >
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      style={{ marginRight: 4 }}
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      style={{ marginRight: 4 }}
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: 24,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    margin: 0,
    fontSize: 24,
    fontWeight: 600,
    color: '#1a1a1a',
  },
  createButton: {
    padding: '10px 20px',
    fontSize: 14,
    fontWeight: 500,
    color: '#ffffff',
    backgroundColor: '#2563eb',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
  },
  filters: {
    display: 'flex',
    gap: 12,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  searchInput: {
    flex: 1,
    minWidth: 200,
    padding: '10px 12px',
    fontSize: 14,
    border: '1px solid #d1d5db',
    borderRadius: 8,
    outline: 'none',
  },
  filterSelect: {
    padding: '10px 12px',
    fontSize: 14,
    border: '1px solid #d1d5db',
    borderRadius: 8,
    backgroundColor: '#ffffff',
    cursor: 'pointer',
  },
  error: {
    padding: '12px 16px',
    marginBottom: 16,
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: 8,
    color: '#dc2626',
    fontSize: 14,
  },
  loading: {
    padding: 40,
    textAlign: 'center',
    color: '#6b7280',
  },
  empty: {
    padding: 40,
    textAlign: 'center',
    color: '#4b5563',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  sessionCard: {
    padding: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    border: '1px solid #e5e7eb',
    cursor: 'pointer',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  },
  sessionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sessionName: {
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
    color: '#1f2937',
  },
  statusBadge: {
    padding: '4px 10px',
    fontSize: 12,
    fontWeight: 500,
    borderRadius: 20,
  },
  sessionMeta: {
    display: 'flex',
    gap: 20,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  metaItem: {
    display: 'flex',
    alignItems: 'center',
    fontSize: 13,
    color: '#4b5563',
  },
  sessionStats: {
    display: 'flex',
    gap: 16,
    marginBottom: 12,
  },
  statItem: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: 500,
  },
  sessionActions: {
    display: 'flex',
    gap: 8,
    paddingTop: 12,
    borderTop: '1px solid #e5e7eb',
  },
  actionButton: {
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 500,
    color: '#2563eb',
    backgroundColor: '#eff6ff',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
  },
  pagination: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    marginTop: 20,
    paddingTop: 20,
    borderTop: '1px solid #e5e7eb',
  },
  pageButton: {
    padding: '8px 16px',
    fontSize: 13,
    fontWeight: 500,
    color: '#374151',
    backgroundColor: '#ffffff',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    cursor: 'pointer',
  },
  pageInfo: {
    fontSize: 13,
    color: '#6b7280',
  },
};

export default SessionList;
