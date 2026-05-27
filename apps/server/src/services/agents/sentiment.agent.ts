import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';

export interface SentimentResult {
  sentiment: 'Delighted' | 'Neutral' | 'Confused' | 'Frustrated';
  requiresStaffIntervention: boolean;
  explanation: string;
}

export class SentimentAgent {
  /**
   * Analyzes the customer's input to assess sentiment and determine if human intervention is needed.
   */
  public static async analyze(
    input: string,
    model: ChatOpenAI | null
  ): Promise<SentimentResult> {
    const cleanInput = input.trim();
    if (!cleanInput) {
      return { sentiment: 'Neutral', requiresStaffIntervention: false, explanation: 'Empty message' };
    }

    if (model) {
      try {
        const prompt = ChatPromptTemplate.fromMessages([
          ['system', `You are the Sentiment Analysis Agent for a premium smart dining platform.
Analyze the user's input to detect their current emotional state:
- "Delighted": Happy, excited, praising the food/service.
- "Neutral": Seeking information, ordering standard dishes.
- "Confused": Questioning how the app works, asking conflicting questions.
- "Frustrated": Annoyed, angry, complaining about delay, errors, or service.

If the user is highly "Frustrated" or repeatedly "Confused", set "requiresStaffIntervention" to true so a server can be dispatched to their physical table.

Response format MUST be raw JSON:
{
  "sentiment": "Delighted" | "Neutral" | "Confused" | "Frustrated",
  "requiresStaffIntervention": true | false,
  "explanation": "Brief explanation of the emotional assessment"
}`],
          ['user', '{input}'],
        ]);

        const chain = prompt.pipe(model);
        const response = await chain.invoke({ input: cleanInput });
        
        let text = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(text);

        return {
          sentiment: parsed.sentiment || 'Neutral',
          requiresStaffIntervention: !!parsed.requiresStaffIntervention,
          explanation: parsed.explanation || '',
        };
      } catch (err) {
        console.error('Sentiment Agent API Error, using fallback:', err);
      }
    }

    // High fidelity offline fallback
    return this.fallbackSentiment(cleanInput);
  }

  private static fallbackSentiment(input: string): SentimentResult {
    const lower = input.toLowerCase();

    // Frustration keywords
    const frustrationKeywords = [
      'late', 'slow', 'delay', 'wait', 'worst', 'bad', 'horrible', 'useless', 'garbage', 'crap',
      'error', 'broken', 'not working', 'stuck', 'taking long', 'angry', 'irritated', 'call waiter',
      'waste', 'waiting for', 'annoying', 'hate'
    ];

    // Confusion keywords
    const confusionKeywords = [
      'how to', 'where is', 'dont know', 'not sure', 'confused', 'help me', 'what is this',
      'can you explain', 'conflict', 'meaning', 'how do i', 'stuck'
    ];

    // Delight keywords
    const delightKeywords = [
      'love', 'great', 'awesome', 'amazing', 'delicious', 'yummy', 'fantastic', 'wonderful',
      'excellent', 'wow', 'good service', 'perfect', 'best food', 'happy'
    ];

    let sentiment: 'Delighted' | 'Neutral' | 'Confused' | 'Frustrated' = 'Neutral';
    let requiresStaffIntervention = false;
    let explanation = 'Evaluated using heuristic emotional keyword matching.';

    const frustratedMatch = frustrationKeywords.some(kw => lower.includes(kw));
    const confusedMatch = confusionKeywords.some(kw => lower.includes(kw));
    const delightedMatch = delightKeywords.some(kw => lower.includes(kw));

    if (frustratedMatch) {
      sentiment = 'Frustrated';
      requiresStaffIntervention = true;
      explanation = 'Frustrated keywords detected in the user message. Recommended prompt waiter dispatch.';
    } else if (confusedMatch) {
      sentiment = 'Confused';
      // If they are highly confused, maybe flag staff, but keep it false unless they ask explicitly
      if (lower.includes('stuck') || lower.includes('help me')) {
        requiresStaffIntervention = true;
      }
      explanation = 'User appears confused about menus, sessions, or procedures.';
    } else if (delightedMatch) {
      sentiment = 'Delighted';
      explanation = 'Positive sentiment markers found in text.';
    }

    return {
      sentiment,
      requiresStaffIntervention,
      explanation,
    };
  }
}
