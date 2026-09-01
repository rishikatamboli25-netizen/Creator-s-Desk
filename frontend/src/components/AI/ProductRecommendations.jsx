import { ShoppingCart, Eye } from "lucide-react";

export default function ProductRecommendations({ data, onAddToCart }) {
  if (!data || !data.recommendations || data.recommendations.length === 0) return null;

  const handleAddAllToCart = () => {
    if (onAddToCart) onAddToCart(data.recommendations);
  };

  const handleAddSingleItem = (item) => {
    if (onAddToCart) onAddToCart([item]);
  };

  return (
    <div className="mt-4 w-full">
      {/* Horizontal Carousel */}
      <div className="flex gap-4 overflow-x-auto pb-4 pt-2 snap-x snap-mandatory hide-scrollbar">
        {data.recommendations.map((item, idx) => (
          <div 
            key={idx} 
            className="shrink-0 w-[260px] flex flex-col justify-between p-4 rounded-xl border border-gray-200 bg-white snap-center shadow-sm"
          >
            <div>
              {/* Product Image */}
              {item.image && (
                <div className="w-full h-32 mb-3 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
                  <img 
                    src={item.image} 
                    alt={item.name} 
                    className="object-cover w-full h-full mix-blend-multiply"
                    onError={(e) => e.target.style.display = 'none'} 
                  />
                </div>
              )}
              
              <div className="flex justify-between items-start gap-2 mb-2">
                <span className="font-semibold text-sm text-gray-900 leading-tight">{item.name}</span>
                <span className="font-bold text-indigo-600 text-sm whitespace-nowrap">${item.price}</span>
              </div>
              <p className="text-xs text-gray-500 line-clamp-3 mb-4">{item.reason}</p>
            </div>
            
            {/* Split Action Buttons */}
            <div className="flex gap-2 w-full mt-auto">
              <button 
                onClick={() => console.log("Navigate to product:", item.slug)}
                className="flex-1 flex items-center justify-center gap-1 py-2 bg-gray-50 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-100 transition"
              >
                <Eye size={14} /> View
              </button>
              <button 
                onClick={() => handleAddSingleItem(item)}
                className="flex-1 flex items-center justify-center gap-1 py-2 bg-indigo-50 border border-indigo-200 rounded-lg text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition"
              >
                <ShoppingCart size={14} /> Add
              </button>
            </div>
          </div>
        ))}
      </div>
      
      {/* Footer Total & Add All */}
      {data.recommendations.length > 1 && (
        <div className="mt-2 pt-4 border-t border-gray-200 flex flex-col gap-3">
          <div className="flex justify-between text-sm font-bold text-gray-900">
            <span>Total Estimate:</span>
            <span>${data.totalPrice}</span>
          </div>
          <button 
            onClick={handleAddAllToCart}
            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium text-sm hover:bg-indigo-700 shadow-sm transition flex justify-center items-center gap-2"
          >
            <ShoppingCart size={16} /> Add Everything to Cart
          </button>
        </div>
      )}
    </div>
  );
}