/**
 * Skeleton Loader Components for better loading UX
 */

export function DashboardSkeleton() {
  return (
    <div className="flex min-h-screen bg-surface pt-20">
      {/* Sidebar skeleton */}
      <aside className="w-64 fixed left-0 top-20 bottom-0 bg-white border-r border-outline-variant/10 p-4 hidden lg:block">
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 bg-surface-container-low rounded-lg animate-pulse" />
          ))}
        </div>
      </aside>

      {/* Main content skeleton */}
      <main className="flex-1 lg:ml-64 p-8">
        {/* Header skeleton */}
        <div className="mb-12">
          <div className="h-10 bg-surface-container-low rounded-lg animate-pulse w-1/3 mb-4" />
          <div className="h-6 bg-surface-container-low rounded-lg animate-pulse w-1/4" />
        </div>

        {/* Stats skeleton */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white p-6 rounded-2xl border border-outline-variant/5">
              <div className="h-6 bg-surface-container-low rounded-lg animate-pulse mb-4" />
              <div className="h-10 bg-surface-container-low rounded-lg animate-pulse mb-2" />
              <div className="h-4 bg-surface-container-low rounded-lg animate-pulse w-2/3" />
            </div>
          ))}
        </section>

        {/* Events grid skeleton */}
        <section>
          <div className="h-8 bg-surface-container-low rounded-lg animate-pulse w-1/4 mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-[2.5rem] overflow-hidden border border-outline-variant/5">
                <div className="h-48 bg-surface-container-low animate-pulse" />
                <div className="p-4">
                  <div className="h-6 bg-surface-container-low rounded-lg animate-pulse mb-3" />
                  <div className="h-4 bg-surface-container-low rounded-lg animate-pulse w-2/3 mb-2" />
                  <div className="h-4 bg-surface-container-low rounded-lg animate-pulse w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export function EventCardSkeleton() {
  return (
    <div className="bg-white rounded-[2.5rem] overflow-hidden border border-outline-variant/5">
      <div className="h-48 bg-surface-container-low animate-pulse" />
      <div className="p-4">
        <div className="h-6 bg-surface-container-low rounded-lg animate-pulse mb-3" />
        <div className="h-4 bg-surface-container-low rounded-lg animate-pulse w-2/3 mb-2" />
        <div className="h-4 bg-surface-container-low rounded-lg animate-pulse w-1/2" />
      </div>
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-32 bg-surface-container-low rounded-2xl animate-pulse" />
      <div className="h-6 bg-surface-container-low rounded-lg animate-pulse w-1/3" />
      <div className="h-6 bg-surface-container-low rounded-lg animate-pulse w-1/2" />
    </div>
  );
}

