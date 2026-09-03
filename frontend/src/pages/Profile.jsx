import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Profile = () => {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // --- UI State ---
  const [activeTab, setActiveTab] = useState('orders'); // 'orders' | 'details'
  const [isEditing, setIsEditing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // --- Form State ---
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    street: '',
    city: '',
    state: '',
    zip: ''
  });

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL

  // --- Concurrently Fetch User & Real Order History ---
  useEffect(() => {
    if (!token) {
      navigate('/');
      return;
    }

    const fetchDashboardData = async () => {
      try {
        const [userRes, ordersRes] = await Promise.all([
          fetch(`${BACKEND_URL}/api/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          fetch(`${BACKEND_URL}/api/orders/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
        ]);

        if (userRes.ok) {
          const userData = await userRes.json();
          setUser(userData);
          // Populate form data. Adjust nested properties based on your actual backend schema.
          setFormData({
            name: userData.name || '',
            email: userData.email || '',
            phone: userData.phone || '',
            street: userData.address?.street || '',
            city: userData.address?.city || '',
            state: userData.address?.state || '',
            zip: userData.address?.zip || ''
          });
        } else {
          handleLogout();
        }
        
        if (ordersRes.ok) {
          const ordersData = await ordersRes.json();
          setOrders(ordersData);
        }
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [token, navigate]);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSaveDetails = async (e) => {
    e.preventDefault();
    setIsUpdating(true);
    try {
      // Assuming your backend expects this structure. 
      // You may need to format { address: { street, city... } } depending on your API.
      const response = await fetch(`${BACKEND_URL}/api/auth/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData) 
      });
      
      if (response.ok) {
        // Update local user state so the sidebar email refreshes
        setUser((prev) => ({ ...prev, ...formData }));
        setIsEditing(false);
      } else {
        alert('Failed to update details.');
      }
    } catch (error) {
      console.error("Failed to update details:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelEdit = () => {
    // Revert form data back to original user state
    setFormData({
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      street: user.address?.street || '',
      city: user.address?.city || '',
      state: user.address?.state || '',
      zip: user.address?.zip || ''
    });
    setIsEditing(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (isLoading) {
    return <div className="min-h-[calc(100vh-89px)] flex items-center justify-center tracking-widest uppercase text-sm text-creator-muted">Loading Dashboard...</div>;
  }

  return (
    <main className="min-h-[calc(100vh-89px)] bg-creator-surface p-8 md:p-12 lg:p-16">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12 lg:gap-16">
        
        {/* Left Column: Sidebar Navigation */}
        <div className="md:col-span-1 flex flex-col">
          
          {/* Minimal Profile Header */}
          <div className="flex items-center gap-4 mb-10">
            {/* SVG Profile Circle */}
            <div className="w-14 h-14 rounded-full border border-creator-black flex items-center justify-center shrink-0 bg-creator-white">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-creator-black">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </div>
            
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-creator-black truncate">{user?.phone}</p>
              <p className="text-xs text-creator-muted mt-0.5 truncate">{user?.email || 'No email added'}</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex flex-col space-y-2">
            <button 
              onClick={() => setActiveTab('orders')}
              className={`text-left text-xs uppercase tracking-widest py-4 px-5 transition-colors ${
                activeTab === 'orders' 
                  ? 'bg-creator-black text-creator-white' 
                  : 'text-creator-muted hover:bg-creator-white border border-transparent hover:border-creator-border'
              }`}
            >
              My Orders
            </button>
            <button 
              onClick={() => setActiveTab('details')}
              className={`text-left text-xs uppercase tracking-widest py-4 px-5 transition-colors ${
                activeTab === 'details' 
                  ? 'bg-creator-black text-creator-white' 
                  : 'text-creator-muted hover:bg-creator-white border border-transparent hover:border-creator-border'
              }`}
            >
              Personal Details
            </button>
            
            <div className="pt-8 mt-4 border-t border-creator-border">
              <button 
                onClick={handleLogout}
                className="w-full text-left text-xs uppercase tracking-widest text-red-500 py-4 px-5 hover:bg-red-50 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </nav>
        </div>

        {/* Right Column: Dynamic Content Area */}
        <div className="md:col-span-3">
          
          {/* --- TAB 1: ORDER HISTORY --- */}
          {activeTab === 'orders' && (
            <div>
              <h2 className="text-xl font-light tracking-tight text-creator-black mb-8 border-b border-creator-border pb-4">Order History</h2>
              
              {orders.length === 0 ? (
                <div className="p-12 border border-creator-border bg-creator-white text-center">
                  <p className="text-sm text-creator-muted mb-6">You haven't placed any orders yet.</p>
                  <button onClick={() => navigate('/')} className="px-8 py-3 bg-creator-black text-creator-white text-xs uppercase tracking-widest hover:bg-gray-900 transition-colors">
                    Start Shopping
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.map((order) => (
                    <div key={order._id} className="border border-creator-border bg-creator-white p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 transition-colors hover:bg-gray-50">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-6 md:gap-12 w-full md:w-auto flex-1">
                        <div>
                          <span className="block text-xs uppercase tracking-widest text-creator-muted mb-1">Order ID</span>
                          <span className="font-medium text-sm">{order._id.slice(-6).toUpperCase()}</span>
                        </div>
                        <div>
                          <span className="block text-xs uppercase tracking-widest text-creator-muted mb-1">Date</span>
                          <span className="text-sm">{new Date(order.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div>
                          <span className="block text-xs uppercase tracking-widest text-creator-muted mb-1">Items</span>
                          <span className="text-sm">{order.items?.length || 0}</span>
                        </div>
                      </div>
                      
                      <div className="text-left md:text-right w-full md:w-auto pt-4 md:pt-0 border-t border-creator-border md:border-t-0 mt-2 md:mt-0">
                        <span className="block text-xs uppercase tracking-widest text-creator-muted mb-1 md:hidden">Total</span>
                        <p className="text-xl font-medium text-creator-black">${order.totalAmount.toFixed(2)}</p>
                        <p className="text-xs text-green-600 uppercase tracking-widest mt-1">Confirmed</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* --- TAB 2: PERSONAL DETAILS --- */}
          {activeTab === 'details' && (
            <div>
              <div className="flex justify-between items-center mb-8 border-b border-creator-border pb-4">
                <h2 className="text-xl font-light tracking-tight text-creator-black">Personal Details</h2>
                {!isEditing && (
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="text-xs uppercase tracking-widest border-b border-creator-black pb-1 hover:text-creator-muted hover:border-creator-muted transition-colors"
                  >
                    Edit
                  </button>
                )}
              </div>

              <form onSubmit={handleSaveDetails} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Phone - Always Disabled */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-creator-muted mb-2">Phone Number</label>
                    <input 
                      type="text" 
                      value={formData.phone} 
                      disabled 
                      className="w-full p-4 border border-creator-border bg-creator-surface text-sm text-creator-muted cursor-not-allowed outline-none"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-creator-muted mb-2">Email Address</label>
                    <input 
                      type="email" 
                      name="email"
                      value={formData.email} 
                      onChange={handleInputChange}
                      disabled={!isEditing}
                      className={`w-full p-4 border text-sm outline-none transition-colors ${
                        isEditing ? 'border-creator-border bg-creator-white focus:border-creator-black' : 'border-creator-border bg-creator-surface text-creator-muted cursor-not-allowed'
                      }`}
                    />
                  </div>

                  {/* Full Name */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-widest text-creator-muted mb-2">Full Name</label>
                    <input 
                      type="text" 
                      name="name"
                      value={formData.name} 
                      onChange={handleInputChange}
                      disabled={!isEditing}
                      className={`w-full p-4 border text-sm outline-none transition-colors ${
                        isEditing ? 'border-creator-border bg-creator-white focus:border-creator-black' : 'border-creator-border bg-creator-surface text-creator-muted cursor-not-allowed'
                      }`}
                    />
                  </div>

                  {/* Street Address */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-widest text-creator-muted mb-2">Street Address</label>
                    <input 
                      type="text" 
                      name="street"
                      value={formData.street} 
                      onChange={handleInputChange}
                      disabled={!isEditing}
                      className={`w-full p-4 border text-sm outline-none transition-colors ${
                        isEditing ? 'border-creator-border bg-creator-white focus:border-creator-black' : 'border-creator-border bg-creator-surface text-creator-muted cursor-not-allowed'
                      }`}
                    />
                  </div>

                  {/* City */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-creator-muted mb-2">City</label>
                    <input 
                      type="text" 
                      name="city"
                      value={formData.city} 
                      onChange={handleInputChange}
                      disabled={!isEditing}
                      className={`w-full p-4 border text-sm outline-none transition-colors ${
                        isEditing ? 'border-creator-border bg-creator-white focus:border-creator-black' : 'border-creator-border bg-creator-surface text-creator-muted cursor-not-allowed'
                      }`}
                    />
                  </div>

                  {/* State & Zip Row */}
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-creator-muted mb-2">State</label>
                      <input 
                        type="text" 
                        name="state"
                        value={formData.state} 
                        onChange={handleInputChange}
                        disabled={!isEditing}
                        className={`w-full p-4 border text-sm outline-none transition-colors ${
                          isEditing ? 'border-creator-border bg-creator-white focus:border-creator-black' : 'border-creator-border bg-creator-surface text-creator-muted cursor-not-allowed'
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-creator-muted mb-2">ZIP Code</label>
                      <input 
                        type="text" 
                        name="zip"
                        value={formData.zip} 
                        onChange={handleInputChange}
                        disabled={!isEditing}
                        className={`w-full p-4 border text-sm outline-none transition-colors ${
                          isEditing ? 'border-creator-border bg-creator-white focus:border-creator-black' : 'border-creator-border bg-creator-surface text-creator-muted cursor-not-allowed'
                        }`}
                      />
                    </div>
                  </div>
                </div>

                {/* Save / Cancel Controls */}
                {isEditing && (
                  <div className="pt-8 flex items-center justify-end gap-6 border-t border-creator-border mt-8">
                    <button 
                      type="button"
                      onClick={handleCancelEdit}
                      disabled={isUpdating}
                      className="text-xs uppercase tracking-widest text-creator-muted hover:text-creator-black transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      disabled={isUpdating}
                      className="bg-creator-black text-creator-white px-8 py-4 text-xs uppercase tracking-widest hover:bg-gray-900 transition-colors disabled:opacity-70"
                    >
                      {isUpdating ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                )}
              </form>
            </div>
          )}

        </div>
      </div>
    </main>
  );
};

export default Profile;