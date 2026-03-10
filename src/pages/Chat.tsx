import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Send, ArrowLeft, CheckCircle, ShieldCheck, AlertCircle, Edit3, X } from 'lucide-react';
import { supabase, Job, User, Message, Hire, Proposal } from '../lib/supabase';
import { useStore } from '../store/useStore';

export default function Chat() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentUser, setWallet, viewMode } = useStore();

  // Proposal ID passed in URL when entering discussion mode from JobDetails
  const proposalId = searchParams.get('proposalId');
  const proposalFreelancerId = searchParams.get('freelancerId');

  const [job, setJob] = useState<Job | null>(null);
  const [otherUser, setOtherUser] = useState<User | null>(null);
  const [hire, setHire] = useState<Hire | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [hiringInProgress, setHiringInProgress] = useState(false);

  // Freelancer: offer editing state
  const [editingOffer, setEditingOffer] = useState(false);
  const [newOfferAmount, setNewOfferAmount] = useState('');
  const [savingOffer, setSavingOffer] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (jobId && currentUser) {
      fetchChatData();
      // Poll messages AND live proposal amount every 2s
      const interval = setInterval(() => {
        fetchMessages();
        if (proposalId) fetchProposal();
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [jobId, currentUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchChatData = async () => {
    try {
      const { data: jobData } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (!jobData) return;
      setJob(jobData);

      // Load hire if it exists (may not yet in discussion phase)
      const { data: hireData } = await supabase
        .from('hires')
        .select('*')
        .eq('job_id', jobId)
        .maybeSingle();

      setHire(hireData);

      // ── Role-mode guard ──
      // A dual-role user switching to Client mode must NOT see a job
      // where they are the freelancer (and vice versa).
      const userIsActualClient = jobData.client_id === currentUser?.id;
      const userIsActualFreelancer =
        hireData?.freelancer_id === currentUser?.id ||
        proposalFreelancerId === currentUser?.id;

      if (viewMode === 'buying' && !userIsActualClient && userIsActualFreelancer) {
        // They are in Client mode but this is their freelancer job — redirect
        navigate(-1);
        return;
      }
      if (viewMode === 'selling' && !userIsActualFreelancer && userIsActualClient) {
        // They are in Freelancer mode but this is their own posted job — let them through
        // (Job owners can always see their own job chat from the client side)
      }

      // Load the proposal live (amount may change during discussion)
      if (proposalId) await fetchProposal();

      // Determine the other user
      let otherUserId: string | null = null;
      if (userIsActualClient) {
        otherUserId = hireData?.freelancer_id || proposalFreelancerId || null;
      } else {
        otherUserId = jobData.client_id;
      }

      if (otherUserId) {
        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', otherUserId)
          .single();
        setOtherUser(userData);
      }

      await fetchMessages();
    } catch (err) {
      console.error('Error fetching chat data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProposal = async () => {
    if (!proposalId) return;
    const { data } = await supabase
      .from('proposals')
      .select('*')
      .eq('id', proposalId)
      .single();
    if (data) {
      setProposal(data);
      // Keep the editing input in sync unless actively editing
      setNewOfferAmount((prev) => (prev === '' ? String(data.proposed_amount) : prev));
    }
  };

  const fetchMessages = async () => {
    try {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('job_id', jobId)
        .order('created_at', { ascending: true });

      if (data) setMessages(data);
    } catch (err) {
      console.error('Error fetching messages:', err);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUser || !otherUser || !job) return;

    setSending(true);
    try {
      await supabase.from('messages').insert({
        job_id: job.id,
        sender_id: currentUser.id,
        receiver_id: otherUser.id,
        message: newMessage,
      });

      setNewMessage('');
      fetchMessages();
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSending(false);
    }
  };

  const handleUpdateOffer = async () => {
    const parsed = parseFloat(newOfferAmount);
    if (!proposalId || isNaN(parsed) || parsed <= 0) {
      alert('Please enter a valid amount.');
      return;
    }

    setSavingOffer(true);
    try {
      const { error } = await supabase
        .from('proposals')
        .update({ proposed_amount: parsed })
        .eq('id', proposalId);

      if (error) throw error;

      await fetchProposal();
      setEditingOffer(false);
    } catch (err) {
      console.error('Error updating offer:', err);
      alert('Failed to update offer. Please try again.');
    } finally {
      setSavingOffer(false);
    }
  };

  const handleConfirmHire = async () => {
    if (!currentUser || !job || !proposal) return;

    const amount = proposal.proposed_amount;
    const freelancerId = proposal.freelancer_id;

    const confirmed = confirm(
      `Confirm hire and lock ₦${amount.toLocaleString()} in escrow?\n\nFunds will be released to the freelancer once you mark the job complete.`
    );
    if (!confirmed) return;

    setHiringInProgress(true);
    try {
      // 1. Fetch client wallet
      const { data: wallet, error: walletError } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', currentUser.id)
        .single();

      if (walletError || !wallet) {
        alert('Could not access your wallet. Please try again.');
        return;
      }

      // 2. Check balance
      if (wallet.available_balance < amount) {
        alert(
          `Insufficient balance. You need ₦${(amount - wallet.available_balance).toLocaleString()} more in your wallet.`
        );
        return;
      }

      // 3. Lock funds in escrow
      await supabase
        .from('wallets')
        .update({
          available_balance: wallet.available_balance - amount,
          escrow_balance: wallet.escrow_balance + amount,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', currentUser.id);

      setWallet({
        ...wallet,
        available_balance: wallet.available_balance - amount,
        escrow_balance: wallet.escrow_balance + amount,
        updated_at: new Date().toISOString(),
      });

      // 4. Record transaction
      await supabase.from('transactions').insert({
        user_id: currentUser.id,
        amount,
        type: 'escrow_lock',
        job_id: job.id,
        description: `Funds locked in escrow for job: "${job.title}"`,
      });

      // 5. Create hire record
      await supabase.from('hires').insert({
        job_id: job.id,
        freelancer_id: freelancerId,
        escrow_amount: amount,
        status: 'funded',
      });

      // 6. Update job status
      await supabase.from('jobs').update({ status: 'in_progress' }).eq('id', job.id);

      // 7. Accept this proposal, reject others
      await supabase.from('proposals').update({ status: 'accepted' }).eq('id', proposal.id);
      await supabase
        .from('proposals')
        .update({ status: 'rejected' })
        .eq('job_id', job.id)
        .neq('id', proposal.id);

      await fetchChatData();
      alert('Hire confirmed! Funds are now locked in escrow.');
    } catch (err) {
      console.error('Error confirming hire:', err);
      alert('An error occurred. Please try again.');
    } finally {
      setHiringInProgress(false);
    }
  };

  const handleCompleteJob = async () => {
    if (!job || !hire || !currentUser) return;

    const confirmed = confirm('Mark this job as completed and release escrow funds to the freelancer?');
    if (!confirmed) return;

    try {
      await supabase.from('jobs').update({ status: 'completed' }).eq('id', job.id);
      await supabase
        .from('hires')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', hire.id);

      const { data: clientWallet } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', currentUser.id)
        .single();

      if (clientWallet) {
        await supabase
          .from('wallets')
          .update({
            escrow_balance: Math.max(0, clientWallet.escrow_balance - hire.escrow_amount),
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', currentUser.id);

        setWallet({
          ...clientWallet,
          escrow_balance: Math.max(0, clientWallet.escrow_balance - hire.escrow_amount),
          updated_at: new Date().toISOString(),
        });

        await supabase.from('transactions').insert({
          user_id: currentUser.id,
          amount: hire.escrow_amount,
          type: 'escrow_release',
          job_id: job.id,
          description: `Funds released from escrow for "${job.title}"`,
        });
      }

      const { data: freelancerWallet } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', hire.freelancer_id)
        .single();

      if (freelancerWallet) {
        await supabase
          .from('wallets')
          .update({
            available_balance: freelancerWallet.available_balance + hire.escrow_amount,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', hire.freelancer_id);

        await supabase.from('transactions').insert({
          user_id: hire.freelancer_id,
          amount: hire.escrow_amount,
          type: 'escrow_release',
          job_id: job.id,
          description: `Payment received for "${job.title}"`,
        });
      }

      alert('Job completed! Funds have been released to the freelancer.');
      navigate('/my-hires');
    } catch (err) {
      console.error('Error completing job:', err);
      alert('Failed to complete job. Please check your connection.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <p className="text-center text-gray-600">Loading chat...</p>
        </div>
      </div>
    );
  }

  const isClient = currentUser?.id === job?.client_id;
  const isFreelancer = !isClient;
  const isDiscussionPhase = !hire && job?.status === 'open' && !!proposalId && !!proposal;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">

          {/* Header */}
          <div className="bg-blue-950 text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => navigate(-1)} className="hover:opacity-80">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h2 className="font-bold">{job?.title}</h2>
                <p className="text-sm text-blue-200">
                  {hire ? `Chat with ${otherUser?.full_name}` : `Discussing with ${otherUser?.full_name}`}
                </p>
              </div>
            </div>
            {isClient && job?.status === 'in_progress' && hire && (
              <button
                onClick={handleCompleteJob}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm font-medium">Complete Job</span>
              </button>
            )}
          </div>

          {/* ── DISCUSSION PHASE BANNER ── */}
          {isDiscussionPhase && (
            <div className="border-b">
              {/* Client side: see live offer + confirm hire */}
              {isClient && (
                <div className="bg-amber-50 border-b border-amber-200 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-amber-900">Discussion in Progress</p>
                        <p className="text-sm text-amber-700 mt-0.5">
                          Current offer from {otherUser?.full_name?.split(' ')[0]}:{' '}
                          <span className="font-bold text-amber-900">
                            ₦{proposal.proposed_amount.toLocaleString()}
                          </span>
                          <span className="text-xs ml-1 text-amber-600">(updates live)</span>
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleConfirmHire}
                      disabled={hiringInProgress}
                      className="flex items-center gap-2 bg-blue-950 hover:bg-blue-900 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 whitespace-nowrap flex-shrink-0"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      {hiringInProgress ? 'Processing...' : 'Confirm Hire & Fund Escrow'}
                    </button>
                  </div>
                </div>
              )}

              {/* Freelancer side: see & update their offer */}
              {isFreelancer && (
                <div className="bg-blue-50 border-b border-blue-100 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <ShieldCheck className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-blue-900">Your Current Offer</p>
                        {!editingOffer ? (
                          <p className="text-sm text-blue-700 mt-0.5">
                            <span className="font-bold text-blue-900">
                              ₦{proposal.proposed_amount.toLocaleString()}
                            </span>
                            <span className="text-xs ml-1 text-blue-500">— client sees this live</span>
                          </p>
                        ) : (
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm text-blue-700">₦</span>
                            <input
                              type="number"
                              value={newOfferAmount}
                              onChange={(e) => setNewOfferAmount(e.target.value)}
                              className="w-28 px-2 py-1 text-sm border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              min="1"
                              autoFocus
                            />
                            <button
                              onClick={handleUpdateOffer}
                              disabled={savingOffer}
                              className="px-3 py-1 bg-blue-950 text-white text-xs rounded-md font-semibold hover:bg-blue-900 disabled:opacity-50"
                            >
                              {savingOffer ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={() => {
                                setEditingOffer(false);
                                setNewOfferAmount(String(proposal.proposed_amount));
                              }}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    {!editingOffer && (
                      <button
                        onClick={() => {
                          setNewOfferAmount(String(proposal.proposed_amount));
                          setEditingOffer(true);
                        }}
                        className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Update Offer
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── POST-HIRE ESCROW BANNER ── */}
          {hire && (
            <div className="bg-blue-50 border-b border-blue-100 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-blue-900">
                  <span className="font-semibold">Escrow Amount:</span> ₦{hire.escrow_amount.toLocaleString()}
                </span>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    hire.status === 'funded'
                      ? 'bg-blue-100 text-blue-700'
                      : hire.status === 'completed'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {hire.status === 'funded' ? 'Escrow Funded' : hire.status === 'completed' ? 'Completed' : hire.status}
                </span>
              </div>
            </div>
          )}

          {/* ── MESSAGES ── */}
          <div className="h-96 overflow-y-auto p-6 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <p className="font-medium mb-1">Start the conversation!</p>
                <p className="text-sm text-gray-400">
                  {isDiscussionPhase
                    ? isClient
                      ? 'Ask questions before confirming the hire.'
                      : 'The client may ask questions. You can update your offer above anytime.'
                    : 'No messages yet.'}
                </p>
              </div>
            ) : (
              messages.map((message) => {
                const isOwnMessage = message.sender_id === currentUser?.id;
                return (
                  <div key={message.id} className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl ${
                        isOwnMessage
                          ? 'bg-blue-950 text-white rounded-br-none'
                          : 'bg-gray-200 text-gray-900 rounded-bl-none'
                      }`}
                    >
                      <p className="text-sm">{message.message}</p>
                      <p className={`text-xs mt-1 ${isOwnMessage ? 'text-blue-200' : 'text-gray-500'}`}>
                        {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* ── INPUT ── */}
          <form onSubmit={handleSendMessage} className="border-t border-gray-200 p-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-950"
              />
              <button
                type="submit"
                disabled={sending || !newMessage.trim()}
                className="bg-blue-950 text-white px-6 py-3 rounded-lg hover:bg-blue-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
