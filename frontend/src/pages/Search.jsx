import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import ProductCardSkeleton from '../components/Loading/ProductCardSkeleton';

// Fuzzy search logic (Levenshtein Distance)
const calculateDistance = (a, b) => {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  
  const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
  
  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, 
        matrix[j - 1][i] + 1, 
        matrix[j - 1][i - 1] + indicator
      );
    }
  }
  return matrix[b.length][a.length];
};

const Search = () => {
  const location = useLocation();
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const searchParams = new URLSearchParams(location.search);
  const query = searchParams.get('q') || '';

  useEffect(() => {
    const fetchSearchResults = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('https://creator-s-desk-api-gateway.onrender.com/api/products');
        
        if (response.ok) {
          const allProducts = await response.json();
          const lowerCaseQuery = query.toLowerCase().trim();
          
          // Split the user's search into individual words (ignoring spaces)
          const queryWords = lowerCaseQuery.split(/\s+/).filter(w => w.length > 0);
          
          const filtered = allProducts.filter(product => {
            // Smash ALL product text together so we search everywhere
            const searchableText = `${product.name || ''} ${product.category || ''} ${product.description || ''}`.toLowerCase();
            
            // 1. Direct Substring Match (e.g. typing "keyb" matches "keyboard")
            if (searchableText.includes(lowerCaseQuery)) return true;
            
            // 2. Deep Fuzzy Match
            // Extract all words from the product (removing punctuation)
            const productWords = searchableText.split(/\W+/).filter(w => w.length > 0);
            
            // Check if EVERY word the user typed fuzzy-matches at least one word in the product
            const isFuzzyMatch = queryWords.every(qWord => {
              return productWords.some(pWord => {
                // Skip comparing words that have a massive length difference to save CPU
                if (Math.abs(pWord.length - qWord.length) > 2) return false;
                
                // Allow up to 2 character mistakes (e.g., "kayboard" -> "keyboard" is 1 mistake)
                return calculateDistance(pWord, qWord) <= 2;
              });
            });

            return isFuzzyMatch;
          });
          
          const formattedData = filtered.map(p => ({ ...p, id: p.slug || p._id }));
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

  const skeletonArray = Array.from({ length: 6 });

  return (
    <main className="min-h-screen bg-creator-white text-creator-black pb-24">
      {/* Search Header */}
      <div className="bg-creator-surface border-b border-creator-border py-16 px-8 text-center">
        <h1 className="text-3xl md:text-4xl font-light tracking-tighter mb-4">
          Search Results for "{query}"
        </h1>
        <div className="text-creator-muted text-sm uppercase tracking-widest flex justify-center">
          {isLoading ? (
            <div className="h-4 w-32 bg-gray-200 animate-pulse rounded" />
          ) : (
            `${results.length} ${results.length === 1 ? 'Match' : 'Matches'} Found`
          )}
        </div>
      </div>

      {/* Results Grid Area */}
      <div className="max-w-7xl mx-auto px-8 pt-16">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
            {skeletonArray.map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        ) : results.length === 0 ? (
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