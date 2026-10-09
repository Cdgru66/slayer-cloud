-- Fleet: สแกนเจาะจงเกม Steal An Egg (หา Speed / เงิน / ไข่ในเพน / สัตว์ / ลู่วิ่ง)
-- วิธีใช้: ยืนบนลู่วิ่ง → รัน → รอ 1 นาที → รันอีกรอบ (ผลสะสม + บอกค่าที่เปลี่ยน) แล้วส่ง fleet_egg_scan.txt
-- อ่านอย่างเดียว ไม่แตะอะไรในเกม ไม่ส่งข้อมูลไปไหน
print(">> Fleet scan_egg เริ่มทำงาน...")
local Players = game:GetService("Players")
local RS = game:GetService("ReplicatedStorage")
local HttpService = game:GetService("HttpService")
local player = Players.LocalPlayer
local uid = tostring(player.UserId)
local L = {}
local function add(s) if #L < 3000 then table.insert(L, s) end end
local function val(o) local ok, x = pcall(function() return o.Value end) return ok and tostring(x) or "?" end
local function attrs(o, prefix, cap)
    local n = 0
    local ok = pcall(function()
        for k, a in pairs(o:GetAttributes()) do
            n = n + 1
            if n <= (cap or 60) then add("  @" .. prefix .. "." .. k .. " = " .. tostring(a)) end
        end
    end)
    return n
end
local function step(name, fn)
    local ok, err = pcall(fn)
    if not ok then add("!! " .. name .. ": " .. tostring(err)); print("!! " .. name .. ": " .. tostring(err)) end
end
add("place=" .. game.PlaceId .. " user=" .. player.Name .. " uid=" .. uid .. " time=" .. os.time())

-- A) ค่าที่ติดกับตัวผู้เล่นโดยตรง (ส่วนใหญ่เกมพวกนี้เก็บ Speed/Cash เป็น attribute ของ Player)
step("player", function()
    add("\n== A. ตัวผู้เล่น (attribute + ของข้างใน ยกเว้น PlayerGui) ==")
    attrs(player, "Player", 200)
    for _, c in ipairs(player:GetChildren()) do
        if c.Name ~= "PlayerGui" and c.Name ~= "Backpack" and c.Name ~= "PlayerScripts" then
            add("  [" .. c.ClassName .. "] " .. c.Name .. (c:IsA("ValueBase") and (" = " .. val(c)) or ""))
            attrs(c, c.Name, 60)
            for _, d in ipairs(c:GetDescendants()) do
                if d:IsA("ValueBase") then add("  " .. d:GetFullName():sub(#player:GetFullName() + 2) .. " = " .. val(d)) end
            end
        end
    end
    local ch = player.Character
    if ch then
        attrs(ch, "Character", 80)
        local hum = ch:FindFirstChildOfClass("Humanoid")
        if hum then add("  Humanoid.WalkSpeed = " .. hum.WalkSpeed); add("  Humanoid.FloorMaterial = " .. tostring(hum.FloorMaterial)); attrs(hum, "Humanoid", 40) end
        local hrp = ch:FindFirstChild("HumanoidRootPart")
        if hrp then
            add("  ตำแหน่ง = " .. tostring(hrp.Position))
            attrs(hrp, "HRP", 40)
            -- ยืนอยู่บนอะไร (ลู่วิ่ง?)
            local rp = RaycastParams.new(); rp.FilterDescendantsInstances = { ch }; rp.FilterType = Enum.RaycastFilterType.Exclude
            local hit = workspace:Raycast(hrp.Position, Vector3.new(0, -12, 0), rp)
            if hit and hit.Instance then
                add("  ยืนบน = " .. hit.Instance:GetFullName())
                local p = hit.Instance
                for _ = 1, 4 do if p and p ~= workspace then attrs(p, "ยืนบน." .. p.Name, 20); p = p.Parent end end
            end
        end
    end
end)

-- B) ตัวเลขบนหน้าจอ (ตัดหน้าที่รก ๆ ออก) → หา Speed / Cash / รายได้
local SKIP = { ContentCreatorsAdminPanel = 1, BossMastery = 1, BossShop = 1, BackpackGui = 1, ActivePets = 1, AutoSell = 1, TopbarStandard = 1, TopbarCentered = 1, TopbarStandardClipped = 1 }
step("hud", function()
    add("\n== B. ตัวเลขบนหน้าจอ (HUD) ==")
    local n = 0
    for _, gui in ipairs(player.PlayerGui:GetChildren()) do
        if not SKIP[gui.Name] then
            for _, o in ipairs(gui:GetDescendants()) do
                if n >= 600 then break end
                if (o:IsA("TextLabel") or o:IsA("TextButton") or o:IsA("TextBox")) then
                    local t = tostring(o.Text or ""):gsub("<[^>]->", "")
                    if t ~= "" and #t < 80 and (t:find("%d") or t:lower():find("speed") or t:find("%$")) then
                        local vis = true
                        pcall(function() local p = o; while p and p ~= gui do if p:IsA("GuiObject") and not p.Visible then vis = false break end p = p.Parent end end)
                        add("  " .. (vis and "" or "(ซ่อน) ") .. o:GetFullName():gsub("^.-PlayerGui%.", "") .. "  ->  " .. t); n = n + 1
                    end
                end
            end
        end
    end
    -- กระดานผู้นำในแมพ (SurfaceGui ที่มี Key = Money/Speed): แถวของเรา
    for _, o in ipairs(player.PlayerGui:GetDescendants()) do
        if o:IsA("ScrollingFrame") and o:GetAttribute("Key") then
            local row = o:FindFirstChild("Player_" .. uid)
            add("  [กระดาน " .. tostring(o:GetAttribute("Key")) .. "] " .. o:GetFullName():gsub("^.-PlayerGui%.", "") .. (row and "" or " (ไม่มีแถวเรา)"))
            if row then
                for _, d in ipairs(row:GetDescendants()) do
                    if d:IsA("TextLabel") then add("    text " .. d.Name .. " -> " .. d.Text) end
                    attrs(d, "    แถวเรา." .. d.Name, 10)
                end
            end
        end
    end
end)

-- C) กระเป๋า: สัตว์/ไข่ เป็น Tool → ดู attribute (น้ำหนัก Mutation รายได้ ความหายาก)
step("backpack", function()
    add("\n== C. กระเป๋า (Tool + attribute) ==")
    local list = player.Backpack:GetChildren()
    local ch = player.Character and player.Character:FindFirstChildOfClass("Tool")
    if ch then table.insert(list, 1, ch) end
    add("  ทั้งหมด " .. #list .. " ชิ้น")
    for i, t in ipairs(list) do
        if i > 25 then break end
        add("  [" .. i .. "] " .. t.Name .. "  (" .. t.ClassName .. ")")
        attrs(t, "    " .. i, 40)
        for _, d in ipairs(t:GetChildren()) do if d:IsA("ValueBase") then add("    " .. d.Name .. " = " .. val(d)) end end
    end
end)

-- D) สัตว์ที่วางในฐาน (Workspace.ClientRenderedAssets.<uid>_<id>) + ไข่
step("assets", function()
    add("\n== D. ของในฐาน (ClientRenderedAssets) ==")
    local cra = workspace:FindFirstChild("ClientRenderedAssets")
    if not cra then add("  ไม่มี ClientRenderedAssets"); return end
    local mineN, others = 0, {}
    for _, m in ipairs(cra:GetChildren()) do
        local owner = m.Name:match("^(%d+)_")
        if owner == uid then
            mineN = mineN + 1
            if mineN <= 40 then
                local parts = {}
                for _, d in ipairs(m:GetDescendants()) do
                    if d:IsA("TextLabel") and d.Text ~= "" then table.insert(parts, d.Name .. "=" .. d.Text:gsub("<[^>]->", "")) end
                end
                add("  " .. m.Name .. "  " .. table.concat(parts, " | "))
                attrs(m, "    " .. m.Name:sub(-6), 30)
            end
        else others[owner or "?"] = (others[owner or "?"] or 0) + 1 end
    end
    add("  ของเรา " .. mineN .. " ชิ้น")
    for o, c in pairs(others) do add("  ของคนอื่น " .. o .. ": " .. c .. " ชิ้น") end
end)

-- E) ฐาน/เพน/ลู่วิ่ง ของเรา: อะไรก็ได้ในแมพที่มี attribute/ค่า = uid หรือชื่อเรา
step("plot", function()
    add("\n== E. ของในแมพที่ผูกกับเรา ==")
    local n, cra = 0, workspace:FindFirstChild("ClientRenderedAssets")
    for i, o in ipairs(workspace:GetDescendants()) do
        if i % 5000 == 0 then task.wait() end
        if n >= 60 then break end
        if not (cra and o:IsDescendantOf(cra)) then
            local ok = pcall(function()
                for k, a in pairs(o:GetAttributes()) do
                    local s = tostring(a)
                    if s == uid or s == player.Name then
                        n = n + 1
                        add("  " .. o:GetFullName() .. "  [" .. o.ClassName .. ", " .. #o:GetChildren() .. " ชิ้น]  @" .. k .. "=" .. s)
                        attrs(o, "    ", 30)
                        break
                    end
                end
                if o:IsA("ObjectValue") and o.Value == player then n = n + 1; add("  " .. o:GetFullName() .. " (ObjectValue → เรา)") end
                if (o:IsA("StringValue") or o:IsA("IntValue") or o:IsA("NumberValue")) and (tostring(o.Value) == uid or tostring(o.Value) == player.Name) then n = n + 1; add("  " .. o:GetFullName() .. " = " .. tostring(o.Value)) end
            end)
        end
    end
    add("  โครงแมพชั้นบน:")
    for _, o in ipairs(workspace:GetChildren()) do add("    " .. o.Name .. " [" .. o.ClassName .. ", " .. #o:GetChildren() .. "]") end
end)

-- F) ป้ายในแมพที่เกี่ยวกับการฟัก/เวลา (ไข่ในเพน)
step("eggs", function()
    add("\n== F. ป้ายเวลา/ไข่ในแมพ ==")
    local n = 0
    for i, o in ipairs(workspace:GetDescendants()) do
        if i % 5000 == 0 then task.wait() end
        if n >= 120 then break end
        if o:IsA("TextLabel") then
            local t = o.Text:gsub("<[^>]->", "")
            local tl = t:lower()
            if t ~= "" and #t < 60 and (tl:find("hatch") or tl:find("ready") or tl:find("egg") or t:match("%d+[hms]%s*%d*[ms]?$") or t:match("^%d+:%d%d")) then
                add("  " .. o:GetFullName():gsub("^Workspace%.", "") .. "  ->  " .. t); n = n + 1
            end
        end
    end
    -- ป้ายตอนเอาเมาส์ชี้ไข่ (เวลาฟักที่เหลือ)
    pcall(function()
        for _, d in ipairs(player.PlayerGui.AssetEggData:GetDescendants()) do if d:IsA("TextLabel") then add("  [ชี้ไข่] " .. d.Name .. " -> " .. d.Text) end end
    end)
end)

-- G) ReplicatedStorage ชั้นบน (หาโมดูลข้อมูลผู้เล่น)
step("rs", function()
    add("\n== G. ReplicatedStorage ชั้นบน ==")
    for _, o in ipairs(RS:GetChildren()) do
        add("  " .. o.Name .. " [" .. o.ClassName .. ", " .. #o:GetChildren() .. "]")
        local f = o:FindFirstChild(player.Name) or o:FindFirstChild(uid)
        if f then add("    ★ มีโฟลเดอร์ของเรา: " .. f:GetFullName()) end
    end
    local hits = 0
    for _, o in ipairs(RS:GetDescendants()) do
        if hits >= 20 then break end
        if (o.Name == player.Name or o.Name == uid) then hits = hits + 1; add("  ★ " .. o:GetFullName() .. " [" .. o.ClassName .. ", " .. #o:GetDescendants() .. "]")
            for _, d in ipairs(o:GetDescendants()) do if d:IsA("ValueBase") then add("    " .. d:GetFullName():sub(#o:GetFullName() + 2) .. " = " .. val(d)) end end
            attrs(o, "    ★", 100)
        end
    end
end)

-- ===== บันทึก: txt (รอบนี้) + json (สะสม + ค่าที่เปลี่ยน) =====
local function valsOf(lines)
    local m = {}
    for _, l in ipairs(lines) do
        local k, v = l:match("^%s+(.-) = (.*)$")
        if not k then k, v = l:match("^%s+(.-)%s+%->%s+(.*)$") end
        if k and #k < 220 then m[k] = v end
    end
    return m
end
local cur, vals, changes, runs, lastAt, newCh = valsOf(L), {}, {}, 1, nil, {}
if isfile and readfile and isfile("fleet_egg_scan.json") then
    local ok, old = pcall(function() return HttpService:JSONDecode(readfile("fleet_egg_scan.json")) end)
    if ok and type(old) == "table" then
        runs = (tonumber(old.runs) or 0) + 1; lastAt = tonumber(old.at)
        if type(old.vals) == "table" then
            for k, v in pairs(old.vals) do vals[k] = v end
            for k, v in pairs(cur) do if old.vals[k] ~= nil and old.vals[k] ~= v then table.insert(newCh, { k = k, from = old.vals[k], to = v, run = runs }) end end
        end
        if type(old.changes) == "table" then for _, c in ipairs(old.changes) do if #changes < 3000 then table.insert(changes, c) end end end
    end
end
for k, v in pairs(cur) do vals[k] = v end
for _, c in ipairs(newCh) do if #changes < 3000 then table.insert(changes, c) end end
local head = { "", ("== รอบที่ %d%s · ค่าที่เปลี่ยนจากรอบก่อน %d ค่า =="):format(runs, lastAt and (" (ห่างรอบก่อน " .. (os.time() - lastAt) .. " วิ)") or "", #newCh) }
for i, c in ipairs(newCh) do if i <= 200 then table.insert(head, "  " .. c.k .. ":  " .. tostring(c.from) .. "  →  " .. tostring(c.to)) end end
for _, l in ipairs(head) do table.insert(L, l) end
if writefile then
    local okW, e = pcall(writefile, "fleet_egg_scan.txt", table.concat(L, "\n"))
    print(okW and ">> บันทึก fleet_egg_scan.txt แล้ว" or ("!! บันทึก txt ไม่ได้: " .. tostring(e)))
    local okJ, js = pcall(HttpService.JSONEncode, HttpService, { runs = runs, at = os.time(), vals = vals, changes = changes })
    if okJ then pcall(writefile, "fleet_egg_scan.json", js) end
end
print(head[2])
for i = 3, math.min(#head, 17) do print(head[i]) end
print(">> เสร็จ · รอ 1 นาทีแล้วรันอีกรอบ จากนั้นส่งไฟล์ fleet_egg_scan.txt (ตัวล่าสุดมีสรุปค่าที่เปลี่ยนอยู่ท้ายไฟล์)")
