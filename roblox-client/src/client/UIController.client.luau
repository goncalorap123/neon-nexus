local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")

local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")

-- Wait for remotes
local Remotes = ReplicatedStorage:WaitForChild("Remotes")
local CreateAgentRF = Remotes:WaitForChild("CreateAgent") :: RemoteFunction
local SetStrategyRF = Remotes:WaitForChild("SetStrategy") :: RemoteFunction
local GetGameStateRF = Remotes:WaitForChild("GetGameState") :: RemoteFunction
local TriggerEventRF = Remotes:WaitForChild("TriggerEvent") :: RemoteFunction
local GetLeaderboardRF = Remotes:WaitForChild("GetLeaderboard") :: RemoteFunction

local Config = require(ReplicatedStorage:WaitForChild("Config"))

local POLL_INTERVAL = 8

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
-- DEPLOY AGENT - Big center button (shown initially)
-- ============================================================

local deployFrame = createFrame("DeployFrame", UDim2.new(0.5, -200, 0.5, -100), UDim2.new(0, 400, 0, 200))
deployFrame.BackgroundTransparency = 0.05

local deployTitle = createLabel(deployFrame, "Title", UDim2.new(0, 0, 0, 15), UDim2.new(1, 0, 0, 30), "NEON NEXUS")
deployTitle.TextXAlignment = Enum.TextXAlignment.Center
deployTitle.TextSize = 28
deployTitle.TextColor3 = Color3.fromRGB(0, 255, 220)

local deploySubtitle = createLabel(deployFrame, "Subtitle", UDim2.new(0, 0, 0, 50), UDim2.new(1, 0, 0, 25), "Deploy your AI agent to the Flow blockchain")
deploySubtitle.TextXAlignment = Enum.TextXAlignment.Center
deploySubtitle.TextSize = 14
deploySubtitle.TextColor3 = Color3.fromRGB(150, 150, 180)

local deployBtn = createButton(deployFrame, "DeployBtn", UDim2.new(0.5, -120, 0, 90), UDim2.new(0, 240, 0, 55), "DEPLOY AGENT")
deployBtn.BackgroundColor3 = Color3.fromRGB(0, 200, 120)
deployBtn.TextSize = 22
deployBtn.Font = Enum.Font.GothamBold

local deployBtnStroke = Instance.new("UIStroke")
deployBtnStroke.Color = Color3.fromRGB(0, 255, 180)
deployBtnStroke.Thickness = 2
deployBtnStroke.Parent = deployBtn

local deployStatus = createLabel(deployFrame, "Status", UDim2.new(0, 0, 0, 155), UDim2.new(1, 0, 0, 25), "")
deployStatus.TextXAlignment = Enum.TextXAlignment.Center
deployStatus.TextSize = 13
deployStatus.TextColor3 = Color3.fromRGB(0, 200, 255)

-- ============================================================
-- Game HUD (hidden until agent deployed)
-- ============================================================

local hudContainer = Instance.new("Folder")
hudContainer.Name = "HUDContainer"
hudContainer.Parent = screenGui

-- Agent Status Panel (top-left)
local statusFrame = createFrame("StatusFrame", UDim2.new(0, 10, 0, 10), UDim2.new(0, 260, 0, 180))
statusFrame.Visible = false
statusFrame.Parent = hudContainer

createLabel(statusFrame, "Title", UDim2.new(0, 10, 0, 5), UDim2.new(1, -20, 0, 25), "AGENT STATUS")

local walletLabel = createLabel(statusFrame, "Wallet", UDim2.new(0, 10, 0, 30), UDim2.new(1, -20, 0, 20), "Wallet: ---")
walletLabel.TextSize = 11
local depositLabel = createLabel(statusFrame, "Deposit", UDim2.new(0, 10, 0, 52), UDim2.new(1, -20, 0, 20), "Deposit: 0")
local yieldLabel = createLabel(statusFrame, "Yield", UDim2.new(0, 10, 0, 74), UDim2.new(1, -20, 0, 20), "Yield: 0")
local strategyLabel = createLabel(statusFrame, "Strategy", UDim2.new(0, 10, 0, 96), UDim2.new(1, -20, 0, 20), "Strategy: Balanced")
local woodLabel = createLabel(statusFrame, "Wood", UDim2.new(0, 10, 0, 122), UDim2.new(0.5, -10, 0, 20), "Wood: 0")
local steelLabel = createLabel(statusFrame, "Steel", UDim2.new(0.5, 0, 0, 122), UDim2.new(0.5, -10, 0, 20), "Steel: 0")
local energyLabel = createLabel(statusFrame, "Energy", UDim2.new(0, 10, 0, 148), UDim2.new(0.5, -10, 0, 20), "Energy: 0")
local foodLabel = createLabel(statusFrame, "Food", UDim2.new(0.5, 0, 0, 148), UDim2.new(0.5, -10, 0, 20), "Food: 0")

-- Strategy Selector
local strategyFrame = createFrame("StrategyFrame", UDim2.new(0, 10, 0, 200), UDim2.new(0, 260, 0, 100))
strategyFrame.Visible = false
strategyFrame.Parent = hudContainer

createLabel(strategyFrame, "Title", UDim2.new(0, 10, 0, 5), UDim2.new(1, -20, 0, 25), "SELECT STRATEGY")

local conservativeBtn = createButton(strategyFrame, "Conservative", UDim2.new(0, 10, 0, 35), UDim2.new(0, 72, 0, 50), "Safe")
local balancedBtn = createButton(strategyFrame, "Balanced", UDim2.new(0, 90, 0, 35), UDim2.new(0, 72, 0, 50), "Balanced")
local aggressiveBtn = createButton(strategyFrame, "Aggressive", UDim2.new(0, 170, 0, 35), UDim2.new(0, 72, 0, 50), "Risky")

conservativeBtn.BackgroundColor3 = Color3.fromRGB(40, 140, 60)
balancedBtn.BackgroundColor3 = Color3.fromRGB(140, 140, 40)
aggressiveBtn.BackgroundColor3 = Color3.fromRGB(180, 50, 50)

-- Event Trigger Panel
local eventFrame = createFrame("EventFrame", UDim2.new(0, 10, 0, 310), UDim2.new(0, 260, 0, 60))
eventFrame.Visible = false
eventFrame.Parent = hudContainer

createLabel(eventFrame, "Title", UDim2.new(0, 10, 0, 5), UDim2.new(1, -20, 0, 20), "TRIGGER EVENT")

local gachaBtn = createButton(eventFrame, "Gacha", UDim2.new(0, 10, 0, 28), UDim2.new(0, 115, 0, 25), "Gacha Roll")
local eventBtn = createButton(eventFrame, "Event", UDim2.new(0, 133, 0, 28), UDim2.new(0, 115, 0, 25), "Random Event")
gachaBtn.BackgroundColor3 = Color3.fromRGB(160, 60, 180)
eventBtn.BackgroundColor3 = Color3.fromRGB(180, 100, 30)

-- Leaderboard Panel (top-right)
local leaderboardFrame = createFrame("LeaderboardFrame", UDim2.new(1, -270, 0, 10), UDim2.new(0, 260, 0, 300))
leaderboardFrame.Visible = false
leaderboardFrame.Parent = hudContainer

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
-- State
-- ============================================================

local agentDeployed = false
local strategyNames = {
	[0] = "Conservative",
	[1] = "Balanced",
	[2] = "Aggressive",
}

local function showHUD()
	statusFrame.Visible = true
	strategyFrame.Visible = true
	eventFrame.Visible = true
	leaderboardFrame.Visible = true
	deployFrame.Visible = false
end

-- ============================================================
-- Update UI from backend data
-- ============================================================

local function updateStatusUI(data: any)
	if not data or not data.player then return end

	local p = data.player
	local chain = p.onChain

	-- Wallet (truncated)
	local addr = p.address or "---"
	if #addr > 12 then
		addr = string.sub(addr, 1, 6) .. "..." .. string.sub(addr, -4)
	end
	walletLabel.Text = "Wallet: " .. addr

	if chain then
		depositLabel.Text = "Deposit: " .. tostring(chain.deposit or 0)
		yieldLabel.Text = "Yield: " .. tostring(chain.yieldEarned or 0)
		strategyLabel.Text = "Strategy: " .. (strategyNames[chain.strategyType] or "Unknown")
	end

	if data.resources then
		woodLabel.Text = "Wood: " .. tostring(data.resources.wood or 0)
		steelLabel.Text = "Steel: " .. tostring(data.resources.steel or 0)
		energyLabel.Text = "Energy: " .. tostring(data.resources.energy or 0)
		foodLabel.Text = "Food: " .. tostring(data.resources.food or 0)
	end
end

local function updateLeaderboardUI(entries: any)
	if not entries or type(entries) ~= "table" then return end
	for i, lbl in ipairs(leaderboardLabels) do
		if entries[i] then
			local e = entries[i]
			local name = e.playerId or "???"
			local deposit = (e.onChain and e.onChain.deposit) or "0"
			lbl.Text = string.format("#%d  %s  -  %s", i, name, tostring(deposit))
			lbl.TextColor3 = Color3.fromRGB(220, 220, 255)
		else
			lbl.Text = ""
		end
	end
end

local function refreshGameState()
	local result = GetGameStateRF:InvokeServer()
	if result and result.player then
		updateStatusUI(result)
	end

	local lbResult = GetLeaderboardRF:InvokeServer()
	if lbResult and type(lbResult) == "table" then
		updateLeaderboardUI(lbResult)
	end
end

-- ============================================================
-- Deploy Agent Button
-- ============================================================

deployBtn.MouseButton1Click:Connect(function()
	if agentDeployed then return end

	deployBtn.Text = "DEPLOYING..."
	deployBtn.BackgroundColor3 = Color3.fromRGB(80, 80, 80)
	deployStatus.Text = "Creating Privy server wallet..."

	task.wait(0.5)
	deployStatus.Text = "Registering agent on Flow EVM..."

	local result = CreateAgentRF:InvokeServer()

	if result and result.address then
		agentDeployed = true
		local addr = result.address
		if #addr > 12 then
			addr = string.sub(addr, 1, 6) .. "..." .. string.sub(addr, -4)
		end
		deployStatus.Text = "Agent deployed! Wallet: " .. addr
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
		print("[UI] Strategy set to", strategyNames[strategy])
		refreshGameState()
	end
end

conservativeBtn.MouseButton1Click:Connect(function() setStrategy(Config.STRATEGY_CONSERVATIVE) end)
balancedBtn.MouseButton1Click:Connect(function() setStrategy(Config.STRATEGY_BALANCED) end)
aggressiveBtn.MouseButton1Click:Connect(function() setStrategy(Config.STRATEGY_AGGRESSIVE) end)

-- ============================================================
-- Event Buttons
-- ============================================================

gachaBtn.MouseButton1Click:Connect(function()
	gachaBtn.Text = "Rolling..."
	local result = TriggerEventRF:InvokeServer(Config.EVENT_GACHA)
	gachaBtn.Text = "Gacha Roll"
	if result then
		print("[UI] Gacha result:", result)
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
		print("[UI] Event result:", result)
		refreshGameState()
	end
end)

-- ============================================================
-- Check if agent already exists on load
-- ============================================================

task.defer(function()
	local result = GetGameStateRF:InvokeServer()
	if result and result.player then
		agentDeployed = true
		showHUD()
		updateStatusUI(result)
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
