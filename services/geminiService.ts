
import { GoogleGenAI, Type } from "@google/genai";
import { MessSummary } from "../types.ts";

export class GeminiService {
  private ai: GoogleGenAI | null = null;

  constructor() {
    // Vercel handles environment variables via the dashboard.
    // Safe check for process to avoid ReferenceError in browser
    const apiKey = typeof process !== 'undefined' ? process.env.API_KEY : undefined;
    if (apiKey) {
      this.ai = new GoogleGenAI({ apiKey });
    }
  }

  async getSmartInsight(summary: MessSummary) {
    if (!this.ai) {
      return "AI পরামর্শ সচল করতে Vercel Dashboard-এ গিয়ে Environment Variable হিসেবে 'API_KEY' যুক্ত করুন। (বিল্লাল জামালপুর)";
    }

    const prompt = `
      Analyze this Mess (Shared Apartment) financial status and give a VERY FRIENDLY, warm, and helpful advice in BENGALI.
      The mess follows a "Total Bill" system (No advance pool).
      Total Mess Market Expense: SR ${summary.totalSharedExpense.toFixed(2)}
      Each member's shared share: SR ${summary.averagePerPerson.toFixed(2)}
      
      Member Total Costs (Shared Share + Personal items):
      ${summary.memberBalances.map(b => `- ${b.member.name}: Total SR ${b.netBalance.toFixed(2)} (Personal was SR ${b.personalTotal.toFixed(2)})`).join('\n')}
      
      Advice should be in Bengali. Use emojis. Sound like a helpful friend. Mention if someone is spending too much on personal things or if the mess budget is doing great.
      Keep it 1-2 sentences. Use warm greetings like "আসসালামু আলাইকুম" or "কেমন আছেন সবাই?".
    `;

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          thinkingConfig: { thinkingBudget: 0 }
        }
      });
      return response.text || "আপনার মেছের হিসাব একদম ঠিকঠাক আছে। সবাই মিলেমিশে থাকুন! 😊";
    } catch (error) {
      console.error("Gemini Error:", error);
      return "হিসাব তো ঠিক আছে, তবে আপনার AI বন্ধুটি বর্তমানে একটু বিশ্রামে আছে। পরে ট্রাই করুন। 👍";
    }
  }
}

export const geminiService = new GeminiService();