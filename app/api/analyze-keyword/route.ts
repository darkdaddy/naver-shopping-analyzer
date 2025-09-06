import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const { keyword } = await request.json();
    logger.info(`Analyzing keyword: ${keyword}`);

    if (!keyword) {
      return NextResponse.json(
        { success: false, error: '키워드가 필요합니다.' },
        { status: 400 }
      );
    }

    const clientId = process.env.NAVER_CLIENT_ID;
    const clientSecret = process.env.NAVER_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      logger.error('Naver API credentials not configured');
      return NextResponse.json(
        { success: false, error: 'API 설정 오류' },
        { status: 500 }
      );
    }

    // 네이버 쇼핑 검색 API 호출
    // sort 옵션: sim (정확도순), date (날짜순), asc (가격오름차순), dsc (가격내림차순)
    const searchUrl = `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(keyword)}&display=40&sort=sim`;
    
    logger.info(`Calling Naver API for: ${keyword}`);
    const response = await fetch(searchUrl, {
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Naver API failed for keyword "${keyword}":`, {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        url: searchUrl
      });
      logger.error(`Naver API failed: ${response.status}, ${errorText}`);
      throw new Error(`API 호출 실패: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // 카테고리별 상품 수 집계
    const categoryCount: { [key: string]: number } = {};
    const totalItems = data.items.length;

    data.items.forEach((item: unknown) => {
      const shopItem = item as { category1?: string; category2?: string; category3?: string; category4?: string };
      const categories = [
        shopItem.category1,
        shopItem.category2,
        shopItem.category3,
        shopItem.category4
      ].filter(Boolean);
      
      const fullCategory = categories.join(' > ');
      if (fullCategory) {
        categoryCount[fullCategory] = (categoryCount[fullCategory] || 0) + 1;
      }
    });

    // 상위 카테고리 추출 (최대 3개)
    const topCategories = Object.entries(categoryCount)
      .map(([category, count]) => ({
        category,
        percentage: Math.round((count / totalItems) * 100)
      }))
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 3);

    return NextResponse.json({
      success: true,
      keyword,
      topCategories,
      totalProducts: data.total
    });

  } catch (error) {
    console.error('Keyword analysis error:', error);
    logger.error('Keyword analysis error:', error);
    
    const errorMessage = error instanceof Error ? error.message : '분석 중 오류가 발생했습니다.';
    
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    );
  }
}