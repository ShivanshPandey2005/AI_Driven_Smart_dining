import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { PrismaClient } from '../generated/client';
import { NluAgent } from './agents/nlu.agent';
import { SentimentAgent } from './agents/sentiment.agent';
import { ContextMemoryAgent } from './agents/memory.agent';
import { GroupCoordinatorAgent } from './agents/group.agent';
import { GreeterAgent } from './agents/greeter.agent';
import { RecommendationAgent, RecommendedItem } from './agents/recommendation.agent';
import { UpsellAgent } from './agents/upsell.agent';
import { OrderValidationAgent } from './agents/validation.agent';
import { RouterOrchestratorAgent } from './agents/router.agent';
import { MenuVectorStore } from './agents/vectorStore';

const prisma = new PrismaClient();

export class AiService {
  private static model: ChatOpenAI | null = null;

  private static getModel(): ChatOpenAI | null {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey.includes('your-openai-api-key')) {
      console.warn('AI Service: OpenAI API Key not configured. Running high-fidelity offline fallbacks.');
      return null;
    }

    if (!this.model) {
      this.model = new ChatOpenAI({
        openAIApiKey: apiKey,
        modelName: 'gpt-4o-mini', // Enforce low-latency high-intelligence gpt-4o-mini
        temperature: 0.6,
      });
    }
    return this.model;
  }

  /**
   * Generates a conversational response using the Router-Orchestrator architecture.
   */
  public static async generateResponse(sessionId: string, userMessage: string): Promise<string> {
    try {
      const model = this.getModel();

      // Retrieve session metadata
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: { user: true }
      });
      const tableNo = session?.tableNo || '1';
      const guestName = session?.user?.name || 'Guest';

      // ─── STEP 1: MULTILINGUAL NLU AGENT ───
      const nluResult = await NluAgent.process(userMessage, model);
      const englishInput = nluResult.translatedInput;

      // ─── STEP 2: INTENT CLASSIFICATION ROUTER ───
      const routerResult = await RouterOrchestratorAgent.classify(englishInput, model);
      console.log(`[ROUTER] Classified Intent: ${routerResult.intent} (confidence: ${routerResult.confidence})`);

      // ─── STEP 3: SENTIMENT & MEMORY PROCESSING ───
      const sentimentResult = await SentimentAgent.analyze(englishInput, model);
      const memoryContext = await ContextMemoryAgent.extractAndStore(sessionId, englishInput, model);
      const groupContext = await GroupCoordinatorAgent.coordinate(sessionId, englishInput, model);

      let staffInterventionNotice = '';
      if (sentimentResult.requiresStaffIntervention) {
        staffInterventionNotice = `🔔 *[Zara Note: I have notified our floor captain to stop by Table ${tableNo} to assist you immediately!]* \n\n`;
      }

      let coreReply = '';
      let recommendedItems: RecommendedItem[] = [];
      let addCartActionTag = '';

      // Warm up vector store if not done
      await MenuVectorStore.warmup();

      // ─── STEP 4: ROUTE TO PROPER AGENT ───
      switch (routerResult.intent) {
        case 'GREET': {
          coreReply = await GreeterAgent.greet(tableNo, guestName, model);
          break;
        }

        case 'ADD_ITEM': {
          const searchItemName = routerResult.itemName || englishInput;
          // Use AI Semantic Search to find best match
          const matches = await MenuVectorStore.search(searchItemName, 1);
          
          if (matches.length > 0) {
            const matchedItem = matches[0];
            const quantity = routerResult.quantity || 1;
            const itemNotes = `[${guestName}] - ` + (routerResult.notes || 'Added via Zara AI');

            // Add directly to database cart
            await prisma.cartItem.create({
              data: {
                sessionId,
                menuItemId: matchedItem.id,
                quantity,
                notes: itemNotes
              }
            });

            // Action tag for frontend optimistic UI update
            addCartActionTag = `\n\n[ACTION: ADD_TO_CART_SUCCESS | id: ${matchedItem.id} | name: ${matchedItem.name} | qty: ${quantity}]`;
            
            coreReply = `Perfect choice! I have successfully added **${quantity}x ${matchedItem.name}** (₹${matchedItem.price}) to Table ${tableNo}'s shared cart. 🍽️`;
            recommendedItems = [matchedItem];
          } else {
            coreReply = `I understand you want to add an item, but I couldn't find a matching dish for "${searchItemName}" in our active menu. Could you please specify the exact name?`;
          }
          break;
        }

        case 'RECOMMEND': {
          // AI Semantic Vector Search
          const topMatches = await MenuVectorStore.search(englishInput, 3);
          
          if (model) {
            const recommendationResult = await RecommendationAgent.recommend(englishInput, memoryContext, model);
            coreReply = recommendationResult.text;
            recommendedItems = recommendationResult.items;
          } else {
            // High fidelity offline semantic search recommendation
            coreReply = `Based on your request, I found some exquisite options on our menu:\n\n`;
            topMatches.forEach((item, idx) => {
              coreReply += `${idx + 1}. **${item.name}** (₹${item.price}) - *${item.description}*\n`;
            });
            coreReply += `\nWould you like me to add any of these to your cart?`;
            recommendedItems = topMatches;
          }
          break;
        }

        case 'UPSELL': {
          // Triggerupsell suggestions directly
          const upsellResult = await UpsellAgent.suggestPairings([], sessionId, model);
          coreReply = upsellResult.text;
          break;
        }

        case 'GROUP': {
          coreReply = `Coordinating for Table ${tableNo}! ${groupContext.dinerPreferencesSummary}\n\nI am keeping track of everyone's selections and preferences so your dining experience is completely harmonious!`;
          break;
        }

        case 'CHECKOUT': {
          coreReply = `Wonderful, Table ${tableNo}! I am ready to initiate checkout. Please provide your **Name** and **Phone Number** in the sliding drawer to receive a secure OTP verification (Demo OTP is **123456**) so we can finalize and submit your order to the kitchen!`;
          break;
        }

        case 'FALLBACK':
        default: {
          if (model) {
            // General conversational reply
            const prompt = ChatPromptTemplate.fromMessages([
              ['system', `You are "Zara", the elegant, responsive AI Dining Assistant at a premium Indian restaurant.
Help the customer with their questions about the restaurant, table services, or dining advice.
Keep answers concise, polished, and extremely welcoming.`],
              ['user', '{input}'],
            ]);
            const chain = prompt.pipe(model);
            const response = await chain.invoke({ input: englishInput });
            coreReply = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
          } else {
            coreReply = `I am Zara, your smart dining assistant! I can recommend our signature dishes, add items directly to your cart, or call a waiter for you. What would you like to explore today?`;
          }
          break;
        }
      }

      // ─── STEP 5: INTELLIGENT UPSELL ATTACHMENT ───
      let upsellReply = '';
      if (recommendedItems.length > 0 && routerResult.intent !== 'ADD_ITEM') {
        const upsellResult = await UpsellAgent.suggestPairings(recommendedItems, sessionId, model);
        upsellReply = upsellResult.text;
      }

      // ─── STEP 6: ORDER VALIDATION CHECK ───
      const validationResult = await OrderValidationAgent.validate(sessionId, memoryContext, model);

      // ─── STEP 7: ASSEMBLE MASTER RESPONSE ───
      let finalAssembly = '';
      if (staffInterventionNotice) finalAssembly += staffInterventionNotice;
      finalAssembly += coreReply;
      if (upsellReply) finalAssembly += `\n\n${upsellReply}`;
      if (validationResult.issues.length > 0) finalAssembly += `\n\n${validationResult.feedbackMessage}`;
      
      // Append group coordinations
      if (groupContext.isGroupSession && routerResult.intent !== 'GREET') {
        finalAssembly += `\n\n👥 *[Table ${tableNo} Dining Roster]* \n*Active Guests: ${groupContext.activeDinersCount}* | *Status: ${groupContext.dinerPreferencesSummary}*`;
      }

      // Add action tag at the absolute end (so localization doesn't scramble it)
      if (addCartActionTag) finalAssembly += addCartActionTag;

      // ─── STEP 8: LOCALIZATION BACK TO DETECTED LANGUAGE ───
      const localizedResponse = await NluAgent.localizeResponse(
        finalAssembly,
        nluResult.detectedLanguage,
        model
      );

      return localizedResponse;

    } catch (error) {
      console.error('Router-Orchestrator Pipeline Error:', error);
      return "I apologize, my digital kitchen circuits are experiencing a brief delay. Our floor captain has been notified to assist you at your table immediately!";
    }
  }
}
