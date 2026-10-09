-- Fleet: สแกนรวมครบทุกอย่างในครั้งเดียว (ใช้ได้กับทุกเกม)
--   1) ข้อมูลผู้เล่นทั้งหมด (เงิน เลเวล ของ Mastery สถิติ) 2) ตัวเลขบนหน้าจอ 3) leaderstats / อาวุธ 4) ไอคอนไอเทม + บอส
-- วิธีใช้: เข้าเกม เปิดหน้ากระเป๋า/พจนานุกรม/มินิแมพค้างไว้ยิ่งดี แล้วรัน · รันหลายรอบ (เปิดคนละหน้า) ผลจะสะสมรวมกัน
-- ผลลัพธ์: ไฟล์เดียว slayer_scan_all.json ในโฟลเดอร์ workspace ส่งไฟล์นี้ให้ผู้ดูแล
-- อ่านอย่างเดียว ไม่แตะอะไรในเกม ไม่ส่งข้อมูลไปไหน นอกจากขอลิงก์รูปจาก thumbnails.roblox.com
local SF_REPORT = {}
do
    local Players = game:GetService("Players")
    local RS = game:GetService("ReplicatedStorage")
    local player = Players.LocalPlayer
    local lines, seen = {}, {}
    local function add(s) if #lines < 4000 then table.insert(lines, s) end end
    local function val(o) local ok, x = pcall(function() return o.Value end) return ok and tostring(x) or "?" end
    add("place=" .. game.PlaceId .. "  game=" .. tostring(pcall(function() return game:GetService("MarketplaceService"):GetProductInfo(game.PlaceId).Name end) and game:GetService("MarketplaceService"):GetProductInfo(game.PlaceId).Name or "?"))
    -- โฟลเดอร์ข้อมูลผู้เล่น: ทุกที่ที่ชื่อเท่ากับชื่อผู้เล่น/UserId หรือชื่อมีคำว่า data/profile/save
    local roots = {}
    local function consider(o)
        local n = o.Name
        if (n == player.Name or n == tostring(player.UserId)) and #o:GetChildren() > 0 then table.insert(roots, o) end
    end
    for _, svc in ipairs({ RS, player, game:GetService("Workspace") }) do
        pcall(function() for _, o in ipairs(svc:GetDescendants()) do consider(o) end end)
    end
    table.insert(roots, player)
    for _, root in ipairs(roots) do
        if not seen[root] then
            seen[root] = true
            add("\n== ข้อมูล: " .. root:GetFullName() .. " ==")
            local n, perParent = 0, {}
            for _, o in ipairs(root:GetDescendants()) do
                if o:IsA("ValueBase") and n < 1500 then
                    local p = o.Parent and o.Parent:GetFullName() or ""
                    perParent[p] = (perParent[p] or 0) + 1
                    if perParent[p] <= 60 then add("  " .. o:GetFullName():sub(#root:GetFullName() + 2) .. " = " .. val(o)); n = n + 1 end
                end
                if n < 1500 then for k, a in pairs(o:GetAttributes()) do add("  @" .. o:GetFullName():sub(#root:GetFullName() + 2) .. "." .. k .. " = " .. tostring(a)); n = n + 1 end end
            end
        end
    end
    -- ฐาน/สวน/พล็อตของเราในแมพ (เกมแนว Steal a ...: เพน ไข่ที่กำลังฟัก สัตว์ ลู่วิ่ง) = ของที่มี Owner เป็นเรา
    local function mine(o)
        local ok, yes = pcall(function()
            for k, a in pairs(o:GetAttributes()) do
                local kl = k:lower()
                if (kl:find("owner") or kl:find("player") or kl == "user" or kl == "userid") and (tostring(a) == player.Name or tostring(a) == tostring(player.UserId) or tostring(a) == player.DisplayName) then return true end
            end
            for _, c in ipairs(o:GetChildren()) do
                if c:IsA("ValueBase") and (c.Name:lower():find("owner") or c.Name:lower():find("player")) then
                    local v = c.Value
                    if v == player or tostring(v) == player.Name or tostring(v) == tostring(player.UserId) then return true end
                end
            end
            return false
        end)
        return ok and yes
    end
    local bases, nb = {}, 0
    pcall(function()
        for i, o in ipairs(workspace:GetDescendants()) do
            if (o:IsA("Model") or o:IsA("Folder")) and nb < 4 and mine(o) then
                local dup = false
                for _, b in ipairs(bases) do if o:IsDescendantOf(b) then dup = true end end
                if not dup then table.insert(bases, o); nb = nb + 1 end
            end
            if i % 5000 == 0 then task.wait() end
        end
    end)
    -- ป้ายบนหัวสัตว์/ไข่ (รายได้ต่อวิ เวลาฟัก) มักเป็น BillboardGui: ดึงเฉพาะที่อยู่ในฐานเรา
    for _, base in ipairs(bases) do
        add("\n== ฐานของเรา: " .. base:GetFullName() .. " (" .. #base:GetDescendants() .. " ชิ้น) ==")
        local n, perParent = 0, {}
        for _, o in ipairs(base:GetDescendants()) do
            if n >= 1200 then break end
            local p = o.Parent and o.Parent:GetFullName() or ""
            perParent[p] = (perParent[p] or 0) + 1
            if perParent[p] <= 40 then
                local rel = o:GetFullName():sub(#base:GetFullName() + 2)
                if o:IsA("ValueBase") then add("  " .. rel .. " = " .. val(o)); n = n + 1
                elseif (o:IsA("TextLabel") or o:IsA("TextButton")) and o.Text ~= "" then add("  [ป้าย] " .. rel .. "  ->  " .. o.Text:gsub("<[^>]->", "")); n = n + 1
                elseif o:IsA("Model") and perParent[p] <= 40 then add("  [โมเดล] " .. rel); n = n + 1 end
                for k, a in pairs(o:GetAttributes()) do add("  @" .. rel .. "." .. k .. " = " .. tostring(a)); n = n + 1 end
            end
        end
    end
    if #bases == 0 then
        -- ไม่เจอ Owner: เก็บรายชื่อโฟลเดอร์ชั้นบนของแมพ + attribute ไว้ให้ดูว่าฐานอยู่ตรงไหน
        add("\n== ไม่เจอฐานที่มี Owner = เรา · โครงแมพชั้นบน ==")
        for _, o in ipairs(workspace:GetChildren()) do
            local at = {}
            for k, a in pairs(o:GetAttributes()) do table.insert(at, k .. "=" .. tostring(a)) end
            add("  " .. o.Name .. " [" .. o.ClassName .. ", " .. #o:GetChildren() .. "]" .. (#at > 0 and ("  @" .. table.concat(at, " "):sub(1, 200)) or ""))
            if #o:GetChildren() <= 30 and (o.Name:lower():find("plot") or o.Name:lower():find("base") or o.Name:lower():find("garden") or o.Name:lower():find("pen")) then
                for _, c in ipairs(o:GetChildren()) do
                    local at2 = {}
                    for k, a in pairs(c:GetAttributes()) do table.insert(at2, k .. "=" .. tostring(a)) end
                    for _, v in ipairs(c:GetChildren()) do if v:IsA("ValueBase") then table.insert(at2, v.Name .. "=" .. val(v)) end end
                    add("    " .. c.Name .. "  " .. table.concat(at2, " "):sub(1, 200))
                end
            end
        end
    end
    -- leaderstats + ของในมือ/Backpack
    add("\n== อาวุธ/ของในมือและ Backpack ==")
    pcall(function() for _, t in ipairs(player.Backpack:GetChildren()) do add("  Backpack: " .. t.Name) end end)
    pcall(function() local t = player.Character and player.Character:FindFirstChildOfClass("Tool"); if t then add("  ถืออยู่: " .. t.Name) end end)
    -- ตัวเลขบนหน้าจอ (เงิน เลเวล Mastery ฯลฯ)
    add("\n== ข้อความบนหน้าจอที่มีตัวเลข ==")
    local m = 0
    pcall(function()
        for _, o in ipairs(player.PlayerGui:GetDescendants()) do
            if (o:IsA("TextLabel") or o:IsA("TextButton")) and m < 400 then
                local t = o.Text
                if t ~= "" and t:find("%d") and #t < 60 then add("  " .. o:GetFullName():gsub("^.-PlayerGui%.", "") .. "  ->  " .. t:gsub("<[^>]->", "")); m = m + 1 end
            end
        end
    end)
    SF_REPORT = lines
    print((">> ส่วนข้อมูล: %d บรรทัด"):format(#lines))
end

-- Fleet: สแกนไอคอนแบบละเอียด (บอส / มินิแมพ / ทุก UI รวมที่ซ่อนอยู่ / แม่แบบใน ReplicatedStorage)
-- วิธีใช้: เข้าเกม ยืนใกล้บอสหรือให้บอสขึ้นในมินิแมพ แล้วรัน (เปิดพจนานุกรมค้างไว้ด้วยยิ่งดี)
-- ผลลัพธ์: slayer_scan_all.json ในโฟลเดอร์ workspace ของ executor ส่งไฟล์นี้ให้ผู้ดูแล
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
-- + จับ "ค่าที่เปลี่ยน" ระหว่างรอบ (เช่น Speed ที่ขึ้นตอนยืนลู่วิ่ง) ไว้หาว่าเกมเก็บค่าไหนตรงไหน
local function valsOf(lines)
    local m = {}
    for _, l in ipairs(lines) do
        if type(l) == "string" then
            local k, v = l:match("^%s+(.-) = (.*)$")
            if not k then k, v = l:match("^%s+(.-)  %->  (.*)$") end
            if k and #k < 220 then m[k] = v end
        end
    end
    return m
end
local curVals, vals, changes, runs, lastAt, newCh = valsOf(SF_REPORT), {}, {}, 1, nil, {}
local prevN = 0
if isfile and readfile and isfile("slayer_scan_all.json") then
    local ok, old = pcall(function() return HttpService:JSONDecode(readfile("slayer_scan_all.json")) end)
    if ok and type(old) == "table" and type(old.all) == "table" then
        local have = {}
        for _, e in ipairs(all) do have[e.id] = true end
        for _, e in ipairs(old.all) do
            if type(e) == "table" and e.id and not have[e.id] then table.insert(all, e); have[e.id] = true; prevN = prevN + 1 end
        end
        for name, list in pairs(type(old.bosses) == "table" and old.bosses or {}) do if not bosses[name] then bosses[name] = list end end
        if type(old.vals) == "table" then
            for k, v in pairs(old.vals) do vals[k] = v end
            for k, v in pairs(curVals) do
                if old.vals[k] ~= nil and old.vals[k] ~= v then table.insert(newCh, { k = k, from = old.vals[k], to = v, run = (tonumber(old.runs) or 0) + 1 }) end
            end
        end
        if type(old.changes) == "table" then for _, c in ipairs(old.changes) do if #changes < 3000 then table.insert(changes, c) end end end
        runs = (tonumber(old.runs) or 0) + 1
        lastAt = tonumber(old.at)
        if type(old.report) == "table" then -- รวมข้อมูลจากรอบก่อน (ไม่ซ้ำ)
            local have = {}
            for _, l in ipairs(SF_REPORT) do have[l] = true end
            for _, l in ipairs(old.report) do if type(l) == "string" and not have[l] and #SF_REPORT < 8000 then table.insert(SF_REPORT, l); have[l] = true end end
        end
    end
end
for k, v in pairs(curVals) do vals[k] = v end
for _, c in ipairs(newCh) do if #changes < 3000 then table.insert(changes, c) end end
local json = HttpService:JSONEncode({ version = 4, place = game.PlaceId, runs = runs, at = os.time(), report = SF_REPORT, vals = vals, changes = changes, bossNames = bossList, bosses = bosses, all = all })
if writefile then pcall(writefile, "slayer_scan_all.json", json) end
print(("== เสร็จ: รูปไม่ซ้ำ %d รูป (ได้ลิงก์ %d) | จับคู่กับบอสได้ %d ตัว"):format(nIds, nUrl, nBoss))
for name, list in pairs(bosses) do print("   บอส " .. name .. ": " .. #list .. " รูป") end
print((">> รวมกับรอบก่อน ๆ อีก %d รูป · ทั้งไฟล์ตอนนี้ %d รูป"):format(prevN, #all))
print(">> บันทึกเป็น slayer_scan_all.json แล้ว (สะสมทุกรอบ) เปิดหน้าอื่นแล้วรันต่อได้ ครบแล้วค่อยส่งไฟล์ให้ผู้ดูแล")
print(("== รอบที่ %d%s · ค่าที่เปลี่ยนจากรอบก่อน %d ค่า (สะสมทั้งหมด %d)"):format(runs, lastAt and (" (ห่างจากรอบก่อน " .. (os.time() - lastAt) .. " วิ)") or "", #newCh, #changes))
for i, c in ipairs(newCh) do
    if i > 15 then print("   ... และอีก " .. (#newCh - 15) .. " ค่า (อยู่ในไฟล์)") break end
    print("   " .. c.k .. ":  " .. tostring(c.from) .. "  →  " .. tostring(c.to))
end
print(">> อยากเริ่มนับใหม่: ลบไฟล์ slayer_scan_all.json ในโฟลเดอร์ workspace ก่อน")
