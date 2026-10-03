
import { useState } from "react";
import { ShoppingCart, Eye, Check } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useCart } from "../../context/CartContext";
import { useAuth } from "../../context/AuthContext";

export default function ProductRecommendations({ data }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { addToCart } = useCart();
  const { isAuthenticated } = useAuth();

  const [addedItems, setAddedItems] = useState([]);
  const [addingAll, setAddingAll] = useState(false);

  if (!data?.recommendations?.length) return null;

  const recommendations = data.recommendations;

  const normalizeProduct = (item) => ({
    ...item,
    id: item.slug || item._id,
    _id: item._id || item.slug,
    name: item.name,
    price: Number(item.price) || 0,
    image: item.image || "",
    slug: item.slug,
  });

  const requireAuth = () => {
    if (!isAuthenticated) {
      navigate("/login", {
        state: {
          returnTo: `${location.pathname}${location.search}`,
        },
      });
      return false;
    }
    return true;
  };

  const handleAddSingleItem = (item, idx) => {
    if (!requireAuth()) return;

    if (item.inStock === false) return;

    addToCart(normalizeProduct(item));

    setAddedItems((prev) => [...new Set([...prev, idx])]);

    setTimeout(() => {
      setAddedItems((prev) => prev.filter((id) => id !== idx));
    }, 1500);
  };

  const handleAddAllToCart = () => {
    if (!requireAuth()) return;

    const availableItems = recommendations.filter(
      (item) => item.inStock !== false
    );

    if (availableItems.length === 0) return;

    setAddingAll(true);

    availableItems.forEach((item) => {
      addToCart(normalizeProduct(item));
    });

    setAddedItems(recommendations.map((_, idx) => idx));

    setTimeout(() => {
      setAddingAll(false);
      setAddedItems([]);
    }, 1500);
  };

  const handleViewProduct = (item) => {
    if (item.slug) {
      navigate(`/product?id=${encodeURIComponent(item.slug)}`);
    }
  };

  return (
    <div className="mt-4 w-full">
      {/* Horizontal Carousel */}
      <div className="flex gap-4 overflow-x-auto pb-4 pt-2 snap-x snap-mandatory hide-scrollbar">
        {recommendations.map((item, idx) => {
          const isAdded = addedItems.includes(idx);
          const isOutOfStock = item.inStock === false;

          return (
            <div
              key={item._id || item.slug || idx}
              className="shrink-0 w-[260px] flex flex-col justify-between p-4 rounded-xl border border-gray-200 bg-white snap-center shadow-sm transition-shadow duration-300 hover:shadow-md"
            >
              <div>
                {/* Product Image */}
                {item.image && (
                  <div className="w-full h-32 mb-3 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="object-cover w-full h-full mix-blend-multiply"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  </div>
                )}

                <div className="flex justify-between items-start gap-2 mb-2">
                  <span className="font-semibold text-sm text-gray-900 leading-tight">
                    {item.name}
                  </span>
                  <span className="font-bold text-indigo-600 text-sm whitespace-nowrap">
                    ₹{Number(item.price || 0).toLocaleString("en-IN")}
                  </span>
                </div>

                <p className="text-xs text-gray-500 line-clamp-3 mb-4">
                  {item.reason}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 w-full mt-auto">
                <button
                  onClick={() => handleViewProduct(item)}
                  className="flex-1 flex items-center justify-center gap-1 py-2 bg-gray-50 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors duration-200"
                >
                  <Eye size={14} />
                  View
                </button>

                <button
                  onClick={() => handleAddSingleItem(item, idx)}
                  disabled={isAdded || isOutOfStock}
                  className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-medium transition-all duration-300 ${
                    isOutOfStock
                      ? "bg-gray-100 border border-gray-200 text-gray-400 cursor-not-allowed"
                      : isAdded
                      ? "bg-green-50 border border-green-200 text-green-700"
                      : "bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100"
                  }`}
                >
                  {isOutOfStock ? (
                    "Unavailable"
                  ) : isAdded ? (
                    <>
                      <Check size={14} className="animate-[popIn_0.3s_ease-out]" />
                      Added
                    </>
                  ) : (
                    <>
                      <ShoppingCart size={14} />
                      Add
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Total & Add All */}
      {recommendations.length > 1 && (
        <div className="mt-2 pt-4 border-t border-gray-200 flex flex-col gap-3">
          <div className="flex justify-between text-sm font-bold text-gray-900">
            <span>Total Estimate:</span>
            <span>
              ₹{Number(data.totalPrice || 0).toLocaleString("en-IN")}
            </span>
          </div>

          <button
            onClick={handleAddAllToCart}
            disabled={addingAll || recommendations.every(
              (item) => item.inStock === false
            )}
            className={`w-full py-3 text-white rounded-xl font-medium text-sm shadow-sm transition-all duration-300 flex justify-center items-center gap-2 ${
              addingAll
                ? "bg-green-600"
                : "bg-indigo-600 hover:bg-indigo-700"
            } disabled:opacity-60 disabled:cursor-not-allowed`}
          >
            {addingAll ? (
              <>
                <Check size={16} className="animate-[popIn_0.3s_ease-out]" />
                Added to Cart
              </>
            ) : (
              <>
                <ShoppingCart size={16} />
                Add Everything to Cart
              </>
            )}
          </button>
        </div>
      )}

      <style>{`
        @keyframes popIn {
          0% { transform: scale(0.5); opacity: 0; }
          70% { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}