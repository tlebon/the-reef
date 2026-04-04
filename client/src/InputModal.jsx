import React, { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Reusable modal that replaces browser prompt() calls.
 *
 * Props:
 *   title    - modal heading
 *   fields   - array of { key, label, placeholder?, defaultValue? }
 *   onConfirm(values) - called with { [key]: value } map
 *   onCancel()
 *   validate(key, value) - optional, returns sanitized value
 */
export default function InputModal({ title, fields, onConfirm, onCancel, sanitize }) {
  const [values, setValues] = useState(() => {
    const init = {};
    fields.forEach(f => { init[f.key] = f.defaultValue || ''; });
    return init;
  });

  const firstRef = useRef(null);

  useEffect(() => {
    if (firstRef.current) firstRef.current.focus();
  }, []);

  // Close on Escape — stable ref to avoid listener churn
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onCancelRef.current();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirm(values);
  };

  return (
    <div style={styles.overlay} onClick={onCancel}>
      <form style={styles.modal} onClick={e => e.stopPropagation()} onSubmit={handleSubmit} role="dialog" aria-modal="true" aria-label={title}>
        <h3 style={styles.title}>{title}</h3>

        {fields.map((f, i) => (
          <div key={f.key} style={styles.field}>
            <label style={styles.label}>{f.label}</label>
            <input
              ref={i === 0 ? firstRef : undefined}
              style={styles.input}
              placeholder={f.placeholder || ''}
              value={values[f.key]}
              onChange={e => {
                const val = sanitize ? sanitize(f.key, e.target.value) : e.target.value;
                setValues(prev => ({ ...prev, [f.key]: val }));
              }}
            />
          </div>
        ))}

        <div style={styles.buttons}>
          <button type="button" style={styles.cancelBtn} onClick={onCancel}>Cancel</button>
          <button type="submit" style={styles.confirmBtn}>Confirm</button>
        </div>
      </form>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
  },
  modal: {
    background: '#0d1220',
    border: '1px solid #00d4aa',
    borderRadius: '8px',
    padding: '24px 28px',
    maxWidth: '420px',
    width: '90%',
  },
  title: {
    color: '#00d4aa',
    fontSize: '1rem',
    margin: '0 0 16px 0',
  },
  field: {
    marginBottom: '12px',
  },
  label: {
    display: 'block',
    fontSize: '0.7rem',
    color: '#5f6d7e',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '4px',
  },
  input: {
    width: '100%',
    padding: '8px 10px',
    background: '#1a2035',
    border: '1px solid #2d3748',
    borderRadius: '4px',
    color: '#c8d6e5',
    fontFamily: 'inherit',
    fontSize: '0.85rem',
    outline: 'none',
    boxSizing: 'border-box',
  },
  buttons: {
    display: 'flex',
    gap: '8px',
    marginTop: '16px',
    justifyContent: 'flex-end',
  },
  cancelBtn: {
    padding: '8px 16px',
    background: '#1a2035',
    color: '#5f6d7e',
    border: '1px solid #2d3748',
    borderRadius: '4px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '0.8rem',
  },
  confirmBtn: {
    padding: '8px 20px',
    background: '#00d4aa',
    color: '#0a0e17',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 600,
    fontFamily: 'inherit',
    fontSize: '0.8rem',
  },
};
