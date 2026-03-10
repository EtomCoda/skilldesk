import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, Clock, ExternalLink, Briefcase } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';

interface DirectConversationRow {
  type: 'direct';
  id: string;
  participant_a: string;
  participant_b: string;
  chat_request_id?: string;
  created_at: string;
  otherUser: {
    id: string;
    full_name: string;
    email: string;
  };
  chatRequest?: {
    job_title: string;
    budget: number;
    status: string;
  };
  lastMessage?: {
    message: string;
    created_at: string;
    sender_id: string;
  };
}

interface JobThreadRow {
  type: 'job_discussion';
  job_id: string;
  job_title: string;
  proposal_id?: string;
  otherUser: {
    id: string;
    full_name: string;
    email: string;
  };
  lastMessage: {
    message: string;
    created_at: string;
    sender_id: string;
  };
}

type ConversationRow = DirectConversationRow | JobThreadRow;

export default function MyMessages() {
  const navigate = useNavigate();
  const currentUser = useStore((state) => state.currentUser);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUser) fetchConversations();
  }, [currentUser]);

  const fetchConversations = async () => {
    try {
      // ── 1. Direct conversations (unchanged from before) ──────────────────
      const { data: convA } = await supabase
        .from('direct_conversations')
        .select('*')
        .eq('participant_a', currentUser?.id)
        .order('created_at', { ascending: false });

      const { data: convB } = await supabase
        .from('direct_conversations')
        .select('*')
        .eq('participant_b', currentUser?.id)
        .order('created_at', { ascending: false });

      const allDirectConvs = [...(convA || []), ...(convB || [])];

      const enrichedDirect: DirectConversationRow[] = await Promise.all(
        allDirectConvs.map(async (conv) => {
          const otherUserId =
            conv.participant_a === currentUser?.id ? conv.participant_b : conv.participant_a;

          const { data: userData } = await supabase
            .from('users')
            .select('id, full_name, email')
            .eq('id', otherUserId)
            .single();

          let chatRequest = undefined;
          if (conv.chat_request_id) {
            const { data: reqData } = await supabase
              .from('chat_requests')
              .select('job_title, budget, status')
              .eq('id', conv.chat_request_id)
              .single();
            chatRequest = reqData || undefined;
          }

          const { data: lastMsgData } = await supabase
            .from('direct_messages')
            .select('message, created_at, sender_id')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            type: 'direct' as const,
            ...conv,
            otherUser: userData,
            chatRequest,
            lastMessage: lastMsgData || undefined,
          };
        })
      );

      // ── 2. Job-based discussion threads (from proposals/messages table) ──
      // Fetch all messages where the current user is sender or receiver
      const { data: sentMsgs } = await supabase
        .from('messages')
        .select('job_id, sender_id, receiver_id, message, created_at')
        .eq('sender_id', currentUser?.id)
        .order('created_at', { ascending: false });

      const { data: receivedMsgs } = await supabase
        .from('messages')
        .select('job_id, sender_id, receiver_id, message, created_at')
        .eq('receiver_id', currentUser?.id)
        .order('created_at', { ascending: false });

      const allJobMsgs = [...(sentMsgs || []), ...(receivedMsgs || [])];

      // Group by job_id, keep only the latest message per job
      const jobThreadMap = new Map<
        string,
        { job_id: string; sender_id: string; receiver_id: string; message: string; created_at: string }
      >();
      for (const msg of allJobMsgs) {
        const existing = jobThreadMap.get(msg.job_id);
        if (!existing || new Date(msg.created_at) > new Date(existing.created_at)) {
          jobThreadMap.set(msg.job_id, msg);
        }
      }

      const enrichedJobThreads: JobThreadRow[] = await Promise.all(
        Array.from(jobThreadMap.entries()).map(async ([job_id, latestMsg]) => {
          // Fetch the job for title
          const { data: jobData } = await supabase
            .from('jobs')
            .select('id, title, client_id')
            .eq('id', job_id)
            .single();

          // The "other user" is either the client (if I'm the freelancer) or receiver
          const otherUserId =
            latestMsg.sender_id === currentUser?.id ? latestMsg.receiver_id : latestMsg.sender_id;

          const { data: otherUserData } = await supabase
            .from('users')
            .select('id, full_name, email')
            .eq('id', otherUserId)
            .single();

          // Try to find matching proposal so we can pass proposalId in the URL
          const { data: proposalData } = await supabase
            .from('proposals')
            .select('id')
            .eq('job_id', job_id)
            .eq('freelancer_id', currentUser?.id === jobData?.client_id ? otherUserId : currentUser?.id)
            .maybeSingle();

          return {
            type: 'job_discussion' as const,
            job_id,
            job_title: jobData?.title || 'Unknown Job',
            proposal_id: proposalData?.id,
            otherUser: otherUserData,
            lastMessage: {
              message: latestMsg.message,
              created_at: latestMsg.created_at,
              sender_id: latestMsg.sender_id,
            },
          };
        })
      );

      // ── 3. Merge and sort by most recent message ─────────────────────────
      const all: ConversationRow[] = [
        ...enrichedDirect,
        ...enrichedJobThreads,
      ].sort((a, b) => {
        const aTime = a.lastMessage ? new Date(a.lastMessage.created_at).getTime() : 0;
        const bTime = b.lastMessage ? new Date(b.lastMessage.created_at).getTime() : 0;
        return bTime - aTime;
      });

      setConversations(all);
    } catch (err) {
      console.error('Error fetching conversations:', err);
    } finally {
      setLoading(false);
    }
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHrs / 24);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return `${diffDays}d ago`;
  };

  const handleOpen = (conv: ConversationRow) => {
    if (conv.type === 'direct') {
      navigate(`/direct-chat/${conv.id}`);
    } else {
      const base = `/chat/${conv.job_id}`;
      const query = conv.proposal_id ? `?proposalId=${conv.proposal_id}` : '';
      navigate(`${base}${query}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-2xl mx-auto px-4">
          <p className="text-center text-gray-500">Loading messages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
            <MessageCircle className="w-6 h-6 text-blue-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-blue-950">My Messages</h1>
            <p className="text-gray-500 text-sm">
              {conversations.length > 0
                ? `${conversations.length} active conversation${conversations.length > 1 ? 's' : ''}`
                : 'No conversations yet'}
            </p>
          </div>
        </div>

        {conversations.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <MessageCircle className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">No messages yet</p>
            <p className="text-gray-400 text-sm mt-1">
              Conversations from job discussions and direct messages will appear here.
            </p>
            <button
              onClick={() => navigate('/browse-freelancers')}
              className="mt-4 px-5 py-2.5 bg-blue-950 text-white rounded-lg font-semibold text-sm hover:bg-blue-900 transition-colors"
            >
              Browse Freelancers
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {conversations.map((conv) => {
              const isJobThread = conv.type === 'job_discussion';
              const key = isJobThread ? `job-${conv.job_id}` : conv.id;

              return (
                <div
                  key={key}
                  onClick={() => handleOpen(conv)}
                  className="bg-white rounded-xl shadow-sm p-5 border border-gray-100 hover:shadow-md cursor-pointer transition-all hover:border-blue-100"
                >
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div
                      className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${
                        isJobThread
                          ? 'bg-gradient-to-br from-amber-100 to-amber-200'
                          : 'bg-gradient-to-br from-blue-100 to-blue-200'
                      }`}
                    >
                      <span
                        className={`font-bold ${isJobThread ? 'text-amber-700' : 'text-blue-700'}`}
                      >
                        {conv.otherUser?.full_name?.charAt(0) || '?'}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <p className="font-semibold text-gray-900 truncate">
                          {conv.otherUser?.full_name}
                        </p>
                        {conv.lastMessage && (
                          <div className="flex items-center gap-1 text-gray-400 text-xs flex-shrink-0 ml-2">
                            <Clock className="w-3 h-3" />
                            <span>{getTimeAgo(conv.lastMessage.created_at)}</span>
                          </div>
                        )}
                      </div>

                      {/* Context label */}
                      {isJobThread ? (
                        <p className="text-xs text-amber-600 font-medium mb-1 truncate flex items-center gap-1">
                          <Briefcase className="w-3 h-3 inline-block" />
                          Re: {conv.job_title}
                        </p>
                      ) : conv.type === 'direct' && conv.chatRequest ? (
                        <p className="text-xs text-blue-600 font-medium mb-1 truncate">
                          Re: {conv.chatRequest.job_title} · ₦{conv.chatRequest.budget.toLocaleString()}
                        </p>
                      ) : null}

                      <p className="text-sm text-gray-500 truncate">
                        {conv.lastMessage
                          ? conv.lastMessage.sender_id === currentUser?.id
                            ? `You: ${conv.lastMessage.message}`
                            : conv.lastMessage.message
                          : 'No messages yet — say hello!'}
                      </p>
                    </div>

                    <ExternalLink className="w-4 h-4 text-gray-300 flex-shrink-0 mt-1" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
