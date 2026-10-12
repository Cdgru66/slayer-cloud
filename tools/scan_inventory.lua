-- Fleet: สแกนของในกระเป๋าทั้งหมด (Slayer 2) รวมของ "Account Wide" อย่าง Ouwigahara Token
-- วิธีใช้: เปิดหน้ากระเป๋าค้างไว้ (เลื่อนดูทุกหมวดยิ่งดี) แล้วรัน
-- ผล: inventory_report.txt ในโฟลเดอร์ workspace (อ่านอย่างเดียว ไม่แตะอะไรในเกม ไม่ส่งข้อมูลไปไหน)
print(">> Fleet scan_inventory เริ่มทำงาน...")
local Players = game:GetService("Players")
local RS = game:GetService("ReplicatedStorage")
local player = Players.LocalPlayer
local L = {}
local function add(s) if #L < 4000 then table.insert(L, s) end end
local function val(o) local ok, x = pcall(function() return o.Value end) return ok and tostring(x) or "?" end
local function attrs(o)
    local t = {}
    pcall(function() for k, a in pairs(o:GetAttributes()) do table.insert(t, k .. "=" .. tostring(a)) end end)
    for _, c in ipairs(o:GetChildren()) do if c:IsA("ValueBase") then table.insert(t, c.Name .. "=" .. val(c)) end end
    return table.concat(t, " "):sub(1, 220)
end
add("place=" .. game.PlaceId .. " user=" .. player.Name .. " time=" .. os.time())

local data = RS:FindFirstChild("Player_Service") and RS.Player_Service:FindFirstChild("Data")
data = data and data:FindFirstChild(player.Name)
local slots = data and data:FindFirstChild("slots")
local idx = data and data:FindFirstChild("slotEquipped")
local slot = slots and (slots:FindFirstChild("Slot" .. tostring(idx and idx.Value or 1)) or slots:FindFirstChildOfClass("Folder"))

-- 1) กระเป๋าของตัวละคร (slots.SlotN.Inventory.Inventory)
pcall(function()
    local inv = slot and slot:FindFirstChild("Inventory")
    inv = inv and inv:FindFirstChild("Inventory")
    add("\n== 1. กระเป๋าตัวละคร (" .. (inv and #inv:GetChildren() or 0) .. " ชิ้น) ==")
    for _, it in ipairs(inv and inv:GetChildren() or {}) do add("  " .. it.Name .. "  " .. attrs(it)) end
end)

-- 2) ของทั้งบัญชี: ทุกอย่างในข้อมูลผู้เล่นที่อยู่นอก slots (Account Wide มักเก็บระดับบัญชี)
pcall(function()
    add("\n== 2. ข้อมูลระดับบัญชี (นอก slots) ==")
    for _, c in ipairs(data and data:GetChildren() or {}) do
        if c.Name ~= "slots" then
            add("  [" .. c.ClassName .. "] " .. c.Name .. (c:IsA("ValueBase") and (" = " .. val(c)) or ("  (" .. #c:GetChildren() .. ")")) .. "  " .. attrs(c))
            for i, d in ipairs(c:GetChildren()) do
                if i > 120 then add("    ...") break end
                add("    " .. d.Name .. (d:IsA("ValueBase") and (" = " .. val(d)) or "") .. "  " .. attrs(d))
            end
        end
    end
end)

-- 3) ทุกค่าที่ชื่อมีคำว่า token / currency / ouwigahara ทั้งในข้อมูลผู้เล่น
pcall(function()
    add("\n== 3. ค่าที่น่าจะเป็นเหรียญ/โทเคน ==")
    local n = 0
    for _, o in ipairs(data and data:GetDescendants() or {}) do
        local nm = o.Name:lower()
        if n < 150 and (nm:find("token") or nm:find("currenc") or nm:find("ouwi") or nm:find("series")) then
            add("  " .. o:GetFullName():gsub("^.-Data%.[^%.]+%.", "") .. (o:IsA("ValueBase") and (" = " .. val(o)) or "") .. "  " .. attrs(o)); n = n + 1
        end
    end
end)

-- 4) หน้ากระเป๋าบนจอ: ชื่อ จำนวน และป้ายรายละเอียด (Mythic / Account Wide / คำอธิบาย)
pcall(function()
    add("\n== 4. หน้ากระเป๋าบนจอ ==")
    local n = 0
    for _, o in ipairs(player.PlayerGui:GetDescendants()) do
        if n >= 600 then break end
        if (o:IsA("TextLabel") or o:IsA("TextButton")) and o.Text ~= "" then
            local path = o:GetFullName():gsub("^.-PlayerGui%.", "")
            local pl = path:lower()
            if pl:find("inventory") or pl:find("backpack") or pl:find("actualholder") or pl:find("tooltip") or pl:find("description") or pl:find("itemname") or pl:find("rarity") then
                add("  " .. path .. "  ->  " .. o.Text:gsub("<[^>]->", ""):gsub("\n", " "):sub(1, 160)); n = n + 1
            end
        end
    end
end)

local text = table.concat(L, "\n")
if writefile then pcall(writefile, "inventory_report.txt", text) end
print(">> เสร็จ: บันทึก inventory_report.txt แล้ว (" .. #L .. " บรรทัด) ส่งไฟล์นี้ให้ผู้ดูแล")
