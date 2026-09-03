import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import ProductCard from "../components/ProductCard";

const ProductDetail = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  const { addToCart } = useCart();
  const { isAuthenticated } = useAuth(); // <-- Added Auth Context
  
  const [product, setProduct] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isWishlisted, setIsWishlisted] = useState(false); // <-- New Wishlist State
  const [shareText, setShareText] = useState("Share");
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL

  // --- Fetch Product Data ---
  useEffect(() => {
    const fetchProductData = async () => {
      setIsLoading(true);
      try {
        const productRes = await fetch(`${BACKEND_URL}/api/products/${slug}`);
        if (!productRes.ok) throw new Error("Product not found");
        const foundProduct = await productRes.json();
        setProduct({ ...foundProduct, id: foundProduct.slug }); 

        const relatedRes = await fetch(`${BACKEND_URL}/api/products?category=${encodeURIComponent(foundProduct.category)}`);
        if (relatedRes.ok) {
          const relatedData = await relatedRes.json();
          const filteredRelated = relatedData
            .filter(p => p._id !== foundProduct._id)
            .slice(0, 3)
            .map(p => ({ ...p, id: p.slug }));
          setRelatedProducts(filteredRelated);
        }
      } catch (error) {
        console.error("Fetch error:", error);
      } finally {
        setIsLoading(false);
        setActiveImageIndex(0);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };

    fetchProductData();
  }, [slug]);

  // --- THE AUTOMATION: Resume Pending Actions After Login ---
  useEffect(() => {
    if (isAuthenticated && product) {
      const pendingStr = localStorage.getItem('pendingAction');
      if (pendingStr) {
        try {
          const { action, targetSlug } = JSON.parse(pendingStr);
          
          // If the pending action was for THIS product, execute it
          if (targetSlug === product.slug) {
            if (action === 'cart') {
              setIsAdding(true);
              addToCart(product);
              setTimeout(() => setIsAdding(false), 800);
            } else if (action === 'wishlist') {
              setIsWishlisted(true);
              // Future: Call your backend API here to save wishlist to DB
            }
          }
        } catch (e) {
          console.error('Failed to parse pending action', e);
        } finally {
          // Always clear it out so it doesn't loop
          localStorage.removeItem('pendingAction');
        }
      }
    }
  }, [isAuthenticated, product, addToCart]);

  // --- Protected Actions ---
  const handleAddToCart = () => {
    if (!isAuthenticated) {
      localStorage.setItem('pendingAction', JSON.stringify({ action: 'cart', targetSlug: product.slug }));
      navigate('/login', { state: { returnTo: location.pathname } });
      return;
    }

    setIsAdding(true);
    addToCart(product);
    setTimeout(() => setIsAdding(false), 800);
  };

  const handleWishlist = () => {
    if (!isAuthenticated) {
      localStorage.setItem('pendingAction', JSON.stringify({ action: 'wishlist', targetSlug: product.slug }));
      navigate('/login', { state: { returnTo: location.pathname } });
      return;
    }

    // In a full production app, you would POST this to an /api/wishlist route
    setIsWishlisted(true);
    setTimeout(() => setIsWishlisted(false), 2000); 
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setShareText("Copied!");
    setTimeout(() => setShareText("Share"), 2000);
  };

  if (isLoading) {
    return <div className="min-h-[70vh] flex items-center justify-center uppercase tracking-widest text-sm text-creator-muted">Loading Details...</div>;
  }

  if (!product) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center bg-creator-white">
        <h2 className="text-2xl font-light mb-4">Product not found.</h2>
        <Link to="/" className="text-creator-muted hover:text-creator-black underline underline-offset-4">
          Return Home
        </Link>
      </div>
    );
  }

  const mockGallery = [product.image, product.image, product.image, product.image];

  return (
    <main className="min-h-screen bg-creator-white text-creator-black pb-24">
      
      {/* Utility Header / Breadcrumbs */}
      <div className="border-b border-creator-border px-8 py-4 flex justify-between items-center text-xs uppercase tracking-widest font-medium">
        <button onClick={() => navigate(-1)} className="hover:text-creator-muted transition-colors flex items-center gap-2">
          <span>&larr;</span> Back
        </button>
        <span className="text-creator-muted">{product.category}</span>
      </div>

      {/* Main Product Section */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 px-8 mt-12 pb-24 border-b border-creator-border">
        
        {/* Left Column: Image Gallery */}
        <div className="w-full flex flex-col gap-4 relative">
          {!product.inStock && (
            <div className="absolute top-4 left-4 bg-white text-creator-black text-[10px] font-bold uppercase tracking-widest px-3 py-1 z-10 shadow-sm border border-creator-border">
              Sold Out
            </div>
          )}
          
          <div className="aspect-square bg-creator-surface border border-creator-border overflow-hidden">
            <img
              src={mockGallery[activeImageIndex]}
              alt={product.name}
              className={`w-full h-full object-cover transition-all duration-700 ${!product.inStock ? 'opacity-50 grayscale' : 'grayscale-0'}`}
            />
          </div>
          
          <div className="grid grid-cols-4 gap-4">
            {mockGallery.map((img, idx) => (
              <button 
                key={idx}
                onClick={() => setActiveImageIndex(idx)}
                className={`aspect-square bg-creator-surface border overflow-hidden transition-all duration-300 ${
                  activeImageIndex === idx ? 'border-creator-black' : 'border-creator-border hover:border-gray-400'
                }`}
              >
                <img
                  src={img}
                  alt={`${product.name} angle ${idx + 1}`}
                  className={`w-full h-full object-cover opacity-80 hover:opacity-100 ${!product.inStock ? 'grayscale' : ''}`}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Right Column: Expanded Details & Actions */}
        <div className="flex flex-col py-10 lg:py-0">
          <h1 className="text-4xl md:text-5xl font-light tracking-tighter mb-4">
            {product.name}
          </h1>
          <div className="text-2xl font-medium mb-8">${product.price.toFixed(2)}</div>

          {/* Action Buttons */}
          <div className="space-y-4 mb-12">
            <button
              onClick={handleAddToCart}
              disabled={!product.inStock || isAdding}
              className={`w-full py-5 text-sm uppercase tracking-widest transition-all duration-300 ${
                !product.inStock 
                  ? 'bg-creator-surface text-creator-muted cursor-not-allowed border border-creator-border'
                  : isAdding 
                    ? 'bg-green-600 text-white' 
                    : 'bg-creator-black text-creator-white hover:bg-gray-900'
              }`}
            >
              {!product.inStock ? 'Out of Stock' : isAdding ? 'Added to Cart' : 'Add to Cart'}
            </button>
            
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={handleShare}
                className="border border-creator-border py-4 text-xs uppercase tracking-widest font-medium hover:bg-creator-surface transition-colors flex items-center justify-center gap-2"
              >
                {shareText}
              </button>
              
              <button 
                onClick={handleWishlist}
                className={`border border-creator-border py-4 text-xs uppercase tracking-widest font-medium transition-colors flex items-center justify-center gap-2 ${
                  isWishlisted ? 'bg-creator-black text-creator-white' : 'hover:bg-creator-surface'
                }`}
              >
                {isWishlisted ? 'Saved!' : 'Save to Wishlist'}
              </button>
            </div>
          </div>

          {/* Expanded Description Area */}
          <div className="space-y-10 border-t border-creator-border pt-10">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest mb-3 text-creator-black">
                Design Overview
              </h3>
              <p className="text-base text-creator-muted leading-relaxed">
                {product.description} Built specifically for modern workspaces, this piece eliminates friction from your daily workflow while maintaining a distinctly minimalist profile. Every angle and surface has been refined to offer maximum utility without visual clutter.
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-8">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest mb-2 text-creator-black">
                  Material
                </h3>
                <p className="text-sm text-creator-muted leading-relaxed">
                  {product.features[0] || 'Premium grade construction.'}
                </p>
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest mb-2 text-creator-black">
                  Maintenance
                </h3>
                <p className="text-sm text-creator-muted leading-relaxed">
                  Wipe clean with a microfiber cloth. Avoid abrasive solvents.
                </p>
              </div>
            </div>

            {/* Dynamic Features List */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest mb-4 text-creator-black">
                Key Features
              </h3>
              <ul className="space-y-3 text-sm text-creator-muted">
                {product.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <span className="mt-1.5 w-1 h-1 rounded-full bg-creator-black shrink-0"></span> 
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Shipping Guarantees */}
          <div className="mt-12 p-6 bg-creator-surface border border-creator-border space-y-3 text-xs text-creator-black uppercase tracking-wider font-medium">
            <p className="flex items-center gap-3">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span> 
              In stock and ready to ship
            </p>
            <p className="flex items-center gap-3">
              <span className="w-1.5 h-1.5 bg-creator-black rounded-full"></span> 
              Free global shipping over $150
            </p>
            <p className="flex items-center gap-3">
              <span className="w-1.5 h-1.5 bg-creator-black rounded-full"></span> 
              30-day hassle-free returns
            </p>
          </div>

        </div>
      </div>

      {/* Related Products Section */}
      {relatedProducts.length > 0 && (
        <div className="max-w-7xl mx-auto px-8 pt-24">
          <div className="flex justify-between items-end mb-12">
            <div>
              <h2 className="text-3xl font-light tracking-tight">Complete Your Setup</h2>
              <p className="mt-2 text-creator-muted">Explore similar items in {product.category}.</p>
            </div>
            <Link to={`/category/${product.category.toLowerCase().replace(/\s+/g, '-')}`} className="hidden sm:block text-sm font-medium hover:text-creator-muted underline underline-offset-4 mb-1">
              View All
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
            {relatedProducts.map((relatedProduct) => (
              <ProductCard key={relatedProduct._id} product={relatedProduct} />
            ))}
          </div>
        </div>
      )}

    </main>
  );
};

export default ProductDetail;