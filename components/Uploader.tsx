import React, { useState, useCallback } from 'react';
import Papa, { ParseResult } from 'papaparse';
import * as XLSX from 'xlsx';
import { ProcessedProduct, ShopifyProductData, ProcessingStatus, ColumnMapping } from '../types';
import { generateShopifyProductJson, SHOPIFY_TARGET_FIELDS } from '../services/geminiService';
import { createProductDraft } from '../services/shopifyService';
import ShopifyPreview from './ShopifyPreview';
import { LoadingIcon, ShopifyIcon, UploadIcon, CheckCircleIcon, XCircleIcon, SparklesIcon, EyeIcon, ArrowPathIcon, ExternalLinkIcon, MappingIcon } from './Icons';

type UploaderStep = 'UPLOAD_SHOPIFY' | 'UPLOAD_AIMSII' | 'MAP_COLUMNS' | 'PROCESSING' | 'RESULTS';

interface UploaderProps {
    shopifyStore: string;
    shopifyToken: string;
    isDemoMode: boolean;
    onNavigateSettings: () => void;
}

const Uploader: React.FC<UploaderProps> = ({ shopifyStore, shopifyToken, isDemoMode, onNavigateSettings }) => {
  const [step, setStep] = useState<UploaderStep>('UPLOAD_SHOPIFY');
  
  const [shopifyHeaders, setShopifyHeaders] = useState<string[]>([]);
  const [aimsiiHeaders, setAimsiiHeaders] = useState<string[]>([]);
  const [aimsiiData, setAimsiiData] = useState<Record<string, any>[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});

  const [products, setProducts] = useState<ProcessedProduct[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [selectedProduct, setSelectedProduct] = useState<ProcessedProduct | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isConfigured = (shopifyStore && shopifyToken) || isDemoMode;

  const handleFileParse = (file: File): Promise<{ headers: string[], data: Record<string, any>[] }> => {
    return new Promise((resolve, reject) => {
        const fileExtension = file.name.split('.').pop()?.toLowerCase();
        const reader = new FileReader();

        reader.onerror = () => reject(new Error('Failed to read file.'));

        if (fileExtension === 'xlsx') {
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target?.result as ArrayBuffer);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                    
                    if (jsonData.length < 1) {
                        return reject(new Error("XLSX file is empty or has no data."));
                    }

                    const headers = jsonData[0].map(String);
                    const dataRows = jsonData.slice(1).map(rowArray => {
                        const rowObject: Record<string, any> = {};
                        headers.forEach((header, index) => {
                            rowObject[header] = rowArray[index];
                        });
                        return rowObject;
                    });
                    
                    resolve({ headers, data: dataRows });
                } catch (err) {
                    reject(new Error("Failed to parse XLSX file. It might be corrupted or in an unsupported format."));
                }
            };
            reader.readAsArrayBuffer(file);
        } else { // Assume CSV for others
            reader.onload = (e) => {
                const text = e.target?.result as string;
                Papa.parse<Record<string, any>>(text, {
                    header: true,
                    skipEmptyLines: true,
                    complete: (results) => {
                        if (results.errors.length) {
                            reject(new Error(`Error parsing CSV: ${results.errors[0].message}`));
                        } else {
                            const headers = results.meta.fields || [];
                            if (headers.length === 0) {
                                return reject(new Error("Could not detect any headers in the CSV file."));
                            }
                            resolve({ headers, data: results.data });
                        }
                    },
                    error: (err) => reject(err)
                });
            };
            reader.readAsText(file);
        }
    });
  };

  const handleShopifyUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const { headers } = await handleFileParse(file);
      setShopifyHeaders(headers);
      setStep('UPLOAD_AIMSII');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse Shopify file.');
    }
    event.target.value = ''; // Allow re-uploading the same file
  };
  
  const handleAimsiiUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const { headers, data } = await handleFileParse(file);
      setAimsiiHeaders(headers);
      setAimsiiData(data);

      const initialMap: ColumnMapping = {};
      SHOPIFY_TARGET_FIELDS.forEach(sField => {
          const simpleSField = sField.split('.').pop()?.toLowerCase() ?? '';
          const foundAimsiiField = headers.find(aField => {
               const simpleAField = aField.toLowerCase();
               return simpleAField.includes(simpleSField) || simpleSField.includes(simpleAField);
          });
          initialMap[sField] = foundAimsiiField || null;
      });
      setMapping(initialMap);

      setStep('MAP_COLUMNS');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse AIMSii file.');
    }
    event.target.value = ''; // Allow re-uploading the same file
  };
  
  const updateProductState = useCallback((id: string, status: ProcessingStatus, data?: Partial<ProcessedProduct>) => {
    setProducts(prev =>
      prev.map(p => (p.id === id ? { ...p, status, ...data } : p))
    );
  }, []);

  const handleProcess = async () => {
    setStep('PROCESSING');
    setIsProcessing(true);
    
    const initialProducts: ProcessedProduct[] = aimsiiData.map((row, index) => {
      const skuField = Object.keys(mapping).find(key => key.toLowerCase().includes('sku'));
      const id = skuField && mapping[skuField] ? row[mapping[skuField]!] : `row-${index}`;
      return {
          id: String(id),
          sourceData: row,
          status: 'pending',
      };
    });
    setProducts(initialProducts);
    setStep('RESULTS');

    for (const product of initialProducts) {
        try {
            updateProductState(product.id, 'generating');
            const jsonString = await generateShopifyProductJson(product.sourceData, mapping);
            const shopifyData: ShopifyProductData = JSON.parse(jsonString);

            updateProductState(product.id, 'creating', { shopifyData });
            const response = await createProductDraft(shopifyData, shopifyStore, shopifyToken, isDemoMode);

            updateProductState(product.id, 'success', { shopifyId: response.shopifyId });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
            updateProductState(product.id, 'error', { errorMessage });
        }
    }
    setIsProcessing(false);
  };

  const handleReset = () => {
    setStep('UPLOAD_SHOPIFY');
    setShopifyHeaders([]);
    setAimsiiHeaders([]);
    setAimsiiData([]);
    setMapping({});
    setProducts([]);
    setIsProcessing(false);
    setSelectedProduct(null);
    setError(null);
  };

  const renderStatusIcon = (status: ProcessingStatus) => {
    switch (status) {
      case 'pending': return <LoadingIcon className="h-5 w-5 text-gray-400" />;
      case 'generating': return <SparklesIcon className="h-5 w-5 text-blue-500 animate-pulse-fast" />;
      case 'creating': return <ShopifyIcon className="h-5 w-5 text-green-500 animate-pulse-fast" />;
      case 'success': return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'error': return <XCircleIcon className="h-5 w-5 text-red-500" />;
    }
  };

  const renderUploadStep = (title: string, description: string, onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void, fileId: string) => (
    <div className="text-center max-w-2xl mx-auto animate-fade-in">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
            <UploadIcon className="h-16 w-16 mx-auto text-brand-primary dark:text-brand-light" />
            <h2 className="text-2xl font-bold text-brand-primary dark:text-brand-light mt-4">{title}</h2>
            <p className="text-gray-500 dark:text-gray-400 mt-2">{description}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
              Supports .xlsx and .csv files from Excel, Google Sheets, etc.
            </p>
            <div className="mt-6">
                <label htmlFor={fileId} className="inline-flex items-center justify-center gap-2 w-full md:w-auto px-6 py-3 bg-brand-primary hover:bg-brand-dark text-white font-semibold rounded-lg shadow-md transition-all duration-300 ease-in-out transform hover:scale-105 cursor-pointer">
                    <UploadIcon className="h-5 w-5" />
                    Choose File
                </label>
                <input id={fileId} type="file" accept=".csv, .xlsx, text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={onUpload} />
            </div>
            {error && <p className="text-red-500 mt-4 bg-red-100 dark:bg-red-900/50 p-3 rounded-lg">{error}</p>}
        </div>
    </div>
  );

  const renderMapColumnsStep = () => (
     <div className="max-w-4xl mx-auto animate-fade-in">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
        <div className="text-center">
            <MappingIcon className="h-16 w-16 mx-auto text-brand-primary dark:text-brand-light" />
            <h2 className="text-2xl font-bold text-brand-primary dark:text-brand-light mt-4">Map Columns</h2>
            <p className="text-gray-500 dark:text-gray-400 mt-2">Match Shopify fields to the columns from your AIMSii CSV.</p>
        </div>
        <div className="mt-6 space-y-4 max-h-96 overflow-y-auto pr-4">
            {SHOPIFY_TARGET_FIELDS.map(sField => (
                <div key={sField} className="grid grid-cols-2 gap-4 items-center">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 text-right">{sField}</label>
                    <select
                        value={mapping[sField] || ''}
                        onChange={e => setMapping(prev => ({ ...prev, [sField]: e.target.value || null }))}
                        className="block w-full text-sm border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 focus:ring-brand-secondary focus:border-brand-secondary"
                    >
                        <option value="">-- Do Not Map --</option>
                        {aimsiiHeaders.map(aField => (
                            <option key={aField} value={aField}>{aField}</option>
                        ))}
                    </select>
                </div>
            ))}
        </div>
        <div className="mt-8 flex justify-between items-center gap-4">
            <button onClick={handleReset} className="px-6 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-semibold rounded-lg shadow-sm transition-colors">
                Start Over
            </button>
            <button onClick={handleProcess} className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-brand-primary hover:bg-brand-dark text-white font-semibold rounded-lg shadow-md transition-colors">
                Process Products
            </button>
        </div>
      </div>
    </div>
  );

  const renderResultsStep = () => {
    const titleField = SHOPIFY_TARGET_FIELDS.find(f => f === 'title');
    const imageField = SHOPIFY_TARGET_FIELDS.find(f => f === 'images.src');
    const skuField = SHOPIFY_TARGET_FIELDS.find(f => f === 'variants.sku');

    return (
        <div className="animate-fade-in">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">Processing Results</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {products.filter(p => p.status === 'success' || p.status === 'error').length} of {products.length} products processed.
                    </p>
                </div>
                <button
                    onClick={handleReset}
                    disabled={isProcessing}
                    className="flex items-center justify-center gap-2 w-full md:w-auto px-5 py-2.5 bg-brand-secondary hover:bg-blue-600 text-white font-semibold rounded-lg shadow-sm transition-all duration-300 ease-in-out disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                    <ArrowPathIcon className="h-5 w-5" />
                    Process Another File
                </button>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                    {products.map(product => (
                    <li key={product.id} className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-4 flex-1 w-full">
                            {imageField && mapping[imageField] && (
                                <img src={product.sourceData[mapping[imageField]!]} alt="" className="h-12 w-12 rounded-lg object-cover hidden sm:block" />
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-gray-800 dark:text-gray-200 truncate">
                                    {titleField && mapping[titleField] ? product.sourceData[mapping[titleField]!] : `Product ID: ${product.id}`}
                                </p>
                                {skuField && mapping[skuField] && (
                                  <p className="text-sm text-gray-500 dark:text-gray-400">SKU: {product.sourceData[mapping[skuField]!]}</p>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-2 w-full md:w-auto">
                           <div className={`flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-full w-40 justify-center ${product.status === 'success' ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300' : product.status === 'error' ? 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300' : 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300'}`}>
                               {renderStatusIcon(product.status)}
                               <span>{product.status.charAt(0).toUpperCase() + product.status.slice(1)}</span>
                            </div>
                             {product.status === 'success' && product.shopifyId && (
                                <a 
                                  href={!isDemoMode ? `https://${shopifyStore}.myshopify.com/admin/products/${product.shopifyId}` : undefined} 
                                  onClick={(e) => { if (isDemoMode) e.preventDefault(); }}
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className={`p-2 rounded-md ${isDemoMode ? 'cursor-not-allowed opacity-30' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`} 
                                  aria-label="View in Shopify"
                                  title={isDemoMode ? "Link disabled in Demo Mode" : "View in Shopify Admin"}
                                >
                                    <ExternalLinkIcon className="h-5 w-5 text-gray-500"/>
                                </a>
                            )}
                            <button onClick={() => setSelectedProduct(product)} disabled={!product.shopifyData} className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30" aria-label="View Details">
                                <EyeIcon className="h-5 w-5 text-gray-500"/>
                            </button>
                        </div>
                        {product.status === 'error' && <p className="text-xs text-red-500 md:col-span-3 text-left w-full mt-2 md:mt-0">{product.errorMessage}</p>}
                    </li>
                    ))}
                </ul>
            </div>
        </div>
    );
  };

  const renderContent = () => {
    if (!isConfigured) {
        return (
            <div className="mt-4 text-center">
                <div className="bg-yellow-100 dark:bg-yellow-900/50 border-l-4 border-yellow-500 text-yellow-700 dark:text-yellow-300 p-4 rounded-lg max-w-2xl mx-auto" role="alert">
                    <p className="font-bold">Configuration Needed</p>
                    <p className="text-sm">Please configure your Shopify API credentials in the{' '}
                        <button onClick={onNavigateSettings} className="font-bold underline hover:text-yellow-800 dark:hover:text-yellow-200">Settings</button> page before uploading.
                    </p>
                </div>
            </div>
        );
    }
    
    switch(step) {
        case 'UPLOAD_SHOPIFY':
            return renderUploadStep('Step 1: Upload Shopify Template', 'Upload a CSV or XLSX file exported from Shopify to define the target columns.', handleShopifyUpload, 'shopify-upload');
        case 'UPLOAD_AIMSII':
            return renderUploadStep('Step 2: Upload AIMSii Data', 'Upload your source product data from AIMSii as a CSV or XLSX file.', handleAimsiiUpload, 'aimsii-upload');
        case 'MAP_COLUMNS':
            return renderMapColumnsStep();
        case 'PROCESSING':
        case 'RESULTS':
            return renderResultsStep();
        default:
            return <p>An unknown error occurred.</p>;
    }
  };
  
  return (
    <>
      {renderContent()}
      {selectedProduct && selectedProduct.shopifyData && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setSelectedProduct(null)}>
          <div className="bg-gray-100 dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
             <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center sticky top-0 bg-gray-100/80 dark:bg-gray-900/80 backdrop-blur-sm">
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">Shopify Draft Preview</h3>
                <button onClick={() => setSelectedProduct(null)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                    <XCircleIcon className="h-6 w-6 text-gray-500"/>
                </button>
             </div>
             <div className="p-4 md:p-6">
                 {/* The AimsiiProduct type is not a perfect match, but it's close enough for the preview */}
                <ShopifyPreview 
                  productData={selectedProduct.shopifyData}
                />
             </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Uploader;