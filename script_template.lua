-- ===== ตั้งค่า =====
local WEBHOOK_URL = "ใส่ลิงก์ webhook ตรงนี้"
local INTERVAL = 300            -- ส่งทุกกี่วินาที
local SHOW_ALL_ITEMS = false    -- true = ส่งของทุกชิ้น (เรียงตามจำนวน), false = เฉพาะ WATCH_ITEMS
local MAX_ITEMS = 18            -- จำกัดจำนวนของต่อรอบ (เฉพาะ Discord)
local WEB_ALL_ITEMS = true      -- true = ส่งของทุกชิ้นในกระเป๋าขึ้นเว็บ (Discord ยังใช้ตามด้านบน)
local ICON_STYLE = "author"     -- "author" = ไอคอนเล็กหน้าชื่อ, "thumbnail" = ไอคอนใหญ่ด้านขวา
local LIVE_EDIT = true       -- true = แก้ข้อความเดิมในห้อง (ไม่ส่งใหม่ทุกรอบ ห้องไม่รก)
local USE_ANSI = true        -- true = แถบสี/ตัวอักษรสีในกล่องโค้ด (ถ้าเห็นเป็นตัวอักษรแปลก ๆ ให้ปิด)
local LIVE_INTERVAL = 20        -- ส่งข้อมูลสด (บอสที่กำลังสู้ / Wen / แร่) ทุกกี่วินาที ให้เว็บดูเรียลไทม์ (0 = ปิด)
local AUTO_REJOIN = true        -- true = หลุด/โดนเตะ (หน้าต่างเกมยังอยู่) แล้วพากลับเข้าเกมเอง
local DEBUG_ICONS = false       -- true = พิมพ์รายการรูปที่เจอใน UI ลง console + คลิปบอร์ด (ไว้ส่งให้ผมแก้)
local AUTO_UPDATE = true        -- true = เซิร์ฟเวอร์มีสคริปต์ใหม่ โหลดตัวใหม่เองระหว่างรัน (ไม่ต้องรันตัวโหลดซ้ำ)
local SCRIPT_VER = "dev"        -- เซิร์ฟเวอร์ใส่ให้เองตอนโหลดผ่าน /script.lua (ห้ามแก้)

-- สำหรับต่อกับเว็บของคุณ (ไม่บังคับ)
local EXPORT_JSON = true        -- เซฟ slayer_export.json ไว้ในโฟลเดอร์ workspace ของ executor
local WEB_API_URL = ""          -- ลิงก์เซิร์ฟเวอร์ของคุณที่รับ POST JSON (ปล่อยว่างถ้าไม่ใช้)
local WEB_API_KEY = ""          -- ถ้าเว็บต้องใช้ key จะส่งเป็น Authorization: Bearer
if WEB_API_KEY == "" and getgenv and getgenv().SLAYER_KEY then WEB_API_KEY = getgenv().SLAYER_KEY end -- ใช้กับตัวโหลดอัตโนมัติ

-- ของที่อยากเช็คจำนวน (ชื่อต้องตรงกับในเกมเป๊ะ ๆ)
local WATCH_ITEMS = {
    "Ore", "Refinement Ore", "Metal Scraps", "Silk Thread",
    "Firstlight Forged Ingot", "Beast Core", "Demon Horns",
    "Health Potion", "Demonic Lantern", "Healing Gem Necklace",
    "Coin", "Coin Stack", "Coin Pile", "Coin Pouch",
}

-- ===== ส่วนหลัก =====
if not game:IsLoaded() then game.Loaded:Wait() end
-- กันรันซ้ำ (เช่น auto-execute กับ queue_on_teleport ทำงานพร้อมกัน)
-- MY_RUN: เลขรอบของสคริปต์ตัวนี้ ถ้ามีตัวใหม่โหลดทับ (อัปเดตอัตโนมัติ) ลูปของตัวเก่าจะหยุดเอง
local MY_RUN = 0
if getgenv then
    if getgenv().SLAYER_FLEET_RUNNING and not getgenv().FLEET_RELOADING then return end
    getgenv().FLEET_RELOADING = nil
    getgenv().SLAYER_FLEET_RUNNING = true
    getgenv().FLEET_RUN = (getgenv().FLEET_RUN or 0) + 1
    MY_RUN = getgenv().FLEET_RUN
end
local function alive() return not getgenv or getgenv().FLEET_RUN == MY_RUN end

local Players = game:GetService("Players")
local RS = game:GetService("ReplicatedStorage")
local HttpService = game:GetService("HttpService")
local player = Players.LocalPlayer

local req = (syn and syn.request) or (http and http.request) or http_request or request
    or (fluxus and fluxus.request)

local MAIN_COLOR = 0x57F287
local ITEM_COLOR = 0x2B2D31
local CACHE_FILE = "slayer_icon_cache.json"

local function fmt(n)
    n = tonumber(n)
    if not n then return "?" end
    local s = tostring(math.floor(math.abs(n) + 0.5))
    local out = s:reverse():gsub("(%d%d%d)", "%1,"):reverse()
    out = out:gsub("^,", "")
    return (n < 0 and "-" or "") .. out
end

local function find(root, name)
    if not root then return nil end
    return root:FindFirstChild(name, true)
end

local function val(root, name, default)
    local o = find(root, name)
    if o and o:IsA("ValueBase") then return o.Value end
    return default
end

local function httpGetJson(url)
    if not req then return nil end
    local ok, res = pcall(req, { Url = url, Method = "GET" })
    if not ok or not res or not res.Body then return nil end
    local ok2, data = pcall(function() return HttpService:JSONDecode(res.Body) end)
    if ok2 then return data end
    return nil
end

-- ===== เข้าถึงข้อมูลผู้เล่น =====
local function getData()
    local ps = RS:FindFirstChild("Player_Service")
    local d = ps and ps:FindFirstChild("Data")
    return d and d:FindFirstChild(player.Name)
end

local function getSlot(data)
    local slots = data and data:FindFirstChild("slots")
    if not slots then return nil end
    local idxObj = data:FindFirstChild("slotEquipped")
    local idx = idxObj and idxObj.Value or 1
    return slots:FindFirstChild("Slot" .. tostring(idx)) or slots:FindFirstChildOfClass("Folder")
end

local function getStamina()
    local ps = RS:FindFirstChild("Player_Service")
    local vals = ps and ps:FindFirstChild("Values")
    local mine = vals and vals:FindFirstChild(player.Name)
    local st = mine and mine:FindFirstChild("Stamina")
    return st and st.Value
end

-- ===== อ่านจำนวนของ =====
local function parseAmount(text)
    local t = tostring(text):gsub("[,%s]", "")
    local n = t:match("^[xX](%d+)$")
    return n and tonumber(n) or nil
end

local function getHolder()
    local pg = player:FindFirstChild("PlayerGui")
    local main = pg and pg:FindFirstChild("CharactersMain", true)
    return main and main:FindFirstChild("ActualHolder", true)
end

local function itemsFromUI()
    local res, found = {}, false
    local holder = getHolder()
    if holder then
        found = true
        for _, slot in ipairs(holder:GetChildren()) do
            local f = slot:FindFirstChild("Frame")
            local lbl = f and f:FindFirstChild("TextLabel")
            if lbl and lbl:IsA("TextLabel") then
                local n = parseAmount(lbl.Text)
                if n then res[slot.Name] = n end
            end
        end
    end
    return res, found
end

local AMOUNT_KEYS = { "Amount", "Count", "Quantity", "Stack", "amount", "count", "quantity" }
local function itemsFromData(slot)
    local res = {}
    local inv = slot and slot:FindFirstChild("Inventory")
    inv = inv and inv:FindFirstChild("Inventory")
    if not inv then return res end

    for _, it in ipairs(inv:GetChildren()) do
        local amount = nil
        for _, key in ipairs(AMOUNT_KEYS) do
            local attr = it:GetAttribute(key)
            if type(attr) == "number" then
                amount = attr
                break
            end
            local child = it:FindFirstChild(key)
            if child and child:IsA("ValueBase") and type(child.Value) == "number" then
                amount = child.Value
                break
            end
        end
        res[it.Name] = (res[it.Name] or 0) + (amount or 1)
    end
    return res
end

local function getItems(slot)
    local ui, uiFound = itemsFromUI()
    local data = itemsFromData(slot)
    local merged = {}
    for name, n in pairs(data) do merged[name] = n end
    for name, n in pairs(ui) do merged[name] = n end -- ค่าจาก UI แม่นกว่า ใช้ทับ
    return merged, uiFound
end

-- ===== ไอคอน =====
-- itemIconId: ชื่อของ -> asset id | idUrl: asset id -> ลิงก์รูป (ที่ Discord/เว็บเปิดได้)
local itemIconId, idUrl = {}, {}
local avatarUrl = nil
local debugLog = {}

local function loadCache()
    if isfile and readfile and isfile(CACHE_FILE) then
        local ok, data = pcall(function() return HttpService:JSONDecode(readfile(CACHE_FILE)) end)
        if ok and type(data) == "table" then
            itemIconId = data.items or {}
            idUrl = data.urls or {}
        end
    end
end

local function saveCache()
    if writefile then
        pcall(function()
            writefile(CACHE_FILE, HttpService:JSONEncode({ items = itemIconId, urls = idUrl }))
        end)
    end
end

local function parseAssetId(img)
    if type(img) ~= "string" or img == "" then return nil end
    return img:match("rbxassetid://(%d+)") or img:match("[%?&]id=(%d+)")
end

local SKIP_NAMES = { "gradient", "shadow", "glow", "select", "eqfg", "stroke", "border", "bg", "background" }
local PREFER_NAMES = { "icon", "image", "img", "fg", "item" }

local function nameHas(name, list)
    name = name:lower()
    for _, k in ipairs(list) do
        if name:find(k, 1, true) then return true end
    end
    return false
end

-- หารูปไอคอนในช่องของ (เลือกรูปที่น่าจะเป็นไอคอนที่สุด)
local function findIcon(root)
    local list = root:GetDescendants()
    table.insert(list, 1, root)
    local bestId, bestScore = nil, -math.huge
    local cands = {}
    for _, d in ipairs(list) do
        if d:IsA("ImageLabel") or d:IsA("ImageButton") then
            local id = parseAssetId(d.Image)
            local sheet = d.ImageRectSize.X > 0 and d.ImageRectSize.Y > 0
            table.insert(cands, "    " .. (d.Parent and d.Parent.Name or "?") .. "." .. d.Name .. " | " .. d.Image .. " | "
                .. math.floor(d.AbsoluteSize.X) .. "x" .. math.floor(d.AbsoluteSize.Y)
                .. (sheet and " | SPRITESHEET" or ""))
            if id and not sheet and not nameHas(d.Name, SKIP_NAMES) then
                local score = d.AbsoluteSize.X * d.AbsoluteSize.Y
                if nameHas(d.Name, PREFER_NAMES) then score = score + 1e6 end
                if score > bestScore then
                    bestId, bestScore = id, score
                end
            end
        elseif d:IsA("ViewportFrame") then
            table.insert(cands, "    ViewportFrame: " .. d.Name .. " (เป็นโมเดล 3D ไม่มีรูปให้ดึง)")
        end
    end
    return bestId, cands
end

local function fetchThumbs(ids)
    local result = {}
    for i = 1, #ids, 50 do
        local batch = {}
        for j = i, math.min(i + 49, #ids) do table.insert(batch, ids[j]) end
        local data = httpGetJson(
            "https://thumbnails.roblox.com/v1/assets?assetIds=" .. table.concat(batch, ",")
            .. "&returnPolicy=PlaceHolder&size=150x150&format=Png&isCircular=false"
        )
        if data and data.data then
            for _, e in ipairs(data.data) do
                if e.state == "Completed" and e.imageUrl and e.imageUrl ~= "" then
                    result[tostring(e.targetId)] = e.imageUrl
                end
            end
        end
    end
    return result
end

local function getAvatar()
    if avatarUrl then return avatarUrl end
    local data = httpGetJson(
        "https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=" .. player.UserId
        .. "&size=150x150&format=Png&isCircular=true"
    )
    local e = data and data.data and data.data[1]
    if e and e.state == "Completed" and e.imageUrl then
        avatarUrl = e.imageUrl
    end
    return avatarUrl
end

local function refreshIcons(names)
    -- รวมไอคอนที่สคริปต์สแกนไอคอนเพิ่งบันทึกไว้ในไฟล์ (ไม่ต้องรีเกม)
    if isfile and readfile and isfile(CACHE_FILE) then
        local ok, d = pcall(function() return HttpService:JSONDecode(readfile(CACHE_FILE)) end)
        if ok and type(d) == "table" then
            for k, v in pairs(d.items or {}) do itemIconId[k] = v end -- ไฟล์ล่าสุดชนะ (ตัวสแกนอาจแก้รูปผิด)
            for k, v in pairs(d.urls or {}) do idUrl[k] = v end
            for _, k in ipairs(d.drop or {}) do if not (d.items or {})[k] then itemIconId[k] = nil end end
        end
    end
    -- 1) หา asset id ของไอคอนจากหน้า Inventory (ครั้งเดียวต่อชิ้น แล้วจำไว้)
    local holder = getHolder()
    if holder then
        for _, name in ipairs(names) do
            if DEBUG_ICONS or not itemIconId[name] then
                local slot = holder:FindFirstChild(name)
                if slot then
                    local id, cands = findIcon(slot)
                    if id then itemIconId[name] = id end
                    if DEBUG_ICONS then
                        table.insert(debugLog, "== " .. name .. " -> เลือก: " .. tostring(id))
                        for _, c in ipairs(cands) do table.insert(debugLog, c) end
                    end
                elseif DEBUG_ICONS then
                    table.insert(debugLog, "== " .. name .. " -> ไม่เจอช่องใน UI")
                end
            end
        end
    end

    -- 2) แปลง asset id เป็นลิงก์รูปที่เปิดได้จริง
    local need, seen = {}, {}
    for _, name in ipairs(names) do
        local id = itemIconId[name]
        if id and not idUrl[id] and not seen[id] then
            seen[id] = true
            table.insert(need, id)
        end
    end
    if #need > 0 then
        for id, url in pairs(fetchThumbs(need)) do idUrl[id] = url end
    end
    saveCache()
end

-- ===== บอสที่กำลังสู้ (เดาจากบอสที่อยู่ใกล้ตัวละครที่สุด) =====
local BOSS_FALLBACK = { "Zuko", "MotherBear", "Kaiden", "Hoyuzo", "Reaper", "Gyutai", "Datai", "Shinora", "Akazo",
    "Enru", "Nezura", "Rengu", "Obari", "Zentaro", "Yahari", "Tengai", "Domae", "Gyorei", "Sumari", "Giyen", "Muzan" }
local bossList = nil
local function getBossNames()
    if bossList then return bossList end
    local seen, list = {}, {}
    local function addName(n)
        n = n:gsub("^%s+", ""):gsub("%s+$", "")
        if n ~= "" and not n:find("%.%.%.") and not seen[n:lower()] then seen[n:lower()] = true; table.insert(list, n) end
    end
    local d = getData()
    local sv = d and d:FindFirstChild("Bosses", true)
    if sv and sv:IsA("StringValue") then for n in sv.Value:gmatch("[^,]+") do addName(n) end end
    for _, n in ipairs(BOSS_FALLBACK) do addName(n) end
    bossList = list
    return list
end

local function nearestBoss()
    local ch = player.Character
    local me = ch and ch:FindFirstChild("HumanoidRootPart")
    if not me then return nil end
    local names = getBossNames()
    local best, bestDist = nil, 200 -- ไกลเกิน 200 studs ถือว่าไม่ได้สู้อยู่
    for _, hum in ipairs(workspace:GetDescendants()) do
        if hum:IsA("Humanoid") and hum.Health > 0 then
            local model = hum.Parent
            if model and model ~= ch and not Players:GetPlayerFromCharacter(model) then
                local part = model:FindFirstChild("HumanoidRootPart") or model.PrimaryPart
                if part then
                    local dist = (part.Position - me.Position).Magnitude
                    if dist < bestDist then
                        local lname = model.Name:lower()
                        for _, n in ipairs(names) do
                            if lname:find(n:lower(), 1, true) then
                                best = { name = n, hp = math.floor(hum.Health / math.max(hum.MaxHealth, 1) * 100 + 0.5), dist = math.floor(dist) }
                                bestDist = dist
                                break
                            end
                        end
                    end
                end
            end
        end
    end
    return best
end

-- เลเวล Mastery จากแถบด้านล่างจอ (ถ้าแสดงอยู่) เช่น "Lv 79" · ถ้าไม่มี เว็บคำนวณจาก Goal / 30
local function masteryLvFromUI(name)
    local ok, lv = pcall(function()
        local pg = player:FindFirstChild("PlayerGui")
        local mh = pg and pg:FindFirstChild("MasteryHolder", true)
        local box = mh and mh:FindFirstChild(name, true)
        local cv = box and box:FindFirstChild("CurrentValue", true)
        return cv and tonumber(tostring(cv.Text):match("(%d+)"))
    end)
    return ok and lv or nil
end

-- ตอนนี้ถืออะไรอยู่ + แถบ Mastery ที่กำลังขึ้นบนจอ (บอกว่ากำลังฟาร์ม Mastery ไหนจริง ๆ)
local function nowUsing()
    local holding, active = nil, {}
    pcall(function()
        local ch = player.Character
        local tool = ch and ch:FindFirstChildOfClass("Tool")
        if tool then holding = tool.Name end
    end)
    pcall(function()
        local pg = player:FindFirstChild("PlayerGui")
        local mh = pg and pg:FindFirstChild("MasteryHolder", true)
        local act = mh and mh:FindFirstChild("Actual")
        for _, c in ipairs(act and act:GetChildren() or {}) do
            if c:IsA("GuiObject") and c.Visible then table.insert(active, c.Name) end
        end
    end)
    return holding, active
end

-- ===== รวบรวมข้อมูลทั้งหมดเป็น snapshot (ใช้ได้ทั้ง Discord และเว็บ) =====
local prevItems = {}
local itemCat = nil

-- เควส: Quests.Holder.<ชื่อ>.Tasks.<งาน>.{Value,Max} + QuestString "Ill put out the blaze(Lv 115)" · Completed.<QuestString>.At
local function questsOf(slot, prog)
    local qf = slot and slot:FindFirstChild("Quests")
    if not qf then return nil end
    local out = { active = {}, done = {}, total = val(prog, "quests"), crow = val(prog, "crow_quests") }
    local holder = qf:FindFirstChild("Holder")
    for _, q in ipairs(holder and holder:GetChildren() or {}) do
        if #out.active >= 6 then break end
        local qs = tostring(val(q, "QuestString") or "")
        local e = { name = q.Name, lv = tonumber(qs:match("%(Lv%s*(%d+)%)")), tasks = {} }
        local tf = q:FindFirstChild("Tasks")
        for _, t in ipairs(tf and tf:GetChildren() or {}) do
            if #e.tasks >= 6 then break end
            table.insert(e.tasks, { name = t.Name, v = tonumber(val(t, "Value")) or 0, max = tonumber(val(t, "Max")) or 0 })
        end
        table.insert(out.active, e)
    end
    local comp = qf:FindFirstChild("Completed")
    for _, q in ipairs(comp and comp:GetChildren() or {}) do
        local nm = q.Name:gsub("%(Lv%s*%d+%)", ""):gsub("^Ill ", "I'll "):gsub("%s+$", "")
        table.insert(out.done, { name = nm, lv = tonumber(q.Name:match("%(Lv%s*(%d+)%)")), at = tonumber(val(q, "At")) })
    end
    table.sort(out.done, function(a, b) return (a.at or 0) > (b.at or 0) end)
    while #out.done > 40 do table.remove(out.done) end
    return out
end

local function collect()
    local data = getData()
    local slot = getSlot(data)
    local s = {
        name = player.Name,
        display = player.DisplayName,
        userId = player.UserId,
        time = os.time(),
        interval = INTERVAL,
        items = {},
    }
    if not data or not slot then
        s.error = "ไม่เจอข้อมูลผู้เล่นใน ReplicatedStorage.Player_Service.Data"
        return s
    end

    local pt = data:FindFirstChild("PlayerTitles")
    local prog = pt and pt:FindFirstChild("Progress")
    local expF = slot:FindFirstChild("Exp")
    local hum = player.Character and player.Character:FindFirstChildOfClass("Humanoid")

    s.level = val(prog, "level")
    s.slayerRank = val(slot, "SlayerRank")
    s.demonRank = val(slot, "DemonRank")
    s.clan = val(slot, "Clan")
    s.race = val(slot, "Race")
    local powers = slot:FindFirstChild("Powers")
    s.breathing = val(powers, "Breathing") or val(slot, "Breathing")
    s.demonArt = val(powers, "DemonArt")
    s.fightingStyle = val(powers, "FightingStyle")
    if s.demonArt == "" then s.demonArt = nil end
    if s.fightingStyle == "" then s.fightingStyle = nil end
    if s.breathing == "" then s.breathing = nil end
    local progn = slot:FindFirstChild("Progression")
    local dp = progn and progn:FindFirstChild("Demon")
    if dp then s.demonProgress = { current = val(dp, "Current"), goal = val(dp, "Max") } end
    s.wen = val(slot, "Wen", 0)
    s.expCurrent = val(expF, "Current")
    s.expGoal = val(expF, "Goal")
    s.skillPoints = val(slot, "SkillPoints", 0)
    s.reputation = val(data, "Reputation", 0)
    s.stamina = getStamina()
    if hum then
        s.hp = math.floor(hum.Health)
        s.maxHp = math.floor(hum.MaxHealth)
    end

    s.progress = {}
    for _, k in ipairs({ "kills", "boss_kills", "deaths", "chests", "quests", "tower_floor" }) do
        s.progress[k] = val(prog, k, 0)
    end

    local okB, boss = pcall(nearestBoss)
    if okB and boss then s.boss = boss end
    s.holding, s.activeMastery = nowUsing()
    pcall(function() s.quests = questsOf(slot, prog) end)

    s.mastery = {}
    local mlist = slot:FindFirstChild("MasteryProgressionList")
    if mlist then
        for _, m in ipairs(mlist:GetChildren()) do
            local cur, goal = val(m, "Current"), val(m, "Goal")
            if cur and goal then s.mastery[m.Name] = { current = cur, goal = goal, lv = masteryLvFromUI(m.Name) } end
        end
    end

    -- ของ
    local items, uiFound = getItems(slot)
    s.uiFound = uiFound
    local entries, seen = {}, {}
    if SHOW_ALL_ITEMS then
        for name, n in pairs(items) do table.insert(entries, { name = name, amount = n, watch = true }); seen[name] = true end
        table.sort(entries, function(a, b) return a.amount > b.amount end)
    else
        for _, name in ipairs(WATCH_ITEMS) do
            table.insert(entries, { name = name, amount = items[name] or 0, watch = true }); seen[name] = true
        end
    end
    if WEB_ALL_ITEMS then -- ของอื่นทั้งหมดในกระเป๋า (สำหรับหน้า "กระเป๋า" บนเว็บ)
        local extra = {}
        for name, n in pairs(items) do
            if not seen[name] and n > 0 then table.insert(extra, { name = name, amount = n }) end
        end
        table.sort(extra, function(a, b) return a.name < b.name end)
        for i = 1, math.min(#extra, 150) do table.insert(entries, extra[i]) end
    end

    -- หมวดของไอเทมจาก ReplicatedStorage.Items.<หมวด>.<ชื่อ> (อ่านครั้งเดียวแล้วจำไว้)
    if not itemCat then
        itemCat = {}
        pcall(function()
            local root = RS:FindFirstChild("Items")
            for _, folder in ipairs(root and root:GetChildren() or {}) do
                for _, it in ipairs(folder:GetChildren()) do
                    if not itemCat[it.Name] then itemCat[it.Name] = folder.Name end
                end
            end
        end)
    end
    for _, e in ipairs(entries) do e.cat = itemCat[e.name] end

    -- ของที่ใส่อยู่ (เกมเก็บเป็น Id ของชิ้นนั้น)
    pcall(function()
        local invF = slot:FindFirstChild("Inventory")
        local bag = invF and invF:FindFirstChild("Inventory")
        local byId = {}
        for _, it in ipairs(bag and bag:GetChildren() or {}) do
            local idv = it:FindFirstChild("Id")
            if idv and idv:IsA("ValueBase") then byId[idv.Value] = it.Name end
        end
        local eq = {}
        local function scan(f)
            for _, c in ipairs(f and f:GetDescendants() or {}) do
                if c:IsA("ValueBase") and type(c.Value) == "number" and c.Value > 0 and byId[c.Value] then eq[byId[c.Value]] = true end
            end
        end
        local acc = invF and invF:FindFirstChild("Accessories")
        scan(acc and acc:FindFirstChild("Stats"))
        scan(invF and invF:FindFirstChild("Toolbar"))
        for _, e in ipairs(entries) do if eq[e.name] then e.equipped = true end end
    end)

    for _, e in ipairs(entries) do
        e.delta = prevItems[e.name] and (e.amount - prevItems[e.name]) or 0
    end
    prevItems = items

    local names = {}
    for _, e in ipairs(entries) do
        if e.amount > 0 then table.insert(names, e.name) end
    end
    refreshIcons(names)
    for _, e in ipairs(entries) do
        local id = itemIconId[e.name]
        e.assetId = id
        e.iconUrl = id and idUrl[id] or nil
    end
    s.items = entries
    return s
end

-- ===== สร้างข้อความ Discord (ดีไซน์ premium) =====
local ACCENT_COLOR = 0x00D9FF
local ESC = string.char(27)

local function ansi(code, text)
    if not USE_ANSI then return text end
    return ESC .. "[" .. code .. "m" .. text .. ESC .. "[0m"
end

local function bar(cur, max, width)
    width = width or 12
    cur, max = tonumber(cur) or 0, tonumber(max) or 0
    local ratio = max > 0 and math.clamp(cur / max, 0, 1) or 0
    local filled = math.floor(ratio * width + 0.5)
    return string.rep("▰", filled) .. string.rep("▱", width - filled), math.floor(ratio * 100 + 0.5)
end

local function pad(str, n)
    if #str >= n then return str end
    return str .. string.rep(" ", n - #str)
end

local function codeBlock(lines)
    return "```" .. (USE_ANSI and "ansi" or "") .. "\n" .. table.concat(lines, "\n") .. "\n```"
end

local function dashboard(s)
    local lines = {}
    if s.expCurrent and s.expGoal then
        local b, p = bar(s.expCurrent, s.expGoal, 14)
        table.insert(lines, ansi("1;36", pad("EXP", 6)) .. ansi("0;36", b) .. " " .. string.format("%3d%%", p))
    end
    if s.hp and s.maxHp then
        local b, p = bar(s.hp, s.maxHp, 14)
        table.insert(lines, ansi("1;31", pad("HP", 6)) .. ansi("0;31", b) .. " " .. string.format("%3d%%", p))
    end
    if #lines == 0 then return nil end
    return codeBlock(lines)
end

local function masteryBlock(s)
    local names = {}
    for name in pairs(s.mastery or {}) do table.insert(names, name) end
    table.sort(names)
    if #names == 0 then return nil end
    local w = 0
    for _, n in ipairs(names) do w = math.max(w, #n) end
    local lines = {}
    for _, n in ipairs(names) do
        local m = s.mastery[n]
        local b, p = bar(m.current, m.goal, 10)
        table.insert(lines, ansi("1;33", pad(n, w + 2)) .. ansi("0;33", b) .. " " .. string.format("%3d%%", p))
    end
    return codeBlock(lines)
end

local function deltaText(d)
    if not d or d == 0 then return "" end
    return "  (" .. (d > 0 and "+" or "") .. fmt(d) .. ")"
end

local function itemEmbed(e)
    if ICON_STYLE == "thumbnail" then
        local emb = {
            title = e.name,
            description = "**×" .. fmt(e.amount) .. "**" .. deltaText(e.delta),
            color = ITEM_COLOR,
        }
        if e.iconUrl then emb.thumbnail = { url = e.iconUrl } end
        return emb
    end
    local emb = {
        author = { name = e.name .. "   ×" .. fmt(e.amount) .. deltaText(e.delta) },
        color = ITEM_COLOR, -- สีเดียวกับพื้นหลัง embed ทำให้ไม่เห็นแถบสี ดูเรียบ/คลีน
    }
    if e.iconUrl then emb.author.icon_url = e.iconUrl end
    return emb
end

local function profileEmbed(s)
    local every = (INTERVAL % 60 == 0) and (INTERVAL / 60 .. " min") or (INTERVAL .. " s")
    local emb = {
        author = { name = "SLAYER TRACKER  ·  LIVE" },
        color = ACCENT_COLOR,
        footer = { text = "Updated " .. os.date("%d/%m/%Y %H:%M:%S") .. "  ·  refresh every " .. every },
    }
    local av = getAvatar()
    if av then emb.thumbnail = { url = av } end

    if s.error then
        emb.title = s.name
        emb.description = "⚠️ " .. s.error
        return emb
    end

    local p = s.progress or {}
    emb.title = "▌" .. s.display .. "  ·  LV " .. tostring(s.level or "?")
    emb.description = dashboard(s)

    emb.fields = {
        {
            name = "◈ IDENTITY",
            value = table.concat({
                "▸ Slayer  **" .. tostring(s.slayerRank or "?") .. "**",
                "▸ Demon  **" .. tostring(s.demonRank or "?") .. "**",
                "▸ Clan  **" .. tostring(s.clan or "?") .. "**",
                "▸ Breathing  **" .. tostring(s.breathing or "-") .. "**",
                "▸ Demon Art  **" .. tostring(s.demonArt or "-") .. "**",
                "▸ Race  **" .. tostring(s.race or "?") .. "**",
            }, "\n"),
            inline = true,
        },
        {
            name = "◈ WEALTH",
            value = table.concat({
                "▸ Wen  **" .. fmt(s.wen) .. "**",
                "▸ Rep  **" .. fmt(s.reputation) .. "**",
                "▸ Skill Pts  **" .. fmt(s.skillPoints) .. "**",
                "▸ Stamina  **" .. (s.stamina and fmt(s.stamina) or "?") .. "**",
            }, "\n"),
            inline = true,
        },
        {
            name = "◈ COMBAT",
            value = table.concat({
                "▸ Kills  **" .. fmt(p.kills) .. "**",
                "▸ Bosses  **" .. fmt(p.boss_kills) .. "**",
                "▸ Deaths  **" .. fmt(p.deaths) .. "**",
                "▸ Chests  **" .. fmt(p.chests) .. "**",
                "▸ Tower  **F" .. fmt(p.tower_floor) .. "**",
            }, "\n"),
            inline = true,
        },
    }

    local mastery = masteryBlock(s)
    if mastery then
        table.insert(emb.fields, { name = "◈ MASTERY", value = mastery, inline = false })
    end
    if s.uiFound == false then
        table.insert(emb.fields, {
            name = "ℹ️ หมายเหตุ",
            value = "ไม่เจอหน้า Inventory (กด M เปิดค้างไว้สักครั้ง) จำนวนของที่ซ้อนกันได้อาจไม่ตรง",
            inline = false,
        })
    end
    return emb
end

-- Discord รับได้ 10 embed ต่อ 1 ข้อความ จึงแบ่งเป็นหลายข้อความถ้าของเยอะ
local function buildMessages(s)
    local messages = {}
    local itemEmbeds = {}
    for _, e in ipairs(s.items) do
        if e.watch and #itemEmbeds < MAX_ITEMS then table.insert(itemEmbeds, itemEmbed(e)) end
    end

    local first = { profileEmbed(s) }
    local idx = 1
    while idx <= #itemEmbeds and #first < 10 do
        table.insert(first, itemEmbeds[idx])
        idx = idx + 1
    end
    table.insert(messages, { username = "Slayer Tracker", embeds = first })

    while idx <= #itemEmbeds do
        local group = {}
        while idx <= #itemEmbeds and #group < 10 do
            table.insert(group, itemEmbeds[idx])
            idx = idx + 1
        end
        table.insert(messages, { username = "Slayer Tracker", embeds = group })
    end
    return messages
end

-- ===== ส่งออก =====
local IDS_FILE = "slayer_msg_ids.json"
local messageIds = {}

local function loadIds()
    if isfile and readfile and isfile(IDS_FILE) then
        local ok, data = pcall(function() return HttpService:JSONDecode(readfile(IDS_FILE)) end)
        if ok and type(data) == "table" then
            for k, v in pairs(data) do
                if tonumber(k) then messageIds[tonumber(k)] = tostring(v) end
            end
        end
    end
end

local function saveIds()
    if writefile then
        local out = {}
        for k, v in pairs(messageIds) do out[tostring(k)] = v end
        pcall(function() writefile(IDS_FILE, HttpService:JSONEncode(out)) end)
    end
end

local function statusOk(res)
    if not res then return false end
    local c = res.StatusCode
    if c then return c >= 200 and c < 300 end
    return res.Success == true
end

local function post(url, body, extraHeaders)
    local headers = { ["Content-Type"] = "application/json" }
    for k, v in pairs(extraHeaders or {}) do headers[k] = v end
    return pcall(req, { Url = url, Method = "POST", Headers = headers, Body = body })
end

-- อัปเดตตัวเอง: เซิร์ฟเวอร์ตอบ sv (ลายนิ้วมือสคริปต์ล่าสุด) มากับทุกครั้งที่ส่งข้อมูล ถ้าไม่ตรงกับตัวที่รันอยู่ → โหลดตัวใหม่ทับ
local updating = false
local function checkUpdate(res)
    if updating or not AUTO_UPDATE or SCRIPT_VER == "dev" or not getgenv or not alive() or WEB_API_URL == "" then return end
    if type(res) ~= "table" or not res.Body then return end
    local r
    pcall(function() r = HttpService:JSONDecode(res.Body) end)
    if type(r) ~= "table" or type(r.sv) ~= "string" or r.sv == "" or r.sv == SCRIPT_VER then return end
    if getgenv().FLEET_BAD_VER == r.sv then return end
    local base = WEB_API_URL:match("^(https?://[^/]+)")
    if not base then return end
    updating = true
    task.spawn(function()
        task.wait(math.random(0, 45)) -- หลายไอดีบนคอมเดียวกัน ไม่โหลดพร้อมกันทีเดียว
        if not alive() then return end
        local okG, code = pcall(function() return game:HttpGet(base .. "/script.lua") end)
        local fn = okG and type(code) == "string" and code:find("SCRIPT_VER", 1, true) and loadstring(code)
        if not fn then
            warn(">> โหลดสคริปต์ใหม่ไม่สำเร็จ ใช้ตัวเดิมต่อ (จะลองใหม่รอบหน้า)")
            updating = false
            return
        end
        print(">> มีสคริปต์เวอร์ชันใหม่ " .. r.sv .. " กำลังอัปเดตตัวเอง...")
        getgenv().SLAYER_KEY = WEB_API_KEY
        getgenv().FLEET_RELOADING = true
        local okR, err = pcall(fn)
        if getgenv().FLEET_RUN == MY_RUN then -- ตัวใหม่ไม่ได้เริ่มทำงาน: ใช้ตัวเดิมต่อ
            getgenv().FLEET_RELOADING = nil
            if not okR then getgenv().FLEET_BAD_VER = r.sv; warn(">> สคริปต์ใหม่ผิดพลาด ใช้ตัวเดิมต่อ: " .. tostring(err)) end
            updating = false
        else
            print(">> อัปเดตเป็นเวอร์ชัน " .. r.sv .. " แล้ว")
        end
    end)
end

-- LIVE_EDIT: แก้ข้อความเดิมแทนการส่งใหม่ทุกรอบ ห้องไม่รก เหมือนแดชบอร์ดที่อัปเดตสด
local function sendMessage(m, idx)
    local headers = { ["Content-Type"] = "application/json" }
    local id = messageIds[idx]
    if LIVE_EDIT and id then
        local ok, res = pcall(req, {
            Url = WEBHOOK_URL .. "/messages/" .. id,
            Method = "PATCH",
            Headers = headers,
            Body = HttpService:JSONEncode({ embeds = m.embeds }),
        })
        if ok and statusOk(res) then return true end
        if ok and res and res.StatusCode == 404 then
            messageIds[idx] = nil -- ข้อความถูกลบไปแล้ว ส่งใหม่ด้านล่าง
        else
            return false          -- ติด rate limit หรือ error อื่น รอบหน้าลองใหม่
        end
    end

    local ok, res = pcall(req, {
        Url = WEBHOOK_URL .. "?wait=true",
        Method = "POST",
        Headers = headers,
        Body = HttpService:JSONEncode(m),
    })
    if ok and statusOk(res) then
        if res.Body then
            local ok2, data = pcall(function() return HttpService:JSONDecode(res.Body) end)
            if ok2 and type(data) == "table" and data.id then
                messageIds[idx] = tostring(data.id)
            end
        end
        return true
    end
    return false
end

local function cleanupExtra(count)
    for idx, id in pairs(messageIds) do
        if idx > count then
            pcall(req, { Url = WEBHOOK_URL .. "/messages/" .. id, Method = "DELETE" })
            messageIds[idx] = nil
        end
    end
end

local function exportSnapshot(s)
    local ok, json = pcall(function() return HttpService:JSONEncode(s) end)
    if not ok then
        warn("แปลง JSON ไม่สำเร็จ:", json)
        return
    end
    if EXPORT_JSON and writefile then
        pcall(writefile, "slayer_export_" .. player.Name .. ".json", json)
    end
    if WEB_API_URL ~= "" and req then
        local extra = {}
        if WEB_API_KEY ~= "" then extra["Authorization"] = "Bearer " .. WEB_API_KEY end
        local ok2, res = post(WEB_API_URL, json, extra)
        local code = ok2 and type(res) == "table" and res.StatusCode or nil
        local r = nil
        if ok2 and type(res) == "table" and res.Body then pcall(function() r = HttpService:JSONDecode(res.Body) end) end
        if ok2 then checkUpdate(res) end
        if ok2 and statusOk(res) and type(r) == "table" and (r.rejected or 0) > 0 then
            local why = type(r.why) == "table" and table.concat(r.why, ", ") or "?"
            local th = { ["bad name"] = "ชื่อไอดีไม่ถูกต้อง", ["too big"] = "ข้อมูลใหญ่เกินไป", ["account limit"] = "ไอดีเกินจำนวนที่กำหนด" }
            warn(">> เว็บไม่รับข้อมูลรอบนี้: " .. (th[why] or why) .. " (ถ่ายภาพส่งให้ผู้ขาย)")
        elseif ok2 and statusOk(res) then
            print(">> ส่งข้อมูลขึ้นเว็บแล้ว " .. os.date("%H:%M:%S") .. (s.boss and ("  (บอสใกล้ตัว: " .. s.boss.name .. ")") or ""))
        elseif code == 401 then
            warn("ส่งขึ้นเว็บไม่ได้: คีย์ไม่ถูกต้อง (ขอสคริปต์ใหม่จากผู้ขาย)")
        elseif code == 403 then
            warn("ส่งขึ้นเว็บไม่ได้: หมดอายุหรือถูกระงับ (ติดต่อผู้ขาย)")
        else
            warn("ส่งขึ้นเว็บไม่สำเร็จ (จะลองใหม่รอบหน้า):", code or res)
        end
    end
end

local function flushDebug()
    if DEBUG_ICONS and #debugLog > 0 then
        local text = table.concat(debugLog, "\n")
        print(text)
        if setclipboard then
            setclipboard(text)
            print(">> ก๊อปรายการรูปลงคลิปบอร์ดแล้ว ไปวางในแชทได้เลย")
        end
    end
    debugLog = {}
end

local function cycle()
    local ok, s = pcall(collect)
    if not ok then
        warn("อ่านข้อมูลไม่สำเร็จ:", s)
        return
    end
    flushDebug()
    exportSnapshot(s)

    if not WEBHOOK_URL:find("https://", 1, true) then
        -- ไม่ได้ใช้ Discord: ถ้าส่งขึ้นเว็บอยู่แล้วก็ไม่ต้องเตือน
        if WEB_API_URL == "" then warn("ยังไม่ได้ใส่ลิงก์ WEBHOOK_URL") end
        return
    end
    if not req then
        warn("executor ไม่รองรับ request/http_request")
        return
    end

    local okMsg, messages = pcall(buildMessages, s)
    if not okMsg then
        warn("สร้างข้อความไม่สำเร็จ:", messages)
        return
    end

    local allOk = true
    for i, m in ipairs(messages) do
        if not sendMessage(m, i) then allOk = false end
        if i < #messages then task.wait(1.2) end
    end
    cleanupExtra(#messages)
    saveIds()
    print(">> " .. (allOk and "ส่ง/อัปเดต webhook แล้ว" or "ส่ง webhook ไม่ครบ (จะลองใหม่รอบหน้า)")
        .. " (" .. #messages .. " ข้อความ) " .. os.date("%H:%M:%S"))
end

-- ===== รีจอยอัตโนมัติ (หลุดแต่หน้าต่างเกมยังเปิดอยู่) =====
local function setupRejoin()
    if not AUTO_REJOIN then return end
    local TeleportService = game:GetService("TeleportService")
    local GuiService = game:GetService("GuiService")
    local busy = false
    local placeId = game.PlaceId

    -- ให้สคริปต์นี้รันต่อเองหลังเข้าเกมใหม่ (ถ้า executor รองรับ และใช้ผ่านตัวโหลด)
    local queue = (syn and syn.queue_on_teleport) or queue_on_teleport or (fluxus and fluxus.queue_on_teleport)
    local function queueSelf()
        if not queue or WEB_API_KEY == "" or WEB_API_URL == "" then return end
        local base = WEB_API_URL:match("^(https?://[^/]+)")
        if not base then return end
        pcall(queue, 'getgenv().SLAYER_KEY = "' .. WEB_API_KEY .. '"\nloadstring(game:HttpGet("' .. base .. '/script.lua"))()')
    end

    local function rejoin(reason)
        if busy then return end
        local r = tostring(reason or ""):lower()
        if r:find("ban", 1, true) or r:find("exploit", 1, true) or r:find("same account launched", 1, true) then
            warn(">> ไม่รีจอย: " .. tostring(reason)) -- โดนแบน/จับได้ หรือมีคนล็อกอินไอดีนี้ที่อื่น
            return
        end
        busy = true
        print(">> หลุดจากเกม (" .. tostring(reason) .. ") กำลังเข้าเกมใหม่...")
        queueSelf()
        task.spawn(function()
            local backoff = 10
            while true do
                pcall(function() TeleportService:Teleport(placeId, player) end)
                task.wait(backoff)
                backoff = math.min(backoff * 2, 300) -- 10 วิ, 20, 40 ... สูงสุด 5 นาที ไม่ยิงรัว
            end
        end)
    end

    pcall(function()
        GuiService.ErrorMessageChanged:Connect(function(msg)
            if not alive() then return end -- ตัวใหม่รับช่วงแล้ว
            if msg and msg ~= "" then rejoin(msg) end
        end)
    end)
    pcall(function()
        local overlay = game:GetService("CoreGui"):WaitForChild("RobloxPromptGui", 10):WaitForChild("promptOverlay", 10)
        overlay.ChildAdded:Connect(function(c)
            if not alive() then return end
            if c.Name == "ErrorPrompt" then
                task.wait(1)
                local msg = ""
                pcall(function() msg = GuiService:GetErrorMessage() end)
                rejoin(msg ~= "" and msg or "ErrorPrompt")
            end
        end)
    end)
    -- teleport ล้มเหลว (เช่นเน็ตยังไม่กลับ) ให้ลองต่อ
    pcall(function()
        TeleportService.TeleportInitFailed:Connect(function(p, result, err)
            if not alive() then return end
            if p == player then print(">> เข้าเกมใหม่ไม่สำเร็จ (" .. tostring(err) .. ") จะลองอีกครั้ง") end
        end)
    end)
end
pcall(setupRejoin)

loadCache()
loadIds()
task.spawn(function()
    while alive() do
        cycle()
        task.wait(INTERVAL)
    end
end)

-- ข้อมูลสดระหว่างรอบ: เบามาก ส่งแค่บอสใกล้ตัว Wen เลเวล และจำนวนแร่
task.spawn(function()
    if LIVE_INTERVAL <= 0 or WEB_API_URL == "" or not req then return end
    task.wait(LIVE_INTERVAL)
    while alive() do
        pcall(function()
            local data = getData()
            local slot = getSlot(data)
            if not slot then return end
            local items = itemsFromData(slot)
            local ui = itemsFromUI()
            for k, v in pairs(ui) do items[k] = v end
            local pt = data:FindFirstChild("PlayerTitles")
            local okB, boss = pcall(nearestBoss)
            local p = {
                name = player.Name, live = true,
                wen = val(slot, "Wen", 0), level = val(pt and pt:FindFirstChild("Progress"), "level"),
                ore = items["Ore"] or 0, refine = items["Refinement Ore"] or 0,
                boss = (okB and boss) and { name = boss.name, hp = boss.hp } or nil,
            }
            p.holding, p.activeMastery = nowUsing()
            pcall(function()
                local qq = questsOf(slot, pt and pt:FindFirstChild("Progress"))
                if qq then p.quests = { active = qq.active, total = qq.total } end
            end)
            local ml = slot:FindFirstChild("MasteryProgressionList")
            if ml then
                p.mastery = {}
                for _, m in ipairs(ml:GetChildren()) do
                    local cur, goal = val(m, "Current"), val(m, "Goal")
                    if cur then p.mastery[m.Name] = { current = cur, goal = goal, lv = masteryLvFromUI(m.Name) } end
                end
            end
            local extra = {}
            if WEB_API_KEY ~= "" then extra["Authorization"] = "Bearer " .. WEB_API_KEY end
            local okP, resP = post(WEB_API_URL, HttpService:JSONEncode(p), extra)
            if okP then checkUpdate(resP) end
        end)
        task.wait(LIVE_INTERVAL)
    end
end)
