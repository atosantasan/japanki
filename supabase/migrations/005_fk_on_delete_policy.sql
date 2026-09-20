-- Issue #25: Clarify FK ON DELETE behavior for content packs and phrases.
--
-- 001_init.sql created these FKs with unnamed REFERENCES ... ON DELETE CASCADE.
-- PostgreSQL names them {table}_{column}_fkey. This migration replaces CASCADE
-- with RESTRICT so a mistaken pack/phrase DELETE cannot wipe related rows.
--
-- content_packs parents (phrases, quiz_sessions, user_purchases):
--   ON DELETE RESTRICT — retire packs with a logical-delete flag, not DELETE.
-- phrases parents (quiz_session_questions, quiz_attempts):
--   ON DELETE RESTRICT — keep quiz assignment and heart-consumption history.
--
-- TODO (follow-up issue): consider adding content_packs.is_active boolean
-- DEFAULT true for logical retirement of packs. Not added in this migration.

alter table public.phrases
  drop constraint phrases_pack_id_fkey,
  add constraint phrases_pack_id_fkey
    foreign key (pack_id) references public.content_packs(id) on delete restrict;

alter table public.quiz_sessions
  drop constraint quiz_sessions_pack_id_fkey,
  add constraint quiz_sessions_pack_id_fkey
    foreign key (pack_id) references public.content_packs(id) on delete restrict;

alter table public.user_purchases
  drop constraint user_purchases_pack_id_fkey,
  add constraint user_purchases_pack_id_fkey
    foreign key (pack_id) references public.content_packs(id) on delete restrict;

alter table public.quiz_session_questions
  drop constraint quiz_session_questions_phrase_id_fkey,
  add constraint quiz_session_questions_phrase_id_fkey
    foreign key (phrase_id) references public.phrases(id) on delete restrict;

alter table public.quiz_attempts
  drop constraint quiz_attempts_phrase_id_fkey,
  add constraint quiz_attempts_phrase_id_fkey
    foreign key (phrase_id) references public.phrases(id) on delete restrict;
