import React from 'react';

const ProductCardSkeleton = () => {
  return (
    <div className="block w-full">
      {/* Image Placeholder (Matches aspect-square and mb-6) */}
      <div className="aspect-square bg-gray-200 animate-pulse mb-6" />
      
      {/* Details Container */}
      <div className="flex justify-between items-start">
        <div className="w-full pr-4">
          {/* Category */}
          <div className="h-3 w-1/3 bg-gray-200 animate-pulse mb-2" />
          {/* Title */}
          <div className="h-5 w-3/4 bg-gray-200 animate-pulse mb-2" />
          {/* Material */}
          <div className="h-4 w-1/2 bg-gray-200 animate-pulse mt-2" />
        </div>
        {/* Price */}
        <div className="h-5 w-1/5 bg-gray-200 animate-pulse" />
      </div>
    </div>
  );
};

export default ProductCardSkeleton;