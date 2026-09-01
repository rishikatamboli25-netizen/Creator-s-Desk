import React, { useState, useEffect } from 'react';
import ProductCard from '../components/ProductCard';
import ProductCardSkeleton from '../components/ProductCardSkeleton';

const Organizers = () => {
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCategoryProducts = async () => {
      try {
        const response = await fetch('https://creator-s-desk-api-gateway.onrender.com/api/products');
        if (!response.ok) throw new Error('Failed to fetch catalog');
        
        const data = await response.json();
        
        // Filter for this specific category and map the ID
        const categoryProducts = data
          .filter(p => p.category === 'Desk Organizers')
          .map(p => ({ ...p, id: p.slug || p._id }));
          
        setProducts(categoryProducts);
      } catch (err) {
        console.error("Error:", err);
        setError("Could not load products. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchCategoryProducts();
  }, []);

  // Show 6 skeleton cards to fill out a standard grid layout
  const skeletonArray = Array.from({ length: 6 });

  return (
    <main className="max-w-7xl mx-auto mt-16 px-8 pb-24">
      <div className="mb-12">
        <h1 className="text-4xl font-light tracking-tight">Desk Organizers</h1>
        <p className="mt-2 text-creator-muted">Clear the clutter. Elevate the workspace.</p>
      </div>

      {error && (
        <div className="mb-8 text-sm uppercase tracking-widest text-red-500">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
        {isLoading 
          ? skeletonArray.map((_, i) => <ProductCardSkeleton key={i} />)
          : products.map((product) => <ProductCard key={product.id} product={product} />)
        }
      </div>
    </main>
  );
};

export default Organizers;