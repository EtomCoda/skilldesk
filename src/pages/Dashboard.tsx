import { useStore } from '../store/useStore';
import { Briefcase, ShoppingBag, ArrowRight, PlusCircle, MessageSquare, Clock, Users, Tags } from 'lucide-react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { QK } from '../lib/queryKeys';
import { fetchAllClientJobs } from '../lib/queries';
import { Job } from '../lib/supabase';
import JobListItemSkeleton from '../components/JobListItemSkeleton';

interface EnhancedJob extends Job {
  proposalCount: number;
  hiredFreelancer: string | null;
}

export default function Dashboard() {
  const { currentUser, viewMode } = useStore();
  const navigate = useNavigate();

  const { data: jobs = [], isLoading } = useQuery<EnhancedJob[]>({
    queryKey: QK.clientJobs(currentUser?.id ?? ''),
    queryFn: () => fetchAllClientJobs(currentUser!.id) as any,
    enabled: !!currentUser && viewMode === 'buying',
  });

  if (currentUser?.is_admin) {
    return <Navigate to="/admin" replace />;
  }

  // Onboarding flow for new freelancers: redirect if bio OR skills is missing/empty
  if (viewMode === 'selling' && currentUser) {
    const needsOnboarding = !currentUser.bio?.trim() || !currentUser.skills?.trim();
    if (needsOnboarding) {
      return <Navigate to={`/seller/${currentUser.id}?onboarding=true`} replace />;
    }
    // Freelancer with complete profile — send to Find Work
    return <Navigate to="/find-work" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Welcome Card */}
        <div className="bg-white rounded-xl shadow-sm p-8 mb-8">
            <h1 className="text-3xl font-bold text-blue-950 mb-2">
                Welcome back, {currentUser?.full_name}!
            </h1>
            <p className="text-gray-600 mb-6">
                You are currently in <span className="font-semibold">{viewMode === 'buying' ? 'Client' : 'Freelancer'}</span> mode
            </p>
            {viewMode === 'buying' && (
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={() => navigate('/post-job')}
                        className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-sm"
                    >
                        <PlusCircle className="w-5 h-5" />
                        Post New Job
                    </button>
                    <button
                        onClick={() => navigate('/ongoing-jobs')}
                        className="inline-flex items-center justify-center gap-2 bg-white text-blue-600 border-2 border-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-blue-50 transition-colors shadow-sm"
                    >
                        <Clock className="w-5 h-5" />
                        View Ongoing Jobs
                    </button>
                </div>
            )}
        </div>

        {viewMode === 'buying' ? (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-blue-950">My Posted Jobs</h2>
            
            {isLoading ? (
              <div className="grid gap-4">
                {[...Array(3)].map((_, i) => (
                  <JobListItemSkeleton key={i} />
                ))}
              </div>
            ) : jobs.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm p-12 text-center border-2 border-dashed border-gray-200">
                <Briefcase className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No jobs posted yet</h3>
                <p className="text-gray-600 mb-6">Start hiring talented PAU students for your projects</p>
                <button
                  onClick={() => navigate('/post-job')}
                  className="inline-flex items-center gap-2 bg-blue-950 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-900 transition-colors"
                >
                  <PlusCircle className="w-5 h-5" />
                  Post Your First Job
                </button>
              </div>
            ) : (
              <div className="grid gap-4">
                {jobs.map((job) => (
                  <div
                    key={job.id}
                    className="bg-white rounded-xl shadow-sm p-5 hover:shadow-md transition-shadow border border-gray-100 group"
                  >
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <h3 className="text-lg font-bold text-blue-950 group-hover:text-blue-600 transition-colors">{job.title}</h3>
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                            job.status === 'open' ? 'bg-green-100 text-green-700 border border-green-200' :
                            job.status === 'in_progress' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                            job.status === 'completed' ? 'bg-gray-100 text-gray-700 border border-gray-200' :
                            'bg-red-100 text-red-700 border border-red-200'
                          }`}>
                            {job.status.replace('_', ' ')}
                          </span>
                        </div>
                        
                        <p className="text-gray-600 text-sm line-clamp-2 mb-3 leading-relaxed">{job.description}</p>
                        
                        {/* Tags & Meta Row */}
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-gray-500">
                            {job.required_skills && (
                                <div className="flex items-center gap-2">
                                    <Tags className="w-3.5 h-3.5" />
                                    <div className="flex gap-1">
                                        {job.required_skills.split(',').slice(0, 3).map((skill, i) => (
                                            <span key={i} className="bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                                                {skill.trim()}
                                            </span>
                                        ))}
                                        {job.required_skills.split(',').length > 3 && (
                                            <span className="text-gray-400">+{job.required_skills.split(',').length - 3}</span>
                                        )}
                                    </div>
                                </div>
                            )}
                            
                            <div className="flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5" />
                                <span>{new Date(job.created_at).toLocaleDateString()}</span>
                            </div>

                            {job.status === 'open' ? (
                                <div className="flex items-center gap-1.5 text-blue-600 font-medium">
                                    <Users className="w-3.5 h-3.5" />
                                    <span>{job.proposalCount} {job.proposalCount === 1 ? 'Proposal' : 'Proposals'}</span>
                                </div>
                            ) : job.hiredFreelancer ? (
                                <div className="flex items-center gap-1.5 text-blue-600 font-medium">
                                    <Users className="w-3.5 h-3.5" />
                                    <span>Hired: {job.hiredFreelancer}</span>
                                </div>
                            ) : null}
                        </div>
                      </div>

                      <div className="flex flex-col md:items-end gap-4 min-w-[140px]">
                        <div className="text-green-600 font-bold text-xl">
                          {job.min_budget && job.max_budget 
                            ? job.min_budget === job.max_budget 
                              ? `₦${job.min_budget.toLocaleString()}`
                              : `₦${job.min_budget.toLocaleString()} - ₦${job.max_budget.toLocaleString()}`
                            : `₦${job.budget.toLocaleString()}`}
                        </div>
                        <div className="flex gap-2 w-full md:w-auto">
                            <button
                                onClick={() => navigate(`/job/${job.id}`)}
                                className="flex-1 md:flex-none px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors text-center"
                            >
                                View Details
                            </button>
                            {job.status === 'in_progress' && (
                                <button
                                    onClick={() => navigate(`/messages?autoJobId=${job.id}`)}
                                    className="p-2 bg-blue-50 text-blue-600 rounded-lg font-semibold hover:bg-blue-100 transition-colors"
                                    title="Open Chat"
                                >
                                    <MessageSquare className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            <Link
              to="/find-work"
              className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow border-2 border-transparent hover:border-blue-950"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <Briefcase className="w-6 h-6 text-blue-950" />
                </div>
                <h2 className="text-xl font-bold text-blue-950">Find Work</h2>
              </div>
              <p className="text-gray-600 mb-4">
                Browse available jobs and submit proposals to clients.
              </p>
              <div className="flex items-center text-blue-950 font-medium">
                Browse jobs <ArrowRight className="w-4 h-4 ml-2" />
              </div>
            </Link>

            <Link
              to="/my-proposals"
              className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow border-2 border-transparent hover:border-blue-950"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <ShoppingBag className="w-6 h-6 text-blue-950" />
                </div>
                <h2 className="text-xl font-bold text-blue-950">My Proposals</h2>
              </div>
              <p className="text-gray-600 mb-4">
                Track your submitted proposals and respond to client messages.
              </p>
              <div className="flex items-center text-blue-950 font-medium">
                View proposals <ArrowRight className="w-4 h-4 ml-2" />
              </div>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
