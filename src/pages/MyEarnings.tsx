import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, DollarSign, Briefcase, CheckCircle } from 'lucide-react';
import { supabase, Hire, Job } from '../lib/supabase';
import { useStore } from '../store/useStore';

interface HireWithJob extends Hire {
  job: Job;
}

export default function MyEarnings() {
  const navigate = useNavigate();
  const currentUser = useStore((state) => state.currentUser);
  const [hires, setHires] = useState<HireWithJob[]>([]);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUser) {
      fetchMyEarnings();
    }
  }, [currentUser]);

  const fetchMyEarnings = async () => {
    try {
      const { data: hiresData, error } = await supabase
        .from('hires')
        .select('*')
        .eq('freelancer_id', currentUser?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (hiresData) {
        const hiresWithJobs = await Promise.all(
          hiresData.map(async (hire) => {
            const { data: jobData } = await supabase
              .from('jobs')
              .select('*')
              .eq('id', hire.job_id)
              .single();

            return { ...hire, job: jobData };
          })
        );

        setHires(hiresWithJobs);

        const total = hiresData
          .filter((h) => h.status === 'completed')
          .reduce((sum, h) => sum + h.escrow_amount, 0);
        setTotalEarnings(total);
      }
    } catch (err) {
      console.error('Error fetching earnings:', err);
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

  const activeJobs = hires.filter((h) => h.status === 'funded');
  const completedJobs = hires.filter((h) => h.status === 'completed');

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-blue-950 mb-8">My Earnings</h1>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gradient-to-br from-green-600 to-green-500 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                <TrendingUp className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-semibold">Total Earned</h2>
            </div>
            <p className="text-3xl font-bold">₦{totalEarnings.toLocaleString()}</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border-2 border-blue-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Briefcase className="w-6 h-6 text-blue-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Active Jobs</h2>
            </div>
            <p className="text-3xl font-bold text-blue-600">{activeJobs.length}</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border-2 border-green-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Completed</h2>
            </div>
            <p className="text-3xl font-bold text-green-600">{completedJobs.length}</p>
          </div>
        </div>

        {hires.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <TrendingUp className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No earnings yet</h2>
            <p className="text-gray-600 mb-6">Start applying to jobs and build your portfolio</p>
            <button
              onClick={() => navigate('/find-work')}
              className="bg-blue-950 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-900 transition-colors"
            >
              Find Work
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-bold text-blue-950 mb-6">Job History</h2>
            <div className="space-y-4">
              {hires.map((hire) => (
                <div
                  key={hire.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold text-gray-900">{hire.job.title}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        hire.status === 'funded' ? 'bg-blue-100 text-blue-700' :
                        hire.status === 'completed' ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {hire.status === 'funded' ? 'In Progress' :
                         hire.status === 'completed' ? 'Completed' : hire.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">
                      {hire.status === 'completed' && hire.completed_at
                        ? `Completed ${new Date(hire.completed_at).toLocaleDateString()}`
                        : `Started ${new Date(hire.created_at).toLocaleDateString()}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-green-600 font-bold text-lg">
                      <DollarSign className="w-5 h-5" />
                      <span>₦{hire.escrow_amount.toLocaleString()}</span>
                    </div>
                    {hire.status === 'funded' && (
                      <button
                        onClick={() => navigate(`/chat/${hire.job_id}`)}
                        className="bg-blue-950 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-900 transition-colors"
                      >
                        Continue Work
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
