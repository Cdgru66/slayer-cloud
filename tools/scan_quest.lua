-- Fleet: หาว่า Slayer 2 เก็บ "เควส" ไว้ตรงไหน (เควสที่รับอยู่ / ขั้นที่ทำถึง / เควสที่ทำเสร็จแล้ว)
-- วิธีใช้: รับเควสไว้สัก 1 อัน (ให้ตัวติดตามเควสบนจอแสดงอยู่) แล้วรัน · ทำเควสคืบหน้าไปนิดแล้วรันอีกรอบ
-- ผล: quest_report.txt ในโฟลเดอร์ workspace (อ่านอย่างเดียว ไม่ส่งข้อมูลไปไหน)
print(">> Fleet scan_quest เริ่มทำงาน...")
local Players = game:GetService("Players")
local RS = game:GetService("ReplicatedStorage")
local player = Players.LocalPlayer
local L = {}
local function add(s) if #L < 2500 then table.insert(L, s) end end
local function val(o) local ok, x = pcall(function() return o.Value end) return ok and tostring(x) or "?" end
local function q(s) s = tostring(s):lower(); return s:find("quest") or s:find("mission") or s:find("task") or s:find("objective") or s:find("npc") end
add("place=" .. game.PlaceId .. " time=" .. os.time())

-- 1) ข้อมูลผู้เล่น: ทุกค่าที่ชื่อหรือที่อยู่เกี่ยวกับเควส
pcall(function()
    add("\n== 1. ข้อมูลผู้เล่น (Player_Service) ==")
    local d = RS.Player_Service.Data:FindFirstChild(player.Name)
    local n = 0
    for _, o in ipairs(d and d:GetDescendants() or {}) do
        if n >= 600 then break end
        local path = o:GetFullName():gsub("^.-Data%.[^%.]+%.", "")
        if q(path) and not path:find("Inventory%.Inventory") then
            if o:IsA("ValueBase") then add("  " .. path .. " = " .. val(o)); n = n + 1
            elseif #o:GetChildren() == 0 then add("  [" .. o.ClassName .. "] " .. path); n = n + 1 end
        end
        pcall(function() for k, a in pairs(o:GetAttributes()) do if q(k) or q(path) then add("  @" .. path .. "." .. k .. " = " .. tostring(a)); n = n + 1 end end end)
    end
    if n == 0 then add("  (ไม่เจอค่าที่มีคำว่า quest ในข้อมูลผู้เล่น)") end
end)

-- 2) โครง QuestStates / Quests ใน ReplicatedStorage (รายชื่อเควสทั้งเกม)
pcall(function()
    add("\n== 2. ReplicatedStorage ที่เกี่ยวกับเควส ==")
    for _, o in ipairs(RS:GetChildren()) do
        if q(o.Name) then
            add("  " .. o.Name .. " [" .. o.ClassName .. ", " .. #o:GetChildren() .. "]")
            for _, c in ipairs(o:GetChildren()) do
                local at = {}
                pcall(function() for k, a in pairs(c:GetAttributes()) do table.insert(at, k .. "=" .. tostring(a)) end end)
                for _, v in ipairs(c:GetChildren()) do if v:IsA("ValueBase") then table.insert(at, v.Name .. "=" .. val(v)) end end
                add("    " .. c.Name .. " [" .. c.ClassName .. "]  " .. table.concat(at, " "):sub(1, 220))
            end
        end
    end
end)

-- 3) ตัวติดตามเควสบนจอ (ชื่อเควส / ขั้น / 3/10)
pcall(function()
    add("\n== 3. ข้อความบนจอที่เกี่ยวกับเควส ==")
    local n = 0
    for _, o in ipairs(player.PlayerGui:GetDescendants()) do
        if n >= 300 then break end
        if (o:IsA("TextLabel") or o:IsA("TextButton")) and o.Text ~= "" then
            local path = o:GetFullName():gsub("^.-PlayerGui%.", "")
            if q(path) or q(o.Text) then
                local vis = true
                pcall(function() local p = o; while p and not p:IsA("ScreenGui") do if p:IsA("GuiObject") and not p.Visible then vis = false break end p = p.Parent end end)
                add("  " .. (vis and "" or "(ซ่อน) ") .. path .. "  ->  " .. o.Text:gsub("<[^>]->", ""):sub(1, 120)); n = n + 1
            end
        end
    end
end)

local text = table.concat(L, "\n")
if writefile then pcall(writefile, "quest_report.txt", text) end
print(">> เสร็จ: บันทึก quest_report.txt แล้ว (" .. #L .. " บรรทัด) ส่งไฟล์นี้ให้ผู้ดูแล")
