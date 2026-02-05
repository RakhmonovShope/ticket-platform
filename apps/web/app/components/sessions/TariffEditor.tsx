'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { Session, Seat, Tariff, CreateTariffInput, AutoAssignInput } from './types';

// ============================================================================
// TYPES
// ============================================================================

interface TariffEditorProps {
  session: Session;
  onTariffCreate: (tariff: CreateTariffInput) => Promise<void>;
  onTariffUpdate: (tariffId: string, data: Partial<CreateTariffInput>) => Promise<void>;
  onTariffDelete: (tariffId: string) => Promise<void>;
  onSeatsAssign: (tariffId: string, seatIds: string[]) => Promise<void>;
  onAutoAssign: (input: AutoAssignInput) => Promise<void>;
  onRefresh: () => Promise<void>;
  isReadOnly?: boolean;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  seatId: string | null;
}

interface NewTariffForm {
  name: string;
  price: string;
  color: string;
  description: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_COLORS = [
  '#ef4444', // Red
  '#f97316', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#8b5cf6', // Violet
  '#ec4899', // Pink
];

const SEAT_SIZE = 28;
const SEAT_GAP = 4;

// ============================================================================
// COMPONENT
// ============================================================================

export function TariffEditor({
  session,
  onTariffCreate,
  onTariffUpdate,
  onTariffDelete,
  onSeatsAssign,
  onAutoAssign,
  onRefresh,
  isReadOnly = false,
}: TariffEditorProps) {
  const [selectedSeats, setSelectedSeats] = useState<Set<string>>(new Set());
  const [selectedTariff, setSelectedTariff] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    seatId: null,
  });
  const [showTariffForm, setShowTariffForm] = useState(false);
  const [newTariff, setNewTariff] = useState<NewTariffForm>({
    name: '',
    price: '',
    color: DEFAULT_COLORS[0],
    description: '',
  });
  const [isAssigning, setIsAssigning] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [selectionBox, setSelectionBox] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Close context menu on outside click
  useEffect(() => {
    function handleClick() {
      setContextMenu((prev) => ({ ...prev, visible: false }));
    }
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // Get seat by ID
  const getSeat = useCallback(
    (seatId: string) => session.seats.find((s) => s.id === seatId),
    [session.seats]
  );

  // Handle seat click
  const handleSeatClick = useCallback(
    (seatId: string, e: React.MouseEvent) => {
      if (isReadOnly) return;
      e.stopPropagation();

      if (e.shiftKey) {
        // Add/remove from selection
        setSelectedSeats((prev) => {
          const next = new Set(prev);
          if (next.has(seatId)) {
            next.delete(seatId);
          } else {
            next.add(seatId);
          }
          return next;
        });
      } else if (e.ctrlKey || e.metaKey) {
        // Toggle selection
        setSelectedSeats((prev) => {
          const next = new Set(prev);
          if (next.has(seatId)) {
            next.delete(seatId);
          } else {
            next.add(seatId);
          }
          return next;
        });
      } else {
        // Single selection
        setSelectedSeats(new Set([seatId]));
      }
    },
    [isReadOnly]
  );

  // Handle seat right-click
  const handleSeatContextMenu = useCallback(
    (seatId: string, e: React.MouseEvent) => {
      if (isReadOnly) return;
      e.preventDefault();
      e.stopPropagation();

      setContextMenu({
        visible: true,
        x: e.clientX,
        y: e.clientY,
        seatId,
      });
    },
    [isReadOnly]
  );

  // Handle drag selection start
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (isReadOnly || e.button !== 0) return;

      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      setDragStart({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    },
    [isReadOnly]
  );

  // Handle drag selection
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragStart) return;

      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;

      setSelectionBox({
        x: Math.min(dragStart.x, currentX),
        y: Math.min(dragStart.y, currentY),
        width: Math.abs(currentX - dragStart.x),
        height: Math.abs(currentY - dragStart.y),
      });
    },
    [dragStart]
  );

  // Handle drag selection end
  const handleMouseUp = useCallback(() => {
    if (selectionBox) {
      // Find seats within selection box
      const selectedInBox = new Set<string>();
      session.seats.forEach((seat) => {
        const seatX = seat.x * (SEAT_SIZE + SEAT_GAP);
        const seatY = seat.y * (SEAT_SIZE + SEAT_GAP);

        if (
          seatX >= selectionBox.x &&
          seatX <= selectionBox.x + selectionBox.width &&
          seatY >= selectionBox.y &&
          seatY <= selectionBox.y + selectionBox.height
        ) {
          selectedInBox.add(seat.id);
        }
      });

      setSelectedSeats(selectedInBox);
    }

    setDragStart(null);
    setSelectionBox(null);
  }, [selectionBox, session.seats]);

  // Assign selected seats to tariff
  const assignSeatsToTariff = useCallback(
    async (tariffId: string) => {
      if (selectedSeats.size === 0) return;

      setIsAssigning(true);
      try {
        await onSeatsAssign(tariffId, Array.from(selectedSeats));
        setSelectedSeats(new Set());
        await onRefresh();
      } catch (error) {
        console.error('Failed to assign seats:', error);
      } finally {
        setIsAssigning(false);
      }
    },
    [selectedSeats, onSeatsAssign, onRefresh]
  );

  // Create new tariff
  const handleCreateTariff = async () => {
    if (!newTariff.name || !newTariff.price) return;

    try {
      await onTariffCreate({
        name: newTariff.name,
        price: parseFloat(newTariff.price),
        color: newTariff.color,
        description: newTariff.description || undefined,
      });
      setNewTariff({
        name: '',
        price: '',
        color: DEFAULT_COLORS[(session.tariffs.length + 1) % DEFAULT_COLORS.length],
        description: '',
      });
      setShowTariffForm(false);
      await onRefresh();
    } catch (error) {
      console.error('Failed to create tariff:', error);
    }
  };

  // Delete tariff
  const handleDeleteTariff = async (tariffId: string) => {
    if (!confirm('Are you sure you want to delete this tariff?')) return;

    try {
      await onTariffDelete(tariffId);
      if (selectedTariff === tariffId) {
        setSelectedTariff(null);
      }
      await onRefresh();
    } catch (error) {
      console.error('Failed to delete tariff:', error);
    }
  };

  // Auto assign seats
  const handleAutoAssign = async (strategy: AutoAssignInput['strategy']) => {
    if (session.tariffs.length < 2) {
      alert('You need at least 2 tariffs to use auto-assign');
      return;
    }

    try {
      await onAutoAssign({
        tariffIds: session.tariffs.map((t) => t.id),
        strategy,
      });
      await onRefresh();
    } catch (error) {
      console.error('Failed to auto-assign:', error);
    }
  };

  // Calculate seat map dimensions
  const seatMapDimensions = session.seats.reduce(
    (acc, seat) => ({
      maxX: Math.max(acc.maxX, seat.x),
      maxY: Math.max(acc.maxY, seat.y),
    }),
    { maxX: 0, maxY: 0 }
  );

  const mapWidth = (seatMapDimensions.maxX + 1) * (SEAT_SIZE + SEAT_GAP) + 40;
  const mapHeight = (seatMapDimensions.maxY + 1) * (SEAT_SIZE + SEAT_GAP) + 40;

  // Count seats by tariff
  const seatCountByTariff = session.seats.reduce(
    (acc, seat) => {
      const key = seat.tariffId || 'unassigned';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const isDraft = session.status === 'DRAFT';
  const canEdit = !isReadOnly && isDraft;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h2 style={styles.title}>Tariff Editor</h2>
        {!isDraft && (
          <span style={styles.readOnlyBadge}>Read Only - Session is {session.status}</span>
        )}
      </div>

      <div style={styles.layout}>
        {/* Sidebar - Tariff List */}
        <div style={styles.sidebar}>
          <div style={styles.sidebarHeader}>
            <h3 style={styles.sidebarTitle}>Tariffs</h3>
            {canEdit && (
              <button onClick={() => setShowTariffForm(true)} style={styles.addButton}>
                + Add Tariff
              </button>
            )}
          </div>

          {/* New Tariff Form */}
          {showTariffForm && (
            <div style={styles.tariffForm}>
              <input
                type="text"
                placeholder="Tariff Name"
                value={newTariff.name}
                onChange={(e) => setNewTariff({ ...newTariff, name: e.target.value })}
                style={styles.formInput}
              />
              <input
                type="number"
                placeholder="Price"
                value={newTariff.price}
                onChange={(e) => setNewTariff({ ...newTariff, price: e.target.value })}
                style={styles.formInput}
                min="0"
                step="0.01"
              />
              <div style={styles.colorPicker}>
                {DEFAULT_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewTariff({ ...newTariff, color })}
                    style={{
                      ...styles.colorOption,
                      backgroundColor: color,
                      border: newTariff.color === color ? '3px solid #1a1a1a' : '2px solid #e5e7eb',
                    }}
                  />
                ))}
              </div>
              <div style={styles.formActions}>
                <button onClick={() => setShowTariffForm(false)} style={styles.cancelFormButton}>
                  Cancel
                </button>
                <button onClick={handleCreateTariff} style={styles.saveFormButton}>
                  Save
                </button>
              </div>
            </div>
          )}

          {/* Tariff List */}
          <div style={styles.tariffList}>
            {session.tariffs.map((tariff) => (
              <div
                key={tariff.id}
                onClick={() => setSelectedTariff(tariff.id)}
                style={{
                  ...styles.tariffItem,
                  borderLeft: `4px solid ${tariff.color}`,
                  backgroundColor: selectedTariff === tariff.id ? '#f0f9ff' : '#ffffff',
                }}
              >
                <div style={styles.tariffInfo}>
                  <span style={styles.tariffName}>{tariff.name}</span>
                  <span style={styles.tariffPrice}>${tariff.price.toFixed(2)}</span>
                </div>
                <div style={styles.tariffMeta}>
                  <span style={styles.seatCount}>{seatCountByTariff[tariff.id] || 0} seats</span>
                  {canEdit && (
                    <div style={styles.tariffActions}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          assignSeatsToTariff(tariff.id);
                        }}
                        disabled={selectedSeats.size === 0 || isAssigning}
                        style={{
                          ...styles.assignButton,
                          opacity: selectedSeats.size === 0 ? 0.5 : 1,
                        }}
                        title="Assign selected seats"
                      >
                        Assign
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTariff(tariff.id);
                        }}
                        style={styles.deleteButton}
                        title="Delete tariff"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Unassigned seats */}
            {seatCountByTariff['unassigned'] > 0 && (
              <div
                style={{
                  ...styles.tariffItem,
                  borderLeft: '4px solid #d1d5db',
                  backgroundColor: '#f9fafb',
                }}
              >
                <div style={styles.tariffInfo}>
                  <span style={{ ...styles.tariffName, color: '#6b7280' }}>Unassigned</span>
                </div>
                <div style={styles.tariffMeta}>
                  <span style={{ ...styles.seatCount, color: '#dc2626' }}>
                    {seatCountByTariff['unassigned']} seats
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Auto-assign options */}
          {canEdit && session.tariffs.length >= 2 && (
            <div style={styles.autoAssign}>
              <h4 style={styles.autoAssignTitle}>Auto-Assign</h4>
              <button
                onClick={() => handleAutoAssign('equal_sections')}
                style={styles.autoAssignButton}
              >
                Equal Sections
              </button>
              <button onClick={() => handleAutoAssign('by_row')} style={styles.autoAssignButton}>
                By Row
              </button>
              <button
                onClick={() => handleAutoAssign('by_distance_from_stage')}
                style={styles.autoAssignButton}
              >
                By Distance
              </button>
            </div>
          )}

          {/* Legend */}
          <div style={styles.legend}>
            <h4 style={styles.legendTitle}>Legend</h4>
            <div style={styles.legendItems}>
              <div style={styles.legendItem}>
                <div style={{ ...styles.legendSeat, backgroundColor: '#d1d5db' }} />
                <span>Unassigned</span>
              </div>
              <div style={styles.legendItem}>
                <div style={{ ...styles.legendSeat, backgroundColor: '#22c55e' }} />
                <span>Available</span>
              </div>
              <div style={styles.legendItem}>
                <div style={{ ...styles.legendSeat, backgroundColor: '#eab308' }} />
                <span>Reserved</span>
              </div>
              <div style={styles.legendItem}>
                <div style={{ ...styles.legendSeat, backgroundColor: '#ef4444' }} />
                <span>Occupied</span>
              </div>
              <div style={styles.legendItem}>
                <div
                  style={{
                    ...styles.legendSeat,
                    backgroundColor: '#9ca3af',
                    opacity: 0.5,
                  }}
                />
                <span>Disabled</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main - Seat Map */}
        <div style={styles.main}>
          {/* Selection info */}
          <div style={styles.selectionInfo}>
            {selectedSeats.size > 0 ? (
              <span>
                {selectedSeats.size} seat{selectedSeats.size !== 1 ? 's' : ''} selected
              </span>
            ) : (
              <span style={{ color: '#9ca3af' }}>
                {canEdit
                  ? 'Click seats to select, Shift+Click to multi-select, or drag to box-select'
                  : 'Viewing seat layout'}
              </span>
            )}
            {selectedSeats.size > 0 && canEdit && (
              <button onClick={() => setSelectedSeats(new Set())} style={styles.clearButton}>
                Clear Selection
              </button>
            )}
          </div>

          {/* Stage indicator */}
          <div style={styles.stage}>STAGE</div>

          {/* Seat Map */}
          <div
            ref={containerRef}
            style={{
              ...styles.seatMap,
              width: mapWidth,
              height: mapHeight,
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {session.seats.map((seat) => {
              const isSelected = selectedSeats.has(seat.id);
              const tariff = session.tariffs.find((t) => t.id === seat.tariffId);
              const bgColor = getSeatColor(seat, tariff);

              return (
                <div
                  key={seat.id}
                  onClick={(e) => handleSeatClick(seat.id, e)}
                  onContextMenu={(e) => handleSeatContextMenu(seat.id, e)}
                  style={{
                    ...styles.seat,
                    left: seat.x * (SEAT_SIZE + SEAT_GAP) + 20,
                    top: seat.y * (SEAT_SIZE + SEAT_GAP) + 20,
                    backgroundColor: bgColor,
                    opacity: seat.status === 'DISABLED' ? 0.5 : 1,
                    boxShadow: isSelected ? '0 0 0 3px #2563eb' : 'none',
                    cursor: canEdit ? 'pointer' : 'default',
                  }}
                  title={`${seat.row}${seat.number}${tariff ? ` - ${tariff.name}` : ' - Unassigned'}`}
                >
                  <span style={styles.seatLabel}>
                    {seat.row}
                    {seat.number}
                  </span>
                </div>
              );
            })}

            {/* Selection box */}
            {selectionBox && (
              <div
                style={{
                  ...styles.selectionBox,
                  left: selectionBox.x,
                  top: selectionBox.y,
                  width: selectionBox.width,
                  height: selectionBox.height,
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu.visible && (
        <div
          style={{
            ...styles.contextMenu,
            left: contextMenu.x,
            top: contextMenu.y,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={styles.contextMenuTitle}>
            Seat {getSeat(contextMenu.seatId!)?.row}
            {getSeat(contextMenu.seatId!)?.number}
          </div>
          {session.tariffs.map((tariff) => (
            <button
              key={tariff.id}
              onClick={() => {
                if (contextMenu.seatId) {
                  onSeatsAssign(tariff.id, [contextMenu.seatId]).then(onRefresh);
                }
                setContextMenu({ ...contextMenu, visible: false });
              }}
              style={styles.contextMenuItem}
            >
              <div
                style={{ ...styles.contextMenuColor, backgroundColor: tariff.color }}
              />
              {tariff.name} (${tariff.price})
            </button>
          ))}
          <div style={styles.contextMenuDivider} />
          <button
            onClick={() => {
              // Would call onSeatUpdate to disable seat
              setContextMenu({ ...contextMenu, visible: false });
            }}
            style={styles.contextMenuItem}
          >
            Disable Seat
          </button>
          <button
            onClick={() => {
              // Would call onSeatUpdate to hide seat
              setContextMenu({ ...contextMenu, visible: false });
            }}
            style={styles.contextMenuItem}
          >
            Hide Seat
          </button>
        </div>
      )}

      {/* Stats */}
      <div style={styles.stats}>
        <div style={styles.statItem}>
          <span style={styles.statValue}>{session.stats.totalSeats}</span>
          <span style={styles.statLabel}>Total Seats</span>
        </div>
        <div style={styles.statItem}>
          <span style={styles.statValue}>{session.stats.seatsWithTariff}</span>
          <span style={styles.statLabel}>With Tariff</span>
        </div>
        <div style={styles.statItem}>
          <span style={{ ...styles.statValue, color: '#dc2626' }}>
            {session.stats.seatsWithoutTariff}
          </span>
          <span style={styles.statLabel}>Without Tariff</span>
        </div>
        <div style={styles.statItem}>
          <span style={{ ...styles.statValue, color: '#22c55e' }}>
            ${session.stats.revenue.potential.toFixed(2)}
          </span>
          <span style={styles.statLabel}>Potential Revenue</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// HELPERS
// ============================================================================

function getSeatColor(seat: Seat, tariff?: Tariff): string {
  if (seat.status === 'DISABLED') return '#9ca3af';
  if (seat.status === 'HIDDEN') return 'transparent';
  if (seat.status === 'OCCUPIED') return '#ef4444';
  if (seat.status === 'RESERVED') return '#eab308';
  if (tariff) return tariff.color;
  return '#d1d5db'; // Unassigned
}

// ============================================================================
// STYLES
// ============================================================================

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    padding: 20,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    margin: 0,
    fontSize: 20,
    fontWeight: 600,
  },
  readOnlyBadge: {
    padding: '4px 12px',
    backgroundColor: '#fef3c7',
    color: '#92400e',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 500,
  },
  layout: {
    display: 'flex',
    gap: 20,
    minHeight: 500,
  },
  sidebar: {
    width: 280,
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  sidebarHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sidebarTitle: {
    margin: 0,
    fontSize: 14,
    fontWeight: 600,
    color: '#374151',
  },
  addButton: {
    padding: '4px 10px',
    fontSize: 12,
    fontWeight: 500,
    color: '#2563eb',
    backgroundColor: '#eff6ff',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
  },
  tariffForm: {
    padding: 12,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    border: '1px solid #e5e7eb',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  formInput: {
    padding: '8px 10px',
    fontSize: 13,
    border: '1px solid #d1d5db',
    borderRadius: 6,
    outline: 'none',
  },
  colorPicker: {
    display: 'flex',
    gap: 4,
    flexWrap: 'wrap',
  },
  colorOption: {
    width: 24,
    height: 24,
    borderRadius: 4,
    cursor: 'pointer',
  },
  formActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  cancelFormButton: {
    padding: '6px 12px',
    fontSize: 12,
    color: '#6b7280',
    backgroundColor: '#ffffff',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    cursor: 'pointer',
  },
  saveFormButton: {
    padding: '6px 12px',
    fontSize: 12,
    color: '#ffffff',
    backgroundColor: '#2563eb',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
  },
  tariffList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  tariffItem: {
    padding: 12,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  tariffInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tariffName: {
    fontSize: 14,
    fontWeight: 500,
  },
  tariffPrice: {
    fontSize: 14,
    fontWeight: 600,
    color: '#059669',
  },
  tariffMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  seatCount: {
    fontSize: 12,
    color: '#6b7280',
  },
  tariffActions: {
    display: 'flex',
    gap: 4,
  },
  assignButton: {
    padding: '4px 8px',
    fontSize: 11,
    color: '#2563eb',
    backgroundColor: '#eff6ff',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
  },
  deleteButton: {
    width: 20,
    height: 20,
    fontSize: 14,
    color: '#ef4444',
    backgroundColor: '#fef2f2',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  autoAssign: {
    padding: 12,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    border: '1px solid #e5e7eb',
  },
  autoAssignTitle: {
    margin: '0 0 8px 0',
    fontSize: 12,
    fontWeight: 600,
    color: '#374151',
  },
  autoAssignButton: {
    width: '100%',
    padding: '6px 10px',
    marginBottom: 6,
    fontSize: 12,
    color: '#374151',
    backgroundColor: '#f3f4f6',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    textAlign: 'left',
  },
  legend: {
    padding: 12,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    border: '1px solid #e5e7eb',
  },
  legendTitle: {
    margin: '0 0 8px 0',
    fontSize: 12,
    fontWeight: 600,
    color: '#374151',
  },
  legendItems: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 12,
    color: '#4b5563',
  },
  legendSeat: {
    width: 16,
    height: 16,
    borderRadius: 4,
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    minWidth: 0,
  },
  selectionInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    fontSize: 13,
  },
  clearButton: {
    padding: '4px 10px',
    fontSize: 12,
    color: '#6b7280',
    backgroundColor: '#f3f4f6',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
  },
  stage: {
    padding: '8px 0',
    backgroundColor: '#1f2937',
    color: '#ffffff',
    textAlign: 'center',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: 2,
  },
  seatMap: {
    position: 'relative',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    border: '1px solid #e5e7eb',
    overflow: 'auto',
    userSelect: 'none',
  },
  seat: {
    position: 'absolute',
    width: SEAT_SIZE,
    height: SEAT_SIZE,
    borderRadius: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'box-shadow 0.1s',
  },
  seatLabel: {
    fontSize: 8,
    fontWeight: 600,
    color: '#ffffff',
    textShadow: '0 1px 2px rgba(0,0,0,0.3)',
  },
  selectionBox: {
    position: 'absolute',
    border: '2px dashed #2563eb',
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    pointerEvents: 'none',
  },
  contextMenu: {
    position: 'fixed',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    border: '1px solid #e5e7eb',
    padding: 4,
    minWidth: 160,
    zIndex: 1000,
  },
  contextMenuTitle: {
    padding: '6px 10px',
    fontSize: 12,
    fontWeight: 600,
    color: '#374151',
    borderBottom: '1px solid #e5e7eb',
    marginBottom: 4,
  },
  contextMenuItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '6px 10px',
    fontSize: 12,
    color: '#374151',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    textAlign: 'left',
  },
  contextMenuColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  contextMenuDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    margin: '4px 0',
  },
  stats: {
    display: 'flex',
    gap: 24,
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    border: '1px solid #e5e7eb',
  },
  statItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 600,
    color: '#1f2937',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
};

export default TariffEditor;
