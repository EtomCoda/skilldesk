import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, Check, X, Clock, Briefcase, DollarSign, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';

interface ChatRequest {
  id: string;
  buyer_id: string;
  seller_id: string;
  job_title: string;
  budget: number;
  description: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  buyer: {
    id: string;
    full_name: string;
    email: string;
    avatar_url?: string;
  };
}

export default function ChatRequests() {
  const navigate = useNavigate();
  const currentUser = useStore((state) => state.currentUser);
  const [requests, setRequests] = useState<ChatRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'accepted' | 'declined'>('pending');
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser) {
      fetchRequests();
    }
  }, [currentUser]);

  const fetchRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_requests')
        .select('*, buyer:buyer_id(id, full_name, email, avatar_url)')
        .eq('seller_id', currentUser?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests((data as ChatRequest[]) || []);
    } catch (err) {
      console.error('Error fetching chat requests:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (requestId: string, request: ChatRequest, newStatus: 'accepted' | 'declined') => {
    setProcessing(requestId);
    try {
      const { error } = await supabase
        .from('chat_requests')
        .update({ status: newStatus })
        .eq('id', requestId);

      if (error) throw error;

      if (newStatus === 'accepted') {
        // Create or retrieve direct conversation between buyer and seller
        // participant_a = buyer, participant_b = seller (current user)
        const { data: existingConv } = await supabase
          .from('direct_conversations')
          .select('id')
          .eq('participant_a', request.buyer_id)
          .eq('participant_b', currentUser!.id)
          .maybeSingle();

        let conversationId = existingConv?.id;

        if (!conversationId) {
          const { data: newConv, error: convError } = await supabase
            .from('direct_conversations')
            .insert({
              participant_a: request.buyer_id,
              participant_b: currentUser!.id,
              chat_request_id: requestId,
            })
            .select('id')
            .single();

          if (convError) throw convError;
          conversationId = newConv.id;
        }

        navigate(`/direct-chat/${conversationId}`);
      } else {
        setRequests((prev) =>
          prev.map((r) => (r.id === requestId ? { ...r, status: newStatus } : r))
        );
      }
    } catch (err) {
      console.error('Error updating chat request:', err);
      alert('Failed to update request. Please try again.');
    } finally {
      setProcessing(null);
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

  const filtered = requests.filter((r) => r.status === activeTab);
  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-3xl mx-auto px-4">
          <p className="text-center text-gray-600">Loading requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
            <MessageCircle className="w-6 h-6 text-blue-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-blue-950">Chat Requests</h1>
            <p className="text-gray-500 text-sm">
              {pendingCount > 0
                ? `${pendingCount} pending request${pendingCount > 1 ? 's' : ''} awaiting your response`
                : 'No pending requests'}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6">
          {(['pending', 'accepted', 'declined'] as const).map((tab) => {
            const count = requests.filter((r) => r.status === tab).length;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all capitalize flex items-center justify-center gap-2 ${
                  activeTab === tab
                    ? 'bg-white text-blue-950 shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                {tab}
                {count > 0 && (
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                      activeTab === tab
                        ? tab === 'pending'
                          ? 'bg-blue-100 text-blue-700'
                          : tab === 'accepted'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Request Cards */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <MessageCircle className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">No {activeTab} requests</p>
            <p className="text-gray-400 text-sm mt-1">
              {activeTab === 'pending'
                ? 'When clients send you chat requests, they will appear here.'
                : `You have no ${activeTab} requests yet.`}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((request) => (
              <div
                key={request.id}
                className="bg-white rounded-xl shadow-sm p-6 border border-gray-100"
              >
                {/* Buyer info + time */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-blue-700 font-bold text-sm">
                        {request.buyer?.full_name?.charAt(0) || '?'}
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{request.buyer?.full_name}</p>
                      <p className="text-sm text-gray-500">{request.buyer?.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-gray-400 text-xs">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{getTimeAgo(request.created_at)}</span>
                  </div>
                </div>

                {/* Job details */}
                <div className="bg-gray-50 rounded-lg p-4 mb-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span className="font-semibold text-gray-900 text-sm">{request.job_title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span className="text-green-700 font-bold text-sm">
                      ₦{request.budget.toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed mt-2">
                    {request.description}
                  </p>
                </div>

                {/* Status badge or action buttons */}
                {request.status === 'pending' ? (
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleUpdateStatus(request.id, request, 'declined')}
                      disabled={processing === request.id}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-red-200 text-red-600 rounded-lg font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                      <X className="w-4 h-4" />
                      Decline
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(request.id, request, 'accepted')}
                      disabled={processing === request.id}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-950 text-white rounded-lg font-medium hover:bg-blue-900 transition-colors disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" />
                      {processing === request.id ? 'Processing...' : 'Accept'}
                    </button>
                  </div>
                ) : request.status === 'accepted' ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded-lg">
                      <Check className="w-4 h-4" />
                      <span className="text-sm font-medium">Request Accepted</span>
                    </div>
                    <button
                      onClick={async () => {
                        const { data } = await supabase
                          .from('direct_conversations')
                          .select('id')
                          .eq('participant_a', request.buyer_id)
                          .eq('participant_b', request.seller_id)
                          .maybeSingle();
                        if (data?.id) navigate(`/direct-chat/${data.id}`);
                      }}
                      className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open Chat
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
                    <X className="w-4 h-4" />
                    <span className="text-sm font-medium">Request Declined</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
