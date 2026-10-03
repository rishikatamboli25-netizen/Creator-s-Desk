
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { buildCategoryUrl } from '../utils/routeTokens';

const Footer = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle');

  const handleSubscribe = (e) => {
    e.preventDefault();

    if (!email.trim()) return;

    // Frontend success state.
    // Connect your newsletter API here for real subscriptions.
    setStatus('success');
    setEmail('');
  };

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
            <h4 className="text-xs font-bold uppercase tracking-widest mb-6 text-creator-black">
              Shop
            </h4>
            <ul className="space-y-4 text-sm text-creator-muted">
              <li>
                <Link to={buildCategoryUrl("desk-organizers")} className="hover:text-creator-black transition-colors">
                  Desk Organizers
                </Link>
              </li>
              <li>
                <Link to={buildCategoryUrl("keycaps")} className="hover:text-creator-black transition-colors">
                  Artisan Keycaps
                </Link>
              </li>
              <li>
                <Link to={buildCategoryUrl("accessories")} className="hover:text-creator-black transition-colors">
                  Accessories
                </Link>
              </li>
              <li>
                <Link to={buildCategoryUrl("tech")} className="hover:text-creator-black transition-colors">
                  Creator Tech
                </Link>
              </li>
            </ul>
          </div>

          {/* Support Links */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest mb-6 text-creator-black">
              Support
            </h4>
            <ul className="space-y-4 text-sm text-creator-muted">
              <li>
                <Link to="/contact" className="hover:text-creator-black transition-colors">
                  Contact Us
                </Link>
              </li>
              <li>
                <Link to="/help" className="hover:text-creator-black transition-colors">
                  FAQ
                </Link>
              </li>
              <li>
                <Link to="/profile" className="hover:text-creator-black transition-colors">
                  My Account
                </Link>
              </li>
            </ul>
          </div>

          {/* Newsletter Form */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest mb-6 text-creator-black">
              Newsletter
            </h4>
            <p className="text-sm text-creator-muted mb-6 leading-relaxed">
              Subscribe for new product drops, exclusive insights, and minimalist setup inspiration.
            </p>

            <form
              onSubmit={handleSubscribe}
              className="flex items-end border-b border-creator-border pb-2 focus-within:border-creator-black transition-colors duration-300"
            >
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (status === 'success') setStatus('idle');
                }}
                required
                disabled={status === 'success'}
                aria-label="Email address"
                className="w-full bg-transparent outline-none text-sm placeholder-creator-muted text-creator-black disabled:opacity-50"
              />

              <button
                type="submit"
                disabled={status === 'success'}
                className="group flex items-center gap-2 text-xs font-bold uppercase tracking-widest hover:text-creator-muted transition-all duration-300 shrink-0 ml-4 disabled:cursor-default"
              >
                {status === 'success' ? (
                  <>
                    Joined
                    <Check
                      size={14}
                      className="animate-[popIn_0.3s_ease-out]"
                    />
                  </>
                ) : (
                  <>
                    Join
                    <ArrowRight
                      size={14}
                      className="transition-transform duration-300 group-hover:translate-x-1"
                    />
                  </>
                )}
              </button>
            </form>

            <div
              aria-live="polite"
              className={`overflow-hidden transition-all duration-300 ${
                status === 'success'
                  ? 'max-h-12 opacity-100 mt-3'
                  : 'max-h-0 opacity-0 mt-0'
              }`}
            >
              <p className="text-xs text-creator-muted flex items-center gap-2">
                <Check size={13} className="text-green-600" />
                Thanks for joining us!
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Utility Bar */}
        <div className="flex flex-col md:flex-row justify-between items-center pt-8 border-t border-creator-border text-xs text-creator-muted uppercase tracking-widest">
          <p>
            &copy; {new Date().getFullYear()} CREATOR'S DESK. All rights reserved.
          </p>
          <div className="flex gap-8 mt-4 md:mt-0">
            <Link className="hover:text-creator-black transition-colors">
              Privacy Policy
            </Link>
            <Link  className="hover:text-creator-black transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>

      </div>

      <style>{`
        @keyframes popIn {
          0% {
            transform: scale(0.5);
            opacity: 0;
          }
          70% {
            transform: scale(1.2);
            opacity: 1;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </footer>
  );
};

export default Footer;