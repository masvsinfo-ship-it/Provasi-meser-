
import { GoogleGenAI, Type } from "@google/genai";
import { MessSummary } from "../types.ts";

export class GeminiService {
  private ai: GoogleGenAI | null = null;

  constructor() {
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
      Analyze this Mess (Shared Apartment) credit status and give a VERY FRIENDLY, warm, and helpful advice in BENGALI.
      The mess follows a 100% "Credit at Shop" system. No member pays upfront.
      Total Debt to Shop (Dokaner Baki): SR ${summary.totalSharedExpense.toFixed(2)}
      
      Member Debt Breakdown (What they owe for Shared + Personal items):
      ${summary.memberBalances.map(b => `- ${b.member.name}: Total Debt SR ${Math.abs(b.netBalance).toFixed(2)} (Shared Share: SR ${b.sharedShare.toFixed(2)}, Personal: SR ${b.personalTotal.toFixed(2)})`).join('\n')}
      
      Advice should be in Bengali. Use emojis. Sound like a helpful friend. 
      Specifically mention if someone's "Personal Debt" is significantly high compared to others.
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
      return response.text || "দোকানে বাকি হিসাব একদম ঠিকঠাক আছে। সবাই মিলেমিশে থাকুন! 😊";
    } catch (error) {
      console.error("Gemini Error:", error);
      return "হিসাব তো ঠিক আছে, তবে আপনার AI বন্ধুটি বর্তমানে একটু বিশ্রামে আছে। 👍";
    }
  }
}

export const geminiService = new GeminiService();
