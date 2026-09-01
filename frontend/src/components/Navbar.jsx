import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext'; 

const Navbar = () => {
  const { cartCount, toggleCart } = useCart();
  const { isAuthenticated } = useAuth(); 
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // New States for Live Suggestions
  const [allProductNames, setAllProductNames] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  
  const navigate = useNavigate();
  const searchInputRef = useRef(null);

  // Fetch product catalog names once for instantaneous filtering
  useEffect(() => {
    fetch('https://creator-s-desk-api-gateway.onrender.com/api/products')
      .then(res => res.json())
      .then(data => setAllProductNames(data.map(p => p.name)))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  const handleCartClick = (e) => {
    e.preventDefault();
    toggleCart();
  };

  // Generate suggestions on keystroke
  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    
    if (val.trim()) {
      const lowerVal = val.toLowerCase();
      const matches = allProductNames.filter(name => 
        name.toLowerCase().includes(lowerVal)
      );
      setSuggestions(matches.slice(0, 5)); // Limit to top 5 results
    } else {
      setSuggestions([]);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setSearchQuery(suggestion);
    setSuggestions([]);
    setIsSearchOpen(false);
    navigate(`/search?q=${encodeURIComponent(suggestion)}`);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
      setSuggestions([]);
      setIsSearchOpen(false);
    }
  };

  return (
    <nav className="border-b border-creator-border px-8 py-6 flex justify-between items-center bg-creator-white sticky top-0 z-[100]">
      {/* Brand */}
      <Link to="/" className="text-xl font-bold tracking-tighter text-creator-black z-20 shrink-0">
        CREATOR'S DESK.
      </Link>

      {/* Navigation Links */}
      <div className={`hidden md:flex gap-8 text-sm font-medium tracking-wide transition-opacity duration-300 ${isSearchOpen ? 'opacity-0 pointer-events-none absolute left-1/2 -translate-x-1/2' : 'opacity-100 text-creator-muted absolute left-1/2 -translate-x-1/2'}`}>
        <Link to="/category/desk-organizers" className="hover:text-creator-black transition-colors">Organizers</Link>
        <Link to="/category/keycaps" className="hover:text-creator-black transition-colors">Keycaps</Link>
        <Link to="/category/accessories" className="hover:text-creator-black transition-colors">Accessories</Link>
        <Link to="/category/tech" className="hover:text-creator-black transition-colors">Tech</Link>
      </div>

      {/* Utility Icons & Search Form */}
      <div className="flex items-center gap-5 text-creator-black z-20 ml-auto">
        
        {/* Animated Search Structure */}
        <div className="relative flex items-center">
          <form onSubmit={handleSearchSubmit} className="flex items-center">
            <button 
              type="button" 
              onClick={() => {
                setIsSearchOpen(prev => !prev);
                if (isSearchOpen) setSuggestions([]); // Clear suggestions on close
              }}
              className="hover:opacity-60 transition-opacity shrink-0 outline-none z-10"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="square" strokeLinejoin="miter" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </button>
            
            <div className={`transition-all duration-300 ease-in-out overflow-hidden border-b ${
              isSearchOpen ? 'w-48 lg:w-64 ml-3 border-creator-black opacity-100' : 'w-0 ml-0 border-transparent opacity-0'
            }`}>
              <input 
                ref={searchInputRef}
                type="text"
                placeholder="Search tools..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="bg-transparent outline-none text-sm w-full py-1 placeholder-creator-muted text-creator-black"
                autoComplete="off"
              />
            </div>
          </form>

          {/* Typeahead Dropdown Menu */}
          {isSearchOpen && suggestions.length > 0 && (
            <div className="absolute top-full right-0 mt-4 w-64 bg-creator-white border border-creator-border shadow-xl z-50 animate-in fade-in slide-in-from-top-2">
              <ul className="py-2">
                {suggestions.map((sugg, idx) => (
                  <li key={idx}>
                    <button
                      onClick={() => handleSuggestionClick(sugg)}
                      className="w-full text-left px-4 py-2 text-sm text-creator-muted hover:bg-creator-surface hover:text-creator-black transition-colors"
                    >
                      {sugg}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Wishlist Icon */}
        <Link to="/wishlist" className="hover:opacity-60 transition-opacity">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="square" strokeLinejoin="miter" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
          </svg>
        </Link>

        {/* Profile Icon */}
        <Link to={isAuthenticated ? "/profile" : "/login"} className="hover:opacity-60 transition-opacity">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="square" strokeLinejoin="miter" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
          </svg>
        </Link>

        {/* Cart Icon */}
        <button onClick={handleCartClick} className="relative hover:opacity-60 transition-opacity flex items-center">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="square" strokeLinejoin="miter" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
          {cartCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-creator-black text-creator-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {cartCount}
            </span>
          )}
        </button>
      </div>
    </nav>
  );
};

export default Navbar;