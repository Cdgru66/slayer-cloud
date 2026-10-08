-- Slayer Fleet: สแกนไอคอนแบบละเอียด (บอส / มินิแมพ / ทุก UI รวมที่ซ่อนอยู่ / แม่แบบใน ReplicatedStorage)
-- วิธีใช้: เข้าเกม ยืนใกล้บอสหรือให้บอสขึ้นในมินิแมพ แล้วรัน (เปิดพจนานุกรมค้างไว้ด้วยยิ่งดี)
-- ผลลัพธ์: slayer_icon_deep.json ในโฟลเดอร์ workspace ของ executor ส่งไฟล์นี้ให้ผู้ดูแล
-- อ่านอย่างเดียว ไม่แตะอะไรในเกม ไม่ส่งข้อมูลไปไหน นอกจากขอลิงก์รูปจาก thumbnails.roblox.com
local Players = game:GetService("Players")
local RS = game:GetService("ReplicatedStorage")
local HttpService = game:GetService("HttpService")
local player = Players.LocalPlayer
local req = (syn and syn.request) or (http and http.request) or http_request or request or (fluxus and fluxus.request)

-- ===== รายชื่อบอส: จากข้อมูลเกม + รายชื่อสำรอง + ชื่อโมเดลที่มี Humanoid ในแมพ =====
local bossSet, bossList = {}, {}
local function addBoss(n)
    n = tostring(n or ""):gsub("^%s+", ""):gsub("%s+$", "")
    if n ~= "" and #n <= 30 and not bossSet[n:lower()] then bossSet[n:lower()] = n; table.insert(bossList, n) end
end
pcall(function()
    local d = RS.Player_Service.Data:FindFirstChild(player.Name)
    local sv = d and d:FindFirstChild("Bosses", true)
    if sv and sv:IsA("StringValue") then for n in sv.Value:gmatch("[^,]+") do addBoss(n) end end
end)
for _, n in ipairs({ "Zuko", "MotherBear", "Kaiden", "Hoyuzo", "Reaper", "Gyutai", "Datai", "Shinora", "Akazo", "Enru", "Nezura",
    "Rengu", "Obari", "Zentaro", "Yahari", "Tengai", "Domae", "Gyorei", "Sumari", "Giyen", "Muzan", "Hiyozu" }) do addBoss(n) end
local function bossIn(text)
    if not text or text == "" then return nil end
    local t = text:lower():gsub("[%s_%-]", "")
    for low, real in pairs(bossSet) do
        if t:find(low:gsub("[%s_%-]", ""), 1, true) then return real end
    end
    return nil
end

-- ===== เก็บผล =====
local byId = {}      -- asset id -> { names = {..}, paths = {..}, boss = ชื่อบอส }
local nIds = 0
local function idOf(s)
    if type(s) ~= "string" or s == "" then return nil end
    return s:match("rbxassetid://(%d+)") or s:match("rbxthumb://.-id=(%d+)") or s:match("[%?&]id=(%d+)") or s:match("^(%d%d%d%d%d+)$")
end
local function short(path) path = path:gsub("^Players%.[^%.]+%.", ""); return #path > 160 and ("…" .. path:sub(-160)) or path end
local function record(id, obj, extraName)
    if not id or nIds > 3000 and not byId[id] then return end
    local e = byId[id]
    if not e then e = { names = {}, paths = {}, nn = {} }; byId[id] = e; nIds = nIds + 1 end
    local function nm(n)
        n = tostring(n or ""):gsub("<[^>]->", ""):gsub("^%s+", ""):gsub("%s+$", "")
        if n ~= "" and #n <= 60 and not e.nn[n] and #e.names < 8 then e.nn[n] = true; table.insert(e.names, n) end
        local b = bossIn(n); if b and not e.boss then e.boss = b end
    end
    if extraName then nm(extraName) end
    -- ชื่อของตัวมันเอง + พ่อแม่ 4 ชั้น
    local p = obj
    for _ = 1, 5 do
        if not p or p == game then break end
        nm(p.Name)
        p = p.Parent
    end
    -- ข้อความที่อยู่ใกล้ (TextLabel ในกลุ่มเดียวกัน)
    pcall(function()
        local box = obj.Parent
        for _ = 1, 2 do
            if not box then break end
            for _, d in ipairs(box:GetChildren()) do
                if d:IsA("TextLabel") or d:IsA("TextButton") then
                    local t = d.Text
                    if t ~= "" and not t:match("^[%dxX%s,%.%%/+%-:]+$") then nm(t) end
                end
            end
            box = box.Parent
        end
    end)
    if #e.paths < 3 then table.insert(e.paths, short(obj:GetFullName())) end
end

local function scanObj(d)
    local ok = pcall(function()
        if d:IsA("ImageLabel") or d:IsA("ImageButton") then
            if not (d.ImageRectSize.X > 0 and d.ImageRectSize.Y > 0) then record(idOf(d.Image), d) end
        elseif d:IsA("Decal") or d:IsA("Texture") then record(idOf(d.Texture), d)
        elseif d:IsA("Tool") then record(idOf(d.TextureId), d)
        elseif d:IsA("StringValue") then record(idOf(d.Value), d)
        end
        for k, v in pairs(d:GetAttributes()) do
            if type(v) == "string" then local id = idOf(v); if id then record(id, d, tostring(k)) end end
        end
    end)
    return ok
end
local function sweep(root, label)
    if not root then return 0 end
    local n, list = 0, {}
    pcall(function() list = root:GetDescendants() end)
    for i, d in ipairs(list) do
        scanObj(d); n = n + 1
        if i % 4000 == 0 then task.wait() end -- ไม่ให้เกมค้าง
    end
    print(("  สแกน %s: %d ชิ้น"):format(label, n))
    return n
end

print(">> เริ่มสแกนแบบละเอียด... (อาจใช้เวลา 10-30 วินาที)")
sweep(player:FindFirstChild("PlayerGui"), "PlayerGui (ทุก UI รวมที่ซ่อน)")
pcall(function() sweep(game:GetService("StarterGui"), "StarterGui") end)
sweep(RS, "ReplicatedStorage (แม่แบบ/ไอเทม/มินิแมพ)")
pcall(function() sweep(game:GetService("ReplicatedFirst"), "ReplicatedFirst") end)
-- ป้ายเหนือหัว / มาร์กเกอร์มินิแมพที่ติดกับโมเดลในแมพ (BillboardGui / SurfaceGui)
do
    local n = 0
    for i, d in ipairs(workspace:GetDescendants()) do
        if d:IsA("BillboardGui") or d:IsA("SurfaceGui") then
            local model = d:FindFirstAncestorOfClass("Model") or d.Adornee
            for _, c in ipairs(d:GetDescendants()) do
                if (c:IsA("ImageLabel") or c:IsA("ImageButton")) then
                    local ok = pcall(function() record(idOf(c.Image), c, model and model.Name or nil) end)
                    if ok then n = n + 1 end
                end
            end
        end
        if i % 4000 == 0 then task.wait() end
    end
    print(("  สแกนป้ายในแมพ (Billboard/Surface): %d รูป"):format(n))
end
-- ชื่อโมเดลที่มี Humanoid (ใช้จับคู่ชื่อบอสเพิ่ม)
for _, d in ipairs(workspace:GetDescendants()) do
    if d:IsA("Humanoid") and d.Parent and not Players:GetPlayerFromCharacter(d.Parent) then
        local b = bossIn(d.Parent.Name); if b then addBoss(b) end
    end
end

-- ===== ขอลิงก์รูป =====
local ids = {}
for id in pairs(byId) do table.insert(ids, id) end
local urlOf = {}
if req then
    print((">> ขอลิงก์รูป %d รายการ..."):format(#ids))
    for i = 1, #ids, 50 do
        local batch = {}
        for j = i, math.min(i + 49, #ids) do table.insert(batch, ids[j]) end
        local ok, res = pcall(req, { Url = "https://thumbnails.roblox.com/v1/assets?assetIds=" .. table.concat(batch, ",") .. "&returnPolicy=PlaceHolder&size=150x150&format=Png&isCircular=false", Method = "GET" })
        if ok and res and res.Body then
            local ok2, data = pcall(function() return HttpService:JSONDecode(res.Body) end)
            if ok2 and data and data.data then
                for _, e in ipairs(data.data) do
                    if e.state == "Completed" and e.imageUrl then urlOf[tostring(e.targetId)] = e.imageUrl end
                end
            end
        end
        task.wait(0.25)
    end
end

-- ===== บันทึก =====
local all, bosses, nUrl, nBoss = {}, {}, 0, 0
for id, e in pairs(byId) do
    local u = urlOf[id]
    if u then nUrl = nUrl + 1 end
    table.insert(all, { id = id, url = u, names = e.names, paths = e.paths, boss = e.boss })
    if e.boss and u then
        bosses[e.boss] = bosses[e.boss] or {}
        if #bosses[e.boss] < 6 then table.insert(bosses[e.boss], { id = id, url = u, from = e.paths[1] }) end
    end
end
for _ in pairs(bosses) do nBoss = nBoss + 1 end
-- สะสมผลจากรอบก่อน ๆ (รันหลายรอบ เปิดคนละหน้า ได้รวมกันในไฟล์เดียว)
local prevN = 0
if isfile and readfile and isfile("slayer_icon_deep.json") then
    local ok, old = pcall(function() return HttpService:JSONDecode(readfile("slayer_icon_deep.json")) end)
    if ok and type(old) == "table" and type(old.all) == "table" then
        local have = {}
        for _, e in ipairs(all) do have[e.id] = true end
        for _, e in ipairs(old.all) do
            if type(e) == "table" and e.id and not have[e.id] then table.insert(all, e); have[e.id] = true; prevN = prevN + 1 end
        end
        for name, list in pairs(type(old.bosses) == "table" and old.bosses or {}) do if not bosses[name] then bosses[name] = list end end
    end
end
local json = HttpService:JSONEncode({ version = 2, place = game.PlaceId, bossNames = bossList, bosses = bosses, all = all })
if writefile then pcall(writefile, "slayer_icon_deep.json", json) end
print(("== เสร็จ: รูปไม่ซ้ำ %d รูป (ได้ลิงก์ %d) | จับคู่กับบอสได้ %d ตัว"):format(nIds, nUrl, nBoss))
for name, list in pairs(bosses) do print("   บอส " .. name .. ": " .. #list .. " รูป") end
print((">> รวมกับรอบก่อน ๆ อีก %d รูป · ทั้งไฟล์ตอนนี้ %d รูป"):format(prevN, #all))
print(">> บันทึกเป็น slayer_icon_deep.json แล้ว (สะสมทุกรอบ) เปิดหน้าอื่นแล้วรันต่อได้ ครบแล้วค่อยส่งไฟล์ให้ผู้ดูแล")
print(">> อยากเริ่มนับใหม่: ลบไฟล์ slayer_icon_deep.json ในโฟลเดอร์ workspace ก่อน")
