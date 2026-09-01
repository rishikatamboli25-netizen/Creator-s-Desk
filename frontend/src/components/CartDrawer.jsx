import React, { useEffect, useState } from "react";
import { useCart } from "../context/CartContext";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Dedicated Skeleton for Cart Rows
const CartItemSkeleton = () => (
  <div className="flex gap-4">
    <div className="w-20 h-20 bg-gray-200 animate-pulse border border-creator-border flex-shrink-0" />
    <div className="flex-1 flex flex-col justify-between py-1">
      <div>
        <div className="h-4 w-3/4 bg-gray-200 animate-pulse mb-2 rounded-sm" />
        <div className="h-3 w-1/4 bg-gray-200 animate-pulse rounded-sm" />
      </div>
      <div className="flex justify-between items-center mt-2">
        <div className="h-4 w-1/4 bg-gray-200 animate-pulse rounded-sm" />
        <div className="h-3 w-12 bg-gray-200 animate-pulse rounded-sm" />
      </div>
    </div>
  </div>
);

const CartDrawer = () => {
  const { isCartOpen, toggleCart, cartItems, removeFromCart, cartTotal, clearCart } = useCart();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  
  // Simulated loading state for when the drawer opens (e.g., verifying stock/syncing)
  const [isSyncing, setIsSyncing] = useState(false);

  // Trigger the skeleton loading pulse every time the cart opens
  useEffect(() => {
    if (isCartOpen) {
      setIsSyncing(true);
      const timer = setTimeout(() => setIsSyncing(false), 600);
      return () => clearTimeout(timer);
    }
  }, [isCartOpen]);

  // --- Auto-Clear Logic ---
  useEffect(() => {
    if (!isAuthenticated && cartItems.length > 0 && clearCart) {
      clearCart();
    }
  }, [isAuthenticated, cartItems.length, clearCart]);

  const handleProceedToCheckout = () => {
    toggleCart(); 
    
    if (isAuthenticated) {
      navigate('/payment');
    } else {
      navigate('/login', { state: { returnTo: '/payment' } });
    }
  };

  const skeletonArray = Array.from({ length: Math.max(cartItems.length, 2) }); // Show at least 2 skeletons

  return (
    <>
      {/* Background Overlay */}
      {isCartOpen && (
        <div
          className="fixed inset-0 bg-creator-black/20 backdrop-blur-sm z-40 transition-opacity"
          onClick={toggleCart}
        ></div>
      )}

      {/* Slide-out Drawer */}
      <div
        className={`fixed inset-y-0 right-0 w-full max-w-md bg-creator-white border-l border-creator-border shadow-2xl z-[999] transform transition-transform duration-300 ease-in-out flex flex-col ${
          isCartOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-creator-border bg-white">
          <h2 className="text-xl font-light tracking-tight">Your Cart</h2>
          <button
            onClick={toggleCart}
            className="text-creator-muted hover:text-creator-black text-2xl font-light transition-colors"
          >
            &times;
          </button>
        </div>

        {/* Cart Items Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isSyncing ? (
            // 1. Skeleton Loading State
            skeletonArray.map((_, idx) => <CartItemSkeleton key={idx} />)
          ) : cartItems.length === 0 ? (
            // 2. Empty State
            <p className="text-creator-muted text-center mt-12 text-sm uppercase tracking-widest">
              Your cart is currently empty.
            </p>
          ) : (
            // 3. Loaded State
            cartItems.map((item) => (
              <div key={item.id} className="flex gap-4">
                <div className="w-20 h-20 bg-creator-surface border border-creator-border flex-shrink-0">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <h4 className="text-sm font-medium">{item.name}</h4>
                    <p className="text-xs text-creator-muted mt-1">
                      Qty: {item.quantity}
                    </p>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-sm font-medium">
                      ${(item.price * item.quantity).toFixed(2)}
                    </span>
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="text-xs text-creator-muted hover:text-red-500 underline underline-offset-2 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer / Checkout */}
        {cartItems.length > 0 && !isSyncing && (
          <div className="p-6 border-t border-creator-border bg-white animate-in fade-in duration-300">
            <div className="flex justify-between items-center mb-6">
              <span className="text-sm uppercase tracking-widest text-creator-muted">
                Subtotal
              </span>
              <span className="text-xl font-medium">${cartTotal.toFixed(2)}</span>
            </div>
            
            <button
              onClick={handleProceedToCheckout}
              className="block text-center w-full bg-creator-black text-creator-white py-4 text-sm uppercase tracking-widest hover:bg-gray-900 transition-colors"
            >
              Proceed to Checkout
            </button>
          </div>
        )}

        {/* Skeleton Footer (Shown during sync if cart has items) */}
        {cartItems.length > 0 && isSyncing && (
          <div className="p-6 border-t border-creator-border bg-white">
            <div className="flex justify-between items-center mb-6">
              <span className="text-sm uppercase tracking-widest text-creator-muted">
                Subtotal
              </span>
              <div className="h-6 w-20 bg-gray-200 animate-pulse rounded-sm" />
            </div>
            <div className="w-full h-[52px] bg-gray-200 animate-pulse rounded-sm" />
          </div>
        )}
      </div>
    </>
  );
};

export default CartDrawer;