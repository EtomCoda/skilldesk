import { Link, useLocation, useNavigate } from 'react-router-dom';
import { GraduationCap, Wallet, LogOut, ShoppingBag, Briefcase, Menu, X, MessageCircle, TrendingUp } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface NavbarProps {
  onLogout: () => void;
}

export default function Navbar({ onLogout }: NavbarProps) {
  const { wallet, viewMode, toggleViewMode, currentUser } = useStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [freelancerEarnings, setFreelancerEarnings] = useState<number | null>(null);

  // Refresh pending badge on every route change
  useEffect(() => {
    if (currentUser && viewMode === 'selling') {
      supabase
        .from('chat_requests')
        .select('id', { count: 'exact', head: true })
        .eq('seller_id', currentUser.id)
        .eq('status', 'pending')
        .then(({ count }) => setPendingRequestsCount(count || 0));

      // Compute freelancer-only earnings from escrow_release transactions
      supabase
        .from('transactions')
        .select('amount')
        .eq('user_id', currentUser.id)
        .eq('type', 'escrow_release')
        .then(({ data }) => {
          const total = (data ?? []).reduce((sum, t) => sum + t.amount, 0);
          setFreelancerEarnings(total);
        });
    } else {
      setPendingRequestsCount(0);
      setFreelancerEarnings(null);
    }
  }, [currentUser, viewMode, location.pathname]);

  const isActive = (path: string) => location.pathname === path;

  // Mode toggle + auto-navigate (except on /messages)
  const handleModeToggle = () => {
    const nextMode = viewMode === 'buying' ? 'selling' : 'buying';
    toggleViewMode();
    if (location.pathname !== '/messages') {
      navigate(nextMode === 'selling' ? '/find-work' : '/browse-freelancers');
    }
  };

  // Avatar → mode-appropriate profile
  const goToProfile = () => {
    if (!currentUser) return;
    if (viewMode === 'selling') {
      navigate(`/seller/${currentUser.id}`);
    } else {
      navigate(`/client/${currentUser.id}`);
    }
  };

  const initials = currentUser?.full_name?.charAt(0)?.toUpperCase() || '?';
  const firstName = currentUser?.full_name?.split(' ')[0] || '';

  return (
    <nav className="bg-white shadow-lg border-b-4" style={{ borderBottomColor: 'rgb(37, 99, 235)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Top bar */}
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center gap-2 font-bold text-xl" style={{ color: 'rgb(37, 99, 235)' }}>
            <GraduationCap className="w-8 h-8" />
            <span>SkillDesk</span>
          </Link>

          {/* Desktop right */}
          <div className="hidden md:flex items-center gap-3">
            {/* Mode toggle */}
            <div
              className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all cursor-pointer hover:shadow-md"
              style={{ borderColor: 'rgb(37, 99, 235)', backgroundColor: 'rgba(37, 99, 235, 0.05)' }}
              onClick={handleModeToggle}
            >
              <button className="flex items-center gap-2">
                {viewMode === 'buying' ? (
                  <>
                    <ShoppingBag className="w-5 h-5" style={{ color: 'rgb(37, 99, 235)' }} />
                    <span className="font-semibold" style={{ color: 'rgb(37, 99, 235)' }}>Client Mode</span>
                  </>
                ) : (
                  <>
                    <Briefcase className="w-5 h-5" style={{ color: 'rgb(37, 99, 235)' }} />
                    <span className="font-semibold" style={{ color: 'rgb(37, 99, 235)' }}>Freelancer Mode</span>
                  </>
                )}
              </button>
            </div>

            {/* Wallet (client only) or Earnings (freelancer only) */}
            {viewMode === 'buying' ? (
              <Link
                to="/wallet"
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                  isActive('/wallet') ? 'bg-gray-100' : 'hover:bg-gray-50'
                }`}
                style={{ color: isActive('/wallet') ? 'rgb(37, 99, 235)' : 'rgb(17, 24, 39)' }}
              >
                <Wallet className="w-5 h-5" />
                <div className="flex flex-col items-start leading-none">
                  <span className="text-sm font-medium">Wallet</span>
                  {wallet && (
                    <span className="text-[10px] font-bold text-green-600">
                      ₦{wallet.available_balance.toLocaleString()}
                    </span>
                  )}
                </div>
              </Link>
            ) : (
              <Link
                to="/my-earnings"
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                  isActive('/my-earnings') ? 'bg-gray-100' : 'hover:bg-gray-50'
                }`}
                style={{ color: isActive('/my-earnings') ? 'rgb(37, 99, 235)' : 'rgb(17, 24, 39)' }}
              >
                <TrendingUp className="w-5 h-5" />
                <div className="flex flex-col items-start leading-none">
                  <span className="text-sm font-medium">Earnings</span>
                  {freelancerEarnings !== null && (
                    <span className="text-[10px] font-bold text-green-600">
                      ₦{freelancerEarnings.toLocaleString()}
                    </span>
                  )}
                </div>
              </Link>
            )}

            {/* User avatar — only way to reach profile */}
            <button
              onClick={goToProfile}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all"
              title={`View ${viewMode === 'selling' ? 'freelancer' : 'client'} profile`}
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                style={{ backgroundColor: 'rgb(37, 99, 235)' }}
              >
                {initials}
              </div>
              <span className="text-sm font-semibold text-gray-800 max-w-[100px] truncate">{firstName}</span>
            </button>

            {/* Logout — icon only */}
            <button
              onClick={onLogout}
              className="p-2 rounded-lg hover:bg-red-50 transition-colors text-gray-500 hover:text-red-500"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 flex items-center gap-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{ color: 'rgb(37, 99, 235)' }}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
              style={{ backgroundColor: 'rgb(37, 99, 235)' }}
            >
              {initials}
            </div>
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Sub-nav — strictly mode-separated */}
        <div className="border-t" style={{ borderTopColor: 'rgba(37, 99, 235, 0.1)' }}>
          <div className="flex gap-1 py-2 overflow-x-auto">
            {viewMode === 'buying' ? (
              /* ── CLIENT mode ── */
              <>
                <Link to="/post-job" className={navLink(isActive('/post-job'))}>Post a Job</Link>
                <Link to="/my-hires" className={navLink(isActive('/my-hires'))}>My Hires</Link>
                <Link to="/browse-freelancers" className={navLink(isActive('/browse-freelancers'))}>Browse Freelancers</Link>
                <Link
                  to="/messages"
                  className={`${navLink(isActive('/messages'))} flex items-center gap-1.5`}
                >
                  <MessageCircle className="w-4 h-4" />
                  Messages
                </Link>
              </>
            ) : (
              /* ── FREELANCER mode ── */
              <>
                <Link to="/find-work" className={navLink(isActive('/find-work'))}>Find Work</Link>
                <Link to="/my-proposals" className={navLink(isActive('/my-proposals'))}>My Proposals</Link>
                <Link
                  to="/messages"
                  className={`${navLink(isActive('/messages'))} relative flex items-center gap-1.5`}
                >
                  <MessageCircle className="w-4 h-4" />
                  Messages
                  {pendingRequestsCount > 0 && (
                    <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                      {pendingRequestsCount}
                    </span>
                  )}
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-gray-50 border-t p-4">
          <div className="space-y-2">
            {/* User info card */}
            <button
              onClick={() => { goToProfile(); setMobileMenuOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-3 bg-white rounded-lg border border-gray-100 hover:border-blue-200 transition-colors text-left"
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
                style={{ backgroundColor: 'rgb(37, 99, 235)' }}
              >
                {initials}
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">{currentUser?.full_name}</p>
                <p className="text-xs text-gray-500">
                  {viewMode === 'selling' ? 'View freelancer profile' : 'View client profile'}
                </p>
              </div>
            </button>

            <button
              onClick={() => { handleModeToggle(); setMobileMenuOpen(false); }}
              className="w-full text-left px-4 py-2 rounded-lg font-medium"
              style={{ color: 'rgb(37, 99, 235)', backgroundColor: 'rgba(37, 99, 235, 0.05)' }}
            >
              {viewMode === 'buying' ? 'Switch to Freelancer Mode' : 'Switch to Client Mode'}
            </button>
            {viewMode === 'buying' ? (
              <Link
                to="/wallet"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-4 py-2 rounded-lg font-medium text-gray-700 hover:bg-gray-100"
              >
                Wallet{wallet && (
                  <span className="ml-2 text-green-600 font-bold text-sm">
                    ₦{wallet.available_balance.toLocaleString()}
                  </span>
                )}
              </Link>
            ) : (
              <Link
                to="/my-earnings"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-4 py-2 rounded-lg font-medium text-gray-700 hover:bg-gray-100"
              >
                Earnings{freelancerEarnings !== null && (
                  <span className="ml-2 text-green-600 font-bold text-sm">
                    ₦{freelancerEarnings.toLocaleString()}
                  </span>
                )}
              </Link>
            )}
            <button
              onClick={() => { onLogout(); setMobileMenuOpen(false); }}
              className="w-full text-left px-4 py-2 rounded-lg font-medium text-red-600 hover:bg-red-50"
            >
              Logout
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}

// Shared nav link class helper
function navLink(active: boolean) {
  return `px-4 py-2 rounded-lg transition-colors whitespace-nowrap font-medium ${
    active ? 'bg-gray-100 text-blue-600' : 'text-gray-900 hover:bg-gray-50'
  }`;
}
