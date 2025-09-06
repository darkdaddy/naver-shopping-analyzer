import { NextRequest, NextResponse } from 'next/server';
import { getNaverAPI } from '@/services/naver-api';
import { categoryAnalyzer } from '@/services/category-analyzer';
import logger from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, maxItems = 500 } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: '검색어를 입력해주세요.' },
        { status: 400 }
      );
    }

    logger.info(`API Route: Search request for "${query}"`);

    // Step 1: Search products from Naver
    const naverAPI = getNaverAPI();
    const searchResult = await naverAPI.searchAllProducts(query, maxItems);

    // Step 2: Analyze categories
    const analysisResult = categoryAnalyzer.analyzeCategories(searchResult.items, query);
    
    // Step 3: Get additional insights
    const insights = categoryAnalyzer.getCategoryInsights(analysisResult);
    const topBrands = categoryAnalyzer.getTopBrands(analysisResult.topCategories);

    // Step 4: Prepare category items map
    const categoryItemsMap: Record<string, import('@/types').NaverSearchItem[]> = {};
    analysisResult.topCategories.forEach(category => {
      const items = categoryAnalyzer.getItemsByCategory(category.categoryPath);
      categoryItemsMap[category.categoryPath] = items;
    });

    return NextResponse.json({
      success: true,
      data: {
        searchResult,
        analysis: analysisResult,
        insights,
        topBrands,
        categoryItemsMap
      }
    });
  } catch (error) {
    logger.error('Search API error:', error);
    
    const errorMessage = error instanceof Error ? error.message : '검색 중 오류가 발생했습니다.';
    
    return NextResponse.json(
      { 
        success: false,
        error: errorMessage 
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Please use POST.' },
    { status: 405 }
  );
}