import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Briefcase, Search, XCircle, ArrowLeft, ExternalLink } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useStore } from '../../store/useStore';
import { QK } from '../../lib/queryKeys';
import { fetchAdminJobs } from '../../lib/queries';

export default function AdminJobs() {
  const navigate     = useNavigate();
  const currentUser  = useStore((s) => s.currentUser);
  const qc           = useQueryClient();
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [cancelling,   setCancelling]   = useState<string | null>(null);

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: QK.adminJobs(),
    queryFn:  fetchAdminJobs,
    enabled:  !!currentUser?.is_admin,
    staleTime: 60 * 1000,
  });

  if (!currentUser?.is_admin) { navigate('/'); return null; }

  const q        = search.toLowerCase();
  const filtered = jobs.filter((j) => {
    const matchStatus = statusFilter === 'all' || j.status === statusFilter;
    const matchSearch = j.title.toLowerCase().includes(q) || (j.client_name ?? '').toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const handleCancel = async (jobId: string) => {
    if (!confirm('Cancel this job? This cannot be undone.')) return;
    setCancelling(jobId);
    await supabase.from('jobs').update({ status: 'cancelled' }).eq('id', jobId);
    qc.invalidateQueries({ queryKey: QK.adminJobs() });
    setCancelling(null);
  };

  const statusColors: Record<string, string> = {
    open: 'bg-blue-50 text-blue-700', in_progress: 'bg-indigo-100 text-indigo-700',
    completed: 'bg-gray-100 text-gray-600', cancelled: 'bg-red-100 text-red-600',
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => navigate('/admin')} className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
            <Briefcase className="w-5 h-5 text-blue-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Job Moderation</h1>
            <p className="text-sm text-gray-500">{jobs.length} total jobs</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Search by title or client..." value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white shadow-sm" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-3 border border-gray-200 rounded-xl bg-white shadow-sm text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400">
            <option value="all">All statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {isLoading ? (
          <p className="text-center text-gray-400 py-20">Loading jobs...</p>
        ) : (
          <div className="space-y-3">
            {filtered.map((job) => (
              <div key={job.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-3 mb-1 flex-wrap">
                    <h3 className="font-bold text-gray-900">{job.title}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${statusColors[job.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {job.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mb-1">
                    by <span className="font-medium text-gray-600">{job.client_name}</span>
                    {' · '}{job.proposal_count} proposal{job.proposal_count !== 1 ? 's' : ''}
                    {' · '}₦{(job.min_budget ?? job.budget).toLocaleString()}
                    {job.max_budget && job.max_budget !== (job.min_budget ?? job.budget) ? ` – ₦${job.max_budget.toLocaleString()}` : ''}
                  </p>
                  <p className="text-sm text-gray-500 line-clamp-2">{job.description}</p>
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <Link to={`/job/${job.id}`} className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium transition-colors">
                    <ExternalLink className="w-3.5 h-3.5" /> View
                  </Link>
                  {job.status === 'open' && (
                    <button onClick={() => handleCancel(job.id)} disabled={cancelling === job.id}
                      className="flex items-center gap-1 text-red-500 hover:text-red-700 text-xs font-medium transition-colors disabled:opacity-50">
                      <XCircle className="w-3.5 h-3.5" />
                      {cancelling === job.id ? 'Cancelling...' : 'Cancel'}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {filtered.length === 0 && <div className="text-center py-16 text-gray-400">No jobs found</div>}
          </div>
        )}
      </div>
    </div>
  );
}
