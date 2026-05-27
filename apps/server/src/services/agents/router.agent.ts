import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { MenuVectorStore } from './vectorStore';

export type IntentType = 'GREET' | 'RECOMMEND' | 'ADD_ITEM' | 'UPSELL' | 'GROUP' | 'CHECKOUT' | 'FALLBACK';

export interface RouterParams {
  intent: IntentType;
  itemName?: string;
  quantity?: number;
  notes?: string;
  confidence: number;
}

export class RouterOrchestratorAgent {
  /**
   * Classifies user input into a supported intent and extracts parameters using gpt-4o-mini.
   */
  public static async classify(
    input: string,
    model: ChatOpenAI | null
  ): Promise<RouterParams> {
    const cleanInput = input.trim();
    if (!cleanInput) {
      return { intent: 'FALLBACK', confidence: 1.0 };
    }

    if (model) {
      try {
        const prompt = ChatPromptTemplate.fromMessages([
          ['system', `You are the Intent Router & Parameter Extractor for "Zara", the ultimate AI Dining Assistant at a premium Indian restaurant.
Analyze the guest's input and classify it into one of these strict intents:
1. "GREET": Initial greetings, namaste, high-level welcoming requests (e.g., "hi", "hey Zara", "good evening").
2. "RECOMMEND": Inquiries seeking recommendations, cravings, dietary or spice searches, semantic lookups (e.g., "suggest a spicy dish", "do you have vegan food?", "I am in the mood for something creamy").
3. "ADD_ITEM": Explicit requests to add a dish to their cart (e.g., "add two butter naan", "put paneer masala in my cart", "add a mango lassi please").
4. "UPSELL": Requests for drinks, sides, combos, or desserts that go well with their selection (e.g., "what drinks match this?", "any dessert suggestions?").
5. "GROUP": Group/multi-user coordinate requests (e.g., "we are 4 people at our table", "Rahul is allergic to nuts, summarize what everyone wants").
6. "CHECKOUT": Intent to finalize, complete their session, pay the bill, or place the final order (e.g., "I want to place my order", "checkout please", "confirm my bill").
7. "FALLBACK": General talk, questions about the restaurant location, details on ingredients that don't match the other categories.

Response format MUST be raw JSON:
{{
  "intent": "GREET" | "RECOMMEND" | "ADD_ITEM" | "UPSELL" | "GROUP" | "CHECKOUT" | "FALLBACK",
  "itemName": "Name of the dish to add if intent is ADD_ITEM, otherwise leave empty",
  "quantity": number (default to 1 if not specified),
  "notes": "Any custom instructions extracted (e.g., 'extra spicy', 'no onions'), otherwise leave empty",
  "confidence": number between 0.0 and 1.0
}}`],
          ['user', '{input}'],
        ]);

        // Instruct model to behave like gpt-4o-mini
        const configuredModel = new ChatOpenAI({
          openAIApiKey: model.apiKey,
          modelName: 'gpt-4o-mini', // Enforce low-latency high-intelligence gpt-4o-mini
          temperature: 0.1, // High reliability
        });

        const chain = prompt.pipe(configuredModel);
        const response = await chain.invoke({ input: cleanInput });
        
        let text = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(text);

        return {
          intent: parsed.intent || 'FALLBACK',
          itemName: parsed.itemName || undefined,
          quantity: parsed.quantity || undefined,
          notes: parsed.notes || undefined,
          confidence: parsed.confidence || 0.8,
        };
      } catch (err) {
        console.error('Router-Orchestrator Agent API Error, running fallback:', err);
      }
    }

    // High fidelity offline fallback rule-based classifier
    return this.fallbackClassifier(cleanInput);
  }

  private static fallbackClassifier(input: string): RouterParams {
    const lower = input.toLowerCase();

    // 1. ADD_ITEM check
    if (lower.includes('add') || lower.includes('put') || lower.includes('order a') || lower.includes('cart')) {
      // Simple regex to pull quantity and dish names
      const qtyMatch = lower.match(/\b(one|two|three|four|five|\d+)\b/);
      let quantity = 1;
      if (qtyMatch) {
        const val = qtyMatch[1];
        if (!isNaN(Number(val))) quantity = Number(val);
        else if (val === 'one') quantity = 1;
        else if (val === 'two') quantity = 2;
        else if (val === 'three') quantity = 3;
        else if (val === 'four') quantity = 4;
        else if (val === 'five') quantity = 5;
      }

      // Try to clean name from query
      let itemName = input.replace(/add/gi, '').replace(/put/gi, '').replace(/in my cart/gi, '').replace(/to my cart/gi, '').replace(/to my order/gi, '').trim();
      return {
        intent: 'ADD_ITEM',
        itemName,
        quantity,
        confidence: 0.9,
      };
    }

    // 2. CHECKOUT check
    if (lower.includes('checkout') || lower.includes('pay') || lower.includes('bill') || lower.includes('place my order') || lower.includes('finalize')) {
      return { intent: 'CHECKOUT', confidence: 0.95 };
    }

    // 3. GREET check
    if (lower.match(/\b(hi|hello|hey|namaste|greetings|welcome|hola)\b/)) {
      return { intent: 'GREET', confidence: 0.95 };
    }

    // 4. GROUP check
    if (lower.includes('we are') || lower.includes('people') || lower.includes('table roster') || lower.includes('group')) {
      return { intent: 'GROUP', confidence: 0.85 };
    }

    // 5. UPSELL check
    if (lower.includes('drink') || lower.includes('beverage') || lower.includes('dessert') || lower.includes('pairing') || lower.includes('combo')) {
      return { intent: 'UPSELL', confidence: 0.8 };
    }

    // 6. RECOMMEND check
    if (lower.includes('recommend') || lower.includes('suggest') || lower.includes('crave') || lower.includes('spicy') || lower.includes('veg') || lower.includes('light') || lower.includes('filling')) {
      return { intent: 'RECOMMEND', confidence: 0.9 };
    }

    return { intent: 'FALLBACK', confidence: 0.7 };
  }
}
