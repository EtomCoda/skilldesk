import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  MessageCircle, Send, ArrowLeft, Check, X, Briefcase, Inbox, ShieldCheck,
  AlertCircle, Edit3, CheckCircle, Clock, Star,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ConvItem {
  key: string;
  type: 'job' | 'direct';
  otherUser: { id: string; full_name: string };
  title: string;
  lastMessage: string;
  lastMessageTime: string | null;
  lastSenderId: string;
  jobId?: string;
  jobStatus?: string;
  proposalId?: string;
  proposalFreelancerId?: string;
  conversationId?: string;
}

interface ChatMsg {
  id: string;
  sender_id: string;
  message: string;
  created_at: string;
}

interface JobCtx {
  job: any;
  hire: any | null;
  proposal: any | null;
}

interface ChatReq {
  id: string;
  buyer_id: string;
  job_title: string;
  budget: number;
  description: string;
  created_at: string;
  buyer: { id: string; full_name: string; email: string };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(d: string | null) {
  if (!d) return '';
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const dy = Math.floor(h / 24);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  if (h < 24) return `${h}h`;
  return `${dy}d`;
}

function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Messages() {
  const { currentUser, viewMode, setWallet } = useStore();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const autoJobId = searchParams.get('autoJobId');
  const autoProposalId = searchParams.get('proposalId');
  const autoFreelancerId = searchParams.get('freelancerId');
  const isFreelancer = viewMode === 'selling';

  // ── Conversation list state ─────────────────────────────────────────────
  const [convItems, setConvItems] = useState<ConvItem[]>([]);
  const [listLoading, setListLoading] = useState(true);

  // ── Selected conversation state ─────────────────────────────────────────
  const [selected, setSelected] = useState<ConvItem | null>(null);
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [newMsg, setNewMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [jCtx, setJCtx] = useState<JobCtx | null>(null);

  // ── Hire flow state ─────────────────────────────────────────────────────
  const [hiringInProgress, setHiringInProgress] = useState(false);
  const [editingOffer, setEditingOffer] = useState(false);
  const [newOfferAmt, setNewOfferAmt] = useState('');
  const [savingOffer, setSavingOffer] = useState(false);

  // ── Requests state ──────────────────────────────────────────────────────
  const [showReqs, setShowReqs] = useState(false);
  const [pendingReqs, setPendingReqs] = useState<ChatReq[]>([]);
  const [processingReqId, setProcessingReqId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // ── Load conversation list ───────────────────────────────────────────────

  const loadList = useCallback(async () => {
    if (!currentUser) return;
    setListLoading(true);
    try {
      const [jobItems, directItems] = await Promise.all([loadJobConvs(), loadDirectConvs()]);
      const all = [...jobItems, ...directItems].sort((a, b) => {
        if (!a.lastMessageTime) return 1;
        if (!b.lastMessageTime) return -1;
        return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
      });
      setConvItems(all);
      if (isFreelancer) await loadPendingReqs();
    } finally {
      setListLoading(false);
    }
  }, [currentUser, viewMode]);

  useEffect(() => { loadList(); }, [loadList]);

  // ── Auto-select conversation from URL params ───────────────────────────────
  const autoSelectedRef = useRef(false);
  useEffect(() => {
    if (!autoJobId || !currentUser || listLoading || autoSelectedRef.current) return;

    const existing = convItems.find(c => c.jobId === autoJobId);
    if (existing) {
      autoSelectedRef.current = true;
      selectConv(existing);
      return;
    }

    // Not in list yet (brand new discussion — no messages exist yet)
    // Build the ConvItem on the fly from URL params + DB fetch
    autoSelectedRef.current = true;
    (async () => {
      const { data: job } = await supabase.from('jobs').select('*').eq('id', autoJobId).single();
      if (!job) return;

      const iAmClient = job.client_id === currentUser.id;
      const otherUserId = iAmClient
        ? (autoFreelancerId ?? '')
        : job.client_id;

      if (!otherUserId) return;
      const { data: ou } = await supabase.from('users').select('id, full_name').eq('id', otherUserId).single();
      if (!ou) return;

      const newConv: ConvItem = {
        key: `job-${autoJobId}`,
        type: 'job',
        otherUser: ou,
        title: job.title,
        lastMessage: 'No messages yet',
        lastMessageTime: null,
        lastSenderId: '',
        jobId: autoJobId,
        jobStatus: job.status,
        proposalId: autoProposalId ?? undefined,
        proposalFreelancerId: autoFreelancerId ?? undefined,
      };

      // Add to list so it appears in the sidebar too
      setConvItems(prev => {
        if (prev.some(c => c.key === newConv.key)) return prev;
        return [newConv, ...prev];
      });
      selectConv(newConv);
    })();
  }, [autoJobId, currentUser, listLoading, convItems]);

  // ── Scroll to bottom on new messages ───────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMsgs]);

  // ── Job conversations ────────────────────────────────────────────────────

  async function loadJobConvs(): Promise<ConvItem[]> {
    if (!currentUser) return [];
    const { data: msgs } = await supabase
      .from('messages')
      .select('job_id, message, created_at, sender_id, receiver_id')
      .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
      .order('created_at', { ascending: false });

    type MsgRow = { job_id: string; message: string; created_at: string; sender_id: string; receiver_id: string };
    const byJob = new Map<string, MsgRow | null>();
    for (const m of (msgs ?? [])) if (!byJob.has(m.job_id)) byJob.set(m.job_id, m);

    // Also include active hires with no messages yet
    if (isFreelancer) {
      const { data: hires } = await supabase.from('hires').select('job_id').eq('freelancer_id', currentUser.id).eq('status', 'funded');
      for (const h of (hires ?? [])) if (!byJob.has(h.job_id)) byJob.set(h.job_id, null);
    } else {
      const { data: ownJobs } = await supabase.from('jobs').select('id').eq('client_id', currentUser.id).eq('status', 'in_progress');
      for (const j of (ownJobs ?? [])) if (!byJob.has(j.id)) byJob.set(j.id, null);
    }

    const items: ConvItem[] = [];
    for (const [jobId, latestMsg] of byJob.entries()) {
      const { data: job } = await supabase.from('jobs').select('*').eq('id', jobId).single();
      if (!job) continue;
      const iAmClient = job.client_id === currentUser.id;
      if (isFreelancer && iAmClient) continue;
      if (!isFreelancer && !iAmClient) continue;

      let otherUserId = '';
      let proposalId: string | undefined;
      let proposalFreelancerId: string | undefined;

      if (iAmClient) {
        const { data: hire } = await supabase.from('hires').select('freelancer_id').eq('job_id', jobId).maybeSingle();
        const msgParty = latestMsg ? (latestMsg.sender_id === currentUser.id ? latestMsg.receiver_id : latestMsg.sender_id) : null;
        otherUserId = hire?.freelancer_id || msgParty || '';
        if (job.status === 'open') {
          const { data: p } = await supabase.from('proposals').select('id, freelancer_id, proposed_amount').eq('job_id', jobId).eq('status', 'pending').maybeSingle();
          if (p) { proposalId = p.id; proposalFreelancerId = p.freelancer_id; }
        }
      } else {
        otherUserId = job.client_id;
        const { data: p } = await supabase.from('proposals').select('id, freelancer_id').eq('job_id', jobId).eq('freelancer_id', currentUser.id).maybeSingle();
        if (p) { proposalId = p.id; proposalFreelancerId = p.freelancer_id; }
      }

      if (!otherUserId) continue;
      const { data: ou } = await supabase.from('users').select('id, full_name').eq('id', otherUserId).single();
      if (!ou) continue;

      items.push({
        key: `job-${jobId}`, type: 'job', otherUser: ou, title: job.title,
        lastMessage: latestMsg?.message || 'No messages yet',
        lastMessageTime: latestMsg?.created_at || null,
        lastSenderId: latestMsg?.sender_id || '',
        jobId, jobStatus: job.status, proposalId, proposalFreelancerId,
      });
    }
    return items;
  }

  // ── Direct conversations ─────────────────────────────────────────────────

  async function loadDirectConvs(): Promise<ConvItem[]> {
    if (!currentUser) return [];
    const col = isFreelancer ? 'participant_b' : 'participant_a';
    const other = isFreelancer ? 'participant_a' : 'participant_b';
    const { data: convs } = await supabase.from('direct_conversations').select('*').eq(col, currentUser.id).order('created_at', { ascending: false });
    const items: ConvItem[] = [];
    for (const conv of (convs ?? [])) {
      const { data: ou } = await supabase.from('users').select('id, full_name').eq('id', conv[other]).single();
      if (!ou) continue;
      const { data: lm } = await supabase.from('direct_messages').select('message, created_at, sender_id').eq('conversation_id', conv.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
      items.push({
        key: `direct-${conv.id}`, type: 'direct', otherUser: ou, title: 'Direct Message',
        lastMessage: lm?.message || 'No messages yet',
        lastMessageTime: lm?.created_at || conv.created_at,
        lastSenderId: lm?.sender_id || '',
        conversationId: conv.id,
      });
    }
    return items;
  }

  // ── Pending requests ─────────────────────────────────────────────────────

  async function loadPendingReqs() {
    if (!currentUser) return;
    const { data } = await supabase.from('chat_requests').select('*, buyer:buyer_id(id, full_name, email)').eq('seller_id', currentUser.id).eq('status', 'pending').order('created_at', { ascending: false });
    setPendingReqs((data as ChatReq[]) ?? []);
  }

  // ── Select conversation ──────────────────────────────────────────────────

  async function selectConv(conv: ConvItem) {
    setSelected(conv);
    setChatMsgs([]);
    setChatLoading(true);
    setJCtx(null);
    setEditingOffer(false);

    if (pollRef.current) clearInterval(pollRef.current);

    await fetchMsgs(conv);
    if (conv.type === 'job' && conv.jobId) await fetchJobCtx(conv);

    setChatLoading(false);

    pollRef.current = setInterval(async () => {
      await fetchMsgs(conv);
      if (conv.type === 'job' && conv.jobId) await fetchJobCtx(conv);
    }, 2000);
  }

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  async function fetchMsgs(conv: ConvItem) {
    if (conv.type === 'job' && conv.jobId) {
      const { data } = await supabase.from('messages').select('id, sender_id, message, created_at').eq('job_id', conv.jobId).order('created_at', { ascending: true });
      if (data) { setChatMsgs(data); updateLastMsg(conv.key, data); }
    } else if (conv.type === 'direct' && conv.conversationId) {
      const { data } = await supabase.from('direct_messages').select('id, sender_id, message, created_at').eq('conversation_id', conv.conversationId).order('created_at', { ascending: true });
      if (data) { setChatMsgs(data); updateLastMsg(conv.key, data); }
    }
  }

  function updateLastMsg(key: string, msgs: ChatMsg[]) {
    if (!msgs.length) return;
    const last = msgs[msgs.length - 1];
    setConvItems(prev => prev.map(c => c.key === key ? { ...c, lastMessage: last.message, lastMessageTime: last.created_at, lastSenderId: last.sender_id } : c));
  }

  async function fetchJobCtx(conv: ConvItem) {
    if (!conv.jobId) return;
    const { data: job } = await supabase.from('jobs').select('*').eq('id', conv.jobId).single();
    const { data: hire } = await supabase.from('hires').select('*').eq('job_id', conv.jobId).maybeSingle();
    let proposal = null;

    // 1. Try by explicit proposalId first (most specific)
    if (conv.proposalId) {
      const { data: p } = await supabase.from('proposals').select('*').eq('id', conv.proposalId).maybeSingle();
      if (p) proposal = p;
    }

    // 2. Fallback: any pending proposal for this open job
    if (!proposal && job?.status === 'open') {
      const { data: p } = await supabase
        .from('proposals').select('*')
        .eq('job_id', conv.jobId)
        .eq('status', 'pending')
        .maybeSingle();
      if (p) proposal = p;
    }

    // 3. Last resort: find proposal by the other party (e.g. the freelancer we're talking to)
    if (!proposal && job?.status === 'open' && conv.otherUser?.id) {
      const { data: p } = await supabase
        .from('proposals').select('*')
        .eq('job_id', conv.jobId)
        .eq('freelancer_id', conv.otherUser.id)
        .neq('status', 'rejected')
        .maybeSingle();
      if (p) proposal = p;
    }

    setJCtx({ job, hire, proposal });
    if (proposal && !editingOffer) setNewOfferAmt(String(proposal.proposed_amount));
  }


  // ── Send message ─────────────────────────────────────────────────────────

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!newMsg.trim() || !selected || !currentUser) return;
    setSending(true);
    try {
      if (selected.type === 'job' && selected.jobId) {
        await supabase.from('messages').insert({ job_id: selected.jobId, sender_id: currentUser.id, receiver_id: selected.otherUser.id, message: newMsg.trim() });
      } else if (selected.type === 'direct' && selected.conversationId) {
        await supabase.from('direct_messages').insert({ conversation_id: selected.conversationId, sender_id: currentUser.id, message: newMsg.trim() });
      }
      setNewMsg('');
      await fetchMsgs(selected);
    } finally {
      setSending(false);
    }
  }

  // ── Confirm hire ─────────────────────────────────────────────────────────

  async function handleConfirmHire() {
    if (!currentUser || !jCtx?.job || !jCtx?.proposal) return;
    const { job, proposal } = jCtx;
    const amount = proposal.proposed_amount;
    if (!confirm(`Confirm hire and lock ₦${amount.toLocaleString()} in escrow?`)) return;
    setHiringInProgress(true);
    try {
      const { data: wallet } = await supabase.from('wallets').select('*').eq('user_id', currentUser.id).single();
      if (!wallet) { alert('Could not access wallet.'); return; }
      if (wallet.available_balance < amount) { alert(`Insufficient balance. You need ₦${(amount - wallet.available_balance).toLocaleString()} more.`); return; }
      await supabase.from('wallets').update({ available_balance: wallet.available_balance - amount, escrow_balance: wallet.escrow_balance + amount, updated_at: new Date().toISOString() }).eq('user_id', currentUser.id);
      setWallet({ ...wallet, available_balance: wallet.available_balance - amount, escrow_balance: wallet.escrow_balance + amount, updated_at: new Date().toISOString() });
      await supabase.from('transactions').insert({ user_id: currentUser.id, amount, type: 'escrow_lock', job_id: job.id, description: `Funds locked for "${job.title}"` });
      await supabase.from('hires').insert({ job_id: job.id, freelancer_id: proposal.freelancer_id, escrow_amount: amount, status: 'funded' });
      await supabase.from('jobs').update({ status: 'in_progress' }).eq('id', job.id);
      await supabase.from('proposals').update({ status: 'accepted' }).eq('id', proposal.id);
      await supabase.from('proposals').update({ status: 'rejected' }).eq('job_id', job.id).neq('id', proposal.id);
      if (selected) await fetchJobCtx(selected);
      alert('Hire confirmed! Funds locked in escrow.');
    } finally {
      setHiringInProgress(false);
    }
  }

  // ── Update offer (freelancer) ─────────────────────────────────────────────

  async function handleUpdateOffer() {
    const parsed = parseFloat(newOfferAmt);
    if (!jCtx?.proposal?.id || isNaN(parsed) || parsed <= 0) { alert('Enter a valid amount.'); return; }
    setSavingOffer(true);
    try {
      await supabase.from('proposals').update({ proposed_amount: parsed }).eq('id', jCtx.proposal.id);
      if (selected) await fetchJobCtx(selected);
      setEditingOffer(false);
    } finally {
      setSavingOffer(false);
    }
  }

  // ── Complete job ──────────────────────────────────────────────────────────

  async function handleCompleteJob() {
    if (!currentUser || !jCtx?.job || !jCtx?.hire) return;
    if (!confirm('Mark job as completed and release funds to the freelancer?')) return;
    const { job, hire } = jCtx;
    await supabase.from('jobs').update({ status: 'completed' }).eq('id', job.id);
    await supabase.from('hires').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', hire.id);
    const { data: cw } = await supabase.from('wallets').select('*').eq('user_id', currentUser.id).single();
    if (cw) {
      await supabase.from('wallets').update({ escrow_balance: Math.max(0, cw.escrow_balance - hire.escrow_amount), updated_at: new Date().toISOString() }).eq('user_id', currentUser.id);
      setWallet({ ...cw, escrow_balance: Math.max(0, cw.escrow_balance - hire.escrow_amount), updated_at: new Date().toISOString() });
      await supabase.from('transactions').insert({ user_id: currentUser.id, amount: hire.escrow_amount, type: 'escrow_release', job_id: job.id, description: `Funds released for "${job.title}"` });
    }
    const { data: fw } = await supabase.from('wallets').select('*').eq('user_id', hire.freelancer_id).single();
    if (fw) {
      await supabase.from('wallets').update({ available_balance: fw.available_balance + hire.escrow_amount, updated_at: new Date().toISOString() }).eq('user_id', hire.freelancer_id);
      await supabase.from('transactions').insert({ user_id: hire.freelancer_id, amount: hire.escrow_amount, type: 'escrow_release', job_id: job.id, description: `Payment received for "${job.title}"` });
    }
    if (selected) await fetchJobCtx(selected);
    alert('Job completed! Payment released to freelancer.');
    navigate(`/review/${job.id}`);
  }

  // ── Accept / decline request ──────────────────────────────────────────────

  async function handleAcceptReq(req: ChatReq) {
    setProcessingReqId(req.id);
    try {
      await supabase.from('chat_requests').update({ status: 'accepted' }).eq('id', req.id);
      const { data: ex } = await supabase.from('direct_conversations').select('id').eq('participant_a', req.buyer_id).eq('participant_b', currentUser!.id).maybeSingle();
      let convId = ex?.id;
      if (!convId) {
        const { data: nw } = await supabase.from('direct_conversations').insert({ participant_a: req.buyer_id, participant_b: currentUser!.id, chat_request_id: req.id }).select('id').single();
        convId = nw?.id;
      }
      setPendingReqs(p => p.filter(r => r.id !== req.id));
      setShowReqs(false);
      await loadList();
      // Auto-open the new conversation
      if (convId) {
        const newConv: ConvItem = { key: `direct-${convId}`, type: 'direct', otherUser: { id: req.buyer_id, full_name: req.buyer.full_name }, title: 'Direct Message', lastMessage: 'No messages yet', lastMessageTime: null, lastSenderId: '', conversationId: convId };
        await selectConv(newConv);
      }
    } finally {
      setProcessingReqId(null);
    }
  }

  async function handleDeclineReq(id: string) {
    setProcessingReqId(id);
    await supabase.from('chat_requests').update({ status: 'declined' }).eq('id', id);
    setPendingReqs(p => p.filter(r => r.id !== id));
    setProcessingReqId(null);
  }

  // ── Derived values ────────────────────────────────────────────────────────

  const pendingCount = pendingReqs.length;
  const iAmClient = jCtx?.job ? jCtx.job.client_id === currentUser?.id : false;
  // Client sees their banner whenever job is open + no hire — regardless of proposal load state
  const isClientDiscussion = selected?.type === 'job' && !!jCtx?.job && jCtx?.job?.status === 'open' && !jCtx?.hire && iAmClient;
  // Freelancer sees their offer banner only once proposal is loaded
  const isFreelancerDiscussion = selected?.type === 'job' && !!jCtx?.job && jCtx?.job?.status === 'open' && !jCtx?.hire && !iAmClient && !!jCtx?.proposal;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex overflow-hidden bg-gray-100 h-full min-h-0">

      {/* ════════════ LEFT PANEL — conversation list ════════════ */}
      <div className={`${selected ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 lg:w-96 bg-white border-r border-gray-200 flex-shrink-0 relative`}>

        {/* Header */}
        <div className="px-4 pt-5 pb-3 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-blue-950">Messages</h1>
            {isFreelancer && (
              <button onClick={() => setShowReqs(true)} className="relative flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-blue-700 px-3 py-1.5 rounded-full hover:bg-blue-50 border border-gray-200 hover:border-blue-300 transition-all">
                <Inbox className="w-4 h-4" />
                Requests
                {pendingCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">{pendingCount > 9 ? '9+' : pendingCount}</span>}
              </button>
            )}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {listLoading ? (
            <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>
          ) : convItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center px-6">
              <MessageCircle className="w-10 h-10 text-gray-200 mb-3" />
              <p className="text-gray-500 font-medium text-sm">No conversations yet</p>
              <p className="text-gray-400 text-xs mt-1">{isFreelancer ? 'Job discussions and accepted requests appear here.' : 'Open a discussion with a freelancer to start.'}</p>
            </div>
          ) : (
            convItems.map(conv => {
              const active = selected?.key === conv.key;
              const isMe = conv.lastSenderId === currentUser?.id;
              return (
                <button key={conv.key} onClick={() => selectConv(conv)} className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors border-l-2 ${active ? 'bg-blue-50 border-blue-600' : 'bg-white border-transparent hover:bg-gray-50'}`}>
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-100 to-blue-400 flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold">{conv.otherUser.full_name.charAt(0)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline">
                      <p className="font-semibold text-gray-900 text-sm truncate">{conv.otherUser.full_name}</p>
                      <span className="text-[10px] text-gray-400 flex-shrink-0 ml-1">{timeAgo(conv.lastMessageTime)}</span>
                    </div>
                    <p className="text-xs text-blue-600 font-medium truncate flex items-center gap-1 mt-0.5">
                      {conv.type === 'job' ? <Briefcase className="w-3 h-3 flex-shrink-0" /> : <MessageCircle className="w-3 h-3 flex-shrink-0" />}
                      {conv.title}
                    </p>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{isMe && conv.lastSenderId ? 'You: ' : ''}{conv.lastMessage}</p>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* ── Requests overlay (covers left panel) ── */}
        {showReqs && isFreelancer && (
          <div className="absolute inset-0 z-20 bg-white flex flex-col">
            <div className="flex items-center gap-3 px-4 py-4 border-b">
              <button onClick={() => setShowReqs(false)} className="text-gray-500 hover:text-gray-900 transition-colors"><ArrowLeft className="w-5 h-5" /></button>
              <h2 className="text-base font-bold text-blue-950">Message Requests</h2>
              {pendingCount > 0 && <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{pendingCount}</span>}
            </div>
            <div className="flex-1 overflow-y-auto">
              {pendingReqs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-6">
                  <Inbox className="w-10 h-10 text-gray-200 mb-3" />
                  <p className="text-gray-500 font-medium text-sm">No pending requests</p>
                </div>
              ) : pendingReqs.map(req => (
                <div key={req.id} className="p-4 border-b border-gray-50">
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-blue-700 font-bold text-sm">{req.buyer.full_name.charAt(0)}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{req.buyer.full_name}</p>
                      <p className="text-[10px] text-gray-400">{timeAgo(req.created_at)} ago</p>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3 mb-3 space-y-1.5">
                    <div className="flex items-center gap-1.5"><Briefcase className="w-3.5 h-3.5 text-gray-400" /><span className="font-semibold text-gray-900 text-sm">{req.job_title}</span></div>
                    <div className="flex items-center gap-1.5"><span className="text-green-700 font-bold text-sm">₦{req.budget.toLocaleString()}</span></div>
                    <p className="text-xs text-gray-600 leading-relaxed mt-1">{req.description}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleDeclineReq(req.id)} disabled={processingReqId === req.id} className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-red-200 text-red-600 rounded-xl text-sm font-semibold hover:bg-red-50 transition-colors disabled:opacity-50">
                      <X className="w-3.5 h-3.5" /> Decline
                    </button>
                    <button onClick={() => handleAcceptReq(req)} disabled={processingReqId === req.id} className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-blue-950 text-white rounded-xl text-sm font-semibold hover:bg-blue-900 transition-colors disabled:opacity-50">
                      <Check className="w-3.5 h-3.5" /> {processingReqId === req.id ? '...' : 'Accept'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ════════════ RIGHT PANEL — chat area ════════════ */}
      <div className={`${!selected ? 'hidden md:flex' : 'flex'} flex-col flex-1 overflow-hidden`}>
        {!selected ? (
          /* Empty state — desktop only */
          <div className="hidden md:flex flex-col items-center justify-center h-full text-center bg-white">
            <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-4">
              <MessageCircle className="w-10 h-10 text-blue-200" />
            </div>
            <p className="text-gray-500 font-semibold">Your messages</p>
            <p className="text-gray-400 text-sm mt-1">Select a conversation to start chatting</p>
          </div>
        ) : (
          <>
            {/* ── Chat header ── */}
            <div className="flex items-center gap-3 px-4 py-3 bg-white border-b shadow-sm flex-shrink-0">
              <button onClick={() => { setSelected(null); if (pollRef.current) clearInterval(pollRef.current); }} className="md:hidden text-gray-500 hover:text-gray-900 mr-1">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-100 to-blue-400 flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-sm">{selected.otherUser.full_name.charAt(0)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{selected.otherUser.full_name}</p>
                <p className="text-xs text-blue-600 truncate flex items-center gap-1">
                  {selected.type === 'job' ? <Briefcase className="w-3 h-3" /> : <MessageCircle className="w-3 h-3" />}
                  {selected.title}
                </p>
              </div>
              {/* Complete job button */}
              {iAmClient && jCtx?.job?.status === 'in_progress' && jCtx?.hire && (
                <button onClick={handleCompleteJob} className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors">
                  <CheckCircle className="w-3.5 h-3.5" /> Complete Job
                </button>
              )}
            </div>

            {/* ── Context banners ── */}
            {/* CLIENT: shows as soon as job is open + no hire (proposal loading handled inside) */}
            {isClientDiscussion && (
              <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 flex-shrink-0">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    {jCtx?.proposal ? (
                      <span className="text-sm text-amber-800">
                        <span className="font-semibold">Discussion in progress</span> · Offer:{' '}
                        <span className="font-bold">₦{jCtx.proposal.proposed_amount.toLocaleString()}</span>
                        <span className="text-xs ml-1 text-amber-500">(live)</span>
                      </span>
                    ) : (
                      <span className="text-sm text-amber-700">Loading offer details...</span>
                    )}
                  </div>
                  <button
                    onClick={handleConfirmHire}
                    disabled={hiringInProgress || !jCtx?.proposal}
                    className="flex items-center gap-1.5 bg-blue-950 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-blue-900 whitespace-nowrap disabled:opacity-50"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {hiringInProgress ? 'Processing...' : 'Confirm Hire & Fund Escrow'}
                  </button>
                </div>
              </div>
            )}

            {/* FREELANCER: shows once proposal is loaded */}
            {isFreelancerDiscussion && jCtx?.proposal && (
              <div className="bg-blue-50 border-b border-blue-100 px-4 py-3 flex-shrink-0">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    {!editingOffer ? (
                      <span className="text-sm text-blue-800">
                        <span className="font-semibold">Your offer:</span>{' '}
                        <span className="font-bold">₦{jCtx.proposal.proposed_amount.toLocaleString()}</span>
                        <span className="text-xs ml-1 text-blue-500">— client sees this live</span>
                      </span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-blue-700 font-medium">₦</span>
                        <input type="number" value={newOfferAmt} onChange={e => setNewOfferAmt(e.target.value)} className="w-24 px-2 py-1 text-sm border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" autoFocus min="1" />
                        <button onClick={handleUpdateOffer} disabled={savingOffer} className="px-2.5 py-1 bg-blue-950 text-white text-xs rounded-lg font-semibold hover:bg-blue-900 disabled:opacity-50">{savingOffer ? '...' : 'Save'}</button>
                        <button onClick={() => { setEditingOffer(false); setNewOfferAmt(String(jCtx?.proposal?.proposed_amount ?? '')); }} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
                      </div>
                    )}
                  </div>
                  {!editingOffer && (
                    <button onClick={() => { setNewOfferAmt(String(jCtx?.proposal?.proposed_amount ?? '')); setEditingOffer(true); }} className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-semibold whitespace-nowrap">
                      <Edit3 className="w-3 h-3" /> Update
                    </button>
                  )}
                </div>
              </div>
            )}

            {jCtx?.hire && (
              <div className="bg-blue-50 border-b border-blue-100 px-4 py-2.5 flex-shrink-0">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-blue-900 font-medium">Escrow: <span className="font-bold">₦{jCtx.hire.escrow_amount.toLocaleString()}</span></span>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded-full font-semibold ${jCtx.hire.status === 'funded' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                      {jCtx.hire.status === 'funded' ? 'Escrow Funded' : 'Completed'}
                    </span>
                    {jCtx.hire.status === 'completed' && jCtx?.job?.id && (
                      <button 
                        onClick={() => navigate(`/review/${jCtx.job.id}`)}
                        className="flex items-center gap-1.5 text-blue-700 hover:text-blue-900 font-semibold transition-colors"
                      >
                        <Star className="w-3.5 h-3.5" /> Leave Review
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── Messages area ── */}
            <div className="flex-1 overflow-y-auto p-4 space-y-1 bg-gray-50">
              {chatLoading ? (
                <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>
              ) : chatMsgs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  <MessageCircle className="w-10 h-10 text-gray-200 mb-3" />
                  <p className="text-gray-500 font-medium text-sm">No messages yet</p>
                  <p className="text-gray-400 text-xs mt-1">Say hello to {selected.otherUser.full_name.split(' ')[0]}</p>
                </div>
              ) : (
                chatMsgs.map((msg, i) => {
                  const isMe = msg.sender_id === currentUser?.id;
                  const prev = chatMsgs[i - 1];
                  const showTime = !prev || new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() > 5 * 60 * 1000;
                  return (
                    <div key={msg.id}>
                      {showTime && (
                        <div className="flex items-center gap-2 my-3">
                          <div className="flex-1 border-t border-gray-200" />
                          <span className="text-[10px] text-gray-400 flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{fmtTime(msg.created_at)}</span>
                          <div className="flex-1 border-t border-gray-200" />
                        </div>
                      )}
                      <div className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                        {!isMe && (
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-100 to-blue-300 flex items-center justify-center flex-shrink-0 mb-1">
                            <span className="text-blue-800 font-bold text-[9px]">{selected.otherUser.full_name.charAt(0)}</span>
                          </div>
                        )}
                        <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${isMe ? 'bg-blue-950 text-white rounded-br-sm' : 'bg-white text-gray-900 shadow-sm border border-gray-100 rounded-bl-sm'}`}>
                          {msg.message}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* ── Message input ── */}
            <form onSubmit={handleSend} className="flex items-center gap-3 px-4 py-3 bg-white border-t border-gray-100 flex-shrink-0">
              <input
                type="text"
                value={newMsg}
                onChange={e => setNewMsg(e.target.value)}
                placeholder={`Message ${selected.otherUser.full_name.split(' ')[0]}...`}
                className="flex-1 px-4 py-2.5 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
                disabled={sending}
              />
              <button type="submit" disabled={sending || !newMsg.trim()} className="w-10 h-10 bg-blue-950 text-white rounded-full flex items-center justify-center hover:bg-blue-900 transition-colors disabled:opacity-40 flex-shrink-0">
                <Send className="w-4 h-4" />
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
