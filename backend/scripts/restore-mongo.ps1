Param(
	[string]$BackupPath,
	[string]$DbName = "buksu-memo-system"
)

if (-not $BackupPath) {
	Write-Error "Usage: .\\restore-mongo.ps1 -BackupPath <path_to_backup_folder> [-DbName <name>]"
	exit 1
}

$mongoUri = $env:MONGODB_URI
if (-not $mongoUri) {
	Write-Host "MONGODB_URI not set. Defaulting to mongodb://localhost:27017/$DbName"
	$mongoUri = "mongodb://localhost:27017/$DbName"
}

Write-Host "Restoring from $BackupPath to $mongoUri"
& mongorestore --uri "$mongoUri" --drop "$BackupPath"

if ($LASTEXITCODE -eq 0) {
	Write-Host "Restore completed successfully"
} else {
	Write-Error "Restore failed with exit code $LASTEXITCODE"
}


