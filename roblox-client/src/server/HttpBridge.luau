local HttpService = game:GetService("HttpService")
local Config = require(game:GetService("ReplicatedStorage"):WaitForChild("Config"))

local HttpBridge = {}

-- Internal helper: make an HTTP request to the backend
function HttpBridge.request(method: string, path: string, body: any?): (boolean, any)
	local url = Config.BACKEND_URL .. path
	local requestOptions: any = {
		Url = url,
		Method = method,
		Headers = {
			["Content-Type"] = "application/json",
			["Accept"] = "application/json",
		},
	}

	if body ~= nil then
		requestOptions.Body = HttpService:JSONEncode(body)
	end

	local success, response = pcall(function()
		return HttpService:RequestAsync(requestOptions)
	end)

	if not success then
		warn("[HttpBridge] Request failed:", response)
		return false, nil
	end

	if response.StatusCode < 200 or response.StatusCode >= 300 then
		warn("[HttpBridge] HTTP error", response.StatusCode, "for", method, path)
		return false, nil
	end

	local decodeSuccess, decoded = pcall(function()
		return HttpService:JSONDecode(response.Body)
	end)

	if not decodeSuccess then
		return true, response.Body
	end

	return true, decoded
end

-- Create a new agent
function HttpBridge.createAgent(playerName: string)
	return HttpBridge.request("POST", "/agents", {
		name = playerName,
	})
end

-- Get an agent's current state
function HttpBridge.getAgentState(agentId: string)
	return HttpBridge.request("GET", "/agents/" .. agentId)
end

-- Set an agent's strategy
function HttpBridge.setStrategy(agentId: string, strategy: number)
	return HttpBridge.request("PATCH", "/agents/" .. agentId .. "/strategy", {
		strategy = strategy,
	})
end

-- Trigger a random event for an agent
function HttpBridge.triggerRandomEvent(agentId: string, eventType: number)
	return HttpBridge.request("POST", "/events/trigger", {
		agentId = agentId,
		eventType = eventType,
	})
end

-- Reveal/resolve a random event
function HttpBridge.revealRandomEvent(eventId: string)
	return HttpBridge.request("POST", "/events/" .. eventId .. "/reveal")
end

-- Get the current game state
function HttpBridge.getGameState()
	return HttpBridge.request("GET", "/game/state")
end

-- Get the leaderboard
function HttpBridge.getLeaderboard()
	return HttpBridge.request("GET", "/leaderboard")
end

-- Get available trade offers
function HttpBridge.getTradeOffers()
	return HttpBridge.request("GET", "/trades")
end

-- Create a new trade offer
function HttpBridge.createTradeOffer(fromAgentId: string, offerResource: number, offerAmount: number, requestResource: number, requestAmount: number)
	return HttpBridge.request("POST", "/trades", {
		fromAgentId = fromAgentId,
		offerResource = offerResource,
		offerAmount = offerAmount,
		requestResource = requestResource,
		requestAmount = requestAmount,
	})
end

-- Execute (accept) a trade
function HttpBridge.executeTrade(tradeId: string, acceptingAgentId: string)
	return HttpBridge.request("POST", "/trades/" .. tradeId .. "/execute", {
		acceptingAgentId = acceptingAgentId,
	})
end

return HttpBridge
