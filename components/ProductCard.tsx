
import React from 'react';
import { AimsiiProduct } from '../types';
import { LoadingIcon, SparklesIcon } from './Icons';

interface ProductCardProps {
  product: AimsiiProduct;
  onGenerate: (product: AimsiiProduct) => void;
  isGenerating: boolean;
  isSelected: boolean;
}

const ProductCard: React.FC<ProductCardProps> & { Skeleton: React.FC } = ({ product, onGenerate, isGenerating, isSelected }) => {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border-2 transition-all duration-300 ${isSelected ? 'border-brand-secondary' : 'border-transparent hover:border-brand-secondary/50'}`}>
      <div className="relative">
        <img className="h-48 w-full object-cover" src={product.imageUrl} alt={product.name} />
        <div className="absolute top-0 right-0 bg-brand-accent text-white px-2 py-1 text-xs font-bold rounded-bl-lg">{product.category}</div>
      </div>
      <div className="p-4">
        <p className="text-sm font-semibold text-brand-secondary dark:text-brand-accent">{product.brand}</p>
        <h3 className="font-bold text-lg mt-1 text-gray-900 dark:text-white truncate">{product.name}</h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">SKU: {product.sku}</p>
        
        <div className="flex justify-between items-center mt-4">
          <p className="text-lg font-bold text-brand-primary dark:text-brand-light">${product.price.toFixed(2)}</p>
          <p className="text-sm text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">Qty: {product.quantity}</p>
        </div>

        <button 
          onClick={() => onGenerate(product)}
          disabled={isGenerating}
          className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2 bg-brand-secondary hover:bg-blue-600 text-white font-semibold rounded-lg shadow-md transition-all duration-300 ease-in-out transform hover:scale-105 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:scale-100"
        >
          {isGenerating ? (
            <>
              <LoadingIcon className="animate-spin h-5 w-5" />
              Generating...
            </>
          ) : (
            <>
              <SparklesIcon className="h-5 w-5" />
              Generate Shopify Listing
            </>
          )}
        </button>
      </div>
    </div>
  );
};

const ProductCardSkeleton: React.FC = () => {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden animate-pulse-fast">
            <div className="h-48 w-full bg-gray-300 dark:bg-gray-700"></div>
            <div className="p-4">
                <div className="h-4 w-1/4 bg-gray-300 dark:bg-gray-700 rounded"></div>
                <div className="h-6 w-3/4 bg-gray-300 dark:bg-gray-700 rounded mt-2"></div>
                <div className="h-4 w-1/2 bg-gray-300 dark:bg-gray-700 rounded mt-2"></div>
                <div className="flex justify-between items-center mt-4">
                    <div className="h-7 w-1/3 bg-gray-300 dark:bg-gray-700 rounded"></div>
                    <div className="h-7 w-1/4 bg-gray-300 dark:bg-gray-700 rounded-full"></div>
                </div>
                <div className="h-10 w-full bg-gray-300 dark:bg-gray-700 rounded-lg mt-4"></div>
            </div>
        </div>
    );
};

ProductCard.Skeleton = ProductCardSkeleton;

export default ProductCard;
