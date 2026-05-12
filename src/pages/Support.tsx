import { useState, useEffect } from 'react';
import { Send, LifeBuoy, AlertCircle, Clock } from 'lucide-react';
import { useToast } from '../lib/toast';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';

interface Ticket {
  id: string;
  subject: string;
  message: string;
  status: 'open' | 'resolved';
  admin_reply: string | null;
  created_at: string;
}

export default function Support() {
  const { toast } = useToast();
  const { currentUser } = useStore();
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('general');
  const [submitting, setSubmitting] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);

  useEffect(() => {
    if (currentUser) fetchTickets();
  }, [currentUser]);

  const fetchTickets = async () => {
    const { data } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('user_id', currentUser?.id)
      .order('created_at', { ascending: false });
    
    if (data) setTickets(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedSubject = subject.trim();
    const trimmedDesc    = description.trim();

    if (trimmedSubject.length < 10) {
      toast.warning('Subject must be at least 10 characters. Be specific about your issue.');
      return;
    }
    if (trimmedDesc.length < 30) {
      toast.warning('Please describe your issue in at least 30 characters so we can help you faster.');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('support_tickets').insert({
        user_id: currentUser?.id,
        subject: `[${category.toUpperCase()}] ${trimmedSubject}`,
        message: trimmedDesc,
        status: 'open'
      });

      if (error) throw error;

      toast.success('Your support ticket has been created.', 'Ticket Submitted');
      setSubject('');
      setDescription('');
      fetchTickets();
    } catch (err) {
      toast.error('Failed to create ticket. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const categories = [
    { id: 'payments', name: 'Payments & Wallet', description: 'Issues with deposits, escrow or withdrawals' },
    { id: 'account', name: 'Account & Security', description: 'Login issues, password resets or profile help' },
    { id: 'jobs', name: 'Jobs & Proposals', description: 'Help with posting, applying or completing work' },
    { id: 'general', name: 'General Inquiry', description: 'Everything else not covered above' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-12 flex flex-col">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
            <LifeBuoy className="w-6 h-6 text-blue-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-blue-950">Help & Support</h1>
            <p className="text-gray-500 text-sm">Create a ticket and our team will get back to you within 24 hours.</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Form */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-8 border-b border-gray-50 bg-gray-50/50">
                <h2 className="text-lg font-bold text-gray-900">Create Support Ticket</h2>
              </div>
              
              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-3">What do you need help with?</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setCategory(cat.id)}
                        className={`p-4 text-left rounded-2xl border-2 transition-all ${
                          category === cat.id 
                            ? 'border-blue-600 bg-blue-50/50 shadow-sm' 
                            : 'border-gray-100 hover:border-gray-200 bg-white'
                        }`}
                      >
                        <p className={`text-sm font-bold mb-1 ${category === cat.id ? 'text-blue-700' : 'text-gray-900'}`}>
                          {cat.name}
                        </p>
                        <p className="text-[10px] text-gray-500 leading-tight">{cat.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-end mb-2">
                    <label className="block text-sm font-bold text-gray-700">Subject</label>
                    <span className={`text-[10px] font-medium ${subject.length < 10 ? 'text-amber-500' : 'text-gray-400'}`}>
                      {subject.length} / 120 chars (min 10)
                    </span>
                  </div>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value.slice(0, 120))}
                    placeholder="e.g., Cannot withdraw my earnings — page shows an error"
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-blue-600 transition-all text-sm"
                    required
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Use a clear, specific subject so we can route your ticket correctly.</p>
                </div>

                <div>
                  <div className="flex justify-between items-end mb-2">
                    <label className="block text-sm font-bold text-gray-700">Description</label>
                    <span className={`text-[10px] font-medium ${description.length < 30 ? 'text-amber-500' : 'text-gray-400'}`}>
                      {description.length} / 2000 chars (min 30)
                    </span>
                  </div>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value.slice(0, 2000))}
                    placeholder="Describe the issue step by step: what you were doing, what happened, and what you expected to happen..."
                    rows={6}
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-blue-600 transition-all resize-none text-sm"
                    required
                  />
                  <p className="text-[10px] text-gray-400 mt-1">The more detail you provide, the faster we can resolve your issue. Include any error messages you see.</p>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-4 rounded-2xl font-bold text-white shadow-lg hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                  style={{ backgroundColor: '#0E0E52' }}
                >
                  {submitting ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Submit Support Ticket
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Ticket History */}
            {tickets.length > 0 && (
              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-8 border-b border-gray-50 bg-gray-50/50">
                  <h2 className="text-lg font-bold text-gray-900">Your Tickets</h2>
                </div>
                <div className="p-8 space-y-6">
                  {tickets.map(ticket => (
                    <div key={ticket.id} className="border border-gray-100 rounded-2xl p-6 bg-white shadow-sm">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="font-bold text-gray-900">{ticket.subject}</h3>
                          <span className="text-xs text-gray-500">{new Date(ticket.created_at).toLocaleDateString()}</span>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${ticket.status === 'open' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                          {ticket.status === 'open' ? 'In Progress' : 'Resolved'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-4 bg-gray-50 p-4 rounded-xl">{ticket.message}</p>
                      
                      {ticket.admin_reply && (
                        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                          <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider mb-2 flex items-center gap-1"><LifeBuoy className="w-3 h-3"/> Support Response</h4>
                          <p className="text-sm text-blue-800 whitespace-pre-wrap">{ticket.admin_reply}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
 
          {/* Sidebar Info */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                Quick Tips
              </h3>
              <ul className="space-y-3 text-sm text-gray-600">
                <li className="flex gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  Check our Help Center for instant answers.
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  Include transaction IDs for payment issues.
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  Screenshots help us solve issues faster.
                </li>
              </ul>
            </div>

            <div className="p-6 rounded-2xl text-white shadow-lg" style={{ backgroundColor: '#0E0E52' }}>
              <Clock className="w-8 h-8 text-blue-300 mb-4" />
              <h3 className="font-bold text-lg mb-2">Response Time</h3>
              <p className="text-sm text-blue-100 opacity-80 leading-relaxed">
                Our support team is active from Monday to Friday, 9am - 6pm. We typically respond to all tickets within <span className="font-bold text-white">24 hours</span>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
