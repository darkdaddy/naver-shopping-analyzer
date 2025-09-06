import { NextRequest, NextResponse } from 'next/server';
import { getNaverAPI } from '@/services/naver-api';
import { categoryAnalyzer } from '@/services/category-analyzer';
import logger from '@/lib/logger';

const BATCH_SIZE = 10;
const DELAY_MS = 500;
const MAX_KEYWORDS = 100;

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
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

    if (keywords.length === 0) {
      return NextResponse.json(
        { success: false, error: '최소 1개 이상의 키워드가 필요합니다.' },
        { status: 400 }
      );
    }

    if (keywords.length > MAX_KEYWORDS) {
      return NextResponse.json(
        { success: false, error: `최대 ${MAX_KEYWORDS}개까지만 처리 가능합니다.` },
        { status: 400 }
      );
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const results: Array<{
          keyword: string;
          status: string;
          categories?: Array<{ path: string; count: number; percentage: number }>;
          totalItems?: number;
          error?: string;
        }> = [];
        const categoryDistribution: Record<string, Record<string, number>> = {};
        
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: 'progress',
              data: { current: 0, total: keywords.length }
            })}\n\n`
          )
        );

        const batches = chunk(keywords, BATCH_SIZE);
        let processedCount = 0;

        for (const batch of batches) {
          const batchPromises = batch.map(async (keyword) => {
            try {
              logger.info(`Processing keyword: ${keyword}`);
              
              const naverAPI = getNaverAPI();
              const searchResult = await naverAPI.searchAllProducts(keyword, 100);

              const analysis = categoryAnalyzer.analyzeCategories(searchResult.items, keyword);
              
              const topCategories = analysis.topCategories.slice(0, 5).map(cat => ({
                path: cat.categoryPath,
                count: cat.itemCount,
                percentage: cat.percentage
              }));

              topCategories.forEach(cat => {
                if (!categoryDistribution[keyword]) {
                  categoryDistribution[keyword] = {};
                }
                categoryDistribution[keyword][cat.path] = Math.round(cat.percentage);
              });

              return {
                keyword,
                status: 'completed',
                categories: topCategories,
                totalItems: searchResult.total
              };
            } catch (error) {
              logger.error(`Error processing keyword ${keyword}:`, error);
              return {
                keyword,
                status: 'error',
                error: error instanceof Error ? error.message : '처리 중 오류 발생'
              };
            }
          });

          const batchResults = await Promise.all(batchPromises);
          results.push(...batchResults);

          for (const result of batchResults) {
            processedCount++;
            
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'result',
                  data: result
                })}\n\n`
              )
            );

            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'progress',
                  data: { current: processedCount, total: keywords.length }
                })}\n\n`
              )
            );
          }

          if (processedCount < keywords.length) {
            await delay(DELAY_MS);
          }
        }

        const allCategories = new Set<string>();
        Object.values(categoryDistribution).forEach(dist => {
          Object.keys(dist).forEach(cat => allCategories.add(cat));
        });

        const sortedCategories = Array.from(allCategories).sort();
        const matrix = {
          categories: sortedCategories.slice(0, 10),
          keywords: Object.entries(categoryDistribution).map(([keyword, dist]) => ({
            keyword,
            distribution: dist
          }))
        };

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: 'matrix',
              data: matrix
            })}\n\n`
          )
        );

        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      }
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    logger.error('Batch analyze error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '배치 분석 중 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
}