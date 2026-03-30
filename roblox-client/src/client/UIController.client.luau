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
local GetAgentHistoryRF = Remotes:WaitForChild("GetAgentHistory") :: RemoteFunction
local GetRoundStatusRF = Remotes:WaitForChild("GetRoundStatus") :: RemoteFunction

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
local statusFrame = createFrame("StatusFrame", UDim2.new(0, 10, 0, 10), UDim2.new(0, 260, 0, 240))
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

local flowBalanceLabel = createLabel(statusFrame, "FlowBalance", UDim2.new(0, 10, 0, 174), UDim2.new(1, -20, 0, 20), "FLOW: 0")
local scoreLabel = createLabel(statusFrame, "Score", UDim2.new(0, 10, 0, 198), UDim2.new(1, -20, 0, 28), "Score: 0")
scoreLabel.TextSize = 20
scoreLabel.TextColor3 = Color3.fromRGB(0, 255, 255)
scoreLabel.Font = Enum.Font.GothamBold

-- Expand status frame to fit survival info
statusFrame.Size = UDim2.new(0, 260, 0, 320)

-- Survival section
local aliveLabel = createLabel(statusFrame, "Alive", UDim2.new(0, 10, 0, 232), UDim2.new(1, -20, 0, 20), "Alive: ? / ?")
aliveLabel.TextColor3 = Color3.fromRGB(80, 255, 120)
aliveLabel.TextSize = 15
aliveLabel.Font = Enum.Font.GothamBold

local yieldPoolLabel = createLabel(statusFrame, "YieldPool", UDim2.new(0, 10, 0, 254), UDim2.new(1, -20, 0, 20), "Yield Pool: $0")
yieldPoolLabel.TextColor3 = Color3.fromRGB(255, 215, 0)
yieldPoolLabel.TextSize = 15
yieldPoolLabel.Font = Enum.Font.GothamBold

local burnRateLabel = createLabel(statusFrame, "BurnRate", UDim2.new(0, 10, 0, 276), UDim2.new(1, -20, 0, 20), "Costs: ?/cycle")
burnRateLabel.TextColor3 = Color3.fromRGB(255, 160, 60)
burnRateLabel.TextSize = 13

local cyclesSurvivedLabel = createLabel(statusFrame, "Cycles", UDim2.new(0, 10, 0, 296), UDim2.new(1, -20, 0, 20), "Cycles: 0")
cyclesSurvivedLabel.TextColor3 = Color3.fromRGB(180, 180, 220)

-- Strategy Selector
local strategyFrame = createFrame("StrategyFrame", UDim2.new(0, 10, 0, 340), UDim2.new(0, 260, 0, 100))
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
local eventFrame = createFrame("EventFrame", UDim2.new(0, 10, 0, 450), UDim2.new(0, 260, 0, 60))
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

-- Agent Activity Feed (left side, below events)
local activityFrame = createFrame("ActivityFrame", UDim2.new(0, 10, 0, 520), UDim2.new(0, 260, 0, 260))
activityFrame.Visible = false
activityFrame.Parent = hudContainer

createLabel(activityFrame, "Title", UDim2.new(0, 10, 0, 5), UDim2.new(1, -20, 0, 25), "AGENT ACTIVITY")

local activityScroll = Instance.new("ScrollingFrame")
activityScroll.Name = "ActivityScroll"
activityScroll.Position = UDim2.new(0, 5, 0, 30)
activityScroll.Size = UDim2.new(1, -10, 1, -35)
activityScroll.BackgroundTransparency = 1
activityScroll.BorderSizePixel = 0
activityScroll.ScrollBarThickness = 4
activityScroll.ScrollBarImageColor3 = Color3.fromRGB(0, 200, 255)
activityScroll.CanvasSize = UDim2.new(0, 0, 0, 0)
activityScroll.AutomaticCanvasSize = Enum.AutomaticSize.Y
activityScroll.Parent = activityFrame

local activityLayout = Instance.new("UIListLayout")
activityLayout.SortOrder = Enum.SortOrder.LayoutOrder
activityLayout.Padding = UDim.new(0, 2)
activityLayout.Parent = activityScroll

local MAX_ACTIVITY_ENTRIES = 15

local function clearActivityFeed()
	for _, child in ipairs(activityScroll:GetChildren()) do
		if child:IsA("TextLabel") then
			child:Destroy()
		end
	end
end

local function updateActivityFeed(entries: any)
	clearActivityFeed()
	if not entries or type(entries) ~= "table" then return end

	local count = math.min(#entries, MAX_ACTIVITY_ENTRIES)
	for i = 1, count do
		local entry = entries[i]
		local timestamp = entry.timestamp or ""
		local action = entry.action or entry.description or ""
		-- Extract time portion (HH:MM) if timestamp is long
		local timeStr = timestamp
		if #timeStr > 5 then
			local h, m = string.match(timeStr, "(%d+):(%d+)")
			if h and m then
				timeStr = h .. ":" .. m
			end
		end

		-- Determine display text and color based on action type
		local displayText = timeStr .. " - " .. action
		local textColor = Color3.fromRGB(180, 180, 210)
		if entry.action == "ai_decision" then
			displayText = timeStr .. " - [AI] " .. action
			textColor = Color3.fromRGB(0, 255, 220)
		end

		local lbl = Instance.new("TextLabel")
		lbl.Name = "Activity" .. i
		lbl.Size = UDim2.new(1, 0, 0, 18)
		lbl.BackgroundTransparency = 1
		lbl.TextColor3 = textColor
		lbl.TextSize = 11
		lbl.Font = Enum.Font.Gotham
		lbl.Text = displayText
		lbl.TextXAlignment = Enum.TextXAlignment.Left
		lbl.TextTruncate = Enum.TextTruncate.AtEnd
		lbl.LayoutOrder = i
		lbl.Parent = activityScroll
	end
end

-- ============================================================
-- Event Outcome Popup
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
	legendary = Color3.fromRGB(255, 215, 0),   -- gold
	rare = Color3.fromRGB(180, 80, 255),        -- purple
	common = Color3.fromRGB(255, 255, 255),     -- white
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
	activityFrame.Visible = true
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

	-- FLOW balance and score from backend
	if data.flowBalance ~= nil then
		flowBalanceLabel.Text = "FLOW: " .. tostring(data.flowBalance)
	end
	if data.score ~= nil then
		scoreLabel.Text = "Score: " .. tostring(data.score)
	end

	-- Survival info
	if data.aliveCount ~= nil and data.totalAgents ~= nil then
		aliveLabel.Text = "Alive: " .. tostring(data.aliveCount) .. " / " .. tostring(data.totalAgents)
	end

	if data.survival then
		local s = data.survival
		burnRateLabel.Text = string.format("Costs: %d food + %d energy/cycle", s.foodBurnRate or 0, s.energyBurnRate or 0)
		cyclesSurvivedLabel.Text = "Cycles Survived: " .. tostring(s.cyclesSurvived or 0)
	end
end

local function updateLeaderboardUI(entries: any)
	if not entries or type(entries) ~= "table" then return end
	for i, lbl in ipairs(leaderboardLabels) do
		if entries[i] then
			local e = entries[i]
			local name = e.playerId or "???"
			-- Truncate long house agent names
			if #name > 16 then
				name = string.sub(name, 1, 14) .. ".."
			end
			local score = e.score or 0
			local alive = e.alive
			local statusIcon = alive and "[ALIVE]" or "[DEAD]"
			local houseTag = e.isHouseAgent and " (H)" or ""
			lbl.Text = string.format("#%d %s %s%s  $%d", i, statusIcon, name, houseTag, score)
			lbl.TextColor3 = alive and Color3.fromRGB(80, 255, 120) or Color3.fromRGB(255, 80, 80)
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

	local historyResult = GetAgentHistoryRF:InvokeServer()
	if historyResult and type(historyResult) == "table" then
		updateActivityFeed(historyResult)
	end

	-- Fetch round status for yield pool
	local roundResult = GetRoundStatusRF:InvokeServer()
	if roundResult and type(roundResult) == "table" then
		if roundResult.yieldPool ~= nil then
			yieldPoolLabel.Text = "Yield Pool: $" .. tostring(roundResult.yieldPool)
		end
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
		print("[UI] Gacha result:", result)
		local desc, rarity = parseEventRarity(result)
		showEventPopup("GACHA ROLL: " .. string.upper(rarity) .. "! " .. desc, rarity)
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
		local desc, rarity = parseEventRarity(result)
		showEventPopup("RANDOM EVENT: " .. desc, rarity)
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
