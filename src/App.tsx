import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useStore } from './store/useStore';
import { supabase } from './lib/supabase';
import { useIdleTimeout } from './hooks/useIdleTimeout';
import { ToastProvider, useToast } from './lib/toast';
import { QK } from './lib/queryKeys';
import {
  fetchWallet, fetchConversationList, fetchOngoingJobs,
  fetchProposals, fetchEarnings,
} from './lib/queries';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import PostJob from './pages/client/PostJob';
import FindWork from './pages/freelancer/FindWork';
import JobDetails from './pages/JobDetails';
import Wallet from './pages/Wallet';
import MyHires from './pages/client/MyHires';
import OngoingJobs from './pages/client/OngoingJobs';
import MyProposals from './pages/freelancer/MyProposals';
import MyEarnings from './pages/freelancer/MyEarnings';
import BrowseFreelancersAdvanced from './pages/client/BrowseFreelancersAdvanced';
import SellerProfile from './pages/SellerProfile';
import Support from './pages/Support';
import ReviewJob from './pages/ReviewJob';
import AddPortfolioItem from './pages/freelancer/AddPortfolioItem';
import Messages from './pages/Messages';
import ClientProfile from './pages/ClientProfile';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ScrollToTop from './components/ScrollToTop';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminJobs from './pages/admin/AdminJobs';
import AdminSupport from './pages/admin/AdminSupport';

// Stable QueryClient singleton — shared across the whole app
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:        5 * 60 * 1000, // data stays fresh for 5 minutes
      gcTime:          10 * 60 * 1000, // keep unused cache for 10 minutes
      retry:           1,
      refetchOnWindowFocus: true,
    },
  },
});

function App() {
  const [loading, setLoading] = useState(true);
  const { currentUser, setCurrentUser, setWallet } = useStore();

  useEffect(() => {
    let checkTimeout: NodeJS.Timeout;

    // 1. Initial session check with safety timeout
    const checkUser = async () => {
      console.log("🏁 Starting initial session check...");
      
      // Safety timeout: stop spinning after 5 seconds no matter what
      checkTimeout = setTimeout(() => {
        console.warn("⚠️ Initial check exceeded 5s. Forcing spinner to close.");
        setLoading(false);
      }, 5000);

      try {
        if (!supabase) {
          console.error("❌ Supabase client is not initialized!");
          setLoading(false);
          return;
        }

        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        const session = data?.session;
        if (session?.user) {
          console.log(" Session found for user:", session.user.id);
          // Await the profile so currentUser is set BEFORE loading becomes false.
          // This prevents the login page flash on reload.
          await fetchProfile(session.user.id);
        } else {
          console.log(" No active session found.");
        }
      } catch (error) {
        console.error(" Error during initial session check:", error);
      } finally {
        console.log(" Initial check code reached finally block.");
        clearTimeout(checkTimeout);
        setLoading(false);
      }
    };

    checkUser();

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log("🔄 Auth state changed:", _event);
      if (session?.user) {
        fetchProfile(session.user.id).catch(err => console.error(err));
      } else {
        setCurrentUser(null);
        setWallet(null);
      }
    });

    return () => {
      subscription.unsubscribe();
      if (checkTimeout) clearTimeout(checkTimeout);
    };
  }, []);

  const fetchProfile = async (userId: string) => {
    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (profile) {
      setCurrentUser(profile);

      // Hydrate wallet into Zustand store (still needed for navbar balance display)
      await fetchWallet(userId).then((w) => { if (w) setWallet(w); }).catch(() => {});

      // Prefetch all data into React Query cache in parallel — pages read from
      // cache instantly instead of showing a loading spinner.
      const isFreelancer = false; // prefetch both modes to cover mode switching
      queryClient.prefetchQuery({ queryKey: QK.wallet(userId),                     queryFn: () => fetchWallet(userId) });
      queryClient.prefetchQuery({ queryKey: QK.conversations(userId, 'buying'),    queryFn: () => fetchConversationList(userId, false) });
      queryClient.prefetchQuery({ queryKey: QK.conversations(userId, 'selling'),   queryFn: () => fetchConversationList(userId, true) });
      queryClient.prefetchQuery({ queryKey: QK.ongoingJobs(userId),                queryFn: () => fetchOngoingJobs(userId) });
      queryClient.prefetchQuery({ queryKey: QK.proposals(userId),                  queryFn: () => fetchProposals(userId) });
      queryClient.prefetchQuery({ queryKey: QK.earnings(userId),                   queryFn: () => fetchEarnings(userId) });
    }
  };

  const fetchWalletLegacy = async (userId: string) => {
    const { data } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (data) setWallet(data);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setWallet(null);
  };

  console.log("App render:", { loading, hasUser: !!currentUser });

  if (loading) {
    console.log("Rendering spinner...");
    return (
      <div className="min-h-screen bg-blue-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!currentUser) {
    console.log("No user found after loading, rendering Login screen.");
    return <Login onLogin={() => {}} />;
  }

  console.log("User active, rendering main app routers.");
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthenticatedApp onLogout={handleLogout} />
      </ToastProvider>
    </QueryClientProvider>
  );
}

// ── /chat/:jobId → /messages?autoJobId=:jobId (legacy deep-link redirect) ──
function ChatJobRedirect() {
  const { jobId } = useParams<{ jobId: string }>();
  return <Navigate to={`/messages?autoJobId=${jobId}`} replace />;
}

// ── Authenticated shell (idle timeout lives here) ──────────────────────────
function AuthenticatedApp({ onLogout }: { onLogout: () => void }) {
  const { toast } = useToast();
  const { viewMode } = useStore();
  // Sign out automatically after 30 minutes of inactivity
  useIdleTimeout(30 * 60 * 1000, () => {
    toast.warning('You have been logged out due to inactivity.', 'Session Expired');
  });

  const isClient = viewMode === 'buying';
  // #ECE8EF (light muted lavender-grey) for client backgrounds, deep navy for freelancer
  const themeBg = isClient ? 'bg-[#ECE8EF]' : 'bg-[#0E0E52]';

  return (
    <BrowserRouter>
      {/* 
        NOTE: No overflow-auto on the wrapper — we let the document scroll naturally.
        This is required for the sticky navbar to work correctly.
      */}
      <div className={`min-h-screen flex flex-col transition-colors duration-500 ${themeBg}`}>
        <ScrollToTop />
        <Navbar onLogout={onLogout} />
        <main className="flex-1 flex flex-col">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/post-job" element={<PostJob />} />
            <Route path="/find-work" element={<FindWork />} />
            <Route path="/job/:jobId" element={<JobDetails />} />
            <Route path="/support" element={<Support />} />
            <Route path="/review/:jobId" element={<ReviewJob />} />
            <Route path="/wallet" element={<Wallet />} />
            <Route path="/my-hires" element={<MyHires />} />
            <Route path="/ongoing-jobs" element={<OngoingJobs />} />
            <Route path="/my-proposals" element={<MyProposals />} />
            <Route path="/my-earnings" element={<MyEarnings />} />
            <Route path="/browse-freelancers" element={<BrowseFreelancersAdvanced />} />
            <Route path="/seller/:sellerId" element={<SellerProfile />} />
            <Route path="/portfolio/new" element={<AddPortfolioItem />} />
            {/* Legacy chat routes — redirect to the unified Messages hub */}
            <Route path="/chat/:jobId" element={<ChatJobRedirect />} />
            <Route path="/chat-requests" element={<Navigate to="/messages" replace />} />
            <Route path="/direct-chat/:conversationId" element={<Navigate to="/messages" replace />} />
            <Route path="/my-messages" element={<Navigate to="/messages" replace />} />
            {/* Unified routes */}
            <Route path="/messages" element={<Messages />} />
            <Route path="/client/:clientId" element={<ClientProfile />} />

            {/* Admin routes */}
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/jobs" element={<AdminJobs />} />
            <Route path="/admin/support" element={<AdminSupport />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}

export default App;

