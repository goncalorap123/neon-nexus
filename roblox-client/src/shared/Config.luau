local Config = {}

-- Backend API URL (replace with your actual NestJS backend URL)
Config.BACKEND_URL = "https://neon-nexus-production.up.railway.app/api"

-- API key for authenticating requests (leave empty if not using auth)
Config.API_KEY = ""

-- Strategy constants
Config.STRATEGY_CONSERVATIVE = 0
Config.STRATEGY_BALANCED = 1
Config.STRATEGY_AGGRESSIVE = 2

-- Event type constants
Config.EVENT_GACHA = 0
Config.EVENT_DISASTER = 1
Config.EVENT_TRADE_BONUS = 2
Config.EVENT_LOOT = 3

-- Resource type constants
Config.RESOURCE_WOOD = 0
Config.RESOURCE_STEEL = 1
Config.RESOURCE_ENERGY = 2
Config.RESOURCE_FOOD = 3

return Config
