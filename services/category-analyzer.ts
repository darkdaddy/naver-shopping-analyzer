import { NaverSearchItem, CategoryAnalysis, SearchAnalysisResult } from '@/types';
import logger from '@/lib/logger';

export class CategoryAnalyzer {
  private categoryItemsMap = new Map<string, NaverSearchItem[]>();

  analyzeCategories(items: NaverSearchItem[], searchQuery: string): SearchAnalysisResult {
    this.categoryItemsMap.clear();
    const categoryMap = new Map<string, {
      items: NaverSearchItem[];
      count: number;
      prices: number[];
      brands: Map<string, number>;
    }>();

    // Step 1: Group items by category path
    items.forEach((item) => {
      const categoryPath = this.buildCategoryPath(item);
      
      if (!categoryMap.has(categoryPath)) {
        categoryMap.set(categoryPath, {
          items: [],
          count: 0,
          prices: [],
          brands: new Map()
        });
      }

      const category = categoryMap.get(categoryPath)!;
      category.items.push(item);
      category.count++;
      
      const price = parseInt(item.lprice);
      if (price > 0) {
        category.prices.push(price);
      }

      if (item.brand) {
        const brandCount = category.brands.get(item.brand) || 0;
        category.brands.set(item.brand, brandCount + 1);
      }
    });

    // Store items for each category
    for (const [categoryPath, data] of categoryMap.entries()) {
      this.categoryItemsMap.set(categoryPath, data.items);
    }

    // Step 2: Calculate statistics for each category
    const categoryAnalyses: CategoryAnalysis[] = [];
    const totalItems = items.length;

    for (const [categoryPath, data] of categoryMap.entries()) {
      const categoryDepth = categoryPath.split(' > ').filter(c => c).length;
      
      // Calculate average price
      const avgPrice = data.prices.length > 0 
        ? Math.round(data.prices.reduce((a, b) => a + b, 0) / data.prices.length)
        : 0;

      // Convert brand map to object
      const brandDistribution: Record<string, number> = {};
      data.brands.forEach((count, brand) => {
        brandDistribution[brand] = count;
      });

      // Calculate percentage
      const percentage = (data.count / totalItems) * 100;

      categoryAnalyses.push({
        categoryPath,
        categoryDepth,
        itemCount: data.count,
        percentage: Math.round(percentage * 100) / 100,
        avgPrice,
        brandDistribution
      });
    }

    // Step 3: Sort by item count (most items first)
    categoryAnalyses.sort((a, b) => b.itemCount - a.itemCount);

    // Step 4: Calculate priority score for ranking
    const scoredCategories = this.calculatePriorityScores(categoryAnalyses, items);

    logger.info(`Analysis complete: ${categoryAnalyses.length} categories found from ${totalItems} items`);

    return {
      searchQuery,
      totalItems: items.length,
      analyzedItems: items.length,
      topCategories: scoredCategories.slice(0, 10),
      timestamp: new Date()
    };
  }

  private buildCategoryPath(item: NaverSearchItem): string {
    const categories = [
      item.category1,
      item.category2,
      item.category3,
      item.category4
    ].filter(Boolean);

    return categories.length > 0 ? categories.join(' > ') : '미분류';
  }

  private calculatePriorityScores(
    categories: CategoryAnalysis[], 
    allItems: NaverSearchItem[]
  ): CategoryAnalysis[] {
    // Priority scoring algorithm
    // Factors:
    // 1. Position weight - items appearing earlier get higher weight
    // 2. Category frequency - how many items in category
    // 3. Category depth - more specific categories might be more relevant

    const positionWeights = new Map<string, number>();
    
    // Calculate position-based weights
    allItems.forEach((item, index) => {
      const categoryPath = this.buildCategoryPath(item);
      const weight = 1 / (index + 1); // Higher weight for items appearing earlier
      
      const currentWeight = positionWeights.get(categoryPath) || 0;
      positionWeights.set(categoryPath, currentWeight + weight);
    });

    // Apply weights to categories
    const scoredCategories = categories.map(category => {
      const positionWeight = positionWeights.get(category.categoryPath) || 0;
      
      // Calculate final score
      // 40% from item count, 40% from position weight, 20% from depth bonus
      const countScore = category.itemCount / allItems.length;
      const positionScore = positionWeight;
      const depthBonus = Math.min(category.categoryDepth / 4, 1) * 0.2;
      
      const finalScore = (countScore * 0.4) + (positionScore * 0.4) + depthBonus;

      return {
        ...category,
        score: finalScore
      };
    });

    // Sort by final score
    scoredCategories.sort((a, b) => (b.score || 0) - (a.score || 0));

    return scoredCategories;
  }

  getTopBrands(categories: CategoryAnalysis[]): { brand: string; count: number }[] {
    const brandMap = new Map<string, number>();

    categories.forEach(category => {
      Object.entries(category.brandDistribution).forEach(([brand, count]) => {
        const currentCount = brandMap.get(brand) || 0;
        brandMap.set(brand, currentCount + count);
      });
    });

    const brands = Array.from(brandMap.entries())
      .map(([brand, count]) => ({ brand, count }))
      .sort((a, b) => b.count - a.count);

    return brands.slice(0, 10);
  }

  getItemsByCategory(categoryPath: string): NaverSearchItem[] {
    return this.categoryItemsMap.get(categoryPath) || [];
  }

  getCategoryInsights(result: SearchAnalysisResult): {
    dominantCategory: string | null;
    categoryDiversity: number;
    avgCategoryDepth: number;
    priceRange: { min: number; max: number };
  } {
    const { topCategories } = result;

    if (topCategories.length === 0) {
      return {
        dominantCategory: null,
        categoryDiversity: 0,
        avgCategoryDepth: 0,
        priceRange: { min: 0, max: 0 }
      };
    }

    // Dominant category (with highest percentage)
    const dominantCategory = topCategories[0].categoryPath;

    // Category diversity (Shannon entropy)
    const totalItems = topCategories.reduce((sum, cat) => sum + cat.itemCount, 0);
    const entropy = topCategories.reduce((sum, cat) => {
      const p = cat.itemCount / totalItems;
      return sum - (p > 0 ? p * Math.log2(p) : 0);
    }, 0);
    const maxEntropy = Math.log2(topCategories.length);
    const categoryDiversity = maxEntropy > 0 ? (entropy / maxEntropy) * 100 : 0;

    // Average category depth
    const avgCategoryDepth = topCategories.reduce((sum, cat) => sum + cat.categoryDepth, 0) / topCategories.length;

    // Price range
    const allPrices = topCategories
      .map(cat => cat.avgPrice)
      .filter(price => price > 0);
    
    const priceRange = {
      min: Math.min(...allPrices),
      max: Math.max(...allPrices)
    };

    return {
      dominantCategory,
      categoryDiversity: Math.round(categoryDiversity),
      avgCategoryDepth: Math.round(avgCategoryDepth * 10) / 10,
      priceRange
    };
  }
}

export const categoryAnalyzer = new CategoryAnalyzer();