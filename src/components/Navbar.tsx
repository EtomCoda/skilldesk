import { Link, useLocation, useNavigate } from 'react-router-dom';
import { GraduationCap, Wallet, LogOut, ShoppingBag, Briefcase, Menu, X, MessageCircle, TrendingUp, ShieldCheck, Headset, PlusCircle, Users, Search, FileText, Clock } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import NotificationBell from './NotificationBell';

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

  // ── PURE ADMIN VIEW ──
  if (currentUser?.is_admin) {
    return (
      <nav className="bg-white shadow-lg border-b-4 border-blue-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/admin" className="flex items-center gap-2 font-bold text-xl text-blue-900">
              <ShieldCheck className="w-8 h-8" />
              <span className="hidden sm:inline">SkillDesk Admin</span>
            </Link>

            <div className="hidden md:flex items-center gap-6">
              <button onClick={onLogout} className="flex items-center gap-2 text-gray-500 hover:text-red-600 transition-colors">
                <LogOut className="w-5 h-5" />
                <span className="font-medium text-sm">Logout</span>
              </button>
            </div>

            <div className="md:hidden flex items-center">
              <button
                className="p-2 text-blue-900"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>

          <div className="border-t border-gray-100 hidden md:block">
            <div className="flex gap-2 py-2">
              <Link to="/admin" className={navLink(isActive('/admin') && location.pathname === '/admin', true)}>Dashboard</Link>
              <Link to="/admin/users" className={navLink(isActive('/admin/users'), true)}>Users</Link>
              <Link to="/admin/jobs" className={navLink(isActive('/admin/jobs'), true)}>Jobs</Link>
              <Link to="/admin/support" className={navLink(isActive('/admin/support'), true)}>Support Tickets</Link>
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-gray-50 border-t p-4 space-y-2">
            <Link to="/admin" onClick={() => setMobileMenuOpen(false)} className="block px-4 py-2 text-gray-700 font-medium hover:bg-gray-100 rounded-lg">Dashboard</Link>
            <Link to="/admin/users" onClick={() => setMobileMenuOpen(false)} className="block px-4 py-2 text-gray-700 font-medium hover:bg-gray-100 rounded-lg">Users</Link>
            <Link to="/admin/jobs" onClick={() => setMobileMenuOpen(false)} className="block px-4 py-2 text-gray-700 font-medium hover:bg-gray-100 rounded-lg">Jobs</Link>
            <Link to="/admin/support" onClick={() => setMobileMenuOpen(false)} className="block px-4 py-2 text-gray-700 font-medium hover:bg-gray-100 rounded-lg">Support Tickets</Link>
            <button
              onClick={() => { onLogout(); setMobileMenuOpen(false); }}
              className="w-full text-left flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-red-600 hover:bg-red-50 mt-4"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        )}
      </nav>
    );
  }

  // ── CLIENT / FREELANCER VIEW ──
  // Palette: #ECE8EF (soft off-white) & #2563eb (blue) & #0E0E52 (deep navy)
  // Client  → white navbar, blue accents, #ECE8EF tint
  // Freelancer → #0E0E52 navbar (inverted), #ECE8EF accents
  const isClient = viewMode === 'buying';
  const BLUE   = '#2563eb';
  const NAVY   = '#0E0E52';
  const CREAM  = '#ECE8EF';

  const navBg          = isClient ? '#ffffff' : NAVY;
  const navText        = isClient ? '#111827' : CREAM;
  const navAccent      = isClient ? BLUE      : CREAM;
  const navBorderColor = isClient ? BLUE      : CREAM;
  const navBadgeBg     = isClient ? BLUE      : CREAM;
  const navBadgeText   = isClient ? '#fff'    : NAVY;
  const navHoverBg     = isClient ? '#f3f4f6' : 'rgba(236,232,239,0.1)';
  const navToggleBg    = isClient ? 'rgba(37,99,235,0.06)' : 'rgba(236,232,239,0.1)';
  const modeLabel      = isClient ? 'You are in Client Mode' : 'You are in Freelancer Mode';

  return (
    <nav
      className="shadow-lg border-b-4 transition-all duration-500 sticky top-0 z-50"
      style={{ backgroundColor: navBg, borderBottomColor: navBorderColor }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Top bar */}
        <div className="flex items-center h-16 relative">

          {/* LEFT: Logo only */}
          <Link
            to="/"
            className="flex items-center gap-2 font-bold text-xl flex-shrink-0 transition-colors duration-300"
            style={{ color: navAccent }}
          >
            <GraduationCap className="w-8 h-8" />
            <span className="hidden sm:inline">SkillDesk</span>
          </Link>

          {/* Push desktop right-group to far right; on mobile this is a spacer */}
          <div className="flex-1" />

          {/* RIGHT: Desktop controls */}
          <div className="hidden md:flex items-center gap-3">
            {/* Mode toggle */}
            <div
              className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all duration-300 cursor-pointer hover:opacity-90"
              style={{ borderColor: navAccent, backgroundColor: navToggleBg }}
              onClick={handleModeToggle}
            >
              <button className="flex items-center gap-2">
                {isClient ? (
                  <>
                    <ShoppingBag className="w-5 h-5 transition-colors duration-300" style={{ color: navAccent }} />
                    <span className="font-semibold transition-colors duration-300" style={{ color: navAccent }}>{modeLabel}</span>
                  </>
                ) : (
                  <>
                    <Briefcase className="w-5 h-5 transition-colors duration-300" style={{ color: navAccent }} />
                    <span className="font-semibold transition-colors duration-300" style={{ color: navAccent }}>{modeLabel}</span>
                  </>
                )}
              </button>
            </div>

            {/* Wallet (client only) or Earnings (freelancer only) */}
            {isClient ? (
              <Link
                to="/wallet"
                className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors"
                style={{
                  color: isActive('/wallet') ? BLUE : navText,
                  backgroundColor: isActive('/wallet') ? navHoverBg : 'transparent',
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = navHoverBg)}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = isActive('/wallet') ? navHoverBg : 'transparent')}
              >
                <Wallet className="w-5 h-5" />
                <div className="flex flex-col items-start leading-none">
                  <span className="text-sm font-medium">Wallet</span>
                  {wallet && (
                    <span className="text-[10px] font-bold text-green-500">
                      ₦{wallet.available_balance.toLocaleString()}
                    </span>
                  )}
                </div>
              </Link>
            ) : (
              <Link
                to="/my-earnings"
                className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors"
                style={{
                  color: isActive('/my-earnings') ? CREAM : navText,
                  backgroundColor: isActive('/my-earnings') ? navHoverBg : 'transparent',
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = navHoverBg)}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = isActive('/my-earnings') ? navHoverBg : 'transparent')}
              >
                <TrendingUp className="w-5 h-5" />
                <div className="flex flex-col items-start leading-none">
                  <span className="text-sm font-medium">Earnings</span>
                  {freelancerEarnings !== null && (
                    <span className="text-[10px] font-bold text-green-400">
                      ₦{freelancerEarnings.toLocaleString()}
                    </span>
                  )}
                </div>
              </Link>
            )}

            {/* Avatar / Profile */}
            <button
              onClick={goToProfile}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all"
              style={{ borderColor: navAccent }}
              title={`View ${isClient ? 'client' : 'freelancer'} profile`}
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 transition-colors duration-300"
                style={{ backgroundColor: navBadgeBg, color: navBadgeText }}
              >
                {initials}
              </div>
              <span className="text-sm font-semibold max-w-[100px] truncate" style={{ color: navText }}>{firstName}</span>
            </button>

            {/* Help & Support — Icon Only */}
            <Link
              to="/support"
              className="p-2 rounded-lg transition-colors"
              style={{ color: isActive('/support') ? navAccent : (isClient ? '#6b7280' : 'rgba(236,232,239,0.6)') }}
              title="Help & Support"
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = navHoverBg)}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <Headset className="w-5 h-5" />
            </Link>

            {/* Notification Bell */}
            <NotificationBell />

            {/* Logout — icon only */}
            <button
              onClick={onLogout}
              className="p-2 rounded-lg transition-colors"
              style={{ color: isClient ? '#6b7280' : 'rgba(236,232,239,0.6)' }}
              title="Logout"
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = isClient ? '#fee2e2' : 'rgba(220,38,38,0.15)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>

          {/* RIGHT: Mobile — compact controls */}
          <div className="md:hidden flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {/* Compact Mode Toggle */}
            <button
              onClick={handleModeToggle}
              className="text-[10px] sm:text-xs px-2 py-1.5 rounded-lg font-bold border leading-none whitespace-nowrap transition-all"
              style={{ color: navAccent, borderColor: navAccent, backgroundColor: navToggleBg }}
            >
              {isClient ? 'Client' : 'Freelancer'}
            </button>

            {/* Compact Wallet */}
            {isClient ? (
              <Link to="/wallet" className="text-[10px] sm:text-xs font-bold text-green-600 bg-green-50 border border-green-100 px-2 py-1.5 rounded-lg leading-none whitespace-nowrap">
                {wallet ? `₦${(wallet.available_balance / 1000).toFixed(1)}k` : '₦0'}
              </Link>
            ) : (
              <Link to="/my-earnings" className="text-[10px] sm:text-xs font-bold text-green-600 bg-green-50 border border-green-100 px-2 py-1.5 rounded-lg leading-none whitespace-nowrap">
                {freelancerEarnings !== null ? `₦${(freelancerEarnings / 1000).toFixed(1)}k` : '₦0'}
              </Link>
            )}

            <Link
              to="/messages"
              className="relative p-1.5 transition-colors"
              style={{ color: isClient ? '#6b7280' : 'rgba(236,232,239,0.6)' }}
            >
              <MessageCircle className="w-5 h-5" />
              {pendingRequestsCount > 0 && (
                <span className="absolute top-0 right-0 bg-red-500 text-white text-[9px] font-bold px-1 rounded-full border border-white">
                  {pendingRequestsCount}
                </span>
              )}
            </Link>

            <button
              className="p-1.5 flex items-center gap-1 transition-colors duration-300"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{ color: navAccent }}
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors duration-300"
                style={{ backgroundColor: navBadgeBg, color: navBadgeText }}
              >
                {initials}
              </div>
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

        </div>{/* end top bar */}


        {/* Sub-nav — strictly mode-separated (Desktop only) */}
        <div className="border-t hidden md:block transition-colors duration-300" style={{ borderTopColor: isClient ? 'rgba(37,99,235,0.1)' : 'rgba(236,232,239,0.15)' }}>
          <div className="flex gap-1 py-2 overflow-x-auto">
            {isClient ? (
              /* ── CLIENT mode ── */
              <>
                <Link to="/" className={navLink(isActive('/') && location.pathname === '/', isClient)}>My Posted Jobs</Link>
                <Link to="/ongoing-jobs" className={navLink(isActive('/ongoing-jobs'), isClient)}>Ongoing Jobs</Link>
                <Link to="/browse-freelancers" className={navLink(isActive('/browse-freelancers'), isClient)}>Browse Freelancers</Link>
                <Link
                  to="/messages"
                  className={`${navLink(isActive('/messages'), isClient)} flex items-center gap-1.5`}
                >
                  <MessageCircle className="w-4 h-4" />
                  Messages
                </Link>
              </>
            ) : (
              /* ── FREELANCER mode ── */
              <>
                <Link to="/find-work" className={navLink(isActive('/find-work'), isClient)}>Find Work</Link>
                <Link to="/my-proposals" className={navLink(isActive('/my-proposals'), isClient)}>My Proposals</Link>
                <Link
                  to="/messages"
                  className={`${navLink(isActive('/messages'), isClient)} relative flex items-center gap-1.5`}
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
        <div
          className="md:hidden border-t p-4"
          style={{ backgroundColor: isClient ? '#f9fafb' : '#0a0a40', borderTopColor: navBorderColor }}
        >
          <div className="space-y-2">
            <button
              onClick={() => { goToProfile(); setMobileMenuOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors text-left"
              style={{ backgroundColor: isClient ? '#fff' : 'rgba(236,232,239,0.08)', borderColor: isClient ? '#e5e7eb' : 'rgba(236,232,239,0.2)' }}
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center font-bold flex-shrink-0 transition-colors duration-300"
                style={{ backgroundColor: navBadgeBg, color: navBadgeText }}
              >
                {initials}
              </div>
              <div>
                <p className="font-semibold text-sm" style={{ color: navText }}>{currentUser?.full_name}</p>
                <p className="text-xs" style={{ color: isClient ? '#6b7280' : 'rgba(236,232,239,0.5)' }}>
                  {viewMode === 'selling' ? 'View freelancer profile' : 'View client profile'}
                </p>
              </div>
            </button>

            {/* Mode-specific Nav Links */}
            <div className="py-2 space-y-1">
              {isClient ? (
                <>
                  <Link to="/" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 px-4 py-2 font-medium rounded-lg text-gray-700 hover:bg-gray-100">
                    <Briefcase className="w-4 h-4" />
                    My Posted Jobs
                  </Link>
                  <Link to="/ongoing-jobs" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 px-4 py-2 font-medium rounded-lg text-gray-700 hover:bg-gray-100">
                    <Clock className="w-4 h-4" />
                    Ongoing Jobs
                  </Link>
                  <Link to="/browse-freelancers" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 px-4 py-2 font-medium rounded-lg text-gray-700 hover:bg-gray-100">
                    <Users className="w-4 h-4" />
                    Browse Freelancers
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/find-work" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 px-4 py-2 font-medium rounded-lg" style={{ color: CREAM }}>
                    <Search className="w-4 h-4" />
                    Find Work
                  </Link>
                  <Link to="/my-proposals" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 px-4 py-2 font-medium rounded-lg" style={{ color: CREAM }}>
                    <FileText className="w-4 h-4" />
                    My Proposals
                  </Link>
                </>
              )}
            </div>

            <Link
              to="/support"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium mt-2"
              style={{ color: isClient ? '#374151' : CREAM }}
            >
              <Headset className="w-4 h-4" />
              Help & Support
            </Link>

            <button
              onClick={() => { onLogout(); setMobileMenuOpen(false); }}
              className="w-full text-left flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-red-500 hover:bg-red-50/30 mt-1"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>

          </div>
        </div>
      )}
    </nav>
  );
}

// Shared nav link class helper — used only for the sub-nav row
function navLink(active: boolean, isClient: boolean) {
  const BLUE  = '#2563eb';
  const CREAM = '#ECE8EF';
  const NAVY  = '#0E0E52';
  if (isClient) {
    return `px-4 py-2 rounded-lg transition-colors whitespace-nowrap font-medium ${
      active ? 'bg-blue-50 text-blue-600' : 'text-gray-800 hover:bg-gray-100'
    }`;
  }
  // Freelancer: sub-nav is still on the white navbar background (sub-nav inherits nav bg)
  return `px-4 py-2 rounded-lg transition-colors whitespace-nowrap font-medium ${
    active ? 'bg-[#ECE8EF]/20 text-[#ECE8EF]' : 'text-[#ECE8EF]/70 hover:bg-[#ECE8EF]/10'
  }`;
}
