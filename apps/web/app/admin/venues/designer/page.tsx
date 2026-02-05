'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';

// Import venue designer dynamically to avoid SSR issues with canvas
const VenueDesigner = dynamic(
  () => import('@repo/ui/venue-designer').then((mod) => mod.VenueDesigner),
  { 
    ssr: false,
    loading: () => (
      <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>
        Loading Venue Designer...
      </div>
    ),
  }
);

export default function VenueDesignerPage() {
  const handleSave = async (schema: unknown) => {
    console.log('Saving venue schema:', schema);
    // TODO: Save to API
    alert('Venue schema saved to console. Check developer tools.');
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <Link href="/admin" style={styles.backLink}>← Back to Admin</Link>
          <h1 style={styles.title}>Venue Designer</h1>
          <p style={styles.subtitle}>Create and edit venue seat layouts</p>
        </div>
      </header>

      {/* Designer */}
      <main style={styles.main}>
        <div style={styles.designerWrapper}>
          <VenueDesigner
            onSave={handleSave}
            initialSchema={undefined}
          />
        </div>
      </main>

      {/* Instructions */}
      <aside style={styles.instructions}>
        <h3 style={styles.instructionsTitle}>How to use</h3>
        <ul style={styles.instructionsList}>
          <li><strong>Add Section:</strong> Click "Add Section" in toolbar</li>
          <li><strong>Add Seats:</strong> Select section, then add seats</li>
          <li><strong>Move:</strong> Drag elements to reposition</li>
          <li><strong>Resize:</strong> Use handles to resize sections</li>
          <li><strong>Properties:</strong> Click element to edit in right panel</li>
          <li><strong>Save:</strong> Click "Save" to export schema</li>
        </ul>
      </aside>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#1f2937',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    display: 'flex',
    flexDirection: 'column',
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
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  },
  designerWrapper: {
    flex: 1,
    minHeight: 600,
  },
  instructions: {
    position: 'fixed',
    bottom: 16,
    right: 16,
    padding: 16,
    backgroundColor: 'rgba(31, 41, 55, 0.95)',
    borderRadius: 8,
    border: '1px solid #374151',
    maxWidth: 280,
    zIndex: 100,
  },
  instructionsTitle: {
    margin: '0 0 12px',
    fontSize: 14,
    fontWeight: 600,
    color: '#ffffff',
  },
  instructionsList: {
    margin: 0,
    paddingLeft: 20,
    fontSize: 12,
    color: '#d1d5db',
    lineHeight: 1.8,
  },
};
