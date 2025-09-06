'use client';

import { useState, useEffect } from 'react';
import { NaverSearchItem } from '@/types';

interface ProductListModalProps {
  isOpen: boolean;
  onClose: () => void;
  categoryPath: string;
  items: NaverSearchItem[];
}

export default function ProductListModal({ 
  isOpen, 
  onClose, 
  categoryPath, 
  items 
}: ProductListModalProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<'default' | 'price_asc' | 'price_desc'>('default');
  const [selectedBrands, setSelectedBrands] = useState<Set<string>>(new Set());
  const priceRange = { min: 0, max: Infinity };
  
  const itemsPerPage = 20;

  // Get unique brands
  const brands = Array.from(new Set(items.map(item => item.brand).filter(Boolean)));
  
  // Filter and sort items
  let filteredItems = [...items];
  
  // Apply brand filter
  if (selectedBrands.size > 0) {
    filteredItems = filteredItems.filter(item => 
      item.brand && selectedBrands.has(item.brand)
    );
  }
  
  // Apply price filter
  filteredItems = filteredItems.filter(item => {
    const price = parseInt(item.lprice);
    return price >= priceRange.min && price <= priceRange.max;
  });
  
  // Apply sorting
  if (sortBy === 'price_asc') {
    filteredItems.sort((a, b) => parseInt(a.lprice) - parseInt(b.lprice));
  } else if (sortBy === 'price_desc') {
    filteredItems.sort((a, b) => parseInt(b.lprice) - parseInt(a.lprice));
  }
  
  // Pagination
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedItems = filteredItems.slice(startIndex, startIndex + itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [sortBy, selectedBrands]);

  const toggleBrand = (brand: string) => {
    const newBrands = new Set(selectedBrands);
    if (newBrands.has(brand)) {
      newBrands.delete(brand);
    } else {
      newBrands.add(brand);
    }
    setSelectedBrands(newBrands);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-7xl max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="border-b dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">카테고리 상품 목록</h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{categoryPath}</p>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  총 {filteredItems.length}개 상품
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div className="flex h-[calc(90vh-120px)]">
            {/* Sidebar Filters */}
            <div className="w-64 border-r dark:border-gray-700 p-4 overflow-y-auto">
              <div className="space-y-6">
                {/* Sort Options */}
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-3">정렬</h3>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'default' | 'price_asc' | 'price_desc')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  >
                    <option value="default">기본순</option>
                    <option value="price_asc">가격 낮은순</option>
                    <option value="price_desc">가격 높은순</option>
                  </select>
                </div>

                {/* Brand Filter */}
                {brands.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-3">브랜드</h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {brands.slice(0, 20).map(brand => (
                        <label key={brand} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={selectedBrands.has(brand)}
                            onChange={() => toggleBrand(brand)}
                            className="mr-2 rounded border-gray-300"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">{brand}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Product List */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 gap-4">
                {paginatedItems.map((item, index) => (
                  <div key={index} className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4 hover:shadow-lg transition-shadow">
                    <div className="flex gap-4">
                      {/* Product Image */}
                      {item.image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.image}
                          alt={item.title}
                          className="w-24 h-24 object-cover rounded-lg"
                        />
                      )}
                      
                      {/* Product Info */}
                      <div className="flex-1">
                        <h3 
                          className="font-semibold text-gray-900 dark:text-white mb-1"
                          dangerouslySetInnerHTML={{ __html: item.title }}
                        />
                        
                        <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-2">
                          {item.brand && <span>브랜드: {item.brand}</span>}
                          {item.mallName && <span>판매처: {item.mallName}</span>}
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                              {parseInt(item.lprice).toLocaleString()}원
                            </span>
                            {item.hprice && parseInt(item.hprice) > parseInt(item.lprice) && (
                              <span className="ml-2 text-sm text-gray-500 line-through">
                                {parseInt(item.hprice).toLocaleString()}원
                              </span>
                            )}
                          </div>
                          
                          <a
                            href={item.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                          >
                            네이버 쇼핑 보기
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-6 flex justify-center items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed dark:border-gray-600"
                  >
                    이전
                  </button>
                  
                  <div className="flex gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      
                      return (
                        <button
                          key={i}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`px-3 py-1 rounded-lg ${
                            currentPage === pageNum
                              ? 'bg-blue-600 text-white'
                              : 'border dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed dark:border-gray-600"
                  >
                    다음
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}