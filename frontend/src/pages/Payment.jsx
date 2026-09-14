import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import InvoiceModal from '../components/InvoiceModal';

const Payment = () => {
  const navigate = useNavigate();
  const { cart, cartItems, cartTotal, clearCart } = useCart();
  const orderItems = cartItems || cart || [];
  const { token, user, isAuthenticated } = useAuth();

  const [paymentMethod, setPaymentMethod] = useState('ONLINE');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [shippingAddress, setShippingAddress] = useState({
    street: '',
    city: '',
    state: '',
    zip: '',
  });
  const [isSuccess, setIsSuccess] = useState(false);
  const [confirmedOrderId, setConfirmedOrderId] = useState(null);
  const [showInvoice, setShowInvoice] = useState(false);
  const [completedOrderData, setCompletedOrderData] = useState(null);

  const SHIPPING_CHARGE = 20;
  const finalTotal = cartTotal + SHIPPING_CHARGE;
  const BACKEND_URL =
    import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  useEffect(() => {
    const fetchLastOrder = async () => {
      if (!token) {
        setIsLoadingHistory(false);
        return;
      }

      try {
        const response = await fetch(`${BACKEND_URL}/api/orders/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          const orders = await response.json();
          if (orders?.length > 0 && orders[0].shippingAddress) {
            setShippingAddress(orders[0].shippingAddress);
          }
        }
      } catch (err) {
        console.error('Failed to fetch order history');
      } finally {
        setIsLoadingHistory(false);
      }
    };

    fetchLastOrder();
  }, [token, BACKEND_URL]);

  const isShippingValid =
    shippingAddress.street.trim() !== '' &&
    shippingAddress.city.trim() !== '' &&
    shippingAddress.state.trim() !== '' &&
    shippingAddress.zip.trim() !== '';

  const saveOrderToDatabase = async (paymentId = null) => {
    const response = await fetch(`${BACKEND_URL}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        items: orderItems.map((item) => ({
          productId: item.id || item._id,
          name: item.name,
          price: item.price,
          quantity: item.quantity || 1,
        })),
        totalAmount: finalTotal,
        shippingAddress,
        paymentMethod,
        paymentId,
        customerName: user?.name?.trim() || '',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to save order to database');
    }

    const responseData = await response.json();

    setCompletedOrderData({
      orderId: responseData.orderId,
      document: responseData.document || null,
    });

    return responseData;
  };

  const handlePlaceOrder = async (e) => {
    e.preventDefault();

    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (!user?.name?.trim()) {
      setError('Please add your name in Personal Details before placing the order.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      if (paymentMethod === 'COD') {
        const data = await saveOrderToDatabase();
        if (clearCart) clearCart();
        setConfirmedOrderId(data.orderId);
        setIsSuccess(true);
        setIsProcessing(false);
        return;
      }

      if (paymentMethod === 'ONLINE') {
        const orderResponse = await fetch(
          `${BACKEND_URL}/api/payment/create-order`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: finalTotal }),
          }
        );

        const orderData = await orderResponse.json();
        if (!orderResponse.ok) {
          throw new Error(
            orderData.error || 'Failed to create payment order'
          );
        }

        const razorpayKey = import.meta.env.VITE_RAZORPAY_KEY_ID;

        if (!window.Razorpay) {
          throw new Error('Razorpay checkout is not loaded yet');
        }

        const options = {
          key: razorpayKey,
          amount: orderData.amount,
          currency: orderData.currency,
          name: "Creator's Desk",
          description: 'Premium Workspace Setup',
          order_id: orderData.id,
          handler: async (response) => {
            try {
              const verifyRes = await fetch(
                `${BACKEND_URL}/api/payment/verify`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_signature: response.razorpay_signature,
                  }),
                }
              );

              if (!verifyRes.ok) {
                setError('Payment verification failed');
                return;
              }

              const dbData = await saveOrderToDatabase(
                response.razorpay_payment_id
              );

              if (clearCart) clearCart();
              setConfirmedOrderId(dbData.orderId || response.razorpay_order_id);
              setIsSuccess(true);
            } catch (err) {
              console.error(err);
              setError('Error verifying payment.');
            } finally {
              setIsProcessing(false);
            }
          },
          theme: { color: '#000000' },
          modal: {
            ondismiss: () => {
              setIsProcessing(false);
            },
          },
        };

        const razorpayInstance = new window.Razorpay(options);
        razorpayInstance.open();
      }
    } catch (err) {
      console.error(err);
      setError('Something went wrong. Please try again.');
      setIsProcessing(false);
    }
  };

  if (isSuccess) {
    return (
      <main className="min-h-[calc(100vh-89px)] bg-creator-surface flex flex-col items-center justify-center p-8 relative">
        {showInvoice && completedOrderData && (
          <InvoiceModal
            order={completedOrderData}
            token={token}
            onClose={() => setShowInvoice(false)}
          />
        )}

        <div className="w-full max-w-md bg-creator-white border border-creator-border p-12 text-center animate-fadeIn">
          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center animate-scaleIn">
              <svg
                className="w-8 h-8 text-green-600 animate-drawCheck"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                style={{ strokeDasharray: 50, strokeDashoffset: 50 }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          </div>

          <h1 className="text-3xl font-light tracking-tight text-creator-black mb-4">
            Order Confirmed
          </h1>
          <p className="text-creator-muted text-sm leading-relaxed mb-2">
            Your transaction was successful.
          </p>
          <p className="text-xs font-medium tracking-widest text-creator-black uppercase mb-10">
            Order ID:{' '}
            {confirmedOrderId?.slice(-6).toUpperCase() || 'SYS-ERR'}
          </p>

          <div className="flex flex-col gap-4">
            <button
              onClick={() => setShowInvoice(true)}
              className="w-full py-4 border border-creator-black text-creator-black text-sm uppercase tracking-widest hover:bg-gray-50 transition-colors"
            >
              View Invoice
            </button>

            <button
              onClick={() => navigate('/')}
              className="w-full py-4 bg-creator-black text-creator-white text-sm uppercase tracking-widest hover:bg-gray-900 transition-colors"
            >
              Return to Home
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-[calc(100vh-89px)] bg-creator-white flex flex-col md:flex-row">
      <div className="flex-1 flex flex-col justify-center px-8 md:px-24 py-12">
        <Link
          to="/"
          className="text-xl font-bold tracking-tighter text-creator-black mb-16 inline-block"
        >
          CREATOR'S DESK.
        </Link>

        <div className="max-w-md w-full">
          <div className="flex items-center gap-4 mb-10">
            <button
              onClick={() => navigate('/cart')}
              className="text-creator-muted hover:text-creator-black text-sm"
            >
              ← Back
            </button>
            <span className="text-creator-muted text-sm">/</span>
            <h1 className="text-xl font-light tracking-tight">Checkout</h1>
          </div>

          {error && (
            <div className="mb-6 text-sm text-red-500 uppercase tracking-widest">
              {error}
            </div>
          )}

          {isLoadingHistory ? (
            <div className="text-sm text-creator-muted uppercase tracking-widest animate-pulse mb-8">
              Loading details...
            </div>
          ) : (
            <form onSubmit={handlePlaceOrder} className="space-y-6">
              <div className="space-y-4 mb-8">
                <h2 className="text-sm font-bold uppercase tracking-widest mb-4 text-creator-black">
                  Shipping Details
                </h2>

                <input
                  type="text"
                  placeholder="Street Address"
                  value={shippingAddress.street}
                  onChange={(e) =>
                    setShippingAddress({
                      ...shippingAddress,
                      street: e.target.value,
                    })
                  }
                  className="w-full border border-creator-border p-4 text-sm outline-none focus:border-creator-black transition-colors bg-transparent"
                  required
                />

                <input
                  type="text"
                  placeholder="City"
                  value={shippingAddress.city}
                  onChange={(e) =>
                    setShippingAddress({
                      ...shippingAddress,
                      city: e.target.value,
                    })
                  }
                  className="w-full border border-creator-border p-4 text-sm outline-none focus:border-creator-black transition-colors bg-transparent"
                  required
                />

                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="State"
                    value={shippingAddress.state}
                    onChange={(e) =>
                      setShippingAddress({
                        ...shippingAddress,
                        state: e.target.value,
                      })
                    }
                    className="w-full border border-creator-border p-4 text-sm outline-none focus:border-creator-black transition-colors bg-transparent"
                    required
                  />

                  <input
                    type="text"
                    placeholder="ZIP Code"
                    value={shippingAddress.zip}
                    onChange={(e) =>
                      setShippingAddress({
                        ...shippingAddress,
                        zip: e.target.value,
                      })
                    }
                    className="w-full border border-creator-border p-4 text-sm outline-none focus:border-creator-black transition-colors bg-transparent"
                    required
                  />
                </div>
              </div>

              <h2 className="text-sm font-bold uppercase tracking-widest mb-4 text-creator-black">
                Payment Method
              </h2>

              <div className="space-y-4">
                <label
                  className={`block border p-4 cursor-pointer transition-colors ${
                    paymentMethod === 'ONLINE'
                      ? 'border-creator-black bg-creator-surface'
                      : 'border-creator-border hover:border-gray-400'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="payment"
                      value="ONLINE"
                      checked={paymentMethod === 'ONLINE'}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="accent-creator-black w-4 h-4"
                    />
                    <span className="text-sm font-medium">
                      Pay with Cards, UPI or Netbanking (Razorpay)
                    </span>
                  </div>
                </label>

                <label
                  className={`block border p-4 cursor-pointer transition-colors ${
                    paymentMethod === 'COD'
                      ? 'border-creator-black bg-creator-surface'
                      : 'border-creator-border hover:border-gray-400'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="payment"
                      value="COD"
                      checked={paymentMethod === 'COD'}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="accent-creator-black w-4 h-4"
                    />
                    <span className="text-sm font-medium">
                      Cash on Delivery (COD)
                    </span>
                  </div>
                </label>
              </div>

              {paymentMethod === 'COD' && (
                <div className="pt-4 border-t border-creator-border mt-6">
                  <p className="text-sm text-creator-muted leading-relaxed">
                    You will pay for your order in cash upon delivery. Please
                    ensure you have the exact amount available.
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={
                  isProcessing ||
                  orderItems.length === 0 ||
                  !isShippingValid
                }
                className={`w-full py-5 mt-8 text-sm uppercase tracking-widest transition-colors ${
                  isProcessing || orderItems.length === 0 || !isShippingValid
                    ? 'bg-creator-muted text-white cursor-not-allowed'
                    : 'bg-creator-black text-creator-white hover:bg-gray-900'
                }`}
              >
                {isProcessing
                  ? 'Processing...'
                  : paymentMethod === 'ONLINE'
                  ? 'Proceed to Razorpay'
                  : 'Place Order'}
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="hidden md:flex md:w-[400px] lg:w-[500px] bg-creator-surface border-l border-creator-border flex-col p-12 relative">
        <div className="sticky top-12">
          <h2 className="text-sm font-bold uppercase tracking-widest mb-8 text-creator-black">
            Final Amount
          </h2>

          <div className="flex justify-between items-center text-sm mb-4">
            <span className="text-creator-muted">Items Total</span>
            <span className="font-medium">
              ₹{cartTotal?.toFixed(2) || '0.00'}
            </span>
          </div>

          <div className="flex justify-between items-center text-sm mb-8">
            <span className="text-creator-muted">Shipping</span>
            <span className="font-medium">
              ₹20.00
            </span>
          </div>

          <div className="flex justify-between items-center border-t border-creator-border pt-6">
            <span className="text-2xl font-light text-creator-black">
              Total
            </span>
            <span className="text-2xl font-medium text-creator-black">
              ₹{finalTotal?.toFixed(2) || '0.00'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Payment;
