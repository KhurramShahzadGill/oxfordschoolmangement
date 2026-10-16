# Database backups

Supabase dumps of the live school database. Download them from the Supabase
dashboard: **Project → Download backups → Database backup**.

Keep one a month. Name them as Supabase does, so the date stays visible.

## Never commit these

Every dump holds the school's real records: student names, parent names and
phone numbers, and the auth accounts. This repo is pushed to GitHub and the
built site is public, so a committed dump would hand those records to anyone
who can read either one. `.gitignore` blocks `backups/` and the dump file
extensions; leave those rules in place.

## Restoring one

    gunzip -c backups/<file>.backup.gz | psql "<connection string>"

The dump is a full cluster dump: schema, row-level security policies and data.
Restoring it into an empty project rebuilds the database as it was.

## Checking one is good

    gunzip -c backups/<file>.backup.gz | tail -5

A healthy dump ends with `PostgreSQL database cluster dump complete`. If that
line is missing, the download was cut short, so take it again.
