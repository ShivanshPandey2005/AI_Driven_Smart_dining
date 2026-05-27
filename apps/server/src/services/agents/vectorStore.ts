import { OpenAIEmbeddings } from '@langchain/openai';
import { PrismaClient } from '../../generated/client';

const prisma = new PrismaClient();

export interface MenuItemWithEmbedding {
  id: string;
  name: string;
  category: string;
  price: number;
  description: string;
  tags: string[];
  allergens: string[];
  popularScore: number;
  complementaryItems: string[];
  embedding?: number[];
}

export class MenuVectorStore {
  private static embeddingsCache: Map<string, number[]> = new Map();
  private static embeddingsService: OpenAIEmbeddings | null = null;

  private static getEmbeddingsService(): OpenAIEmbeddings | null {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey.includes('your-openai-api-key')) {
      return null;
    }

    if (!this.embeddingsService) {
      this.embeddingsService = new OpenAIEmbeddings({
        openAIApiKey: apiKey,
        modelName: 'text-embedding-3-small',
      });
    }
    return this.embeddingsService;
  }

  /**
   * Warm up the vector cache by pre-embedding all menu items.
   */
  public static async warmup(): Promise<void> {
    const service = this.getEmbeddingsService();
    if (!service) {
      console.log('Vector Store: No OpenAI Key, operating in heuristic semantic fallback mode.');
      return;
    }

    try {
      const items = await prisma.menuItem.findMany({ where: { available: true } });
      console.log(`Vector Store: Generating embeddings for ${items.length} items...`);
      
      for (const item of items) {
        if (!this.embeddingsCache.has(item.id)) {
          const textToEmbed = `${item.name} ${item.category} ${item.description} ${item.tags.join(' ')}`;
          const embedding = await service.embedQuery(textToEmbed);
          this.embeddingsCache.set(item.id, embedding);
        }
      }
      console.log('Vector Store: Embeddings cache warmed up successfully!');
    } catch (err) {
      console.error('Vector Store Warmup Error:', err);
    }
  }

  /**
   * Vector search with cosine similarity. Falls back to keyword tag matching if offline.
   */
  public static async search(query: string, limit: number = 3): Promise<MenuItemWithEmbedding[]> {
    const service = this.getEmbeddingsService();
    const items = await prisma.menuItem.findMany({ where: { available: true } }) as MenuItemWithEmbedding[];

    if (!service) {
      // Offline fallback: TF-IDF or tag/keyword matching similarity score
      return this.fallbackKeywordSearch(query, items, limit);
    }

    try {
      // Embed user query
      const queryEmbedding = await service.embedQuery(query);

      // Compute cosine similarity for each item
      const itemsWithScores = await Promise.all(
        items.map(async (item) => {
          let itemEmbedding = this.embeddingsCache.get(item.id);
          
          if (!itemEmbedding) {
            // Lazy embed if cache misses
            const textToEmbed = `${item.name} ${item.category} ${item.description} ${item.tags.join(' ')}`;
            itemEmbedding = await service.embedQuery(textToEmbed);
            this.embeddingsCache.set(item.id, itemEmbedding);
          }

          const score = this.cosineSimilarity(queryEmbedding, itemEmbedding);
          return { item, score };
        })
      );

      // Sort by score descending and return
      itemsWithScores.sort((a, b) => b.score - a.score);
      console.log('Vector Store search matches:', itemsWithScores.slice(0, limit).map(x => `${x.item.name} (${x.score.toFixed(3)})`));
      
      return itemsWithScores.slice(0, limit).map(x => x.item);
    } catch (err) {
      console.error('Vector Search failed, running fallback search:', err);
      return this.fallbackKeywordSearch(query, items, limit);
    }
  }

  /**
   * Helper to calculate Cosine Similarity between two vector arrays
   */
  private static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dotProduct = 0;
    let mA = 0;
    let mB = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      mA += a[i] * a[i];
      mB += b[i] * b[i];
    }
    if (mA === 0 || mB === 0) return 0;
    return dotProduct / (Math.sqrt(mA) * Math.sqrt(mB));
  }

  /**
   * Heuristic/Tag matching offline semantic matching search.
   */
  private static fallbackKeywordSearch(
    query: string,
    items: MenuItemWithEmbedding[],
    limit: number
  ): MenuItemWithEmbedding[] {
    const cleanQuery = query.toLowerCase();
    const scoredItems = items.map(item => {
      let score = 0;
      const name = item.name.toLowerCase();
      const desc = item.description.toLowerCase();
      const cat = item.category.toLowerCase();
      const tags = item.tags.map(t => t.toLowerCase());

      // Direct matches
      if (name.includes(cleanQuery)) score += 10;
      if (cat.includes(cleanQuery)) score += 5;

      // Word-based intersections
      const queryWords = cleanQuery.split(/\s+/);
      queryWords.forEach(word => {
        if (word.length < 3) return; // skip tiny stop-words
        if (name.includes(word)) score += 3;
        if (desc.includes(word)) score += 1;
        if (tags.includes(word)) score += 2;
      });

      // Factor in popularity a little bit for better results
      score += (item.popularScore / 100);

      return { item, score };
    });

    scoredItems.sort((a, b) => b.score - a.score);
    return scoredItems.slice(0, limit).map(x => x.item);
  }
}
