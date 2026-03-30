local HttpBridge = require(script.Parent:WaitForChild("HttpBridge"))
local RunService = game:GetService("RunService")

local UPDATE_INTERVAL = 15 -- seconds between updates
local SPAWN_RANGE = 80 -- NPCs spawn within -80 to 80 on X/Z
local GROUND_Y = 3 -- Y position for NPCs
local MOVE_SPEED = 8 -- studs per second for NPC walking
local BUBBLE_INTERVAL = 20 -- seconds between action bubbles

print("[AgentSimulator] Starting agent simulation loop...")

-- Create a folder in Workspace to hold NPC models
local agentFolder = Instance.new("Folder")
agentFolder.Name = "AgentNPCs"
agentFolder.Parent = workspace

-- Raycast params for obstacle detection (exclude NPCs and resource nodes)
local rayParams = RaycastParams.new()
rayParams.FilterType = Enum.RaycastFilterType.Exclude
rayParams.FilterDescendantsInstances = { agentFolder }

-- Update filter once WorldBuilder has created ResourceSpawns
task.delay(4, function()
	local cityWorld = workspace:FindFirstChild("CityWorld")
	if cityWorld then
		local resFolder = cityWorld:FindFirstChild("ResourceSpawns")
		if resFolder then
			rayParams.FilterDescendantsInstances = { agentFolder, resFolder }
		end
	end
end)

local OBSTACLE_CHECK_DIST = 4 -- how far ahead to check for walls
local STEER_ANGLE = math.rad(60) -- angle to steer when blocked

-- Check if a direction is blocked by a wall/building
local function isBlocked(origin: Vector3, direction: Vector3): boolean
	local result = workspace:Raycast(origin, direction.Unit * OBSTACLE_CHECK_DIST, rayParams)
	return result ~= nil
end

-- Find an unblocked movement direction, steering around obstacles
local function avoidObstacles(origin: Vector3, desiredDir: Vector3): Vector3
	-- Check straight ahead
	if not isBlocked(origin, desiredDir) then
		return desiredDir
	end

	-- Try steering left and right at increasing angles
	for _, angle in { STEER_ANGLE, STEER_ANGLE * 2, STEER_ANGLE * 3 } do
		-- Rotate left
		local cosA = math.cos(angle)
		local sinA = math.sin(angle)
		local leftDir = Vector3.new(
			desiredDir.X * cosA - desiredDir.Z * sinA,
			0,
			desiredDir.X * sinA + desiredDir.Z * cosA
		)
		if not isBlocked(origin, leftDir) then
			return leftDir.Unit
		end

		-- Rotate right
		local rightDir = Vector3.new(
			desiredDir.X * cosA + desiredDir.Z * sinA,
			0,
			-desiredDir.X * sinA + desiredDir.Z * cosA
		)
		if not isBlocked(origin, rightDir) then
			return rightDir.Unit
		end
	end

	-- Completely blocked — reverse
	return -desiredDir.Unit
end

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

-- Darken a color for limbs
local function darkenColor(c: Color3): Color3
	return Color3.new(math.max(0, c.R - 0.15), math.max(0, c.G - 0.15), math.max(0, c.B - 0.15))
end

-- Target positions for NPC movement
local wanderTargets: { [string]: Vector3 } = {}

-- Track movement state per agent
local isMoving: { [string]: boolean } = {}

-- Facing direction per agent (unit vector on XZ plane)
local agentFacing: { [string]: Vector3 } = {}

-- Linger timer: when the agent arrived, and how long to stay
local arrivalTime: { [string]: number } = {}
local lingerDuration: { [string]: number } = {}

-- Track last action bubble time per agent
local lastBubbleTime: { [string]: number } = {}

-- Resource cooldown tracking: Part -> respawn time
local resourceCooldowns: { [Part]: number } = {}
local RESOURCE_RESPAWN_TIME = 30 -- seconds before a gathered resource reappears

-- Consume a resource node visually (shrink + hide, then respawn after cooldown)
local function consumeResource(part: Part)
	if resourceCooldowns[part] then return end -- already consumed

	-- Store original state
	local origSize = part.Size
	local origTransparency = part.Transparency
	local origColor = part.Color

	-- Mark as on cooldown
	resourceCooldowns[part] = tick() + RESOURCE_RESPAWN_TIME

	-- Collection burst effect
	local burstPart = Instance.new("Part")
	burstPart.Size = Vector3.new(1, 1, 1)
	burstPart.Transparency = 1
	burstPart.Anchored = true
	burstPart.CanCollide = false
	burstPart.Position = part.Position + Vector3.new(0, 2, 0)
	burstPart.Parent = part.Parent

	local burst = Instance.new("ParticleEmitter")
	burst.Color = ColorSequence.new(origColor)
	burst.Rate = 80
	burst.Lifetime = NumberRange.new(0.3, 0.6)
	burst.Speed = NumberRange.new(4, 10)
	burst.SpreadAngle = Vector2.new(180, 180)
	burst.LightEmission = 1
	burst.Size = NumberSequence.new({
		NumberSequenceKeypoint.new(0, 0.4),
		NumberSequenceKeypoint.new(1, 0),
	})
	burst.Parent = burstPart

	task.delay(0.3, function()
		burst.Enabled = false
	end)
	task.delay(1.5, function()
		if burstPart.Parent then burstPart:Destroy() end
	end)

	-- Hide the resource
	part.Transparency = 1
	local pointLight = part:FindFirstChildOfClass("PointLight")
	if pointLight then pointLight.Enabled = false end
	local emitter = part:FindFirstChildOfClass("ParticleEmitter")
	if emitter then emitter.Enabled = false end
	local billboard = part:FindFirstChildOfClass("BillboardGui")
	if billboard then billboard.Enabled = false end

	-- Respawn after cooldown
	task.delay(RESOURCE_RESPAWN_TIME, function()
		part.Transparency = origTransparency
		part.Size = origSize
		if pointLight then pointLight.Enabled = true end
		if emitter then emitter.Enabled = true end
		if billboard then billboard.Enabled = true end
		resourceCooldowns[part] = nil
	end)
end

-- Show floating text above a position (e.g., "+5 Food" on pickup, "-3 Food" on burn)
local function showFloatingText(position: Vector3, text: string, color: Color3)
	local part = Instance.new("Part")
	part.Size = Vector3.new(1, 1, 1)
	part.Transparency = 1
	part.Anchored = true
	part.CanCollide = false
	part.Position = position + Vector3.new(0, 3, 0)
	part.Parent = workspace

	local billboard = Instance.new("BillboardGui")
	billboard.Size = UDim2.new(0, 160, 0, 30)
	billboard.StudsOffset = Vector3.new(0, 0, 0)
	billboard.AlwaysOnTop = true
	billboard.Parent = part

	local label = Instance.new("TextLabel")
	label.Size = UDim2.new(1, 0, 1, 0)
	label.BackgroundTransparency = 1
	label.TextColor3 = color
	label.TextStrokeTransparency = 0.3
	label.TextStrokeColor3 = Color3.fromRGB(0, 0, 0)
	label.TextSize = 18
	label.Font = Enum.Font.GothamBold
	label.Text = text
	label.Parent = billboard

	-- Float upward and fade out
	task.spawn(function()
		for i = 1, 30 do
			part.Position = part.Position + Vector3.new(0, 0.06, 0)
			label.TextTransparency = i / 30
			label.TextStrokeTransparency = 0.3 + (i / 30) * 0.7
			task.wait(0.03)
		end
		part:Destroy()
	end)
end

-- Play death/liquidation animation on an NPC model
local function playDeathAnimation(model: Model, agentId: string)
	-- Flash red
	for _, child in model:GetChildren() do
		if child:IsA("Part") then
			child.Color = Color3.fromRGB(255, 30, 30)
		end
	end

	-- Show LIQUIDATED bubble
	showActionBubble(model, "LIQUIDATED", 3)

	-- Show floating text
	local torso = model:FindFirstChild("Torso") :: Part?
	if torso then
		showFloatingText(torso.Position, "LIQUIDATED", Color3.fromRGB(255, 50, 50))
	end

	-- Fade out over 2 seconds
	task.spawn(function()
		for i = 1, 40 do
			local t = i / 40
			for _, child in model:GetChildren() do
				if child:IsA("Part") then
					child.Transparency = t
				end
			end
			task.wait(0.05)
		end

		-- Red particle burst before removal
		if torso and torso.Parent then
			local burstPart = Instance.new("Part")
			burstPart.Size = Vector3.new(1, 1, 1)
			burstPart.Transparency = 1
			burstPart.Anchored = true
			burstPart.CanCollide = false
			burstPart.Position = torso.Position
			burstPart.Parent = workspace

			local burst = Instance.new("ParticleEmitter")
			burst.Color = ColorSequence.new(Color3.fromRGB(255, 30, 30))
			burst.Rate = 100
			burst.Lifetime = NumberRange.new(0.3, 0.8)
			burst.Speed = NumberRange.new(5, 15)
			burst.SpreadAngle = Vector2.new(180, 180)
			burst.LightEmission = 1
			burst.Size = NumberSequence.new({
				NumberSequenceKeypoint.new(0, 0.5),
				NumberSequenceKeypoint.new(1, 0),
			})
			burst.Parent = burstPart

			task.delay(0.4, function()
				burst.Enabled = false
			end)
			task.delay(2, function()
				if burstPart.Parent then burstPart:Destroy() end
			end)
		end

		-- Clean up
		model:Destroy()
		agentModels[agentId] = nil
		wanderTargets[agentId] = nil
		isMoving[agentId] = nil
		agentFacing[agentId] = nil
		arrivalTime[agentId] = nil
		lingerDuration[agentId] = nil
		lastBubbleTime[agentId] = nil
		agentActions[agentId] = nil
	end)
end

-- Show brief burn visual on all alive NPCs (red pulse + floating cost text)
local function showBurnVisual(model: Model, foodBurn: number, energyBurn: number)
	local torso = model:FindFirstChild("Torso") :: Part?
	if not torso then return end

	-- Brief red pulse on torso
	local origColor = torso.Color
	torso.Color = Color3.fromRGB(255, 80, 80)
	task.delay(0.3, function()
		if torso and torso.Parent then
			torso.Color = origColor
		end
	end)

	-- Floating burn text
	local burnText = string.format("-%d Food -%d Energy", foodBurn, energyBurn)
	showFloatingText(torso.Position, burnText, Color3.fromRGB(255, 100, 100))
end

-- Find the nearest visible (not on cooldown) resource Part of a given type
local function findNearestResourcePart(origin: Vector3, resName: string): Part?
	local cityWorld = workspace:FindFirstChild("CityWorld")
	if not cityWorld then return nil end
	local resFolder = cityWorld:FindFirstChild("ResourceSpawns")
	if not resFolder then return nil end

	local best: Part? = nil
	local bestDist = math.huge
	for _, child in resFolder:GetChildren() do
		if child:IsA("Part") and not resourceCooldowns[child] then
			local lowerName = string.lower(child.Name)
			if string.find(lowerName, string.lower(resName)) then
				local d = (origin - child.Position).Magnitude
				if d < bestDist then
					best = child
					bestDist = d
				end
			end
		end
	end
	return best
end

-- Store current actions per agent from backend
local agentActions: { [string]: any } = {}

-- Action phrases by strategy (fallback when no AI reasoning available)
local actionPhrases = {
	[0] = { "Saving resources...", "Steady growth...", "Checking yield..." },
	[1] = { "Trading steel...", "Analyzing market...", "Optimizing..." },
	[2] = { "BUYING ENERGY!", "Gacha roll!", "High risk trade!" },
}

-- Resource positions cache (populated by scanning workspace)
local resourcePositions: { [string]: { Vector3 } } = {
	wood = {},
	steel = {},
	energy = {},
	food = {},
}

-- Scan workspace for resource spawn positions
local function scanResourcePositions()
	resourcePositions = { wood = {}, steel = {}, energy = {}, food = {} }

	-- Try to find CityWorld > ResourceSpawns folder first
	local cityWorld = workspace:FindFirstChild("CityWorld")
	if cityWorld then
		local resFolder = cityWorld:FindFirstChild("ResourceSpawns")
		if resFolder then
			for _, child in resFolder:GetChildren() do
				if child:IsA("Part") then
					local lowerName = string.lower(child.Name)
					if string.find(lowerName, "wood") then
						table.insert(resourcePositions.wood, child.Position)
					elseif string.find(lowerName, "steel") then
						table.insert(resourcePositions.steel, child.Position)
					elseif string.find(lowerName, "energy") then
						table.insert(resourcePositions.energy, child.Position)
					elseif string.find(lowerName, "food") then
						table.insert(resourcePositions.food, child.Position)
					end
				end
			end
		end
	end

	-- Fallback: scan all descendants for parts with resource-related BillboardGui labels
	if #resourcePositions.wood == 0 and #resourcePositions.steel == 0 then
		for _, desc in workspace:GetDescendants() do
			if desc:IsA("Part") then
				local billboard = desc:FindFirstChildOfClass("BillboardGui")
				if billboard then
					local label = billboard:FindFirstChildOfClass("TextLabel")
					if label then
						local text = string.lower(label.Text or "")
						if text == "wood" then
							table.insert(resourcePositions.wood, desc.Position)
						elseif text == "steel" then
							table.insert(resourcePositions.steel, desc.Position)
						elseif text == "energy" then
							table.insert(resourcePositions.energy, desc.Position)
						elseif text == "food" then
							table.insert(resourcePositions.food, desc.Position)
						end
					end
				end
			end
		end
	end

	-- Hardcoded fallback if nothing found
	if #resourcePositions.wood == 0 then
		resourcePositions.wood = { Vector3.new(50, GROUND_Y, 50), Vector3.new(-60, GROUND_Y, 30) }
	end
	if #resourcePositions.steel == 0 then
		resourcePositions.steel = { Vector3.new(-50, GROUND_Y, -50), Vector3.new(40, GROUND_Y, -60) }
	end
	if #resourcePositions.energy == 0 then
		resourcePositions.energy = { Vector3.new(60, GROUND_Y, -30), Vector3.new(-40, GROUND_Y, 60) }
	end
	if #resourcePositions.food == 0 then
		resourcePositions.food = { Vector3.new(-30, GROUND_Y, -60), Vector3.new(70, GROUND_Y, 20) }
	end
end

-- Find nearest position from a list
local function findNearest(origin: Vector3, positions: { Vector3 }): Vector3
	local best = positions[1]
	local bestDist = (origin - best).Magnitude
	for i = 2, #positions do
		local d = (origin - positions[i]).Magnitude
		if d < bestDist then
			best = positions[i]
			bestDist = d
		end
	end
	return best
end

-- Fetch agent actions from backend
local function fetchAgentActions()
	local success, data = HttpBridge.getAgentActions()
	if success and data and type(data) == "table" then
		for _, actionData in data do
			local pid = actionData.playerId
			if pid then
				agentActions[pid] = actionData
			end
		end
	end
end

-- Resource type index to name mapping
local RESOURCE_NAMES_BY_INDEX = { [0] = "wood", [1] = "steel", [2] = "energy", [3] = "food" }

-- Determine movement target based on agent action
local function getActionTarget(agentId: string, currentPos: Vector3): Vector3?
	local actionData = agentActions[agentId]
	if not actionData then return nil end

	local action = actionData.currentAction or ""

	-- Backend sends: "gather", "trade", "change_strategy", "trigger_event", "idle"
	if action == "gather" then
		-- Use targetResourceType to determine which resource to walk toward (skip consumed ones)
		local resType = actionData.targetResourceType
		local resName = RESOURCE_NAMES_BY_INDEX[resType] or "wood"
		local resPart = findNearestResourcePart(currentPos, resName)
		if resPart then
			return Vector3.new(resPart.Position.X, GROUND_Y, resPart.Position.Z)
		end
		return nil
	elseif action == "trade" then
		-- Walk toward target agent if specified, otherwise nearest other NPC
		local targetId = actionData.targetAgentId
		if targetId and agentModels[targetId] then
			local targetModel = agentModels[targetId]
			local torso = targetModel:FindFirstChild("Torso") :: Part?
			if torso then
				return Vector3.new(torso.Position.X, GROUND_Y, torso.Position.Z)
			end
		end
		-- If no specific target, walk toward map center (marketplace area)
		return Vector3.new(0, GROUND_Y, 0)
	elseif action == "change_strategy" or action == "trigger_event" then
		return Vector3.new(0, GROUND_Y, 0)
	end

	-- "idle" or unknown: return nil (will use random wander)
	return nil
end

-- Show a temporary text bubble above an NPC model
local function showActionBubble(model: Model, text: string, duration: number)
	local head = model:FindFirstChild("Head") :: Part?
	if not head then return end

	-- Remove existing bubble
	local existing = head:FindFirstChild("ActionBubble")
	if existing then existing:Destroy() end

	local billboard = Instance.new("BillboardGui")
	billboard.Name = "ActionBubble"
	billboard.Adornee = head
	billboard.Size = UDim2.new(0, 240, 0, 44)
	billboard.StudsOffset = Vector3.new(0, 4.5, 0)
	billboard.AlwaysOnTop = true
	billboard.Parent = head

	local bg = Instance.new("Frame")
	bg.Name = "BubbleBG"
	bg.Size = UDim2.new(1, 0, 1, 0)
	bg.BackgroundColor3 = Color3.fromRGB(10, 10, 30)
	bg.BackgroundTransparency = 0.3
	bg.BorderSizePixel = 0
	bg.Parent = billboard

	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, 6)
	corner.Parent = bg

	local label = Instance.new("TextLabel")
	label.Name = "BubbleText"
	label.Size = UDim2.new(1, -8, 1, -4)
	label.Position = UDim2.new(0, 4, 0, 2)
	label.BackgroundTransparency = 1
	label.TextColor3 = Color3.fromRGB(0, 255, 220)
	label.TextStrokeTransparency = 0.4
	label.TextStrokeColor3 = Color3.fromRGB(0, 0, 0)
	label.TextSize = 13
	label.Font = Enum.Font.GothamBold
	label.Text = text
	label.TextWrapped = true
	label.TextTruncate = Enum.TextTruncate.AtEnd
	label.Parent = billboard

	task.delay(duration, function()
		if billboard and billboard.Parent then
			billboard:Destroy()
		end
	end)
end

-- Celebration particle effect
local function playCelebration(model: Model)
	local head = model:FindFirstChild("Head") :: Part?
	if not head then return end

	local effectPart = Instance.new("Part")
	effectPart.Name = "CelebrationFX"
	effectPart.Size = Vector3.new(0.5, 0.5, 0.5)
	effectPart.Transparency = 1
	effectPart.Anchored = true
	effectPart.CanCollide = false
	effectPart.Position = head.Position + Vector3.new(0, 1, 0)
	effectPart.Parent = model

	local particles = Instance.new("ParticleEmitter")
	particles.Color = ColorSequence.new(Color3.fromRGB(255, 215, 0), Color3.fromRGB(255, 255, 100))
	particles.Rate = 50
	particles.Lifetime = NumberRange.new(0.3, 0.8)
	particles.Speed = NumberRange.new(3, 8)
	particles.SpreadAngle = Vector2.new(180, 180)
	particles.LightEmission = 1
	particles.Size = NumberSequence.new({
		NumberSequenceKeypoint.new(0, 0.3),
		NumberSequenceKeypoint.new(0.5, 0.5),
		NumberSequenceKeypoint.new(1, 0),
	})
	particles.Transparency = NumberSequence.new({
		NumberSequenceKeypoint.new(0, 0),
		NumberSequenceKeypoint.new(0.7, 0),
		NumberSequenceKeypoint.new(1, 1),
	})
	particles.Parent = effectPart
	particles.Enabled = true

	task.delay(0.5, function()
		particles.Enabled = false
	end)

	task.delay(2, function()
		if effectPart and effectPart.Parent then
			effectPart:Destroy()
		end
	end)
end

-- Build a humanoid-rig NPC model from Parts
local function createNPCModel(agentData: any): Model
	local name = agentData.name or agentData.id or "Agent"
	local strategy = agentData.strategy or 1
	local score = agentData.score or 0
	local color = strategyColors[strategy] or strategyColors[1]
	local limbColor = darkenColor(color)

	local model = Instance.new("Model")
	model.Name = name

	-- Torso
	local torso = Instance.new("Part")
	torso.Name = "Torso"
	torso.Shape = Enum.PartType.Block
	torso.Size = Vector3.new(2, 2.4, 1.2)
	torso.Color = color
	torso.Material = Enum.Material.Neon
	torso.Anchored = true
	torso.CanCollide = false
	torso.Parent = model

	-- Head
	local head = Instance.new("Part")
	head.Name = "Head"
	head.Shape = Enum.PartType.Ball
	head.Size = Vector3.new(1.4, 1.4, 1.4)
	head.Color = color
	head.Material = Enum.Material.Neon
	head.Anchored = true
	head.CanCollide = false
	head.Parent = model

	-- Left Arm
	local leftArm = Instance.new("Part")
	leftArm.Name = "LeftArm"
	leftArm.Shape = Enum.PartType.Block
	leftArm.Size = Vector3.new(0.6, 2.2, 0.6)
	leftArm.Color = limbColor
	leftArm.Material = Enum.Material.Neon
	leftArm.Anchored = true
	leftArm.CanCollide = false
	leftArm.Parent = model

	-- Right Arm
	local rightArm = Instance.new("Part")
	rightArm.Name = "RightArm"
	rightArm.Shape = Enum.PartType.Block
	rightArm.Size = Vector3.new(0.6, 2.2, 0.6)
	rightArm.Color = limbColor
	rightArm.Material = Enum.Material.Neon
	rightArm.Anchored = true
	rightArm.CanCollide = false
	rightArm.Parent = model

	-- Left Leg
	local leftLeg = Instance.new("Part")
	leftLeg.Name = "LeftLeg"
	leftLeg.Shape = Enum.PartType.Block
	leftLeg.Size = Vector3.new(0.7, 2.2, 0.7)
	leftLeg.Color = limbColor
	leftLeg.Material = Enum.Material.Neon
	leftLeg.Anchored = true
	leftLeg.CanCollide = false
	leftLeg.Parent = model

	-- Right Leg
	local rightLeg = Instance.new("Part")
	rightLeg.Name = "RightLeg"
	rightLeg.Shape = Enum.PartType.Block
	rightLeg.Size = Vector3.new(0.7, 2.2, 0.7)
	rightLeg.Color = limbColor
	rightLeg.Material = Enum.Material.Neon
	rightLeg.Anchored = true
	rightLeg.CanCollide = false
	rightLeg.Parent = model

	-- Aura ring at feet (cylinder via SpecialMesh)
	local auraRing = Instance.new("Part")
	auraRing.Name = "AuraRing"
	auraRing.Size = Vector3.new(4, 0.1, 4)
	auraRing.Color = color
	auraRing.Material = Enum.Material.Neon
	auraRing.Transparency = 0.6
	auraRing.Anchored = true
	auraRing.CanCollide = false
	auraRing.Parent = model

	local auraMesh = Instance.new("SpecialMesh")
	auraMesh.MeshType = Enum.MeshType.Cylinder
	auraMesh.Parent = auraRing

	-- Spawn position
	local spawnX = math.random(-SPAWN_RANGE, SPAWN_RANGE)
	local spawnZ = math.random(-SPAWN_RANGE, SPAWN_RANGE)
	local basePos = Vector3.new(spawnX, GROUND_Y, spawnZ)

	-- Position all parts relative to torso center
	torso.Position = basePos
	head.Position = basePos + Vector3.new(0, 1.9, 0)
	leftArm.Position = basePos + Vector3.new(-1.3, -0.1, 0)
	rightArm.Position = basePos + Vector3.new(1.3, -0.1, 0)
	leftLeg.Position = basePos + Vector3.new(-0.5, -2.3, 0)
	rightLeg.Position = basePos + Vector3.new(0.5, -2.3, 0)
	auraRing.Position = basePos + Vector3.new(0, -2.3, 0)

	model.PrimaryPart = torso

	-- Point light for glow
	local glow = Instance.new("PointLight")
	glow.Color = color
	glow.Brightness = 1.2
	glow.Range = 8
	glow.Parent = torso

	-- BillboardGui nametag on Head
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

-- Position all limbs relative to torso, oriented along facing direction
local function positionLimbs(model: Model, basePos: Vector3, facing: Vector3, animOffsets: { la: number, ra: number, ll: number, rl: number, headBob: number })
	-- Build orientation from facing direction
	local lookDir = Vector3.new(facing.X, 0, facing.Z)
	if lookDir.Magnitude < 0.01 then
		lookDir = Vector3.new(0, 0, -1) -- default facing
	end
	lookDir = lookDir.Unit

	-- Right vector = cross(lookDir, up)
	local rightDir = lookDir:Cross(Vector3.new(0, 1, 0)).Unit

	local head = model:FindFirstChild("Head") :: Part?
	local leftArm = model:FindFirstChild("LeftArm") :: Part?
	local rightArm = model:FindFirstChild("RightArm") :: Part?
	local leftLeg = model:FindFirstChild("LeftLeg") :: Part?
	local rightLeg = model:FindFirstChild("RightLeg") :: Part?
	local auraRing = model:FindFirstChild("AuraRing") :: Part?
	local torso = model:FindFirstChild("Torso") :: Part?

	-- Rotate torso to face movement direction
	if torso then
		torso.CFrame = CFrame.lookAt(basePos, basePos + lookDir)
	end

	if head then
		head.Position = basePos + Vector3.new(0, 1.9 + animOffsets.headBob, 0)
	end
	-- Arms swing forward/back along look direction
	if leftArm then
		leftArm.Position = basePos - rightDir * 1.3 + Vector3.new(0, -0.1, 0) + lookDir * animOffsets.la
	end
	if rightArm then
		rightArm.Position = basePos + rightDir * 1.3 + Vector3.new(0, -0.1, 0) + lookDir * animOffsets.ra
	end
	-- Legs swing forward/back along look direction
	if leftLeg then
		leftLeg.Position = basePos - rightDir * 0.5 + Vector3.new(0, -2.3, 0) + lookDir * animOffsets.ll
	end
	if rightLeg then
		rightLeg.Position = basePos + rightDir * 0.5 + Vector3.new(0, -2.3, 0) + lookDir * animOffsets.rl
	end
	if auraRing then
		auraRing.Position = basePos + Vector3.new(0, -2.3, 0)
	end
end

-- Update an existing NPC model based on agent state
local function updateAgentModel(model: Model, agentData: any)
	local strategy = agentData.strategy or 1
	local score = agentData.score or 0
	local name = agentData.name or agentData.id or "Agent"
	local color = strategyColors[strategy] or strategyColors[1]
	local limbColor = darkenColor(color)
	local agentId = agentData.id or "unknown"

	-- Update torso color
	local torso = model:FindFirstChild("Torso") :: Part?
	if torso then
		torso.Color = color
		local glow = torso:FindFirstChildOfClass("PointLight")
		if glow then
			glow.Color = color
		end
	end

	-- Update head color
	local head = model:FindFirstChild("Head") :: Part?
	if head then
		head.Color = color
	end

	-- Update limb colors
	for _, limbName in { "LeftArm", "RightArm", "LeftLeg", "RightLeg" } do
		local limb = model:FindFirstChild(limbName) :: Part?
		if limb then
			limb.Color = limbColor
		end
	end

	-- Update aura ring
	local auraRing = model:FindFirstChild("AuraRing") :: Part?
	if auraRing then
		auraRing.Color = color
	end

	-- Update nametag
	if head then
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

	-- Set wander target based on action (actual movement happens in Heartbeat)
	if torso then
		local currentPos = torso.Position

		-- Determine target based on action
		local actionTarget = getActionTarget(agentId, currentPos)
		if actionTarget then
			wanderTargets[agentId] = Vector3.new(actionTarget.X, GROUND_Y, actionTarget.Z)
		end

		-- Pick a new random wander target if no target exists
		if not wanderTargets[agentId] then
			wanderTargets[agentId] = Vector3.new(
				math.clamp(currentPos.X + math.random(-8, 8), -SPAWN_RANGE, SPAWN_RANGE),
				GROUND_Y,
				math.clamp(currentPos.Z + math.random(-8, 8), -SPAWN_RANGE, SPAWN_RANGE)
			)
		end
	end
end

-- Movement + walking animation system via Heartbeat (runs every frame)
RunService.Heartbeat:Connect(function(dt)
	local t = tick()
	for agentId, model in agentModels do
		local torso = model:FindFirstChild("Torso") :: Part?
		if not torso then continue end

		local currentPos = torso.Position
		local target = wanderTargets[agentId]

		-- Initialize facing if not set
		if not agentFacing[agentId] then
			agentFacing[agentId] = Vector3.new(0, 0, -1)
		end

		if target then
			local diff = Vector3.new(target.X - currentPos.X, 0, target.Z - currentPos.Z)
			local dist = diff.Magnitude

			if dist < 2 then
				-- Arrived at target
				if not arrivalTime[agentId] then
					-- Just arrived — start lingering
					arrivalTime[agentId] = t
					-- Linger 4-10 seconds at action targets, 2-5 for idle wander
					local actionData = agentActions[agentId]
					local hasAction = actionData and actionData.currentAction and actionData.currentAction ~= "idle"
					lingerDuration[agentId] = if hasAction then (4 + math.random() * 6) else (2 + math.random() * 3)

					-- If gathering, consume the nearest resource node and show pickup text
					if actionData and actionData.currentAction == "gather" then
						local resType = actionData.targetResourceType
						local resName = RESOURCE_NAMES_BY_INDEX[resType] or "wood"
						local resPart = findNearestResourcePart(currentPos, resName)
						if resPart and (currentPos - resPart.Position).Magnitude < 8 then
							consumeResource(resPart)
							local displayName = string.upper(string.sub(resName, 1, 1)) .. string.sub(resName, 2)
							showFloatingText(currentPos, "+5 " .. displayName, Color3.fromRGB(50, 255, 120))
						end
					end
				end

				isMoving[agentId] = false

				-- Check if linger time has elapsed
				if (t - arrivalTime[agentId]) >= lingerDuration[agentId] then
					-- Done lingering — pick a new random wander target (try up to 5 times to avoid walls)
					arrivalTime[agentId] = nil
					lingerDuration[agentId] = nil
					local newTarget
					for _ = 1, 5 do
						local candidate = Vector3.new(
							math.clamp(currentPos.X + math.random(-20, 20), -SPAWN_RANGE, SPAWN_RANGE),
							GROUND_Y,
							math.clamp(currentPos.Z + math.random(-20, 20), -SPAWN_RANGE, SPAWN_RANGE)
						)
						local dir = (candidate - currentPos)
						if dir.Magnitude > 1 and not isBlocked(currentPos, dir.Unit * math.min(dir.Magnitude, OBSTACLE_CHECK_DIST)) then
							newTarget = candidate
							break
						end
					end
					wanderTargets[agentId] = newTarget or (currentPos + Vector3.new(math.random(-5, 5), 0, math.random(-5, 5)))
				end
			else
				-- Moving toward target
				isMoving[agentId] = true
				arrivalTime[agentId] = nil -- reset if we start moving again

				-- Check for obstacles and steer around them
				local desiredFacing = diff.Unit
				local moveDir = avoidObstacles(currentPos, desiredFacing)

				-- Smooth turn: lerp facing direction so NPC doesn't snap-rotate
				local curFacing = agentFacing[agentId]
				agentFacing[agentId] = (curFacing + (moveDir - curFacing) * math.min(1, dt * 5)).Unit

				-- Move at consistent speed (studs per second)
				local step = math.min(MOVE_SPEED * dt, dist) -- don't overshoot
				local newPos = currentPos + moveDir * step
				torso.Position = Vector3.new(newPos.X, GROUND_Y, newPos.Z)
			end
		end

		local basePos = torso.Position
		local facing = agentFacing[agentId] or Vector3.new(0, 0, -1)

		if isMoving[agentId] then
			-- Walking animation: alternating arm-leg swing in facing direction
			positionLimbs(model, basePos, facing, {
				la = math.sin(t * 8) * 0.6,
				ra = -math.sin(t * 8) * 0.6,
				ll = -math.sin(t * 8) * 0.5,
				rl = math.sin(t * 8) * 0.5,
				headBob = 0,
			})
		else
			-- Idle animation: subtle head bob, body faces last direction
			positionLimbs(model, basePos, facing, {
				la = 0,
				ra = 0,
				ll = 0,
				rl = 0,
				headBob = math.sin(t * 2) * 0.08,
			})
		end
	end
end)

-- Track which agent IDs are present this tick (for removal)
local function removeStaleAgents(activeIds: { [string]: boolean })
	for agentId, model in pairs(agentModels) do
		if not activeIds[agentId] then
			print("[AgentSimulator] Removing stale agent model:", agentId)
			model:Destroy()
			agentModels[agentId] = nil
			wanderTargets[agentId] = nil
			isMoving[agentId] = nil
			agentFacing[agentId] = nil
			arrivalTime[agentId] = nil
			lingerDuration[agentId] = nil
			lastBubbleTime[agentId] = nil
			agentActions[agentId] = nil
		end
	end
end

-- Track previous actions for celebration detection
local previousActions: { [string]: string } = {}

-- Scan resource positions once after a short delay to let WorldBuilder finish
task.delay(3, function()
	scanResourcePositions()
	print("[AgentSimulator] Scanned resource positions")
end)

-- Main simulation loop
while true do
	-- Fetch leaderboard (all agents)
	local success, agents = HttpBridge.getLeaderboard()

	-- Also fetch agent actions
	fetchAgentActions()

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

			-- Skip dead agents — play death animation if model still exists
			if agent.alive == false then
				if agentModels[agentId] then
					print("[AgentSimulator] Agent LIQUIDATED:", agentId)
					task.spawn(playDeathAnimation, agentModels[agentId], agentId)
				end
				continue
			end

			activeIds[agentId] = true

			if not agentModels[agentId] then
				-- Spawn new NPC
				local model = createNPCModel(agent)
				agentModels[agentId] = model
				-- Set initial wander target so NPC starts moving immediately
				local spawnTorso = model:FindFirstChild("Torso") :: Part?
				if spawnTorso then
					local sp = spawnTorso.Position
					wanderTargets[agentId] = Vector3.new(
						math.clamp(sp.X + math.random(-20, 20), -SPAWN_RANGE, SPAWN_RANGE),
						GROUND_Y,
						math.clamp(sp.Z + math.random(-20, 20), -SPAWN_RANGE, SPAWN_RANGE)
					)
				end
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

			-- Check for celebration trigger (action changed to rolling_gacha)
			local currentAction = agentActions[agentId] and agentActions[agentId].currentAction or ""
			local prevAction = previousActions[agentId] or ""
			if currentAction == "rolling_gacha" and prevAction ~= "rolling_gacha" then
				local model = agentModels[agentId]
				if model then
					playCelebration(model)
				end
			end
			previousActions[agentId] = currentAction

			-- Occasionally show an action bubble with AI reasoning
			local now = tick()
			if not lastBubbleTime[agentId] or (now - lastBubbleTime[agentId]) >= BUBBLE_INTERVAL then
				lastBubbleTime[agentId] = now
				local model = agentModels[agentId]
				if model then
					-- Prefer AI reasoning text, fall back to hardcoded phrases
					local actionData = agentActions[agentId]
					local bubbleText: string
					if actionData and actionData.reasoning and actionData.reasoning ~= "" then
						bubbleText = actionData.reasoning
					else
						local phrases = actionPhrases[agent.strategy] or actionPhrases[1]
						bubbleText = phrases[math.random(1, #phrases)]
					end
					showActionBubble(model, bubbleText, 5)
				end
			end
		end

		-- Remove models for agents no longer in the game state
		removeStaleAgents(activeIds)
	else
		warn("[AgentSimulator] Failed to fetch game state")
	end

	task.wait(UPDATE_INTERVAL)
end
