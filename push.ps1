# Quick push helper (Windows) — commit ทุกอย่างแล้ว push ขึ้น gitlab ในคำสั่งเดียว
# ใช้:  .\push.ps1 "ข้อความ commit"
param([Parameter(Mandatory=$false)][string]$m = "update")
git add -A
git commit -m $m
git push gitlab HEAD
