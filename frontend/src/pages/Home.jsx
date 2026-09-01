import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import ProductCardSkeleton from '../components/Loading/ProductCardSkeleton';

const Home = () => {
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await fetch('https://creator-s-desk-api-gateway.onrender.com/api/products');
        if (!response.ok) throw new Error('Failed to fetch catalog');
        
        const data = await response.json();
        const formattedProducts = data.map(p => ({ ...p, id: p.slug }));
        setProducts(formattedProducts);
      } catch (err) {
        console.error("Error:", err);
        setError("Could not load products. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchProducts();
  }, []);

  const recentProducts = products.slice(0, 3);
  const deskEssentials = products.filter(product => product.category === 'Desk Organizers').slice(0, 3);

  // Helper array to render 3 skeletons
  const skeletonArray = Array.from({ length: 3 });

  if (error) return <div className="min-h-[70vh] flex items-center justify-center uppercase tracking-widest text-sm text-red-500">{error}</div>;

  return (
    <main className="max-w-7xl mx-auto mt-16 px-8 pb-24 space-y-32">
      
      {/* SECTION 1: Latest Arrivals */}
      <section>
        <div className="mb-12">
          <h1 className="text-4xl font-light tracking-tight">Latest Arrivals</h1>
          <p className="mt-2 text-creator-muted">Precision-engineered for your workflow.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
          {isLoading 
            ? skeletonArray.map((_, i) => <ProductCardSkeleton key={i} />)
            : recentProducts.map((product) => <ProductCard key={product._id} product={product} />)
          }
        </div>
      </section>

      {/* SECTION 2: Quick Categories (Loads Instantly) */}
      <section className="bg-creator-surface -mx-8 px-8 py-20 md:px-16 border-y border-creator-border">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl font-light tracking-tight mb-10">Explore by Category</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            
            <Link to="/category/desk-organizers" className="bg-white border border-creator-border p-8 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
              <h3 className="text-lg font-medium mb-2">Desk Organizers</h3>
              <p className="text-sm text-creator-muted">Machined aluminum and solid wood foundations.</p>
            </Link>
            
            <Link to="/category/keycaps" className="bg-white border border-creator-border p-8 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
              <h3 className="text-lg font-medium mb-2">Artisan Keycaps</h3>
              <p className="text-sm text-creator-muted">Hand-poured resin, ceramic, and brass accents.</p>
            </Link>
            
            <Link to="/category/tech" className="bg-white border border-creator-border p-8 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
              <h3 className="text-lg font-medium mb-2">Creator Tech</h3>
              <p className="text-sm text-creator-muted">Reference displays, optics, and peripherals.</p>
            </Link>
            
          </div>
        </div>
      </section>

      {/* SECTION 3: Desk Essentials */}
      <section>
        <div className="flex justify-between items-end mb-12">
          <div>
            <h2 className="text-3xl font-light tracking-tight">Desk Essentials</h2>
            <p className="mt-2 text-creator-muted">The core pillars of a clean workspace.</p>
          </div>
          <Link to="/category/desk-organizers" className="hidden sm:block text-sm font-medium hover:text-creator-muted underline underline-offset-4 mb-1">
            View Collection
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
          {isLoading 
            ? skeletonArray.map((_, i) => <ProductCardSkeleton key={i} />)
            : deskEssentials.map((product) => <ProductCard key={product._id} product={product} />)
          }
        </div>
      </section>

      {/* SECTION 4: Trust & Value Proposition (Loads Instantly) */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-12 border-t border-creator-border pt-20">
        <div>
          <h4 className="text-sm font-bold uppercase tracking-widest mb-3">Free Shipping</h4>
          <p className="text-sm text-creator-muted leading-relaxed">
            Complimentary standard shipping on all domestic orders over $150.
          </p>
        </div>
        <div>
          <h4 className="text-sm font-bold uppercase tracking-widest mb-3">Premium Materials</h4>
          <p className="text-sm text-creator-muted leading-relaxed">
            Crafted from aerospace-grade aluminum, solid walnut, and high-density polymers.
          </p>
        </div>
        <div>
          <h4 className="text-sm font-bold uppercase tracking-widest mb-3">Secure Checkout</h4>
          <p className="text-sm text-creator-muted leading-relaxed">
            Lightning-fast, encrypted payments with simple, no-questions-asked returns.
          </p>
        </div>
      </section>

    </main>
  );
};

export default Home;