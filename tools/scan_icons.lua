-- (v3) สแกนไอคอนของทุกชิ้นในกระเป๋า แล้วบันทึกลงแคช (slayer_icon_cache.json) ให้สคริปต์หลักใช้ต่อ
-- ใช้ครั้งเดียว (หรือเมื่อได้ของใหม่) ไม่ส่งข้อมูลไปไหนนอกจากขอลิงก์รูปจาก Roblox
-- *** กด M เปิดหน้า Inventory ค้างไว้ก่อนรัน *** (ไอคอนส่วนใหญ่หาได้จากหน้านี้เท่านั้น)
local Players = game:GetService("Players")
local RS = game:GetService("ReplicatedStorage")
local HttpService = game:GetService("HttpService")
local player = Players.LocalPlayer
local CACHE_FILE = "slayer_icon_cache.json"
local req = (syn and syn.request) or (http and http.request) or http_request or request or (fluxus and fluxus.request)
local out = {}
local function add(s) table.insert(out, s) end

-- 1) รายชื่อของทั้งหมดในกระเป๋า
local names, nameSet = {}, {}
local data = RS:FindFirstChild("Player_Service") and RS.Player_Service:FindFirstChild("Data")
data = data and data:FindFirstChild(player.Name)
if data then
    local idxObj = data:FindFirstChild("slotEquipped")
    local slots = data:FindFirstChild("slots")
    local slot = slots and (slots:FindFirstChild("Slot" .. tostring(idxObj and idxObj.Value or 1)) or slots:FindFirstChildOfClass("Folder"))
    local inv = slot and slot:FindFirstChild("Inventory")
    inv = inv and inv:FindFirstChild("Inventory")
    for _, it in ipairs(inv and inv:GetChildren() or {}) do
        if not nameSet[it.Name] then nameSet[it.Name] = true; table.insert(names, it.Name) end
    end
end
for _, n in ipairs({ "Ore", "Refinement Ore", "Coin", "Coin Stack", "Coin Pile", "Coin Pouch", "Metal Scraps", "Silk Thread", "Beast Core", "Demon Horns", "Health Potion" }) do
    if not nameSet[n] then nameSet[n] = true; table.insert(names, n) end
end
table.sort(names)

-- 2) แคชเดิม
local cache = { items = {}, urls = {} }
if isfile and readfile and isfile(CACHE_FILE) then
    local ok, d = pcall(function() return HttpService:JSONDecode(readfile(CACHE_FILE)) end)
    if ok and type(d) == "table" then cache.items = d.items or {}; cache.urls = d.urls or {} end
end

-- v2 หยิบรูปเอฟเฟกต์/NPC มาผิด 5 ชิ้น ล้างทิ้งให้หาใหม่
cache.drop = { "Bladed Wagasa", "Horse", "Spear", "Tanto", "War Fans" }
for _, bad in ipairs(cache.drop) do cache.items[bad] = nil end

local function assetId(v)
    if type(v) ~= "string" then return nil end
    return v:match("rbxassetid://(%d+)") or v:match("[%?&]id=(%d+)") or v:match("^(%d%d%d%d%d+)$")
end
local SKIP = { "gradient", "shadow", "glow", "select", "eqfg", "stroke", "border", "bg", "background", "frame" }
local function skipName(n) n = n:lower(); for _, k in ipairs(SKIP) do if n:find(k, 1, true) then return true end end return false end

-- หารูปใน object หนึ่ง (ImageLabel/Decal/Texture/ค่า/attribute) คืน id ที่น่าจะเป็นไอคอนที่สุด
local function iconIn(root)
    local best, bestScore = nil, -1
    local list = root:GetDescendants(); table.insert(list, 1, root)
    for _, d in ipairs(list) do
        local id, score = nil, 0
        if (d:IsA("ImageLabel") or d:IsA("ImageButton")) and not skipName(d.Name) then
            if not (d.ImageRectSize.X > 0 and d.ImageRectSize.Y > 0) then id = assetId(d.Image); score = 10 + d.AbsoluteSize.X * d.AbsoluteSize.Y / 1000 end
        elseif d:IsA("Decal") or d:IsA("Texture") then id = assetId(d.Texture); score = 5
        elseif d:IsA("StringValue") and d.Name:lower():find("icon") then id = assetId(d.Value); score = 20
        end
        for k, v in pairs(d:GetAttributes()) do
            local kl = k:lower()
            if (kl:find("icon") or kl:find("image")) and assetId(tostring(v)) then id = assetId(tostring(v)); score = 25 end
        end
        if d.Name:lower():find("icon") or d.Name:lower():find("img") then score = score + 15 end
        if id and score > bestScore then best, bestScore = id, score end
    end
    return best
end

-- 3) หาไอคอน: หน้า Inventory บนจอก่อน แล้วค่อยหาใน ReplicatedStorage
local pg = player:FindFirstChild("PlayerGui")
local main = pg and pg:FindFirstChild("CharactersMain", true)
local holder = main and main:FindFirstChild("ActualHolder", true)
local rsIndex = {}
local itemsRoot = RS:FindFirstChild("Items") -- นิยามไอเทมของเกม (ไม่ใช้ Effects/NPC เพราะรูปไม่ใช่ไอคอน)
for _, folder in ipairs(itemsRoot and itemsRoot:GetChildren() or {}) do
    for _, d in ipairs(folder:GetChildren()) do
        if nameSet[d.Name] then rsIndex[d.Name] = rsIndex[d.Name] or {}; table.insert(rsIndex[d.Name], d) end
    end
end

local found, from, missing = 0, {}, {}
for _, n in ipairs(names) do
    local id, src = nil, nil
    local slotUI = holder and holder:FindFirstChild(n)
    if slotUI then id = iconIn(slotUI); src = "UI" end
    if not id then
        for _, d in ipairs(rsIndex[n] or {}) do
            id = iconIn(d)
            if id then src = d:GetFullName():sub(1, 70); break end
        end
    end
    if not id and cache.items[n] then id = cache.items[n]; src = "แคชเดิม" end
    if id then cache.items[n] = id; found = found + 1; from[n] = src else table.insert(missing, n) end
end

-- 4) ขอลิงก์รูปจาก Roblox ให้ id ที่ยังไม่มีลิงก์
local need, seen = {}, {}
for _, n in ipairs(names) do
    local id = cache.items[n]
    if id and not cache.urls[id] and not seen[id] then seen[id] = true; table.insert(need, id) end
end
if req and #need > 0 then
    for i = 1, #need, 50 do
        local batch = {}
        for j = i, math.min(i + 49, #need) do table.insert(batch, need[j]) end
        local ok, res = pcall(req, { Url = "https://thumbnails.roblox.com/v1/assets?assetIds=" .. table.concat(batch, ",") .. "&returnPolicy=PlaceHolder&size=150x150&format=Png&isCircular=false", Method = "GET" })
        if ok and res and res.Body then
            local ok2, d = pcall(function() return HttpService:JSONDecode(res.Body) end)
            if ok2 and d and d.data then
                for _, e in ipairs(d.data) do
                    if e.state == "Completed" and e.imageUrl and e.imageUrl ~= "" then cache.urls[tostring(e.targetId)] = e.imageUrl end
                end
            end
        end
    end
end
if writefile then pcall(writefile, CACHE_FILE, HttpService:JSONEncode(cache)) end

-- 5) รายงาน
local withUrl = 0
for _, n in ipairs(names) do local id = cache.items[n]; if id and cache.urls[id] then withUrl = withUrl + 1 end end
add("ไอดี: " .. player.Name .. "   หน้า Inventory บนจอ: " .. (holder and "เจอ" or "ไม่เจอ (เปิดหน้า Inventory จะเจอเพิ่ม)"))
add("ของทั้งหมด " .. #names .. " ชนิด | มีไอคอนพร้อมใช้ " .. withUrl .. " | หารูปไม่เจอ " .. #missing)
add("\n== เจอ ==")
for _, n in ipairs(names) do
    local id = cache.items[n]
    if id then add(string.format("  %-32s %s  (%s)%s", n, id, from[n] or "-", cache.urls[id] and "" or "  *ยังไม่มีลิงก์รูป*")) end
end
add("\n== ไม่เจอ ==")
for _, n in ipairs(missing) do
    local hits = rsIndex[n]
    add("  " .. n .. (hits and ("   (มีใน ReplicatedStorage " .. #hits .. " ที่ เช่น " .. hits[1]:GetFullName():sub(1, 80) .. ")") or ""))
end
-- ตัวอย่างนิยามไอเทม 2 ชิ้นที่หาไม่เจอ (ให้ผมดูว่าเกมเก็บรูปไว้ตรงไหน)
local shown = 0
for _, n in ipairs(missing) do
    local d = rsIndex[n] and rsIndex[n][1]
    if d and shown < 2 then
        shown = shown + 1
        add("\n== ตัวอย่างข้อมูลไอเทม: " .. d:GetFullName() .. " ==")
        local cnt = 0
        local function dump(o, depth)
            if cnt > 40 then return end
            cnt = cnt + 1
            local line = string.rep("  ", depth) .. o.Name .. " [" .. o.ClassName .. "]"
            if o:IsA("ValueBase") then line = line .. " = " .. tostring(o.Value):sub(1, 60) end
            pcall(function() if o:IsA("MeshPart") then line = line .. " Tex=" .. o.TextureID end end)
            pcall(function() if o:IsA("SpecialMesh") then line = line .. " Tex=" .. o.TextureId end end)
            for k, v in pairs(o:GetAttributes()) do line = line .. " {" .. k .. "=" .. tostring(v):sub(1, 50) .. "}" end
            add(line)
            if depth < 3 then for _, c in ipairs(o:GetChildren()) do dump(c, depth + 1) end end
        end
        dump(d, 0)
    end
end
add("\nบันทึกลง " .. CACHE_FILE .. " แล้ว สคริปต์หลักจะใช้ไอคอนเหล่านี้ในรอบส่งถัดไป (ไม่ต้องรีเกม)")
local text = table.concat(out, "\n")
print(text)
if writefile then pcall(writefile, "icon_report_v2.txt", text) end
if setclipboard then setclipboard(text); print(">> ก๊อปลงคลิปบอร์ดแล้ว วางในแชทได้เลย (หรือส่งไฟล์ icon_report_v2.txt)") end
