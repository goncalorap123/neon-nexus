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

	-- Add API key if configured
	if Config.API_KEY and Config.API_KEY ~= "" then
		requestOptions.Headers["X-API-Key"] = Config.API_KEY
	end

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

	-- Backend wraps responses in { success, data }
	if type(decoded) == "table" then
		if decoded.success == false then
			return false, decoded.error or "Unknown error"
		end
		if decoded.success == true and decoded.data ~= nil then
			return true, decoded.data
		end
	end

	return true, decoded
end

-- Create a new agent for a player
function HttpBridge.createAgent(playerId: string)
	return HttpBridge.request("POST", "/agent/create", {
		playerId = playerId,
	})
end

-- Get an agent's current state
function HttpBridge.getAgentState(playerId: string)
	return HttpBridge.request("GET", "/agent/" .. playerId)
end

-- Set an agent's strategy
function HttpBridge.setStrategy(playerId: string, strategy: number)
	return HttpBridge.request("POST", "/agent/set-strategy", {
		playerId = playerId,
		strategy = strategy,
	})
end

-- Trigger a random event (commit phase)
function HttpBridge.triggerRandomEvent(playerId: string, eventType: number)
	return HttpBridge.request("POST", "/game/random-event", {
		playerId = playerId,
		eventType = eventType,
	})
end

-- Reveal a random event (reveal phase)
function HttpBridge.revealRandomEvent(playerId: string)
	return HttpBridge.request("POST", "/game/reveal-event", {
		playerId = playerId,
	})
end

-- Get the current game state for a player
function HttpBridge.getGameState(playerId: string)
	return HttpBridge.request("GET", "/game/state/" .. playerId)
end

-- Get the leaderboard (returns all agents)
function HttpBridge.getLeaderboard()
	return HttpBridge.request("GET", "/game/leaderboard")
end

-- Get available trade offers
function HttpBridge.getTradeOffers()
	return HttpBridge.request("GET", "/trading/offers")
end

-- Create a new trade offer
function HttpBridge.createTradeOffer(playerId: string, resourceType: number, quantity: string, pricePerUnit: string)
	return HttpBridge.request("POST", "/trading/create-offer", {
		playerId = playerId,
		resourceType = resourceType,
		quantity = quantity,
		pricePerUnit = pricePerUnit,
	})
end

-- Execute (accept) a trade
function HttpBridge.executeTrade(playerId: string, offerId: number, quantity: string)
	return HttpBridge.request("POST", "/trading/execute", {
		playerId = playerId,
		offerId = offerId,
		quantity = quantity,
	})
end

-- Get agent action history
function HttpBridge.getAgentHistory(playerId: string)
	return HttpBridge.request("GET", "/agent/" .. playerId .. "/history")
end

-- Get agent FLOW balance
function HttpBridge.getAgentBalance(playerId: string)
	return HttpBridge.request("GET", "/agent/" .. playerId .. "/balance")
end

return HttpBridge
