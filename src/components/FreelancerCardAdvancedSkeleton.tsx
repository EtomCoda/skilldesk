export default function FreelancerCardAdvancedSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200 animate-pulse">
      <div className="h-32 bg-gray-200"></div>

      <div className="px-6 py-4 text-center -mt-12 pb-6 relative">
        <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg border-4 border-white"></div>

        <div className="h-5 bg-gray-200 rounded w-3/4 mx-auto mb-3"></div>

        <div className="flex items-center justify-center gap-3 mb-3">
          <div className="h-4 bg-gray-200 rounded w-16"></div>
          <div className="h-4 bg-gray-200 rounded w-24"></div>
        </div>

        <div className="space-y-2 mb-3">
          <div className="h-3 bg-gray-200 rounded w-full"></div>
          <div className="h-3 bg-gray-200 rounded w-5/6 mx-auto"></div>
        </div>

        <div className="flex flex-wrap gap-2 justify-center mb-4">
          <div className="h-5 bg-gray-200 rounded-full w-16"></div>
          <div className="h-5 bg-gray-200 rounded-full w-20"></div>
          <div className="h-5 bg-gray-200 rounded-full w-24"></div>
        </div>

        <div className="h-9 bg-gray-200 rounded w-full"></div>
      </div>
    </div>
  );
}
