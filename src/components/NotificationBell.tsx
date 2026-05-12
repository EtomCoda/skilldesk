/**
 * NotificationBell.tsx
 *
 * Reads unread notifications for the current user from Supabase and renders
 * a bell icon with an unread badge. Clicking it opens a dropdown of the last
 * 10 notifications as styled cards, each marked read on open.
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BellRing, CheckCircle, Briefcase, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';

interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
  job_id?: string;
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const dy = Math.floor(h / 24);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${dy}d ago`;
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  hire_confirmed:   <CheckCircle style={{ width: 16, height: 16, color: '#16a34a', flexShrink: 0 }} />,
  job_complete:     <CheckCircle style={{ width: 16, height: 16, color: '#2563eb', flexShrink: 0 }} />,
  proposal_rejected:<X style={{ width: 16, height: 16, color: '#dc2626', flexShrink: 0 }} />,
  new_job:          <Briefcase style={{ width: 16, height: 16, color: '#7c3aed', flexShrink: 0 }} />,
};

export default function NotificationBell() {
  const { currentUser } = useStore();
  const navigate = useNavigate();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Load notifications
  const load = async () => {
    if (!currentUser) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false })
      .limit(15);
    setItems((data as AppNotification[]) ?? []);
  };

  useEffect(() => {
    load();
    // Poll every 30 s
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // Mark all read when opening
  const handleOpen = async () => {
    setOpen((v) => !v);
    const unread = items.filter((i) => !i.is_read).map((i) => i.id);
    if (unread.length && currentUser) {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .in('id', unread);
      setItems((prev) => prev.map((i) => ({ ...i, is_read: true })));
    }
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleNotificationClick = (item: AppNotification) => {
    setOpen(false);
    if (item.type === 'support_reply') {
      navigate('/support');
    } else if (item.job_id) {
      if (item.type === 'hire_confirmed' || item.type === 'new_message') {
        navigate(`/messages?autoJobId=${item.job_id}`);
      } else {
        navigate(`/job/${item.job_id}`);
      }
    }
  };

  const unreadCount = items.filter((i) => !i.is_read).length;
  const BellIcon = unreadCount > 0 ? BellRing : Bell;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Bell button */}
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
        title="Notifications"
        aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ''}`}
      >
        <BellIcon
          className="w-5 h-5 transition-colors"
          style={{ color: unreadCount > 0 ? '#2563eb' : '#6b7280' }}
        />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: 4,
              right: 4,
              minWidth: 16,
              height: 16,
              background: '#ef4444',
              color: '#fff',
              fontSize: 9,
              fontWeight: 700,
              borderRadius: 99,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
              border: '2px solid #fff',
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: 340,
            maxHeight: 480,
            background: '#fff',
            borderRadius: 16,
            boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
            border: '1px solid #e5e7eb',
            zIndex: 9999,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '14px 16px 10px',
              borderBottom: '1px solid #f3f4f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>Notifications</span>
            <button
              onClick={() => setOpen(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 4, borderRadius: 6 }}
            >
              <X style={{ width: 15, height: 15 }} />
            </button>
          </div>

          {/* List */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {items.length === 0 ? (
              <div style={{ padding: '40px 16px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                <Bell style={{ width: 32, height: 32, margin: '0 auto 8px', opacity: 0.3 }} />
                <p>No notifications yet</p>
              </div>
            ) : (
              items.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  style={{
                    display: 'flex',
                    gap: 12,
                    padding: '12px 16px',
                    background: item.is_read ? '#fff' : '#eff6ff',
                    borderBottom: '1px solid #f9fafb',
                    transition: 'background 0.2s',
                    cursor: 'pointer',
                  }}
                  className="hover:bg-gray-50"
                >
                  <div style={{ paddingTop: 2 }}>
                    {TYPE_ICON[item.type] ?? <Bell style={{ width: 16, height: 16, color: '#6b7280', flexShrink: 0 }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: '#111827' }}>{item.title}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>{item.body}</p>
                    <p style={{ margin: '4px 0 0', fontSize: 11, color: '#9ca3af' }}>{timeAgo(item.created_at)}</p>
                  </div>
                  {!item.is_read && (
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#2563eb', flexShrink: 0, marginTop: 5 }} />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
