Param(
	[string]$OutDir = "./backups",
	[string]$DbName = "buksu-memo-system"
)

if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir | Out-Null }

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupPath = Join-Path $OutDir "mongo_backup_$($DbName)_$timestamp"

$mongoUri = $env:MONGODB_URI
if (-not $mongoUri) {
	Write-Host "MONGODB_URI not set. Defaulting to mongodb://localhost:27017/$DbName"
	$mongoUri = "mongodb://localhost:27017/$DbName"
}

Write-Host "Starting mongodump to $backupPath"
& mongodump --uri "$mongoUri" --out "$backupPath"

if ($LASTEXITCODE -eq 0) {
	Write-Host "Backup completed: $backupPath"
} else {
	Write-Error "Backup failed with exit code $LASTEXITCODE"
}


