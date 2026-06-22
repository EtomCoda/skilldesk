import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Send, ArrowLeft, Briefcase, Inbox, Camera, CheckCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ConfirmModal } from '../components/ConfirmModal';
import ReviewModal from '../components/ReviewModal';
import TypingBubble from '../components/TypingBubble';
import { useStore } from '../store/useStore';
import { useToast } from '../lib/toast';
import { RealtimeChannel } from '@supabase/supabase-js';

// ─── ConversationItem ─────────────────────────────────────────────────────────

interface ConversationItemProps {
  conv: any;
  isActive: boolean;
  onClick: () => void;
}

const ConversationItem = ({ conv, isActive, onClick }: ConversationItemProps) => {
  const lastMsg = conv.last_message;
  const isUnread = lastMsg && !lastMsg.is_read && lastMsg.sender_id !== conv.currentUserId;

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-4 cursor-pointer transition-colors hover:bg-slate-50 ${
        isActive ? 'bg-blue-50/60 border-r-2 border-blue-500' : ''
      }`}
    >
      <div className="relative flex-shrink-0">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200">
          {conv.user.avatar_url ? (
            <img src={conv.user.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-blue-950 font-semibold text-base">{conv.user.full_name?.[0]?.toUpperCase()}</span>
          )}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline">
          <h3 className={`text-sm truncate ${isUnread ? 'font-bold text-blue-950' : 'font-medium text-blue-900'}`}>
            {conv.user.full_name}
          </h3>
          <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap ml-2">
            {lastMsg
              ? new Date(lastMsg.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })
              : ''}
          </span>
        </div>
        <div className="flex justify-between items-center mt-0.5">
          <p className={`text-xs truncate ${isUnread ? 'font-semibold text-blue-600' : 'text-slate-500'}`}>
            {lastMsg?.sender_id === conv.currentUserId ? 'You: ' : ''}
            {lastMsg?.message || lastMsg?.content || (conv.isRequest ? 'Pending proposal' : 'Start a conversation')}
          </p>
          {isUnread && <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 ml-1" />}
        </div>
        {/* Job title tag */}
        {conv.type === 'job' && conv.job?.title && (
          <p className="text-[10px] text-slate-400 truncate mt-0.5 flex items-center gap-1">
            <Briefcase className="w-2.5 h-2.5 inline" /> {conv.job.title}
          </p>
        )}
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Messages() {
  const { currentUser, viewMode } = useStore();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const isFreelancer = viewMode === 'selling';

  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConv, setActiveConv] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  // loading = sidebar list is fetching (first load or mode switch)
  const [loading, setLoading] = useState(true);
  // messagesLoading = messages for the selected chat are in-flight
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'primary' | 'requests'>('primary');
   
  // Proposal & Negotiation state
  const [proposal, setProposal] = useState<any | null>(null);
  const [hiring, setHiring] = useState(false);
  const [showHireConfirm, setShowHireConfirm] = useState(false);
   
  // Release Escrow state
  const [releasing, setReleasing] = useState(false);
  const [showReleaseConfirm, setShowReleaseConfirm] = useState(false);

  // Review Modal state
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewData, setReviewData] = useState<{ isClient: boolean; recipientId: string; recipientName: string } | null>(null);

  // Typing indicator
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
   
  // pendingConvId: the id we're loading messages for — lets us avoid the
  // 'Select a Chat' flash by keeping activeConv set during the transition
  const pendingConvIdRef = useRef<string | null>(null);

  // Refs for scroll — we scroll the messages container, NOT the window
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  // Scroll to bottom inside the chat panel only (never touch window scroll)
  const scrollToBottom = useCallback((instant = false) => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
    if (!instant && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ block: 'end' });
    }
  }, []);

  useEffect(() => {
    // Small delay so DOM has painted the new messages before we scroll
    const id = setTimeout(() => scrollToBottom(), 50);
    return () => clearTimeout(id);
  }, [messages, scrollToBottom]);

  // ─── Fetch conversations filtered by current viewMode ──────────────────────────
  const fetchConversations = useCallback(async () => {
    if (!currentUser) return;

    try {
      // ── Fire all three top-level queries in parallel ───────────────────────────
      const [jobMsgsResult, directsResult, chatReqsResult] = await Promise.all([
        // 1. All job-thread messages this user is part of
        supabase
          .from('messages')
          .select('job_id, message, created_at, sender_id, receiver_id')
          .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
          .order('created_at', { ascending: false }),

        // 2. Direct conversations
        supabase
          .from('direct_conversations')
          .select(`
            *,
            participant_a_profile:participant_a(id, full_name, avatar_url),
            participant_b_profile:participant_b(id, full_name, avatar_url)
          `)
          .or(`participant_a.eq.${currentUser.id},participant_b.eq.${currentUser.id}`),

        // 3. Incoming chat requests (freelancer only — harmless to run for clients, will return [])
        supabase
          .from('chat_requests')
          .select('id, buyer_id, job_title, budget, description, status, created_at')
          .eq('seller_id', currentUser.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false }),
      ]);

      // ── 1. Job-based chats ───────────────────────────────────────────────────────
      const jobMsgs = jobMsgsResult.data ?? [];

      // Deduplicate: keep only the latest message per job
      const jobMap = new Map<string, any>();
      for (const m of jobMsgs) {
        if (m.job_id && !jobMap.has(m.job_id)) jobMap.set(m.job_id, m);
      }

      // Batch-fetch all job metadata in one query
      const jobIds = Array.from(jobMap.keys());
      const jobMeta = new Map<string, any>();
      if (jobIds.length > 0) {
        const { data: jobs } = await supabase
          .from('jobs')
          .select('id, title, budget, status, client_id')
          .in('id', jobIds);
        for (const j of jobs ?? []) jobMeta.set(j.id, j);
      }

      // Filter jobs by mode, collect unique other-user IDs, then batch-fetch profiles
      const relevantJobs: Array<{ jobId: string; lastMsg: any; job: any; otherUserId: string }> = [];
      for (const [jobId, lastMsg] of jobMap.entries()) {
        const job = jobMeta.get(jobId);
        const userIsClient = job?.client_id === currentUser.id;
        if (isFreelancer && userIsClient) continue;
        if (!isFreelancer && !userIsClient) continue;
        const otherUserId = lastMsg.sender_id === currentUser.id ? lastMsg.receiver_id : lastMsg.sender_id;
        relevantJobs.push({ jobId, lastMsg, job, otherUserId });
      }

      // Single batch query for all job-chat other users
      const jobUserIds = [...new Set(relevantJobs.map((r) => r.otherUserId))];
      const jobUserMap = new Map<string, any>();
      if (jobUserIds.length > 0) {
        const { data: jobUsers } = await supabase
          .from('users')
          .select('id, full_name, avatar_url')
          .in('id', jobUserIds);
        for (const u of jobUsers ?? []) jobUserMap.set(u.id, u);
      }

      const processedJobs = relevantJobs.map(({ jobId, lastMsg, job, otherUserId }) => {
        const otherUser = jobUserMap.get(otherUserId);
        return {
          id: jobId,
          type: 'job',
          job,
          user: {
            id: otherUser?.id,
            full_name: otherUser?.full_name || 'Anonymous',
            avatar_url: otherUser?.avatar_url,
            online: false,
          },
          last_message: lastMsg,
          currentUserId: currentUser.id,
          hasMessages: true,
        };
      });

      // ── 2. Direct conversations ────────────────────────────────────────────────────
      const directs = directsResult.data ?? [];

      // Fetch last message for each direct conversation — all in parallel
      const processedDirects = await Promise.all(
        directs.map(async (d) => {
          const otherUser =
            d.participant_a === currentUser.id ? d.participant_b_profile : d.participant_a_profile;
          const { data: lastMsg } = await supabase
            .from('direct_messages')
            .select('id, sender_id, message, created_at, is_read')
            .eq('conversation_id', d.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            id: d.id,
            type: 'direct',
            user: {
              id: otherUser?.id,
              full_name: otherUser?.full_name || 'User',
              avatar_url: otherUser?.avatar_url,
              online: false,
            },
            last_message: lastMsg,
            currentUserId: currentUser.id,
            hasMessages: !!lastMsg,
          };
        })
      );

      // ── 3. Freelancer Requests (chat_requests) ──────────────────────────────────
      let pendingRequestConvs: any[] = [];
      if (isFreelancer) {
        const chatReqs = chatReqsResult.data ?? [];

        // Batch-fetch all buyer profiles in one query
        const buyerIds = [...new Set(chatReqs.map((r) => r.buyer_id))];
        const buyerMap = new Map<string, any>();
        if (buyerIds.length > 0) {
          const { data: buyers } = await supabase
            .from('users')
            .select('id, full_name, avatar_url')
            .in('id', buyerIds);
          for (const b of buyers ?? []) buyerMap.set(b.id, b);
        }

        pendingRequestConvs = chatReqs.map((req) => {
          const buyer = buyerMap.get(req.buyer_id);
          return {
            id: req.id,
            type: 'chat_request',
            chatRequest: req,
            job: {
              id: null,
              title: req.job_title,
              budget: req.budget,
              status: 'pending',
              client_id: req.buyer_id,
            },
            user: {
              id: buyer?.id,
              full_name: buyer?.full_name || 'Client',
              avatar_url: buyer?.avatar_url,
              online: false,
            },
            last_message: null,
            currentUserId: currentUser.id,
            hasMessages: false,
            isRequest: true,
          };
        });
      }

      const all = [...processedDirects, ...processedJobs, ...pendingRequestConvs].sort((a, b) => {
        const tA = new Date(a.last_message?.created_at || 0).getTime();
        const tB = new Date(b.last_message?.created_at || 0).getTime();
        return tB - tA;
      });

      setConversations(all);
      return all;
    } catch (err) {
      console.error('Error fetching conversations:', err);
    } finally {
      setLoading(false);
    }
    // searchParams intentionally excluded — clicking a chat calls setSearchParams which
    // must NOT recreate this function or trigger a re-fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, viewMode]);

  // Track whether we've done the first fetch so we can distinguish
  // 'initial load' from 'mode switch' without resetting activeConv unnecessarily.
  const hasFetchedRef = useRef(false);
  const prevViewModeRef = useRef(viewMode);

  useEffect(() => {
    const isViewModeSwitch = hasFetchedRef.current && prevViewModeRef.current !== viewMode;
    prevViewModeRef.current = viewMode;

    if (isViewModeSwitch) {
      // Mode changed: clear everything and reload
      setActiveConv(null);
      setMessages([]);
    }

    setLoading(true);
    hasFetchedRef.current = true;
    fetchConversations();
  }, [fetchConversations]);

  // Sync activeConv with searchParams URL state
  // Also handles autoJobId param from deep links (e.g. from JobDetails proposal button)
  useEffect(() => {
    if (loading) return; // Wait until sidebar fetch is done

    const chatId    = searchParams.get('chat');
    const autoJobId = searchParams.get('autoJobId');

    // Priority 1: explicit ?chat=ID param
    if (chatId) {
      if (activeConv?.id !== chatId) {
        const found = conversations.find((c) => c.id === chatId);
        if (found) {
          setActiveConv(found);
          if (found.type === 'chat_request') {
            setMessages([]);
            setMessagesLoading(false);
          } else {
            setMessagesLoading(true);
          }
        }
      }
      return;
    }

    // Priority 2: ?autoJobId=ID param from proposal/job deep links
    if (autoJobId) {
      const found = conversations.find(
        (c) => c.type === 'job' && c.id === autoJobId
      );
      if (found) {
        setActiveConv(found);
        setMessagesLoading(true);
        // Replace URL with clean ?chat=ID so back-button works
        setSearchParams({ chat: autoJobId }, { replace: true });
        return;
      }

      // If not found, and we are the client with a freelancerId, create a temporary chat
      const freelancerId = searchParams.get('freelancerId');
      if (freelancerId && !isFreelancer && currentUser) {
        // Fetch freelancer details and job details
        Promise.all([
          supabase.from('users').select('id, full_name, avatar_url').eq('id', freelancerId).single(),
          supabase.from('jobs').select('title, budget, status, client_id').eq('id', autoJobId).single()
        ]).then(([{ data: user }, { data: job }]) => {
          if (user && job) {
            const newConv = {
              id: autoJobId,
              type: 'job',
              job,
              user: {
                id: user.id,
                full_name: user.full_name,
                avatar_url: user.avatar_url,
                online: false,
              },
              last_message: null,
              currentUserId: currentUser.id,
              hasMessages: false,
            };
            setConversations(prev => [newConv, ...prev]);
            setActiveConv(newConv);
            setMessagesLoading(false);
            setSearchParams({ chat: autoJobId }, { replace: true });
          }
        });
      }
      return;
    }

    if (!chatId && !autoJobId) {
      setActiveConv(null);
    }
  }, [searchParams, conversations, activeConv?.id, loading, isFreelancer, currentUser, setSearchParams]);

  // ─── Filtered sidebar list ────────────────────────────────────────────────
  const filteredConversations = useMemo(() => {
    if (!isFreelancer) {
      // Clients: all threads that have at least one message
      return conversations.filter((c) => c.hasMessages);
    }
    if (activeTab === 'primary') {
      // Freelancer Primary: active message threads (job or direct, with messages)
      return conversations.filter((c) => c.hasMessages && c.type !== 'chat_request');
    }
    // Freelancer Requests: pending chat_requests from buyers
    return conversations.filter((c) => c.isRequest && c.type === 'chat_request');
  }, [conversations, isFreelancer, activeTab]);

  // ─── Load messages for the active chat + realtime subscription ────────────
  useEffect(() => {
    if (!activeConv || !currentUser) return;

    // chat_requests have no messages table — just show the request card
    if (activeConv.type === 'chat_request') {
      setMessages([]);
      setMessagesLoading(false);
      return;
    }

    const convId = activeConv.id;
    const isNewConv = pendingConvIdRef.current !== convId;
    pendingConvIdRef.current = convId;
    
    // Only show loading spinner if it's a completely new chat we're opening
    if (isNewConv) {
      setMessagesLoading(true);
    }

    const table = activeConv.type === 'direct' ? 'direct_messages' : 'messages';
    const col   = activeConv.type === 'direct' ? 'conversation_id' : 'job_id';

    const fetchMsgsAndProposal = async () => {
      const msgsPromise = supabase
        .from(table)
        .select('*')
        .eq(col, convId)
        .order('created_at', { ascending: true });

      let propPromise = Promise.resolve({ data: null, error: null } as any);
      if (activeConv.type === 'job') {
        const freelancerId = isFreelancer ? currentUser.id : activeConv.user.id;
        propPromise = supabase
          .from('proposals')
          .select('*')
          .eq('job_id', convId)
          .eq('freelancer_id', freelancerId)
          .maybeSingle();
      }

      const [msgsRes, propRes] = await Promise.all([msgsPromise, propPromise]);

      // Only apply results if this conv is still the one being loaded
      if (pendingConvIdRef.current !== convId) return;

      if (msgsRes.error) {
        console.error('Error fetching messages:', msgsRes.error);
      } else {
        const fetchedMsgs = msgsRes.data ?? [];
        setMessages(fetchedMsgs);

        // Mark as read in DB if there are unread messages from the other user
        const unreadIds = fetchedMsgs
          .filter((m: any) => !m.is_read && m.sender_id !== currentUser.id)
          .map((m: any) => m.id);

        if (unreadIds.length > 0) {
          supabase.from(table).update({ is_read: true }).in('id', unreadIds).then();
          
          // Also update the local conversations list so the dot disappears immediately
          setConversations((prev) =>
            prev.map((c) => {
              if (c.id === convId && c.last_message && !c.last_message.is_read && c.last_message.sender_id !== currentUser.id) {
                return { ...c, last_message: { ...c.last_message, is_read: true } };
              }
              return c;
            })
          );
        }
      }

      if (propRes.error) console.error('Error fetching proposal:', propRes.error);
      else setProposal(propRes.data);

      setMessagesLoading(false);
    };

    fetchMsgsAndProposal();

    // Realtime
    const channel = supabase
      .channel(`chat:${convId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table, filter: `${col}=eq.${convId}` },
        (payload) => {
          const nm = payload.new as any;
          
          // If the message is from the other user, mark it as read immediately since the chat is open
          if (nm.sender_id !== currentUser.id) {
            supabase.from(table).update({ is_read: true }).eq('id', nm.id).then();
            nm.is_read = true;
          }

          setMessages((prev) => [...prev, nm]);
          setConversations((prev) =>
            prev.map((c) =>
              c.id === convId
                ? { ...c, last_message: nm, hasMessages: true, isRequest: false }
                : c
            )
          );
        }
      )
      .subscribe();

    channelRef.current = channel;
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      // Don't reset messagesLoading here — let the new effect set it
    };
  }, [activeConv, currentUser]);

  // ─── Decline a chat request ────────────────────────────────────────────────
  const [declining, setDeclining] = useState(false);
  const [accepting, setAccepting] = useState(false);
  // Tracks whether the freelancer has accepted a request and can now type
  const [requestAccepted, setRequestAccepted] = useState(false);

  // Reset accepted state whenever the active conversation changes
  useEffect(() => { setRequestAccepted(false); }, [activeConv?.id]);

  const handleDeclineRequest = async () => {
    if (!activeConv || declining) return;
    setDeclining(true);
    try {
      const { error } = await supabase
        .from('chat_requests')
        .update({ status: 'declined' })
        .eq('id', activeConv.id);
      if (error) throw error;

      // Remove from sidebar and close the panel
      setConversations((prev) => prev.filter((c) => c.id !== activeConv.id));
      setActiveConv(null);
      setSearchParams({});
      toast.success('Request declined.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to decline request');
    } finally {
      setDeclining(false);
    }
  };

  const handleAcceptRequest = async () => {
    if (!activeConv || accepting) return;
    setAccepting(true);
    try {
      const buyerId = activeConv.user.id;
      if (!buyerId) throw new Error('Client profile not found');

      // 1. Accept the request in db
      const { error: acceptErr } = await supabase
        .from('chat_requests')
        .update({ status: 'accepted' })
        .eq('id', activeConv.id);
      if (acceptErr) throw acceptErr;

      // 2. Find or create the direct conversation
      const { data: existing } = await supabase
        .from('direct_conversations')
        .select('id')
        .eq('participant_a', buyerId)
        .eq('participant_b', currentUser.id)
        .maybeSingle();

      let convId = existing?.id;
      if (!convId) {
        const { data: created, error: createErr } = await supabase
          .from('direct_conversations')
          .insert({
            participant_a: buyerId,
            participant_b: currentUser.id,
            chat_request_id: activeConv.id,
          })
          .select('id')
          .single();
        if (createErr) throw createErr;
        convId = created?.id;
      }

      toast.success('Request accepted!');

      // 3. Re-fetch conversations list
      const updatedList = await fetchConversations();

      // 4. Transition to direct message conversation
      const matchingConv = updatedList?.find((c) => c.type === 'direct' && c.id === convId);
      if (matchingConv) {
        setActiveTab('primary');
        setActiveConv(matchingConv);
        setSearchParams({ chat: convId });
      } else {
        const fallbackConv = {
          id: convId,
          type: 'direct',
          user: activeConv.user,
          last_message: null,
          currentUserId: currentUser.id,
          hasMessages: true,
        };
        setConversations((prev) => [fallbackConv, ...prev.filter((c) => c.id !== activeConv.id)]);
        setActiveTab('primary');
        setActiveConv(fallbackConv);
        setSearchParams({ chat: convId });
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to accept request');
    } finally {
      setAccepting(false);
    }
  };

  // ─── Hire Freelancer & Fund Escrow ──────────────────────────────────────────
  // ─── Hire Freelancer & Fund Escrow ──────────────────────────────────────────
  const handleHire = async () => {
    if (!proposal || !activeConv?.job || hiring) return;
    setHiring(true);
    try {
      // Call the secure Postgres RPC to handle the complex hiring logic transactionally
      const { error: rpcError } = await supabase.rpc('rpc_hire_freelancer', {
        p_proposal_id: proposal.id
      });
      
      if (rpcError) {
        throw new Error(rpcError.message || 'Insufficient funds or failed to hire freelancer');
      }

      // Send automated system message to notify freelancer
      await supabase.from('messages').insert({
        job_id: activeConv.job.id, sender_id: currentUser?.id, receiver_id: proposal.freelancer_id,
        message: '🎉 I have accepted your proposal and funded the escrow. Let\'s get to work!'
      });

      setProposal({ ...proposal, status: 'accepted' });
      setActiveConv({ ...activeConv, job: { ...activeConv.job, status: 'in_progress' } });
      toast.success('Freelancer hired and escrow funded successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to hire freelancer');
    } finally {
      setHiring(false);
    }
  };

  // ─── Release Escrow ────────────────────────────────────────────────────────
  // ─── Release Escrow ────────────────────────────────────────────────────────
  const handleReleaseEscrow = async () => {
    if (!proposal || !activeConv?.job || releasing) return;
    setReleasing(true);
    try {
      const freelancerId = proposal.freelancer_id;

      // Call the secure Postgres RPC to handle releasing funds transactionally
      const { error: rpcError } = await supabase.rpc('rpc_release_escrow', {
        p_job_id: activeConv.job.id
      });

      if (rpcError) {
        throw new Error(rpcError.message || 'Failed to release escrow funds');
      }

      // Send automated system message
      await supabase.from('messages').insert({
        job_id: activeConv.job.id, sender_id: currentUser?.id, receiver_id: freelancerId,
        message: '📌 Job completed! Messaging will be locked 1 hour after completion for security. You can still leave reviews anytime.'
      });

      // Update job status
      setActiveConv({ ...activeConv, job: { ...activeConv.job, status: 'completed' } });
      toast.success('Job completed! Funds released successfully.');

      // Show review modal to the client
      setReviewData({
        isClient: true,
        recipientId: freelancerId,
        recipientName: activeConv.user.full_name
      });
      setShowReviewModal(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to release funds');
    } finally {
      setReleasing(false);
    }
  };

  // ─── Send ─────────────────────────────────────────────────────────────────
  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newMessage.trim() || !currentUser || !activeConv || sending) return;

    // Check message lock if job is completed
    if (activeConv.job?.status === 'completed') {
      const completedAt = new Date(activeConv.job.completed_at);
      const now = new Date();
      const hoursPassed = (now.getTime() - completedAt.getTime()) / (1000 * 60 * 60);

      if (hoursPassed > 1) {
        toast.error('This job was completed over 1 hour ago. Messaging is now locked.');
        return;
      }
    }

    setSending(true);
    const draft = newMessage;
    setNewMessage('');

    try {
      if (activeConv.type === 'direct') {
        const { error } = await supabase.from('direct_messages').insert({
          conversation_id: activeConv.id,
          sender_id: currentUser.id,
          message: draft,
        });
        if (error) throw error;
      } else {
        // For job-based chats
        const { error } = await supabase.from('messages').insert({
          job_id: activeConv.id,
          sender_id: currentUser.id,
          receiver_id: activeConv.user.id,
          message: draft,
        });
        if (error) throw error;
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to send message');
      setNewMessage(draft);
    } finally {
      setSending(false);
    }
  };


  // Only count real chat_requests for the badge
  const requestCount = conversations.filter((c) => c.type === 'chat_request' && c.isRequest).length;

  // Helper to format date for message separators
  const getDateLabel = (date: Date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
  };

  // Group messages by date
  const groupedMessages = useMemo(() => {
    const groups: Record<string, any[]> = {};
    messages.forEach((msg) => {
      const date = new Date(msg.created_at);
      const dateKey = date.toDateString();
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(msg);
    });
    return Object.entries(groups).map(([dateKey, msgs]) => ({
      date: new Date(dateKey),
      messages: msgs,
    }));
  }, [messages]);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex bg-white font-sans border-t border-slate-100" style={{ height: 'calc(100vh - 64px)', overflow: 'hidden' }}>

      {/* ── Sidebar — always visible, even while loading ── */}
      <div
        className={`flex-shrink-0 w-full md:w-[340px] border-r border-slate-200 flex flex-col bg-white ${
          activeConv ? 'hidden md:flex' : 'flex'
        }`}
        style={{ height: '100%', overflow: 'hidden' }}
      >
        {/* Header */}
        <div className="flex-shrink-0 h-16 px-6 flex items-center justify-between border-b border-slate-100">
          <h1 className="text-xl font-bold text-blue-950 tracking-tight">Messages</h1>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            {isFreelancer ? 'Freelancer' : 'Client'}
          </span>
        </div>

        {/* Tabs — freelancer only */}
        {isFreelancer && (
          <div className="flex-shrink-0 flex px-4 py-3 gap-2 border-b border-slate-50">
            <button
              onClick={() => setActiveTab('primary')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                activeTab === 'primary' ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:bg-slate-50'
              }`}
            >
              Primary
            </button>
            <button
              onClick={() => setActiveTab('requests')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                activeTab === 'requests' ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:bg-slate-50'
              }`}
            >
              Requests{requestCount > 0 ? ` (${requestCount})` : ''}
            </button>
          </div>
        )}

        {/* Conversation list — scrolls independently */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            /* Skeleton rows while the sidebar list is fetching */
            <div className="flex flex-col gap-0">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-4">
                  <div className="w-12 h-12 rounded-full bg-slate-100 animate-pulse flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-slate-100 rounded-full animate-pulse w-2/3" />
                    <div className="h-2.5 bg-slate-100 rounded-full animate-pulse w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="px-6 py-20 text-center">
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Inbox className="w-8 h-8 text-blue-200" />
              </div>
              <p className="text-slate-400 text-sm">
                {activeTab === 'requests' && isFreelancer
                  ? 'No pending proposal requests.'
                  : `No ${isFreelancer ? 'freelancer' : 'client'} chats yet.`}
              </p>
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <ConversationItem
                key={conv.id}
                conv={conv}
                isActive={activeConv?.id === conv.id}
                onClick={() => {
                  setActiveConv(conv);
                  setSearchParams({ chat: conv.id });
                  if (conv.type === 'chat_request') {
                    setMessages([]);
                    setMessagesLoading(false);
                  } else {
                    setMessagesLoading(true);
                  }
                }}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Main chat area ── */}
      <div
        className={`flex-1 flex flex-col bg-slate-50 min-w-0 ${
          !activeConv ? 'hidden md:flex items-center justify-center' : 'flex'
        }`}
        style={{ height: '100%', overflow: 'hidden' }}
      >
        {!activeConv ? (
          /* Empty state — only shown when no conversation is selected AND list has loaded */
          <div className="text-center px-4">
            <div className="w-20 h-20 rounded-full border-2 border-blue-950 flex items-center justify-center mx-auto mb-6">
              <Send className="w-10 h-10 text-blue-950" />
            </div>
            <h2 className="text-2xl font-bold text-blue-950 mb-2">Select a Conversation</h2>
            <p className="text-slate-500 mb-8 max-w-xs mx-auto">
              Choose a chat from the list to view messages.
            </p>
            <button
              onClick={() => navigate(isFreelancer ? '/find-work' : '/post-job')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-md active:scale-95"
            >
              {isFreelancer ? 'Find Work' : 'Post a Job'}
            </button>
          </div>
        ) : (
          /* Active chat — fixed layout, no page scroll */
          <div className="flex flex-col h-full overflow-hidden">

            {/* Chat header */}
            <div className="flex-shrink-0 h-16 border-b border-slate-200 bg-white px-4 flex items-center gap-3 shadow-sm z-10">
              {/* Back button (mobile) */}
              <button
                onClick={() => { setActiveConv(null); setSearchParams({}); }}
                className="md:hidden p-2 -ml-1 text-blue-950"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>

              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200 shadow-sm">
                  {activeConv.user.avatar_url ? (
                    <img src={activeConv.user.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-blue-950 font-bold">
                      {activeConv.user.full_name?.[0]?.toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full" />
              </div>

              {/* Name */}
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-bold text-blue-950 truncate">{activeConv.user.full_name}</h2>
                {activeConv.type === 'chat_request' && (
                  <p className="text-[10px] text-amber-500 font-semibold truncate">Pending request</p>
                )}
                {activeConv.type === 'job' && activeConv.job?.title && (
                  <p className="text-[10px] text-slate-400 font-medium truncate">
                    Re: {activeConv.job.title}
                  </p>
                )}
              </div>

              {/* Contact Support Button */}
              <button
                onClick={() => navigate('/support')}
                title="Contact Support"
                className="flex-shrink-0 px-3 py-2 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm border border-red-100"
              >
                <AlertTriangle className="w-4 h-4" />
                <span className="hidden sm:inline text-xs font-bold">Support</span>
              </button>
            </div>

            {/* Sticky Top Space for Proposals and Requests (Outside scrolling container) */}
            <div className="flex-shrink-0 z-10 bg-slate-50 pt-3">
              {/* Chat request detail card */}
              {!messagesLoading && activeConv.type === 'chat_request' && activeConv.chatRequest && (
                <div className="bg-white border border-amber-100 rounded-2xl p-5 shadow-sm mb-1 mx-4">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-2 h-2 bg-amber-400 rounded-full" />
                    <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">New Chat Request</span>
                  </div>
                  <h3 className="text-sm font-bold text-blue-950 mb-1">{activeConv.chatRequest.job_title}</h3>
                  <p className="text-[13px] text-slate-600 leading-relaxed mb-4">{activeConv.chatRequest.description}</p>
                  <div className="flex items-center justify-between mb-5">
                    <span className="text-xs font-bold text-green-600">Budget: ₦{Number(activeConv.chatRequest.budget).toLocaleString()}</span>
                    <span className="text-[10px] text-slate-400">{new Date(activeConv.chatRequest.created_at).toLocaleDateString()}</span>
                  </div>
                  {!requestAccepted ? (
                    <div className="flex gap-3">
                      <button onClick={handleDeclineRequest} disabled={declining || accepting} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-500 hover:bg-slate-50 hover:border-red-200 hover:text-red-500 transition-all">
                        {declining ? 'Declining…' : 'Decline'}
                      </button>
                      <button onClick={handleAcceptRequest} disabled={declining || accepting} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-xs font-bold text-white hover:bg-blue-700 transition-all shadow-sm">
                        {accepting ? 'Accepting…' : 'Accept & Reply'}
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-green-600 font-semibold text-center">✓ Request accepted — send your first message below.</p>
                  )}
                </div>
              )}

              {/* Proposal & Negotiation Panel */}
              {!messagesLoading && activeConv.type === 'job' && proposal && (
                <div className="bg-white border border-blue-100 rounded-2xl p-4 shadow-sm mb-1 mx-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-blue-950">
                      {isFreelancer ? 'Your Proposal' : "Freelancer's Proposal"}
                    </span>
                    <span className="text-sm font-bold text-green-600">
                      ₦{proposal.proposed_amount.toLocaleString()}
                    </span>
                  </div>
                  {proposal.status === 'pending' ? (
                    <div className="flex items-center justify-between mt-4 border-t border-slate-50 pt-3">
                      <span className="text-xs text-slate-500 font-medium">
                        {isFreelancer ? 'Waiting for client response...' : 'Ready to hire?'}
                      </span>
                      {!isFreelancer && (
                        <button onClick={() => setShowHireConfirm(true)} disabled={hiring} className="px-4 py-2 bg-green-600 text-white text-xs font-bold rounded-xl hover:bg-green-700 disabled:opacity-50 transition-all shadow-sm">
                          {hiring ? 'Processing...' : 'Accept & Hire (Fund Escrow)'}
                        </button>
                      )}
                    </div>
                  ) : activeConv.job?.status === 'completed' ? (
                    <div className="mt-3 flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                        <CheckCircle className="w-4 h-4 flex-shrink-0" /> Job Completed & Escrow Released
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 flex items-center justify-between bg-green-50 p-2.5 rounded-xl border border-green-100">
                      <div className="flex items-center gap-2 text-xs font-bold text-green-700">
                        <CheckCircle className="w-4 h-4 flex-shrink-0" /> Escrow Funded & In Progress
                      </div>
                      {!isFreelancer && (
                         <button onClick={() => setShowReleaseConfirm(true)} disabled={releasing} className="px-3 py-1.5 bg-blue-600 text-white text-[10px] uppercase tracking-wider font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-all shadow-sm">
                           {releasing ? 'Processing...' : 'Release Funds'}
                         </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Messages area — the ONLY element that scrolls */}
            <div
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-3 custom-scrollbar"
            >
              {/* Per-chat loading spinner — only in the message scroll area */}
              {messagesLoading && (
                <div className="flex items-center justify-center py-16">
                  <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-blue-500" />
                </div>
              )}
              {/* User intro card at the top */}
              <div className="flex flex-col items-center mb-8">
                <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center overflow-hidden mb-3 shadow-md border border-slate-100">
                  {activeConv.user.avatar_url ? (
                    <img src={activeConv.user.avatar_url} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <span className="text-blue-950 font-bold text-xl">
                      {activeConv.user.full_name?.[0]?.toUpperCase()}
                    </span>
                  )}
                </div>
                <h3 className="text-base font-bold text-blue-950">{activeConv.user.full_name}</h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">SkillDesk Community</p>
              </div>

              {/* Everything below is hidden while messages are loading */}
              {!messagesLoading && (
              <>

              {activeConv.type !== 'chat_request' && messages.length === 0 && (
                <div className="text-center py-6">
                  <p className="text-slate-400 text-sm">No messages yet. Say hello! 👋</p>
                </div>
              )}

              {activeConv.type !== 'chat_request' && groupedMessages.map((group) => (
                <div key={group.date.toDateString()}>
                  {/* Date separator */}
                  <div className="flex items-center justify-center my-4 gap-3">
                    <div className="flex-1 h-px bg-slate-200"></div>
                    <span className="text-xs font-semibold text-slate-400 px-2 bg-slate-50">{getDateLabel(group.date)}</span>
                    <div className="flex-1 h-px bg-slate-200"></div>
                  </div>

                  {/* Messages for this date */}
                  {group.messages.map((msg) => {
                    const isMe = msg.sender_id === currentUser?.id;
                    const content = msg.message || msg.content;
                    return (
                      <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[72%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
                            isMe
                              ? 'bg-blue-600 text-white rounded-br-none'
                              : 'bg-white text-blue-950 border border-slate-100 rounded-bl-none'
                          }`}
                        >
                          {content}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}

              {/* Typing indicator */}
              {typingUsers.size > 0 && (
                <div className="flex justify-start">
                  <div className="bg-white text-blue-950 border border-slate-100 rounded-2xl rounded-bl-none px-4 py-2.5 shadow-sm">
                    <TypingBubble />
                  </div>
                </div>
              )}

              </>
              )} {/* end !messagesLoading */}

              <div ref={messagesEndRef} className="h-1" />
            </div>

            {/* Input — hidden for chat_request until explicitly accepted */}
            {(activeConv.type !== 'chat_request' || requestAccepted) && (
              <div className="flex-shrink-0 p-4 pb-20 bg-white">
                <form
                  onSubmit={handleSendMessage}
                  className="flex items-center bg-white border border-slate-200 rounded-full px-4 py-1.5 focus-within:ring-2 focus-within:ring-blue-100 transition-all shadow-sm"
                >
                  <div className="flex items-center justify-center w-8 h-8 -ml-1 text-slate-400 cursor-pointer">
                    <Camera className="w-5 h-5" />
                  </div>
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Message..."
                    className="flex-1 bg-transparent border-none text-blue-950 text-sm focus:ring-0 px-3 py-2 outline-none"
                    autoFocus={requestAccepted}
                  />
                  <button
                    type="submit"
                    disabled={sending || !newMessage.trim()}
                    className="text-blue-600 font-bold text-sm px-2 hover:text-blue-700 disabled:opacity-30 transition-opacity"
                  >
                    {sending ? '…' : 'Send'}
                  </button>
                </form>
              </div>
            )}

          </div>
        )}
      </div>

      {/* Hire Confirmation Modal */}
      {proposal && activeConv?.job && (
        <>
          <ConfirmModal
            isOpen={showHireConfirm}
            title="Confirm Hiring & Escrow"
            message={`You are about to hire ${activeConv.user.full_name} for ₦${proposal.proposed_amount.toLocaleString()}.\n\nThis amount will be deducted from your Available Balance and locked in Escrow until the job is completed. Proceed?`}
            confirmText="Yes, Hire & Fund Escrow"
            cancelText="Cancel"
            onConfirm={() => {
              setShowHireConfirm(false);
              handleHire();
            }}
            onCancel={() => setShowHireConfirm(false)}
          />

          <ConfirmModal
            isOpen={showReleaseConfirm}
            title="Complete Job & Release Funds"
            message={`Are you sure you want to complete this job and release ₦${proposal.proposed_amount.toLocaleString()} from escrow to ${activeConv.user.full_name}?\n\nThis action cannot be undone.`}
            confirmText="Release Funds"
            cancelText="Cancel"
            onConfirm={() => {
              setShowReleaseConfirm(false);
              handleReleaseEscrow();
            }}
            onCancel={() => setShowReleaseConfirm(false)}
          />
        </>
      )}

      {/* Review Modal */}
      {reviewData && (
        <ReviewModal
          isOpen={showReviewModal}
          onClose={() => {
            setShowReviewModal(false);
            setReviewData(null);
          }}
          jobId={activeConv?.job?.id || ''}
          recipientId={reviewData.recipientId}
          recipientName={reviewData.recipientName}
          isClient={reviewData.isClient}
          currentUserId={currentUser?.id || ''}
        />
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
    </div>
  );
}
