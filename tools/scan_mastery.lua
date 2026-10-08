-- สแกนหาว่าเกมเก็บ "เลเวล Mastery" ไว้ตรงไหน (ใช้ครั้งเดียว ไม่ส่งข้อมูลไปไหน)
-- วิธีใช้: เปิดหน้า Mastery ในเกมค้างไว้ก่อน (ถ้ามี) แล้วรันสคริปต์นี้
-- ผลจะก๊อปลงคลิปบอร์ด + เซฟเป็น mastery_report.txt ในโฟลเดอร์ workspace
local Players = game:GetService("Players")
local RS = game:GetService("ReplicatedStorage")
local player = Players.LocalPlayer
local out = {}
local function add(s) table.insert(out, s) end
local function desc(o)
    local line = o.Name .. " [" .. o.ClassName .. "]"
    if o:IsA("ValueBase") then line = line .. " = " .. tostring(o.Value) end
    for k, v in pairs(o:GetAttributes()) do line = line .. " {" .. k .. "=" .. tostring(v) .. "}" end
    return line
end
local function dump(o, d, maxD)
    add(string.rep("  ", d) .. desc(o))
    if d >= maxD then return end
    for _, c in ipairs(o:GetChildren()) do dump(c, d + 1, maxD) end
end

local data = RS:FindFirstChild("Player_Service") and RS.Player_Service:FindFirstChild("Data")
data = data and data:FindFirstChild(player.Name)
local names = {}
if data then
    local idxObj = data:FindFirstChild("slotEquipped")
    local slots = data:FindFirstChild("slots")
    local slot = slots and (slots:FindFirstChild("Slot" .. tostring(idxObj and idxObj.Value or 1)) or slots:FindFirstChildOfClass("Folder"))
    local ml = slot and slot:FindFirstChild("MasteryProgressionList")
    add("== MasteryProgressionList ==")
    if ml then
        dump(ml, 0, 4)
        for _, c in ipairs(ml:GetChildren()) do table.insert(names, c.Name) end
    else add("(ไม่เจอ)") end

    add("\n== ทุกอย่างในข้อมูลผู้เล่นที่ชื่อมีคำว่า mastery / level ==")
    local n = 0
    for _, o in ipairs(data:GetDescendants()) do
        local ln = o.Name:lower()
        if (ln:find("master") or ln:find("level") or ln == "lv") and n < 60 then
            local path = o:GetFullName():gsub("^.-Data%." .. player.Name .. "%.", "")
            add("  " .. path .. "  ->  " .. desc(o)); n = n + 1
        end
    end
    -- ชื่อ mastery ที่อาจอยู่ที่อื่น (เช่น Gauntlet = 400)
    add("\n== ค่าที่ชื่อตรงกับชื่อ mastery (นอก MasteryProgressionList) ==")
    local set = {}
    for _, nm in ipairs(names) do set[nm] = true end
    n = 0
    for _, o in ipairs(data:GetDescendants()) do
        if set[o.Name] and not o:GetFullName():find("MasteryProgressionList", 1, true) and n < 60 then
            local path = o:GetFullName():gsub("^.-Data%." .. player.Name .. "%.", "")
            add("  " .. path .. "  ->  " .. desc(o)); n = n + 1
            for _, c in ipairs(o:GetChildren()) do if n < 60 then add("      " .. desc(c)); n = n + 1 end end
        end
    end
else
    add("ไม่เจอข้อมูลผู้เล่น")
end

-- ข้อความบนหน้าจอที่เกี่ยวกับ mastery (เปิดหน้า Mastery ค้างไว้จะเจอเยอะขึ้น)
add("\n== ข้อความบนหน้าจอที่เกี่ยวข้อง ==")
local pg = player:FindFirstChild("PlayerGui")
local n = 0
if pg then
    for _, o in ipairs(pg:GetDescendants()) do
        if (o:IsA("TextLabel") or o:IsA("TextButton")) and o.Text ~= "" and n < 80 then
            local t = o.Text
            local hit = t:lower():find("master") or t:find("400")
            for _, nm in ipairs(names) do if t:find(nm, 1, true) then hit = true end end
            if hit then
                add("  " .. o:GetFullName():gsub("^Players%." .. player.Name .. "%.PlayerGui%.", "") .. "  ->  " .. t:sub(1, 80)); n = n + 1
            end
        end
    end
end

local text = table.concat(out, "\n")
print(text)
if writefile then pcall(writefile, "mastery_report.txt", text) end
if setclipboard then setclipboard(text); print(">> ก๊อปลงคลิปบอร์ดแล้ว วางในแชทได้เลย (หรือส่งไฟล์ mastery_report.txt)") end
