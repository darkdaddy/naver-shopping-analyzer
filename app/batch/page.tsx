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


interface RelatedKeywordResult {
  keyword: string;
  related: string[];
}

interface RelatedKeywordWithCategory {
  word: string;
  topCategories?: {
    category: string;
    percentage: number;
  }[];
  loading?: boolean;
}

export default function BatchAnalysis() {
  const [keywords, setKeywords] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<BatchAnalysisResult[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [matrix, setMatrix] = useState<CategoryMatrix | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showProductNameBuilder, setShowProductNameBuilder] = useState(false);
  const [relatedKeywords, setRelatedKeywords] = useState<RelatedKeywordResult[]>([]);
  const [isGeneratingNames, setIsGeneratingNames] = useState(false);
  const [selectedRelatedKeywords, setSelectedRelatedKeywords] = useState<Record<string, Set<string>>>({});
  const [globalProductNames, setGlobalProductNames] = useState<string[]>([]);
  const [relatedKeywordCategories, setRelatedKeywordCategories] = useState<Record<string, RelatedKeywordWithCategory>>({});

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

  const generateProductNames = async () => {
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

      setShowProductNameBuilder(true);

    } catch (error) {
      console.error('Error generating product names:', error);
      setError('상품명 생성 중 오류가 발생했습니다.');
    } finally {
      setIsGeneratingNames(false);
    }
  };

  const splitRelatedKeywords = (mainKeyword: string, relatedKeywords: string[]): string[] => {
    const words = new Set<string>();
    
    relatedKeywords.forEach(keyword => {
      // 메인 키워드를 제거하고 남은 부분 추출
      let remaining = keyword;
      
      // 메인 키워드가 포함된 경우 제거
      if (keyword.includes(mainKeyword)) {
        remaining = keyword.replace(mainKeyword, '').trim();
      }
      
      // 공백으로 분리
      const parts = remaining.split(' ').filter(part => part.length > 0);
      parts.forEach(part => {
        // 조사나 불필요한 짧은 단어 제외
        if (part.length > 1 && !['의', '를', '을', '에', '와', '과', '로', '으로'].includes(part)) {
          words.add(part);
        }
      });
      
      // 원본 키워드도 공백으로 분리하여 추가
      keyword.split(' ').forEach(part => {
        if (part.length > 1 && part !== mainKeyword && !['의', '를', '을', '에', '와', '과', '로', '으로'].includes(part)) {
          words.add(part);
        }
      });
    });
    
    // Set을 배열로 변환 (메인 키워드 제외)
    return Array.from(words);
  };

  const generateNamesForKeyword = (keyword: string, relatedKeywords: string[]): string[] => {
    const names: string[] = [];
    // 메인 키워드는 항상 포함
    const allKeywords = [keyword, ...relatedKeywords];
    
    // 키워드가 하나만 있는 경우
    if (allKeywords.length === 1) {
      names.push(`${keyword} 프리미엄 제품`);
      names.push(`${keyword} 베스트 상품`);
      names.push(`${keyword} 인기 아이템`);
    } else {
      // 선택된 모든 단어를 사용한 조합만 생성
      // 순서를 바꿔가며 다양한 조합 생성
      
      // 순열 생성 함수
      const generatePermutations = (arr: string[]): string[][] => {
        if (arr.length <= 1) return [arr];
        const result: string[][] = [];
        for (let i = 0; i < arr.length; i++) {
          const current = arr[i];
          const remaining = [...arr.slice(0, i), ...arr.slice(i + 1)];
          const remainingPerms = generatePermutations(remaining);
          for (const perm of remainingPerms) {
            result.push([current, ...perm]);
          }
        }
        return result;
      };
      
      // 모든 순열 생성 (최대 10개만)
      const permutations = generatePermutations(allKeywords).slice(0, 10);
      
      // 각 순열을 상품명으로 변환
      for (const perm of permutations) {
        const name = perm.join(' ');
        if (name.length <= 50) {
          names.push(name);
        }
      }
      
      // 만약 순열이 너무 적으면 일부 단어 조합도 추가
      if (names.length < 5 && allKeywords.length > 3) {
        // 마지막 1-2개 단어를 제외한 조합도 추가
        const reducedKeywords = allKeywords.slice(0, -1);
        const reducedPerms = generatePermutations(reducedKeywords).slice(0, 5);
        for (const perm of reducedPerms) {
          const name = perm.join(' ');
          if (name.length <= 50) {
            names.push(name);
          }
        }
      }
    }
    
    // 50자 이하만 필터링, 중복 제거하고 최대 20개 반환
    return Array.from(new Set(names))
      .filter(name => name.length <= 50)
      .slice(0, 20);
  };

  const toggleRelatedKeyword = async (keyword: string, relatedKeyword: string) => {
    // 카테고리 정보가 없으면 가져오기
    if (!relatedKeywordCategories[relatedKeyword]) {
      setRelatedKeywordCategories(prev => ({
        ...prev,
        [relatedKeyword]: { word: relatedKeyword, loading: true }
      }));
      
      try {
        const response = await fetch('/api/analyze-keyword', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyword: relatedKeyword })
        });
        
        if (response.ok) {
          const data = await response.json();
          setRelatedKeywordCategories(prev => ({
            ...prev,
            [relatedKeyword]: {
              word: relatedKeyword,
              topCategories: data.topCategories,
              loading: false
            }
          }));
        }
      } catch (error) {
        console.error('Failed to fetch category info:', error);
        setRelatedKeywordCategories(prev => ({
          ...prev,
          [relatedKeyword]: { word: relatedKeyword, loading: false }
        }));
      }
    }
    
    // 선택 상태 업데이트
    const currentSelected = selectedRelatedKeywords[keyword] || new Set();
    const newSelected = new Set(currentSelected);
    
    if (newSelected.has(relatedKeyword)) {
      newSelected.delete(relatedKeyword);
    } else {
      newSelected.add(relatedKeyword);
    }
    
    setSelectedRelatedKeywords(prev => ({
      ...prev,
      [keyword]: newSelected
    }));
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
                      disabled={isGeneratingNames}
                      className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                    >
                      {isGeneratingNames ? '생성 중...' : '상품명 생성'}
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

          {/* Product Name Builder - Simplified */}
          {showProductNameBuilder && relatedKeywords.length > 0 && (
            <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">🎯 상품명 생성기</h2>
                <button
                  onClick={() => setShowProductNameBuilder(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  ✕
                </button>
              </div>

              {/* 연관검색어 선택 */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold mb-4">연관검색어 선택 (카테고리 정보 포함)</h3>
                <div className="space-y-6">
                  {relatedKeywords.map((item, idx) => (
                    <div key={idx} className="border dark:border-gray-700 rounded-lg p-4">
                      <h4 className="font-semibold text-base mb-3">{item.keyword}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {item.related.map((rel, ridx) => {
                          const categoryInfo = relatedKeywordCategories[rel];
                          const isSelected = selectedRelatedKeywords[item.keyword]?.has(rel);
                          return (
                            <div 
                              key={ridx} 
                              className={`border rounded-lg p-3 cursor-pointer transition-all ${
                                isSelected 
                                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                                  : 'border-gray-300 dark:border-gray-600 hover:border-blue-300'
                              }`}
                              onClick={async () => {
                                await toggleRelatedKeyword(item.keyword, rel);
                              }}
                            >
                              <div className="flex items-start gap-2">
                                <input
                                  type="checkbox"
                                  checked={isSelected || false}
                                  onChange={() => {}}
                                  className="mt-1 w-4 h-4 text-blue-600 rounded"
                                />
                                <div className="flex-1">
                                  <div className="font-medium mb-1">{rel}</div>
                                  {categoryInfo?.loading && (
                                    <div className="text-xs text-gray-500">카테고리 분석중...</div>
                                  )}
                                  {categoryInfo?.topCategories && categoryInfo.topCategories.length > 0 && (
                                    <div className="mt-2 space-y-1">
                                      {categoryInfo.topCategories.map((cat, cidx) => (
                                        <div key={cidx} className="flex items-center gap-2">
                                          <div className="w-20 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                                            <div 
                                              className="bg-green-500 h-full"
                                              style={{ width: `${cat.percentage}%` }}
                                            />
                                          </div>
                                          <span className="text-xs text-gray-600 dark:text-gray-400">
                                            {cat.percentage}% - {cat.category}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 통합 상품명 생성 */}
              <div className="p-6 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border-2 border-yellow-300 dark:border-yellow-700">
                <h3 className="text-xl font-bold mb-4">통합 상품명 생성</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  선택한 모든 키워드를 조합하여 상품명을 생성합니다.
                </p>
                <button
                  onClick={() => {
                    const allSelectedWords = new Set<string>();
                    
                    // 원본 키워드들 추가
                    results.forEach(r => {
                      if (r.status === 'completed') {
                        allSelectedWords.add(r.keyword);
                      }
                    });
                    
                    // 선택된 연관검색어들 추가
                    Object.entries(selectedRelatedKeywords).forEach(([keyword, selected]) => {
                      selected.forEach(word => allSelectedWords.add(word));
                    });
                    
                    const allWords = Array.from(allSelectedWords);
                    
                    // 순열 생성
                    const generatePermutations = (arr: string[]): string[][] => {
                      if (arr.length <= 1) return [arr];
                      if (arr.length > 7) arr = arr.slice(0, 7);
                      const result: string[][] = [];
                      for (let i = 0; i < arr.length; i++) {
                        const current = arr[i];
                        const remaining = [...arr.slice(0, i), ...arr.slice(i + 1)];
                        const remainingPerms = generatePermutations(remaining);
                        for (const perm of remainingPerms) {
                          result.push([current, ...perm]);
                        }
                      }
                      return result;
                    };
                    
                    const permutations = generatePermutations(allWords).slice(0, 20);
                    const names = permutations.map(perm => perm.join(' ')).filter(name => name.length <= 50);
                    setGlobalProductNames(names);
                  }}
                  className="px-6 py-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors font-bold"
                >
                  상품명 생성
                </button>
                
                {globalProductNames.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <h4 className="font-semibold mb-2">생성된 상품명:</h4>
                    {globalProductNames.map((name, idx) => (
                      <div key={idx} className="flex justify-between items-center p-3 bg-white dark:bg-gray-800 rounded-lg">
                        <span>
                          {name}
                          <span className="ml-2 text-xs text-gray-500">({name.length}자)</span>
                        </span>
                        <button
                          onClick={() => navigator.clipboard.writeText(name)}
                          className="px-3 py-1 text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                        >
                          복사
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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