local Lighting = game:GetService("Lighting")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")

print("[WorldBuilder] Generating cyberpunk city world...")

-- ============================================================
-- Ambient Lighting Setup (brighter base, vivid neon)
-- ============================================================

Lighting.ClockTime = 21 -- Nighttime
Lighting.Brightness = 0.75
Lighting.OutdoorAmbient = Color3.fromRGB(60, 40, 90)
Lighting.Ambient = Color3.fromRGB(80, 50, 120)
Lighting.FogColor = Color3.fromRGB(20, 10, 40)
Lighting.FogStart = 200
Lighting.FogEnd = 800
Lighting.GlobalShadows = true
Lighting.EnvironmentDiffuseScale = 1
Lighting.EnvironmentSpecularScale = 1

-- Atmosphere — lighter haze so you can actually see
local atmosphere = Instance.new("Atmosphere")
atmosphere.Density = 0.2
atmosphere.Offset = 0.3
atmosphere.Color = Color3.fromRGB(80, 40, 120)
atmosphere.Decay = Color3.fromRGB(50, 20, 80)
atmosphere.Glare = 0.15
atmosphere.Haze = 1.5
atmosphere.Parent = Lighting

-- ColorCorrection — brighter, more saturated
local colorCorrection = Instance.new("ColorCorrectionEffect")
colorCorrection.Brightness = 0.08
colorCorrection.Contrast = 0.1
colorCorrection.Saturation = 0.35
colorCorrection.TintColor = Color3.fromRGB(230, 210, 255)
colorCorrection.Parent = Lighting

-- Bloom — stronger glow for neon
local bloom = Instance.new("BloomEffect")
bloom.Intensity = 0.4
bloom.Size = 40
bloom.Threshold = 0.8
bloom.Parent = Lighting

-- ============================================================
-- Ground Plane — faint neon grid look
-- ============================================================

local worldFolder = Instance.new("Folder")
worldFolder.Name = "CityWorld"
worldFolder.Parent = workspace

local ground = Instance.new("Part")
ground.Name = "Ground"
ground.Size = Vector3.new(400, 1, 400)
ground.Position = Vector3.new(0, -0.5, 0)
ground.Anchored = true
ground.Color = Color3.fromRGB(18, 18, 25)
ground.Material = Enum.Material.SmoothPlastic
ground.TopSurface = Enum.SurfaceType.Smooth
ground.BottomSurface = Enum.SurfaceType.Smooth
ground.Parent = worldFolder

-- Big ambient light under the city
local groundLight = Instance.new("PointLight")
groundLight.Color = Color3.fromRGB(0, 180, 255)
groundLight.Brightness = 1
groundLight.Range = 200
groundLight.Parent = ground

-- ============================================================
-- Neon Grid Lines on the Ground
-- ============================================================

local gridFolder = Instance.new("Folder")
gridFolder.Name = "NeonGrid"
gridFolder.Parent = worldFolder

local gridSpacing = 20
local gridRange = 180

for i = -gridRange, gridRange, gridSpacing do
	-- X-axis lines
	local lineX = Instance.new("Part")
	lineX.Name = "GridX_" .. i
	lineX.Size = Vector3.new(gridRange * 2, 0.05, 0.15)
	lineX.Position = Vector3.new(0, 0.03, i)
	lineX.Anchored = true
	lineX.CanCollide = false
	lineX.Color = Color3.fromRGB(0, 120, 180)
	lineX.Material = Enum.Material.Neon
	lineX.Transparency = 0.4
	lineX.Parent = gridFolder

	-- Z-axis lines
	local lineZ = Instance.new("Part")
	lineZ.Name = "GridZ_" .. i
	lineZ.Size = Vector3.new(0.15, 0.05, gridRange * 2)
	lineZ.Position = Vector3.new(i, 0.03, 0)
	lineZ.Anchored = true
	lineZ.CanCollide = false
	lineZ.Color = Color3.fromRGB(0, 120, 180)
	lineZ.Material = Enum.Material.Neon
	lineZ.Transparency = 0.4
	lineZ.Parent = gridFolder
end

-- ============================================================
-- Building Grid
-- ============================================================

local buildingsFolder = Instance.new("Folder")
buildingsFolder.Name = "Buildings"
buildingsFolder.Parent = worldFolder

-- Neon-themed building palette (slightly lighter so they're visible)
local buildingColors = {
	Color3.fromRGB(25, 30, 60),
	Color3.fromRGB(35, 20, 55),
	Color3.fromRGB(20, 40, 50),
	Color3.fromRGB(30, 20, 50),
	Color3.fromRGB(28, 35, 50),
}

-- Neon accent colors for building lights
local neonAccents = {
	Color3.fromRGB(0, 220, 255),   -- cyan
	Color3.fromRGB(255, 0, 220),   -- magenta/pink
	Color3.fromRGB(130, 0, 255),   -- purple
	Color3.fromRGB(0, 255, 150),   -- neon green
	Color3.fromRGB(255, 120, 0),   -- orange
	Color3.fromRGB(255, 255, 0),   -- yellow
}

-- 4x4 grid of building plots
local GRID_SIZE = 4
local PLOT_SPACING = 70
local GRID_OFFSET = -((GRID_SIZE - 1) * PLOT_SPACING) / 2

for row = 0, GRID_SIZE - 1 do
	for col = 0, GRID_SIZE - 1 do
		local centerX = GRID_OFFSET + col * PLOT_SPACING
		local centerZ = GRID_OFFSET + row * PLOT_SPACING

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
			building.Position = Vector3.new(centerX + offsetX, height / 2, centerZ + offsetZ)
			building.Anchored = true
			building.CanCollide = true
			building.Color = buildingColors[math.random(1, #buildingColors)]
			building.Material = Enum.Material.SmoothPlastic
			building.TopSurface = Enum.SurfaceType.Smooth
			building.BottomSurface = Enum.SurfaceType.Smooth
			building.Parent = buildingsFolder

			local accentColor = neonAccents[math.random(1, #neonAccents)]

			-- Bright point light on each building
			local light = Instance.new("PointLight")
			light.Color = accentColor
			light.Brightness = 1.5
			light.Range = math.random(25, 45)
			light.Parent = building

			-- Neon strip on front face
			local neonStrip = Instance.new("Part")
			neonStrip.Name = "NeonStrip_Front"
			neonStrip.Size = Vector3.new(width * 0.8, 0.3, 0.1)
			neonStrip.Position = Vector3.new(
				centerX + offsetX,
				height * 0.7,
				centerZ + offsetZ - depth / 2 - 0.05
			)
			neonStrip.Anchored = true
			neonStrip.CanCollide = false
			neonStrip.Color = accentColor
			neonStrip.Material = Enum.Material.Neon
			neonStrip.Parent = buildingsFolder

			-- Neon strip on right face
			local neonStripR = Instance.new("Part")
			neonStripR.Name = "NeonStrip_Right"
			neonStripR.Size = Vector3.new(0.1, 0.3, depth * 0.8)
			neonStripR.Position = Vector3.new(
				centerX + offsetX + width / 2 + 0.05,
				height * 0.7,
				centerZ + offsetZ
			)
			neonStripR.Anchored = true
			neonStripR.CanCollide = false
			neonStripR.Color = neonAccents[math.random(1, #neonAccents)]
			neonStripR.Material = Enum.Material.Neon
			neonStripR.Parent = buildingsFolder

			-- Surface lights on multiple faces — much brighter
			local surfaceLight = Instance.new("SurfaceLight")
			surfaceLight.Color = accentColor
			surfaceLight.Brightness = 1
			surfaceLight.Range = 30
			surfaceLight.Face = Enum.NormalId.Front
			surfaceLight.Parent = building

			local surfaceLight2 = Instance.new("SurfaceLight")
			surfaceLight2.Color = neonAccents[math.random(1, #neonAccents)]
			surfaceLight2.Brightness = 0.75
			surfaceLight2.Range = 25
			surfaceLight2.Face = Enum.NormalId.Right
			surfaceLight2.Parent = building

			local surfaceLight3 = Instance.new("SurfaceLight")
			surfaceLight3.Color = neonAccents[math.random(1, #neonAccents)]
			surfaceLight3.Brightness = 0.75
			surfaceLight3.Range = 25
			surfaceLight3.Face = Enum.NormalId.Left
			surfaceLight3.Parent = building

			-- Rooftop beacon light on taller buildings
			if height > 25 then
				local beacon = Instance.new("Part")
				beacon.Name = "Beacon"
				beacon.Shape = Enum.PartType.Ball
				beacon.Size = Vector3.new(1.5, 1.5, 1.5)
				beacon.Position = Vector3.new(centerX + offsetX, height + 1, centerZ + offsetZ)
				beacon.Anchored = true
				beacon.CanCollide = false
				beacon.Color = accentColor
				beacon.Material = Enum.Material.Neon
				beacon.Parent = buildingsFolder

				local beaconLight = Instance.new("PointLight")
				beaconLight.Color = accentColor
				beaconLight.Brightness = 2.5
				beaconLight.Range = 50
				beaconLight.Parent = beacon
			end
		end
	end
end

-- ============================================================
-- Neon Street Strips
-- ============================================================

local streetsFolder = Instance.new("Folder")
streetsFolder.Name = "Streets"
streetsFolder.Parent = worldFolder

-- Horizontal streets
for row = 0, GRID_SIZE do
	local z = GRID_OFFSET + row * PLOT_SPACING - PLOT_SPACING / 2

	local streetH = Instance.new("Part")
	streetH.Name = "Street_H_" .. row
	streetH.Size = Vector3.new(GRID_SIZE * PLOT_SPACING + 60, 0.1, 8)
	streetH.Position = Vector3.new(0, 0.05, z)
	streetH.Anchored = true
	streetH.CanCollide = false
	streetH.Color = Color3.fromRGB(25, 25, 35)
	streetH.Material = Enum.Material.SmoothPlastic
	streetH.Parent = streetsFolder

	-- Bright center neon line
	local centerLine = Instance.new("Part")
	centerLine.Name = "CenterLine_H_" .. row
	centerLine.Size = Vector3.new(GRID_SIZE * PLOT_SPACING + 60, 0.12, 0.4)
	centerLine.Position = Vector3.new(0, 0.07, z)
	centerLine.Anchored = true
	centerLine.CanCollide = false
	centerLine.Color = Color3.fromRGB(0, 200, 255)
	centerLine.Material = Enum.Material.Neon
	centerLine.Parent = streetsFolder

	-- Edge neon lines
	for _, side in ipairs({ -3.5, 3.5 }) do
		local edgeLine = Instance.new("Part")
		edgeLine.Name = "Edge_H_" .. row .. "_" .. tostring(side)
		edgeLine.Size = Vector3.new(GRID_SIZE * PLOT_SPACING + 60, 0.12, 0.2)
		edgeLine.Position = Vector3.new(0, 0.07, z + side)
		edgeLine.Anchored = true
		edgeLine.CanCollide = false
		edgeLine.Color = Color3.fromRGB(255, 0, 200)
		edgeLine.Material = Enum.Material.Neon
		edgeLine.Parent = streetsFolder
	end

	-- Street lamp posts along the road
	for lampX = -140, 140, 35 do
		local pole = Instance.new("Part")
		pole.Name = "Lamppost"
		pole.Size = Vector3.new(0.4, 12, 0.4)
		pole.Position = Vector3.new(lampX, 6, z + 5)
		pole.Anchored = true
		pole.CanCollide = true
		pole.Color = Color3.fromRGB(50, 50, 60)
		pole.Material = Enum.Material.Metal
		pole.Parent = streetsFolder

		local lampHead = Instance.new("Part")
		lampHead.Name = "LampHead"
		lampHead.Shape = Enum.PartType.Ball
		lampHead.Size = Vector3.new(2, 2, 2)
		lampHead.Position = Vector3.new(lampX, 12.5, z + 5)
		lampHead.Anchored = true
		lampHead.CanCollide = false
		lampHead.Color = neonAccents[math.random(1, #neonAccents)]
		lampHead.Material = Enum.Material.Neon
		lampHead.Parent = streetsFolder

		local lampLight = Instance.new("PointLight")
		lampLight.Color = lampHead.Color
		lampLight.Brightness = 2
		lampLight.Range = 40
		lampLight.Parent = lampHead
	end
end

-- Vertical streets
for col = 0, GRID_SIZE do
	local x = GRID_OFFSET + col * PLOT_SPACING - PLOT_SPACING / 2

	local streetV = Instance.new("Part")
	streetV.Name = "Street_V_" .. col
	streetV.Size = Vector3.new(8, 0.1, GRID_SIZE * PLOT_SPACING + 60)
	streetV.Position = Vector3.new(x, 0.05, 0)
	streetV.Anchored = true
	streetV.CanCollide = false
	streetV.Color = Color3.fromRGB(25, 25, 35)
	streetV.Material = Enum.Material.SmoothPlastic
	streetV.Parent = streetsFolder

	local centerLine = Instance.new("Part")
	centerLine.Name = "CenterLine_V_" .. col
	centerLine.Size = Vector3.new(0.4, 0.12, GRID_SIZE * PLOT_SPACING + 60)
	centerLine.Position = Vector3.new(x, 0.07, 0)
	centerLine.Anchored = true
	centerLine.CanCollide = false
	centerLine.Color = Color3.fromRGB(0, 200, 255)
	centerLine.Material = Enum.Material.Neon
	centerLine.Parent = streetsFolder

	for _, side in ipairs({ -3.5, 3.5 }) do
		local edgeLine = Instance.new("Part")
		edgeLine.Name = "Edge_V_" .. col .. "_" .. tostring(side)
		edgeLine.Size = Vector3.new(0.2, 0.12, GRID_SIZE * PLOT_SPACING + 60)
		edgeLine.Position = Vector3.new(x + side, 0.07, 0)
		edgeLine.Anchored = true
		edgeLine.CanCollide = false
		edgeLine.Color = Color3.fromRGB(255, 0, 200)
		edgeLine.Material = Enum.Material.Neon
		edgeLine.Parent = streetsFolder
	end
end

-- ============================================================
-- Resource Spawn Points (larger, brighter)
-- ============================================================

local resourcesFolder = Instance.new("Folder")
resourcesFolder.Name = "ResourceSpawns"
resourcesFolder.Parent = worldFolder

local resourceTypes = {
	{ name = "Wood",   color = Color3.fromRGB(180, 100, 40),  glowColor = Color3.fromRGB(255, 160, 60)  },
	{ name = "Steel",  color = Color3.fromRGB(180, 190, 200), glowColor = Color3.fromRGB(220, 230, 255) },
	{ name = "Energy", color = Color3.fromRGB(255, 240, 40),  glowColor = Color3.fromRGB(255, 255, 120) },
	{ name = "Food",   color = Color3.fromRGB(60, 220, 80),   glowColor = Color3.fromRGB(100, 255, 130) },
}

-- Find a position that doesn't overlap any building
local function findClearResourcePosition(): Vector3
	local overlapParams = OverlapParams.new()
	overlapParams.FilterType = Enum.RaycastFilterType.Include
	overlapParams.FilterDescendantsInstances = { buildingsFolder }

	for _ = 1, 20 do -- try up to 20 times
		local candidate = Vector3.new(math.random(-130, 130), 2.5, math.random(-130, 130))
		-- Check a 6×6×6 box around the candidate (slightly larger than the 4×4×4 resource)
		local hits = workspace:GetPartBoundsInBox(CFrame.new(candidate), Vector3.new(6, 10, 6), overlapParams)
		if #hits == 0 then
			return candidate
		end
	end
	-- Fallback: place at map edge where there are no buildings
	return Vector3.new(math.random(-10, 10) + (if math.random() > 0.5 then 120 else -120), 2.5, math.random(-60, 60))
end

for _, resInfo in ipairs(resourceTypes) do
	for i = 1, 3 do
		local cube = Instance.new("Part")
		cube.Name = resInfo.name .. "_Spawn_" .. i
		cube.Shape = Enum.PartType.Block
		cube.Size = Vector3.new(4, 4, 4)
		cube.Position = findClearResourcePosition()
		cube.Anchored = true
		cube.CanCollide = false
		cube.Color = resInfo.color
		cube.Material = Enum.Material.Neon
		cube.Parent = resourcesFolder

		-- Much brighter glow
		local glow = Instance.new("PointLight")
		glow.Color = resInfo.glowColor
		glow.Brightness = 2
		glow.Range = 25
		glow.Parent = cube

		-- BillboardGui label
		local billboard = Instance.new("BillboardGui")
		billboard.Size = UDim2.new(0, 100, 0, 30)
		billboard.StudsOffset = Vector3.new(0, 4, 0)
		billboard.AlwaysOnTop = true
		billboard.Adornee = cube
		billboard.Parent = cube

		local label = Instance.new("TextLabel")
		label.Size = UDim2.new(1, 0, 1, 0)
		label.BackgroundTransparency = 1
		label.TextColor3 = resInfo.glowColor
		label.TextStrokeTransparency = 0
		label.TextStrokeColor3 = Color3.fromRGB(0, 0, 0)
		label.TextSize = 16
		label.Font = Enum.Font.GothamBold
		label.Text = resInfo.name
		label.Parent = billboard

		-- Resource node particle effect
		local particles = Instance.new("ParticleEmitter")
		particles.Rate = 3
		particles.Lifetime = NumberRange.new(1, 2.5)
		particles.Speed = NumberRange.new(0.5, 2)
		particles.SpreadAngle = Vector2.new(180, 180)
		particles.Size = NumberSequence.new({
			NumberSequenceKeypoint.new(0, 0.2),
			NumberSequenceKeypoint.new(0.5, 0.4),
			NumberSequenceKeypoint.new(1, 0),
		})
		particles.Transparency = NumberSequence.new({
			NumberSequenceKeypoint.new(0, 0.5),
			NumberSequenceKeypoint.new(0.5, 0),
			NumberSequenceKeypoint.new(1, 1),
		})
		particles.Color = ColorSequence.new(resInfo.color)
		particles.LightEmission = 1
		particles.Parent = cube
	end
end

-- ============================================================
-- Corner Pillar Lights (big ambient neon pillars at map edges)
-- ============================================================

local pillarsFolder = Instance.new("Folder")
pillarsFolder.Name = "NeonPillars"
pillarsFolder.Parent = worldFolder

local pillarPositions = {
	Vector3.new(-180, 0, -180),
	Vector3.new(180, 0, -180),
	Vector3.new(-180, 0, 180),
	Vector3.new(180, 0, 180),
	Vector3.new(0, 0, -180),
	Vector3.new(0, 0, 180),
	Vector3.new(-180, 0, 0),
	Vector3.new(180, 0, 0),
}

for idx, pos in ipairs(pillarPositions) do
	local pillar = Instance.new("Part")
	pillar.Name = "NeonPillar_" .. idx
	pillar.Size = Vector3.new(2, 50, 2)
	pillar.Position = Vector3.new(pos.X, 25, pos.Z)
	pillar.Anchored = true
	pillar.CanCollide = false
	pillar.Color = neonAccents[(idx % #neonAccents) + 1]
	pillar.Material = Enum.Material.Neon
	pillar.Transparency = 0.2
	pillar.Parent = pillarsFolder

	local pillarLight = Instance.new("PointLight")
	pillarLight.Color = pillar.Color
	pillarLight.Brightness = 3
	pillarLight.Range = 80
	pillarLight.Parent = pillar
end

-- ============================================================
-- Sponsor Billboards (Flow, Filecoin, Protocol Labs)
-- ============================================================

local sponsorsFolder = Instance.new("Folder")
sponsorsFolder.Name = "SponsorBillboards"
sponsorsFolder.Parent = worldFolder

local sponsors = {
	{
		name = "FLOW",
		color = Color3.fromRGB(0, 239, 139),  -- Flow green
		position = Vector3.new(0, 35, -185),
		rotation = 0,
	},
	{
		name = "FILECOIN",
		color = Color3.fromRGB(0, 180, 255),   -- Filecoin blue
		position = Vector3.new(-185, 35, 0),
		rotation = 90,
	},
	{
		name = "PROTOCOL LABS",
		color = Color3.fromRGB(255, 255, 255),  -- Protocol Labs white
		position = Vector3.new(185, 35, 0),
		rotation = -90,
	},
	-- Duplicates on opposite sides
	{
		name = "FLOW",
		color = Color3.fromRGB(0, 239, 139),
		position = Vector3.new(0, 35, 185),
		rotation = 180,
	},
	{
		name = "FILECOIN",
		color = Color3.fromRGB(0, 180, 255),
		position = Vector3.new(100, 35, -185),
		rotation = 0,
	},
	{
		name = "PROTOCOL LABS",
		color = Color3.fromRGB(255, 255, 255),
		position = Vector3.new(-100, 35, -185),
		rotation = 0,
	},
}

for idx, sponsor in ipairs(sponsors) do
	-- Backing panel (dark, semi-transparent)
	local panel = Instance.new("Part")
	panel.Name = "SponsorPanel_" .. idx
	panel.Size = Vector3.new(40, 12, 0.5)
	panel.Position = sponsor.position
	panel.Anchored = true
	panel.CanCollide = false
	panel.Color = Color3.fromRGB(10, 10, 20)
	panel.Material = Enum.Material.SmoothPlastic
	panel.Transparency = 0.3
	panel.Parent = sponsorsFolder

	-- Rotate to face inward
	panel.CFrame = CFrame.new(sponsor.position) * CFrame.Angles(0, math.rad(sponsor.rotation), 0)

	local panelCorner = Instance.new("SurfaceLight")
	panelCorner.Color = sponsor.color
	panelCorner.Brightness = 0.5
	panelCorner.Range = 20
	panelCorner.Face = Enum.NormalId.Front
	panelCorner.Parent = panel

	-- Neon border frame (top)
	local borderTop = Instance.new("Part")
	borderTop.Name = "Border_Top"
	borderTop.Size = Vector3.new(40, 0.3, 0.6)
	borderTop.Anchored = true
	borderTop.CanCollide = false
	borderTop.Color = sponsor.color
	borderTop.Material = Enum.Material.Neon
	borderTop.Parent = sponsorsFolder
	borderTop.CFrame = panel.CFrame * CFrame.new(0, 6, 0)

	-- Neon border (bottom)
	local borderBot = Instance.new("Part")
	borderBot.Name = "Border_Bot"
	borderBot.Size = Vector3.new(40, 0.3, 0.6)
	borderBot.Anchored = true
	borderBot.CanCollide = false
	borderBot.Color = sponsor.color
	borderBot.Material = Enum.Material.Neon
	borderBot.Parent = sponsorsFolder
	borderBot.CFrame = panel.CFrame * CFrame.new(0, -6, 0)

	-- Neon border (left)
	local borderL = Instance.new("Part")
	borderL.Name = "Border_L"
	borderL.Size = Vector3.new(0.3, 12, 0.6)
	borderL.Anchored = true
	borderL.CanCollide = false
	borderL.Color = sponsor.color
	borderL.Material = Enum.Material.Neon
	borderL.Parent = sponsorsFolder
	borderL.CFrame = panel.CFrame * CFrame.new(-20, 0, 0)

	-- Neon border (right)
	local borderR = Instance.new("Part")
	borderR.Name = "Border_R"
	borderR.Size = Vector3.new(0.3, 12, 0.6)
	borderR.Anchored = true
	borderR.CanCollide = false
	borderR.Color = sponsor.color
	borderR.Material = Enum.Material.Neon
	borderR.Parent = sponsorsFolder
	borderR.CFrame = panel.CFrame * CFrame.new(20, 0, 0)

	-- Glow light behind panel
	local glow = Instance.new("PointLight")
	glow.Color = sponsor.color
	glow.Brightness = 2
	glow.Range = 50
	glow.Parent = panel

	-- BillboardGui with sponsor name text (always faces camera)
	local billboard = Instance.new("BillboardGui")
	billboard.Name = "SponsorText"
	billboard.Size = UDim2.new(0, 500, 0, 120)
	billboard.StudsOffset = Vector3.new(0, 0, -1)
	billboard.Adornee = panel
	billboard.AlwaysOnTop = false
	billboard.MaxDistance = 300
	billboard.Parent = panel

	-- "Powered by" subtitle
	local poweredBy = Instance.new("TextLabel")
	poweredBy.Name = "PoweredBy"
	poweredBy.Size = UDim2.new(1, 0, 0.25, 0)
	poweredBy.Position = UDim2.new(0, 0, 0.05, 0)
	poweredBy.BackgroundTransparency = 1
	poweredBy.TextColor3 = Color3.fromRGB(140, 140, 170)
	poweredBy.TextSize = 18
	poweredBy.Font = Enum.Font.Gotham
	poweredBy.Text = "Powered by"
	poweredBy.Parent = billboard

	-- Main sponsor name
	local nameLabel = Instance.new("TextLabel")
	nameLabel.Name = "SponsorName"
	nameLabel.Size = UDim2.new(1, 0, 0.55, 0)
	nameLabel.Position = UDim2.new(0, 0, 0.28, 0)
	nameLabel.BackgroundTransparency = 1
	nameLabel.TextColor3 = sponsor.color
	nameLabel.TextStrokeTransparency = 0.2
	nameLabel.TextStrokeColor3 = Color3.fromRGB(0, 0, 0)
	nameLabel.TextSize = 48
	nameLabel.Font = Enum.Font.GothamBold
	nameLabel.Text = sponsor.name
	nameLabel.Parent = billboard
end

print("[WorldBuilder] Sponsor billboards placed:", #sponsors)

print("[WorldBuilder] City world generation complete!")
print(string.format("[WorldBuilder] Generated %d building plots, %d resource spawns, %d neon pillars",
	GRID_SIZE * GRID_SIZE, #resourceTypes * 3, #pillarPositions))

-- ============================================================
-- A. Pulsing Neon Lights
-- ============================================================

local allLights = {}
local allBeacons = {}

for _, child in worldFolder:GetDescendants() do
	if child:IsA("PointLight") and child.Parent:IsA("Part") then
		table.insert(allLights, { light = child, phase = math.random() * math.pi * 2, speed = 0.5 + math.random() * 1.5 })
	end
	if child.Name == "Beacon" and child:IsA("Part") then
		table.insert(allBeacons, { part = child, phase = math.random() * math.pi * 2, speed = 0.3 + math.random() * 1.0 })
	end
end

RunService.Heartbeat:Connect(function()
	local t = tick()
	for _, entry in allLights do
		entry.light.Brightness = 1.0 + 0.8 * math.sin(t * entry.speed + entry.phase)
	end
	for _, entry in allBeacons do
		entry.part.Transparency = 0.1 + 0.2 * math.sin(t * entry.speed + entry.phase)
	end
end)

print("[WorldBuilder] Pulsing neon lights initialized:", #allLights, "lights,", #allBeacons, "beacons")

-- ============================================================
-- C. Floating Holographic Particles
-- ============================================================

for i = 1, 5 do
	local anchor = Instance.new("Part")
	anchor.Name = "HoloAnchor_" .. i
	anchor.Size = Vector3.new(1, 1, 1)
	anchor.Transparency = 1
	anchor.Anchored = true
	anchor.CanCollide = false
	anchor.Position = Vector3.new(math.random(-60, 60), math.random(15, 25), math.random(-60, 60))
	anchor.Parent = worldFolder

	local holo = Instance.new("ParticleEmitter")
	holo.Rate = 2
	holo.Lifetime = NumberRange.new(3, 6)
	holo.Speed = NumberRange.new(0.3, 1)
	holo.SpreadAngle = Vector2.new(360, 360)
	holo.Size = NumberSequence.new({
		NumberSequenceKeypoint.new(0, 0.1),
		NumberSequenceKeypoint.new(0.5, 0.4),
		NumberSequenceKeypoint.new(1, 0),
	})
	holo.Color = ColorSequence.new(Color3.fromRGB(0, 255, 220), Color3.fromRGB(180, 0, 255))
	holo.LightEmission = 1
	holo.Transparency = NumberSequence.new({
		NumberSequenceKeypoint.new(0, 1),
		NumberSequenceKeypoint.new(0.2, 0.3),
		NumberSequenceKeypoint.new(0.8, 0.3),
		NumberSequenceKeypoint.new(1, 1),
	})
	holo.Parent = anchor
end

print("[WorldBuilder] Holographic particles spawned")

-- ============================================================
-- D. Agent Building Ownership + Evolution System
-- ============================================================

local HttpBridge = require(script.Parent:WaitForChild("HttpBridge"))

-- Same color palette as AgentSimulator (must stay in sync)
local agentColorPalette = {
	Color3.fromRGB(0, 200, 255),    -- cyan
	Color3.fromRGB(255, 60, 180),   -- pink/magenta
	Color3.fromRGB(120, 50, 255),   -- purple
	Color3.fromRGB(0, 255, 130),    -- neon green
	Color3.fromRGB(255, 150, 0),    -- orange
	Color3.fromRGB(255, 255, 50),   -- yellow
	Color3.fromRGB(255, 80, 80),    -- red
	Color3.fromRGB(80, 180, 255),   -- light blue
}

-- Collect all buildings into a flat list
local allBuildings: { Part } = {}
for _, child in buildingsFolder:GetChildren() do
	if child:IsA("Part") and string.find(child.Name, "Building") then
		table.insert(allBuildings, child)
	end
end

-- Track which buildings are assigned to which agent
local agentBuildings: { [string]: { Part } } = {}
local agentColorMap: { [string]: number } = {}
local nextAgentColorIdx = 1

-- Assign buildings evenly across agents and color them
local function assignBuildingsToAgents(agentIds: { string })
	if #agentIds == 0 or #allBuildings == 0 then return end

	-- Assign color indices to new agents
	for _, agentId in agentIds do
		if not agentColorMap[agentId] then
			agentColorMap[agentId] = nextAgentColorIdx
			nextAgentColorIdx = (nextAgentColorIdx % #agentColorPalette) + 1
		end
	end

	-- Distribute buildings evenly
	local buildingsPerAgent = math.floor(#allBuildings / #agentIds)
	local remainder = #allBuildings % #agentIds
	local buildingIdx = 1

	for i, agentId in agentIds do
		local count = buildingsPerAgent + (if i <= remainder then 1 else 0)
		agentBuildings[agentId] = {}
		local agentColor = agentColorPalette[agentColorMap[agentId]] or agentColorPalette[1]
		-- Darker version of agent color for building body
		local buildingColor = Color3.new(
			math.max(0, agentColor.R * 0.15),
			math.max(0, agentColor.G * 0.15),
			math.max(0, agentColor.B * 0.15)
		)

		for _ = 1, count do
			if buildingIdx > #allBuildings then break end
			local bldg = allBuildings[buildingIdx]
			buildingIdx += 1
			table.insert(agentBuildings[agentId], bldg)

			-- Tween building to agent's dark color
			TweenService:Create(bldg, TweenInfo.new(1.5, Enum.EasingStyle.Quad), {
				Color = buildingColor,
			}):Play()

			-- Update neon strips and lights on this building to agent color
			local bldgName = bldg.Name
			local row, col, idx = string.match(bldgName, "Building_R(%d+)_C(%d+)_(%d+)")
			if row then
				for _, sibling in buildingsFolder:GetChildren() do
					if sibling:IsA("Part") and string.find(sibling.Name, "NeonStrip") then
						-- Match neon strips near this building's position
						local dist = (sibling.Position - bldg.Position).Magnitude
						if dist < 30 then
							TweenService:Create(sibling, TweenInfo.new(1.5, Enum.EasingStyle.Quad), {
								Color = agentColor,
							}):Play()
						end
					end
				end
			end

			-- Update lights on the building
			for _, child in bldg:GetChildren() do
				if child:IsA("PointLight") or child:IsA("SurfaceLight") then
					child.Color = agentColor
				end
			end

			-- Update beacon if nearby
			for _, sibling in buildingsFolder:GetChildren() do
				if sibling.Name == "Beacon" then
					local dist = (Vector3.new(sibling.Position.X, 0, sibling.Position.Z) - Vector3.new(bldg.Position.X, 0, bldg.Position.Z)).Magnitude
					if dist < 5 then
						TweenService:Create(sibling, TweenInfo.new(1.5, Enum.EasingStyle.Quad), {
							Color = agentColor,
						}):Play()
						local beaconLight = sibling:FindFirstChildOfClass("PointLight")
						if beaconLight then
							beaconLight.Color = agentColor
						end
					end
				end
			end
		end
	end

	print("[WorldBuilder] Assigned", #allBuildings, "buildings across", #agentIds, "agents")
end

-- Grow buildings for an agent when they hit milestones
local agentMilestones: { [string]: { [number]: boolean } } = {}
local milestones = { 500, 2000, 5000, 10000, 50000 }

local function evolveAgentBuildings(agentId: string, score: number)
	if not agentMilestones[agentId] then
		agentMilestones[agentId] = {}
	end
	if not agentBuildings[agentId] then return end

	for i, threshold in milestones do
		if score >= threshold and not agentMilestones[agentId][i] then
			agentMilestones[agentId][i] = true
			-- Grow one of this agent's buildings
			local buildings = agentBuildings[agentId]
			if #buildings > 0 then
				local bldg = buildings[math.random(1, #buildings)]
				local growAmount = 5 + math.random(0, 8)
				TweenService:Create(bldg, TweenInfo.new(2, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
					Size = bldg.Size + Vector3.new(0, growAmount, 0),
					Position = bldg.Position + Vector3.new(0, growAmount / 2, 0),
				}):Play()
				print("[WorldBuilder] Agent", agentId, "milestone", threshold, "- building grew!")
			end
		end
	end
end

-- Polling loop: assign buildings on first data, then evolve
local buildingsAssigned = false

task.spawn(function()
	while true do
		task.wait(15)
		local success, leaderboard = HttpBridge.getLeaderboard()
		if success and leaderboard and type(leaderboard) == "table" and #leaderboard > 0 then
			-- First time: assign buildings to agents
			if not buildingsAssigned then
				local agentIds = {}
				for _, agent in leaderboard do
					if agent.alive ~= false then
						table.insert(agentIds, agent.playerId)
					end
				end
				if #agentIds > 0 then
					assignBuildingsToAgents(agentIds)
					buildingsAssigned = true
				end
			end

			-- Evolve buildings based on scores
			for _, agent in leaderboard do
				if agent.alive ~= false then
					evolveAgentBuildings(agent.playerId, agent.score or 0)
				end
			end
		end
	end
end)

print("[WorldBuilder] Agent building ownership system initialized")
