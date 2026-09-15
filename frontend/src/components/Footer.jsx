import React from 'react';
import { Link } from 'react-router-dom';
import { buildCategoryUrl } from '../utils/routeTokens';

const Footer = () => {
  return (
    <footer className="bg-creator-white border-t border-creator-border text-creator-black pt-20 pb-10 px-8 mt-auto">
      <div className="max-w-[1440px] mx-auto">
        
        {/* Main Footer Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-20">
          
          {/* Brand Info */}
          <div className="lg:col-span-1">
            <Link to="/" className="text-xl font-bold tracking-tighter text-creator-black block mb-4">
              CREATOR'S DESK.
            </Link>
            <p className="text-sm text-creator-muted max-w-xs leading-relaxed">
              Precision-engineered tools and accessories for the modern creator, coder, and designer.
            </p>
          </div>

          {/* Shop Links */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest mb-6 text-creator-black">Shop</h4>
            <ul className="space-y-4 text-sm text-creator-muted">
              <li><Link to={buildCategoryUrl("desk-organizers")} className="hover:text-creator-black transition-colors">Desk Organizers</Link></li>
              <li><Link to={buildCategoryUrl("keycaps")} className="hover:text-creator-black transition-colors">Artisan Keycaps</Link></li>
              <li><Link to={buildCategoryUrl("accessories")} className="hover:text-creator-black transition-colors">Accessories</Link></li>
              <li><Link to={buildCategoryUrl("tech")} className="hover:text-creator-black transition-colors">Creator Tech</Link></li>
            </ul>
          </div>

          {/* Support Links */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest mb-6 text-creator-black">Support</h4>
            <ul className="space-y-4 text-sm text-creator-muted">
              <li><Link to="/contact" className="hover:text-creator-black transition-colors">Contact Us</Link></li>
              <li><Link to="/help" className="hover:text-creator-black transition-colors">FAQ</Link></li>
              <li><Link to="/profile" className="hover:text-creator-black transition-colors">My Account</Link></li>
            </ul>
          </div>

          {/* Newsletter Form */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest mb-6 text-creator-black">Newsletter</h4>
            <p className="text-sm text-creator-muted mb-6 leading-relaxed">
              Subscribe for new product drops, exclusive insights, and minimalist setup inspiration.
            </p>
            <form className="flex items-end border-b border-creator-border pb-2 focus-within:border-creator-black transition-colors">
              <input 
                type="email" 
                placeholder="Email address" 
                required
                className="w-full bg-transparent outline-none text-sm placeholder-creator-muted text-creator-black"
              />
              <button 
                type="submit" 
                className="text-xs font-bold uppercase tracking-widest hover:text-creator-muted transition-colors shrink-0 ml-4"
              >
                Join
              </button>
            </form>
          </div>

        </div>

        {/* Bottom Utility Bar */}
        <div className="flex flex-col md:flex-row justify-between items-center pt-8 border-t border-creator-border text-xs text-creator-muted uppercase tracking-widest">
          <p>&copy; {new Date().getFullYear()} CREATOR'S DESK. All rights reserved.</p>
          <div className="flex gap-8 mt-4 md:mt-0">
            <Link to="/privacy" className="hover:text-creator-black transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-creator-black transition-colors">Terms of Service</Link>
          </div>
        </div>
        
      </div>
    </footer>
  );
};

export default Footer;