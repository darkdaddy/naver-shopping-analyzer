import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';

interface RelatedKeyword {
  keyword: string;
  related: string[];
}

async function fetchAutoComplete(keyword: string): Promise<string[]> {
  try {
    // 네이버 검색 자동완성 API (쇼핑이 아닌 일반 검색)
    const url = `https://ac.search.naver.com/nx/ac?q=${encodeURIComponent(keyword)}&con=1&frm=nv&ans=2&r_format=json&r_enc=UTF-8&r_unicode=0&t_koreng=1&run=2&rev=4&q_enc=UTF-8&st=100`;
    
    logger.info(`Fetching autocomplete for: ${keyword} from ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': 'https://shopping.naver.com/'
      }
    });

    if (!response.ok) {
      logger.warn(`AutoComplete API failed for keyword: ${keyword}, status: ${response.status}`);
      return [];
    }

    const data = await response.json();
    logger.info(`AutoComplete response for ${keyword}:`, JSON.stringify(data).slice(0, 200));
    
    // 네이버 자동완성 응답 파싱
    if (data) {
      let keywords: string[] = [];
      
      // 네이버 자동완성 API 응답 구조
      // data.items[0] = 검색어 배열
      // data.items[1] = 연관 검색어 배열
      if (data.items && Array.isArray(data.items)) {
        if (Array.isArray(data.items[0])) {
          // 첫 번째 배열: 자동완성 키워드
          keywords = data.items[0].map((item: unknown) => {
            // 배열의 첫 번째 요소가 키워드
            return Array.isArray(item) ? item[0] : item;
          });
        }
      } else if (data.query && Array.isArray(data.query)) {
        keywords = data.query;
      }
      
      const filtered = keywords
        .filter((k: unknown) => typeof k === 'string' && k && k !== keyword && (k as string).length > 0)
        .slice(0, 10) as string[];
      
      logger.info(`Extracted keywords for ${keyword}: ${filtered.join(', ')}`);
      return filtered;
    }

    return [];
  } catch (error) {
    logger.error(`Error fetching autocomplete for ${keyword}:`, error);
    return [];
  }
}

export async function POST(request: NextRequest) {
  try {
    const { keywords } = await request.json();

    if (!keywords || !Array.isArray(keywords)) {
      return NextResponse.json(
        { success: false, error: '키워드 배열이 필요합니다.' },
        { status: 400 }
      );
    }

    logger.info(`Fetching related keywords for: ${keywords.join(', ')}`);

    // 각 키워드별로 연관검색어 수집
    const results: RelatedKeyword[] = [];
    
    for (const keyword of keywords) {
      const related = await fetchAutoComplete(keyword);
      
      // 추가로 변형 키워드로도 검색
      const variations = [
        `${keyword} 추천`,
        `${keyword} 인기`,
        `${keyword} 베스트`
      ];
      
      const additionalRelated = new Set<string>();
      
      for (const variation of variations) {
        const varRelated = await fetchAutoComplete(variation);
        varRelated.forEach(k => additionalRelated.add(k));
      }
      
      // 중복 제거 및 정제
      const allRelated = Array.from(new Set([
        ...related,
        ...Array.from(additionalRelated)
      ])).filter(k => 
        k.includes(keyword) || keyword.includes(k)
      );
      
      results.push({
        keyword,
        related: allRelated
      });
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return NextResponse.json({
      success: true,
      data: results
    });
  } catch (error) {
    logger.error('Related keywords API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '연관검색어 추출 중 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
}