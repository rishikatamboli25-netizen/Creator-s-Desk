import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import ProductCard from '../components/ProductCard';

const Category = () => {
  const { categoryName } = useParams();
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Helper to turn URL slugs ("desk-organizers") back into readable names ("Desk Organizers")
  const formattedCategory = categoryName
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL

  useEffect(() => {
    const fetchCategoryProducts = async () => {
      setIsLoading(true);
      try {
        // Fetch products filtered by the category query parameter
        const response = await fetch(`${BACKEND_URL}/api/products?category=${encodeURIComponent(formattedCategory)}`);
        
        if (response.ok) {
          const data = await response.json();
          // Map MongoDB _id to id for the frontend components
          const formattedData = data.map(p => ({ ...p, id: p.slug }));
          setProducts(formattedData);
        }
      } catch (error) {
        console.error("Failed to fetch category products:", error);
      } finally {
        setIsLoading(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };

    fetchCategoryProducts();
  }, [categoryName, formattedCategory]);

  if (isLoading) {
    return <div className="min-h-[70vh] flex items-center justify-center uppercase tracking-widest text-sm text-creator-muted">Loading Collection...</div>;
  }

  return (
    <main className="min-h-screen bg-creator-white text-creator-black pb-24">
      
      {/* Category Header */}
      <div className="bg-creator-surface border-b border-creator-border py-16 px-8 text-center">
        <h1 className="text-4xl md:text-5xl font-light tracking-tighter mb-4">
          {formattedCategory}
        </h1>
        <p className="text-creator-muted text-sm uppercase tracking-widest">
          {products.length} {products.length === 1 ? 'Item' : 'Items'} Available
        </p>
      </div>

      {/* Product Grid */}
      <div className="max-w-7xl mx-auto px-8 pt-16">
        {products.length === 0 ? (
          <div className="text-center py-24">
            <h2 className="text-xl font-light mb-4">No products found in this category.</h2>
            <Link to="/" className="text-sm uppercase tracking-widest border-b border-creator-black pb-1 hover:text-creator-muted hover:border-creator-muted transition-colors">
              Return to All Products
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>

    </main>
  );
};

export default Category;