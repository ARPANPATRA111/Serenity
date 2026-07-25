# Serenity Data Privacy And Retention Plan

Status: planning groundwork only. This is not legal advice and does not claim compliance.

## Current Data Classes

| Data Class | Examples | Current Handling |
| --- | --- | --- |
| Account data | Email, display name, Firebase UID | Stored in user records |
| Template data | Template name, canvas JSON, thumbnails | User-owned private data unless public |
| Certificate data | Recipient name, recipient email, metadata, image URL | Stored in certificates collection |
| Spreadsheet row data | Imported row metadata | Stored in certificate `metadata` |
| Media data | Uploaded images and metadata | User-owned media records/blob paths |
| Email logs | Recipient, certificate ID, provider message ID | Stored for delivery tracking |
| Verification visitors | Daily hashed IP, view count | Stored under certificate visitors |

## Existing Privacy Improvements

- Public verification responses are privacy-reduced.
- Private APIs require authenticated Firebase ID tokens.
- Public templates should not expose owner identifiers.
- SVG and GIF uploads are blocked to reduce active-content risk.
- Daily IP hashing is used for verification view counting.

## Required Data Rights Workflows

1. Export my data
   - User profile.
   - Templates.
   - Certificates.
   - Media metadata and blob links.
   - Email logs associated with the user.

2. Delete my data
   - Soft delete account first.
   - Remove or anonymize templates, certificates, media, and email logs according to retention rules.
   - Delete blob storage objects where safe.
   - Keep minimal audit records if legally required.

3. Correct my data
   - Profile name updates already exist.
   - Email changes should use Firebase Auth-supported flows.
   - Certificate corrections should create explicit replacement records rather than silently rewriting public verification history.

## Retention Draft

| Data | Draft Retention |
| --- | --- |
| Autosave drafts | 30 days after last save |
| Private templates | Until user deletes or account deletion completes |
| Certificates | Until user deletes or retention request completes |
| Email logs | 90 to 180 days, pending legal review |
| Verification visitor hashes | 7 to 30 days |
| Admin audit logs | 1 year minimum, pending legal review |

## Production Blockers

- No reviewed privacy policy copy.
- No reviewed terms of service copy.
- No automated export workflow.
- No complete deletion/anonymization workflow.
- No retention job or scheduled cleanup.
- No admin identity-proofing workflow for privacy requests.

## Staging Checklist

- Confirm public verification does not return recipient email, metadata, spreadsheet rows, owner IDs, or template IDs.
- Confirm public templates do not return owner identifiers.
- Confirm private certificate history is only visible to the owner.
- Confirm soft-deleted users cannot continue normal app actions.
- Confirm media deletion removes the user-owned Firestore record and handles missing blob files safely.
