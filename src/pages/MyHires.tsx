import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, MessageSquare} from 'lucide-react';
import { supabase, Job } from '../lib/supabase';
import { useStore } from '../store/useStore';

export default function MyHires() {
  const navigate = useNavigate();
  const currentUser = useStore((state) => state.currentUser);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUser) {
      fetchMyJobs();
    }
  }, [currentUser]);

  const fetchMyJobs = async () => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('client_id', currentUser?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setJobs(data);
    } catch (err) {
      console.error('Error fetching jobs:', err);
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
          <h1 className="text-3xl font-bold text-blue-950">My Hires</h1>
          <button
            onClick={() => navigate('/post-job')}
            className="bg-blue-950 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-900 transition-colors"
          >
            Post New Job
          </button>
        </div>

        {jobs.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <Briefcase className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No jobs posted yet</h2>
            <p className="text-gray-600 mb-6">Start hiring talented PAU students for your projects</p>
            <button
              onClick={() => navigate('/post-job')}
              className="bg-blue-950 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-900 transition-colors"
            >
              Post Your First Job
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h2 className="text-xl font-bold text-blue-950">{job.title}</h2>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        job.status === 'open' ? 'bg-green-100 text-green-700' :
                        job.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                        job.status === 'completed' ? 'bg-gray-100 text-gray-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {job.status === 'open' ? 'Open' :
                         job.status === 'in_progress' ? 'In Progress' :
                         job.status === 'completed' ? 'Completed' : 'Cancelled'}
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
                  <button
                    onClick={() => navigate(`/job/${job.id}`)}
                    className="flex-1 bg-blue-950 text-white py-2 rounded-lg font-semibold hover:bg-blue-900 transition-colors"
                  >
                    View Details
                  </button>
                  {job.status === 'in_progress' && (
                    <button
                      onClick={() => navigate(`/messages?autoJobId=${job.id}`)}
                      className="flex items-center gap-2 bg-blue-100 text-blue-950 px-6 py-2 rounded-lg font-semibold hover:bg-blue-200 transition-colors"
                    >
                      <MessageSquare className="w-4 h-4" />
                      Chat
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
