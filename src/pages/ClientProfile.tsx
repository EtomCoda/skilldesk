import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Star, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ClientUser {
  id: string;
  full_name: string;
  email: string;
  created_at: string;
}

interface ClientReview {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  reviewer: { id: string; full_name: string };
  job: { id: string; title: string };
}

interface ClientStats {
  jobsPosted: number;
  jobsCompleted: number;
}

export default function ClientProfile() {
  const { clientId } = useParams<{ clientId: string }>();
  const [client, setClient] = useState<ClientUser | null>(null);
  const [reviews, setReviews] = useState<ClientReview[]>([]);
  const [stats, setStats] = useState<ClientStats>({ jobsPosted: 0, jobsCompleted: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (clientId) fetchAll();
  }, [clientId]);

  const fetchAll = async () => {
    try {
      // User
      const { data: userData } = await supabase
        .from('users')
        .select('id, full_name, email, created_at')
        .eq('id', clientId)
        .single();
      setClient(userData);

      // Jobs they've posted
      const { data: jobs } = await supabase
        .from('jobs')
        .select('id, status')
        .eq('client_id', clientId);

      const postedCount = jobs?.length || 0;
      const completedCount = jobs?.filter((j) => j.status === 'completed').length || 0;

      setStats({ jobsPosted: postedCount, jobsCompleted: completedCount });

      // Reviews received as a client (reviewee_id = clientId)
      const { data: reviewData } = await supabase
        .from('reviews')
        .select('id, rating, comment, created_at, reviewer:reviewer_id(id, full_name), job:job_id(id, title)')
        .eq('reviewee_id', clientId)
        .order('created_at', { ascending: false });

      setReviews((reviewData as unknown as ClientReview[]) || []);
    } catch (err) {
      console.error('Error fetching client profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatJoinDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const avgRating =
    reviews.length > 0
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Profile not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 space-y-6">

        {/* Profile card */}
        <div className="bg-white rounded-2xl shadow-sm p-6 flex items-start gap-5">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)' }}
          >
            {client.full_name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-blue-950">{client.full_name}</h1>
            <div className="flex items-center gap-1.5 text-gray-400 text-sm mt-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>Client since {formatJoinDate(client.created_at)}</span>
            </div>
            {avgRating && (
              <div className="flex items-center gap-1.5 mt-2">
                <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                <span className="font-bold text-gray-900">{avgRating}</span>
                <span className="text-gray-400 text-sm">({reviews.length} review{reviews.length !== 1 ? 's' : ''})</span>
              </div>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Jobs Posted', value: stats.jobsPosted },
            { label: 'Completed', value: stats.jobsCompleted },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white rounded-xl shadow-sm p-4 text-center">
              <p className="text-lg font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          ))}
        </div>

        {/* Reviews section */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="text-lg font-bold text-blue-950 mb-4">
            Reviews from Freelancers
          </h2>

          {reviews.length === 0 ? (
            <div className="text-center py-10">
              <Star className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No reviews yet</p>
              <p className="text-gray-400 text-sm mt-1">
                Reviews from freelancers will appear here after completed jobs.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {reviews.map((review) => (
                <div key={review.id} className="border-b border-gray-100 pb-5 last:border-0 last:pb-0">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-700 font-bold text-xs">
                          {review.reviewer?.full_name?.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">
                          {review.reviewer?.full_name}
                        </p>
                        <p className="text-xs text-gray-400 truncate max-w-[180px]">
                          {review.job?.title}
                        </p>
                      </div>
                    </div>
                    {/* Stars */}
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`w-4 h-4 ${
                            s <= review.rating
                              ? 'text-yellow-400 fill-yellow-400'
                              : 'text-gray-200 fill-gray-200'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  {review.comment && (
                    <p className="text-sm text-gray-600 leading-relaxed">{review.comment}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-2">
                    {new Date(review.created_at).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                    })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
