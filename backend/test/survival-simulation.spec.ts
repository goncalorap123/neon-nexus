/**
 * Survival simulation — tune burn rates + starting resources so agents
 * die within 1-3 cycles without gathering. With gathering, they survive longer
 * but still face pressure. Target: ~50% of agents dead by cycle 3.
 */

// Burn rates per strategy
// Design:
// - Without gathering: Aggressive dies cycle 2, Balanced cycle 2-3, Safe cycle 3-4
// - With smart gathering (80% chance): Aggressive dies cycle 3-4, Balanced 4-6, Safe 5-8
// - Gathering adds to BOTH food and energy (simulating the AI picking the lowest)
// - This means aggressive agents WILL die but not immediately. Games last 4-8 cycles.
const BURN_RATES = {
  0: { food: 25, energy: 20 },    // conservative
  1: { food: 35, energy: 28 },    // balanced
  2: { food: 55, energy: 45 },    // aggressive
};

// Starting resources
const STARTING = { wood: 50, steel: 50, energy: 80, food: 80 };

// Gather amounts match actual backend: gatherBase +/- 5
// Conservative=25, Balanced=20, Aggressive=15
// Agent gathers ONE resource per cycle (the lowest of food/energy)
const GATHER_BY_STRATEGY = { 0: 25, 1: 20, 2: 15 };

// Strategy distribution for 6 agents
const AGENT_STRATEGIES = [0, 0, 1, 1, 2, 2]; // 2 safe, 2 balanced, 2 aggressive

interface AgentSim {
  id: number;
  strategy: number;
  food: number;
  energy: number;
  alive: boolean;
  diedOnCycle: number | null;
}

function simulateRound(gatherChance: number, seed?: number): { deadByCycle: number[]; avgDeathCycle: number; lastDeath: number } {
  let rng = seed ?? Math.random() * 10000;
  const pseudoRandom = () => {
    rng = (rng * 16807 + 0) % 2147483647;
    return (rng % 1000) / 1000;
  };

  const agents: AgentSim[] = AGENT_STRATEGIES.map((s, i) => ({
    id: i,
    strategy: s,
    food: STARTING.food,
    energy: STARTING.energy,
    alive: true,
    diedOnCycle: null,
  }));

  const deadByCycle: number[] = [];
  const maxCycles = 10;

  for (let cycle = 1; cycle <= maxCycles; cycle++) {
    let deathsThisCycle = 0;

    for (const agent of agents) {
      if (!agent.alive) continue;

      const burn = BURN_RATES[agent.strategy as keyof typeof BURN_RATES];

      // Check if agent can pay
      if (agent.food < burn.food || agent.energy < burn.energy) {
        agent.alive = false;
        agent.diedOnCycle = cycle;
        deathsThisCycle++;
        continue;
      }

      // Burn resources
      agent.food -= burn.food;
      agent.energy -= burn.energy;

      // AI gathers — adds to the LOWEST resource only (one resource per cycle)
      if (pseudoRandom() < gatherChance) {
        const base = GATHER_BY_STRATEGY[agent.strategy as keyof typeof GATHER_BY_STRATEGY] ?? 20;
        const variance = Math.floor(pseudoRandom() * 11) - 5;
        const amount = Math.max(10, base + variance);
        // Only gather one resource — the lowest
        if (agent.food <= agent.energy) {
          agent.food += amount;
        } else {
          agent.energy += amount;
        }
      }
    }

    deadByCycle.push(deathsThisCycle);
  }

  const deaths = agents.filter(a => !a.alive);
  const avgDeathCycle = deaths.length > 0 ? deaths.reduce((s, a) => s + (a.diedOnCycle ?? 0), 0) / deaths.length : maxCycles;
  const lastDeath = Math.max(...deaths.map(a => a.diedOnCycle ?? 0), 0);

  return { deadByCycle, avgDeathCycle, lastDeath };
}

describe('Survival Simulation', () => {
  it('should kill ~50% of agents by cycle 3 with no gathering', () => {
    const runs = 100;
    let totalDeadBy3 = 0;
    let totalDeadBy5 = 0;

    for (let i = 0; i < runs; i++) {
      const result = simulateRound(0, i * 137); // no gathering
      const cumDeaths = result.deadByCycle.reduce((acc, d, idx) => {
        acc.push((acc[idx - 1] ?? 0) + d);
        return acc;
      }, [] as number[]);
      totalDeadBy3 += cumDeaths[2] ?? 0; // by cycle 3
      totalDeadBy5 += cumDeaths[4] ?? 0; // by cycle 5
    }

    const avgDeadBy3 = totalDeadBy3 / runs;
    const avgDeadBy5 = totalDeadBy5 / runs;

    console.log(`No gathering: avg dead by cycle 3 = ${avgDeadBy3.toFixed(1)} / 6, by cycle 5 = ${avgDeadBy5.toFixed(1)} / 6`);

    // At least 2 agents dead by cycle 3 without gathering
    expect(avgDeadBy3).toBeGreaterThanOrEqual(2);
    // At least 4 dead by cycle 5
    expect(avgDeadBy5).toBeGreaterThanOrEqual(4);
  });

  it('should still kill agents even with 80% gather chance (realistic AI)', () => {
    const runs = 100;
    let totalDeadBy5 = 0;
    let totalSurvivors = 0;

    for (let i = 0; i < runs; i++) {
      const result = simulateRound(0.8, i * 251);
      const cumDeaths = result.deadByCycle.reduce((acc, d, idx) => {
        acc.push((acc[idx - 1] ?? 0) + d);
        return acc;
      }, [] as number[]);
      totalDeadBy5 += cumDeaths[4] ?? 0;
      totalSurvivors += 6 - (cumDeaths[9] ?? 0);
    }

    const avgDeadBy5 = totalDeadBy5 / runs;
    const avgSurvivors = totalSurvivors / runs;

    console.log(`50% gather: avg dead by cycle 5 = ${avgDeadBy5.toFixed(1)} / 6, avg survivors at cycle 10 = ${avgSurvivors.toFixed(1)}`);

    // With gathering, at least 1 agent should die by cycle 5
    expect(avgDeadBy5).toBeGreaterThanOrEqual(1);
    // Should have 1-2 survivors at end (game resolves, but gathering extends life)
    expect(avgSurvivors).toBeLessThanOrEqual(4);
  });

  it('aggressive agents should die first', () => {
    const runs = 200;
    const deathOrder: number[][] = []; // strategy of each death

    for (let i = 0; i < runs; i++) {
      const result = simulateRound(0.3, i * 53);
      // Track which strategy dies in cycle 1-2
      // Re-run to get agent details
      let rng = i * 53;
      const pseudoRandom = () => {
        rng = (rng * 16807 + 0) % 2147483647;
        return (rng % 1000) / 1000;
      };
      const agents = AGENT_STRATEGIES.map((s, idx) => ({
        strategy: s, food: STARTING.food, energy: STARTING.energy, alive: true, diedOnCycle: 0,
      }));

      for (let c = 1; c <= 5; c++) {
        for (const a of agents) {
          if (!a.alive) continue;
          const burn = BURN_RATES[a.strategy as keyof typeof BURN_RATES];
          if (a.food < burn.food || a.energy < burn.energy) {
            a.alive = false;
            a.diedOnCycle = c;
            continue;
          }
          a.food -= burn.food;
          a.energy -= burn.energy;
          if (pseudoRandom() < 0.3) {
            const base2 = GATHER_BY_STRATEGY[a.strategy as keyof typeof GATHER_BY_STRATEGY] ?? 20;
            const var2 = Math.floor(pseudoRandom() * 11) - 5;
            const amt2 = Math.max(10, base2 + var2);
            if (a.food <= a.energy) a.food += amt2; else a.energy += amt2;
          }
        }
      }

      const earlyDeaths = agents.filter(a => a.diedOnCycle > 0 && a.diedOnCycle <= 2);
      deathOrder.push(earlyDeaths.map(a => a.strategy));
    }

    // Count how often each strategy dies in cycles 1-2
    const earlyCounts = { 0: 0, 1: 0, 2: 0 };
    for (const deaths of deathOrder) {
      for (const s of deaths) {
        earlyCounts[s as keyof typeof earlyCounts]++;
      }
    }

    console.log(`Early deaths (cycle 1-2): Safe=${earlyCounts[0]}, Balanced=${earlyCounts[1]}, Aggressive=${earlyCounts[2]}`);

    // Aggressive should die more than safe
    expect(earlyCounts[2]).toBeGreaterThan(earlyCounts[0]);
  });

  it('print full sample games at different gather rates', () => {
    for (const rate of [0, 0.5, 0.8, 1.0]) {
      console.log(`\n--- GAME (gather=${rate * 100}%) ---`);
      const result = simulateRound(rate, 42);
      let cumDead = 0;
      for (let c = 0; c < result.deadByCycle.length; c++) {
        cumDead += result.deadByCycle[c];
        const alive = 6 - cumDead;
        const deathStr = result.deadByCycle[c] > 0 ? ` (${result.deadByCycle[c]} eliminated!)` : '';
        console.log(`  Cycle ${c + 1}: ${alive} alive${deathStr}`);
        if (alive <= 1) {
          console.log(`  GAME OVER at cycle ${c + 1}`);
          break;
        }
      }
    }
  });

  it('run 500 games at 80% gather and report distribution', () => {
    const runs = 500;
    const gameEndCycles: number[] = [];

    for (let i = 0; i < runs; i++) {
      const result = simulateRound(0.8, i * 71);
      let cumDead = 0;
      for (let c = 0; c < result.deadByCycle.length; c++) {
        cumDead += result.deadByCycle[c];
        if (6 - cumDead <= 1) {
          gameEndCycles.push(c + 1);
          break;
        }
      }
      if (6 - cumDead > 1) gameEndCycles.push(10); // didn't finish
    }

    const avg = gameEndCycles.reduce((a, b) => a + b, 0) / gameEndCycles.length;
    const min = Math.min(...gameEndCycles);
    const max = Math.max(...gameEndCycles);

    // Distribution
    const dist: Record<number, number> = {};
    for (const c of gameEndCycles) {
      dist[c] = (dist[c] || 0) + 1;
    }

    console.log(`\n--- 500 GAMES @ 80% gather ---`);
    console.log(`Game length: avg=${avg.toFixed(1)} min=${min} max=${max}`);
    for (let c = 1; c <= 10; c++) {
      if (dist[c]) {
        const bar = '#'.repeat(Math.round(dist[c] / 5));
        console.log(`  Cycle ${c}: ${dist[c]} games (${(dist[c] / runs * 100).toFixed(0)}%) ${bar}`);
      }
    }

    // Games should end between cycle 3-7 mostly
    expect(avg).toBeGreaterThanOrEqual(3);
    expect(avg).toBeLessThanOrEqual(7);
  });
});
