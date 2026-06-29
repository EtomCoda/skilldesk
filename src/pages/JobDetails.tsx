import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {User, MessageSquare, CheckCircle, Clock, MessageCircle, Edit3, Trash2, X, AlertTriangle } from 'lucide-react';
import { supabase, Job, User as UserType, Proposal, Hire } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { notify } from '../lib/notifications';
import { useToast } from '../lib/toast';
import { ConfirmModal } from '../components/ConfirmModal';

interface ProposalWithFreelancer extends Proposal {
  freelancer: UserType;
}

export default function JobDetails() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useStore();
  const { toast } = useToast();
  const [job, setJob] = useState<Job | null>(null);
  const [client, setClient] = useState<UserType | null>(null);
  const [proposals, setProposals] = useState<ProposalWithFreelancer[]>([]);
  const [hire, setHire] = useState<Hire | null>(null);
  const [loading, setLoading] = useState(true);
  const [showProposalForm, setShowProposalForm] = useState(false);
  const [coverLetter, setCoverLetter] = useState('');
  const [proposedAmount, setProposedAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // Edit Job State
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    title: '',
    description: '',
    min_budget: '',
    max_budget: '',
    required_skills: ''
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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
      setEditData({
        title: jobData.title,
        description: jobData.description,
        min_budget: jobData.min_budget?.toString() || '',
        max_budget: jobData.max_budget?.toString() || '',
        required_skills: jobData.required_skills || ''
      });

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

  const handleUpdateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!job || !currentUser) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('jobs')
        .update({
          title: editData.title,
          description: editData.description,
          min_budget: parseFloat(editData.min_budget),
          max_budget: parseFloat(editData.max_budget),
          required_skills: editData.required_skills,
          budget: parseFloat(editData.min_budget) // Keep legacy budget in sync
        })
        .eq('id', job.id);

      if (error) throw error;

      toast.success('Job details updated successfully.');
      setIsEditing(false);
      fetchJobDetails();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update job');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteJob = async () => {
    if (!job) return;
    setShowDeleteConfirm(false);

    setDeleting(true);
    try {
      const { error } = await supabase
        .from('jobs')
        .delete()
        .eq('id', job.id);

      if (error) throw error;

      toast.success('Job deleted successfully.');
      navigate('/');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete job');
    } finally {
      setDeleting(false);
    }
  };

  const handleSubmitProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !job) return;

    if (!currentUser.bio || !currentUser.skills) {
      toast.error('You must complete your profile with a bio and skills before applying.');
      return;
    }

    const amount = parseFloat(proposedAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid proposed amount greater than ₦0.');
      return;
    }

    if (coverLetter.trim().length < 20) {
      toast.error('Your cover letter is too short. Please write at least 20 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('proposals')
        .insert({
          job_id: job.id,
          freelancer_id: currentUser.id,
          cover_letter: coverLetter.trim(),
          proposed_amount: amount,
          status: 'pending',
        });

      if (error) throw error;

      // Notify the job's client
      await notify([{
        user_id: job.client_id,
        type: 'new_proposal',
        title: '📩 New proposal received',
        body: `${currentUser.full_name} submitted a proposal for "₦${amount.toLocaleString()}" on "${job.title}".`,
        job_id: job.id,
      }]);

      toast.success('Your proposal has been submitted successfully!');
      setShowProposalForm(false);
      fetchJobDetails();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit proposal. Please try again.');
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 animate-pulse">
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Main panel */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-xl shadow-sm p-6">
                {/* Title */}
                <div className="h-7 bg-gray-200 rounded w-2/3 mb-4" />
                {/* Meta row */}
                <div className="flex gap-3 mb-6">
                  <div className="h-5 bg-gray-200 rounded w-24" />
                  <div className="h-5 bg-gray-200 rounded w-32" />
                  <div className="h-5 bg-gray-200 rounded w-20" />
                </div>
                {/* Description */}
                <div className="space-y-2 mb-6">
                  <div className="h-4 bg-gray-200 rounded w-full" />
                  <div className="h-4 bg-gray-200 rounded w-full" />
                  <div className="h-4 bg-gray-200 rounded w-5/6" />
                  <div className="h-4 bg-gray-200 rounded w-4/6" />
                </div>
                {/* Skills */}
                <div className="flex gap-2">
                  <div className="h-6 bg-gray-200 rounded-full w-16" />
                  <div className="h-6 bg-gray-200 rounded-full w-20" />
                  <div className="h-6 bg-gray-200 rounded-full w-24" />
                </div>
              </div>

              {/* Proposals panel */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="h-6 bg-gray-200 rounded w-40 mb-4" />
                {[1, 2].map((i) => (
                  <div key={i} className="flex gap-4 py-4 border-b border-gray-100 last:border-0">
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-1/3" />
                      <div className="h-3 bg-gray-200 rounded w-full" />
                      <div className="h-3 bg-gray-200 rounded w-4/5" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="h-5 bg-gray-200 rounded w-24 mb-4" />
                <div className="h-8 bg-gray-200 rounded w-32 mb-6" />
                <div className="h-10 bg-gray-200 rounded-lg w-full mb-3" />
                <div className="h-10 bg-gray-200 rounded-lg w-full" />
              </div>
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="h-5 bg-gray-200 rounded w-28 mb-4" />
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-full" />
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-28" />
                    <div className="h-3 bg-gray-200 rounded w-20" />
                  </div>
                </div>
              </div>
            </div>
          </div>
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
              {isEditing ? (
                <form onSubmit={handleUpdateJob} className="space-y-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-blue-950">Edit Job</h2>
                    <button 
                      type="button" 
                      onClick={() => setIsEditing(false)}
                      className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                      <X className="w-6 h-6 text-gray-500" />
                    </button>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Job Title</label>
                    <input
                      type="text"
                      value={editData.title}
                      onChange={(e) => setEditData({...editData, title: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-950 outline-none"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Min Budget (₦)</label>
                      <input
                        type="number"
                        value={editData.min_budget}
                        onChange={(e) => setEditData({...editData, min_budget: e.target.value})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-950 outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Max Budget (₦)</label>
                      <input
                        type="number"
                        value={editData.max_budget}
                        onChange={(e) => setEditData({...editData, max_budget: e.target.value})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-950 outline-none"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Required Skills (comma separated)</label>
                    <input
                      type="text"
                      value={editData.required_skills}
                      onChange={(e) => setEditData({...editData, required_skills: e.target.value})}
                      placeholder="React, TypeScript, UI/UX"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-950 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                    <textarea
                      value={editData.description}
                      onChange={(e) => setEditData({...editData, description: e.target.value})}
                      rows={8}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-950 outline-none"
                      required
                    />
                  </div>

                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="flex-1 px-6 py-3 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex-1 px-6 py-3 bg-blue-950 text-white rounded-lg font-semibold hover:bg-blue-900 disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="mb-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1 mr-4">
                        <h1 className="text-3xl font-bold text-blue-950 mb-2">{job.title}</h1>
                        <div className="flex items-center gap-6 text-sm text-gray-600">
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
                      </div>
                      <div className="flex flex-col items-end gap-3">
                        <span className={`px-4 py-2 rounded-full text-sm font-medium ${
                          job.status === 'open' ? 'bg-green-100 text-green-700' :
                          job.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {job.status === 'open' ? 'Open' : job.status === 'in_progress' ? 'In Progress' : 'Completed'}
                        </span>
                        
                        {isJobOwner && job.status === 'open' && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => setIsEditing(true)}
                              className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-gray-200"
                              title="Edit Job"
                            >
                              <Edit3 className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => setShowDeleteConfirm(true)}
                              disabled={deleting}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete Job"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        )}
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

                  {!isJobOwner && !hasApplied && job.status === 'open' && !showProposalForm && !currentUser?.is_admin && (
                    <>
                      {(!currentUser?.bio || !currentUser?.skills) ? (
                        <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
                            <div>
                              <h4 className="font-bold text-amber-900 text-base">Complete Your Profile</h4>
                              <p className="text-amber-700 text-sm mt-1">
                                You must set up a professional bio and your skills before you can apply to jobs.
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => navigate(`/seller/${currentUser?.id}?onboarding=true`)}
                            className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors whitespace-nowrap shadow-sm shadow-amber-100"
                          >
                            Complete Profile
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowProposalForm(true)}
                          className="mt-6 w-full bg-blue-950 text-white py-3 rounded-lg font-semibold hover:bg-blue-900 transition-colors"
                        >
                          Apply for This Job
                        </button>
                      )}
                    </>
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
                      className="mt-6 w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <MessageSquare className="w-5 h-5" />
                      Open Chat
                    </button>
                  )}
                </>
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
              ) : isJobOwner || currentUser?.is_admin ? (
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

                      {job.status === 'open' && !hire && !currentUser?.is_admin && (
                        <button
                          onClick={() =>
                            navigate(
                              `/messages?autoJobId=${job.id}&proposalId=${proposal.id}&freelancerId=${proposal.freelancer_id}&amount=${proposal.proposed_amount}`
                            )
                          }
                          className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
                        >
                          <MessageCircle className="w-4 h-4" />
                          Open Discussion
                        </button>
                      )}

                      {proposal.status === 'accepted' && !currentUser?.is_admin && (
                        <button
                          onClick={() => navigate(`/messages?autoJobId=${job.id}`)}
                          className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
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

      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Delete Job"
        message="Are you sure you want to delete this job? This action cannot be undone."
        confirmText="Yes, Delete"
        isDestructive
        onConfirm={handleDeleteJob}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
