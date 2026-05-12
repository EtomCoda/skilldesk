import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Users, Search, ShieldOff, ArrowLeft } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { QK } from '../../lib/queryKeys';
import { fetchAdminUsers } from '../../lib/queries';

export default function AdminUsers() {
  const navigate = useNavigate();
  const currentUser = useStore((s) => s.currentUser);
  const [search, setSearch] = useState('');

  const { data: users = [], isLoading } = useQuery({
    queryKey: QK.adminUsers(),
    queryFn:  fetchAdminUsers,
    enabled:  !!currentUser?.is_admin,
    staleTime: 60 * 1000,
  });

  if (!currentUser?.is_admin) { navigate('/'); return null; }

  const q        = search.toLowerCase();
  const filtered = users.filter((u) =>
    u.full_name.toLowerCase().includes(q) ||
    u.email.toLowerCase().includes(q) ||
    (u.skills ?? '').toLowerCase().includes(q)
  );

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => navigate('/admin')} className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
            <Users className="w-5 h-5 text-blue-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
            <p className="text-sm text-gray-500">{users.length} registered users</p>
          </div>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search by name, email or skill..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white shadow-sm" />
        </div>

        {isLoading ? (
          <p className="text-center text-gray-400 py-20">Loading users...</p>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">User</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 hidden md:table-cell">Skills</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600 hidden sm:table-cell">Wallet</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600 hidden sm:table-cell">Escrow</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-600">Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-xs flex-shrink-0">
                          {u.full_name?.charAt(0) || '?'}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{u.full_name}</p>
                          <p className="text-xs text-gray-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <p className="text-xs text-gray-500 truncate max-w-[180px]">{u.skills || '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-right hidden sm:table-cell">
                      <span className="text-blue-700 font-semibold">₦{(u.wallet?.available_balance ?? 0).toLocaleString()}</span>
                    </td>
                    <td className="px-4 py-3 text-right hidden sm:table-cell">
                      <span className="text-blue-500 font-semibold">₦{(u.wallet?.escrow_balance ?? 0).toLocaleString()}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {u.is_admin ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                          <ShieldOff className="w-3 h-3" /> Admin
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded-full text-xs">User</span>
                      )}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-12 text-gray-400">No users match your search</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
