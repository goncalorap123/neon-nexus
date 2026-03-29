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

-- Use UserId as the stable player identifier (matches backend playerId)
local function getPlayerId(player: Player): string
	return tostring(player.UserId)
end

-- Handle new players joining — auto-create agent
Players.PlayerAdded:Connect(function(player)
	print("[GameManager] Player joined:", player.Name)

	task.spawn(function()
		local playerId = getPlayerId(player)
		local success, existing = HttpBridge.getAgentState(playerId)
		if not success or not existing then
			local createSuccess, data = HttpBridge.createAgent(playerId)
			if createSuccess and data then
				print("[GameManager] Agent created for", player.Name, "wallet:", data.address or "unknown")
			else
				warn("[GameManager] Failed to create agent for", player.Name)
			end
		else
			print("[GameManager] Agent already exists for", player.Name)
		end
	end)
end)

Players.PlayerRemoving:Connect(function(player)
	print("[GameManager] Player left:", player.Name)
end)

-- CreateAgent
CreateAgentRF.OnServerInvoke = function(player)
	local success, data = HttpBridge.createAgent(getPlayerId(player))
	if success and data then
		return { success = true, data = data }
	end
	return { success = false, error = "Failed to create agent" }
end

-- SetStrategy
SetStrategyRF.OnServerInvoke = function(player, strategy: number)
	local success, data = HttpBridge.setStrategy(getPlayerId(player), strategy)
	if success then
		return { success = true, data = data }
	end
	return { success = false, error = "Failed to set strategy" }
end

-- GetGameState
GetGameStateRF.OnServerInvoke = function(player)
	local success, data = HttpBridge.getGameState(getPlayerId(player))
	if success then
		return { success = true, data = data }
	end
	return { success = false, error = "Failed to get game state" }
end

-- TriggerEvent (commit + wait + reveal)
TriggerEventRF.OnServerInvoke = function(player, eventType: number)
	local playerId = getPlayerId(player)

	-- Step 1: Commit
	local commitOk, commitData = HttpBridge.triggerRandomEvent(playerId, eventType)
	if not commitOk then
		return { success = false, error = "Failed to commit event" }
	end

	-- Step 2: Wait for next block (~3-4 seconds on Flow)
	task.wait(4)

	-- Step 3: Reveal
	local revealOk, revealData = HttpBridge.revealRandomEvent(playerId)
	if revealOk then
		return { success = true, data = revealData }
	end
	return { success = false, error = "Failed to reveal event" }
end

-- GetLeaderboard
GetLeaderboardRF.OnServerInvoke = function(_player)
	local success, data = HttpBridge.getLeaderboard()
	if success then
		return { success = true, data = data }
	end
	return { success = false, error = "Failed to get leaderboard" }
end

-- GetTradeOffers
GetTradeOffersRF.OnServerInvoke = function(_player)
	local success, data = HttpBridge.getTradeOffers()
	if success then
		return { success = true, data = data }
	end
	return { success = false, error = "Failed to get trade offers" }
end

-- CreateTradeOffer
CreateTradeOfferRF.OnServerInvoke = function(player, resourceType: number, quantity: string, pricePerUnit: string)
	local success, data = HttpBridge.createTradeOffer(getPlayerId(player), resourceType, quantity, pricePerUnit)
	if success then
		return { success = true, data = data }
	end
	return { success = false, error = "Failed to create trade offer" }
end

-- ExecuteTrade
ExecuteTradeRF.OnServerInvoke = function(player, offerId: number, quantity: string)
	local success, data = HttpBridge.executeTrade(getPlayerId(player), offerId, quantity)
	if success then
		return { success = true, data = data }
	end
	return { success = false, error = "Failed to execute trade" }
end

print("[GameManager] Initialized successfully")
