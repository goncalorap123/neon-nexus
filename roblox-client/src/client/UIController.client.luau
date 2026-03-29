local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")

local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")

-- Wait for remotes to be created by the server
local Remotes = ReplicatedStorage:WaitForChild("Remotes")
local CreateAgentRF = Remotes:WaitForChild("CreateAgent") :: RemoteFunction
local SetStrategyRF = Remotes:WaitForChild("SetStrategy") :: RemoteFunction
local GetGameStateRF = Remotes:WaitForChild("GetGameState") :: RemoteFunction
local TriggerEventRF = Remotes:WaitForChild("TriggerEvent") :: RemoteFunction
local GetLeaderboardRF = Remotes:WaitForChild("GetLeaderboard") :: RemoteFunction

local Config = require(ReplicatedStorage:WaitForChild("Config"))
local Utils = require(ReplicatedStorage:WaitForChild("Utils"))

local POLL_INTERVAL = 10 -- seconds

-- ============================================================
-- UI Creation
-- ============================================================

local screenGui = Instance.new("ScreenGui")
screenGui.Name = "NeonNexusUI"
screenGui.ResetOnSpawn = false
screenGui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
screenGui.Parent = playerGui

-- Helper to create a Frame
local function createFrame(name: string, position: UDim2, size: UDim2): Frame
	local frame = Instance.new("Frame")
	frame.Name = name
	frame.Position = position
	frame.Size = size
	frame.BackgroundColor3 = Color3.fromRGB(20, 20, 35)
	frame.BackgroundTransparency = 0.15
	frame.BorderSizePixel = 0
	frame.Parent = screenGui

	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, 8)
	corner.Parent = frame

	local stroke = Instance.new("UIStroke")
	stroke.Color = Color3.fromRGB(0, 200, 255)
	stroke.Thickness = 1
	stroke.Parent = frame

	return frame
end

-- Helper to create a TextLabel
local function createLabel(parent: Instance, name: string, position: UDim2, size: UDim2, text: string): TextLabel
	local label = Instance.new("TextLabel")
	label.Name = name
	label.Position = position
	label.Size = size
	label.BackgroundTransparency = 1
	label.TextColor3 = Color3.fromRGB(220, 220, 255)
	label.TextSize = 14
	label.Font = Enum.Font.GothamBold
	label.Text = text
	label.TextXAlignment = Enum.TextXAlignment.Left
	label.Parent = parent
	return label
end

-- Helper to create a TextButton
local function createButton(parent: Instance, name: string, position: UDim2, size: UDim2, text: string): TextButton
	local button = Instance.new("TextButton")
	button.Name = name
	button.Position = position
	button.Size = size
	button.BackgroundColor3 = Color3.fromRGB(0, 120, 180)
	button.TextColor3 = Color3.fromRGB(255, 255, 255)
	button.TextSize = 14
	button.Font = Enum.Font.GothamBold
	button.Text = text
	button.BorderSizePixel = 0
	button.Parent = parent

	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, 6)
	corner.Parent = button

	return button
end

-- ============================================================
-- Agent Status Panel (top-left)
-- ============================================================

local statusFrame = createFrame("StatusFrame", UDim2.new(0, 10, 0, 10), UDim2.new(0, 260, 0, 180))

createLabel(statusFrame, "Title", UDim2.new(0, 10, 0, 5), UDim2.new(1, -20, 0, 25), "AGENT STATUS")

local nameLabel = createLabel(statusFrame, "Name", UDim2.new(0, 10, 0, 30), UDim2.new(1, -20, 0, 20), "Name: ---")
local scoreLabel = createLabel(statusFrame, "Score", UDim2.new(0, 10, 0, 52), UDim2.new(1, -20, 0, 20), "Score: ---")
local strategyLabel = createLabel(statusFrame, "Strategy", UDim2.new(0, 10, 0, 74), UDim2.new(1, -20, 0, 20), "Strategy: ---")
local woodLabel = createLabel(statusFrame, "Wood", UDim2.new(0, 10, 0, 100), UDim2.new(0.5, -10, 0, 20), "Wood: 0")
local steelLabel = createLabel(statusFrame, "Steel", UDim2.new(0.5, 0, 0, 100), UDim2.new(0.5, -10, 0, 20), "Steel: 0")
local energyLabel = createLabel(statusFrame, "Energy", UDim2.new(0, 10, 0, 122), UDim2.new(0.5, -10, 0, 20), "Energy: 0")
local foodLabel = createLabel(statusFrame, "Food", UDim2.new(0.5, 0, 0, 122), UDim2.new(0.5, -10, 0, 20), "Food: 0")
local aliveLabel = createLabel(statusFrame, "Alive", UDim2.new(0, 10, 0, 148), UDim2.new(1, -20, 0, 20), "Status: ---")

-- ============================================================
-- Strategy Selector (top-left, below status)
-- ============================================================

local strategyFrame = createFrame("StrategyFrame", UDim2.new(0, 10, 0, 200), UDim2.new(0, 260, 0, 100))

createLabel(strategyFrame, "Title", UDim2.new(0, 10, 0, 5), UDim2.new(1, -20, 0, 25), "SELECT STRATEGY")

local conservativeBtn = createButton(strategyFrame, "Conservative", UDim2.new(0, 10, 0, 35), UDim2.new(0, 72, 0, 50), "Safe")
local balancedBtn = createButton(strategyFrame, "Balanced", UDim2.new(0, 90, 0, 35), UDim2.new(0, 72, 0, 50), "Balanced")
local aggressiveBtn = createButton(strategyFrame, "Aggressive", UDim2.new(0, 170, 0, 35), UDim2.new(0, 72, 0, 50), "Risky")

conservativeBtn.BackgroundColor3 = Color3.fromRGB(40, 140, 60)
balancedBtn.BackgroundColor3 = Color3.fromRGB(140, 140, 40)
aggressiveBtn.BackgroundColor3 = Color3.fromRGB(180, 50, 50)

-- ============================================================
-- Event Trigger Panel (below strategy)
-- ============================================================

local eventFrame = createFrame("EventFrame", UDim2.new(0, 10, 0, 310), UDim2.new(0, 260, 0, 60))

createLabel(eventFrame, "Title", UDim2.new(0, 10, 0, 5), UDim2.new(1, -20, 0, 20), "TRIGGER EVENT")

local gachaBtn = createButton(eventFrame, "Gacha", UDim2.new(0, 10, 0, 28), UDim2.new(0, 115, 0, 25), "Gacha Roll")
local disasterBtn = createButton(eventFrame, "Disaster", UDim2.new(0, 133, 0, 28), UDim2.new(0, 115, 0, 25), "Random Event")
gachaBtn.BackgroundColor3 = Color3.fromRGB(160, 60, 180)
disasterBtn.BackgroundColor3 = Color3.fromRGB(180, 100, 30)

-- ============================================================
-- Leaderboard Panel (top-right)
-- ============================================================

local leaderboardFrame = createFrame("LeaderboardFrame", UDim2.new(1, -270, 0, 10), UDim2.new(0, 260, 0, 300))

createLabel(leaderboardFrame, "Title", UDim2.new(0, 10, 0, 5), UDim2.new(1, -20, 0, 25), "LEADERBOARD")

local leaderboardLabels: { TextLabel } = {}
for i = 1, 10 do
	local lbl = createLabel(
		leaderboardFrame,
		"Entry" .. i,
		UDim2.new(0, 10, 0, 25 + (i * 25)),
		UDim2.new(1, -20, 0, 22),
		""
	)
	lbl.TextSize = 13
	lbl.Font = Enum.Font.Gotham
	table.insert(leaderboardLabels, lbl)
end

-- ============================================================
-- State & Update Logic
-- ============================================================

local currentAgentId: string? = nil

local strategyNames = {
	[0] = "Conservative",
	[1] = "Balanced",
	[2] = "Aggressive",
}

local function updateStatusUI(agent: any)
	if not agent then
		return
	end
	nameLabel.Text = "Name: " .. (agent.name or "Unknown")
	scoreLabel.Text = "Score: " .. Utils.formatNumber(agent.score or 0)
	strategyLabel.Text = "Strategy: " .. (strategyNames[agent.strategy] or "Unknown")
	if agent.resources then
		woodLabel.Text = "Wood: " .. Utils.formatNumber(agent.resources.wood or 0)
		steelLabel.Text = "Steel: " .. Utils.formatNumber(agent.resources.steel or 0)
		energyLabel.Text = "Energy: " .. Utils.formatNumber(agent.resources.energy or 0)
		foodLabel.Text = "Food: " .. Utils.formatNumber(agent.resources.food or 0)
	end
	aliveLabel.Text = "Status: " .. (if agent.alive then "Alive" else "Dead")
	aliveLabel.TextColor3 = if agent.alive then Color3.fromRGB(100, 255, 100) else Color3.fromRGB(255, 80, 80)
end

local function updateLeaderboardUI(entries: any)
	if not entries then
		return
	end
	for i, lbl in ipairs(leaderboardLabels) do
		if entries[i] then
			local entry = entries[i]
			lbl.Text = string.format("#%d  %s  -  %s", entry.rank or i, entry.agentName or "???", Utils.formatNumber(entry.score or 0))
		else
			lbl.Text = ""
		end
	end
end

local function refreshGameState()
	local result = GetGameStateRF:InvokeServer()
	if result and result.success and result.data then
		local agents = result.data.agents
		if agents then
			-- Find the current player's agent
			for _, agent in ipairs(agents) do
				if agent.name == player.Name then
					currentAgentId = agent.id
					updateStatusUI(agent)
					break
				end
			end
		end
	end

	-- Also refresh leaderboard
	local lbResult = GetLeaderboardRF:InvokeServer()
	if lbResult and lbResult.success and lbResult.data then
		updateLeaderboardUI(lbResult.data)
	end
end

-- ============================================================
-- Button Handlers
-- ============================================================

local function setStrategy(strategy: number)
	local result = SetStrategyRF:InvokeServer(strategy)
	if result and result.success then
		print("[UI] Strategy set to", strategyNames[strategy])
		refreshGameState()
	else
		warn("[UI] Failed to set strategy")
	end
end

conservativeBtn.MouseButton1Click:Connect(function()
	setStrategy(Config.STRATEGY_CONSERVATIVE)
end)

balancedBtn.MouseButton1Click:Connect(function()
	setStrategy(Config.STRATEGY_BALANCED)
end)

aggressiveBtn.MouseButton1Click:Connect(function()
	setStrategy(Config.STRATEGY_AGGRESSIVE)
end)

gachaBtn.MouseButton1Click:Connect(function()
	local result = TriggerEventRF:InvokeServer(Config.EVENT_GACHA)
	if result and result.success then
		print("[UI] Gacha event triggered!")
		refreshGameState()
	else
		warn("[UI] Failed to trigger gacha event")
	end
end)

disasterBtn.MouseButton1Click:Connect(function()
	-- Pick a random non-gacha event type
	local eventTypes = { Config.EVENT_DISASTER, Config.EVENT_TRADE_BONUS, Config.EVENT_LOOT }
	local eventType = eventTypes[math.random(1, #eventTypes)]
	local result = TriggerEventRF:InvokeServer(eventType)
	if result and result.success then
		print("[UI] Random event triggered!")
		refreshGameState()
	else
		warn("[UI] Failed to trigger event")
	end
end)

-- ============================================================
-- Polling Loop
-- ============================================================

-- Initial refresh
task.defer(refreshGameState)

-- Periodic polling
while true do
	task.wait(POLL_INTERVAL)
	refreshGameState()
end
