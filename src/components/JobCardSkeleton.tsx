export default function JobCardSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 animate-pulse">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <div className="h-6 bg-gray-200 rounded w-3/4 mb-3"></div>
          <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6"></div>
        </div>
        <div className="ml-4">
          <div className="h-6 bg-gray-200 rounded w-32"></div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="h-5 bg-gray-200 rounded-md w-16"></div>
        <div className="h-5 bg-gray-200 rounded-md w-20"></div>
        <div className="h-5 bg-gray-200 rounded-md w-24"></div>
      </div>

      <div className="flex items-center justify-between">
        <div className="h-4 bg-gray-200 rounded w-32"></div>
        <div className="h-4 bg-gray-200 rounded w-40"></div>
      </div>
    </div>
  );
}
