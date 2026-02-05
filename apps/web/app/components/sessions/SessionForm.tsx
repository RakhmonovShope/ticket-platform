'use client';

import { useState, useEffect, FormEvent } from 'react';
import type { Venue, CreateSessionInput, Session } from './types';

// ============================================================================
// TYPES
// ============================================================================

interface SessionFormProps {
  session?: Session | null;
  onSubmit: (data: CreateSessionInput) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function fetchVenues(): Promise<Venue[]> {
  const response = await fetch(`${API_URL}/api/venues`);
  if (!response.ok) throw new Error('Failed to fetch venues');
  const data = await response.json();
  return data.venues || data;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function SessionForm({ session, onSubmit, onCancel, isLoading = false }: SessionFormProps) {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loadingVenues, setLoadingVenues] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<CreateSessionInput>({
    venueId: session?.venueId || '',
    name: session?.name || '',
    description: session?.description || '',
    startTime: session?.startTime ? formatDateTimeLocal(session.startTime) : '',
    endTime: session?.endTime ? formatDateTimeLocal(session.endTime) : '',
  });

  const isEditing = !!session;

  // Load venues on mount
  useEffect(() => {
    async function loadVenues() {
      try {
        setLoadingVenues(true);
        const venueList = await fetchVenues();
        setVenues(venueList);
      } catch (err) {
        setError('Failed to load venues');
        console.error(err);
      } finally {
        setLoadingVenues(false);
      }
    }
    loadVenues();
  }, []);

  // Handle form submission
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    // Validate times
    const start = new Date(formData.startTime);
    const end = new Date(formData.endTime);

    if (end <= start) {
      setError('End time must be after start time');
      return;
    }

    if (start < new Date()) {
      setError('Start time cannot be in the past');
      return;
    }

    try {
      await onSubmit({
        ...formData,
        startTime: new Date(formData.startTime).toISOString(),
        endTime: new Date(formData.endTime).toISOString(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save session');
    }
  }

  // Get selected venue info
  const selectedVenue = venues.find((v) => v.id === formData.venueId);

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <h2 style={styles.title}>{isEditing ? 'Edit Session' : 'Create New Session'}</h2>

      {error && <div style={styles.error}>{error}</div>}

      {/* Venue Selection */}
      <div style={styles.field}>
        <label htmlFor="venue" style={styles.label}>
          Venue *
        </label>
        {loadingVenues ? (
          <div style={styles.loading}>Loading venues...</div>
        ) : (
          <>
            <select
              id="venue"
              value={formData.venueId}
              onChange={(e) => setFormData({ ...formData, venueId: e.target.value })}
              style={styles.select}
              disabled={isEditing || isLoading}
              required
            >
              <option value="">Select a venue</option>
              {venues.map((venue) => (
                <option key={venue.id} value={venue.id}>
                  {venue.name} ({venue.capacity} seats)
                </option>
              ))}
            </select>
            {selectedVenue && (
              <div style={styles.venueInfo}>
                <p>
                  <strong>Address:</strong> {selectedVenue.address}
                </p>
                <p>
                  <strong>Capacity:</strong> {selectedVenue.capacity} seats
                </p>
                {selectedVenue.schema?.sections && (
                  <p>
                    <strong>Sections:</strong> {selectedVenue.schema.sections.length}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Session Name */}
      <div style={styles.field}>
        <label htmlFor="name" style={styles.label}>
          Session Name *
        </label>
        <input
          id="name"
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          style={styles.input}
          placeholder="e.g., Concert Night - February 2026"
          disabled={isLoading}
          required
          maxLength={200}
        />
      </div>

      {/* Description */}
      <div style={styles.field}>
        <label htmlFor="description" style={styles.label}>
          Description
        </label>
        <textarea
          id="description"
          value={formData.description || ''}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          style={styles.textarea}
          placeholder="Optional description for this session..."
          disabled={isLoading}
          rows={3}
        />
      </div>

      {/* Time Fields */}
      <div style={styles.row}>
        <div style={styles.fieldHalf}>
          <label htmlFor="startTime" style={styles.label}>
            Start Time *
          </label>
          <input
            id="startTime"
            type="datetime-local"
            value={formData.startTime}
            onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
            style={styles.input}
            disabled={isLoading}
            required
          />
        </div>

        <div style={styles.fieldHalf}>
          <label htmlFor="endTime" style={styles.label}>
            End Time *
          </label>
          <input
            id="endTime"
            type="datetime-local"
            value={formData.endTime}
            onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
            style={styles.input}
            disabled={isLoading}
            required
          />
        </div>
      </div>

      {/* Form Actions */}
      <div style={styles.actions}>
        <button type="button" onClick={onCancel} style={styles.cancelButton} disabled={isLoading}>
          Cancel
        </button>
        <button type="submit" style={styles.submitButton} disabled={isLoading || loadingVenues}>
          {isLoading ? 'Saving...' : isEditing ? 'Update Session' : 'Create Session'}
        </button>
      </div>
    </form>
  );
}

// ============================================================================
// HELPERS
// ============================================================================

function formatDateTimeLocal(isoString: string): string {
  const date = new Date(isoString);
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
}

// ============================================================================
// STYLES
// ============================================================================

const styles: Record<string, React.CSSProperties> = {
  form: {
    maxWidth: 600,
    margin: '0 auto',
    padding: 24,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
  },
  title: {
    margin: '0 0 24px 0',
    fontSize: 24,
    fontWeight: 600,
    color: '#1a1a1a',
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
  field: {
    marginBottom: 20,
  },
  fieldHalf: {
    flex: 1,
  },
  row: {
    display: 'flex',
    gap: 16,
    marginBottom: 20,
  },
  label: {
    display: 'block',
    marginBottom: 6,
    fontSize: 14,
    fontWeight: 500,
    color: '#374151',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    fontSize: 14,
    border: '1px solid #d1d5db',
    borderRadius: 8,
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  },
  select: {
    width: '100%',
    padding: '10px 12px',
    fontSize: 14,
    border: '1px solid #d1d5db',
    borderRadius: 8,
    outline: 'none',
    backgroundColor: '#ffffff',
    cursor: 'pointer',
  },
  textarea: {
    width: '100%',
    padding: '10px 12px',
    fontSize: 14,
    border: '1px solid #d1d5db',
    borderRadius: 8,
    outline: 'none',
    resize: 'vertical',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  },
  venueInfo: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    fontSize: 13,
    color: '#4b5563',
  },
  loading: {
    padding: '10px 12px',
    color: '#6b7280',
    fontStyle: 'italic',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 24,
    paddingTop: 20,
    borderTop: '1px solid #e5e7eb',
  },
  cancelButton: {
    padding: '10px 20px',
    fontSize: 14,
    fontWeight: 500,
    color: '#374151',
    backgroundColor: '#ffffff',
    border: '1px solid #d1d5db',
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  submitButton: {
    padding: '10px 20px',
    fontSize: 14,
    fontWeight: 500,
    color: '#ffffff',
    backgroundColor: '#2563eb',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
};

export default SessionForm;
