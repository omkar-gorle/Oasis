# Oasis — Engineering Fix Report

## Changes made in this revision

- Enforced owner/shared-user authorization for file lookup, folder listing, previews, downloads, moves, copies, rename, trash, restore, deletion and sharing.
- Added inherited read access for descendants of a shared folder; inherited access does not grant write/delete rights.
- Scoped search results to the signed-in user and directly shared files.
- Validated destination folders and blocked moving a folder into itself/its descendants.
- Prevented root-folder rename, move-to-trash and permanent deletion.
- Fixed file-copy behavior so copies receive independent content objects instead of pointing at the original file's disk path.
- Added a 100 MB upload limit and a supported MIME allowlist.
- Added safer download/preview headers and constrained local file paths to the configured storage directory.
- Fixed Mongoose async save hooks that could leave registration or file creation waiting indefinitely.
- Fixed new-user root-folder creation (the prior code passed `owner_id` instead of `owner`).
- Fixed upload queue recovery after a failed upload.
- Added optional AWS S3 storage (`STORAGE_DRIVER=s3`) for uploads, preview/download, file copy, folder archive streams and deletion. Local disk remains the default.
- Added persistent Docker volumes for local uploads/thumbnails and corrected Compose/Vite proxy configuration.

## Verification performed

- `node --check` passed for every backend JavaScript source file.
- `node --check` passed for `frontend/vite.config.js`.
- `backend/package.json` and `backend/package-lock.json` parsed as valid JSON.
- Full npm installation/build and MongoDB integration tests were not run: the environment had no cached npm package for `zip-stream`, and registry access was unavailable.
- S3 integration is implemented but has not been tested against a live AWS account.

## Remaining production-hardening work

- Add automated integration tests for two-user access control, folder sharing inheritance, upload/download, trash and restore.
- Add file-signature inspection and malware scanning; MIME types are supplied by clients and are not proof of file contents.
- Add rate limiting, request logging, security headers, CSRF protection appropriate to the deployment, and stronger cookie/session lifecycle management.
- Review and pin dependency versions, run `npm audit`, and build/test in CI.
- Configure S3 lifecycle/versioning, encryption policy, backup/retention and least-privilege IAM for the target account.
- Verify the original repository's license/permission before publishing this derivative. Retain attribution to Ketan Mane.
