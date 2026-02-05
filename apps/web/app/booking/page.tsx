'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Dynamic import for canvas seat map
const CanvasSeatMap = dynamic(
  () => import('@repo/ui/seat-map').then((mod) => mod.CanvasSeatMap),
  { 
    ssr: false,
    loading: () => (
      <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>
        Loading Seat Map...
      </div>
    ),
  }
);

interface Session {
  id: string;
  name: string;
  startTime: string;
  status: string;
  venue: {
    id: string;
    name: string;
  };
}

interface Seat {
  id: string;
  row: string;
  number: string;
  x: number;
  y: number;
  status: string;
  tariff?: {
    id: string;
    name: string;
    price: number;
    color: string;
  };
}

export default function BookingPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [selectedSeats, setSelectedSeats] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Fetch active sessions
  useEffect(() => {
    async function fetchSessions() {
      try {
        const response = await fetch(`${API_URL}/api/sessions?status=ACTIVE`);
        if (response.ok) {
          const data = await response.json();
          setSessions(data.sessions || []);
        }
      } catch (error) {
        console.error('Failed to fetch sessions:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchSessions();
  }, []);

  // Fetch session seats when selected
  useEffect(() => {
    if (!selectedSession) return;

    async function fetchSeats() {
      try {
        setLoading(true);
        const response = await fetch(`${API_URL}/api/sessions/${selectedSession.id}`);
        if (response.ok) {
          const data = await response.json();
          setSeats(data.seats || []);
        }
      } catch (error) {
        console.error('Failed to fetch seats:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchSeats();
  }, [selectedSession]);

  const handleSeatClick = (seatId: string) => {
    const seat = seats.find((s) => s.id === seatId);
    if (!seat || seat.status !== 'AVAILABLE') return;

    setSelectedSeats((prev) => {
      const next = new Set(prev);
      if (next.has(seatId)) {
        next.delete(seatId);
      } else {
        next.add(seatId);
      }
      return next;
    });
  };

  const totalPrice = Array.from(selectedSeats).reduce((sum, seatId) => {
    const seat = seats.find((s) => s.id === seatId);
    return sum + (seat?.tariff?.price || 0);
  }, 0);

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <Link href="/" style={styles.backLink}>← Home</Link>
          <h1 style={styles.title}>Select Your Seats</h1>
        </div>
      </header>

      <main style={styles.main}>
        {/* Session Selection */}
        {!selectedSession ? (
          <div style={styles.sessionList}>
            <h2 style={styles.sectionTitle}>Available Events</h2>
            {loading ? (
              <p>Loading...</p>
            ) : sessions.length === 0 ? (
              <p style={styles.noSessions}>No active sessions available</p>
            ) : (
              <div style={styles.sessionGrid}>
                {sessions.map((session) => (
                  <button
                    key={session.id}
                    onClick={() => setSelectedSession(session)}
                    style={styles.sessionCard}
                  >
                    <h3 style={styles.sessionName}>{session.name}</h3>
                    <p style={styles.sessionVenue}>{session.venue.name}</p>
                    <p style={styles.sessionDate}>
                      {new Date(session.startTime).toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={styles.seatSelection}>
            {/* Back button */}
            <button
              onClick={() => {
                setSelectedSession(null);
                setSeats([]);
                setSelectedSeats(new Set());
              }}
              style={styles.backButton}
            >
              ← Choose Different Event
            </button>

            {/* Event Info */}
            <div style={styles.eventInfo}>
              <h2 style={styles.eventName}>{selectedSession.name}</h2>
              <p style={styles.eventVenue}>{selectedSession.venue.name}</p>
            </div>

            {/* Seat Map */}
            <div style={styles.seatMapContainer}>
              {loading ? (
                <div style={styles.loadingSeats}>Loading seats...</div>
              ) : (
                <div style={styles.seatMapWrapper}>
                  {/* Stage */}
                  <div style={styles.stage}>STAGE</div>
                  
                  {/* Simple seat grid */}
                  <div style={styles.seatGrid}>
                    {seats.map((seat) => (
                      <button
                        key={seat.id}
                        onClick={() => handleSeatClick(seat.id)}
                        disabled={seat.status !== 'AVAILABLE'}
                        style={{
                          ...styles.seat,
                          backgroundColor: selectedSeats.has(seat.id)
                            ? '#2563eb'
                            : seat.status === 'AVAILABLE'
                            ? seat.tariff?.color || '#22c55e'
                            : seat.status === 'RESERVED'
                            ? '#eab308'
                            : '#ef4444',
                          opacity: seat.status !== 'AVAILABLE' ? 0.5 : 1,
                          cursor: seat.status === 'AVAILABLE' ? 'pointer' : 'not-allowed',
                        }}
                        title={`${seat.row}${seat.number} - ${seat.tariff?.name || 'No tariff'} - ${seat.tariff?.price?.toLocaleString() || 0} UZS`}
                      >
                        {seat.row}{seat.number}
                      </button>
                    ))}
                  </div>

                  {/* Legend */}
                  <div style={styles.legend}>
                    <div style={styles.legendItem}>
                      <span style={{ ...styles.legendColor, backgroundColor: '#22c55e' }} />
                      Available
                    </div>
                    <div style={styles.legendItem}>
                      <span style={{ ...styles.legendColor, backgroundColor: '#2563eb' }} />
                      Selected
                    </div>
                    <div style={styles.legendItem}>
                      <span style={{ ...styles.legendColor, backgroundColor: '#eab308' }} />
                      Reserved
                    </div>
                    <div style={styles.legendItem}>
                      <span style={{ ...styles.legendColor, backgroundColor: '#ef4444' }} />
                      Occupied
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Booking Summary */}
            {selectedSeats.size > 0 && (
              <div style={styles.summary}>
                <div style={styles.summaryInfo}>
                  <span>{selectedSeats.size} seat(s) selected</span>
                  <span style={styles.totalPrice}>
                    Total: {totalPrice.toLocaleString()} UZS
                  </span>
                </div>
                <button style={styles.bookButton}>
                  Proceed to Payment
                </button>
              </div>
            )}
          </div>
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
  sessionList: {},
  sectionTitle: {
    fontSize: 20,
    fontWeight: 600,
    marginBottom: 16,
  },
  noSessions: {
    color: '#6b7280',
    textAlign: 'center',
    padding: 40,
  },
  sessionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: 16,
  },
  sessionCard: {
    padding: 20,
    backgroundColor: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'border-color 0.2s',
  },
  sessionName: {
    margin: '0 0 8px',
    fontSize: 18,
    fontWeight: 600,
  },
  sessionVenue: {
    margin: '0 0 4px',
    fontSize: 14,
    color: '#6b7280',
  },
  sessionDate: {
    margin: 0,
    fontSize: 13,
    color: '#9ca3af',
  },
  seatSelection: {},
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
  eventInfo: {
    marginBottom: 24,
  },
  eventName: {
    margin: '0 0 4px',
    fontSize: 24,
    fontWeight: 600,
  },
  eventVenue: {
    margin: 0,
    fontSize: 16,
    color: '#6b7280',
  },
  seatMapContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 24,
    marginBottom: 24,
  },
  loadingSeats: {
    textAlign: 'center',
    padding: 40,
    color: '#6b7280',
  },
  seatMapWrapper: {},
  stage: {
    padding: '12px 0',
    marginBottom: 24,
    backgroundColor: '#1f2937',
    color: '#ffffff',
    textAlign: 'center',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    letterSpacing: 2,
  },
  seatGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
    justifyContent: 'center',
    marginBottom: 24,
  },
  seat: {
    width: 36,
    height: 36,
    fontSize: 10,
    fontWeight: 600,
    color: '#ffffff',
    border: 'none',
    borderRadius: 4,
    transition: 'transform 0.1s',
  },
  legend: {
    display: 'flex',
    justifyContent: 'center',
    gap: 24,
    paddingTop: 16,
    borderTop: '1px solid #e5e7eb',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    color: '#4b5563',
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 4,
  },
  summary: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    boxShadow: '0 -4px 12px rgba(0,0,0,0.1)',
  },
  summaryInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  totalPrice: {
    fontSize: 20,
    fontWeight: 700,
    color: '#1f2937',
  },
  bookButton: {
    padding: '14px 32px',
    fontSize: 16,
    fontWeight: 600,
    color: '#ffffff',
    backgroundColor: '#2563eb',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
  },
};
