import React, { useEffect } from "react";
import { useCart } from "../context/CartContext";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const CartDrawer = () => {
  const { isCartOpen, toggleCart, cartItems, removeFromCart, cartTotal, clearCart } = useCart();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // --- Auto-Clear Logic ---
  // Whenever the auth state changes, if they are logged out, wipe the cart.
  useEffect(() => {
    if (!isAuthenticated && cartItems.length > 0 && clearCart) {
      clearCart();
    }
  }, [isAuthenticated, cartItems.length, clearCart]);

  const handleProceedToCheckout = () => {
    toggleCart(); // Close the drawer first
    
    if (isAuthenticated) {
      navigate('/payment');
    } else {
      // Not logged in! Send them to login, but attach the return ticket
      navigate('/login', { state: { returnTo: '/payment' } });
    }
  };

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

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {cartItems.length === 0 ? (
            <p className="text-creator-muted text-center mt-12 text-sm uppercase tracking-widest">
              Your cart is currently empty.
            </p>
          ) : (
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
        {cartItems.length > 0 && (
          <div className="p-6 border-t border-creator-border bg-white">
            <div className="flex justify-between items-center mb-6">
              <span className="text-sm uppercase tracking-widest text-creator-muted">
                Subtotal
              </span>
              <span className="text-xl font-medium">${cartTotal.toFixed(2)}</span>
            </div>
            
            {/* The Intercept Button */}
            <button
              onClick={handleProceedToCheckout}
              className="block text-center w-full bg-creator-black text-creator-white py-4 text-sm uppercase tracking-widest hover:bg-gray-900 transition-colors"
            >
              Proceed to Checkout
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default CartDrawer;