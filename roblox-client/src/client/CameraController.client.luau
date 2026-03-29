local Players = game:GetService("Players")
local RunService = game:GetService("RunService")

local player = Players.LocalPlayer
local camera = workspace.CurrentCamera

-- Camera configuration for city-builder / isometric style
local CAMERA_HEIGHT = 80
local CAMERA_ANGLE = 45 -- degrees from horizontal
local CAMERA_DISTANCE = 100
local LOOK_AT = Vector3.new(0, 0, 0) -- center of the map

local function setupCamera()
	camera.CameraType = Enum.CameraType.Scriptable

	-- Calculate camera position for an overhead/isometric view
	local angleRad = math.rad(CAMERA_ANGLE)
	local offsetY = math.sin(angleRad) * CAMERA_DISTANCE
	local offsetZ = math.cos(angleRad) * CAMERA_DISTANCE

	local cameraPosition = Vector3.new(LOOK_AT.X, LOOK_AT.Y + offsetY, LOOK_AT.Z + offsetZ)
	camera.CFrame = CFrame.lookAt(cameraPosition, LOOK_AT)
end

-- Set up camera once the character loads (to override default camera)
local function onCharacterAdded(_character: Model)
	-- Small delay to let the default camera settle before overriding
	task.wait(0.5)
	setupCamera()
end

if player.Character then
	onCharacterAdded(player.Character)
end
player.CharacterAdded:Connect(onCharacterAdded)

-- Also set up on first load
task.defer(function()
	task.wait(1)
	setupCamera()
end)

-- Keep the camera locked in place each frame
RunService.RenderStepped:Connect(function()
	if camera.CameraType ~= Enum.CameraType.Scriptable then
		camera.CameraType = Enum.CameraType.Scriptable
	end
end)

print("[CameraController] Isometric camera initialized")
