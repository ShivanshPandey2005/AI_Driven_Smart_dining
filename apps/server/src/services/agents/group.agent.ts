import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { PrismaClient } from '../../generated/client';

const prisma = new PrismaClient();

export interface GroupContext {
  activeDinersCount: number;
  dinerPreferencesSummary: string;
  isGroupSession: boolean;
}

export class GroupCoordinatorAgent {
  /**
   * Analyzes and coordinates requests in multi-diner environments.
   */
  public static async coordinate(
    sessionId: string,
    message: string,
    model: ChatOpenAI | null
  ): Promise<GroupContext> {
    let activeDinersCount = 1;
    let isGroupSession = false;

    try {
      // Find out if there are other cart items or order interactions from other users.
      // We can also query cart items to see if there are multiple guest names or guest IDs in notes
      const cartItems = await prisma.cartItem.findMany({
        where: { sessionId },
      });

      // Extract unique guestIds or names from the cart items notes (e.g., "[Rahul] - no onions")
      const uniqueGuestNames = new Set<string>();
      cartItems.forEach(item => {
        if (item.notes) {
          const match = item.notes.match(/^\[(.*?)\]/);
          if (match && match[1]) {
            uniqueGuestNames.add(match[1]);
          }
        }
      });

      if (uniqueGuestNames.size > 0) {
        activeDinersCount = Math.max(activeDinersCount, uniqueGuestNames.size);
      }

      // Check if session has multiple users
      if (activeDinersCount > 1) {
        isGroupSession = true;
      }
    } catch (e) {
      console.warn('Error reading multi-diner info from DB:', e);
    }

    if (model && isGroupSession) {
      try {
        const prompt = ChatPromptTemplate.fromMessages([
          ['system', `You are the Group Coordinator Agent for an interactive dining table.
Analyze the user message to understand collaborative dining instructions (e.g. "we want to share...", "some of us are vegetarian...", "Rahul wants...", "split the bill...").
Determine how many diners are in the group and write a brief summary of the group's collective cravings, preferences, and conflicts.

Current Est. Diners: {activeDinersCount}

Response format MUST be raw JSON:
{
  "activeDinersCount": number,
  "dinerPreferencesSummary": "Brief culinary harmony summary (e.g., 'Group has mixed preferences: 2 vegetarians looking for medium spice, and 1 non-vegetarian craving spicy chicken. Peanut allergy present.')"
}`],
          ['user', '{message}'],
        ]);

        const chain = prompt.pipe(model);
        const response = await chain.invoke({
          activeDinersCount,
          message,
        });

        let text = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(text);

        return {
          activeDinersCount: parsed.activeDinersCount || activeDinersCount,
          dinerPreferencesSummary: parsed.dinerPreferencesSummary || 'Coordinating shared dining group.',
          isGroupSession: true,
        };
      } catch (err) {
        console.error('Group Agent API Error, using fallback:', err);
      }
    }

    // High fidelity offline fallback
    return this.fallbackCoordination(message, activeDinersCount, isGroupSession);
  }

  private static fallbackCoordination(
    message: string,
    activeDinersCount: number,
    isGroupSession: boolean
  ): GroupContext {
    const lower = message.toLowerCase();
    let updatedDinersCount = activeDinersCount;
    let summary = 'Solo dining session.';

    // Check if group markers are present in the message
    const groupPronouns = ['we ', 'us', 'our', 'everyone', 'both of us', 'group', 'all of us', 'friends'];
    const containsGroupMarker = groupPronouns.some(p => lower.includes(p));

    if (containsGroupMarker || isGroupSession) {
      isGroupSession = true;
      if (updatedDinersCount <= 1) {
        updatedDinersCount = 2; // Assume at least 2 people if "we" is used
      }

      if (lower.includes('both')) {
        updatedDinersCount = 2;
      } else if (lower.includes('three') || lower.includes('3 of us')) {
        updatedDinersCount = 3;
      } else if (lower.includes('four') || lower.includes('4 of us')) {
        updatedDinersCount = 4;
      }

      // Group preferences matching
      let preferences = [];
      if (lower.includes('veg') && (lower.includes('chicken') || lower.includes('meat') || lower.includes('nonveg'))) {
        preferences.push('mixed dietary preferences (veg & non-veg)');
      }
      if (lower.includes('share') || lower.includes('platters') || lower.includes('portions')) {
        preferences.push('prefers sharing portions / platters');
      }
      if (lower.includes('spicy') && lower.includes('mild')) {
        preferences.push('conflicting spice preferences (mild & spicy)');
      }

      summary = `Group of ${updatedDinersCount} diners with ` + 
        (preferences.length > 0 ? preferences.join(', ') : 'shared culinary interests') + '.';
    }

    return {
      activeDinersCount: updatedDinersCount,
      dinerPreferencesSummary: summary,
      isGroupSession,
    };
  }
}
