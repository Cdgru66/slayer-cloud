-- Slayer Fleet: สแกนไอคอนจากทั้งเกม (Orb, ของที่ยังขาด, หน้าพจนานุกรม, บอส)
-- วิธีใช้: เปิดหน้าพจนานุกรม/คลังไอเทมในเกมค้างไว้ (เลื่อนให้เห็นหลาย ๆ หน้ายิ่งดี) แล้วรันสคริปต์นี้
-- ได้ไฟล์ slayer_icon_dict.json ในโฟลเดอร์ workspace ของ executor ส่งไฟล์นั้นให้ผู้ดูแล
-- ไม่ส่งข้อมูลไปไหน นอกจากขอลิงก์รูปจาก thumbnails.roblox.com
local Players = game:GetService("Players")
local RS = game:GetService("ReplicatedStorage")
local HttpService = game:GetService("HttpService")
local player = Players.LocalPlayer
local req = (syn and syn.request) or (http and http.request) or http_request or request or (fluxus and fluxus.request)

local found = {}   -- ชื่อ -> { id = asset id, src = มาจากไหน, cat = หมวด }
local count = 0
local function idOf(s)
    if type(s) ~= "string" or s == "" then return nil end
    return s:match("rbxassetid://(%d+)") or s:match("[%?&]id=(%d+)") or s:match("^(%d+)$")
end
local function put(name, id, src, cat)
    if not name or not id then return end
    name = tostring(name):gsub("^%s+", ""):gsub("%s+$", "")
    if name == "" or #name > 60 or name:find("\n") then return end
    if not found[name] then count = count + 1 end
    if not found[name] or src == "items" then found[name] = { id = id, src = src, cat = cat or (found[name] and found[name].cat) } end
end

-- หา asset id จากตัวไอเทมเอง: attribute, ค่า string, รูป/Decal ข้างใน, TextureId ของ Tool
local function iconInside(obj)
    for k, v in pairs(obj:GetAttributes()) do
        local id = idOf(v); if id and tostring(k):lower():find("icon") then return id end
    end
    for _, v in pairs(obj:GetAttributes()) do local id = idOf(v); if id then return id end end
    if obj:IsA("Tool") then local id = idOf(obj.TextureId); if id then return id end end
    for _, d in ipairs(obj:GetDescendants()) do
        local ok, id = pcall(function()
            if d:IsA("StringValue") then return idOf(d.Value) end
            if d:IsA("ImageLabel") or d:IsA("ImageButton") then return idOf(d.Image) end
            if d:IsA("Decal") or d:IsA("Texture") then return idOf(d.Texture) end
            return nil
        end)
        if ok and id then return id end
    end
    return nil
end

-- 1) คลังไอเทมของเกม ReplicatedStorage.Items.<หมวด>.<ชื่อ>
local items = RS:FindFirstChild("Items")
if items then
    for _, folder in ipairs(items:GetChildren()) do
        for _, it in ipairs(folder:GetChildren()) do
            local ok, id = pcall(iconInside, it)
            if ok and id then put(it.Name, id, "items", folder.Name) end
        end
    end
end

-- 2) หน้าจอที่เปิดอยู่ (พจนานุกรม / กระเป๋า / ร้านค้า): จับคู่รูปกับข้อความชื่อที่อยู่ใกล้กัน
local SKIP = { "gradient", "shadow", "glow", "select", "stroke", "border", "background", "bg", "frame", "button", "close", "arrow" }
local function skipName(n) n = n:lower(); for _, k in ipairs(SKIP) do if n:find(k, 1, true) then return true end end return false end
local function nearText(img)
    local p = img.Parent
    for depth = 1, 3 do
        if not p then break end
        for _, d in ipairs(p:GetDescendants()) do
            if d:IsA("TextLabel") and d.Visible and d.Text ~= "" and not d.Text:match("^[%dxX%s,%.%%/+%-:]+$") then
                return d.Text:gsub("<[^>]->", "")
            end
        end
        p = p.Parent
    end
    return nil
end
local pg = player:FindFirstChild("PlayerGui")
for _, d in ipairs(pg and pg:GetDescendants() or {}) do
    if (d:IsA("ImageLabel") or d:IsA("ImageButton")) and not skipName(d.Name) then
        local sheet = d.ImageRectSize.X > 0 and d.ImageRectSize.Y > 0
        local id = idOf(d.Image)
        if id and not sheet and d.AbsoluteSize.X >= 24 then
            local t = nearText(d)
            if t then put(t, id, "ui") end
            if d.Parent and not skipName(d.Parent.Name) and #d.Parent.Name > 2 then put(d.Parent.Name, id, "ui") end
        end
    end
end

-- 3) บอส / NPC: หาโฟลเดอร์ที่มีคำว่า boss ใน ReplicatedStorage แล้วดึงรูปข้างใน
for _, d in ipairs(RS:GetDescendants()) do
    if (d:IsA("Folder") or d:IsA("Model") or d:IsA("Configuration")) and d.Name:lower():find("boss") then
        for _, b in ipairs(d:GetChildren()) do
            local ok, id = pcall(iconInside, b)
            if ok and id then put(b.Name, id, "boss", "Boss") end
        end
    end
end

-- 4) แปลง asset id เป็นลิงก์รูปที่เว็บเปิดได้ (ทีละ 50)
local ids, seen = {}, {}
for _, v in pairs(found) do if not seen[v.id] then seen[v.id] = true; table.insert(ids, v.id) end end
local urlOf = {}
if req then
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
        task.wait(0.3)
    end
end

local out, nUrl, bySrc = {}, 0, { items = 0, ui = 0, boss = 0 }
for name, v in pairs(found) do
    out[name] = { id = v.id, url = urlOf[v.id], src = v.src, cat = v.cat }
    if urlOf[v.id] then nUrl = nUrl + 1 end
    bySrc[v.src] = (bySrc[v.src] or 0) + 1
end
local json = HttpService:JSONEncode({ version = 1, place = game.PlaceId, items = out })
if writefile then pcall(writefile, "slayer_icon_dict.json", json) end
local msg = string.format("สแกนเจอ %d ชื่อ (คลังไอเทม %d, หน้าจอ %d, บอส %d) ได้ลิงก์รูป %d รายการ\nบันทึกเป็น slayer_icon_dict.json แล้ว ส่งไฟล์นี้ให้ผู้ดูแลได้เลย",
    count, bySrc.items or 0, bySrc.ui or 0, bySrc.boss or 0, nUrl)
print(msg)
if setclipboard then pcall(setclipboard, json) print(">> ก๊อป JSON ลงคลิปบอร์ดแล้วด้วย (ถ้าส่งไฟล์ไม่สะดวก วางในแชทได้)") end
