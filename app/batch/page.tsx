'use client';

import { useState } from 'react';
import Link from 'next/link';

interface BatchAnalysisResult {
  keyword: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  error?: string;
  categories?: {
    path: string;
    count: number;
    percentage: number;
  }[];
  totalItems?: number;
}

interface CategoryMatrix {
  categories: string[];
  keywords: {
    keyword: string;
    distribution: Record<string, number>;
  }[];
}

interface ProductNameSuggestion {
  name: string;
  keywords: string[];
  targetCategories: string[];
  score: number;
}

interface RelatedKeywordResult {
  keyword: string;
  related: string[];
}

export default function BatchAnalysis() {
  const [keywords, setKeywords] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<BatchAnalysisResult[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [matrix, setMatrix] = useState<CategoryMatrix | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [productNameSuggestions, setProductNameSuggestions] = useState<ProductNameSuggestion[]>([]);
  const [showProductNameBuilder, setShowProductNameBuilder] = useState(false);
  const [relatedKeywords, setRelatedKeywords] = useState<RelatedKeywordResult[]>([]);
  const [isGeneratingNames, setIsGeneratingNames] = useState(false);

  const processKeywords = async () => {
    const keywordList = keywords
      .split('\n')
      .map(k => k.trim())
      .filter(k => k.length > 0);

    const uniqueKeywords = Array.from(new Set(keywordList));

    if (uniqueKeywords.length === 0) {
      setError('키워드를 입력해주세요.');
      return;
    }

    if (uniqueKeywords.length > 100) {
      setError('최대 100개까지만 입력 가능합니다.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setResults([]);
    setMatrix(null);
    setProgress({ current: 0, total: uniqueKeywords.length });

    try {
      const response = await fetch('/api/batch-analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          keywords: uniqueKeywords,
        }),
      });

      if (!response.ok) {
        throw new Error('분석 요청 실패');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('스트림 읽기 실패');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              
              if (parsed.type === 'progress') {
                setProgress(parsed.data);
              } else if (parsed.type === 'result') {
                setResults(prev => [...prev, parsed.data]);
              } else if (parsed.type === 'matrix') {
                setMatrix(parsed.data);
              } else if (parsed.type === 'error') {
                setError(parsed.message);
              }
            } catch (e) {
              console.error('Parse error:', e);
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '분석 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  const generateProductNamesAdvanced = async () => {
    if (!results || results.length === 0) return;
    
    setIsGeneratingNames(true);
    setError(null);

    try {
      // 1. 연관검색어 추출
      const originalKeywords = results
        .filter(r => r.status === 'completed')
        .map(r => r.keyword);

      console.log('Fetching related keywords for:', originalKeywords);

      const relatedResponse = await fetch('/api/related-keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: originalKeywords })
      });

      if (!relatedResponse.ok) {
        throw new Error('연관검색어 추출 실패');
      }

      const relatedData = await relatedResponse.json();
      console.log('Related keywords response:', relatedData);
      setRelatedKeywords(relatedData.data || []);

      // 2. 연관검색어 포함하여 카테고리 분석
      const allKeywordsToAnalyze = new Set<string>(originalKeywords);
      if (relatedData.data && Array.isArray(relatedData.data)) {
        relatedData.data.forEach((item: RelatedKeywordResult) => {
          console.log(`Related keywords for ${item.keyword}:`, item.related);
          if (item.related && Array.isArray(item.related)) {
            item.related.forEach(k => allKeywordsToAnalyze.add(k));
          }
        });
      }

      console.log('Analyzing categories for all keywords:', Array.from(allKeywordsToAnalyze));

      // 3. 각 연관검색어의 카테고리 분석 (기존 결과 활용 + 추가 분석)
      const categoryKeywordMap: Record<string, Set<string>> = {};
      
      // 기존 결과에서 카테고리 정보 수집
      results.forEach(result => {
        if (result.categories && result.status === 'completed') {
          result.categories.slice(0, 2).forEach(cat => {
            if (cat.percentage > 20) {
              if (!categoryKeywordMap[cat.path]) {
                categoryKeywordMap[cat.path] = new Set();
              }
              categoryKeywordMap[cat.path].add(result.keyword);
              
              // 연관검색어도 같은 카테고리로 추정
              const related = relatedData.data.find((r: RelatedKeywordResult) => 
                r.keyword === result.keyword
              );
              if (related) {
                related.related.forEach((rk: string) => {
                  if (rk.includes(result.keyword) || result.keyword.includes(rk)) {
                    categoryKeywordMap[cat.path].add(rk);
                  }
                });
              }
            }
          });
        }
      });

      console.log('Category keyword mapping:', categoryKeywordMap);

      // 4. 카테고리별로 상품명 생성
      generateProductNamesFromMapping(categoryKeywordMap);

    } catch (error) {
      console.error('Error generating product names:', error);
      setError('상품명 생성 중 오류가 발생했습니다.');
    } finally {
      setIsGeneratingNames(false);
    }
  };

  const generateProductNamesFromMapping = (categoryKeywordMap: Record<string, Set<string>>) => {
    const suggestions: ProductNameSuggestion[] = [];
    
    // 카테고리별 템플릿
    const templates = [
      (kw: string[]) => `${kw.slice(0, 3).join(' ')} 전문가용 프리미엄`,
      (kw: string[]) => `${kw.slice(0, 2).join(' ')} ${kw.slice(2, 4).join(' ')} 세트`,
      (kw: string[]) => `올인원 ${kw.slice(0, 3).join(' ')} 패키지`,
      (kw: string[]) => `${kw[0]} ${kw.slice(1, 3).join(' ')} 베스트`,
      (kw: string[]) => `프로 ${kw.slice(0, 2).join(' ')} ${kw[2] || '제품'}`,
    ];

    Object.entries(categoryKeywordMap).forEach(([category, keywordSet]) => {
      const keywords = Array.from(keywordSet);
      
      if (keywords.length >= 2) {
        // 다양한 조합으로 상품명 생성
        for (let i = 0; i < Math.min(keywords.length, 5); i++) {
          for (let j = i + 1; j < Math.min(keywords.length, 6); j++) {
            const selectedKw = [keywords[i], keywords[j]];
            
            // 3개 조합도 추가
            if (keywords.length > j + 1) {
              selectedKw.push(keywords[Math.min(j + 1, keywords.length - 1)]);
            }
            
            templates.forEach((template, idx) => {
              const name = template(selectedKw);
              if (name.length >= 20 && name.length <= 50) {
                suggestions.push({
                  name,
                  keywords: selectedKw,
                  targetCategories: [category],
                  score: 80 + (idx * 3) - (name.length > 40 ? 5 : 0)
                });
              }
            });
          }
        }
      }
    });

    // 점수순 정렬 및 중복 제거
    const uniqueSuggestions = suggestions.reduce((acc, curr) => {
      const exists = acc.find(s => s.name === curr.name);
      if (!exists) acc.push(curr);
      return acc;
    }, [] as ProductNameSuggestion[]);

    uniqueSuggestions.sort((a, b) => b.score - a.score);
    setProductNameSuggestions(uniqueSuggestions.slice(0, 20));
    setShowProductNameBuilder(true);
    console.log('Generated suggestions:', uniqueSuggestions.slice(0, 20));
  };

  // 기존 generateProductNames 함수는 삭제하거나 주석처리
  const generateProductNames = () => {
    if (!results || results.length === 0) return;

    console.log('Generating product names from results:', results);

    // 카테고리별로 키워드를 그룹화
    const categoryKeywordMap: Record<string, string[]> = {};
    
    results.forEach(result => {
      if (result.categories && result.status === 'completed') {
        // 상위 3개 카테고리만 고려
        result.categories.slice(0, 3).forEach(cat => {
          if (!categoryKeywordMap[cat.path]) {
            categoryKeywordMap[cat.path] = [];
          }
          // 10% 이상 노출되는 카테고리
          if (cat.percentage > 10) {
            if (!categoryKeywordMap[cat.path].includes(result.keyword)) {
              categoryKeywordMap[cat.path].push(result.keyword);
            }
          }
        });
      }
    });

    console.log('Category keyword map:', categoryKeywordMap);

    // 카테고리별로 상품명 제안 생성
    const suggestions: ProductNameSuggestion[] = [];
    
    // 상품명 템플릿 (20-50자)
    const templates = [
      (kw: string[]) => `${kw.join(' ')} 전문가용 프리미엄 제품`,
      (kw: string[]) => `고품질 ${kw.join(' ')} 베스트셀러`,
      (kw: string[]) => `${kw.join(' ')} 대용량 특가 세트`,
      (kw: string[]) => `올인원 ${kw.join(' ')} 멀티팩`,
      (kw: string[]) => `프로페셔널 ${kw.join(' ')} 정품`,
      (kw: string[]) => `${kw.join(' ')} 공식 인증 제품`,
      (kw: string[]) => `최신형 ${kw.join(' ')} 패키지`,
      (kw: string[]) => `${kw.join(' ')} 한정 특별 기획전`
    ];
    
    Object.entries(categoryKeywordMap).forEach(([category, keywords]) => {
      if (keywords.length >= 2) {
        // 2-3개 키워드 조합으로 20-50자 상품명 생성
        for (let i = 0; i < keywords.length; i++) {
          for (let j = i + 1; j < keywords.length; j++) {
            // 2개 조합
            const twoKeywords = [keywords[i], keywords[j]];
            templates.slice(0, 3).forEach((template, idx) => {
              const name = template(twoKeywords);
              if (name.length >= 20 && name.length <= 50) {
                suggestions.push({
                  name,
                  keywords: twoKeywords,
                  targetCategories: [category],
                  score: 70 + idx * 5
                });
              }
            });
            
            // 3개 조합
            if (keywords.length > j + 1) {
              for (let k = j + 1; k < Math.min(keywords.length, 5); k++) {
                const threeKeywords = [keywords[i], keywords[j], keywords[k]];
                templates.slice(3, 6).forEach((template, idx) => {
                  const name = template(threeKeywords);
                  if (name.length >= 20 && name.length <= 50) {
                    suggestions.push({
                      name,
                      keywords: threeKeywords,
                      targetCategories: [category],
                      score: 85 + idx * 5
                    });
                  }
                });
              }
            }
          }
        }
      }
    });

    // 카테고리 매칭이 없는 경우, 모든 키워드로 조합 생성
    if (suggestions.length === 0) {
      const allKeywords = results
        .filter(r => r.status === 'completed')
        .map(r => r.keyword);
      
      if (allKeywords.length >= 2) {
        // 템플릿 사용하여 20-50자 상품명 생성
        for (let i = 0; i < allKeywords.length; i++) {
          for (let j = i + 1; j < allKeywords.length; j++) {
            const twoKeywords = [allKeywords[i], allKeywords[j]];
            templates.forEach((template, idx) => {
              const name = template(twoKeywords);
              if (name.length >= 20 && name.length <= 50) {
                suggestions.push({
                  name,
                  keywords: twoKeywords,
                  targetCategories: ['전체 카테고리'],
                  score: 60 + idx * 2
                });
              }
            });
          }
        }
      }
    }

    // 점수 기준으로 정렬하고 상위 20개만
    suggestions.sort((a, b) => b.score - a.score);
    setProductNameSuggestions(suggestions.slice(0, 20));
    setShowProductNameBuilder(true);
    console.log('Generated suggestions:', suggestions.slice(0, 20));
  };

  const downloadCSV = () => {
    if (!results || results.length === 0) return;

    const headers = ['키워드', '총 상품수', '카테고리', '상품수', '비율(%)'];
    const rows = results.flatMap(result => 
      result.categories?.map(cat => [
        result.keyword,
        result.totalItems || 0,
        cat.path,
        cat.count,
        cat.percentage.toFixed(1)
      ]) || []
    );

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `naver_shopping_analysis_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const keywordCount = keywords.split('\n').filter(k => k.trim()).length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-black">
      <div className="container mx-auto px-4 py-16">
        <header className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            네이버 쇼핑 다중 키워드 분석
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            여러 키워드를 한 번에 입력하여 카테고리 분포를 분석합니다
          </p>
        </header>

        <main className="max-w-6xl mx-auto">
          {/* Navigation Tabs */}
          <div className="flex space-x-1 mb-8">
            <Link 
              href="/"
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              단일 검색
            </Link>
            <div className="px-4 py-2 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 font-semibold">
              다중 검색
            </div>
          </div>

          {/* Input Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
            <div className="space-y-6">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label htmlFor="keywords" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    키워드 입력 (한 줄에 하나씩)
                  </label>
                  <span className={`text-sm ${keywordCount > 100 ? 'text-red-600' : 'text-gray-600'} dark:text-gray-400`}>
                    {keywordCount} / 100
                  </span>
                </div>
                <textarea
                  id="keywords"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  disabled={isProcessing}
                  className="w-full h-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white disabled:opacity-50 font-mono"
                  placeholder="접착제&#10;본드&#10;강력접착제&#10;순간접착제&#10;목공본드&#10;..."
                />
              </div>

              <div className="flex gap-4">
                <button
                  onClick={processKeywords}
                  disabled={isProcessing || keywordCount === 0 || keywordCount > 100}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? '분석 중...' : '분석 시작'}
                </button>
                <button
                  onClick={() => setKeywords('')}
                  disabled={isProcessing}
                  className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  초기화
                </button>
                {results.length > 0 && (
                  <>
                    <button
                      onClick={downloadCSV}
                      className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      CSV 다운로드
                    </button>
                    <button
                      onClick={generateProductNames}
                      className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      상품명 생성 (기본)
                    </button>
                    <button
                      onClick={generateProductNamesAdvanced}
                      disabled={isGeneratingNames}
                      className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                    >
                      {isGeneratingNames ? '생성 중...' : '상품명 생성 (고급)'}
                    </button>
                  </>
                )}
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <p className="text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}
            </div>
          </div>

          {/* Progress Section */}
          {isProcessing && (
            <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold mb-4">진행 상황</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>처리 중...</span>
                  <span>{progress.current} / {progress.total}</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                  <div 
                    className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Results Section */}
          {results.length > 0 && (
            <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
              <h2 className="text-2xl font-bold mb-6">분석 결과</h2>
              
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400">분석 완료</p>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {results.filter(r => r.status === 'completed').length}개
                  </p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400">총 상품수</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {results.reduce((sum, r) => sum + (r.totalItems || 0), 0).toLocaleString()}개
                  </p>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400">고유 카테고리</p>
                  <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {new Set(results.flatMap(r => r.categories?.map(c => c.path) || [])).size}개
                  </p>
                </div>
              </div>

              {/* Keyword Results Table */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b dark:border-gray-700">
                      <th className="text-left py-3 px-4">키워드</th>
                      <th className="text-right py-3 px-4">상품수</th>
                      <th className="text-left py-3 px-4">주요 카테고리</th>
                      <th className="text-right py-3 px-4">비율</th>
                      <th className="text-center py-3 px-4">상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((result, index) => (
                      <tr key={index} className="border-b dark:border-gray-700">
                        <td className="py-3 px-4 font-semibold">{result.keyword}</td>
                        <td className="py-3 px-4 text-right">{result.totalItems?.toLocaleString() || '-'}</td>
                        <td className="py-3 px-4">
                          {result.categories && result.categories[0] ? (
                            <span className="text-sm">{result.categories[0].path}</span>
                          ) : '-'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {result.categories && result.categories[0] ? (
                            <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                              {result.categories[0].percentage.toFixed(1)}%
                            </span>
                          ) : '-'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {result.status === 'completed' && (
                            <span className="text-green-600 dark:text-green-400">✓</span>
                          )}
                          {result.status === 'error' && (
                            <span className="text-red-600 dark:text-red-400">✗</span>
                          )}
                          {result.status === 'processing' && (
                            <span className="text-yellow-600 dark:text-yellow-400">...</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Related Keywords Display */}
          {relatedKeywords.length > 0 && (
            <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
              <h2 className="text-2xl font-bold mb-6">🔍 연관검색어</h2>
              <div className="space-y-4">
                {relatedKeywords.map((item, idx) => (
                  <div key={idx} className="border-b dark:border-gray-700 pb-4 last:border-b-0">
                    <h3 className="font-semibold text-lg mb-2">{item.keyword}</h3>
                    <div className="flex flex-wrap gap-2">
                      {item.related.map((rel, ridx) => (
                        <span 
                          key={ridx}
                          className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm"
                        >
                          {rel}
                        </span>
                      ))}
                      {item.related.length === 0 && (
                        <span className="text-gray-500 dark:text-gray-400 text-sm">연관검색어 없음</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Product Name Suggestions */}
          {showProductNameBuilder && productNameSuggestions.length > 0 && (
            <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">🎯 추천 상품명</h2>
                <button
                  onClick={() => setShowProductNameBuilder(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  ✕
                </button>
              </div>
              
              <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  💡 카테고리별로 높은 노출률을 보이는 키워드를 조합하여 상품명을 생성했습니다.
                  각 상품명은 해당 카테고리에서 우선 노출될 가능성이 높습니다.
                </p>
              </div>

              <div className="space-y-4">
                {productNameSuggestions.map((suggestion, idx) => (
                  <div 
                    key={idx} 
                    className="border dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                          {suggestion.name}
                          <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                            ({suggestion.name.length}자)
                          </span>
                        </h3>
                        <div className="flex flex-wrap gap-2 mb-2">
                          {suggestion.keywords.map((keyword, kidx) => (
                            <span 
                              key={kidx}
                              className="px-2 py-1 bg-gray-100 dark:bg-gray-600 text-xs rounded-full"
                            >
                              {keyword}
                            </span>
                          ))}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          타겟 카테고리: {
                            suggestion.targetCategories[0] === '전체 카테고리' 
                              ? '전체 카테고리' 
                              : suggestion.targetCategories[0].split(' > ').slice(-2).join(' > ')
                          }
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                          {suggestion.score}%
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">예상 노출도</p>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => navigator.clipboard.writeText(suggestion.name)}
                        className="px-3 py-1 text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                      >
                        복사
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {productNameSuggestions.length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  상품명을 생성하려면 더 많은 키워드를 분석해주세요.
                </div>
              )}
            </div>
          )}

          {/* Category Matrix */}
          {matrix && (
            <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
              <h2 className="text-2xl font-bold mb-6">키워드-카테고리 매트릭스</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="sticky left-0 bg-white dark:bg-gray-800 p-2 text-left">키워드</th>
                      {matrix.categories.map((cat, idx) => (
                        <th key={idx} className="p-2 text-center min-w-[100px]">
                          <div className="truncate" title={cat}>
                            {cat.split(' > ').pop()}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matrix.keywords.map((item, idx) => (
                      <tr key={idx} className="border-t dark:border-gray-700">
                        <td className="sticky left-0 bg-white dark:bg-gray-800 p-2 font-semibold">
                          {item.keyword}
                        </td>
                        {matrix.categories.map((cat, catIdx) => {
                          const value = item.distribution[cat] || 0;
                          const bgOpacity = Math.min(value / 50, 1);
                          return (
                            <td 
                              key={catIdx} 
                              className="p-2 text-center"
                              style={{
                                backgroundColor: value > 0 
                                  ? `rgba(59, 130, 246, ${bgOpacity * 0.3})`
                                  : 'transparent'
                              }}
                            >
                              {value > 0 ? `${value}%` : '-'}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}