import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { products } from '../data/products';
import { buildCategoryUrl } from '../utils/routeTokens';

const CategoryPage = () => {
  const { categoryName } = useParams();
  const [sortBy, setSortBy] = useState('featured');

  // Format the URL param (e.g., "desk-organizers") back to the data format (e.g., "Desk Organizers")
  const formattedCategory = useMemo(() => {
    return categoryName
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }, [categoryName]);

  // Filter products by category
  const categoryProducts = useMemo(() => {
    if (!categoryName) return products;
    return products.filter(p => p.category === formattedCategory);
  }, [categoryName, formattedCategory]);

  // Apply Price Sorting
  const displayedProducts = useMemo(() => {
    let sorted = [...categoryProducts];
    if (sortBy === 'price-low') {
      sorted.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price-high') {
      sorted.sort((a, b) => b.price - a.price);
    }
    return sorted;
  }, [categoryProducts, sortBy]);

  // Reset sort when changing categories
  useEffect(() => {
    setSortBy('featured');
    window.scrollTo(0, 0);
  }, [categoryName]);

  return (
    <main className="min-h-screen bg-creator-white text-creator-black flex flex-col md:flex-row max-w-[1440px] mx-auto">
      
      {/* Left Sidebar: Filters & Navigation */}
      <aside className="w-full md:w-64 shrink-0 border-b md:border-b-0 md:border-r border-creator-border p-8 md:sticky md:top-[89px] md:h-[calc(100vh-89px)] overflow-y-auto">
        <h1 className="text-2xl font-light tracking-tight mb-10">{formattedCategory}</h1>
        
        <div className="space-y-8">
          {/* Price Sorting */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest mb-4">Sort By Price</h3>
            <div className="space-y-3 text-sm text-creator-muted">
              <label className="flex items-center gap-3 cursor-pointer hover:text-creator-black transition-colors">
                <input 
                  type="radio" 
                  name="sort" 
                  value="featured"
                  checked={sortBy === 'featured'}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="accent-creator-black"
                />
                Featured
              </label>
              <label className="flex items-center gap-3 cursor-pointer hover:text-creator-black transition-colors">
                <input 
                  type="radio" 
                  name="sort" 
                  value="price-low"
                  checked={sortBy === 'price-low'}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="accent-creator-black"
                />
                Price: Low to High
              </label>
              <label className="flex items-center gap-3 cursor-pointer hover:text-creator-black transition-colors">
                <input 
                  type="radio" 
                  name="sort" 
                  value="price-high"
                  checked={sortBy === 'price-high'}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="accent-creator-black"
                />
                Price: High to Low
              </label>
            </div>
          </div>

          {/* Quick Links */}
          <div className="pt-8 border-t border-creator-border">
            <h3 className="text-xs font-bold uppercase tracking-widest mb-4">All Categories</h3>
            <ul className="space-y-3 text-sm text-creator-muted">
              <li><Link to={buildCategoryUrl("desk-organizers")} className="hover:text-creator-black transition-colors">Desk Organizers</Link></li>
              <li><Link to={buildCategoryUrl("keycaps")} className="hover:text-creator-black transition-colors">Keycaps</Link></li>
              <li><Link to={buildCategoryUrl("accessories")} className="hover:text-creator-black transition-colors">Accessories</Link></li>
              <li><Link to={buildCategoryUrl("tech")} className="hover:text-creator-black transition-colors">Tech</Link></li>
            </ul>
          </div>
        </div>
      </aside>

      {/* Right Content: Product Grid */}
      <div className="flex-1 p-8 md:p-12">
        <div className="flex justify-between items-end mb-8">
          <p className="text-sm text-creator-muted">
            Showing {displayedProducts.length} results
          </p>
        </div>

        {displayedProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
            {displayedProducts.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="py-20 text-center border border-dashed border-creator-border">
            <h2 className="text-xl font-light mb-2">No products found</h2>
            <p className="text-sm text-creator-muted">We are currently restocking this category.</p>
          </div>
        )}
      </div>

    </main>
  );
};

export default CategoryPage;