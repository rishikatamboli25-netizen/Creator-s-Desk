import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { buildCheckoutUrl } from '../utils/routeTokens';

const OrderDetails = () => {
  const navigate = useNavigate();
  const { cartTotal } = useCart();
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    street: '',
    city: '',
    state: '',
    zipCode: ''
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // In a real app, we would save this to context or state management here
    console.log("Shipping Details Saved:", formData);
    navigate(buildCheckoutUrl());
  };

  return (
    <div className="min-h-screen bg-creator-white flex flex-col md:flex-row">
      
      {/* Left Side - The Form */}
      <div className="flex-1 flex flex-col justify-center px-8 md:px-24 py-12">
        <Link to="/" className="text-xl font-bold tracking-tighter text-creator-black mb-16 inline-block">
          CREATOR'S DESK.
        </Link>
        
        <div className="max-w-md w-full">
          <h1 className="text-2xl font-light tracking-tight mb-2">Shipping Details</h1>
          <p className="text-sm text-creator-muted mb-10">Where should we send your gear?</p>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-widest text-creator-black">Contact</h2>
              <input 
                type="text" 
                name="name" 
                placeholder="Full Name" 
                required
                onChange={handleChange}
                className="w-full border border-creator-border p-4 text-sm outline-none focus:border-creator-black transition-colors bg-transparent"
              />
              <input 
                type="tel" 
                name="phone" 
                placeholder="Phone Number" 
                required
                onChange={handleChange}
                className="w-full border border-creator-border p-4 text-sm outline-none focus:border-creator-black transition-colors bg-transparent"
              />
            </div>

            <div className="space-y-4 pt-6">
              <h2 className="text-xs font-bold uppercase tracking-widest text-creator-black">Address</h2>
              <input 
                type="text" 
                name="street" 
                placeholder="Street Address" 
                required
                onChange={handleChange}
                className="w-full border border-creator-border p-4 text-sm outline-none focus:border-creator-black transition-colors bg-transparent"
              />
              <div className="grid grid-cols-2 gap-4">
                <input 
                  type="text" 
                  name="city" 
                  placeholder="City" 
                  required
                  onChange={handleChange}
                  className="w-full border border-creator-border p-4 text-sm outline-none focus:border-creator-black transition-colors bg-transparent"
                />
                <input 
                  type="text" 
                  name="state" 
                  placeholder="State / Province" 
                  required
                  onChange={handleChange}
                  className="w-full border border-creator-border p-4 text-sm outline-none focus:border-creator-black transition-colors bg-transparent"
                />
              </div>
              <input 
                type="text" 
                name="zipCode" 
                placeholder="ZIP / Postal Code" 
                required
                onChange={handleChange}
                className="w-full border border-creator-border p-4 text-sm outline-none focus:border-creator-black transition-colors bg-transparent"
              />
            </div>

            <button 
              type="submit" 
              className="w-full bg-creator-black text-creator-white py-5 mt-8 text-sm uppercase tracking-widest hover:bg-gray-900 transition-colors"
            >
              Continue to Payment
            </button>
          </form>
        </div>
      </div>

      {/* Right Side - Order Summary (Visible on MD and larger) */}
      <div className="hidden md:flex md:w-[400px] lg:w-[500px] bg-creator-surface border-l border-creator-border flex-col p-12 relative">
        <div className="sticky top-12">
          <h2 className="text-sm font-bold uppercase tracking-widest mb-8 text-creator-black">Order Summary</h2>
          <div className="flex justify-between items-center mb-4 text-sm">
            <span className="text-creator-muted">Subtotal</span>
            <span className="font-medium">${cartTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center mb-8 text-sm">
            <span className="text-creator-muted">Shipping</span>
            <span className="font-medium">{cartTotal > 150 ? 'Free' : '$15.00'}</span>
          </div>
          <div className="flex justify-between items-center border-t border-creator-border pt-6">
            <span className="text-base font-medium">Total</span>
            <span className="text-xl font-medium">
              ${(cartTotal > 150 ? cartTotal : cartTotal + 15).toFixed(2)}
            </span>
          </div>
        </div>
      </div>

    </div>
  );
};

export default OrderDetails;