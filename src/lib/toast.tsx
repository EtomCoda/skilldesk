/**
 * toast.tsx — SkillDesk popup card notification system
 *
 * Usage:
 *   1. Wrap your app with <ToastProvider> (done in App.tsx)
 *   2. Drop <Toaster /> once inside the provider (done in App.tsx)
 *   3. In any component: const { toast } = useToast();
 *      toast.success('Done!');
 *      toast.error('Something went wrong');
 *      toast.info('FYI…');
 *      toast.warning('Watch out!');
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  ReactNode,
} from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number; // ms, default 4500
}

interface ToastContextValue {
  toast: {
    success: (message: string, title?: string) => void;
    error:   (message: string, title?: string) => void;
    warning: (message: string, title?: string) => void;
    info:    (message: string, title?: string) => void;
  };
  dismiss: (id: string) => void;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const add = useCallback(
    (type: ToastType, message: string, title?: string, duration = 4500) => {
      const id = `${Date.now()}-${Math.random()}`;
      setToasts((prev) => [...prev, { id, type, title, message, duration }]);
    },
    []
  );

  const toast = {
    success: (msg: string, title?: string) => add('success', msg, title),
    error:   (msg: string, title?: string) => add('error',   msg, title, 6000),
    warning: (msg: string, title?: string) => add('warning', msg, title),
    info:    (msg: string, title?: string) => add('info',    msg, title),
  };

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <Toaster toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}

// ─── Toaster (renders the stack) ─────────────────────────────────────────────

function Toaster({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: string) => void }) {
  return (
    <div
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        maxWidth: '380px',
        width: '100%',
        pointerEvents: 'none',
      }}
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} dismiss={dismiss} />
      ))}
    </div>
  );
}

// ─── Individual Card ─────────────────────────────────────────────────────────

const CONFIGS: Record<
  ToastType,
  { icon: ReactNode; accent: string; bg: string; bar: string; defaultTitle: string }
> = {
  success: {
    icon: <CheckCircle style={{ width: 20, height: 20, color: '#16a34a', flexShrink: 0 }} />,
    accent: '#16a34a',
    bg: '#f0fdf4',
    bar: '#16a34a',
    defaultTitle: 'Success',
  },
  error: {
    icon: <XCircle style={{ width: 20, height: 20, color: '#dc2626', flexShrink: 0 }} />,
    accent: '#dc2626',
    bg: '#fef2f2',
    bar: '#dc2626',
    defaultTitle: 'Error',
  },
  warning: {
    icon: <AlertTriangle style={{ width: 20, height: 20, color: '#d97706', flexShrink: 0 }} />,
    accent: '#d97706',
    bg: '#fffbeb',
    bar: '#d97706',
    defaultTitle: 'Warning',
  },
  info: {
    icon: <Info style={{ width: 20, height: 20, color: '#2563eb', flexShrink: 0 }} />,
    accent: '#2563eb',
    bg: '#eff6ff',
    bar: '#2563eb',
    defaultTitle: 'Notice',
  },
};

function ToastCard({ toast: t, dismiss }: { toast: Toast; dismiss: (id: string) => void }) {
  const cfg = CONFIGS[t.type];
  const duration = t.duration ?? 4500;
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(100);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const pausedRef = useRef(false);
  const elapsed = useRef(0);

  // Slide-in on mount
  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  // Auto-dismiss countdown
  useEffect(() => {
    const tick = (timestamp: number) => {
      if (pausedRef.current) {
        startRef.current = null; // reset on resume
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      if (startRef.current === null) startRef.current = timestamp;
      const delta = timestamp - startRef.current;
      elapsed.current += delta;
      startRef.current = timestamp;
      const pct = Math.max(0, 100 - (elapsed.current / duration) * 100);
      setProgress(pct);
      if (elapsed.current >= duration) {
        handleDismiss();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [duration]);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(() => dismiss(t.id), 300);
  };

  return (
    <div
      onMouseEnter={() => { pausedRef.current = true; }}
      onMouseLeave={() => { pausedRef.current = false; startRef.current = null; }}
      style={{
        pointerEvents: 'all',
        background: '#ffffff',
        borderRadius: '14px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.08)',
        overflow: 'hidden',
        transform: visible ? 'translateX(0) scale(1)' : 'translateX(120%) scale(0.95)',
        opacity: visible ? 1 : 0,
        transition: 'transform 0.32s cubic-bezier(0.34,1.56,0.64,1), opacity 0.28s ease',
        borderLeft: `4px solid ${cfg.accent}`,
        willChange: 'transform, opacity',
      }}
    >
      {/* Body */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px 10px' }}>
        {cfg.icon}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#111827', lineHeight: 1.4 }}>
            {t.title || cfg.defaultTitle}
          </p>
          <p style={{ margin: '3px 0 0', fontSize: 13, color: '#4b5563', lineHeight: 1.5, wordBreak: 'break-word' }}>
            {t.message}
          </p>
        </div>
        <button
          onClick={handleDismiss}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 2,
            borderRadius: 6,
            color: '#9ca3af',
            lineHeight: 1,
            flexShrink: 0,
          }}
          aria-label="Dismiss notification"
        >
          <X style={{ width: 15, height: 15 }} />
        </button>
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, background: '#f3f4f6' }}>
        <div
          style={{
            height: '100%',
            width: `${progress}%`,
            background: cfg.bar,
            transition: 'width 0.1s linear',
            borderRadius: '0 2px 2px 0',
          }}
        />
      </div>
    </div>
  );
}
