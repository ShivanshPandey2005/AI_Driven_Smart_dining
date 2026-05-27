import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { PrismaClient } from '../../generated/client';
import { MemoryContext } from './memory.agent';

const prisma = new PrismaClient();

export interface ValidationIssue {
  severity: 'warning' | 'critical' | 'none';
  itemName: string;
  reason: string;
}

export interface ValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
  feedbackMessage: string;
}

export class OrderValidationAgent {
  /**
   * Validates cart items against customer allergies and dietary preferences.
   */
  public static async validate(
    sessionId: string,
    memoryContext: MemoryContext,
    model: ChatOpenAI | null
  ): Promise<ValidationResult> {
    // 1. Fetch current cart items
    let cartItems: any[] = [];
    try {
      cartItems = await prisma.cartItem.findMany({
        where: { sessionId },
        include: { menuItem: true }
      });
    } catch (e) {
      console.error('Validation Agent: Error reading cart:', e);
    }

    if (cartItems.length === 0) {
      return {
        isValid: true,
        issues: [],
        feedbackMessage: 'Your cart is empty. Ready for you to explore our selection!'
      };
    }

    // 2. Scan cart items for active allergen matches
    const issues: ValidationIssue[] = [];

    // Local allergen checking (High fidelity offline safety first!)
    cartItems.forEach(cartItem => {
      const item = cartItem.menuItem;
      const matchedAllergens = item.allergens.filter((a: string) => 
        memoryContext.allergies.some(ma => ma.toLowerCase() === a.toLowerCase())
      );

      if (matchedAllergens.length > 0) {
        issues.push({
          severity: 'critical',
          itemName: item.name,
          reason: `Contains allergens [${matchedAllergens.join(', ')}] which matches your profile allergy restrictions: [${memoryContext.allergies.join(', ')}].`
        });
      }

      // Check dietary preferences matching
      const prefersVeg = memoryContext.preferences.includes('vegetarian');
      const prefersVegan = memoryContext.preferences.includes('vegan');
      const isItemVeg = item.tags.some((t: string) => t.toLowerCase() === 'vegetarian');
      const isItemVegan = item.tags.some((t: string) => t.toLowerCase() === 'vegan');

      if (prefersVegan && !isItemVegan) {
        issues.push({
          severity: 'warning',
          itemName: item.name,
          reason: `You requested a Vegan meal, but "${item.name}" is not tagged as Vegan.`
        });
      } else if (prefersVeg && !isItemVeg) {
        issues.push({
          severity: 'warning',
          itemName: item.name,
          reason: `You requested a Vegetarian meal, but "${item.name}" contains non-vegetarian ingredients.`
        });
      }
    });

    const isFullyValid = !issues.some(i => i.severity === 'critical');

    if (model && issues.length > 0) {
      try {
        const issuesText = issues.map(i => 
          `Item: "${i.itemName}" | Severity: ${i.severity.toUpperCase()} | Conflict: ${i.reason}`
        ).join('\n');

        const prompt = ChatPromptTemplate.fromMessages([
          ['system', `You are the strict Order Validation Agent for "Antigravity Chef".
Your role is to construct a premium, highly polite safety notification to the guest explaining active dietary or allergy conflicts discovered in their cart.
Be supportive and offer alternatives rather than just sounding alarmist.

Detected Cart Conflicts:
${issuesText}

Response format MUST be raw JSON:
{{
  "formattedFeedback": "Elegant, polished safety alert text advising alternatives...",
  "isValid": true | false
}}`],
          ['user', 'Generate the final safety feedback.'],
        ]);

        const chain = prompt.pipe(model);
        const response = await chain.invoke({});
        
        let text = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(text);

        return {
          isValid: parsed.isValid !== undefined ? parsed.isValid : isFullyValid,
          issues,
          feedbackMessage: parsed.formattedFeedback || 'Please review items in your cart for matching allergen warnings.'
        };
      } catch (err) {
        console.error('Validation Agent API error, utilizing offline warning:', err);
      }
    }

    // High fidelity offline safety text builder
    let feedbackMessage = 'Your selection looks absolutely perfect and safe to order!';
    
    if (issues.length > 0) {
      const criticals = issues.filter(i => i.severity === 'critical');
      const warnings = issues.filter(i => i.severity === 'warning');

      if (criticals.length > 0) {
        feedbackMessage = `⚠️ **Critical Allergen Alert:** We noticed that you have added **${criticals.map(c => c.itemName).join(', ')}** to your cart, which contains ingredients conflicting with your **${memoryContext.allergies.join(', ')}** allergy. For your safety, our chefs highly recommend removing or replacing these items before confirming your order.`;
      } else if (warnings.length > 0) {
        feedbackMessage = `💡 **Dietary Suggestion:** You expressed a preference for **${memoryContext.preferences.join(', ')}** dining, but your cart currently contains **${warnings.map(w => w.itemName).join(', ')}**. Feel free to replace these with our equivalent vegetarian/vegan specialties!`;
      }
    }

    return {
      isValid: isFullyValid,
      issues,
      feedbackMessage,
    };
  }
}
