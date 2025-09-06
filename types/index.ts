export interface NaverSearchItem {
  title: string;
  link: string;
  image: string;
  lprice: string;
  hprice: string;
  mallName: string;
  productId: string;
  productType: string;
  brand: string;
  maker: string;
  category1: string;
  category2: string;
  category3: string;
  category4: string;
}

export interface NaverSearchResponse {
  lastBuildDate: string;
  total: number;
  start: number;
  display: number;
  items: NaverSearchItem[];
}

export interface CategoryAnalysis {
  categoryPath: string;
  categoryDepth: number;
  itemCount: number;
  percentage: number;
  avgPrice: number;
  brandDistribution: Record<string, number>;
}

export interface SearchAnalysisResult {
  searchQuery: string;
  totalItems: number;
  analyzedItems: number;
  topCategories: CategoryAnalysis[];
  timestamp: Date;
}

export interface SearchHistory {
  id: string;
  searchQuery: string;
  result: SearchAnalysisResult;
  createdAt: Date;
}