ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE DELETE ON TABLES FROM anon, authenticated, service_role;
