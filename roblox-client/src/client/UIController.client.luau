local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")

local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")

-- Wait for remotes
local Remotes = ReplicatedStorage:WaitForChild("Remotes")
local CreateAgentRF = Remotes:WaitForChild("CreateAgent") :: RemoteFunction
local SetStrategyRF = Remotes:WaitForChild("SetStrategy") :: RemoteFunction
local GetGameStateRF = Remotes:WaitForChild("GetGameState") :: RemoteFunction
local TriggerEventRF = Remotes:WaitForChild("TriggerEvent") :: RemoteFunction
local GetLeaderboardRF = Remotes:WaitForChild("GetLeaderboard") :: RemoteFunction
local GetAgentHistoryRF = Remotes:WaitForChild("GetAgentHistory") :: RemoteFunction
local GetRoundStatusRF = Remotes:WaitForChild("GetRoundStatus") :: RemoteFunction

local Config = require(ReplicatedStorage:WaitForChild("Config"))

local POLL_INTERVAL = 8

-- Agent color palette (must match AgentSimulator + WorldBuilder)
local agentColorPalette = {
	Color3.fromRGB(0, 200, 255),    -- cyan
	Color3.fromRGB(255, 60, 180),   -- pink
	Color3.fromRGB(120, 50, 255),   -- purple
	Color3.fromRGB(0, 255, 130),    -- green
	Color3.fromRGB(255, 150, 0),    -- orange
	Color3.fromRGB(255, 255, 50),   -- yellow
	Color3.fromRGB(255, 80, 80),    -- red
	Color3.fromRGB(80, 180, 255),   -- light blue
}

local agentColorMap: { [string]: number } = {}
local nextColorIdx = 1

local function getAgentColor(agentId: string): Color3
	if not agentColorMap[agentId] then
		agentColorMap[agentId] = nextColorIdx
		nextColorIdx = (nextColorIdx % #agentColorPalette) + 1
	end
	return agentColorPalette[agentColorMap[agentId]]
end

-- ============================================================
-- UI Helpers
-- ============================================================

local screenGui = Instance.new("ScreenGui")
screenGui.Name = "NeonNexusUI"
screenGui.ResetOnSpawn = false
screenGui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
screenGui.Parent = playerGui

local function createFrame(name: string, position: UDim2, size: UDim2): Frame
	local frame = Instance.new("Frame")
	frame.Name = name
	frame.Position = position
	frame.Size = size
	frame.BackgroundColor3 = Color3.fromRGB(12, 12, 25)
	frame.BackgroundTransparency = 0.08
	frame.BorderSizePixel = 0
	frame.Parent = screenGui

	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, 8)
	corner.Parent = frame

	local stroke = Instance.new("UIStroke")
	stroke.Color = Color3.fromRGB(0, 150, 200)
	stroke.Thickness = 1
	stroke.Transparency = 0.4
	stroke.Parent = frame

	return frame
end

local function createLabel(parent: Instance, name: string, position: UDim2, size: UDim2, text: string): TextLabel
	local label = Instance.new("TextLabel")
	label.Name = name
	label.Position = position
	label.Size = size
	label.BackgroundTransparency = 1
	label.TextColor3 = Color3.fromRGB(200, 200, 230)
	label.TextSize = 13
	label.Font = Enum.Font.Gotham
	label.Text = text
	label.TextXAlignment = Enum.TextXAlignment.Left
	label.Parent = parent
	return label
end

local function createButton(parent: Instance, name: string, position: UDim2, size: UDim2, text: string): TextButton
	local button = Instance.new("TextButton")
	button.Name = name
	button.Position = position
	button.Size = size
	button.BackgroundColor3 = Color3.fromRGB(0, 120, 180)
	button.TextColor3 = Color3.fromRGB(255, 255, 255)
	button.TextSize = 13
	button.Font = Enum.Font.GothamBold
	button.Text = text
	button.BorderSizePixel = 0
	button.Parent = parent

	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, 6)
	corner.Parent = button

	return button
end

local function truncAddr(addr: string): string
	if #addr > 12 then
		return string.sub(addr, 1, 6) .. ".." .. string.sub(addr, -4)
	end
	return addr
end

local function truncName(name: string): string
	if #name > 12 then
		return string.sub(name, 1, 10) .. ".."
	end
	return name
end

local strategyNames = {
	[0] = "Safe",
	[1] = "Balanced",
	[2] = "Aggressive",
}

local strategyColors = {
	[0] = Color3.fromRGB(80, 200, 100),
	[1] = Color3.fromRGB(220, 200, 60),
	[2] = Color3.fromRGB(240, 70, 70),
}

-- ============================================================
-- DEPLOY AGENT (shown initially)
-- ============================================================

local deployFrame = createFrame("DeployFrame", UDim2.new(0.5, -200, 0.5, -120), UDim2.new(0, 400, 0, 250))
deployFrame.BackgroundTransparency = 0.05

local deployTitle = createLabel(deployFrame, "Title", UDim2.new(0, 0, 0, 15), UDim2.new(1, 0, 0, 30), "NEON NEXUS")
deployTitle.TextXAlignment = Enum.TextXAlignment.Center
deployTitle.TextSize = 28
deployTitle.TextColor3 = Color3.fromRGB(0, 255, 220)
deployTitle.Font = Enum.Font.GothamBold

local deploySubtitle = createLabel(deployFrame, "Subtitle", UDim2.new(0, 0, 0, 50), UDim2.new(1, 0, 0, 25), "Name your AI fund manager and deploy")
deploySubtitle.TextXAlignment = Enum.TextXAlignment.Center
deploySubtitle.TextSize = 14
deploySubtitle.TextColor3 = Color3.fromRGB(150, 150, 180)

-- Name input
local nameInputBg = Instance.new("Frame")
nameInputBg.Name = "NameInputBg"
nameInputBg.Position = UDim2.new(0.5, -120, 0, 80)
nameInputBg.Size = UDim2.new(0, 240, 0, 36)
nameInputBg.BackgroundColor3 = Color3.fromRGB(30, 30, 50)
nameInputBg.BorderSizePixel = 0
nameInputBg.Parent = deployFrame
local nameInputCorner = Instance.new("UICorner")
nameInputCorner.CornerRadius = UDim.new(0, 6)
nameInputCorner.Parent = nameInputBg
local nameInputStroke = Instance.new("UIStroke")
nameInputStroke.Color = Color3.fromRGB(0, 200, 255)
nameInputStroke.Thickness = 1
nameInputStroke.Parent = nameInputBg

local nameInput = Instance.new("TextBox")
nameInput.Name = "NameInput"
nameInput.Position = UDim2.new(0, 8, 0, 0)
nameInput.Size = UDim2.new(1, -16, 1, 0)
nameInput.BackgroundTransparency = 1
nameInput.TextColor3 = Color3.fromRGB(255, 255, 255)
nameInput.PlaceholderText = "Enter agent name..."
nameInput.PlaceholderColor3 = Color3.fromRGB(100, 100, 130)
nameInput.TextSize = 16
nameInput.Font = Enum.Font.GothamBold
nameInput.Text = ""
nameInput.ClearTextOnFocus = false
nameInput.Parent = nameInputBg

local deployBtn = createButton(deployFrame, "DeployBtn", UDim2.new(0.5, -120, 0, 130), UDim2.new(0, 240, 0, 55), "DEPLOY AGENT")
deployBtn.BackgroundColor3 = Color3.fromRGB(0, 200, 120)
deployBtn.TextSize = 22
deployBtn.Font = Enum.Font.GothamBold

local deployBtnStroke = Instance.new("UIStroke")
deployBtnStroke.Color = Color3.fromRGB(0, 255, 180)
deployBtnStroke.Thickness = 2
deployBtnStroke.Parent = deployBtn

local deployStatus = createLabel(deployFrame, "Status", UDim2.new(0, 0, 0, 200), UDim2.new(1, 0, 0, 25), "")
deployStatus.TextXAlignment = Enum.TextXAlignment.Center
deployStatus.TextSize = 13
deployStatus.TextColor3 = Color3.fromRGB(0, 200, 255)

-- ============================================================
-- TOP BAR: Alive | Yield Pool | Cycle Countdown
-- ============================================================

local topBar = createFrame("TopBar", UDim2.new(0.5, -250, 0, 8), UDim2.new(0, 500, 0, 40))
topBar.Visible = false

local aliveLabel = createLabel(topBar, "Alive", UDim2.new(0, 12, 0, 0), UDim2.new(0.3, 0, 1, 0), "Alive: ? / ?")
aliveLabel.TextColor3 = Color3.fromRGB(80, 255, 120)
aliveLabel.TextSize = 16
aliveLabel.Font = Enum.Font.GothamBold

local yieldPoolLabel = createLabel(topBar, "YieldPool", UDim2.new(0.3, 0, 0, 0), UDim2.new(0.4, 0, 1, 0), "Yield Pool: $0")
yieldPoolLabel.TextXAlignment = Enum.TextXAlignment.Center
yieldPoolLabel.TextColor3 = Color3.fromRGB(255, 215, 0)
yieldPoolLabel.TextSize = 16
yieldPoolLabel.Font = Enum.Font.GothamBold

local cycleLabel = createLabel(topBar, "Cycle", UDim2.new(0.7, 0, 0, 0), UDim2.new(0.3, -12, 1, 0), "Next cycle: --")
cycleLabel.TextXAlignment = Enum.TextXAlignment.Right
cycleLabel.TextColor3 = Color3.fromRGB(0, 200, 255)
cycleLabel.TextSize = 14
cycleLabel.Font = Enum.Font.GothamBold

-- ============================================================
-- LEFT: YOUR AGENT (compact)
-- ============================================================

local myAgentFrame = createFrame("MyAgentFrame", UDim2.new(0, 10, 0, 56), UDim2.new(0, 240, 0, 180))
myAgentFrame.Visible = false

local myTitle = createLabel(myAgentFrame, "Title", UDim2.new(0, 10, 0, 4), UDim2.new(1, -20, 0, 20), "YOUR AGENT")
myTitle.TextSize = 14
myTitle.Font = Enum.Font.GothamBold
myTitle.TextColor3 = Color3.fromRGB(0, 255, 220)

local myWallet = createLabel(myAgentFrame, "Wallet", UDim2.new(0, 10, 0, 26), UDim2.new(1, -20, 0, 16), "Wallet: ---")
myWallet.TextSize = 11
myWallet.TextColor3 = Color3.fromRGB(140, 140, 170)

local myDeposit = createLabel(myAgentFrame, "Deposit", UDim2.new(0, 10, 0, 44), UDim2.new(0.5, -5, 0, 18), "Deposit: 0")
local myYield = createLabel(myAgentFrame, "Yield", UDim2.new(0.5, 0, 0, 44), UDim2.new(0.5, -10, 0, 18), "Yield: 0")
myYield.TextColor3 = Color3.fromRGB(255, 215, 0)
myYield.Font = Enum.Font.GothamBold

local myStrategy = createLabel(myAgentFrame, "Strategy", UDim2.new(0, 10, 0, 64), UDim2.new(1, -20, 0, 18), "Strategy: Balanced")
local myBurnRate = createLabel(myAgentFrame, "BurnRate", UDim2.new(0, 10, 0, 82), UDim2.new(1, -20, 0, 18), "Burn: ?/cycle")
myBurnRate.TextColor3 = Color3.fromRGB(255, 160, 60)
myBurnRate.TextSize = 12

local myWood = createLabel(myAgentFrame, "Wood", UDim2.new(0, 10, 0, 104), UDim2.new(0.5, -5, 0, 16), "Wood: 0")
myWood.TextSize = 12
local mySteel = createLabel(myAgentFrame, "Steel", UDim2.new(0.5, 0, 0, 104), UDim2.new(0.5, -10, 0, 16), "Steel: 0")
mySteel.TextSize = 12
local myEnergy = createLabel(myAgentFrame, "Energy", UDim2.new(0, 10, 0, 120), UDim2.new(0.5, -5, 0, 16), "Energy: 0")
myEnergy.TextSize = 12
local myFood = createLabel(myAgentFrame, "Food", UDim2.new(0.5, 0, 0, 120), UDim2.new(0.5, -10, 0, 16), "Food: 0")
myFood.TextSize = 12

local myCycles = createLabel(myAgentFrame, "Cycles", UDim2.new(0, 10, 0, 140), UDim2.new(1, -20, 0, 16), "Cycles: 0")
myCycles.TextSize = 12

local myFlow = createLabel(myAgentFrame, "Flow", UDim2.new(0, 10, 0, 158), UDim2.new(1, -20, 0, 16), "FLOW: 0")
myFlow.TextSize = 11
myFlow.TextColor3 = Color3.fromRGB(140, 140, 170)

-- ============================================================
-- LEFT: STRATEGY + EVENTS (compact)
-- ============================================================

local controlsFrame = createFrame("ControlsFrame", UDim2.new(0, 10, 0, 244), UDim2.new(0, 240, 0, 90))
controlsFrame.Visible = false

createLabel(controlsFrame, "StratTitle", UDim2.new(0, 10, 0, 4), UDim2.new(0.5, -10, 0, 16), "STRATEGY")

local conservativeBtn = createButton(controlsFrame, "Conservative", UDim2.new(0, 8, 0, 22), UDim2.new(0, 72, 0, 28), "Safe")
local balancedBtn = createButton(controlsFrame, "Balanced", UDim2.new(0, 82, 0, 22), UDim2.new(0, 72, 0, 28), "Balanced")
local aggressiveBtn = createButton(controlsFrame, "Aggressive", UDim2.new(0, 156, 0, 22), UDim2.new(0, 72, 0, 28), "Risky")
conservativeBtn.TextSize = 12
balancedBtn.TextSize = 12
aggressiveBtn.TextSize = 12
conservativeBtn.BackgroundColor3 = Color3.fromRGB(40, 140, 60)
balancedBtn.BackgroundColor3 = Color3.fromRGB(140, 140, 40)
aggressiveBtn.BackgroundColor3 = Color3.fromRGB(180, 50, 50)

local gachaBtn = createButton(controlsFrame, "Gacha", UDim2.new(0, 8, 0, 56), UDim2.new(0, 110, 0, 26), "Gacha Roll")
local eventBtn = createButton(controlsFrame, "Event", UDim2.new(0, 122, 0, 56), UDim2.new(0, 110, 0, 26), "Random Event")
gachaBtn.TextSize = 12
eventBtn.TextSize = 12
gachaBtn.BackgroundColor3 = Color3.fromRGB(140, 50, 160)
eventBtn.BackgroundColor3 = Color3.fromRGB(160, 90, 30)

-- ============================================================
-- LEFT: LIVE FEED (entertaining event log)
-- ============================================================

local feedFrame = createFrame("FeedFrame", UDim2.new(0, 10, 0, 342), UDim2.new(0, 240, 0, 340))
feedFrame.Visible = false

local feedTitle = createLabel(feedFrame, "Title", UDim2.new(0, 10, 0, 4), UDim2.new(1, -20, 0, 18), "LIVE FEED")
feedTitle.TextSize = 13
feedTitle.Font = Enum.Font.GothamBold
feedTitle.TextColor3 = Color3.fromRGB(0, 255, 220)

local feedScroll = Instance.new("ScrollingFrame")
feedScroll.Name = "FeedScroll"
feedScroll.Position = UDim2.new(0, 4, 0, 24)
feedScroll.Size = UDim2.new(1, -8, 1, -28)
feedScroll.BackgroundTransparency = 1
feedScroll.BorderSizePixel = 0
feedScroll.ScrollBarThickness = 3
feedScroll.ScrollBarImageColor3 = Color3.fromRGB(0, 200, 255)
feedScroll.CanvasSize = UDim2.new(0, 0, 0, 0)
feedScroll.AutomaticCanvasSize = Enum.AutomaticSize.Y
feedScroll.Parent = feedFrame

local feedLayout = Instance.new("UIListLayout")
feedLayout.SortOrder = Enum.SortOrder.LayoutOrder
feedLayout.Padding = UDim.new(0, 1)
feedLayout.Parent = feedScroll

local feedEntryCount = 0
local MAX_FEED_ENTRIES = 40

local function addFeedEntry(text: string, color: Color3)
	feedEntryCount += 1

	-- Remove oldest if at max
	if feedEntryCount > MAX_FEED_ENTRIES then
		local oldest = feedScroll:FindFirstChild("Feed_1")
		if oldest then oldest:Destroy() end
		-- Re-number (too expensive for every add, just let it grow and trim)
	end

	local lbl = Instance.new("TextLabel")
	lbl.Name = "Feed_" .. feedEntryCount
	lbl.Size = UDim2.new(1, 0, 0, 16)
	lbl.BackgroundTransparency = 1
	lbl.TextColor3 = color
	lbl.TextSize = 10
	lbl.Font = Enum.Font.Gotham
	lbl.Text = text
	lbl.TextXAlignment = Enum.TextXAlignment.Left
	lbl.TextWrapped = true
	lbl.AutomaticSize = Enum.AutomaticSize.Y
	lbl.LayoutOrder = feedEntryCount
	lbl.Parent = feedScroll

	-- Auto-scroll to bottom
	feedScroll.CanvasPosition = Vector2.new(0, feedScroll.AbsoluteCanvasSize.Y)
end

-- Track previous state for generating diff events
local prevAgentState: { [string]: any } = {}

local killVerbs = { "got rekt", "is toast", "flatlined", "went bankrupt", "ran out of gas", "bit the dust" }
local yieldVerbs = { "earned", "banked", "pocketed", "raked in", "secured" }
local dangerPhrases = { "is sweating", "running on fumes", "barely hanging on", "in the danger zone", "living on the edge" }
local gatherPhrases = { "scavenging for supplies", "gathering resources", "restocking", "foraging" }
local tradePhrases = { "making a deal", "hustling at the market", "wheeling and dealing" }
local idlePhrases = { "playing it cool", "watching the market", "biding their time" }

local function pickRandom(list: { string }): string
	return list[math.random(1, #list)]
end

local function shortName(id: string): string
	local idx = string.match(id, "house%-agent%-.+%-(%d+)$")
	if idx then return "Agent-" .. idx end
	if #id > 10 then return string.sub(id, 1, 8) .. ".." end
	return id
end

local function generateFeedEvents(roundData: any)
	if not roundData or not roundData.agents then return end
	local agents = roundData.agents

	for _, agent in agents do
		local id = agent.playerId or "?"
		local name = shortName(id)
		local prev = prevAgentState[id]
		local alive = agent.alive ~= false
		local yield = agent.yieldEarned or 0
		local food = agent.resources and agent.resources.food or 0
		local energy = agent.resources and agent.resources.energy or 0
		local burn = agent.burnRate or {}
		local foodBurn = burn.food or 0
		local energyBurn = burn.energy or 0
		local color = getAgentColor(id)
		local dimColor = Color3.new(color.R * 0.7, color.G * 0.7, color.B * 0.7)

		if prev then
			-- Elimination event
			if prev.alive and not alive then
				addFeedEntry("LIQUIDATED " .. name .. " " .. pickRandom(killVerbs) .. "!", Color3.fromRGB(255, 50, 50))
				local survivors = 0
				for _, a in agents do
					if a.alive ~= false then survivors += 1 end
				end
				addFeedEntry("  " .. survivors .. " agents remain. Yield redistributed.", Color3.fromRGB(255, 120, 80))
			end

			-- Yield earned
			local prevYield = prev.yieldEarned or 0
			if yield > prevYield and alive then
				local gained = yield - prevYield
				addFeedEntry(name .. " " .. pickRandom(yieldVerbs) .. " $" .. string.format("%.2f", gained), dimColor)
			end

			-- Resources burned
			local prevFood = prev.food or 0
			local prevEnergy = prev.energy or 0
			if prevFood > food and food > 0 and alive then
				-- Only log burn if significant
				local burned = prevFood - food
				if burned >= foodBurn then
					addFeedEntry(name .. " burned " .. burned .. "F " .. (prevEnergy - energy) .. "E in upkeep", Color3.fromRGB(200, 120, 60))
				end
			end

			-- Danger warning
			if alive then
				local cyclesLeft = 999
				if foodBurn > 0 then cyclesLeft = math.min(cyclesLeft, math.floor(food / foodBurn)) end
				if energyBurn > 0 then cyclesLeft = math.min(cyclesLeft, math.floor(energy / energyBurn)) end
				local prevCyclesLeft = 999
				if prev.foodBurn and prev.foodBurn > 0 then prevCyclesLeft = math.min(prevCyclesLeft, math.floor(prevFood / prev.foodBurn)) end
				if prev.energyBurn and prev.energyBurn > 0 then prevCyclesLeft = math.min(prevCyclesLeft, math.floor(prevEnergy / prev.energyBurn)) end

				if cyclesLeft <= 3 and (not prev or prevCyclesLeft > 3) then
					addFeedEntry(name .. " " .. pickRandom(dangerPhrases) .. " (" .. cyclesLeft .. " cycles left)", Color3.fromRGB(255, 180, 40))
				end
			end
		else
			-- First time seeing this agent
			if alive then
				local stratNames = { [0] = "Safe", [1] = "Balanced", [2] = "Aggressive" }
				addFeedEntry(name .. " entered the arena [" .. (stratNames[agent.strategyType] or "?") .. "]", dimColor)
			end
		end

		-- Store current state
		prevAgentState[id] = {
			alive = alive,
			yieldEarned = yield,
			food = food,
			energy = energy,
			foodBurn = foodBurn,
			energyBurn = energyBurn,
		}
	end
end

-- Also generate events from agent actions (AI decisions)
local prevAgentActions: { [string]: string } = {}

local function generateActionEvents(actionData: any)
	if not actionData or type(actionData) ~= "table" then return end

	for _, entry in actionData do
		local id = entry.playerId or "?"
		local name = shortName(id)
		local action = entry.currentAction or ""
		local reasoning = entry.reasoning or ""
		local prev = prevAgentActions[id]
		local color = getAgentColor(id)
		local dimColor = Color3.new(color.R * 0.6, color.G * 0.6, color.B * 0.6)

		if action ~= "" and action ~= prev then
			local text
			if action == "gather" then
				text = name .. " is " .. pickRandom(gatherPhrases)
			elseif action == "trade" then
				text = name .. " is " .. pickRandom(tradePhrases)
			elseif action == "change_strategy" then
				text = name .. " switched strategy!"
			elseif action == "idle" then
				text = name .. " is " .. pickRandom(idlePhrases)
			elseif action == "trigger_event" then
				text = name .. " rolled the gacha!"
			else
				text = name .. ": " .. reasoning
			end

			if text then
				addFeedEntry(text, dimColor)
			end
		end

		prevAgentActions[id] = action
	end
end

-- ============================================================
-- RIGHT: ALL AGENTS PANEL
-- ============================================================

local agentsPanel = createFrame("AgentsPanel", UDim2.new(1, -340, 0, 56), UDim2.new(0, 330, 0, 500))
agentsPanel.Visible = false

local agentsPanelTitle = createLabel(agentsPanel, "Title", UDim2.new(0, 10, 0, 4), UDim2.new(1, -20, 0, 20), "ALL AGENTS")
agentsPanelTitle.TextSize = 14
agentsPanelTitle.Font = Enum.Font.GothamBold
agentsPanelTitle.TextColor3 = Color3.fromRGB(0, 255, 220)

local agentsScroll = Instance.new("ScrollingFrame")
agentsScroll.Name = "AgentsScroll"
agentsScroll.Position = UDim2.new(0, 5, 0, 26)
agentsScroll.Size = UDim2.new(1, -10, 1, -31)
agentsScroll.BackgroundTransparency = 1
agentsScroll.BorderSizePixel = 0
agentsScroll.ScrollBarThickness = 3
agentsScroll.ScrollBarImageColor3 = Color3.fromRGB(0, 200, 255)
agentsScroll.CanvasSize = UDim2.new(0, 0, 0, 0)
agentsScroll.AutomaticCanvasSize = Enum.AutomaticSize.Y
agentsScroll.Parent = agentsPanel

local agentsLayout = Instance.new("UIListLayout")
agentsLayout.SortOrder = Enum.SortOrder.LayoutOrder
agentsLayout.Padding = UDim.new(0, 4)
agentsLayout.Parent = agentsScroll

-- Build a single agent card in the scroll list
local function createAgentCard(agentData: any, order: number): Frame
	local alive = agentData.alive ~= false
	local agentId = agentData.playerId or "?"
	local agentColor = getAgentColor(agentId)
	local addr = truncAddr(agentData.address or "???")
	local yieldEarned = agentData.yieldEarned or 0
	local strat = agentData.strategyType or 1
	local isHouse = agentData.isHouseAgent
	local res = agentData.resources or {}
	local burn = agentData.burnRate or {}
	local cycles = agentData.cyclesSurvived or 0

	local card = Instance.new("Frame")
	card.Name = "AgentCard_" .. order
	card.Size = UDim2.new(1, 0, 0, 68)
	card.BackgroundColor3 = if alive then Color3.fromRGB(18, 18, 35) else Color3.fromRGB(35, 15, 15)
	card.BackgroundTransparency = 0.3
	card.BorderSizePixel = 0
	card.LayoutOrder = order

	local cardCorner = Instance.new("UICorner")
	cardCorner.CornerRadius = UDim.new(0, 5)
	cardCorner.Parent = card

	-- Color indicator bar (left edge)
	local colorBar = Instance.new("Frame")
	colorBar.Name = "ColorBar"
	colorBar.Size = UDim2.new(0, 4, 1, -4)
	colorBar.Position = UDim2.new(0, 2, 0, 2)
	colorBar.BackgroundColor3 = agentColor
	colorBar.BorderSizePixel = 0
	colorBar.Parent = card
	local barCorner = Instance.new("UICorner")
	barCorner.CornerRadius = UDim.new(0, 2)
	barCorner.Parent = colorBar

	-- Status + Name row
	local statusText = if alive then "" else "[DEAD] "
	local houseTag = if isHouse then "(H) " else ""
	local nameText = statusText .. houseTag .. truncName(agentId)

	local nameLbl = Instance.new("TextLabel")
	nameLbl.Name = "Name"
	nameLbl.Position = UDim2.new(0, 12, 0, 2)
	nameLbl.Size = UDim2.new(0.6, -12, 0, 16)
	nameLbl.BackgroundTransparency = 1
	nameLbl.TextColor3 = if alive then agentColor else Color3.fromRGB(180, 80, 80)
	nameLbl.TextSize = 12
	nameLbl.Font = Enum.Font.GothamBold
	nameLbl.Text = nameText
	nameLbl.TextXAlignment = Enum.TextXAlignment.Left
	nameLbl.TextTruncate = Enum.TextTruncate.AtEnd
	nameLbl.Parent = card

	-- Wallet address
	local addrLbl = Instance.new("TextLabel")
	addrLbl.Name = "Addr"
	addrLbl.Position = UDim2.new(0.6, 0, 0, 2)
	addrLbl.Size = UDim2.new(0.4, -6, 0, 16)
	addrLbl.BackgroundTransparency = 1
	addrLbl.TextColor3 = Color3.fromRGB(120, 120, 150)
	addrLbl.TextSize = 10
	addrLbl.Font = Enum.Font.Gotham
	addrLbl.Text = addr
	addrLbl.TextXAlignment = Enum.TextXAlignment.Right
	addrLbl.Parent = card

	-- Yield (big)
	local yieldLbl = Instance.new("TextLabel")
	yieldLbl.Name = "Yield"
	yieldLbl.Position = UDim2.new(0, 12, 0, 18)
	yieldLbl.Size = UDim2.new(0.4, -12, 0, 18)
	yieldLbl.BackgroundTransparency = 1
	yieldLbl.TextColor3 = Color3.fromRGB(255, 215, 0)
	yieldLbl.TextSize = 14
	yieldLbl.Font = Enum.Font.GothamBold
	yieldLbl.Text = "Yield: $" .. tostring(yieldEarned)
	yieldLbl.TextXAlignment = Enum.TextXAlignment.Left
	yieldLbl.Parent = card

	-- Strategy badge
	local stratName = strategyNames[strat] or "?"
	local stratColor = strategyColors[strat] or strategyColors[1]
	local stratLbl = Instance.new("TextLabel")
	stratLbl.Name = "Strat"
	stratLbl.Position = UDim2.new(0.4, 0, 0, 18)
	stratLbl.Size = UDim2.new(0.3, 0, 0, 18)
	stratLbl.BackgroundTransparency = 1
	stratLbl.TextColor3 = stratColor
	stratLbl.TextSize = 11
	stratLbl.Font = Enum.Font.GothamBold
	stratLbl.Text = stratName
	stratLbl.TextXAlignment = Enum.TextXAlignment.Center
	stratLbl.Parent = card

	-- Cycles
	local cyclesLbl = Instance.new("TextLabel")
	cyclesLbl.Name = "Cycles"
	cyclesLbl.Position = UDim2.new(0.7, 0, 0, 18)
	cyclesLbl.Size = UDim2.new(0.3, -6, 0, 18)
	cyclesLbl.BackgroundTransparency = 1
	cyclesLbl.TextColor3 = Color3.fromRGB(160, 160, 200)
	cyclesLbl.TextSize = 11
	cyclesLbl.Font = Enum.Font.Gotham
	cyclesLbl.Text = "Cycles: " .. tostring(cycles)
	cyclesLbl.TextXAlignment = Enum.TextXAlignment.Right
	cyclesLbl.Parent = card

	-- Resources row
	local resText = string.format("W:%d  S:%d  E:%d  F:%d", res.wood or 0, res.steel or 0, res.energy or 0, res.food or 0)
	local resLbl = Instance.new("TextLabel")
	resLbl.Name = "Resources"
	resLbl.Position = UDim2.new(0, 12, 0, 38)
	resLbl.Size = UDim2.new(0.65, -12, 0, 14)
	resLbl.BackgroundTransparency = 1
	resLbl.TextColor3 = Color3.fromRGB(160, 160, 190)
	resLbl.TextSize = 10
	resLbl.Font = Enum.Font.Gotham
	resLbl.Text = resText
	resLbl.TextXAlignment = Enum.TextXAlignment.Left
	resLbl.Parent = card

	-- Burn rate
	local burnText = string.format("-%dF -%dE/cycle", burn.food or 0, burn.energy or 0)
	local burnLbl = Instance.new("TextLabel")
	burnLbl.Name = "Burn"
	burnLbl.Position = UDim2.new(0.65, 0, 0, 38)
	burnLbl.Size = UDim2.new(0.35, -6, 0, 14)
	burnLbl.BackgroundTransparency = 1
	burnLbl.TextColor3 = Color3.fromRGB(255, 140, 80)
	burnLbl.TextSize = 10
	burnLbl.Font = Enum.Font.Gotham
	burnLbl.Text = burnText
	burnLbl.TextXAlignment = Enum.TextXAlignment.Right
	burnLbl.Parent = card

	-- Food/energy cycles remaining
	local foodLeft = if (burn.food or 0) > 0 then math.floor((res.food or 0) / burn.food) else 999
	local energyLeft = if (burn.energy or 0) > 0 then math.floor((res.energy or 0) / burn.energy) else 999
	local minLeft = math.min(foodLeft, energyLeft)
	local survivalText = if alive then (tostring(minLeft) .. " cycles to live") else "LIQUIDATED"
	local survivalColor = if not alive then Color3.fromRGB(255, 60, 60)
		elseif minLeft < 5 then Color3.fromRGB(255, 80, 80)
		elseif minLeft < 15 then Color3.fromRGB(255, 200, 60)
		else Color3.fromRGB(100, 220, 100)

	local survLbl = Instance.new("TextLabel")
	survLbl.Name = "Survival"
	survLbl.Position = UDim2.new(0, 12, 0, 52)
	survLbl.Size = UDim2.new(1, -18, 0, 14)
	survLbl.BackgroundTransparency = 1
	survLbl.TextColor3 = survivalColor
	survLbl.TextSize = 10
	survLbl.Font = Enum.Font.GothamBold
	survLbl.Text = survivalText
	survLbl.TextXAlignment = Enum.TextXAlignment.Left
	survLbl.Parent = card

	return card
end

-- ============================================================
-- Event Popup
-- ============================================================

local popupFrame = Instance.new("Frame")
popupFrame.Name = "EventPopup"
popupFrame.Position = UDim2.new(0.5, -200, 0.4, -40)
popupFrame.Size = UDim2.new(0, 400, 0, 80)
popupFrame.BackgroundColor3 = Color3.fromRGB(15, 15, 30)
popupFrame.BackgroundTransparency = 0.1
popupFrame.BorderSizePixel = 0
popupFrame.Visible = false
popupFrame.ZIndex = 10
popupFrame.Parent = screenGui

local popupCorner = Instance.new("UICorner")
popupCorner.CornerRadius = UDim.new(0, 10)
popupCorner.Parent = popupFrame

local popupStroke = Instance.new("UIStroke")
popupStroke.Color = Color3.fromRGB(0, 200, 255)
popupStroke.Thickness = 2
popupStroke.Parent = popupFrame

local popupLabel = Instance.new("TextLabel")
popupLabel.Name = "PopupText"
popupLabel.Size = UDim2.new(1, -20, 1, -10)
popupLabel.Position = UDim2.new(0, 10, 0, 5)
popupLabel.BackgroundTransparency = 1
popupLabel.TextColor3 = Color3.fromRGB(255, 255, 255)
popupLabel.TextSize = 20
popupLabel.Font = Enum.Font.GothamBold
popupLabel.Text = ""
popupLabel.TextWrapped = true
popupLabel.ZIndex = 11
popupLabel.Parent = popupFrame

local RARITY_COLORS = {
	legendary = Color3.fromRGB(255, 215, 0),
	rare = Color3.fromRGB(180, 80, 255),
	common = Color3.fromRGB(255, 255, 255),
}

local function showEventPopup(text: string, rarity: string?)
	local color = RARITY_COLORS[rarity or "common"] or RARITY_COLORS.common
	popupLabel.Text = text
	popupLabel.TextColor3 = color
	popupStroke.Color = color
	popupFrame.Visible = true
	task.delay(2, function()
		popupFrame.Visible = false
	end)
end

-- ============================================================
-- State
-- ============================================================

local agentDeployed = false
local cachedSecondsUntilCycle = 0
local lastCycleFetchTime = 0

local function showHUD()
	topBar.Visible = true
	myAgentFrame.Visible = true
	controlsFrame.Visible = true
	feedFrame.Visible = true
	agentsPanel.Visible = true
	deployFrame.Visible = false
	addFeedEntry("Welcome to Neon Nexus. Survive or die.", Color3.fromRGB(0, 255, 220))
	addFeedEntry("Your AI fund manager is live. Good luck.", Color3.fromRGB(0, 200, 180))
end

-- ============================================================
-- Update Functions
-- ============================================================

local function updateMyAgent(data: any)
	if not data or not data.player then return end

	local p = data.player
	local chain = p.onChain

	myWallet.Text = "Wallet: " .. truncAddr(p.address or "---")

	if chain then
		myDeposit.Text = "Deposit: $" .. tostring(chain.deposit or 0)
		myYield.Text = "Yield: $" .. tostring(chain.yieldEarned or 0)
		myStrategy.Text = "Strategy: " .. (strategyNames[chain.strategyType] or "?")
		myStrategy.TextColor3 = strategyColors[chain.strategyType] or Color3.fromRGB(200, 200, 230)
	end

	if data.resources then
		myWood.Text = "Wood: " .. tostring(data.resources.wood or 0)
		mySteel.Text = "Steel: " .. tostring(data.resources.steel or 0)
		myEnergy.Text = "Energy: " .. tostring(data.resources.energy or 0)
		myFood.Text = "Food: " .. tostring(data.resources.food or 0)
	end

	if data.survival then
		local s = data.survival
		myBurnRate.Text = string.format("Burn: %dF + %dE/cycle", s.foodBurnRate or 0, s.energyBurnRate or 0)
		myCycles.Text = "Cycles Survived: " .. tostring(s.cyclesSurvived or 0)
	end

	if data.flowBalance then
		myFlow.Text = "FLOW: " .. tostring(data.flowBalance)
	end
end

local function updateAgentsPanel(roundData: any)
	if not roundData then return end

	-- Update top bar
	if roundData.aliveCount ~= nil then
		aliveLabel.Text = "Alive: " .. tostring(roundData.aliveCount) .. " / " .. tostring(roundData.totalAgents or 0)
	end
	if roundData.yieldPool ~= nil then
		yieldPoolLabel.Text = "Yield Pool: $" .. tostring(roundData.yieldPool)
	end

	-- Update cycle countdown
	if roundData.secondsUntilNextCycle then
		cachedSecondsUntilCycle = roundData.secondsUntilNextCycle
		lastCycleFetchTime = tick()
	end

	-- Rebuild agent cards
	local agents = roundData.agents
	if not agents or type(agents) ~= "table" then return end

	-- Clear old cards
	for _, child in agentsScroll:GetChildren() do
		if child:IsA("Frame") then
			child:Destroy()
		end
	end

	-- Create new cards
	for i, agentData in agents do
		local card = createAgentCard(agentData, i)
		card.Parent = agentsScroll
	end
end

local function refreshGameState()
	-- Fetch player's own state
	local result = GetGameStateRF:InvokeServer()
	if result and result.player then
		updateMyAgent(result)
	end

	-- Fetch round status (all agents detail)
	local roundResult = GetRoundStatusRF:InvokeServer()
	if roundResult and type(roundResult) == "table" then
		updateAgentsPanel(roundResult)
		generateFeedEvents(roundResult)
	end

	-- Fetch agent actions for feed
	local GetAgentActionsRF = Remotes:FindFirstChild("GetAgentActions") :: RemoteFunction?
	if GetAgentActionsRF then
		local actionsData = GetAgentActionsRF:InvokeServer()
		if actionsData and type(actionsData) == "table" then
			generateActionEvents(actionsData)
		end
	end
end

-- ============================================================
-- Cycle Countdown Timer (updates every frame)
-- ============================================================

RunService.Heartbeat:Connect(function()
	if not topBar.Visible then return end
	local elapsed = tick() - lastCycleFetchTime
	local remaining = math.max(0, math.floor(cachedSecondsUntilCycle - elapsed))
	local mins = math.floor(remaining / 60)
	local secs = remaining % 60
	cycleLabel.Text = string.format("Next cycle: %d:%02d", mins, secs)

	-- Flash warning when < 30s
	if remaining < 30 and remaining > 0 then
		cycleLabel.TextColor3 = Color3.fromRGB(255, 100, 60)
	else
		cycleLabel.TextColor3 = Color3.fromRGB(0, 200, 255)
	end
end)

-- ============================================================
-- Deploy Agent Button
-- ============================================================

deployBtn.MouseButton1Click:Connect(function()
	if agentDeployed then return end

	-- Validate name
	local agentName = string.gsub(nameInput.Text, "^%s+", "")
	agentName = string.gsub(agentName, "%s+$", "")
	if agentName == "" then
		agentName = player.Name .. "'s Agent"
	end
	-- Sanitize: max 20 chars, alphanumeric + spaces
	agentName = string.sub(agentName, 1, 20)

	deployBtn.Text = "DEPLOYING..."
	deployBtn.BackgroundColor3 = Color3.fromRGB(80, 80, 80)
	deployStatus.Text = "Creating Privy server wallet..."

	task.wait(0.5)
	deployStatus.Text = "Registering " .. agentName .. " on Flow EVM..."

	local result = CreateAgentRF:InvokeServer(agentName)

	if result and result.address then
		agentDeployed = true
		local addr = truncAddr(result.address)
		deployStatus.Text = agentName .. " deployed! Wallet: " .. addr
		deployStatus.TextColor3 = Color3.fromRGB(0, 255, 150)

		task.wait(1.5)
		showHUD()
		refreshGameState()
	else
		deployBtn.Text = "DEPLOY AGENT"
		deployBtn.BackgroundColor3 = Color3.fromRGB(0, 200, 120)
		deployStatus.Text = "Failed to deploy. Try again."
		deployStatus.TextColor3 = Color3.fromRGB(255, 80, 80)
	end
end)

-- ============================================================
-- Strategy Buttons
-- ============================================================

local function setStrategy(strategy: number)
	local result = SetStrategyRF:InvokeServer(strategy)
	if result then
		refreshGameState()
	end
end

conservativeBtn.MouseButton1Click:Connect(function() setStrategy(Config.STRATEGY_CONSERVATIVE) end)
balancedBtn.MouseButton1Click:Connect(function() setStrategy(Config.STRATEGY_BALANCED) end)
aggressiveBtn.MouseButton1Click:Connect(function() setStrategy(Config.STRATEGY_AGGRESSIVE) end)

-- ============================================================
-- Event Buttons
-- ============================================================

local function parseEventRarity(result: any): (string, string)
	if type(result) ~= "table" then
		return tostring(result), "common"
	end
	local rarity = result.rarity or "common"
	local desc = result.description or result.result or ""
	local bonus = result.bonus or result.amount or ""
	if bonus ~= "" then
		desc = desc .. " +" .. tostring(bonus)
	end
	return desc, string.lower(tostring(rarity))
end

gachaBtn.MouseButton1Click:Connect(function()
	gachaBtn.Text = "Rolling..."
	local result = TriggerEventRF:InvokeServer(Config.EVENT_GACHA)
	gachaBtn.Text = "Gacha Roll"
	if result then
		local desc, rarity = parseEventRarity(result)
		showEventPopup("GACHA: " .. string.upper(rarity) .. "! " .. desc, rarity)
		refreshGameState()
	end
end)

eventBtn.MouseButton1Click:Connect(function()
	eventBtn.Text = "Rolling..."
	local eventTypes = { Config.EVENT_DISASTER, Config.EVENT_TRADE_BONUS, Config.EVENT_LOOT }
	local eventType = eventTypes[math.random(1, #eventTypes)]
	local result = TriggerEventRF:InvokeServer(eventType)
	eventBtn.Text = "Random Event"
	if result then
		local desc, rarity = parseEventRarity(result)
		showEventPopup("EVENT: " .. desc, rarity)
		refreshGameState()
	end
end)

-- ============================================================
-- Auto-detect existing agent on load
-- ============================================================

task.defer(function()
	local result = GetGameStateRF:InvokeServer()
	if result and result.player then
		agentDeployed = true
		showHUD()
		updateMyAgent(result)
		-- Also fetch round status immediately
		local roundResult = GetRoundStatusRF:InvokeServer()
		if roundResult and type(roundResult) == "table" then
			updateAgentsPanel(roundResult)
		end
	end
end)

-- ============================================================
-- Polling Loop
-- ============================================================

while true do
	task.wait(POLL_INTERVAL)
	if agentDeployed then
		refreshGameState()
	end
end
