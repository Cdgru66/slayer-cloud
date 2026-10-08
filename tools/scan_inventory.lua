-- สแกน Inventory ทั้งหมดของตัวละคร (ใช้ครั้งเดียว ไม่ส่งข้อมูลไปไหน)
-- ไม่ต้องเปิดหน้า Inventory ก็ได้ อ่านจากข้อมูลเกมโดยตรง
-- ผลจะก๊อปลงคลิปบอร์ด + เซฟเป็น inventory_report.txt ในโฟลเดอร์ workspace
local Players = game:GetService("Players")
local RS = game:GetService("ReplicatedStorage")
local player = Players.LocalPlayer
local out = {}
local function add(s) table.insert(out, s) end
local function fmt(n)
    local s = tostring(math.floor(n))
    return (s:reverse():gsub("(%d%d%d)", "%1,"):reverse():gsub("^,", ""))
end

local data = RS:FindFirstChild("Player_Service") and RS.Player_Service:FindFirstChild("Data")
data = data and data:FindFirstChild(player.Name)
if not data then
    add("ไม่เจอข้อมูลผู้เล่น (ReplicatedStorage.Player_Service.Data." .. player.Name .. ")")
else
    local idxObj = data:FindFirstChild("slotEquipped")
    local slots = data:FindFirstChild("slots")
    local slot = slots and (slots:FindFirstChild("Slot" .. tostring(idxObj and idxObj.Value or 1)) or slots:FindFirstChildOfClass("Folder"))
    local invF = slot and slot:FindFirstChild("Inventory")
    local inv = invF and invF:FindFirstChild("Inventory")
    add("ไอดี: " .. player.Name .. "   ช่องตัวละคร: Slot" .. tostring(idxObj and idxObj.Value or 1))

    if inv then
        -- รวมของชื่อเดียวกัน: ของซ้อนได้ใช้ Amount / ของซ้อนไม่ได้ (อาวุธ ชุด) นับเป็นชิ้น
        local items, order = {}, {}
        for _, it in ipairs(inv:GetChildren()) do
            local amt = it:FindFirstChild("Amount")
            local n = (amt and amt:IsA("ValueBase") and tonumber(amt.Value)) or 1
            local e = items[it.Name]
            if not e then
                e = { name = it.Name, total = 0, pieces = 0, stack = false, fields = {} }
                items[it.Name] = e
                table.insert(order, e)
                for _, c in ipairs(it:GetChildren()) do
                    if c.Name ~= "Amount" and c.Name ~= "Id" then
                        table.insert(e.fields, c.Name .. (c:IsA("ValueBase") and ("=" .. tostring(c.Value)) or ""))
                    end
                end
            end
            e.total = e.total + n
            e.pieces = e.pieces + 1
            if amt then e.stack = true end
        end
        table.sort(order, function(a, b)
            if a.stack ~= b.stack then return a.stack end
            if a.total ~= b.total then return a.total > b.total end
            return a.name < b.name
        end)
        add("\n== ของในกระเป๋า: " .. #order .. " ชนิด ==")
        add("(S = ของซ้อนได้ / I = ของชิ้นเดี่ยว เช่น อาวุธ ชุด)")
        for _, e in ipairs(order) do
            local extra = #e.fields > 0 and ("   [" .. table.concat(e.fields, ", "):sub(1, 70) .. "]") or ""
            add(string.format("%s  %-34s x%s", e.stack and "S" or "I", e.name, fmt(e.total)) .. extra)
        end
    else
        add("ไม่เจอ Inventory ในข้อมูล")
    end

    -- ของที่ใส่อยู่
    local function listFolder(title, f)
        if not f then return end
        add("\n== " .. title .. " ==")
        local any = false
        for _, c in ipairs(f:GetChildren()) do
            any = true
            local v = c:IsA("ValueBase") and (" = " .. tostring(c.Value)) or ""
            add("  " .. c.Name .. v)
            for _, cc in ipairs(c:GetChildren()) do
                if cc:IsA("ValueBase") then add("      " .. cc.Name .. " = " .. tostring(cc.Value)) end
            end
        end
        if not any then add("  (ว่าง)") end
    end
    listFolder("แถบเครื่องมือ (Toolbar)", invF and invF:FindFirstChild("Toolbar"))
    listFolder("เครื่องประดับที่ใส่ (Accessories)", invF and invF:FindFirstChild("Accessories"))
end

local text = table.concat(out, "\n")
print(text)
if writefile then pcall(writefile, "inventory_report.txt", text) end
if setclipboard then setclipboard(text); print(">> ก๊อปลงคลิปบอร์ดแล้ว วางในแชทได้เลย (หรือส่งไฟล์ inventory_report.txt)") end
