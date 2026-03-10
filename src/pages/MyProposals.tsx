import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, DollarSign, MessageSquare, MessageCircle } from 'lucide-react';
import { supabase, Proposal, Job } from '../lib/supabase';
import { useStore } from '../store/useStore';

interface ProposalWithJob extends Proposal {
  job: Job;
  hasDiscussion: boolean;
}

export default function MyProposals() {
  const navigate = useNavigate();
  const currentUser = useStore((state) => state.currentUser);
  const [proposals, setProposals] = useState<ProposalWithJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUser) {
      fetchMyProposals();
    }
  }, [currentUser]);

  const fetchMyProposals = async () => {
    try {
      const { data: proposalsData, error } = await supabase
        .from('proposals')
        .select('*')
        .eq('freelancer_id', currentUser?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (proposalsData) {
        const proposalsWithJobs = await Promise.all(
          proposalsData.map(async (proposal) => {
            const { data: jobData } = await supabase
              .from('jobs')
              .select('*')
              .eq('id', proposal.job_id)
              .single();

            // Check if the client has already messaged this freelancer about this job
            const { data: msgs } = await supabase
              .from('messages')
              .select('id')
              .eq('job_id', proposal.job_id)
              .or(`sender_id.eq.${currentUser!.id},receiver_id.eq.${currentUser!.id}`)
              .limit(1);

            const hasDiscussion = (msgs?.length ?? 0) > 0;

            return { ...proposal, job: jobData, hasDiscussion };
          })
        );

        setProposals(proposalsWithJobs);
      }
    } catch (err) {
      console.error('Error fetching proposals:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4">
          <p className="text-center text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-blue-950">My Proposals</h1>
          <button
            onClick={() => navigate('/find-work')}
            className="bg-blue-950 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-900 transition-colors"
          >
            Find More Work
          </button>
        </div>

        {proposals.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No proposals yet</h2>
            <p className="text-gray-600 mb-6">Start applying to jobs and grow your freelance career</p>
            <button
              onClick={() => navigate('/find-work')}
              className="bg-blue-950 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-900 transition-colors"
            >
              Browse Available Jobs
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {proposals.map((proposal) => (
              <div
                key={proposal.id}
                className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <h2 className="text-xl font-bold text-blue-950">{proposal.job.title}</h2>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        proposal.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                        proposal.status === 'accepted' ? 'bg-green-100 text-green-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {proposal.status === 'pending' ? 'Pending' :
                         proposal.status === 'accepted' ? 'Accepted' : 'Rejected'}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        proposal.job.status === 'open' ? 'bg-green-100 text-green-700' :
                        proposal.job.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        Job: {proposal.job.status}
                      </span>
                      {/* Discussion badge — shown when client has opened a chat before hiring */}
                      {proposal.hasDiscussion && proposal.status === 'pending' && (
                        <span className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 animate-pulse">
                          <MessageCircle className="w-3 h-3" />
                          Client wants to discuss
                        </span>
                      )}
                    </div>
                    <p className="text-gray-600 mb-3 line-clamp-2">{proposal.cover_letter}</p>
                  </div>
                  <div className="ml-4 flex items-center gap-2 text-green-600 font-bold text-lg">
                    <DollarSign className="w-5 h-5" />
                    <span>₦{proposal.proposed_amount.toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => navigate(`/job/${proposal.job_id}`)}
                    className="flex-1 bg-blue-950 text-white py-2 rounded-lg font-semibold hover:bg-blue-900 transition-colors"
                  >
                    View Job
                  </button>

                  {/* Discussion started by client — freelancer can jump in */}
                  {proposal.hasDiscussion && proposal.status === 'pending' && (
                    <button
                      onClick={() =>
                        navigate(`/chat/${proposal.job_id}?proposalId=${proposal.id}&freelancerId=${proposal.freelancer_id}`)
                      }
                      className="flex items-center gap-2 bg-amber-500 text-white px-6 py-2 rounded-lg font-semibold hover:bg-amber-600 transition-colors"
                    >
                      <MessageCircle className="w-4 h-4" />
                      Open Discussion
                    </button>
                  )}

                  {/* Post-hire chat */}
                  {proposal.status === 'accepted' && proposal.job.status === 'in_progress' && (
                    <button
                      onClick={() => navigate(`/chat/${proposal.job_id}`)}
                      className="flex items-center gap-2 bg-blue-100 text-blue-950 px-6 py-2 rounded-lg font-semibold hover:bg-blue-200 transition-colors"
                    >
                      <MessageSquare className="w-4 h-4" />
                      Chat with Client
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
