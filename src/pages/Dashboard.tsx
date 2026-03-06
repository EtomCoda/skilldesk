import { useStore } from '../store/useStore';
import { Briefcase, ShoppingBag, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { currentUser, viewMode } = useStore();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-xl shadow-sm p-8 mb-8">
          <h1 className="text-3xl font-bold text-blue-950 mb-2">
            Welcome back, {currentUser?.full_name}!
          </h1>
          <p className="text-gray-600">
            You are currently in <span className="font-semibold">{viewMode === 'buying' ? 'Client' : 'Freelancer'}</span> mode
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {viewMode === 'buying' ? (
            <>
              <Link
                to="/post-job"
                className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow border-2 border-transparent hover:border-blue-950"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <Briefcase className="w-6 h-6 text-blue-950" />
                  </div>
                  <h2 className="text-xl font-bold text-blue-950">Post a Job</h2>
                </div>
                <p className="text-gray-600 mb-4">
                  Create a new job posting and hire talented PAU students for your projects.
                </p>
                <div className="flex items-center text-blue-950 font-medium">
                  Get started <ArrowRight className="w-4 h-4 ml-2" />
                </div>
              </Link>

              <Link
                to="/my-hires"
                className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow border-2 border-transparent hover:border-blue-950"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <ShoppingBag className="w-6 h-6 text-blue-950" />
                  </div>
                  <h2 className="text-xl font-bold text-blue-950">My Hires</h2>
                </div>
                <p className="text-gray-600 mb-4">
                  Manage your active jobs, track progress, and review completed work.
                </p>
                <div className="flex items-center text-blue-950 font-medium">
                  View hires <ArrowRight className="w-4 h-4 ml-2" />
                </div>
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/find-work"
                className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow border-2 border-transparent hover:border-blue-950"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <Briefcase className="w-6 h-6 text-blue-950" />
                  </div>
                  <h2 className="text-xl font-bold text-blue-950">Find Work</h2>
                </div>
                <p className="text-gray-600 mb-4">
                  Browse available jobs and submit proposals to clients.
                </p>
                <div className="flex items-center text-blue-950 font-medium">
                  Browse jobs <ArrowRight className="w-4 h-4 ml-2" />
                </div>
              </Link>

              <Link
                to="/my-proposals"
                className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow border-2 border-transparent hover:border-blue-950"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <ShoppingBag className="w-6 h-6 text-blue-950" />
                  </div>
                  <h2 className="text-xl font-bold text-blue-950">My Proposals</h2>
                </div>
                <p className="text-gray-600 mb-4">
                  Track your submitted proposals and respond to client messages.
                </p>
                <div className="flex items-center text-blue-950 font-medium">
                  View proposals <ArrowRight className="w-4 h-4 ml-2" />
                </div>
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
