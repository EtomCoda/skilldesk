import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Headset, ArrowLeft, Send, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useStore } from '../../store/useStore';
import { notify } from '../../lib/notifications';
import { QK } from '../../lib/queryKeys';
import { fetchAdminTickets } from '../../lib/queries';

interface Ticket {
  id: string; user_id: string; subject: string; message: string;
  status: 'open' | 'resolved'; admin_reply: string | null;
  created_at: string; resolved_at: string | null;
  user?: { full_name: string; email: string };
}

export default function AdminSupport() {
  const navigate    = useNavigate();
  const currentUser = useStore((s) => s.currentUser);
  const qc          = useQueryClient();
  const [replyingTo,  setReplyingTo]  = useState<string | null>(null);
  const [replyText,   setReplyText]   = useState('');
  const [submitting,  setSubmitting]  = useState(false);

  const { data: tickets = [], isLoading } = useQuery<Ticket[]>({
    queryKey: QK.adminTickets(),
    queryFn:  fetchAdminTickets,
    enabled:  !!currentUser?.is_admin,
    staleTime: 30 * 1000, // support tickets: fresher (30s)
    refetchInterval: 60 * 1000, // auto-refresh every minute
  });

  if (!currentUser?.is_admin) { navigate('/'); return null; }

  const openTickets     = tickets.filter((t) => t.status === 'open');
  const resolvedTickets = tickets.filter((t) => t.status === 'resolved');

  const handleReply = async (ticket: Ticket) => {
    if (!replyText.trim()) return;
    setSubmitting(true);
    try {
      await supabase.from('support_tickets').update({
        admin_reply: replyText, status: 'resolved',
        resolved_at: new Date().toISOString(),
      }).eq('id', ticket.id);

      await notify([{
        user_id: ticket.user_id, type: 'support_reply',
        title: 'Support Ticket Updated',
        body: `An admin has replied to your ticket: "${ticket.subject}"`,
      }]);

      setReplyText('');
      setReplyingTo(null);
      qc.invalidateQueries({ queryKey: QK.adminTickets() });
    } catch (err) {
      console.error(err);
      alert('Failed to send reply');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => navigate('/admin')} className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
            <Headset className="w-5 h-5 text-blue-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Support Inbox</h1>
            <p className="text-sm text-gray-500">{openTickets.length} open tickets</p>
          </div>
        </div>

        {isLoading ? (
          <p className="text-center text-gray-400 py-20">Loading tickets...</p>
        ) : (
          <div className="space-y-8">
            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                Needs Attention
                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-bold">{openTickets.length}</span>
              </h2>
              {openTickets.length === 0 ? (
                <div className="bg-white rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-500">
                  No open support tickets. You're all caught up!
                </div>
              ) : (
                <div className="space-y-4">
                  {openTickets.map((ticket) => (
                    <div key={ticket.id} className="bg-white rounded-xl shadow-sm border border-blue-100 overflow-hidden">
                      <div className="p-5">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-bold text-gray-900">{ticket.subject}</h3>
                          <span className="text-xs text-gray-400">{new Date(ticket.created_at).toLocaleDateString()}</span>
                        </div>
                        <p className="text-sm text-gray-500 mb-4">
                          From: <span className="font-medium text-gray-700">{ticket.user?.full_name}</span> ({ticket.user?.email})
                        </p>
                        <div className="bg-gray-50 p-4 rounded-lg text-gray-700 text-sm whitespace-pre-wrap mb-4">{ticket.message}</div>
                        {replyingTo === ticket.id ? (
                          <div className="mt-4">
                            <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)}
                              placeholder="Write your response..."
                              className="w-full px-4 py-3 border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white shadow-sm mb-2"
                              rows={4} />
                            <div className="flex justify-end gap-2">
                              <button onClick={() => { setReplyingTo(null); setReplyText(''); }}
                                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg font-medium">
                                Cancel
                              </button>
                              <button onClick={() => handleReply(ticket)} disabled={submitting || !replyText.trim()}
                                className="px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-medium flex items-center gap-1.5 disabled:opacity-50">
                                <Send className="w-4 h-4" /> Send &amp; Resolve
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => setReplyingTo(ticket.id)}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1">
                            Reply to user
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {resolvedTickets.length > 0 && (
              <section>
                <h2 className="text-lg font-bold text-gray-900 mb-4">Recently Resolved</h2>
                <div className="space-y-4 opacity-75">
                  {resolvedTickets.map((ticket) => (
                    <div key={ticket.id} className="bg-white rounded-xl border border-gray-100 p-5">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-blue-500" />
                          <h3 className="font-bold text-gray-900 line-through decoration-gray-300">{ticket.subject}</h3>
                        </div>
                        <span className="text-xs text-gray-400">{new Date(ticket.resolved_at!).toLocaleDateString()}</span>
                      </div>
                      <p className="text-sm text-gray-500 mb-3">From: <span className="font-medium text-gray-700">{ticket.user?.full_name}</span></p>
                      <div className="bg-gray-50 p-3 rounded-lg text-sm mb-3">
                        <span className="font-semibold text-gray-700 text-xs uppercase mb-1 block">User Message:</span>
                        {ticket.message}
                      </div>
                      <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-900">
                        <span className="font-semibold text-blue-700 text-xs uppercase mb-1 block">Admin Reply:</span>
                        {ticket.admin_reply}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
