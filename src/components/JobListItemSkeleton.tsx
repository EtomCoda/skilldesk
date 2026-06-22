export default function JobListItemSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100 animate-pulse">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <div className="h-6 bg-gray-200 rounded w-1/2"></div>
            <div className="h-5 bg-gray-200 rounded-full w-20"></div>
          </div>
          
          <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6 mb-3"></div>
          
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <div className="h-4 bg-gray-200 rounded w-40"></div>
            <div className="h-4 bg-gray-200 rounded w-32"></div>
          </div>
        </div>
        
        <div className="text-right">
          <div className="h-5 bg-gray-200 rounded w-24 mb-3 ml-auto"></div>
          <div className="h-4 bg-gray-200 rounded w-32 ml-auto"></div>
        </div>
      </div>
    </div>
  );
}
