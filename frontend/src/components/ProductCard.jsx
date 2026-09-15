import React from 'react';
import { Link } from 'react-router-dom';
import { buildProductUrl } from '../utils/routeTokens';

const ProductCard = ({ product }) => {
  return (
    // Added product.id to the fallback chain
    <Link to={buildProductUrl(product)} className="group cursor-pointer block">
      <div className="aspect-square bg-creator-surface overflow-hidden mb-6">
        <img 
          src={product.image || product.assets?.thumbnailUrl || 'https://images.unsplash.com/photo-1527443154391-507e9dc6c5cc?auto=format&fit=crop&q=80&w=800'} 
          alt={product.name}
          className="w-full h-full object-cover grayscale opacity-90 group-hover:grayscale-0 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700 ease-in-out"
        />
      </div>
      
      <div className="flex justify-between items-start">
        <div>
          <p className="text-xs text-creator-muted uppercase tracking-widest mb-1">
            {product.category}
          </p>
          <h3 className="text-lg font-medium">{product.name}</h3>
          <p className="text-sm text-creator-muted mt-1">{product.material}</p>
        </div>
        <div className="text-lg font-medium">
          ${product.price}
        </div>
      </div>
    </Link>
  );
};

export default ProductCard;