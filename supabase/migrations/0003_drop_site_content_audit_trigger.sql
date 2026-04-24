-- Module 1.1 fix: site_content uses key (text) as PK, not a UUID id column.
-- audit_trigger_fn() references NEW.id, which does not exist on this table.
-- Auditing is not needed for this two-row config table; updated_at tracks changes.

drop trigger if exists trg_site_content_audit on public.site_content;
