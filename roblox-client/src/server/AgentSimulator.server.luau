local HttpBridge = require(script.Parent:WaitForChild("HttpBridge"))

local UPDATE_INTERVAL = 15 -- seconds between updates
local SPAWN_RANGE = 80 -- NPCs spawn within -80 to 80 on X/Z
local GROUND_Y = 3 -- Y position for NPCs
local WANDER_RANGE = 12 -- how far NPCs wander each update
local MOVE_SPEED = 0.05 -- lerp factor for smooth movement

print("[AgentSimulator] Starting agent simulation loop...")

-- Create a folder in Workspace to hold NPC models
local agentFolder = Instance.new("Folder")
agentFolder.Name = "AgentNPCs"
agentFolder.Parent = workspace

-- Track known agents and their corresponding 3D models
local agentModels: { [string]: Model } = {}

-- Strategy color mapping
local strategyColors = {
	[0] = Color3.fromRGB(40, 180, 60),   -- Conservative: green
	[1] = Color3.fromRGB(220, 200, 40),  -- Balanced: yellow
	[2] = Color3.fromRGB(210, 50, 50),   -- Aggressive: red
}

local strategyNames = {
	[0] = "Conservative",
	[1] = "Balanced",
	[2] = "Aggressive",
}

-- Target positions for NPC wandering
local wanderTargets: { [string]: Vector3 } = {}

-- Build a simple humanoid NPC model from Parts
local function createNPCModel(agentData: any): Model
	local name = agentData.name or agentData.id or "Agent"
	local strategy = agentData.strategy or 1
	local score = agentData.score or 0
	local color = strategyColors[strategy] or strategyColors[1]

	local model = Instance.new("Model")
	model.Name = name

	-- Body (torso block)
	local body = Instance.new("Part")
	body.Name = "Body"
	body.Shape = Enum.PartType.Block
	body.Size = Vector3.new(2, 3, 1.5)
	body.Color = color
	body.Material = Enum.Material.Neon
	body.Anchored = true
	body.CanCollide = false
	body.Parent = model

	-- Head (sphere on top)
	local head = Instance.new("Part")
	head.Name = "Head"
	head.Shape = Enum.PartType.Ball
	head.Size = Vector3.new(1.6, 1.6, 1.6)
	head.Color = color
	head.Material = Enum.Material.Neon
	head.Anchored = true
	head.CanCollide = false
	head.Parent = model

	-- Position relative to body
	local spawnX = math.random(-SPAWN_RANGE, SPAWN_RANGE)
	local spawnZ = math.random(-SPAWN_RANGE, SPAWN_RANGE)
	body.Position = Vector3.new(spawnX, GROUND_Y, spawnZ)
	head.Position = Vector3.new(spawnX, GROUND_Y + 2.3, spawnZ)

	model.PrimaryPart = body

	-- Point light for glow effect
	local glow = Instance.new("PointLight")
	glow.Color = color
	glow.Brightness = 0.8
	glow.Range = 6
	glow.Parent = body

	-- BillboardGui for overhead nametag
	local billboard = Instance.new("BillboardGui")
	billboard.Name = "Nametag"
	billboard.Adornee = head
	billboard.Size = UDim2.new(0, 200, 0, 60)
	billboard.StudsOffset = Vector3.new(0, 2, 0)
	billboard.AlwaysOnTop = true
	billboard.Parent = head

	local nameLabel = Instance.new("TextLabel")
	nameLabel.Name = "NameLabel"
	nameLabel.Size = UDim2.new(1, 0, 0.4, 0)
	nameLabel.Position = UDim2.new(0, 0, 0, 0)
	nameLabel.BackgroundTransparency = 1
	nameLabel.TextColor3 = Color3.fromRGB(255, 255, 255)
	nameLabel.TextStrokeTransparency = 0.3
	nameLabel.TextStrokeColor3 = Color3.fromRGB(0, 0, 0)
	nameLabel.TextSize = 16
	nameLabel.Font = Enum.Font.GothamBold
	nameLabel.Text = name
	nameLabel.Parent = billboard

	local infoLabel = Instance.new("TextLabel")
	infoLabel.Name = "InfoLabel"
	infoLabel.Size = UDim2.new(1, 0, 0.35, 0)
	infoLabel.Position = UDim2.new(0, 0, 0.4, 0)
	infoLabel.BackgroundTransparency = 1
	infoLabel.TextColor3 = color
	infoLabel.TextStrokeTransparency = 0.4
	infoLabel.TextStrokeColor3 = Color3.fromRGB(0, 0, 0)
	infoLabel.TextSize = 13
	infoLabel.Font = Enum.Font.Gotham
	infoLabel.Text = (strategyNames[strategy] or "Unknown") .. " | Score: " .. tostring(score)
	infoLabel.Parent = billboard

	model.Parent = agentFolder
	return model
end

-- Update an existing NPC model based on agent state
local function updateAgentModel(model: Model, agentData: any)
	local strategy = agentData.strategy or 1
	local score = agentData.score or 0
	local name = agentData.name or agentData.id or "Agent"
	local color = strategyColors[strategy] or strategyColors[1]

	-- Update body and head colors
	local body = model:FindFirstChild("Body") :: Part?
	local head = model:FindFirstChild("Head") :: Part?

	if body then
		body.Color = color
		local glow = body:FindFirstChildOfClass("PointLight")
		if glow then
			glow.Color = color
		end
	end

	if head then
		head.Color = color

		-- Update nametag
		local billboard = head:FindFirstChild("Nametag") :: BillboardGui?
		if billboard then
			local nameLabel = billboard:FindFirstChild("NameLabel") :: TextLabel?
			if nameLabel then
				nameLabel.Text = name
			end
			local infoLabel = billboard:FindFirstChild("InfoLabel") :: TextLabel?
			if infoLabel then
				infoLabel.Text = (strategyNames[strategy] or "Unknown") .. " | Score: " .. tostring(score)
				infoLabel.TextColor3 = color
			end
		end
	end

	-- Smooth movement toward a wander target
	local agentId = agentData.id or "unknown"
	if body then
		local currentPos = body.Position

		-- Pick a new target if we don't have one or are close enough
		if not wanderTargets[agentId] then
			wanderTargets[agentId] = Vector3.new(
				currentPos.X + math.random(-WANDER_RANGE, WANDER_RANGE),
				GROUND_Y,
				currentPos.Z + math.random(-WANDER_RANGE, WANDER_RANGE)
			)
		end

		local target = wanderTargets[agentId]
		local dist = (Vector3.new(target.X, 0, target.Z) - Vector3.new(currentPos.X, 0, currentPos.Z)).Magnitude

		if dist < 2 then
			-- Arrived, pick new target
			wanderTargets[agentId] = Vector3.new(
				math.clamp(currentPos.X + math.random(-WANDER_RANGE, WANDER_RANGE), -SPAWN_RANGE, SPAWN_RANGE),
				GROUND_Y,
				math.clamp(currentPos.Z + math.random(-WANDER_RANGE, WANDER_RANGE), -SPAWN_RANGE, SPAWN_RANGE)
			)
		else
			-- Lerp toward target
			local newPos = currentPos:Lerp(target, MOVE_SPEED)
			newPos = Vector3.new(newPos.X, GROUND_Y, newPos.Z)
			body.Position = newPos
			if head then
				head.Position = Vector3.new(newPos.X, GROUND_Y + 2.3, newPos.Z)
			end
		end
	end
end

-- Track which agent IDs are present this tick (for removal)
local function removeStaleAgents(activeIds: { [string]: boolean })
	for agentId, model in pairs(agentModels) do
		if not activeIds[agentId] then
			print("[AgentSimulator] Removing stale agent model:", agentId)
			model:Destroy()
			agentModels[agentId] = nil
			wanderTargets[agentId] = nil
		end
	end
end

-- Main simulation loop
while true do
	-- Use leaderboard endpoint to get all agents (no playerId needed)
	local success, agents = HttpBridge.getLeaderboard()

	if success and agents and type(agents) == "table" then
		local activeIds: { [string]: boolean } = {}

		for _, agentData in ipairs(agents) do
			-- Map backend response to agent format
			local agent = {
				id = agentData.playerId or "unknown",
				name = agentData.playerId or "Agent",
				strategy = agentData.onChain and agentData.onChain.strategyType or 1,
				score = agentData.onChain and tonumber(agentData.onChain.deposit) or 0,
				alive = agentData.onChain and agentData.onChain.active or true,
			}
			local agentId = agent.id

			-- Skip dead agents
			if agent.alive == false then
					if agentModels[agentId] then
						print("[AgentSimulator] Agent died, removing model:", agentId)
						agentModels[agentId]:Destroy()
						agentModels[agentId] = nil
						wanderTargets[agentId] = nil
					end
					continue
				end

				activeIds[agentId] = true

				if not agentModels[agentId] then
					-- Spawn new NPC
					local model = createNPCModel(agent)
					agentModels[agentId] = model
					print(string.format(
						"[AgentSimulator] Spawned NPC: %s | Strategy: %s | Score: %d",
						agent.name or agentId,
						strategyNames[agent.strategy] or "Unknown",
						agent.score or 0
					))
				else
					-- Update existing NPC
					updateAgentModel(agentModels[agentId], agent)
				end
			end

			-- Remove models for agents no longer in the game state
			removeStaleAgents(activeIds)
		end
	else
		warn("[AgentSimulator] Failed to fetch game state")
	end

	task.wait(UPDATE_INTERVAL)
end
