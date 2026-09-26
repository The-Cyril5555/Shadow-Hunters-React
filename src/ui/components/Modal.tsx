import { useEffect, type ReactNode } from 'react';

export function Modal({ title, onClose, children, wide }: { title: ReactNode; onClose?: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="panel modal" style={wide ? { width: 'min(1100px, 100%)' } : undefined} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h2 className="gothic" style={{ fontSize: 28 }}>{title}</h2>
          {onClose && <button className="btn btn-small" onClick={onClose} aria-label="Fermer">✕</button>}
        </div>
        {children}
      </div>
    </div>
  );
}
