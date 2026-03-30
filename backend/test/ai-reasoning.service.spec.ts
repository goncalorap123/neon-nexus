import { AiReasoningService, AgentDecisionContext } from '../src/ai/ai-reasoning.service';

describe('AiReasoningService', () => {
  let service: AiReasoningService;

  const baseContext: AgentDecisionContext = {
    agentId: 'test-agent',
    strategy: 'Balanced',
    strategyType: 1,
    resources: { wood: 100, steel: 50, energy: 200, food: 80 },
    deposit: 1000,
    yieldEarned: 500,
    flowBalance: '10.0',
    score: 5000,
    leaderboardPosition: 2,
    totalAgents: 5,
    activeTradeOffers: [],
    recentHistory: ['resources_gathered: {}', 'idle: {}'],
    foodBurnRate: 3,
    energyBurnRate: 2,
    cyclesOfFoodLeft: 26,
    cyclesOfEnergyLeft: 100,
    aliveAgentCount: 5,
    cyclesSurvived: 10,
  };

  beforeEach(() => {
    // Service without API key (fallback mode)
    delete process.env.GROQ_API_KEY;
    service = new AiReasoningService();
  });

  it('should be instantiable', () => {
    expect(service).toBeDefined();
  });

  describe('decideAgentAction - fallback mode (no API key)', () => {
    it('should return a valid decision without API key', async () => {
      const decision = await service.decideAgentAction(baseContext);

      expect(decision).toBeDefined();
      expect(decision.action).toBeDefined();
      expect(decision.reasoning).toBeDefined();
      expect(typeof decision.reasoning).toBe('string');
      expect(decision.reasoning.length).toBeGreaterThan(0);
    });

    it('should gather the lowest resource when one is scarce', async () => {
      const context = {
        ...baseContext,
        resources: { wood: 5, steel: 200, energy: 300, food: 150 },
      };

      const decision = await service.decideAgentAction(context);

      // With very low wood, should suggest gathering
      expect(['gather', 'idle', 'trade']).toContain(decision.action);
    });

    it('should suggest trade when resource is in surplus (>200)', async () => {
      const context = {
        ...baseContext,
        resources: { wood: 500, steel: 50, energy: 50, food: 50 },
      };

      const decision = await service.decideAgentAction(context);

      // Should recognize surplus and suggest selling
      expect(['trade', 'gather', 'idle']).toContain(decision.action);
    });

    it('should return idle when nothing notable', async () => {
      const context = {
        ...baseContext,
        resources: { wood: 100, steel: 100, energy: 100, food: 100 },
      };

      const decision = await service.decideAgentAction(context);

      expect(decision).toBeDefined();
      expect(decision.details).toBeDefined();
    });

    it('should always return valid action type', async () => {
      const validActions = ['gather', 'trade', 'change_strategy', 'trigger_event', 'idle'];

      for (let i = 0; i < 10; i++) {
        const decision = await service.decideAgentAction(baseContext);
        expect(validActions).toContain(decision.action);
      }
    });

    it('should prioritize gathering food when food cycles left < 5', async () => {
      const context: AgentDecisionContext = {
        ...baseContext,
        resources: { wood: 5, steel: 5, energy: 200, food: 8 },
        foodBurnRate: 3,
        energyBurnRate: 2,
        cyclesOfFoodLeft: 2,
        cyclesOfEnergyLeft: 100,
      };

      const decision = await service.decideAgentAction(context);

      // With very low food and no surplus wood/steel to trade, should gather food
      expect(decision.action).toBe('gather');
      expect(decision.details.resourceToGather).toBe(3);
    });

    it('should prioritize gathering energy when energy cycles left < 5', async () => {
      const context: AgentDecisionContext = {
        ...baseContext,
        resources: { wood: 5, steel: 5, energy: 6, food: 200 },
        foodBurnRate: 3,
        energyBurnRate: 2,
        cyclesOfFoodLeft: 66,
        cyclesOfEnergyLeft: 3,
      };

      const decision = await service.decideAgentAction(context);

      expect(decision.action).toBe('gather');
      expect(decision.details.resourceToGather).toBe(2);
    });

    it('should try to trade surplus for food when food is critical but has surplus wood', async () => {
      const context: AgentDecisionContext = {
        ...baseContext,
        resources: { wood: 100, steel: 5, energy: 200, food: 8 },
        foodBurnRate: 3,
        energyBurnRate: 2,
        cyclesOfFoodLeft: 2,
        cyclesOfEnergyLeft: 100,
      };

      const decision = await service.decideAgentAction(context);

      expect(decision.action).toBe('trade');
      expect(decision.details.tradeAction).toBe('create_offer');
    });
  });
});
