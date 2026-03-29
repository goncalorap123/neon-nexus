local Lighting = game:GetService("Lighting")

print("[WorldBuilder] Generating cyberpunk city world...")

-- ============================================================
-- Ambient Lighting Setup
-- ============================================================

Lighting.ClockTime = 21 -- Nighttime
Lighting.Brightness = 0.3
Lighting.OutdoorAmbient = Color3.fromRGB(20, 10, 40)
Lighting.Ambient = Color3.fromRGB(30, 15, 50)
Lighting.FogColor = Color3.fromRGB(10, 5, 25)
Lighting.FogStart = 100
Lighting.FogEnd = 600

-- Atmosphere for cyberpunk haze
local atmosphere = Instance.new("Atmosphere")
atmosphere.Density = 0.35
atmosphere.Offset = 0.2
atmosphere.Color = Color3.fromRGB(40, 20, 60)
atmosphere.Decay = Color3.fromRGB(20, 10, 40)
atmosphere.Glare = 0.1
atmosphere.Haze = 3
atmosphere.Parent = Lighting

-- ColorCorrection for neon tint
local colorCorrection = Instance.new("ColorCorrectionEffect")
colorCorrection.Brightness = 0.02
colorCorrection.Contrast = 0.15
colorCorrection.Saturation = 0.2
colorCorrection.TintColor = Color3.fromRGB(220, 200, 255)
colorCorrection.Parent = Lighting

-- Bloom for neon glow
local bloom = Instance.new("BloomEffect")
bloom.Intensity = 0.4
bloom.Size = 30
bloom.Threshold = 1.2
bloom.Parent = Lighting

-- ============================================================
-- Ground Plane
-- ============================================================

local worldFolder = Instance.new("Folder")
worldFolder.Name = "CityWorld"
worldFolder.Parent = workspace

local ground = Instance.new("Part")
ground.Name = "Ground"
ground.Size = Vector3.new(400, 1, 400)
ground.Position = Vector3.new(0, -0.5, 0)
ground.Anchored = true
ground.Color = Color3.fromRGB(30, 30, 35)
ground.Material = Enum.Material.SmoothPlastic
ground.TopSurface = Enum.SurfaceType.Smooth
ground.BottomSurface = Enum.SurfaceType.Smooth
ground.Parent = worldFolder

-- Subtle ground light
local groundLight = Instance.new("PointLight")
groundLight.Color = Color3.fromRGB(0, 100, 150)
groundLight.Brightness = 0.2
groundLight.Range = 60
groundLight.Parent = ground

-- ============================================================
-- Building Grid
-- ============================================================

local buildingsFolder = Instance.new("Folder")
buildingsFolder.Name = "Buildings"
buildingsFolder.Parent = worldFolder

-- Neon-themed building palette
local buildingColors = {
	Color3.fromRGB(15, 20, 50),   -- dark blue
	Color3.fromRGB(25, 15, 45),   -- dark purple
	Color3.fromRGB(10, 30, 40),   -- dark teal
	Color3.fromRGB(20, 10, 35),   -- deep indigo
	Color3.fromRGB(18, 25, 38),   -- slate blue
}

-- Neon accent colors for building lights
local neonAccents = {
	Color3.fromRGB(0, 200, 255),   -- cyan
	Color3.fromRGB(255, 0, 200),   -- magenta
	Color3.fromRGB(100, 0, 255),   -- purple
	Color3.fromRGB(0, 255, 150),   -- neon green
	Color3.fromRGB(255, 100, 0),   -- orange
}

-- 4x4 grid of building plots
-- Grid spans from -150 to 150, with gaps for streets
local GRID_SIZE = 4
local PLOT_SPACING = 70 -- distance between plot centers
local GRID_OFFSET = -((GRID_SIZE - 1) * PLOT_SPACING) / 2

for row = 0, GRID_SIZE - 1 do
	for col = 0, GRID_SIZE - 1 do
		local centerX = GRID_OFFSET + col * PLOT_SPACING
		local centerZ = GRID_OFFSET + row * PLOT_SPACING

		-- Each plot has 1-3 building segments for variety
		local numBuildings = math.random(1, 3)

		for b = 1, numBuildings do
			local height = math.random(10, 40)
			local width = math.random(8, 20)
			local depth = math.random(8, 20)

			local offsetX = math.random(-12, 12)
			local offsetZ = math.random(-12, 12)

			local building = Instance.new("Part")
			building.Name = string.format("Building_R%d_C%d_%d", row, col, b)
			building.Size = Vector3.new(width, height, depth)
			building.Position = Vector3.new(
				centerX + offsetX,
				height / 2,
				centerZ + offsetZ
			)
			building.Anchored = true
			building.CanCollide = true
			building.Color = buildingColors[math.random(1, #buildingColors)]
			building.Material = Enum.Material.SmoothPlastic
			building.TopSurface = Enum.SurfaceType.Smooth
			building.BottomSurface = Enum.SurfaceType.Smooth
			building.Parent = buildingsFolder

			-- Neon accent light on each building
			local accentColor = neonAccents[math.random(1, #neonAccents)]

			local light = Instance.new("PointLight")
			light.Color = accentColor
			light.Brightness = 1.2
			light.Range = math.random(12, 25)
			light.Parent = building

			-- Add a surface light on a random face for glow effect
			local surfaceLight = Instance.new("SurfaceLight")
			surfaceLight.Color = accentColor
			surfaceLight.Brightness = 0.6
			surfaceLight.Range = 15
			surfaceLight.Face = Enum.NormalId.Front
			surfaceLight.Parent = building

			-- Occasional second surface light on another face
			if math.random() > 0.5 then
				local surfaceLight2 = Instance.new("SurfaceLight")
				surfaceLight2.Color = neonAccents[math.random(1, #neonAccents)]
				surfaceLight2.Brightness = 0.4
				surfaceLight2.Range = 10
				surfaceLight2.Face = Enum.NormalId.Right
				surfaceLight2.Parent = building
			end
		end
	end
end

-- ============================================================
-- Street Markings (thin glowing strips between building clusters)
-- ============================================================

local streetsFolder = Instance.new("Folder")
streetsFolder.Name = "Streets"
streetsFolder.Parent = worldFolder

-- Horizontal street strips
for row = 0, GRID_SIZE - 1 do
	local z = GRID_OFFSET + row * PLOT_SPACING

	local streetH = Instance.new("Part")
	streetH.Name = "Street_H_" .. row
	streetH.Size = Vector3.new(GRID_SIZE * PLOT_SPACING + 40, 0.1, 6)
	streetH.Position = Vector3.new(0, 0.05, z - PLOT_SPACING / 2 + 2)
	streetH.Anchored = true
	streetH.CanCollide = false
	streetH.Color = Color3.fromRGB(40, 40, 50)
	streetH.Material = Enum.Material.Neon
	streetH.Transparency = 0.7
	streetH.Parent = streetsFolder

	-- Center line glow
	local centerLine = Instance.new("Part")
	centerLine.Name = "CenterLine_H_" .. row
	centerLine.Size = Vector3.new(GRID_SIZE * PLOT_SPACING + 40, 0.12, 0.3)
	centerLine.Position = Vector3.new(0, 0.06, z - PLOT_SPACING / 2 + 2)
	centerLine.Anchored = true
	centerLine.CanCollide = false
	centerLine.Color = Color3.fromRGB(0, 150, 200)
	centerLine.Material = Enum.Material.Neon
	centerLine.Parent = streetsFolder
end

-- Vertical street strips
for col = 0, GRID_SIZE - 1 do
	local x = GRID_OFFSET + col * PLOT_SPACING

	local streetV = Instance.new("Part")
	streetV.Name = "Street_V_" .. col
	streetV.Size = Vector3.new(6, 0.1, GRID_SIZE * PLOT_SPACING + 40)
	streetV.Position = Vector3.new(x - PLOT_SPACING / 2 + 2, 0.05, 0)
	streetV.Anchored = true
	streetV.CanCollide = false
	streetV.Color = Color3.fromRGB(40, 40, 50)
	streetV.Material = Enum.Material.Neon
	streetV.Transparency = 0.7
	streetV.Parent = streetsFolder

	local centerLine = Instance.new("Part")
	centerLine.Name = "CenterLine_V_" .. col
	centerLine.Size = Vector3.new(0.3, 0.12, GRID_SIZE * PLOT_SPACING + 40)
	centerLine.Position = Vector3.new(x - PLOT_SPACING / 2 + 2, 0.06, 0)
	centerLine.Anchored = true
	centerLine.CanCollide = false
	centerLine.Color = Color3.fromRGB(0, 150, 200)
	centerLine.Material = Enum.Material.Neon
	centerLine.Parent = streetsFolder
end

-- ============================================================
-- Resource Spawn Points
-- ============================================================

local resourcesFolder = Instance.new("Folder")
resourcesFolder.Name = "ResourceSpawns"
resourcesFolder.Parent = worldFolder

local resourceTypes = {
	{ name = "Wood",   color = Color3.fromRGB(120, 70, 30),  glowColor = Color3.fromRGB(180, 120, 60)  },
	{ name = "Steel",  color = Color3.fromRGB(160, 165, 170), glowColor = Color3.fromRGB(200, 210, 220) },
	{ name = "Energy", color = Color3.fromRGB(255, 220, 40),  glowColor = Color3.fromRGB(255, 240, 100) },
	{ name = "Food",   color = Color3.fromRGB(50, 180, 60),   glowColor = Color3.fromRGB(80, 255, 100)  },
}

-- Place resource cubes around the map (3 of each type)
for _, resInfo in ipairs(resourceTypes) do
	for i = 1, 3 do
		local cube = Instance.new("Part")
		cube.Name = resInfo.name .. "_Spawn_" .. i
		cube.Shape = Enum.PartType.Block
		cube.Size = Vector3.new(3, 3, 3)
		cube.Position = Vector3.new(
			math.random(-140, 140),
			1.5,
			math.random(-140, 140)
		)
		cube.Anchored = true
		cube.CanCollide = false
		cube.Color = resInfo.color
		cube.Material = Enum.Material.Neon
		cube.Parent = resourcesFolder

		-- Floating rotation effect using a slow spin
		local glow = Instance.new("PointLight")
		glow.Color = resInfo.glowColor
		glow.Brightness = 1.5
		glow.Range = 10
		glow.Parent = cube

		-- BillboardGui label
		local billboard = Instance.new("BillboardGui")
		billboard.Size = UDim2.new(0, 80, 0, 25)
		billboard.StudsOffset = Vector3.new(0, 3, 0)
		billboard.AlwaysOnTop = true
		billboard.Adornee = cube
		billboard.Parent = cube

		local label = Instance.new("TextLabel")
		label.Size = UDim2.new(1, 0, 1, 0)
		label.BackgroundTransparency = 1
		label.TextColor3 = resInfo.glowColor
		label.TextStrokeTransparency = 0.3
		label.TextStrokeColor3 = Color3.fromRGB(0, 0, 0)
		label.TextSize = 14
		label.Font = Enum.Font.GothamBold
		label.Text = resInfo.name
		label.Parent = billboard
	end
end

print("[WorldBuilder] City world generation complete!")
print(string.format("[WorldBuilder] Generated %d building plots, %d resource spawns",
	GRID_SIZE * GRID_SIZE, #resourceTypes * 3))
