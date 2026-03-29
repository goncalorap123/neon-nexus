local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local HttpBridge = require(script.Parent:WaitForChild("HttpBridge"))

-- Create Remotes folder in ReplicatedStorage
local Remotes = Instance.new("Folder")
Remotes.Name = "Remotes"
Remotes.Parent = ReplicatedStorage

-- Create RemoteFunctions for client-server communication
local function createRemoteFunction(name: string): RemoteFunction
	local rf = Instance.new("RemoteFunction")
	rf.Name = name
	rf.Parent = Remotes
	return rf
end

local CreateAgentRF = createRemoteFunction("CreateAgent")
local SetStrategyRF = createRemoteFunction("SetStrategy")
local GetGameStateRF = createRemoteFunction("GetGameState")
local TriggerEventRF = createRemoteFunction("TriggerEvent")
local GetLeaderboardRF = createRemoteFunction("GetLeaderboard")
local GetTradeOffersRF = createRemoteFunction("GetTradeOffers")
local CreateTradeOfferRF = createRemoteFunction("CreateTradeOffer")
local ExecuteTradeRF = createRemoteFunction("ExecuteTrade")

-- Track player-to-agent mappings
local playerAgents: { [number]: string } = {}

-- Handle new players joining
Players.PlayerAdded:Connect(function(player)
	print("[GameManager] Player joined:", player.Name)

	-- Automatically create an agent for the player
	local success, data = HttpBridge.createAgent(player.Name)
	if success and data and data.id then
		playerAgents[player.UserId] = data.id
		print("[GameManager] Agent created for", player.Name, "with ID:", data.id)
	else
		warn("[GameManager] Failed to create agent for", player.Name)
	end
end)

-- Clean up when players leave
Players.PlayerRemoving:Connect(function(player)
	playerAgents[player.UserId] = nil
	print("[GameManager] Player left:", player.Name)
end)

-- Helper to get a player's agent ID
local function getAgentId(player: Player): string?
	return playerAgents[player.UserId]
end

-- CreateAgent: allows re-creation if needed
CreateAgentRF.OnServerInvoke = function(player)
	local success, data = HttpBridge.createAgent(player.Name)
	if success and data and data.id then
		playerAgents[player.UserId] = data.id
		return { success = true, agentId = data.id }
	end
	return { success = false, error = "Failed to create agent" }
end

-- SetStrategy: change the agent's strategy
SetStrategyRF.OnServerInvoke = function(player, strategy: number)
	local agentId = getAgentId(player)
	if not agentId then
		return { success = false, error = "No agent found" }
	end

	local success, data = HttpBridge.setStrategy(agentId, strategy)
	if success then
		return { success = true, data = data }
	end
	return { success = false, error = "Failed to set strategy" }
end

-- GetGameState: fetch the current game state from the backend
GetGameStateRF.OnServerInvoke = function(_player)
	local success, data = HttpBridge.getGameState()
	if success then
		return { success = true, data = data }
	end
	return { success = false, error = "Failed to get game state" }
end

-- TriggerEvent: trigger a random event for the player's agent
TriggerEventRF.OnServerInvoke = function(player, eventType: number)
	local agentId = getAgentId(player)
	if not agentId then
		return { success = false, error = "No agent found" }
	end

	local success, data = HttpBridge.triggerRandomEvent(agentId, eventType)
	if success then
		return { success = true, data = data }
	end
	return { success = false, error = "Failed to trigger event" }
end

-- GetLeaderboard: fetch the leaderboard
GetLeaderboardRF.OnServerInvoke = function(_player)
	local success, data = HttpBridge.getLeaderboard()
	if success then
		return { success = true, data = data }
	end
	return { success = false, error = "Failed to get leaderboard" }
end

-- GetTradeOffers: fetch available trade offers
GetTradeOffersRF.OnServerInvoke = function(_player)
	local success, data = HttpBridge.getTradeOffers()
	if success then
		return { success = true, data = data }
	end
	return { success = false, error = "Failed to get trade offers" }
end

-- CreateTradeOffer: create a new trade offer
CreateTradeOfferRF.OnServerInvoke = function(player, offerResource: number, offerAmount: number, requestResource: number, requestAmount: number)
	local agentId = getAgentId(player)
	if not agentId then
		return { success = false, error = "No agent found" }
	end

	local success, data = HttpBridge.createTradeOffer(agentId, offerResource, offerAmount, requestResource, requestAmount)
	if success then
		return { success = true, data = data }
	end
	return { success = false, error = "Failed to create trade offer" }
end

-- ExecuteTrade: accept/execute a trade offer
ExecuteTradeRF.OnServerInvoke = function(player, tradeId: string)
	local agentId = getAgentId(player)
	if not agentId then
		return { success = false, error = "No agent found" }
	end

	local success, data = HttpBridge.executeTrade(tradeId, agentId)
	if success then
		return { success = true, data = data }
	end
	return { success = false, error = "Failed to execute trade" }
end

print("[GameManager] Initialized successfully")
