import React, { useRef, useEffect } from 'react';

export default function ActivityFeed({ activities }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activities]);

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>Activity</h3>
      <div style={styles.feed}>
        {activities.map((a, i) => (
          <div key={i} style={styles.entry}>
            <span style={styles.time}>
              {a.time.toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <span style={styles.msg}>{a.msg}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

const styles = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    padding: '16px',
  },
  title: {
    fontSize: '0.9rem',
    color: '#00d4aa',
    marginBottom: '12px',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  feed: {
    flex: 1,
    overflow: 'auto',
    fontSize: '0.75rem',
  },
  entry: {
    display: 'flex',
    gap: '8px',
    padding: '3px 0',
    borderBottom: '1px solid #0f1623',
  },
  time: {
    color: '#2d3748',
    flexShrink: 0,
  },
  msg: {
    color: '#5f6d7e',
  },
};
