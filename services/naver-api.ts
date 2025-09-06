import axios from 'axios';
import logger from '@/lib/logger';
import { NaverSearchResponse } from '@/types';

const NAVER_API_URL = 'https://openapi.naver.com/v1/search/shop.json';
const MAX_DISPLAY = 100;
const REQUEST_DELAY = 100;

export class NaverShoppingAPI {
  private clientId: string;
  private clientSecret: string;
  private lastRequestTime: number = 0;

  constructor() {
    this.clientId = process.env.NAVER_CLIENT_ID || '';
    this.clientSecret = process.env.NAVER_CLIENT_SECRET || '';
    
    if (!this.clientId || !this.clientSecret) {
      logger.error('Naver API credentials not found in environment variables');
      throw new Error('Naver API credentials not configured');
    }
  }

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < REQUEST_DELAY) {
      await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY - timeSinceLastRequest));
    }
    
    this.lastRequestTime = Date.now();
  }

  async searchProducts(
    query: string, 
    display: number = 100, 
    start: number = 1,
    sort: 'sim' | 'date' | 'asc' | 'dsc' = 'sim'
  ): Promise<NaverSearchResponse> {
    try {
      await this.enforceRateLimit();

      const params = {
        query: query,
        display: Math.min(display, MAX_DISPLAY),
        start: start,
        sort: sort
      };

      logger.info(`Searching Naver Shopping API: ${query}, display: ${params.display}, start: ${params.start}`);

      const response = await axios.get<NaverSearchResponse>(NAVER_API_URL, {
        params,
        headers: {
          'X-Naver-Client-Id': this.clientId,
          'X-Naver-Client-Secret': this.clientSecret,
        },
        timeout: 10000
      });

      logger.info(`Search completed: ${response.data.total} total items found`);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error(`Naver API Error: ${error.response?.status} - ${error.response?.statusText}`);
        if (error.response?.status === 429) {
          throw new Error('API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.');
        } else if (error.response?.status === 401) {
          throw new Error('API 인증에 실패했습니다. API 키를 확인해주세요.');
        }
      }
      logger.error('Unexpected error in Naver API call:', error);
      throw new Error('네이버 쇼핑 API 호출 중 오류가 발생했습니다.');
    }
  }

  async searchAllProducts(query: string, maxItems: number = 1000): Promise<NaverSearchResponse> {
    const allItems: NaverSearchResponse['items'] = [];
    let start = 1;
    let totalFetched = 0;
    let firstResponse: NaverSearchResponse | null = null;

    while (totalFetched < maxItems) {
      const remainingItems = maxItems - totalFetched;
      const display = Math.min(MAX_DISPLAY, remainingItems);
      
      const response = await this.searchProducts(query, display, start);
      
      if (!firstResponse) {
        firstResponse = response;
      }

      allItems.push(...response.items);
      totalFetched += response.items.length;

      if (response.items.length < display || totalFetched >= response.total) {
        break;
      }

      start += display;
    }

    if (!firstResponse) {
      throw new Error('No response received from API');
    }

    return {
      ...firstResponse,
      items: allItems,
      display: allItems.length,
      start: 1
    };
  }
}

let apiInstance: NaverShoppingAPI | null = null;

export function getNaverAPI(): NaverShoppingAPI {
  if (!apiInstance) {
    apiInstance = new NaverShoppingAPI();
  }
  return apiInstance;
}