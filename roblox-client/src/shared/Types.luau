local Types = {}

export type AgentState = {
	id: string,
	name: string,
	strategy: number,
	resources: {
		wood: number,
		steel: number,
		energy: number,
		food: number,
	},
	score: number,
	level: number,
	alive: boolean,
}

export type GameState = {
	tick: number,
	agents: { AgentState },
	activeEvents: { string },
}

export type TradeOffer = {
	id: string,
	fromAgentId: string,
	toAgentId: string?,
	offerResource: number,
	offerAmount: number,
	requestResource: number,
	requestAmount: number,
	status: string,
}

export type LeaderboardEntry = {
	rank: number,
	agentId: string,
	agentName: string,
	score: number,
}

export type AgentAction = {
	playerId: string,
	currentAction: string,
	reasoning: string?,
	targetAgentId: string?,
	targetResourceType: number?,
}

return Types
