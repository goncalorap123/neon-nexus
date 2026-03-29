local Utils = {}

-- Format a number with comma separators (e.g. 1234567 -> "1,234,567")
function Utils.formatNumber(n: number): string
	local formatted = tostring(math.floor(n))
	local k
	while true do
		formatted, k = string.gsub(formatted, "^(-?%d+)(%d%d%d)", "%1,%2")
		if k == 0 then
			break
		end
	end
	return formatted
end

-- Format a number as currency (e.g. 1234.5 -> "$1,234.50")
function Utils.formatCurrency(n: number): string
	local whole = math.floor(n)
	local cents = math.floor((n - whole) * 100 + 0.5)
	return "$" .. Utils.formatNumber(whole) .. "." .. string.format("%02d", cents)
end

return Utils
