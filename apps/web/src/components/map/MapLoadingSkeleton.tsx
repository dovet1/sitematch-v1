'use client';

interface MapLoadingSkeletonProps {
  message?: string;
}

export function MapLoadingSkeleton({ message = "Loading map..." }: MapLoadingSkeletonProps) {
  return (
    <div className="relative h-96 w-full rounded-lg overflow-hidden border border-border bg-gray-50">
      {/* Skeleton map background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-green-50 to-blue-100" />
      
      {/* Animated wave overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
      
      {/* Skeleton markers */}
      <div className="absolute inset-0">
        {/* Mock marker positions */}
        <div className="absolute top-1/4 left-1/3 w-8 h-8 bg-purple-300 rounded-full animate-pulse opacity-60" />
        <div className="absolute top-1/2 left-1/2 w-8 h-8 bg-purple-400 rounded-full animate-pulse opacity-70 animation-delay-100" />
        <div className="absolute top-3/4 left-2/3 w-8 h-8 bg-purple-300 rounded-full animate-pulse opacity-60 animation-delay-200" />
        <div className="absolute top-1/3 left-3/4 w-8 h-8 bg-purple-500 rounded-full animate-pulse opacity-80 animation-delay-300" />
        <div className="absolute top-2/3 left-1/4 w-8 h-8 bg-purple-300 rounded-full animate-pulse opacity-60 animation-delay-400" />
      </div>
      
      {/* Loading overlay */}
      <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center">
        <div className="flex items-center gap-3 bg-white rounded-lg px-4 py-3 shadow-lg border border-border">
          <div className="animate-spin w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full" />
          <span className="text-sm text-muted-foreground font-medium">{message}</span>
        </div>
      </div>

      {/* Skeleton stats */}
      <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm border border-border rounded-lg px-3 py-2">
        <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
      </div>
    </div>
  );
}