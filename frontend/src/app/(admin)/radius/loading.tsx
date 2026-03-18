export default function RadiusLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-4 w-64 bg-gray-200 dark:bg-gray-700 rounded mt-2" />
        </div>
        <div className="h-10 w-36 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 bg-gray-200 dark:bg-gray-700 rounded-xl" />
        ))}
      </div>

      <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded-xl" />

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <div className="space-y-3">
          <div className="flex gap-4 border-b border-gray-200 dark:border-gray-700 pb-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-4 flex-1 bg-gray-200 dark:bg-gray-700 rounded" />
            ))}
          </div>
          {Array.from({ length: 8 }).map((_, rowIdx) => (
            <div key={rowIdx} className="flex gap-4 py-2">
              {Array.from({ length: 7 }).map((_, colIdx) => (
                <div key={colIdx} className="h-4 flex-1 bg-gray-200 dark:bg-gray-700 rounded" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
