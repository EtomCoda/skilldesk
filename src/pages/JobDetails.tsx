import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {User, MessageSquare, CheckCircle, Clock, MessageCircle } from 'lucide-react';
import { supabase, Job, User as UserType, Proposal, Hire } from '../lib/supabase';
import { useStore } from '../store/useStore';

interface ProposalWithFreelancer extends Proposal {
  freelancer: UserType;
}

export default function JobDetails() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useStore();
  const [job, setJob] = useState<Job | null>(null);
  const [client, setClient] = useState<UserType | null>(null);
  const [proposals, setProposals] = useState<ProposalWithFreelancer[]>([]);
  const [hire, setHire] = useState<Hire | null>(null);
  const [loading, setLoading] = useState(true);
  const [showProposalForm, setShowProposalForm] = useState(false);
  const [coverLetter, setCoverLetter] = useState('');
  const [proposedAmount, setProposedAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (jobId) {
      fetchJobDetails();
    }
  }, [jobId]);

  const fetchJobDetails = async () => {
    try {
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (jobError) throw jobError;
      setJob(jobData);

      const { data: clientData } = await supabase
        .from('users')
        .select('*')
        .eq('id', jobData.client_id)
        .single();

      setClient(clientData);

      const { data: proposalsData } = await supabase
        .from('proposals')
        .select('*')
        .eq('job_id', jobId);

      if (proposalsData) {
        const proposalsWithFreelancers = await Promise.all(
          proposalsData.map(async (proposal) => {
            const { data: freelancerData } = await supabase
              .from('users')
              .select('*')
              .eq('id', proposal.freelancer_id)
              .single();

            return { ...proposal, freelancer: freelancerData };
          })
        );

        setProposals(proposalsWithFreelancers);
      }

      const { data: hireData } = await supabase
        .from('hires')
        .select('*')
        .eq('job_id', jobId)
        .maybeSingle();

      setHire(hireData);
    } catch (err) {
      console.error('Error fetching job details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !job) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('proposals')
        .insert({
          job_id: job.id,
          freelancer_id: currentUser.id,
          cover_letter: coverLetter,
          proposed_amount: parseFloat(proposedAmount),
          status: 'pending',
        });

      if (error) throw error;

      setShowProposalForm(false);
      fetchJobDetails();
    } catch (err) {
      console.error('Error submitting proposal:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Hire logic moved to Chat.tsx — triggered after discussion

  const isJobOwner = currentUser?.id === job?.client_id;
  const hasApplied = proposals.some((p) => p.freelancer_id === currentUser?.id);

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHrs / 24);

    if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHrs < 24) return `${diffHrs} hour${diffHrs !== 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-gray-600">Job not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm p-8 mb-6">
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h1 className="text-3xl font-bold text-blue-950">{job.title}</h1>
                  <span className={`px-4 py-2 rounded-full text-sm font-medium ${
                    job.status === 'open' ? 'bg-green-100 text-green-700' :
                    job.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {job.status === 'open' ? 'Open' : job.status === 'in_progress' ? 'In Progress' : 'Completed'}
                  </span>
                </div>

                <div className="flex items-center gap-6 text-sm text-gray-600 mb-4">
                  <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-md">
                    <Clock className="w-4 h-4" />
                    <span className="font-medium">Posted {getTimeAgo(job.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    <Link 
                      to={`/client/${job.client_id}`}
                      className="hover:text-blue-600 hover:underline transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-sm"
                      title="View Client Profile"
                    >
                      {client?.full_name}
                    </Link>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-2xl font-bold text-green-600 mb-6">
                  <span>
                    {job.min_budget && job.max_budget 
                      ? job.min_budget === job.max_budget 
                        ? `₦${job.min_budget.toLocaleString()}`
                        : `₦${job.min_budget.toLocaleString()} - ₦${job.max_budget.toLocaleString()}`
                      : `₦${job.budget.toLocaleString()}`}
                  </span>
                </div>
              </div>

              {job.required_skills && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Required Skills</h3>
                  <div className="flex flex-wrap gap-2">
                    {job.required_skills.split(',').map((skill, index) => (
                      <span
                        key={index}
                        className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg border border-gray-200"
                      >
                        {skill.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="prose max-w-none">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Job Description</h3>
                <p className="text-gray-700 whitespace-pre-wrap">{job.description}</p>
              </div>

              {!isJobOwner && !hasApplied && job.status === 'open' && !showProposalForm && (
                <button
                  onClick={() => setShowProposalForm(true)}
                  className="mt-6 w-full bg-blue-950 text-white py-3 rounded-lg font-semibold hover:bg-blue-900 transition-colors"
                >
                  Apply for This Job
                </button>
              )}

              {!isJobOwner && hasApplied && (
                <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-2 text-green-700">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">You have already applied for this job</span>
                </div>
              )}

              {hire && (
                <button
                  onClick={() => navigate(`/messages?autoJobId=${job.id}`)}
                  className="mt-6 w-full bg-blue-950 text-white py-3 rounded-lg font-semibold hover:bg-blue-900 transition-colors flex items-center justify-center gap-2"
                >
                  <MessageSquare className="w-5 h-5" />
                  Open Chat
                </button>
              )}
            </div>

            {showProposalForm && (
              <div className="bg-white rounded-xl shadow-sm p-8">
                <h2 className="text-xl font-bold text-blue-950 mb-4">Submit Your Proposal</h2>
                <form onSubmit={handleSubmitProposal} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Your Proposed Amount (₦)
                    </label>
                    <input
                      type="number"
                      value={proposedAmount}
                      onChange={(e) => setProposedAmount(e.target.value)}
                      placeholder={job.budget.toString()}
                      min="0"
                      step="100"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-950"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Cover Letter
                    </label>
                    <textarea
                      value={coverLetter}
                      onChange={(e) => setCoverLetter(e.target.value)}
                      placeholder="Explain why you're the best fit for this job..."
                      rows={6}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-950"
                      required
                    />
                  </div>

                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => setShowProposalForm(false)}
                      className="flex-1 px-6 py-3 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 px-6 py-3 bg-blue-950 text-white rounded-lg font-semibold hover:bg-blue-900 disabled:opacity-50"
                    >
                      {submitting ? 'Submitting...' : 'Submit Proposal'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-bold text-blue-950 mb-4">
                Proposals ({proposals.length})
              </h2>

              {proposals.length === 0 ? (
                <p className="text-gray-600 text-sm">No proposals yet</p>
              ) : isJobOwner ? (
                <div className="space-y-4">
                  {proposals.map((proposal) => (
                    <div key={proposal.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-gray-900">
                          {proposal.freelancer.full_name}
                        </span>
                        <span className="text-green-600 font-bold">
                          ₦{proposal.proposed_amount.toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-3 line-clamp-3">
                        {proposal.cover_letter}
                      </p>

                      {job.status === 'open' && !hire && (
                        <button
                          onClick={() =>
                            navigate(
                              `/messages?autoJobId=${job.id}&proposalId=${proposal.id}&freelancerId=${proposal.freelancer_id}&amount=${proposal.proposed_amount}`
                            )
                          }
                          className="w-full flex items-center justify-center gap-2 bg-blue-950 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-900 transition-colors"
                        >
                          <MessageCircle className="w-4 h-4" />
                          Open Discussion
                        </button>
                      )}

                      {proposal.status === 'accepted' && (
                        <button
                          onClick={() => navigate(`/messages?autoJobId=${job.id}`)}
                          className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors"
                        >
                          <MessageCircle className="w-4 h-4" />
                          Continue Chat
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-center">
                  <p className="text-blue-900 font-medium">
                    This job has received {proposals.length} proposal{proposals.length !== 1 ? 's' : ''}.
                  </p>
                  <p className="text-sm text-blue-700 mt-1">
                    Submit yours to stand out!
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
