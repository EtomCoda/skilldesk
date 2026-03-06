import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Star, ArrowLeft } from 'lucide-react';
import { supabase, Job, User as UserType } from '../lib/supabase';
import { useStore } from '../store/useStore';

export default function ReviewJob() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const currentUser = useStore((state) => state.currentUser);
  const [job, setJob] = useState<Job | null>(null);
  const [otherUser, setOtherUser] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [existingReview, setExistingReview] = useState(false);

  useEffect(() => {
    if (jobId && currentUser) {
      fetchJobData();
    }
  }, [jobId, currentUser]);

  const fetchJobData = async () => {
    try {
      const { data: jobData } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      setJob(jobData);

      const { data: hireData } = await supabase
        .from('hires')
        .select('*')
        .eq('job_id', jobId)
        .single();


      const otherUserId = currentUser?.id === jobData.client_id ? hireData?.freelancer_id : jobData.client_id;

      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', otherUserId)
        .single();

      setOtherUser(userData);

      const { data: existingReviewData } = await supabase
        .from('reviews')
        .select('*')
        .eq('job_id', jobId)
        .eq('reviewer_id', currentUser?.id)
        .maybeSingle();

      if (existingReviewData) {
        setExistingReview(true);
        setRating(existingReviewData.rating);
        setComment(existingReviewData.comment);
      }
    } catch (err) {
      console.error('Error fetching job data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !job || !otherUser || !comment.trim()) {
      alert('Please provide a comment');
      return;
    }

    setSubmitting(true);
    try {
      if (existingReview) {
        await supabase
          .from('reviews')
          .update({ rating, comment })
          .eq('job_id', jobId)
          .eq('reviewer_id', currentUser.id);
      } else {
        await supabase.from('reviews').insert({
          job_id: job.id,
          reviewer_id: currentUser.id,
          reviewee_id: otherUser.id,
          rating,
          comment,
        });
      }

      // Recalculate and upsert seller_stats for the person being reviewed
      const { data: allReviews } = await supabase
        .from('reviews')
        .select('rating')
        .eq('reviewee_id', otherUser.id);

      if (allReviews && allReviews.length > 0) {
        const totalReviews = allReviews.length;
        const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews;

        // Count completed jobs
        const { count: completedJobs } = await supabase
          .from('hires')
          .select('id', { count: 'exact', head: true })
          .eq('freelancer_id', otherUser.id)
          .eq('status', 'completed');

        await supabase.from('seller_stats').upsert(
          {
            user_id: otherUser.id,
            total_jobs_completed: completedJobs || 0,
            average_rating: Math.round(avgRating * 10) / 10,
            total_reviews: totalReviews,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );
      }

      alert('Review submitted successfully!');
      navigate(-1);
    } catch (err) {
      console.error('Error submitting review:', err);
      alert('Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <p className="text-center text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!job || !otherUser) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <p className="text-center text-gray-600">Job not found</p>
        </div>
      </div>
    );
  }

  const isClient = currentUser?.id === job.client_id;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 mb-6 text-gray-700 hover:text-gray-900 font-semibold"
        >
          <ArrowLeft className="w-5 h-5" />
          Go Back
        </button>

        <div className="bg-white rounded-xl shadow-sm p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {existingReview ? 'Edit Your Review' : 'Leave a Review'}
          </h1>
          <p className="text-gray-600 mb-8">
            {isClient ? `Review your experience working with ${otherUser.full_name}` : `Let the client know about your work on "${job.title}"`}
          </p>

          <form onSubmit={handleSubmitReview} className="space-y-6">
            <div>
              <label className="block text-lg font-semibold text-gray-900 mb-4">
                Your Rating
              </label>
              <div className="flex gap-4">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRating(value)}
                    className="transition-transform hover:scale-110"
                  >
                    <Star
                      className="w-10 h-10"
                      style={{
                        color: rating >= value ? 'rgb(37, 99, 235)' : '#d1d5db',
                        fill: rating >= value ? 'rgb(37, 99, 235)' : 'none',
                      }}
                    />
                  </button>
                ))}
              </div>
              <p className="mt-2 text-sm text-gray-600">
                {rating === 1 && 'Poor - Did not meet expectations'}
                {rating === 2 && 'Fair - Some issues encountered'}
                {rating === 3 && 'Good - Satisfactory work'}
                {rating === 4 && 'Very Good - Exceeded expectations'}
                {rating === 5 && 'Excellent - Outstanding work'}
              </p>
            </div>

            <div>
              <label htmlFor="comment" className="block text-lg font-semibold text-gray-900 mb-3">
                Your Feedback
              </label>
              <textarea
                id="comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share your experience working together. What went well? What could be improved?"
                rows={8}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                required
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-gray-700">
                <span className="font-semibold">Tips for a helpful review:</span> Be specific about what was good or bad, mention specific deliverables or skills, and be honest but professional.
              </p>
            </div>

            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="flex-1 px-6 py-3 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 px-6 py-3 rounded-lg font-semibold text-white transition-all hover:shadow-lg disabled:opacity-50"
                style={{ backgroundColor: 'rgb(37, 99, 235)' }}
              >
                {submitting ? 'Submitting...' : existingReview ? 'Update Review' : 'Submit Review'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
