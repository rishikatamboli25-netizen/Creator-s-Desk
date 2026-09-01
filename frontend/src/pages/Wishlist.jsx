import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { products } from '../data/products';

// Dedicated Skeleton for Wishlist Cards
const WishlistCardSkeleton = () => (
  <div className="flex flex-col border border-creator-border bg-creator-surface">
    <div className="aspect-square bg-gray-200 animate-pulse border-b border-creator-border" />
    <div className="p-6 flex flex-col flex-1 bg-creator-white">
      <div className="h-3 w-1/3 bg-gray-200 animate-pulse mb-3" />
      <div className="h-4 w-3/4 bg-gray-200 animate-pulse mb-3" />
      <div className="h-4 w-1/4 bg-gray-200 animate-pulse mb-6" />
      <div className="mt-auto w-full h-[42px] bg-gray-200 animate-pulse border border-gray-200" />
    </div>
  </div>
);

const Wishlist = () => {
  const { addToCart } = useCart();
  
  const [wishlistItems, setWishlistItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Simulating an API fetch so the skeleton is visible 
  // (Replace this with actual DB fetch when ready)
  useEffect(() => {
    const fetchWishlist = async () => {
      setIsLoading(true);
      try {
        // Simulating network delay
        await new Promise(resolve => setTimeout(resolve, 800));
        setWishlistItems([products[0], products[3]]);
      } catch (error) {
        console.error("Failed to fetch wishlist", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWishlist();
  }, []);

  const handleRemove = (productId) => {
    setWishlistItems(prev => prev.filter(item => item.id !== productId));
  };

  const handleMoveToCart = (product) => {
    addToCart(product);
    handleRemove(product.id);
  };

  // Helper for generating exactly 3 skeletons for the grid
  const skeletonArray = Array.from({ length: 3 });

  return (
    <main className="min-h-[calc(100vh-89px)] bg-creator-white text-creator-black max-w-7xl mx-auto px-8 py-16">
      
      {/* Header - Loads Instantly */}
      <div className="mb-12 border-b border-creator-border pb-6 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-light tracking-tight">Your Wishlist</h1>
          <p className="mt-2 text-creator-muted text-sm tracking-wide">Saved items for your future setup.</p>
        </div>
        <div className="text-sm font-medium text-creator-muted">
          {isLoading ? (
             <div className="h-4 w-16 bg-gray-200 animate-pulse rounded" />
          ) : (
            `${wishlistItems.length} ${wishlistItems.length === 1 ? 'Item' : 'Items'}`
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        // 1. Loading State
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
          {skeletonArray.map((_, idx) => (
            <WishlistCardSkeleton key={idx} />
          ))}
        </div>
      ) : wishlistItems.length > 0 ? (
        // 2. Loaded State with Items
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
          {wishlistItems.map((product) => (
            <div key={product.id} className="group flex flex-col border border-creator-border bg-creator-surface relative">
              
              {/* Remove Button */}
              <button 
                onClick={() => handleRemove(product.id)}
                className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center bg-white/80 backdrop-blur hover:bg-white text-creator-black border border-creator-border transition-all opacity-0 group-hover:opacity-100"
                title="Remove from Wishlist"
              >
                &times;
              </button>

              <Link to={`/product/${product.id}`} className="aspect-square overflow-hidden border-b border-creator-border">
                <img 
                  src={product.image} 
                  alt={product.name} 
                  className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                />
              </Link>
              
              <div className="p-6 flex flex-col flex-1 bg-creator-white">
                <span className="text-xs uppercase tracking-widest text-creator-muted mb-2">{product.category}</span>
                <Link to={`/product/${product.id}`}>
                  <h3 className="text-sm font-medium truncate hover:underline underline-offset-4">{product.name}</h3>
                </Link>
                <span className="text-sm font-medium mt-2 mb-6">${product.price}</span>
                
                <button 
                  onClick={() => handleMoveToCart(product)}
                  className="mt-auto w-full py-3 text-xs uppercase tracking-widest font-medium border border-creator-black hover:bg-creator-black hover:text-creator-white transition-colors"
                >
                  Move to Cart
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        // 3. Empty State
        <div className="py-32 flex flex-col items-center justify-center border border-dashed border-creator-border bg-creator-surface/50">
          <svg className="w-12 h-12 text-creator-muted mb-6" fill="none" stroke="currentColor" strokeWidth="1" viewBox="0 0 24 24">
            <path strokeLinecap="square" strokeLinejoin="miter" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
          </svg>
          <h2 className="text-xl font-light mb-2 text-creator-black">Your wishlist is empty</h2>
          <p className="text-sm text-creator-muted mb-8 text-center max-w-sm">
            Keep track of the tools you want. Click the heart icon on any product to save it here.
          </p>
          <Link to="/" className="px-8 py-3 bg-creator-black text-creator-white text-xs uppercase tracking-widest hover:bg-gray-900 transition-colors">
            Explore Gear
          </Link>
        </div>
      )}

    </main>
  );
};

export default Wishlist;