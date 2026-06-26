-- Extensões necessárias para o HIDROBR GISTM Manager
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Mensagem de confirmação
DO $$ BEGIN
  RAISE NOTICE 'HIDROBR GISTM — Banco inicializado com extensões uuid-ossp e pgcrypto';
END $$;
