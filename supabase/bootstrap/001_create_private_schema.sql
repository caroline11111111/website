-- Local-only bootstrap prerequisite.
-- Run this against the LOCAL Supabase database before applying the recovered migrations.
-- Production already has this schema; do not run this file against Production.

CREATE SCHEMA IF NOT EXISTS private AUTHORIZATION postgres;

-- Match the observed Production ACL: only the postgres owner can use/create here.
REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON SCHEMA private FROM anon;
REVOKE ALL ON SCHEMA private FROM authenticated;
