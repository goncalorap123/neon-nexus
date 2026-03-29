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
        'You are an AI agent playing a blockchain strategy game called Neon Nexus. ' +
        'You manage resources (wood, steel, energy, food) and compete on a leaderboard. ' +
        'Your goal is to maximize your score. ' +
        'Respond with a JSON object containing: ' +
        'action (one of: gather, trade, change_strategy, trigger_event, idle), ' +
        'details (action-specific parameters), ' +
        'and reasoning (1-2 sentence explanation). ' +
        'For gather: include resourceToGather (0=wood, 1=steel, 2=energy, 3=food). ' +
        'For trade: include tradeAction ("create_offer" or "accept_offer"), tradeResourceType (0-3), tradeQuantity, tradePricePerUnit, and optionally tradeOfferId for accept_offer. ' +
        'For change_strategy: include newStrategy (0=Conservative, 1=Balanced, 2=Aggressive). ' +
        'For trigger_event: include eventType (0-3). ' +
        'For idle: no details needed.';

      const userPrompt =
        `Agent Status:\n` +
        `- Strategy: ${context.strategy} (type ${context.strategyType})\n` +
        `- Resources: wood=${context.resources.wood}, steel=${context.resources.steel}, energy=${context.resources.energy}, food=${context.resources.food}\n` +
        `- Deposit: ${context.deposit}\n` +
        `- Yield Earned: ${context.yieldEarned}\n` +
        `- FLOW Balance: ${context.flowBalance}\n` +
        `- Score: ${context.score}\n` +
        `- Leaderboard Position: ${context.leaderboardPosition} of ${context.totalAgents}\n` +
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
        max_tokens: 300,
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

      return {
        action: parsed.action,
        details: parsed.details || {},
        reasoning: parsed.reasoning || 'AI decision',
      };
    } catch (error) {
      this.logger.warn(`AI decision failed: ${error.message}, using fallback`);
      return this.buildFallbackDecision(context);
    }
  }

  private buildFallbackDecision(context: AgentDecisionContext): AgentDecision {
    const { resources } = context;
    const resourceValues = [resources.wood, resources.steel, resources.energy, resources.food];

    // If any resource is very low, gather the lowest
    const minResource = Math.min(...resourceValues);
    if (minResource < 50) {
      const lowestIndex = resourceValues.indexOf(minResource);
      return {
        action: 'gather',
        details: { resourceToGather: lowestIndex },
        reasoning: `${RESOURCE_NAMES[lowestIndex]} is critically low (${minResource}), gathering more`,
      };
    }

    // If any resource > 200, create a trade offer to sell surplus
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
          reasoning: `Surplus ${RESOURCE_NAMES[i]} detected (${resourceValues[i]} > 200), listing ${sellAmount} for sale`,
        };
      }
    }

    // Otherwise idle
    return {
      action: 'idle',
      details: {},
      reasoning: 'Resources are balanced, no immediate action needed',
    };
  }
}
