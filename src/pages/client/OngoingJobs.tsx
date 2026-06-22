import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Briefcase, MessageSquare, Clock, CheckCircle, ArrowLeft, Users, Tags } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { QK } from '../../lib/queryKeys';
import { fetchOngoingJobs } from '../../lib/queries';
import { useState } from 'react';
import { Job } from '../../lib/supabase';

interface EnhancedJob extends Job {
  proposalCount: number;
  hiredFreelancer: string | null;
}

export default function OngoingJobs() {
  const navigate = useNavigate();
  const currentUser = useStore((state) => state.currentUser);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');

  const { data: jobs = [], isLoading } = useQuery<EnhancedJob[]>({
    queryKey: QK.ongoingJobs(currentUser?.id ?? ''),
    queryFn:  () => fetchOngoingJobs(currentUser!.id) as any,
    enabled:  !!currentUser,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4">
          <p className="text-center text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const filteredJobs = jobs.filter((job) => {
    if (activeTab === 'active') return job.status === 'in_progress';
    return job.status === 'completed' || job.status === 'cancelled';
  });

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-blue-950">Ongoing Jobs &amp; History</h1>
        </div>

        <div className="flex space-x-4 border-b border-gray-200 mb-8">
          <button
            className={`pb-3 font-semibold text-sm transition-colors relative ${activeTab === 'active' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('active')}>
            Active Jobs
          </button>
          <button
            className={`pb-3 font-semibold text-sm transition-colors relative ${activeTab === 'history' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('history')}>
            History
          </button>
        </div>

        {filteredJobs.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            {activeTab === 'active' ? (
              <>
                <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-gray-900 mb-2">No active jobs</h2>
                <p className="text-gray-600 mb-6">You don't have any jobs currently in progress.</p>
              </>
            ) : (
              <>
                <CheckCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-gray-900 mb-2">No job history</h2>
                <p className="text-gray-600 mb-6">You haven't completed or cancelled any jobs yet.</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredJobs.map((job) => (
              <div key={job.id} className="bg-white rounded-xl shadow-sm p-5 hover:shadow-md transition-shadow group border border-gray-100">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <h2 className="text-lg font-bold text-blue-950 group-hover:text-blue-600 transition-colors uppercase tracking-tight">{job.title}</h2>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        job.status === 'in_progress' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                        job.status === 'completed'   ? 'bg-green-100 text-green-700 border border-green-200' :
                        'bg-red-100 text-red-700 border border-red-200'
                      }`}>
                        {job.status === 'in_progress' ? 'In Progress' : job.status}
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
                        
                        {job.hiredFreelancer && (
                            <div className="flex items-center gap-1.5 text-blue-600 font-medium">
                                <Users className="w-3.5 h-3.5" />
                                <span>Collaborator: {job.hiredFreelancer}</span>
                            </div>
                        )}

                        <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Created: {new Date(job.created_at).toLocaleDateString()}</span>
                        </div>
                    </div>
                  </div>

                  <div className="flex flex-col md:items-end gap-3 min-w-[140px]">
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
    </div>
  );
}
