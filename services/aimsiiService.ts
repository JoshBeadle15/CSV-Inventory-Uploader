
import { AimsiiProduct } from '../types';

const masterProductList: AimsiiProduct[] = [
  {
    id: 'aimsii-001',
    sku: 'HW-WTR-BTL-SS',
    name: 'HydroWave Stainless Steel Water Bottle',
    description: 'Stay hydrated on the go with our 24oz double-walled stainless steel water bottle. Keeps drinks cold for 24 hours and hot for 12. BPA-free and leak-proof lid.',
    price: 24.99,
    quantity: 150,
    category: 'Drinkware',
    brand: 'AquaFlow',
    imageUrl: 'https://picsum.photos/seed/bottle/600/400',
  },
  {
    id: 'aimsii-002',
    sku: 'ECO-BMB-CUT-BRD',
    name: 'EcoFriendly Bamboo Cutting Board',
    description: 'A durable and eco-friendly cutting board made from 100% organic bamboo. Features a juice groove to prevent spills. Measures 18x12 inches.',
    price: 19.95,
    quantity: 85,
    category: 'Kitchenware',
    brand: 'TerraKitchen',
    imageUrl: 'https://picsum.photos/seed/board/600/400',
  },
  {
    id: 'aimsii-003',
    sku: 'TRVL-LTHR-JRNL',
    name: 'Artisan Leather Travel Journal',
    description: 'Handcrafted genuine leather journal with 200 unlined pages. Perfect for notes, sketches, and travel memories. Compact size fits in any bag.',
    price: 35.00,
    quantity: 210,
    category: 'Stationery',
    brand: 'Nomad Notes',
    imageUrl: 'https://picsum.photos/seed/journal/600/400',
  },
  {
    id: 'aimsii-004',
    sku: 'YGA-PRO-MAT-BLK',
    name: 'Aura Pro Yoga Mat',
    description: 'High-density, non-slip professional yoga mat for ultimate comfort and stability. Made from eco-friendly materials. Comes with a carrying strap.',
    price: 59.50,
    quantity: 60,
    category: 'Fitness',
    brand: 'ZenFit',
    imageUrl: 'https://picsum.photos/seed/yogamat/600/400',
  },
  {
    id: 'aimsii-005',
    sku: 'AR-CFF-GRND-MED',
    name: 'Artisanal Medium Roast Coffee Beans',
    description: 'A 12oz bag of single-origin arabica coffee beans, medium roasted to bring out notes of chocolate and citrus. Ethically sourced.',
    price: 18.00,
    quantity: 300,
    category: 'Groceries',
    brand: 'Morning Ritual',
    imageUrl: 'https://picsum.photos/seed/coffee/600/400',
  },
  {
    id: 'aimsii-006',
    sku: 'SLR-PWR-BNK-20K',
    name: 'Solar Power Bank 20000mAh',
    description: 'Charge your devices anywhere with this rugged, water-resistant 20000mAh solar power bank. Features dual USB ports and a built-in LED flashlight.',
    price: 45.99,
    quantity: 120,
    category: 'Electronics',
    brand: 'SunCharge',
    imageUrl: 'https://picsum.photos/seed/powerbank/600/400',
  },
];

let revealedProductCount = 0;

// This interval simulates new products being added to the AIMSii system over time,
// independent of our application's polling.
const revealInterval = setInterval(() => {
    if (revealedProductCount < masterProductList.length) {
        revealedProductCount++;
    } else {
        clearInterval(revealInterval); // Stop when all products are revealed
    }
}, 10000); // A new product appears every 10 seconds

export const fetchAimsiiProducts = (): Promise<AimsiiProduct[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      // Return the currently "visible" subset of products
      resolve(masterProductList.slice(0, revealedProductCount));
    }, 1200); // Simulate network delay
  });
};
