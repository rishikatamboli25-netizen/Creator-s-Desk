import React from 'react';

const ProductDetailSkeleton = () => {
  return (
    <main className="min-h-screen bg-creator-white pb-24">
      {/* Utility Header / Breadcrumbs */}
      <div className="border-b border-creator-border px-8 py-4 flex justify-between items-center">
        <div className="h-4 w-16 bg-gray-200 animate-pulse rounded" />
        <div className="h-4 w-24 bg-gray-200 animate-pulse rounded" />
      </div>

      {/* Main Product Section */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 px-8 mt-12 pb-24 border-b border-creator-border">
        
        {/* Left Column: Image Gallery */}
        <div className="w-full flex flex-col gap-4">
          <div className="aspect-square bg-gray-200 animate-pulse border border-creator-border" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="aspect-square bg-gray-200 animate-pulse border border-creator-border" />
            ))}
          </div>
        </div>

        {/* Right Column: Expanded Details & Actions */}
        <div className="flex flex-col py-10 lg:py-0">
          <div className="h-10 md:h-12 w-3/4 bg-gray-200 animate-pulse mb-3 rounded" />
          <div className="h-10 md:h-12 w-1/2 bg-gray-200 animate-pulse mb-4 rounded" />
          
          <div className="h-8 w-24 bg-gray-200 animate-pulse mb-8 rounded" />

          {/* Action Buttons */}
          <div className="space-y-4 mb-12">
            <div className="w-full h-[60px] bg-gray-200 animate-pulse rounded" />
            <div className="grid grid-cols-2 gap-4">
              <div className="h-[50px] bg-gray-200 animate-pulse rounded" />
              <div className="h-[50px] bg-gray-200 animate-pulse rounded" />
            </div>
          </div>

          {/* Expanded Description Area */}
          <div className="space-y-10 border-t border-creator-border pt-10">
            <div>
              <div className="h-4 w-32 bg-gray-200 animate-pulse mb-4 rounded" />
              <div className="space-y-3">
                <div className="h-4 w-full bg-gray-200 animate-pulse rounded" />
                <div className="h-4 w-full bg-gray-200 animate-pulse rounded" />
                <div className="h-4 w-3/4 bg-gray-200 animate-pulse rounded" />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-8">
              <div>
                <div className="h-4 w-20 bg-gray-200 animate-pulse mb-3 rounded" />
                <div className="h-4 w-full bg-gray-200 animate-pulse rounded" />
              </div>
              <div>
                <div className="h-4 w-24 bg-gray-200 animate-pulse mb-3 rounded" />
                <div className="h-4 w-11/12 bg-gray-200 animate-pulse rounded" />
              </div>
            </div>

            <div>
              <div className="h-4 w-28 bg-gray-200 animate-pulse mb-5 rounded" />
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-3 items-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-pulse shrink-0" />
                    <div className="h-4 w-2/3 bg-gray-200 animate-pulse rounded" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Shipping Guarantees */}
          <div className="mt-12 h-[120px] bg-gray-100 animate-pulse border border-creator-border rounded" />
        </div>
      </div>
    </main>
  );
};

export default ProductDetailSkeleton;