import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { PrismaClient } from '../../generated/client';
import { MemoryContext } from './memory.agent';

const prisma = new PrismaClient();

export interface RecommendedItem {
  id: string;
  name: string;
  price: number;
  description: string;
  category: string;
  tags: string[];
  allergens: string[];
  popularScore: number;
  complementaryItems: string[];
}

export class RecommendationAgent {
  /**
   * Recommends dishes by matching user input and memory context against database items.
   */
  public static async recommend(
    input: string,
    memoryContext: MemoryContext,
    model: ChatOpenAI | null
  ): Promise<{ text: string; items: RecommendedItem[] }> {
    // 1. Fetch available items from database
    let items: RecommendedItem[] = [];
    try {
      items = await prisma.menuItem.findMany({
        where: { available: true },
      }) as any[];
    } catch (err) {
      console.error('Error fetching menu items for recommendation:', err);
    }

    // 2. Perform tag, spice, budget and allergen pre-filtering
    let filteredItems = [...items];

    // Filter out items matching stated allergies strictly
    if (memoryContext.allergies.length > 0) {
      filteredItems = filteredItems.filter(item => {
        return !item.allergens.some(allergen => 
          memoryContext.allergies.some(a => a.toLowerCase() === allergen.toLowerCase())
        );
      });
    }

    // Vegetarian/vegan filter
    const isVeg = memoryContext.preferences.includes('vegetarian') || input.toLowerCase().includes('veg');
    const isVegan = memoryContext.preferences.includes('vegan') || input.toLowerCase().includes('vegan');
    
    if (isVegan) {
      filteredItems = filteredItems.filter(item => 
        item.tags.some(t => t.toLowerCase() === 'vegan')
      );
    } else if (isVeg) {
      filteredItems = filteredItems.filter(item => 
        item.tags.some(t => t.toLowerCase() === 'vegetarian')
      );
    }

    // Spice level filter
    if (memoryContext.spiceTolerance === 'spicy' || input.toLowerCase().includes('spicy') || input.toLowerCase().includes('hot')) {
      filteredItems = filteredItems.sort((a, b) => {
        const aSpicy = a.tags.some(t => t.toLowerCase() === 'spicy') ? 1 : 0;
        const bSpicy = b.tags.some(t => t.toLowerCase() === 'spicy') ? 1 : 0;
        return bSpicy - aSpicy;
      });
    }

    // Sort by popularity as default base rating
    filteredItems.sort((a, b) => b.popularScore - a.popularScore);

    // Get top candidates
    const candidates = filteredItems.slice(0, 5);

    if (model && candidates.length > 0) {
      try {
        const menuContextText = candidates.map(item => {
          return `ID: ${item.id} | Name: "${item.name}" | Category: ${item.category} | Price: ₹${item.price} | Description: ${item.description} | Tags: [${item.tags.join(', ')}] | Popularity: ${item.popularScore}/100`;
        }).join('\n');

        const prompt = ChatPromptTemplate.fromMessages([
          ['system', `You are the culinary Recommendation Agent for "Antigravity Chef".
Your job is to select the absolute best 2-3 dishes from the filtered menu below that match the guest's cravings/context.

Stated Customer Cravings / Context:
- Cravings / Input: "{input}"
- Diet Preferences: [{preferences}]
- Spice Tolerance: {spice}
- Allergies Filtered Out: [{allergies}]

Candidate Menu Items:
${menuContextText}

Rules:
1. Recommend ONLY items from the Candidate Menu list.
2. Select the top 2-3 items. Explain why each dish is perfect for their cravings using premium, sensory descriptions.
3. Make them feel pampered.
4. Output your response as a JSON object containing the conversational response text and the array of recommended dish IDs.

Response format MUST be raw JSON:
{{
  "responseText": "Sensory conversational recommendation here...",
  "recommendedIds": ["id1", "id2"]
}}`],
          ['user', 'Recommend matching dishes.'],
        ]);

        const chain = prompt.pipe(model);
        const response = await chain.invoke({
          input,
          preferences: memoryContext.preferences.join(', '),
          spice: memoryContext.spiceTolerance,
          allergies: memoryContext.allergies.join(', '),
        });

        let text = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(text);

        const selectedIds: string[] = parsed.recommendedIds || [];
        const recommendedItems = candidates.filter(item => selectedIds.includes(item.id));

        return {
          text: parsed.responseText || 'Here are some signature suggestions tailored for you.',
          items: recommendedItems.length > 0 ? recommendedItems : candidates.slice(0, 2),
        };
      } catch (err) {
        console.error('Recommendation Agent API Error, fallback matching:', err);
      }
    }

    // High fidelity offline fallback matching
    const selection = candidates.slice(0, 2);
    let textResult = `Based on your preferences, here is what I highly recommend from our kitchen:\n\n`;
    
    selection.forEach((item, idx) => {
      textResult += `${idx + 1}. **${item.name}** (₹${item.price}) - *${item.description}*\n`;
      textResult += `   *Tags:* ${item.tags.join(', ')} | *Popularity:* ${item.popularScore}%\n\n`;
    });

    textResult += `Would you like me to add any of these options to your cart?`;

    return {
      text: textResult,
      items: selection,
    };
  }
}
