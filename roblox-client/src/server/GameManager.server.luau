local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local HttpBridge = require(script.Parent:WaitForChild("HttpBridge"))

-- Create Remotes folder
local Remotes = Instance.new("Folder")
Remotes.Name = "Remotes"
Remotes.Parent = ReplicatedStorage

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
local GetAgentHistoryRF = createRemoteFunction("GetAgentHistory")
local GetRoundStatusRF = createRemoteFunction("GetRoundStatus")
local GetAgentActionsRF = createRemoteFunction("GetAgentActions")

-- Map Roblox player -> their agent's playerId (set on deploy)
local playerAgentIds: { [number]: string } = {}

local function getPlayerId(plr: Player): string
	return playerAgentIds[plr.UserId] or tostring(plr.UserId)
end

-- CreateAgent: creates wallet + registers on-chain, returns result directly
CreateAgentRF.OnServerInvoke = function(plr, agentName: string?)
	local displayName = agentName or (plr.Name .. "'s Agent")
	-- Store the mapping so all future calls use this name
	playerAgentIds[plr.UserId] = displayName
	print("[GameManager] Deploying agent", displayName, "for", plr.Name)

	local success, data = HttpBridge.createAgent(displayName)
	if success and data then
		print("[GameManager] Agent deployed:", data.address or "unknown")
		return data -- { walletId, address, txHash }
	end

	warn("[GameManager] Failed to deploy agent for", plr.Name)
	-- Clear mapping on failure
	playerAgentIds[plr.UserId] = nil
	return nil
end

-- SetStrategy: returns result directly
SetStrategyRF.OnServerInvoke = function(plr, strategy: number)
	local success, data = HttpBridge.setStrategy(getPlayerId(plr), strategy)
	if success then
		return data
	end
	return nil
end

-- GetGameState: returns unwrapped data { player, resources }
GetGameStateRF.OnServerInvoke = function(plr)
	local success, data = HttpBridge.getGameState(getPlayerId(plr))
	if success and data then
		return data -- { player: { playerId, address, onChain: {...} }, resources: {...} }
	end
	return nil
end

-- TriggerEvent: commit on-chain (Cadence Arch VRF) → wait → reveal
TriggerEventRF.OnServerInvoke = function(plr, eventType: number)
	local playerId = getPlayerId(plr)

	-- Commit phase (on-chain VRF)
	local commitOk, commitData = HttpBridge.triggerRandomEvent(playerId, eventType)
	if not commitOk then
		warn("[GameManager] VRF commit failed for", plr.Name)
		return nil
	end

	-- Wait for next block on Flow (~3-4 seconds)
	task.wait(4)

	-- Reveal phase (reads VRF outcome on-chain)
	local revealOk, revealData = HttpBridge.revealRandomEvent(playerId, eventType)
	if revealOk then
		return revealData
	end

	warn("[GameManager] Reveal failed for", plr.Name)
	return nil
end

-- GetLeaderboard: returns array of agents
GetLeaderboardRF.OnServerInvoke = function(_plr)
	local success, data = HttpBridge.getLeaderboard()
	if success and data then
		return data
	end
	return {}
end

-- GetAgentHistory: returns array of recent agent actions
GetAgentHistoryRF.OnServerInvoke = function(plr)
	local success, data = HttpBridge.getAgentHistory(getPlayerId(plr))
	if success and data then
		return data
	end
	return {}
end

-- GetRoundStatus: returns alive count, yield pool, eliminated agents
GetRoundStatusRF.OnServerInvoke = function(_plr)
	local success, data = HttpBridge.getRoundStatus()
	if success and data then
		return data
	end
	return {}
end

-- GetAgentActions: returns current AI actions for all agents
GetAgentActionsRF.OnServerInvoke = function(_plr)
	local success, data = HttpBridge.getAgentActions()
	if success and data then
		return data
	end
	return {}
end

-- No auto-create on join — player must click Deploy Agent
Players.PlayerAdded:Connect(function(plr)
	print("[GameManager] Player joined:", plr.Name)
end)

Players.PlayerRemoving:Connect(function(plr)
	print("[GameManager] Player left:", plr.Name)
end)

print("[GameManager] Initialized successfully")
