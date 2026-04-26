import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// Events that count as user activity
const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click',
];

/**
 * Logs the user out after `timeoutMs` of inactivity.
 * Default: 30 minutes.
 *
 * @param timeoutMs  Idle threshold in milliseconds (default 30 min)
 * @param onTimeout  Optional callback fired just before sign-out
 *                   (e.g., show a toast). If not provided, signs out silently.
 */
export function useIdleTimeout(
  timeoutMs = 30 * 60 * 1000,
  onTimeout?: () => void,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const signOut = useCallback(async () => {
    onTimeout?.();
    await supabase.auth.signOut();
    // Hard-reload so the app returns to the Login screen cleanly
    window.location.href = '/';
  }, [onTimeout]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(signOut, timeoutMs);
  }, [signOut, timeoutMs]);

  useEffect(() => {
    // Start the timer
    resetTimer();

    // Re-start on any user activity
    ACTIVITY_EVENTS.forEach((evt) =>
      window.addEventListener(evt, resetTimer, { passive: true }),
    );

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      ACTIVITY_EVENTS.forEach((evt) =>
        window.removeEventListener(evt, resetTimer),
      );
    };
  }, [resetTimer]);
}
