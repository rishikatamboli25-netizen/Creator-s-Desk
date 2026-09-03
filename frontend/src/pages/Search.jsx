import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import ProductCard from '../components/ProductCard';

const Search = () => {
  const location = useLocation();
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Extract the search query from the URL (e.g., ?q=keycaps)
  const searchParams = new URLSearchParams(location.search);
  const query = searchParams.get('q') || '';

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL

  useEffect(() => {
    const fetchSearchResults = async () => {
      setIsLoading(true);
      try {
        // Fetch all products
        const response = await fetch(`${BACKEND_URL}/api/products`);
        
        if (response.ok) {
          const allProducts = await response.json();
          
          // Filter products where the name OR description includes the search term (case-insensitive)
          const lowerCaseQuery = query.toLowerCase();
          const filtered = allProducts.filter(product => 
            product.name.toLowerCase().includes(lowerCaseQuery) || 
            product.description.toLowerCase().includes(lowerCaseQuery)
          );
          
          // Map _id to id for the ProductCard
          const formattedData = filtered.map(p => ({ ...p, id: p.slug }));
          setResults(formattedData);
        }
      } catch (error) {
        console.error("Failed to fetch search results:", error);
      } finally {
        setIsLoading(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };

    if (query) {
      fetchSearchResults();
    } else {
      setResults([]);
      setIsLoading(false);
    }
  }, [query]);

  if (isLoading) {
    return <div className="min-h-[70vh] flex items-center justify-center uppercase tracking-widest text-sm text-creator-muted">Searching...</div>;
  }

  return (
    <main className="min-h-screen bg-creator-white text-creator-black pb-24">
      {/* Search Header */}
      <div className="bg-creator-surface border-b border-creator-border py-16 px-8 text-center">
        <h1 className="text-3xl md:text-4xl font-light tracking-tighter mb-4">
          Search Results for "{query}"
        </h1>
        <p className="text-creator-muted text-sm uppercase tracking-widest">
          {results.length} {results.length === 1 ? 'Match' : 'Matches'} Found
        </p>
      </div>

      {/* Results Grid */}
      <div className="max-w-7xl mx-auto px-8 pt-16">
        {results.length === 0 ? (
          <div className="text-center py-24">
            <h2 className="text-xl font-light mb-4">We couldn't find anything matching your search.</h2>
            <Link to="/" className="text-sm uppercase tracking-widest border-b border-creator-black pb-1 hover:text-creator-muted hover:border-creator-muted transition-colors">
              Continue Shopping
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
            {results.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
};

export default Search;