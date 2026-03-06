import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Star, Filter } from 'lucide-react';
import { supabase, User as UserType } from '../lib/supabase';
import { useStore } from '../store/useStore';

interface FreelancerWithStats extends UserType {
  stats?: {
    total_jobs_completed: number;
    average_rating: number;
    total_reviews: number;
  };
}

const DOMAINS = [
  'Graphic Design',
  'Web Development',
  'Writing',
  'Programming',
  'Data Analysis',
  'Video Editing',
  'Photography',
  'Tutoring',
  'Social Media',
  'Virtual Assistant',
];

export default function BrowseFreelancersAdvanced() {
  const navigate = useNavigate();
  const currentUser = useStore((state) => state.currentUser);
  const [freelancers, setFreelancers] = useState<FreelancerWithStats[]>([]);
  const [filtered, setFiltered] = useState<FreelancerWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [minRating, setMinRating] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchFreelancers();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [freelancers, searchQuery, selectedDomains, minRating]);

  const fetchFreelancers = async () => {
    try {
      const { data: usersData } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (usersData) {
        // Only show users who have set up their freelancer profile (have bio or skills)
        const validFreelancers = usersData.filter(user => 
          ((user.bio && user.bio.trim() !== '') || (user.skills && user.skills.trim() !== '')) &&
          user.id !== currentUser?.id
        );

        const freelancersWithStats = await Promise.all(
          validFreelancers.map(async (user) => {
            const { data: statsData } = await supabase
              .from('seller_stats')
              .select('*')
              .eq('user_id', user.id)
              .maybeSingle();

            return { ...user, stats: statsData || undefined };
          })
        );

        setFreelancers(freelancersWithStats);
      }
    } catch (err) {
      console.error('Error fetching freelancers:', err);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let result = freelancers;

    if (searchQuery) {
      result = result.filter(
        (f) =>
          f.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          f.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
          f.bio?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedDomains.length > 0) {
      result = result.filter(
        (f) =>
          selectedDomains.some((domain) =>
            f.skills?.toLowerCase().includes(domain.toLowerCase())
          ) || selectedDomains.some((domain) => f.bio?.toLowerCase().includes(domain.toLowerCase()))
      );
    }

    if (minRating > 0) {
      result = result.filter((f) => (f.stats?.average_rating || 0) >= minRating);
    }

    setFiltered(result);
  };

  const toggleDomain = (domain: string) => {
    setSelectedDomains((prev) =>
      prev.includes(domain) ? prev.filter((d) => d !== domain) : [...prev, domain]
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4">
          <p className="text-center text-gray-600">Loading freelancers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Browse Talented Freelancers</h1>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or skills..."
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-2 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-6 py-3 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 md:w-auto w-full justify-center"
            >
              <Filter className="w-5 h-5" />
              Filters
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-bold text-gray-900 mb-3">Expertise Domains</h3>
                <div className="space-y-2">
                  {DOMAINS.map((domain) => (
                    <label key={domain} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedDomains.includes(domain)}
                        onChange={() => toggleDomain(domain)}
                        className="w-4 h-4 rounded"
                        style={{ accentColor: 'rgb(37, 99, 235)' }}
                      />
                      <span className="text-gray-700">{domain}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-bold text-gray-900 mb-3">Minimum Rating</h3>
                <div className="space-y-4">
                  {[0, 3, 4, 4.5].map((rating) => (
                    <label key={rating} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="rating"
                        checked={minRating === rating}
                        onChange={() => setMinRating(rating)}
                        className="w-4 h-4"
                        style={{ accentColor: 'rgb(37, 99, 235)' }}
                      />
                      <span className="text-gray-700">
                        {rating === 0 ? 'Any Rating' : `${rating}+ Stars`}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {(selectedDomains.length > 0 || minRating > 0) && (
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => {
                    setSelectedDomains([]);
                    setMinRating(0);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Clear All
                </button>
              </div>
            )}
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <p className="text-gray-600">No freelancers found. Try adjusting your filters.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((freelancer) => (
              <div
                key={freelancer.id}
                className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-lg transition-shadow cursor-pointer border border-gray-200"
                onClick={() => navigate(`/seller/${freelancer.id}`)}
              >
                <div className="h-32 bg-gradient-to-br from-blue-100 to-blue-50" />

                <div className="px-6 py-4 text-center -mt-12 pb-6 relative">
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg border-4 border-white">
                    <span className="text-2xl font-bold" style={{ color: 'rgb(37, 99, 235)' }}>
                      {freelancer.full_name.charAt(0)}
                    </span>
                  </div>

                  <h3 className="font-bold text-lg text-gray-900 mb-1">{freelancer.full_name}</h3>

                  {freelancer.stats && (
                    <div className="flex items-center justify-center gap-3 mb-3">
                      <div className="flex items-center gap-1">
                        <Star
                          className="w-4 h-4"
                          style={{ color: 'rgb(37, 99, 235)', fill: 'rgb(37, 99, 235)' }}
                        />
                        <span className="font-semibold text-gray-900">
                          {freelancer.stats.average_rating.toFixed(1)}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        ({freelancer.stats.total_reviews} reviews)
                      </span>
                    </div>
                  )}

                  {freelancer.bio && (
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">{freelancer.bio}</p>
                  )}

                  {freelancer.skills && (
                    <div className="flex flex-wrap gap-1 justify-center mb-4">
                      {freelancer.skills.split(',').slice(0, 3).map((skill, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 rounded-full text-xs font-medium"
                          style={{ backgroundColor: 'rgba(37, 99, 235, 0.1)', color: 'rgb(37, 99, 235)' }}
                        >
                          {skill.trim()}
                        </span>
                      ))}
                      {freelancer.skills.split(',').length > 3 && (
                        <span className="text-xs text-gray-500">
                          +{freelancer.skills.split(',').length - 3} more
                        </span>
                      )}
                    </div>
                  )}

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/seller/${freelancer.id}`);
                    }}
                    className="w-full px-4 py-2 rounded-lg font-semibold text-white transition-all hover:shadow-lg"
                    style={{ backgroundColor: 'rgb(37, 99, 235)' }}
                  >
                    View Profile
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
