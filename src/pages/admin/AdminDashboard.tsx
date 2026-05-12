import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Users, Briefcase, DollarSign, ShieldCheck, AlertTriangle, MessageSquare, TrendingUp, ArrowRight, Headset } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { QK } from '../../lib/queryKeys';
import { fetchAdminStats } from '../../lib/queries';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const currentUser = useStore((s) => s.currentUser);

  const { data: stats, isLoading } = useQuery({
    queryKey: QK.adminStats(),
    queryFn:  fetchAdminStats,
    enabled:  !!currentUser?.is_admin,
    staleTime: 60 * 1000, // admin stats: 1-minute freshness
  });

  if (!currentUser?.is_admin) { navigate('/'); return null; }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-blue-900" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
            <p className="text-sm text-gray-500">SkillDesk platform overview</p>
          </div>
        </div>

        {isLoading ? (
          <p className="text-center text-gray-400 py-20">Loading stats...</p>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <StatCard icon={<Users className="w-5 h-5 text-blue-600" />}       label="Total Users"    value={stats!.totalUsers} />
              <StatCard icon={<Briefcase className="w-5 h-5 text-blue-600" />}   label="Open Jobs"     value={stats!.openJobs} sub={`${stats!.totalJobs} total`} />
              <StatCard icon={<DollarSign className="w-5 h-5 text-blue-600" />}  label="Escrow Held"   value={`₦${stats!.totalEscrow.toLocaleString()}`} />
              <StatCard icon={<TrendingUp className="w-5 h-5 text-blue-600" />}  label="Total Released" value={`₦${stats!.totalReleased.toLocaleString()}`} />
            </div>

            {(stats!.openTickets > 0 || stats!.disputedHires > 0) && (
              <div className="grid md:grid-cols-2 gap-4 mb-8">
                {stats!.openTickets > 0 && (
                  <AlertCard icon={<Headset className="w-5 h-5 text-blue-600" />}
                    title={`${stats!.openTickets} open support ticket${stats!.openTickets > 1 ? 's' : ''}`}
                    description="Users are waiting for a response" linkTo="/admin/support" color="blue" />
                )}
                {stats!.disputedHires > 0 && (
                  <AlertCard icon={<AlertTriangle className="w-5 h-5 text-red-600" />}
                    title={`${stats!.disputedHires} disputed hire${stats!.disputedHires > 1 ? 's' : ''}`}
                    description="Requires admin arbitration" linkTo="/admin/jobs" color="red" />
                )}
              </div>
            )}

            <div className="grid md:grid-cols-3 gap-4">
              <AdminNavCard to="/admin/users"   icon={<Users className="w-6 h-6 text-blue-700" />}        title="User Management"  desc="View, search and manage all platform users" />
              <AdminNavCard to="/admin/jobs"    icon={<Briefcase className="w-6 h-6 text-blue-700" />}    title="Job Moderation"   desc="Review all posted jobs and cancel inappropriate ones" />
              <AdminNavCard to="/admin/support" icon={<MessageSquare className="w-6 h-6 text-blue-700" />} title="Support Inbox"    desc="Reply to open support tickets from users" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
      <div className="flex items-center gap-2 mb-2">{icon}<span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</span></div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function AlertCard({ icon, title, description, linkTo, color }: { icon: React.ReactNode; title: string; description: string; linkTo: string; color: 'blue' | 'red' }) {
  const colors = { blue: 'bg-blue-50 border-blue-200 text-blue-900', red: 'bg-red-50 border-red-200 text-red-900' };
  return (
    <Link to={linkTo} className={`flex items-start gap-3 p-4 rounded-xl border ${colors[color]} hover:shadow-md transition-all`}>
      <div className="mt-0.5">{icon}</div>
      <div className="flex-1">
        <p className="font-semibold text-sm">{title}</p>
        <p className="text-xs opacity-70 mt-0.5">{description}</p>
      </div>
      <ArrowRight className="w-4 h-4 opacity-50 mt-0.5 flex-shrink-0" />
    </Link>
  );
}

function AdminNavCard({ to, icon, title, desc }: { to: string; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Link to={to} className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md hover:border-blue-100 transition-all group">
      <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center mb-3 group-hover:bg-blue-50 transition-colors">{icon}</div>
      <h3 className="font-bold text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-500">{desc}</p>
      <div className="flex items-center gap-1 mt-3 text-blue-600 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
        Open <ArrowRight className="w-3.5 h-3.5" />
      </div>
    </Link>
  );
}
