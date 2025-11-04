# Backup and Recovery Plan

## Scope
- Database: MongoDB (local or Atlas)
- Files: Generated artifacts are stored in DB and Google Drive backup (memos)

## Automated Backups (Local MongoDB)
Use the provided scripts. Ensure `mongodump`/`mongorestore` are installed and in PATH.

- Backup (PowerShell):
```bash
pwsh backend/scripts/backup-mongo.ps1 -OutDir ./backups -DbName buksu-memo-system
```

- Restore (PowerShell):
```bash
pwsh backend/scripts/restore-mongo.ps1 -BackupPath ./backups/mongo_backup_buksu-memo-system_YYYYMMDD_HHMMSS -DbName buksu-memo-system
```

- Environment:
  - If `MONGODB_URI` is set, scripts will use it. Otherwise they default to `mongodb://localhost:27017/<DbName>`.

## Atlas Backups (Recommended)
If using MongoDB Atlas, enable automated backups in Atlas. No local scripts required.

## Google Drive Backup (Memos)
Memos are exported to Google Drive for resilient storage. See `docs/GOOGLE_DRIVE_QUICK_SETUP.md` and `docs/HOW_TO_VERIFY_GOOGLE_DRIVE.md`.

## Recovery Procedure (Tested Flow)
1. Provision a clean MongoDB instance (local or Atlas) and set `MONGODB_URI`.
2. Restore the most recent dump using the script above.
3. Start the application and verify:
   - Login works for admin and standard users
   - Memos are visible
   - Google Drive connectivity status (optional)
4. Rotate any leaked credentials as per `docs/SECURITY_ALERT.md`.

## Verification Checklist
- [ ] Backup completes with exit code 0
- [ ] Restore completes with exit code 0
- [ ] Application boots without errors
- [ ] Admin and secretary dashboards load
- [ ] Recent memos available

## Schedule (Suggested)
- Nightly full backup (retain 7 days locally)
- Weekly offsite copy (e.g., cloud storage)

## Notes
- Backups contain sensitive data. Store securely and restrict access.
- Regularly perform recovery drills and document results.


