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
local GetTradeOffersRF = Remotes:WaitForChild("GetTradeOffers") :: RemoteFunction
local CreateTradeOfferRF = Remotes:WaitForChild("CreateTradeOffer") :: RemoteFunction
local ExecuteTradeRF = Remotes:WaitForChild("ExecuteTrade") :: RemoteFunction

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

-- Forward declarations for functions referenced in trade UI callbacks
local refreshGameState
local refreshTradeOffers

-- ============================================================
-- Trade Marketplace Panel (right side, below leaderboard)
-- ============================================================

local tradeFrame = createFrame("TradeFrame", UDim2.new(1, -270, 0, 320), UDim2.new(0, 260, 0, 380))

createLabel(tradeFrame, "Title", UDim2.new(0, 10, 0, 5), UDim2.new(1, -20, 0, 25), "TRADE MARKETPLACE")

-- Scrolling area for trade offers
local tradeListFrame = Instance.new("ScrollingFrame")
tradeListFrame.Name = "TradeList"
tradeListFrame.Position = UDim2.new(0, 5, 0, 30)
tradeListFrame.Size = UDim2.new(1, -10, 0, 155)
tradeListFrame.BackgroundTransparency = 0.8
tradeListFrame.BackgroundColor3 = Color3.fromRGB(10, 10, 20)
tradeListFrame.BorderSizePixel = 0
tradeListFrame.ScrollBarThickness = 4
tradeListFrame.ScrollBarImageColor3 = Color3.fromRGB(0, 200, 255)
tradeListFrame.CanvasSize = UDim2.new(0, 0, 0, 0)
tradeListFrame.AutomaticCanvasSize = Enum.AutomaticSize.Y
tradeListFrame.Parent = tradeFrame

local tradeListLayout = Instance.new("UIListLayout")
tradeListLayout.SortOrder = Enum.SortOrder.LayoutOrder
tradeListLayout.Padding = UDim.new(0, 2)
tradeListLayout.Parent = tradeListFrame

local noTradesLabel = createLabel(tradeListFrame, "NoTrades", UDim2.new(0, 5, 0, 0), UDim2.new(1, -10, 0, 25), "No active offers")
noTradesLabel.TextXAlignment = Enum.TextXAlignment.Center
noTradesLabel.TextColor3 = Color3.fromRGB(120, 120, 140)
noTradesLabel.TextSize = 12

-- Divider
local tradeDivider = Instance.new("Frame")
tradeDivider.Name = "Divider"
tradeDivider.Position = UDim2.new(0, 10, 0, 190)
tradeDivider.Size = UDim2.new(1, -20, 0, 1)
tradeDivider.BackgroundColor3 = Color3.fromRGB(0, 200, 255)
tradeDivider.BackgroundTransparency = 0.5
tradeDivider.BorderSizePixel = 0
tradeDivider.Parent = tradeFrame

createLabel(tradeFrame, "CreateTitle", UDim2.new(0, 10, 0, 196), UDim2.new(1, -20, 0, 20), "CREATE OFFER")

-- Offer resource selector
createLabel(tradeFrame, "OfferLabel", UDim2.new(0, 10, 0, 218), UDim2.new(0, 50, 0, 18), "Sell:")
local offerWoodBtn = createButton(tradeFrame, "OfferWood", UDim2.new(0, 50, 0, 216), UDim2.new(0, 45, 0, 22), "Wood")
local offerSteelBtn = createButton(tradeFrame, "OfferSteel", UDim2.new(0, 98, 0, 216), UDim2.new(0, 45, 0, 22), "Steel")
local offerEnergyBtn = createButton(tradeFrame, "OfferEnergy", UDim2.new(0, 146, 0, 216), UDim2.new(0, 50, 0, 22), "Energy")
local offerFoodBtn = createButton(tradeFrame, "OfferFood", UDim2.new(0, 199, 0, 216), UDim2.new(0, 45, 0, 22), "Food")

offerWoodBtn.TextSize = 11
offerSteelBtn.TextSize = 11
offerEnergyBtn.TextSize = 11
offerFoodBtn.TextSize = 11

offerWoodBtn.BackgroundColor3 = Color3.fromRGB(120, 70, 30)
offerSteelBtn.BackgroundColor3 = Color3.fromRGB(100, 105, 110)
offerEnergyBtn.BackgroundColor3 = Color3.fromRGB(160, 140, 20)
offerFoodBtn.BackgroundColor3 = Color3.fromRGB(30, 120, 40)

-- Request resource selector
createLabel(tradeFrame, "RequestLabel", UDim2.new(0, 10, 0, 244), UDim2.new(0, 50, 0, 18), "Want:")
local reqWoodBtn = createButton(tradeFrame, "ReqWood", UDim2.new(0, 50, 0, 242), UDim2.new(0, 45, 0, 22), "Wood")
local reqSteelBtn = createButton(tradeFrame, "ReqSteel", UDim2.new(0, 98, 0, 242), UDim2.new(0, 45, 0, 22), "Steel")
local reqEnergyBtn = createButton(tradeFrame, "ReqEnergy", UDim2.new(0, 146, 0, 242), UDim2.new(0, 50, 0, 22), "Energy")
local reqFoodBtn = createButton(tradeFrame, "ReqFood", UDim2.new(0, 199, 0, 242), UDim2.new(0, 45, 0, 22), "Food")

reqWoodBtn.TextSize = 11
reqSteelBtn.TextSize = 11
reqEnergyBtn.TextSize = 11
reqFoodBtn.TextSize = 11

reqWoodBtn.BackgroundColor3 = Color3.fromRGB(120, 70, 30)
reqSteelBtn.BackgroundColor3 = Color3.fromRGB(100, 105, 110)
reqEnergyBtn.BackgroundColor3 = Color3.fromRGB(160, 140, 20)
reqFoodBtn.BackgroundColor3 = Color3.fromRGB(30, 120, 40)

-- Amount selectors
createLabel(tradeFrame, "OfferAmtLabel", UDim2.new(0, 10, 0, 272), UDim2.new(0, 70, 0, 18), "Sell Qty:")
local offerAmountBox = Instance.new("TextBox")
offerAmountBox.Name = "OfferAmountBox"
offerAmountBox.Position = UDim2.new(0, 80, 0, 270)
offerAmountBox.Size = UDim2.new(0, 50, 0, 22)
offerAmountBox.BackgroundColor3 = Color3.fromRGB(30, 30, 50)
offerAmountBox.TextColor3 = Color3.fromRGB(220, 220, 255)
offerAmountBox.PlaceholderText = "10"
offerAmountBox.PlaceholderColor3 = Color3.fromRGB(100, 100, 120)
offerAmountBox.Text = "10"
offerAmountBox.TextSize = 13
offerAmountBox.Font = Enum.Font.Gotham
offerAmountBox.BorderSizePixel = 0
offerAmountBox.ClearTextOnFocus = false
offerAmountBox.Parent = tradeFrame

local offerAmtCorner = Instance.new("UICorner")
offerAmtCorner.CornerRadius = UDim.new(0, 4)
offerAmtCorner.Parent = offerAmountBox

createLabel(tradeFrame, "ReqAmtLabel", UDim2.new(0, 140, 0, 272), UDim2.new(0, 65, 0, 18), "Want Qty:")
local reqAmountBox = Instance.new("TextBox")
reqAmountBox.Name = "ReqAmountBox"
reqAmountBox.Position = UDim2.new(0, 205, 0, 270)
reqAmountBox.Size = UDim2.new(0, 40, 0, 22)
reqAmountBox.BackgroundColor3 = Color3.fromRGB(30, 30, 50)
reqAmountBox.TextColor3 = Color3.fromRGB(220, 220, 255)
reqAmountBox.PlaceholderText = "10"
reqAmountBox.PlaceholderColor3 = Color3.fromRGB(100, 100, 120)
reqAmountBox.Text = "10"
reqAmountBox.TextSize = 13
reqAmountBox.Font = Enum.Font.Gotham
reqAmountBox.BorderSizePixel = 0
reqAmountBox.ClearTextOnFocus = false
reqAmountBox.Parent = tradeFrame

local reqAmtCorner = Instance.new("UICorner")
reqAmtCorner.CornerRadius = UDim.new(0, 4)
reqAmtCorner.Parent = reqAmountBox

-- Selection state label
local selectionLabel = createLabel(tradeFrame, "SelectionLabel", UDim2.new(0, 10, 0, 298), UDim2.new(1, -20, 0, 18), "Sell: Wood | Want: Steel")
selectionLabel.TextSize = 11
selectionLabel.TextColor3 = Color3.fromRGB(0, 200, 255)
selectionLabel.TextXAlignment = Enum.TextXAlignment.Center

-- List Offer button
local listOfferBtn = createButton(tradeFrame, "ListOffer", UDim2.new(0, 10, 0, 320), UDim2.new(1, -20, 0, 30), "LIST OFFER")
listOfferBtn.BackgroundColor3 = Color3.fromRGB(0, 150, 100)

-- Trade status label
local tradeStatusLabel = createLabel(tradeFrame, "TradeStatus", UDim2.new(0, 10, 0, 354), UDim2.new(1, -20, 0, 18), "")
tradeStatusLabel.TextSize = 11
tradeStatusLabel.TextXAlignment = Enum.TextXAlignment.Center
tradeStatusLabel.TextColor3 = Color3.fromRGB(100, 255, 100)

-- ============================================================
-- Trade Panel State & Logic
-- ============================================================

local selectedOfferResource = Config.RESOURCE_WOOD
local selectedRequestResource = Config.RESOURCE_STEEL

local resourceNames = {
	[Config.RESOURCE_WOOD] = "Wood",
	[Config.RESOURCE_STEEL] = "Steel",
	[Config.RESOURCE_ENERGY] = "Energy",
	[Config.RESOURCE_FOOD] = "Food",
}

local function updateSelectionLabel()
	selectionLabel.Text = "Sell: " .. resourceNames[selectedOfferResource] .. " | Want: " .. resourceNames[selectedRequestResource]
end

-- Highlight selected resource button
local function highlightOfferBtn(selected: TextButton)
	for _, btn in ipairs({ offerWoodBtn, offerSteelBtn, offerEnergyBtn, offerFoodBtn }) do
		btn.BackgroundTransparency = if btn == selected then 0 else 0.5
	end
end

local function highlightReqBtn(selected: TextButton)
	for _, btn in ipairs({ reqWoodBtn, reqSteelBtn, reqEnergyBtn, reqFoodBtn }) do
		btn.BackgroundTransparency = if btn == selected then 0 else 0.5
	end
end

-- Initialize highlights
highlightOfferBtn(offerWoodBtn)
highlightReqBtn(reqSteelBtn)

-- Offer resource selection handlers
offerWoodBtn.MouseButton1Click:Connect(function()
	selectedOfferResource = Config.RESOURCE_WOOD
	highlightOfferBtn(offerWoodBtn)
	updateSelectionLabel()
end)
offerSteelBtn.MouseButton1Click:Connect(function()
	selectedOfferResource = Config.RESOURCE_STEEL
	highlightOfferBtn(offerSteelBtn)
	updateSelectionLabel()
end)
offerEnergyBtn.MouseButton1Click:Connect(function()
	selectedOfferResource = Config.RESOURCE_ENERGY
	highlightOfferBtn(offerEnergyBtn)
	updateSelectionLabel()
end)
offerFoodBtn.MouseButton1Click:Connect(function()
	selectedOfferResource = Config.RESOURCE_FOOD
	highlightOfferBtn(offerFoodBtn)
	updateSelectionLabel()
end)

-- Request resource selection handlers
reqWoodBtn.MouseButton1Click:Connect(function()
	selectedRequestResource = Config.RESOURCE_WOOD
	highlightReqBtn(reqWoodBtn)
	updateSelectionLabel()
end)
reqSteelBtn.MouseButton1Click:Connect(function()
	selectedRequestResource = Config.RESOURCE_STEEL
	highlightReqBtn(reqSteelBtn)
	updateSelectionLabel()
end)
reqEnergyBtn.MouseButton1Click:Connect(function()
	selectedRequestResource = Config.RESOURCE_ENERGY
	highlightReqBtn(reqEnergyBtn)
	updateSelectionLabel()
end)
reqFoodBtn.MouseButton1Click:Connect(function()
	selectedRequestResource = Config.RESOURCE_FOOD
	highlightReqBtn(reqFoodBtn)
	updateSelectionLabel()
end)

-- Create a single trade offer entry in the list
local function createTradeEntry(parent: Instance, offer: any, index: number): Frame
	local entryFrame = Instance.new("Frame")
	entryFrame.Name = "TradeEntry_" .. index
	entryFrame.Size = UDim2.new(1, -4, 0, 42)
	entryFrame.BackgroundColor3 = Color3.fromRGB(25, 25, 45)
	entryFrame.BackgroundTransparency = 0.3
	entryFrame.BorderSizePixel = 0
	entryFrame.LayoutOrder = index
	entryFrame.Parent = parent

	local entryCorner = Instance.new("UICorner")
	entryCorner.CornerRadius = UDim.new(0, 4)
	entryCorner.Parent = entryFrame

	local sellerName = offer.fromAgentName or offer.fromAgentId or "???"
	local offerRes = resourceNames[offer.offerResource] or "?"
	local offerAmt = offer.offerAmount or 0
	local reqRes = resourceNames[offer.requestResource] or "?"
	local reqAmt = offer.requestAmount or 0

	local infoLabel = Instance.new("TextLabel")
	infoLabel.Name = "Info"
	infoLabel.Position = UDim2.new(0, 5, 0, 2)
	infoLabel.Size = UDim2.new(1, -60, 0, 18)
	infoLabel.BackgroundTransparency = 1
	infoLabel.TextColor3 = Color3.fromRGB(200, 200, 230)
	infoLabel.TextSize = 11
	infoLabel.Font = Enum.Font.GothamBold
	infoLabel.Text = sellerName
	infoLabel.TextXAlignment = Enum.TextXAlignment.Left
	infoLabel.TextTruncate = Enum.TextTruncate.AtEnd
	infoLabel.Parent = entryFrame

	local detailLabel = Instance.new("TextLabel")
	detailLabel.Name = "Detail"
	detailLabel.Position = UDim2.new(0, 5, 0, 20)
	detailLabel.Size = UDim2.new(1, -60, 0, 18)
	detailLabel.BackgroundTransparency = 1
	detailLabel.TextColor3 = Color3.fromRGB(150, 150, 180)
	detailLabel.TextSize = 10
	detailLabel.Font = Enum.Font.Gotham
	detailLabel.Text = string.format("%dx %s  for  %dx %s", offerAmt, offerRes, reqAmt, reqRes)
	detailLabel.TextXAlignment = Enum.TextXAlignment.Left
	detailLabel.Parent = entryFrame

	local buyBtn = Instance.new("TextButton")
	buyBtn.Name = "BuyBtn"
	buyBtn.Position = UDim2.new(1, -52, 0, 8)
	buyBtn.Size = UDim2.new(0, 45, 0, 26)
	buyBtn.BackgroundColor3 = Color3.fromRGB(0, 140, 80)
	buyBtn.TextColor3 = Color3.fromRGB(255, 255, 255)
	buyBtn.TextSize = 12
	buyBtn.Font = Enum.Font.GothamBold
	buyBtn.Text = "Buy"
	buyBtn.BorderSizePixel = 0
	buyBtn.Parent = entryFrame

	local buyCorner = Instance.new("UICorner")
	buyCorner.CornerRadius = UDim.new(0, 4)
	buyCorner.Parent = buyBtn

	-- Buy handler
	buyBtn.MouseButton1Click:Connect(function()
		buyBtn.Text = "..."
		local tradeId = offer.id or ""
		local result = ExecuteTradeRF:InvokeServer(tradeId)
		if result and result.success then
			tradeStatusLabel.Text = "Trade completed!"
			tradeStatusLabel.TextColor3 = Color3.fromRGB(100, 255, 100)
			refreshGameState()
		else
			tradeStatusLabel.Text = "Trade failed"
			tradeStatusLabel.TextColor3 = Color3.fromRGB(255, 80, 80)
		end
		buyBtn.Text = "Buy"
		-- Clear status after a few seconds
		task.delay(3, function()
			tradeStatusLabel.Text = ""
		end)
	end)

	return entryFrame
end

local function updateTradeOffersUI(offers: any)
	-- Clear existing entries
	for _, child in ipairs(tradeListFrame:GetChildren()) do
		if child:IsA("Frame") then
			child:Destroy()
		end
	end

	if not offers or #offers == 0 then
		noTradesLabel.Visible = true
		return
	end

	noTradesLabel.Visible = false

	for i, offer in ipairs(offers) do
		if i > 20 then break end -- cap display
		createTradeEntry(tradeListFrame, offer, i)
	end
end

refreshTradeOffers = function()
	local result = GetTradeOffersRF:InvokeServer()
	if result and result.success and result.data then
		updateTradeOffersUI(result.data)
	end
end

-- List Offer button handler
listOfferBtn.MouseButton1Click:Connect(function()
	if selectedOfferResource == selectedRequestResource then
		tradeStatusLabel.Text = "Cannot trade same resource"
		tradeStatusLabel.TextColor3 = Color3.fromRGB(255, 200, 50)
		task.delay(3, function() tradeStatusLabel.Text = "" end)
		return
	end

	local offerAmt = tonumber(offerAmountBox.Text) or 10
	local reqAmt = tonumber(reqAmountBox.Text) or 10

	if offerAmt <= 0 or reqAmt <= 0 then
		tradeStatusLabel.Text = "Amounts must be positive"
		tradeStatusLabel.TextColor3 = Color3.fromRGB(255, 200, 50)
		task.delay(3, function() tradeStatusLabel.Text = "" end)
		return
	end

	listOfferBtn.Text = "Creating..."
	local result = CreateTradeOfferRF:InvokeServer(selectedOfferResource, offerAmt, selectedRequestResource, reqAmt)
	if result and result.success then
		tradeStatusLabel.Text = "Offer listed!"
		tradeStatusLabel.TextColor3 = Color3.fromRGB(100, 255, 100)
		refreshTradeOffers()
	else
		tradeStatusLabel.Text = result and result.error or "Failed to list offer"
		tradeStatusLabel.TextColor3 = Color3.fromRGB(255, 80, 80)
	end
	listOfferBtn.Text = "LIST OFFER"
	task.delay(3, function() tradeStatusLabel.Text = "" end)
end)

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

refreshGameState = function()
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

	-- Also refresh trade offers
	refreshTradeOffers()
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
