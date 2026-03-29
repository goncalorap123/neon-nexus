local HttpBridge = require(script.Parent:WaitForChild("HttpBridge"))

local UPDATE_INTERVAL = 30 -- seconds between updates

print("[AgentSimulator] Starting agent simulation loop...")

-- TODO: Create a folder in Workspace to hold NPC models
-- local agentModels = Instance.new("Folder")
-- agentModels.Name = "AgentNPCs"
-- agentModels.Parent = workspace

-- TODO: Create or load NPC model template
-- local npcTemplate = game:GetService("ServerStorage"):WaitForChild("NPCTemplate")

-- Track known agents and their corresponding 3D models
local agentModels: { [string]: any } = {}

-- TODO: Spawn a 3D NPC model for an agent
local function spawnAgentModel(_agentData: any)
	-- Placeholder: In production, clone an NPC template and position it in the world
	-- local model = npcTemplate:Clone()
	-- model.Name = agentData.name or agentData.id
	-- model:PivotTo(CFrame.new(math.random(-50, 50), 3, math.random(-50, 50)))
	-- model.Parent = agentModels
	-- return model
end

-- TODO: Update an existing NPC model based on agent state
local function updateAgentModel(_model: any, _agentData: any)
	-- Placeholder: Update position, animations, nametag, etc.
	-- For example, move agent toward a resource based on their strategy
	-- Update overhead GUI with agent name and score
end

-- Main simulation loop
while true do
	local success, gameState = HttpBridge.getGameState()

	if success and gameState then
		local agents = gameState.agents
		if agents then
			for _, agent in ipairs(agents) do
				local agentId = agent.id or "unknown"

				-- Log agent info for debugging
				print(string.format(
					"[AgentSimulator] Agent: %s | Strategy: %d | Score: %d | Alive: %s",
					agent.name or agentId,
					agent.strategy or -1,
					agent.score or 0,
					tostring(agent.alive)
				))

				-- TODO: Create model if new agent, update if existing
				if not agentModels[agentId] then
					local model = spawnAgentModel(agent)
					if model then
						agentModels[agentId] = model
					end
				else
					updateAgentModel(agentModels[agentId], agent)
				end

				-- TODO: Remove models for dead agents
				if agent.alive == false and agentModels[agentId] then
					-- agentModels[agentId]:Destroy()
					-- agentModels[agentId] = nil
				end
			end
		end
	else
		warn("[AgentSimulator] Failed to fetch game state")
	end

	task.wait(UPDATE_INTERVAL)
end
