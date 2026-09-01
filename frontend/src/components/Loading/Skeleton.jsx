// src/components/loading/Skeleton.jsx
export default function Skeleton({ className = "", ...props }) {
  return (
    <div 
      className={`animate-pulse bg-gray-200 rounded-md ${className}`} 
      {...props} 
    />
  );
}