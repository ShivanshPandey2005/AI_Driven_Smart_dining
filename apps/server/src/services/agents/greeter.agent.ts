import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';

export class GreeterAgent {
  /**
   * Generates a premium hospitality welcome or initial mood inquiry.
   */
  public static async greet(
    tableNo: string,
    guestName: string | null,
    model: ChatOpenAI | null
  ): Promise<string> {
    const displayName = guestName || 'Guest';

    if (model) {
      try {
        const prompt = ChatPromptTemplate.fromMessages([
          ['system', `You are the Greeter Agent for "Antigravity Chef", the ultra-premium AI dining companion at an elegant Indian fine dining restaurant.
Your role is to offer an exceptional, warm, and luxury welcome to the guest.
- Welcome the guest by name (if provided).
- Mention their physical Table Number.
- Ask about their current mood, cravings, or dietary preferences to help tailor their experience.
- Keep the tone sensory, hospitable, and highly professional. Limit to 3 sentences. Do not mention menus or categories explicitly yet.`],
          ['user', `Greet the guest at Table {tableNo} named {displayName}.`],
        ]);

        const chain = prompt.pipe(model);
        const response = await chain.invoke({
          tableNo,
          displayName,
        });

        return typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
      } catch (err) {
        console.error('Greeter Agent API Error, using fallback:', err);
      }
    }

    // High fidelity offline fallback
    return `Namaste & Welcome, **${displayName}**! 🌟
It is an absolute honor to host you at **Table ${tableNo}** today. 
I am your dedicated AI Dining Companion. What kind of culinary mood find you in today? Are you craving something rich and slow-cooked, a fiery tandoori masterpiece, or perhaps a light and vibrant gluten-free starter? Do tell me about any dietary preferences or allergies so we may craft your perfect feast!`;
  }
}
