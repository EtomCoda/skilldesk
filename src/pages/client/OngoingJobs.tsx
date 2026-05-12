import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Briefcase, MessageSquare, Clock, CheckCircle } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { QK } from '../../lib/queryKeys';
import { fetchOngoingJobs } from '../../lib/queries';
import { useState } from 'react';
import { Job } from '../../lib/supabase';

export default function OngoingJobs() {
  const navigate = useNavigate();
  const currentUser = useStore((state) => state.currentUser);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');

  const { data: jobs = [], isLoading } = useQuery<Job[]>({
    queryKey: QK.ongoingJobs(currentUser?.id ?? ''),
    queryFn:  () => fetchOngoingJobs(currentUser!.id),
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
              <div key={job.id} className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h2 className="text-xl font-bold text-blue-950">{job.title}</h2>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        job.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                        job.status === 'completed'   ? 'bg-gray-100 text-gray-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {job.status === 'in_progress' ? 'In Progress' : job.status === 'completed' ? 'Completed' : 'Cancelled'}
                      </span>
                    </div>
                    <p className="text-gray-600 line-clamp-2">{job.description}</p>
                  </div>
                  <div className="ml-4 flex items-center gap-2 text-green-600 font-bold text-lg whitespace-nowrap">
                    <span>
                      {job.min_budget && job.max_budget
                        ? job.min_budget === job.max_budget
                          ? `₦${job.min_budget.toLocaleString()}`
                          : `₦${job.min_budget.toLocaleString()} - ₦${job.max_budget.toLocaleString()}`
                        : `₦${job.budget.toLocaleString()}`}
                    </span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => navigate(`/job/${job.id}`)}
                    className="flex-1 bg-blue-950 text-white py-2 rounded-lg font-semibold hover:bg-blue-900 transition-colors">
                    View Details
                  </button>
                  {job.status === 'in_progress' && (
                    <button onClick={() => navigate(`/messages?autoJobId=${job.id}`)}
                      className="flex items-center gap-2 bg-blue-100 text-blue-950 px-6 py-2 rounded-lg font-semibold hover:bg-blue-200 transition-colors">
                      <MessageSquare className="w-4 h-4" /> Chat
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
