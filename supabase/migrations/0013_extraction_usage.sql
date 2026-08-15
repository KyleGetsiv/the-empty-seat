-- 0013_extraction_usage.sql
-- Phase 4, module 4.4: per-event extraction accounting. Token counts are
-- what the pipeline actually consumed for the event (summed over chunks);
-- chunk and drop counts make the "0 mentions" case auditable (was the
-- document read at all, and did the model return quotes that failed
-- verbatim verification).

alter table earnings_events
  add column extraction_input_tokens  int,
  add column extraction_output_tokens int,
  add column extraction_chunks        int,
  add column mentions_dropped         int;
