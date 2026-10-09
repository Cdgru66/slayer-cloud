-- Fleet: หาว่าเกมเก็บ "เลเวล Mastery" (ตันที่ 400) ไว้ตรงไหน
-- วิธีใช้: ในเกมให้แถบ Mastery ด้านล่างจอแสดงอยู่ (ถือดาบ/ใช้หมัด) แล้วรันสคริปต์นี้
-- ผล: ก๊อปลงคลิปบอร์ด + เซฟเป็น mastery_report2.txt ในโฟลเดอร์ workspace (อ่านอย่างเดียว ไม่ส่งไปไหน)
local Players = game:GetService("Players")
local RS = game:GetService("ReplicatedStorage")
local player = Players.LocalPlayer
local out = {}
local function add(s) table.insert(out, s) end
local function v(o) local ok, x = pcall(function() return o.Value end) return ok and tostring(x) or "" end

local data = RS:FindFirstChild("Player_Service") and RS.Player_Service:FindFirstChild("Data")
data = data and data:FindFirstChild(player.Name)
local slots = data and data:FindFirstChild("slots")
local idx = data and data:FindFirstChild("slotEquipped")
local slot = slots and (slots:FindFirstChild("Slot" .. tostring(idx and idx.Value or 1)) or slots:FindFirstChildOfClass("Folder"))

-- ชื่อ mastery ที่มี (เช่น Sword, Fist, Shockwave)
local names = {}
local ml = slot and slot:FindFirstChild("MasteryProgressionList")
add("== MasteryProgressionList ==")
for _, m in ipairs(ml and ml:GetChildren() or {}) do
    table.insert(names, m.Name)
    local line = "  " .. m.Name .. ":"
    for _, c in ipairs(m:GetDescendants()) do if c:IsA("ValueBase") then line = line .. "  " .. c.Name .. "=" .. v(c) end end
    for k, a in pairs(m:GetAttributes()) do line = line .. "  @" .. k .. "=" .. tostring(a) end
    add(line)
end

-- 1) ทุกค่าในข้อมูลผู้เล่น ที่ชื่อหรือที่อยู่มีคำว่า mastery / level / ชื่อ mastery
add("\n== ค่าในข้อมูลผู้เล่นที่น่าจะเกี่ยวกับ Mastery ==")
local function related(path)
    local p = path:lower()
    if p:find("mastery") or p:find("level") or p:find("lvl") then return true end
    for _, n in ipairs(names) do if p:find(n:lower(), 1, true) then return true end end
    return false
end
local n = 0
for _, o in ipairs(data and data:GetDescendants() or {}) do
    if o:IsA("ValueBase") then
        local path = o:GetFullName():gsub("^.-Data%.[^%.]+%.", "")
        if related(path) and not path:find("Inventory%.Inventory") and n < 200 then add("  " .. path .. " = " .. v(o)); n = n + 1 end
    end
    for k, a in pairs(o:GetAttributes()) do
        if (k:lower():find("mastery") or k:lower():find("level")) and n < 200 then add("  @" .. o:GetFullName():gsub("^.-Data%.[^%.]+%.", "") .. "." .. k .. " = " .. tostring(a)); n = n + 1 end
    end
end

-- 2) ข้อความบนแถบ Mastery ด้านล่างจอ (มักมีเลขเลเวล เช่น "Lv. 123")
add("\n== ข้อความบนหน้าจอเกี่ยวกับ Mastery ==")
local pg = player:FindFirstChild("PlayerGui")
local m2 = 0
for _, o in ipairs(pg and pg:GetDescendants() or {}) do
    if (o:IsA("TextLabel") or o:IsA("TextButton")) and m2 < 120 then
        local path = o:GetFullName()
        if path:lower():find("mastery") and o.Text ~= "" then add("  " .. path:gsub("^.-PlayerGui%.", "") .. "  ->  " .. o.Text); m2 = m2 + 1 end
    end
end

local text = table.concat(out, "\n")
if writefile then pcall(writefile, "mastery_report2.txt", text) end
if setclipboard then pcall(setclipboard, text) end
print(text)
print(">> เสร็จ: ส่งไฟล์ mastery_report2.txt หรือวางจากคลิปบอร์ดให้ผู้ดูแล")
