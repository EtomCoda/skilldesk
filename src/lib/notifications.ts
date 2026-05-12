/**
 * notifications.ts — SkillDesk in-app notification helper
 *
 * Writes notification rows to the `notifications` Supabase table so that
 * the NotificationBell component can read and display them to each user.
 *
 * When Paystack is integrated this file will also trigger payment webhooks.
 */

import { supabase } from './supabase';

export interface NotificationPayload {
  user_id: string;
  type: string;          // e.g. 'hire_confirmed' | 'proposal_rejected' | 'job_complete' | 'new_job'
  title: string;
  body: string;
  job_id?: string;
  proposal_id?: string;
}

/**
 * Insert one or more notification rows.
 * Silent on error — notifications are best-effort and must never crash the calling flow.
 */
export async function notify(notifications: NotificationPayload[]): Promise<void> {
  if (!notifications.length) return;

  try {
    const { error } = await supabase.from('notifications').insert(
      notifications.map((n) => ({
        user_id:     n.user_id,
        type:        n.type,
        title:       n.title,
        body:        n.body,
        job_id:      n.job_id ?? null,
        proposal_id: n.proposal_id ?? null,
        is_read:     false,
      }))
    );

    if (error) {
      // Table might not exist yet — log but don't throw
      console.warn('[notifications] insert error (table may not exist yet):', error.message);
    }
  } catch (err) {
    console.warn('[notifications] unexpected error:', err);
  }
}
