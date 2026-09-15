import React from 'react';
import { Navigate, Route, Routes, useParams, useLocation } from 'react-router-dom';
import { useState } from 'react';

// Global Contexts
import { AuthProvider } from './context/AuthContext';

// Global Components
import Navbar from './components/Navbar';
import CartDrawer from './components/CartDrawer';
import Footer from './components/Footer';

// AI Components
import AIAssistantButton from './components/AI/AIAssistantButton';
import AIAssistantDrawer from './components/AI/AIAssistantDrawer';

// E-Commerce Pages
import Home from './pages/Home';
import ProductDetail from './pages/ProductDetail';
import Category from './pages/Category';
import Search from './pages/Search';

// Checkout Flow
import OrderDetails from './pages/OrderDetails';
import Payment from './pages/Payment';

// Utility Pages
import Contact from './pages/Contact';
import Help from './pages/Help';
import Wishlist from './pages/Wishlist';
import Profile from './pages/Profile';
import Login from './pages/Login';

import {
  buildCategoryUrl,
  buildCheckoutUrl,
  buildProductUrl,
} from './utils/routeTokens';

function LegacyProductRedirect() {
  const { slug } = useParams();
  return <Navigate to={buildProductUrl(slug)} replace />;
}

function LegacyCategoryRedirect() {
  const { categoryName } = useParams();
  return <Navigate to={buildCategoryUrl(categoryName)} replace />;
}

function LegacyPaymentRedirect() {
  return <Navigate to={buildCheckoutUrl()} replace />;
}

function App() {
  const location = useLocation();

  const [openAI, setOpenAI] = useState(false);

  // Hide Navbar/Cart during checkout
  const isCheckoutFlow =
    location.pathname === '/order' ||
    location.pathname === '/checkout' ||
    location.pathname === '/payment';

  return (
    <AuthProvider>
      <div className="min-h-screen bg-creator-white text-creator-black font-sans relative selection:bg-creator-black selection:text-white">
        {!isCheckoutFlow && <Navbar />}
        {!isCheckoutFlow && <CartDrawer />}

        <Routes>
          {/* Core Shopping */}
          <Route path="/" element={<Home />} />

          {/* Current canonical category route */}
          <Route path="/c" element={<Category />} />

          {/* Current canonical product route */}
          <Route path="/p" element={<ProductDetail />} />

          {/* Legacy category/product URLs redirect to canonical URLs */}
          <Route path="/category/:categoryName" element={<LegacyCategoryRedirect />} />
          <Route path="/product/:slug" element={<LegacyProductRedirect />} />

          <Route path="/search" element={<Search />} />
          <Route path="/wishlist" element={<Wishlist />} />

          {/* Checkout */}
          <Route path="/order" element={<OrderDetails />} />
          <Route path="/checkout" element={<Payment />} />
          <Route path="/payment" element={<LegacyPaymentRedirect />} />

          {/* User */}
          <Route path="/login" element={<Login />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/help" element={<Help />} />
        </Routes>

        {!isCheckoutFlow && <Footer />}

        {!isCheckoutFlow && (
          <>
            <AIAssistantButton onClick={() => setOpenAI(true)} />
            <AIAssistantDrawer
              open={openAI}
              onClose={() => setOpenAI(false)}
            />
          </>
        )}
      </div>
    </AuthProvider>
  );
}

export default App;
