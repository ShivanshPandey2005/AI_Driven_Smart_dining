import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { PrismaClient } from '../../generated/client';
import { RecommendedItem } from './recommendation.agent';

const prisma = new PrismaClient();

export class UpsellAgent {
  /**
   * Evaluates Cart conditions and triggers highly contextual, conversational recommendations.
   */
  public static async suggestPairings(
    recommendedItems: RecommendedItem[],
    sessionId: string,
    model: ChatOpenAI | null
  ): Promise<{ text: string; upsellItems: RecommendedItem[] }> {
    let allItems: RecommendedItem[] = [];
    let cartItems: any[] = [];
    
    try {
      // Fetch all available items
      allItems = await prisma.menuItem.findMany({
        where: { available: true }
      }) as any[];

      // Fetch active cart items for trigger evaluations
      cartItems = await prisma.cartItem.findMany({
        where: { sessionId },
        include: { menuItem: true }
      });
    } catch (err) {
      console.warn('Upsell Agent: DB Fetch error:', err);
    }

    // ─── COMPUTE CARTS AND TRIGGERS ───
    const cartTotal = cartItems.reduce((sum, item) => sum + (item.quantity * item.menuItem.price), 0);
    const hasBeverage = cartItems.some(item => item.menuItem.category.toLowerCase() === 'beverages');
    const hasDessert = cartItems.some(item => item.menuItem.category.toLowerCase() === 'desserts');
    
    const isEvening = new Date().getHours() >= 17; // After 5:00 PM
    const uniqueDiners = new Set(cartItems.map(item => item.notes?.match(/^\[(.*?)\]/)?.[1] || 'Guest')).size;
    const isGroup = uniqueDiners > 1;

    let activeTrigger = '';
    let upsellCandidates: RecommendedItem[] = [];

    // Trigger Rule Evaluation
    if (isGroup && cartItems.length > 2) {
      activeTrigger = 'GROUP_COMBO';
      // Suggest large platters or combos
      upsellCandidates = allItems.filter(item => 
        item.tags.some(t => t.toLowerCase() === 'sharing') || 
        item.tags.some(t => t.toLowerCase() === 'platter')
      );
    } else if (cartTotal > 500 && !hasDessert) {
      activeTrigger = 'TOTAL_ABOVE_500_DESSERT';
      // Suggest high-quality desserts
      upsellCandidates = allItems.filter(item => item.category.toLowerCase() === 'desserts');
    } else if (cartItems.length > 0 && !hasBeverage) {
      activeTrigger = 'MISSING_BEVERAGES';
      // Suggest premium beverages
      upsellCandidates = allItems.filter(item => item.category.toLowerCase() === 'beverages');
    } else if (isEvening && !hasDessert) {
      activeTrigger = 'EVENING_DESSERT_SPECIAL';
      // Evening sweet cravings offer
      upsellCandidates = allItems.filter(item => item.category.toLowerCase() === 'desserts');
    } else {
      activeTrigger = 'STANDARD_PAIRING';
      // Default: Find items matching the recommended items' pairings
      const pairingNames = new Set<string>();
      recommendedItems.forEach(item => {
        if (item.complementaryItems) {
          item.complementaryItems.forEach(p => pairingNames.add(p.toLowerCase()));
        }
      });
      upsellCandidates = allItems.filter(item => pairingNames.has(item.name.toLowerCase()));
    }

    // Filter out items already in cart or recommendations
    const existingIds = new Set([
      ...cartItems.map(c => c.menuItemId),
      ...recommendedItems.map(r => r.id)
    ]);
    upsellCandidates = upsellCandidates.filter(item => !existingIds.has(item.id));

    // Sort by popularity
    upsellCandidates.sort((a, b) => b.popularScore - a.popularScore);
    const topUpsellCandidates = upsellCandidates.slice(0, 3);

    if (model && topUpsellCandidates.length > 0) {
      try {
        const candidatesText = topUpsellCandidates.map(c => 
          `ID: ${c.id} | Name: "${c.name}" | Category: ${c.category} | Price: ₹${c.price} | Description: ${c.description}`
        ).join('\n');

        const prompt = ChatPromptTemplate.fromMessages([
          ['system', `You are the Upsell Agent for "Zara", our premium restaurant companion.
Your goal is to suggest a single, perfect complementary item from the candidates list.
Customize your recommendation tone based on the active trigger.

Active Trigger: {activeTrigger}
- GROUP_COMBO: Group ordering detected. Recommend sharing items and mock combos.
- TOTAL_ABOVE_500_DESSERT: Total exceeds ₹500. Offer a celebratory sweet finish.
- MISSING_BEVERAGES: Table has food but no beverages. Offer refreshing specialty mocktails or teas.
- EVENING_DESSERT_SPECIAL: Cozy evening dining. Offer our signature freshly prepared night-time dessert.
- STANDARD_PAIRING: Food pairing. Suggest the beverage or side that coordinates best with dishes under consideration.

Rules:
1. Speak in a highly natural, sensory, and conversational tone. AVOID robotic "add-on sales" terminology. Focus on how it elevates the culinary experience.
2. Select EXACTLY one candidate and state its ID.

Response format MUST be raw JSON:
{{
  "responseText": "Irresistible description of the suggestion...",
  "selectedUpsellId": "ID of the selected upsell item"
}}`],
          ['user', 'Select and describe the perfect pairing.'],
        ]);

        const chain = prompt.pipe(model);
        const response = await chain.invoke({
          activeTrigger,
        });

        let text = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(text);

        const chosenItem = topUpsellCandidates.find(c => c.id === parsed.selectedUpsellId);

        return {
          text: parsed.responseText || 'Enhance your feast with a complementary pairing!',
          upsellItems: chosenItem ? [chosenItem] : [topUpsellCandidates[0]],
        };
      } catch (err) {
        console.error('Upsell Agent API error, running fallback:', err);
      }
    }

    // High fidelity offline fallback
    if (topUpsellCandidates.length > 0) {
      const match = topUpsellCandidates[0];
      let promptText = '';
      switch (activeTrigger) {
        case 'GROUP_COMBO':
          promptText = `Since you're dining as a group today, we highly recommend adding a sharing platter of our **${match.name}** (₹${match.price}) - *${match.description}* to keep the conversations lively!`;
          break;
        case 'TOTAL_ABOVE_500_DESSERT':
          promptText = `Your dining feast looks spectacular! To celebrate your wonderful table selection (now exceeding ₹500), would you like to round it off with our signature sweet masterpiece, the **${match.name}** (₹${match.price})?`;
          break;
        case 'MISSING_BEVERAGES':
          promptText = `To refresh your palate between these savory main courses, our bar captain highly recommends pairing them with our chilled, signature **${match.name}** (₹${match.price})!`;
          break;
        case 'EVENING_DESSERT_SPECIAL':
          promptText = `As the evening winds down, our chefs have just prepared a fresh batch of **${match.name}** (₹${match.price}). Shall we serve a plate to sweeten your night?`;
          break;
        default:
          promptText = `To elevate the beautiful flavors of your meal, we highly suggest pairing your dishes with our popular **${match.name}** (₹${match.price})!`;
      }
      return {
        text: promptText,
        upsellItems: [match],
      };
    }

    return {
      text: '',
      upsellItems: [],
    };
  }
}
