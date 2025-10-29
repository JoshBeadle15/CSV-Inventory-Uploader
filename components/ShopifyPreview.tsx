import React, { useState } from 'react';
import { ShopifyProductData } from '../types';
import { CheckCircleIcon, ClipboardIcon, DollarIcon, TagIcon, ArchiveBoxIcon } from './Icons';

interface ShopifyPreviewProps {
  productData: ShopifyProductData;
  // The aimsiiProduct is no longer needed as all data comes from the shopify object
}

const SectionCard: React.FC<{ title: string; children: React.ReactNode, icon?: React.ReactNode }> = ({ title, children, icon }) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
           {icon} {title}
        </h3>
        <div className="p-4 space-y-4">
            {children}
        </div>
    </div>
);

const InfoField: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div>
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">{label}</label>
        <div className="text-sm text-gray-900 dark:text-gray-100 break-words">{children}</div>
    </div>
);


const ShopifyPreview: React.FC<ShopifyPreviewProps> = ({ productData }) => {
  const [activeTab, setActiveTab] = useState<'preview' | 'json'>('preview');
  const [copied, setCopied] = useState(false);
  const { product } = productData;

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(productData, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderShopifyAdminPreview = () => (
    <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg animate-fade-in">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column */}
            <div className="lg:col-span-2 space-y-6">
                <SectionCard title="Product Details">
                    <InfoField label="Title">
                        <p className="p-2 bg-gray-100 dark:bg-gray-700 rounded-md">{product.title}</p>
                    </InfoField>
                    <InfoField label="Description">
                        <div className="prose prose-sm dark:prose-invert max-w-none p-2 bg-gray-100 dark:bg-gray-700 rounded-md border border-gray-200 dark:border-gray-600 min-h-[100px]" dangerouslySetInnerHTML={{ __html: product.body_html }}></div>
                    </InfoField>
                </SectionCard>
                <SectionCard title="Media">
                     <img src={product.images[0]?.src} alt={product.title} className="w-full h-auto object-cover rounded-lg shadow-md max-w-xs" />
                </SectionCard>
                <SectionCard title="Pricing" icon={<DollarIcon className="h-4 w-4 text-gray-500" />}>
                     <InfoField label="Price">
                        <p className="p-2 bg-gray-100 dark:bg-gray-700 rounded-md w-full md:w-1/2">${product.variants[0]?.price}</p>
                    </InfoField>
                </SectionCard>
                 <SectionCard title="Inventory" icon={<ArchiveBoxIcon className="h-4 w-4 text-gray-500" />}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <InfoField label="SKU (Stock Keeping Unit)">
                            <p className="p-2 bg-gray-100 dark:bg-gray-700 rounded-md">{product.variants[0]?.sku}</p>
                        </InfoField>
                        <InfoField label="Quantity">
                           <p className="p-2 bg-gray-100 dark:bg-gray-700 rounded-md">{product.variants[0]?.inventory_quantity}</p>
                        </InfoField>
                    </div>
                </SectionCard>
            </div>

            {/* Right Column */}
            <div className="lg:col-span-1 space-y-6">
                <SectionCard title="Organization">
                    <InfoField label="Product Status">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">
                            Draft
                        </span>
                    </InfoField>
                    <InfoField label="Product Type">
                        <p className="p-2 bg-gray-100 dark:bg-gray-700 rounded-md">{product.product_type}</p>
                    </InfoField>
                    <InfoField label="Vendor">
                         <p className="p-2 bg-gray-100 dark:bg-gray-700 rounded-md">{product.vendor}</p>
                    </InfoField>
                </SectionCard>
                 <SectionCard title="Tags" icon={<TagIcon className="h-4 w-4 text-gray-500"/>}>
                    <div className="flex flex-wrap gap-2">
                        {product.tags.split(',').map(tag => (
                            <span key={tag.trim()} className="text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 px-2 py-1 rounded-md">{tag.trim()}</span>
                        ))}
                    </div>
                </SectionCard>
            </div>
        </div>
    </div>
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex space-x-1 bg-gray-100 dark:bg-gray-900 p-1 rounded-lg">
          <button 
            onClick={() => setActiveTab('preview')}
            className={`w-full py-2 px-4 rounded-md text-sm font-medium transition-colors ${activeTab === 'preview' ? 'bg-white dark:bg-gray-700 shadow text-brand-primary dark:text-white' : 'text-gray-500 hover:bg-white/50 dark:hover:bg-gray-700/50'}`}
          >
            Shopify Admin Preview
          </button>
          <button 
            onClick={() => setActiveTab('json')}
            className={`w-full py-2 px-4 rounded-md text-sm font-medium transition-colors ${activeTab === 'json' ? 'bg-white dark:bg-gray-700 shadow text-brand-primary dark:text-white' : 'text-gray-500 hover:bg-white/50 dark:hover:bg-gray-700/50'}`}
          >
            JSON Data
          </button>
        </div>
      </div>
      
      {activeTab === 'preview' && renderShopifyAdminPreview()}
      
      {activeTab === 'json' && (
        <div className="p-4 md:p-6 animate-fade-in">
          <div className="relative">
            <button onClick={handleCopy} className="absolute top-2 right-2 p-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
              {copied ? <CheckCircleIcon className="h-5 w-5 text-green-500" /> : <ClipboardIcon className="h-5 w-5 text-gray-600 dark:text-gray-300" />}
            </button>
            <pre className="bg-gray-100 dark:bg-gray-900 text-sm p-4 rounded-lg overflow-x-auto">
              <code className="text-gray-800 dark:text-gray-200">
                {JSON.stringify(productData, null, 2)}
              </code>
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShopifyPreview;