# -- Local (Windows) backup of the working copy -------------------------------------------------
#   powershell -ExecutionPolicy Bypass -File scripts\backup-local.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\backup-local.ps1 -Dest "D:\backups"
#
# Zips the project WITHOUT node_modules/.next (fast, ~a few MB) and keeps the .env files, which are
# NOT in git. The server backup (scripts/backup-all.sh) is the one that covers the database.
# Pure .NET zipping - no robocopy, no temp copy of the tree.
param(
  [string]$Dest = "$env:USERPROFILE\backups\air-request",
  [int]$KeepDays = 30
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression.FileSystem

$src = Split-Path -Parent $PSScriptRoot           # project root
$stamp = Get-Date -Format "yyyy-MM-dd_HHmm"
New-Item -ItemType Directory -Force -Path $Dest | Out-Null
$zip = Join-Path $Dest "air-request-system_$stamp.zip"

# Folders never worth backing up (rebuildable or huge).
$skip = @('\node_modules\', '\.next\', '\.next.bak\', '\dist\', '\coverage\', '\.git\objects\pack\tmp')

Write-Host "==> Collecting files from $src"
$files = Get-ChildItem -Path $src -Recurse -File -Force | Where-Object {
  $p = $_.FullName
  -not ($skip | Where-Object { $p -like "*$_*" })
}
Write-Host ("    {0} files" -f $files.Count)

Write-Host "==> Zipping -> $zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
$archive = [System.IO.Compression.ZipFile]::Open($zip, 'Create')
try {
  $prefix = $src.TrimEnd('\') + '\'
  foreach ($f in $files) {
    $rel = $f.FullName.Substring($prefix.Length)
    try {
      [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $f.FullName, $rel) | Out-Null
    } catch {
      Write-Host ("    skip (locked): {0}" -f $rel)
    }
  }
} finally { $archive.Dispose() }

# Retention
Get-ChildItem $Dest -Filter "air-request-system_*.zip" |
  Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$KeepDays) } |
  Remove-Item -Force

$size = "{0:N1} MB" -f ((Get-Item $zip).Length / 1MB)
Write-Host "==> Done: $zip ($size)"
Write-Host "    Includes .env / .env.local (secrets) - keep this folder private."
Get-ChildItem $Dest -Filter "air-request-system_*.zip" | Sort-Object LastWriteTime -Descending | Select-Object -First 5 Name, Length, LastWriteTime
