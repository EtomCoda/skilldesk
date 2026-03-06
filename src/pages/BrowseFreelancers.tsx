import { useState, useEffect } from 'react';
import { Search, User } from 'lucide-react';
import { supabase, User as UserType } from '../lib/supabase';
import { useStore } from '../store/useStore';

export default function BrowseFreelancers() {
  const currentUser = useStore((state) => state.currentUser);
  const [freelancers, setFreelancers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchFreelancers();
  }, []);

  const fetchFreelancers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const validFreelancers = data.filter(user => 
          ((user.bio && user.bio.trim() !== '') || (user.skills && user.skills.trim() !== '')) &&
          user.id !== currentUser?.id
        );
        setFreelancers(validFreelancers);
      }
    } catch (err) {
      console.error('Error fetching freelancers:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredFreelancers = freelancers.filter((freelancer) =>
    freelancer.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    freelancer.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    freelancer.skills?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    freelancer.bio?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-blue-950 mb-4">Browse Freelancers</h1>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search freelancers by name, skills, or bio..."
              className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-950 focus:border-transparent"
            />
          </div>
        </div>

        {filteredFreelancers.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <p className="text-gray-600">No freelancers found</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredFreelancers.map((freelancer) => (
              <div
                key={freelancer.id}
                className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                    {freelancer.avatar_url ? (
                      <img
                        src={freelancer.avatar_url}
                        alt={freelancer.full_name}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <User className="w-8 h-8 text-blue-950" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{freelancer.full_name}</h3>
                    <p className="text-sm text-gray-500">{freelancer.email}</p>
                  </div>
                </div>

                {freelancer.bio && (
                  <p className="text-gray-600 text-sm mb-3 line-clamp-3">{freelancer.bio}</p>
                )}

                {freelancer.skills && (
                  <div className="flex flex-wrap gap-2">
                    {freelancer.skills.split(',').map((skill, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-blue-100 text-blue-950 text-xs rounded-full"
                      >
                        {skill.trim()}
                      </span>
                    ))}
                  </div>
                )}

                {!freelancer.bio && !freelancer.skills && (
                  <p className="text-gray-400 text-sm italic">No profile information yet</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
