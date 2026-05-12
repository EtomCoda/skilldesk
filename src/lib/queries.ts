// All Supabase fetch functions used by React Query.
// Keeping them here means pages import the function, not raw supabase calls.
import { supabase } from './supabase';

// ─── Wallet ──────────────────────────────────────────────────────────────────
export async function fetchWallet(userId: string) {
  const { data, error } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ─── Conversations (Messages page) ───────────────────────────────────────────
// Returns raw conversation list. The full build happens inside Messages.tsx
// because it needs viewMode context. We preload only the lightweight part:
// the messages table scan that powers the sidebar list.
export async function fetchConversationList(userId: string, isFreelancer: boolean) {
  // Pull all message job_ids the user is part of
  const { data: msgs } = await supabase
    .from('messages')
    .select('job_id, message, created_at, sender_id, receiver_id')
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  // Pull direct conversations
  const col   = isFreelancer ? 'participant_b' : 'participant_a';
  const { data: directs } = await supabase
    .from('direct_conversations')
    .select('*')
    .eq(col, userId)
    .order('created_at', { ascending: false });

  return { msgs: msgs ?? [], directs: directs ?? [] };
}

// ─── Ongoing Jobs (client) ───────────────────────────────────────────────────
export async function fetchOngoingJobs(userId: string) {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('client_id', userId)
    .in('status', ['in_progress', 'completed', 'cancelled'])
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// ─── Proposals (freelancer) ──────────────────────────────────────────────────
export async function fetchProposals(userId: string) {
  const { data: proposalsData, error } = await supabase
    .from('proposals')
    .select('*')
    .eq('freelancer_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  if (!proposalsData) return [];

  return Promise.all(
    proposalsData.map(async (proposal) => {
      const [{ data: jobData }, { data: msgs }] = await Promise.all([
        supabase.from('jobs').select('*').eq('id', proposal.job_id).single(),
        supabase
          .from('messages')
          .select('id')
          .eq('job_id', proposal.job_id)
          .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
          .limit(1),
      ]);
      return { ...proposal, job: jobData, hasDiscussion: (msgs?.length ?? 0) > 0 };
    })
  );
}

// ─── Earnings + wallet (freelancer MyEarnings page) ─────────────────────────
export async function fetchEarnings(userId: string) {
  const [
    { data: hiresData, error: hiresError },
    { data: txData },
    { data: walletData },
  ] = await Promise.all([
    supabase.from('hires').select('*').eq('freelancer_id', userId).order('created_at', { ascending: false }),
    supabase.from('transactions').select('id, amount, description, created_at, job_id').eq('user_id', userId).eq('type', 'escrow_release').order('created_at', { ascending: false }),
    supabase.from('wallets').select('*').eq('user_id', userId).maybeSingle(),
  ]);
  if (hiresError) throw hiresError;

  const hiresWithJobs = await Promise.all(
    (hiresData ?? []).map(async (hire) => {
      const { data: jobData } = await supabase.from('jobs').select('*').eq('id', hire.job_id).single();
      return { ...hire, job: jobData };
    })
  );

  return {
    hires: hiresWithJobs,
    transactions: txData ?? [],
    wallet: walletData,
  };
}

// ─── Admin stats ─────────────────────────────────────────────────────────────
export async function fetchAdminStats() {
  const [
    { count: totalUsers },
    { count: totalJobs },
    { count: openJobs },
    { count: activeHires },
    { data: escrowData },
    { data: releasedData },
    { count: openTickets },
    { count: disputedHires },
  ] = await Promise.all([
    supabase.from('users').select('*', { count: 'exact', head: true }),
    supabase.from('jobs').select('*', { count: 'exact', head: true }),
    supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    supabase.from('hires').select('*', { count: 'exact', head: true }).eq('status', 'funded'),
    supabase.from('wallets').select('escrow_balance'),
    supabase.from('transactions').select('amount').eq('type', 'escrow_release'),
    supabase.from('support_tickets').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    supabase.from('hires').select('*', { count: 'exact', head: true }).eq('status', 'disputed'),
  ]);

  return {
    totalUsers:    totalUsers    ?? 0,
    totalJobs:     totalJobs     ?? 0,
    openJobs:      openJobs      ?? 0,
    activeHires:   activeHires   ?? 0,
    totalEscrow:   (escrowData  ?? []).reduce((s, w) => s + w.escrow_balance, 0),
    totalReleased: (releasedData ?? []).reduce((s, t) => s + t.amount, 0),
    openTickets:   openTickets   ?? 0,
    disputedHires: disputedHires ?? 0,
  };
}

// ─── Admin users ─────────────────────────────────────────────────────────────
export async function fetchAdminUsers() {
  const { data: usersData, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;

  return Promise.all(
    (usersData ?? []).map(async (u) => {
      const { data: wallet } = await supabase
        .from('wallets')
        .select('available_balance, escrow_balance')
        .eq('user_id', u.id)
        .maybeSingle();
      return { ...u, wallet: wallet ?? undefined };
    })
  );
}

// ─── Admin jobs ──────────────────────────────────────────────────────────────
export async function fetchAdminJobs() {
  const { data: jobsData, error } = await supabase
    .from('jobs')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;

  return Promise.all(
    (jobsData ?? []).map(async (job) => {
      const [{ data: client }, { count: proposal_count }] = await Promise.all([
        supabase.from('users').select('full_name').eq('id', job.client_id).single(),
        supabase.from('proposals').select('*', { count: 'exact', head: true }).eq('job_id', job.id),
      ]);
      return { ...job, client_name: client?.full_name, proposal_count: proposal_count ?? 0 };
    })
  );
}

// ─── Admin support tickets ───────────────────────────────────────────────────
export async function fetchAdminTickets() {
  const { data, error } = await supabase
    .from('support_tickets')
    .select('*, user:user_id(full_name, email)')
    .order('status', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as any[];
}
