import React from 'react';

const PaymentSkeleton = () => {
  return (
    <main className="min-h-[calc(100vh-89px)] bg-creator-white flex flex-col md:flex-row">
      {/* Left Column */}
      <div className="flex-1 flex flex-col justify-center px-8 md:px-24 py-12">
        {/* Brand */}
        <div className="mb-16">
          <div className="h-6 w-40 bg-gray-200 animate-pulse rounded" />
        </div>

        <div className="max-w-md w-full">
          {/* Back / Checkout */}
          <div className="flex items-center gap-4 mb-10">
            <div className="h-4 w-12 bg-gray-200 animate-pulse rounded" />
            <div className="h-4 w-3 bg-gray-200 animate-pulse rounded" />
            <div className="h-6 w-24 bg-gray-200 animate-pulse rounded" />
          </div>

          {/* Shipping Details */}
          <div className="space-y-4 mb-8">
            <div className="h-4 w-36 bg-gray-200 animate-pulse rounded mb-5" />

            <div className="w-full h-[58px] bg-gray-200 animate-pulse rounded" />

            <div className="w-full h-[58px] bg-gray-200 animate-pulse rounded" />

            <div className="grid grid-cols-2 gap-4">
              <div className="h-[58px] bg-gray-200 animate-pulse rounded" />
              <div className="h-[58px] bg-gray-200 animate-pulse rounded" />
            </div>
          </div>

          {/* Payment Method */}
          <div className="h-4 w-36 bg-gray-200 animate-pulse rounded mb-5" />

          <div className="space-y-4">
            <div className="w-full h-[58px] bg-gray-200 animate-pulse rounded" />
            <div className="w-full h-[58px] bg-gray-200 animate-pulse rounded" />
          </div>

          {/* Checkout Button */}
          <div className="w-full h-[60px] bg-gray-200 animate-pulse rounded mt-8" />
        </div>
      </div>

      {/* Right Column */}
      <div className="hidden md:flex md:w-[400px] lg:w-[500px] bg-creator-surface border-l border-creator-border flex-col p-12 relative">
        <div className="sticky top-12">
          {/* Heading */}
          <div className="h-4 w-28 bg-gray-200 animate-pulse rounded mb-8" />

          {/* Items Total */}
          <div className="flex justify-between items-center mb-5">
            <div className="h-4 w-24 bg-gray-200 animate-pulse rounded" />
            <div className="h-4 w-20 bg-gray-200 animate-pulse rounded" />
          </div>

          {/* Shipping */}
          <div className="flex justify-between items-center mb-8">
            <div className="h-4 w-20 bg-gray-200 animate-pulse rounded" />
            <div className="h-4 w-16 bg-gray-200 animate-pulse rounded" />
          </div>

          {/* Total */}
          <div className="border-t border-creator-border pt-6 flex justify-between items-center">
            <div className="h-8 w-20 bg-gray-200 animate-pulse rounded" />
            <div className="h-8 w-28 bg-gray-200 animate-pulse rounded" />
          </div>
        </div>
      </div>
    </main>
  );
};

export default PaymentSkeleton;