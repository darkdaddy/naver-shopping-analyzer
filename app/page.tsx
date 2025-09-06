'use client';

import { useState } from 'react';
import Link from 'next/link';
import { NaverSearchResponse, SearchAnalysisResult, NaverSearchItem } from '@/types';
import ProductListModal from '@/components/ProductListModal';

interface AnalysisData {
  searchResult: NaverSearchResponse;
  analysis: SearchAnalysisResult;
  insights: {
    dominantCategory: string | null;
    categoryDiversity: number;
    avgCategoryDepth: number;
    priceRange: { min: number; max: number };
  };
  topBrands: { brand: string; count: number }[];
  categoryItemsMap: Record<string, NaverSearchItem[]>;
}

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<{
    path: string;
    items: NaverSearchItem[];
  } | null>(null);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setError('검색어를 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setAnalysisData(null);

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: searchQuery,
          maxItems: 500
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || '검색 중 오류가 발생했습니다.');
      }

      setAnalysisData(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      handleSearch();
    }
  };

  const openProductList = (categoryPath: string) => {
    if (analysisData && analysisData.categoryItemsMap[categoryPath]) {
      setSelectedCategory({
        path: categoryPath,
        items: analysisData.categoryItemsMap[categoryPath]
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-black">
      <div className="container mx-auto px-4 py-16">
        <header className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            네이버 쇼핑 카테고리 분석기
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            검색어를 입력하면 네이버 쇼핑에서 우선 노출되는 카테고리를 분석합니다
          </p>
        </header>

        <main className="max-w-6xl mx-auto">
          {/* Navigation Tabs */}
          <div className="flex space-x-1 mb-8">
            <div className="px-4 py-2 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 font-semibold">
              단일 검색
            </div>
            <Link 
              href="/batch"
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              다중 검색
            </Link>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
            <div className="space-y-6">
              <div>
                <label htmlFor="search" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  검색어 입력
                </label>
                <div className="flex gap-4">
                  <input
                    type="text"
                    id="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={isLoading}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:opacity-50"
                    placeholder="예: 접착제, 노트북, 운동화..."
                  />
                  <button 
                    onClick={handleSearch}
                    disabled={isLoading}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? '분석 중...' : '분석하기'}
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <p className="text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}

              {!analysisData && !error && !isLoading && (
                <div className="text-center text-gray-500 dark:text-gray-400 py-12">
                  검색어를 입력하고 분석하기 버튼을 클릭하세요
                </div>
              )}
            </div>
          </div>

          {analysisData && (
            <>
              {/* Analysis Summary */}
              <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
                <h2 className="text-2xl font-bold mb-6">분석 요약</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-400">총 검색 결과</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {analysisData.searchResult.total.toLocaleString()}개
                    </p>
                  </div>
                  
                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-400">분석한 상품</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {analysisData.analysis.analyzedItems}개
                    </p>
                  </div>
                  
                  <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-400">카테고리 다양성</p>
                    <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                      {analysisData.insights.categoryDiversity}%
                    </p>
                  </div>
                  
                  <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-400">평균 카테고리 깊이</p>
                    <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                      {analysisData.insights.avgCategoryDepth}단계
                    </p>
                  </div>
                </div>

                {analysisData.insights.dominantCategory && (
                  <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">🎯 우선 노출 카테고리</p>
                    <p className="text-lg font-semibold text-indigo-600 dark:text-indigo-400">
                      {analysisData.insights.dominantCategory}
                    </p>
                  </div>
                )}
              </div>

              {/* Top Categories */}
              <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
                <h2 className="text-2xl font-bold mb-6">카테고리별 분포</h2>
                <div className="space-y-4">
                  {analysisData.analysis.topCategories.slice(0, 10).map((category, index) => (
                    <div key={index} className="border-b dark:border-gray-700 pb-4 last:border-b-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex-1">
                          <p 
                            className="font-semibold text-gray-900 dark:text-white cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                            onClick={() => openProductList(category.categoryPath)}
                          >
                            {index + 1}. {category.categoryPath}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            평균 가격: {category.avgPrice.toLocaleString()}원 | 
                            카테고리 깊이: {category.categoryDepth}단계
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                            {category.percentage.toFixed(1)}%
                          </p>
                          <button
                            onClick={() => openProductList(category.categoryPath)}
                            className="text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 underline cursor-pointer"
                          >
                            {category.itemCount}개 상품 보기
                          </button>
                        </div>
                      </div>
                      
                      {/* Progress bar */}
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(category.percentage * 2, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Brands */}
              {analysisData.topBrands.length > 0 && (
                <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
                  <h2 className="text-2xl font-bold mb-6">주요 브랜드</h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {analysisData.topBrands.slice(0, 10).map((brand, index) => (
                      <div key={index} className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg text-center">
                        <p className="font-semibold text-gray-900 dark:text-white truncate">
                          {brand.brand}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {brand.count}개 상품
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Price Range */}
              {analysisData.insights.priceRange.min > 0 && (
                <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
                  <h2 className="text-2xl font-bold mb-6">가격 분포</h2>
                  <div className="flex items-center justify-between bg-gradient-to-r from-green-50 to-red-50 dark:from-green-900/20 dark:to-red-900/20 p-6 rounded-lg">
                    <div className="text-center">
                      <p className="text-sm text-gray-600 dark:text-gray-400">최저가</p>
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {analysisData.insights.priceRange.min.toLocaleString()}원
                      </p>
                    </div>
                    <div className="flex-1 mx-8">
                      <div className="h-2 bg-gradient-to-r from-green-400 to-red-400 rounded-full"></div>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-600 dark:text-gray-400">최고가</p>
                      <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                        {analysisData.insights.priceRange.max.toLocaleString()}원
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Product List Modal */}
      {selectedCategory && (
        <ProductListModal
          isOpen={!!selectedCategory}
          onClose={() => setSelectedCategory(null)}
          categoryPath={selectedCategory.path}
          items={selectedCategory.items}
        />
      )}
    </div>
  );
}