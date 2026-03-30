import { Injectable, Logger } from '@nestjs/common';
import Groq from 'groq-sdk';
import { getEnvConfig } from '../config/env.config';

export interface AgentDecisionContext {
  agentId: string;
  strategy: string;
  strategyType: number;
  resources: { wood: number; steel: number; energy: number; food: number };
  deposit: number;
  yieldEarned: number;
  flowBalance: string;
  score: number;
  leaderboardPosition: number;
  totalAgents: number;
  activeTradeOffers: Array<{
    resourceType: number;
    resourceName: string;
    quantity: string;
    pricePerUnit: string;
    sellerAddress: string;
  }>;
  recentHistory: string[];
  // Survival fields
  foodBurnRate: number;
  energyBurnRate: number;
  cyclesOfFoodLeft: number;
  cyclesOfEnergyLeft: number;
  aliveAgentCount: number;
  cyclesSurvived: number;
}

export interface AgentDecision {
  action: 'gather' | 'trade' | 'change_strategy' | 'trigger_event' | 'idle';
  details: {
    resourceToGather?: number;
    newStrategy?: number;
    eventType?: number;
    tradeAction?: 'create_offer' | 'accept_offer';
    tradeResourceType?: number;
    tradeQuantity?: number;
    tradePricePerUnit?: number;
    tradeOfferId?: number;
  };
  reasoning: string;
}

const STRATEGY_NAMES = ['Conservative', 'Balanced', 'Aggressive'];
const RESOURCE_NAMES = ['wood', 'steel', 'energy', 'food'];

@Injectable()
export class AiReasoningService {
  private readonly logger = new Logger(AiReasoningService.name);
  private groq: Groq | null = null;

  constructor() {
    const apiKey = getEnvConfig().GROQ_API_KEY;
    if (apiKey) {
      this.groq = new Groq({ apiKey });
      this.logger.log('Groq AI client initialized');
    } else {
      this.logger.warn('GROQ_API_KEY not set, using fallback deterministic decisions');
    }
  }

  async decideAgentAction(context: AgentDecisionContext): Promise<AgentDecision> {
    if (!this.groq) {
      return this.buildFallbackDecision(context);
    }

    try {
      const systemPrompt =
        'You are an AI fund manager in Neon Nexus, a DeFi survival game. ' +
        'You burn food + energy each cycle as operational costs. If either hits 0, you get LIQUIDATED.\n\n' +
        'Resources: wood=0, steel=1, energy=2, food=3. Food and energy are critical for survival.\n' +
        'SURVIVAL PRIORITY: If food or energy < 5 cycles left, gather that resource or trade for it.\n\n' +
        'Respond with JSON: { "action", "details", "reasoning" }\n' +
        'Actions: gather, trade, change_strategy, trigger_event, idle\n' +
        'Details by action:\n' +
        '- gather: { "resourceToGather": 0-3 }\n' +
        '- trade: { "tradeAction": "create_offer"|"accept_offer", "tradeResourceType": 0-3, "tradeQuantity": N, "tradePricePerUnit": N, "tradeOfferId": N (accept only) }\n' +
        '- change_strategy: { "newStrategy": 0=Conservative|1=Balanced|2=Aggressive }\n' +
        '- trigger_event: { "eventType": 0-3 }\n' +
        '- idle: {}\n\n' +
        'CRITICAL: "reasoning" must be under 60 characters. Write like a game NPC status line. ' +
        'Examples: "Low on food, foraging urgently", "Selling surplus wood", "Switching to conservative to cut costs".\n' +
        'Do NOT explain your logic. Just state what you are doing in a few words.';

      const userPrompt =
        `Agent Status:\n` +
        `- Strategy: ${context.strategy} (type ${context.strategyType})\n` +
        `- Resources: wood=${context.resources.wood}, steel=${context.resources.steel}, energy=${context.resources.energy}, food=${context.resources.food}\n` +
        `- Deposit: ${context.deposit}\n` +
        `- Yield Earned: ${context.yieldEarned}\n` +
        `- FLOW Balance: ${context.flowBalance}\n` +
        `- Score: ${context.score}\n` +
        `- Leaderboard Position: ${context.leaderboardPosition} of ${context.totalAgents}\n` +
        `\nSURVIVAL:\n` +
        `- Food burn: ${context.foodBurnRate}/cycle → ${context.cyclesOfFoodLeft} cycles left\n` +
        `- Energy burn: ${context.energyBurnRate}/cycle → ${context.cyclesOfEnergyLeft} cycles left\n` +
        `- Alive agents: ${context.aliveAgentCount} | Cycles survived: ${context.cyclesSurvived}\n` +
        `\nActive Trade Offers on Market:\n` +
        (context.activeTradeOffers.length > 0
          ? context.activeTradeOffers
              .map(
                (o) =>
                  `  - ${o.resourceName} x${o.quantity} at ${o.pricePerUnit}/unit (seller: ${o.sellerAddress})`,
              )
              .join('\n')
          : '  (none)') +
        `\n\nRecent Actions:\n` +
        (context.recentHistory.length > 0
          ? context.recentHistory.map((h) => `  - ${h}`).join('\n')
          : '  (none)') +
        `\n\nWhat action should you take next?`;

      const response = await this.groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 150,
      });

      const content = response.choices?.[0]?.message?.content;
      if (!content) {
        this.logger.warn('Empty AI response, falling back to deterministic');
        return this.buildFallbackDecision(context);
      }

      const parsed = JSON.parse(content);
      const validActions = ['gather', 'trade', 'change_strategy', 'trigger_event', 'idle'];
      if (!validActions.includes(parsed.action)) {
        this.logger.warn(`Invalid AI action "${parsed.action}", falling back`);
        return this.buildFallbackDecision(context);
      }

      // Hard cap reasoning to 60 chars — LLMs sometimes ignore length instructions
      let reasoning: string = parsed.reasoning || 'AI decision';
      if (reasoning.length > 60) {
        reasoning = reasoning.substring(0, 57) + '...';
      }

      return {
        action: parsed.action,
        details: parsed.details || {},
        reasoning,
      };
    } catch (error) {
      this.logger.warn(`AI decision failed: ${error.message}, using fallback`);
      return this.buildFallbackDecision(context);
    }
  }

  private buildFallbackDecision(context: AgentDecisionContext): AgentDecision {
    const { resources } = context;
    const resourceValues = [resources.wood, resources.steel, resources.energy, resources.food];

    // SURVIVAL PRIORITY 1: food critically low (< 5 cycles)
    const foodBurn = context.foodBurnRate || 3;
    const energyBurn = context.energyBurnRate || 2;
    const cyclesOfFood = foodBurn > 0 ? Math.floor(resources.food / foodBurn) : 999;
    const cyclesOfEnergy = energyBurn > 0 ? Math.floor(resources.energy / energyBurn) : 999;

    if (cyclesOfFood < 5) {
      // If we have surplus wood or steel, try trading for food
      if (resources.wood > 20 || resources.steel > 20) {
        const sellType = resources.wood > resources.steel ? 0 : 1;
        const sellAmount = Math.min(resourceValues[sellType], 20);
        return {
          action: 'trade',
          details: {
            tradeAction: 'create_offer',
            tradeResourceType: sellType,
            tradeQuantity: sellAmount,
            tradePricePerUnit: 1,
          },
          reasoning: `Selling ${RESOURCE_NAMES[sellType]} to buy food`,
        };
      }
      return {
        action: 'gather',
        details: { resourceToGather: 3 },
        reasoning: 'Food critical, foraging urgently',
      };
    }

    // SURVIVAL PRIORITY 2: energy critically low (< 5 cycles)
    if (cyclesOfEnergy < 5) {
      if (resources.wood > 20 || resources.steel > 20) {
        const sellType = resources.wood > resources.steel ? 0 : 1;
        const sellAmount = Math.min(resourceValues[sellType], 20);
        return {
          action: 'trade',
          details: {
            tradeAction: 'create_offer',
            tradeResourceType: sellType,
            tradeQuantity: sellAmount,
            tradePricePerUnit: 1,
          },
          reasoning: `Selling ${RESOURCE_NAMES[sellType]} to buy energy`,
        };
      }
      return {
        action: 'gather',
        details: { resourceToGather: 2 },
        reasoning: 'Energy critical, gathering urgently',
      };
    }

    // If any resource is low, gather it
    const minResource = Math.min(...resourceValues);
    if (minResource < 50) {
      const lowestIndex = resourceValues.indexOf(minResource);
      return {
        action: 'gather',
        details: { resourceToGather: lowestIndex },
        reasoning: `Low on ${RESOURCE_NAMES[lowestIndex]}, gathering more`,
      };
    }

    // If any resource > 200, sell surplus
    for (let i = 0; i < 4; i++) {
      if (resourceValues[i] > 200) {
        const sellAmount = resourceValues[i] - 100;
        return {
          action: 'trade',
          details: {
            tradeAction: 'create_offer',
            tradeResourceType: i,
            tradeQuantity: sellAmount,
            tradePricePerUnit: 1,
          },
          reasoning: `Selling surplus ${RESOURCE_NAMES[i]}`,
        };
      }
    }

    // Otherwise idle
    return {
      action: 'idle',
      details: {},
      reasoning: 'Resources balanced, holding',
    };
  }
}
