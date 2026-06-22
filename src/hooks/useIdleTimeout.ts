import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { useQueryClient } from '@tanstack/react-query';

// Events that count as user activity
const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click',
];

/**
 * Logs the user out after `timeoutMs` of inactivity.
 * Default: 30 minutes.
 *
 * On timeout:
 * 1. Fires optional `onTimeout` callback (e.g. show a toast)
 * 2. Calls supabase.auth.signOut()
 * 3. Clears the Zustand store
 * 4. Clears the React Query cache
 * 5. Hard-reloads to guarantee a clean login screen
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
  const { clearAll } = useStore();
  const queryClient = useQueryClient();

  const signOut = useCallback(async () => {
    onTimeout?.();
    // Wipe Supabase session
    await supabase.auth.signOut();
    // Wipe Zustand store
    clearAll();
    // Wipe React Query cache so no previous user data bleeds into the next session
    queryClient.clear();
    // Clear browser storage
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (_) { /* ignore in private-browsing environments */ }
    // Hard-reload so the app returns to the Login screen cleanly
    window.location.href = '/';
  }, [onTimeout, clearAll, queryClient]);

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
