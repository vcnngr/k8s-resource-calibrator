-- database/init.sql
-- Schema iniziale per KRR Management System

-- Estensioni PostgreSQL
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enum per stati delle operazioni
DO $$ BEGIN
    CREATE TYPE scan_status AS ENUM ('pending', 'processing', 'completed', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE recommendation_priority AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE patch_status AS ENUM ('pending', 'applied', 'failed', 'rolled_back');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE resource_type AS ENUM ('Deployment', 'StatefulSet', 'DaemonSet', 'Job', 'CronJob');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Tabella scansioni KRR
CREATE TABLE IF NOT EXISTS scans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cluster_id VARCHAR(255) NOT NULL,
    scan_id VARCHAR(255) UNIQUE NOT NULL,
    scan_date TIMESTAMP WITH TIME ZONE NOT NULL,
    scan_status scan_status DEFAULT 'pending',
    prometheus_url TEXT,
    raw_data JSONB NOT NULL,
    metadata JSONB DEFAULT '{}',
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabella raccomandazioni
CREATE TABLE IF NOT EXISTS recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scan_id UUID REFERENCES scans(id) ON DELETE CASCADE,
    cluster_id VARCHAR(255) NOT NULL,
    namespace VARCHAR(255) NOT NULL,
    resource_name VARCHAR(255) NOT NULL,
    resource_type resource_type NOT NULL,
    container_name VARCHAR(255) NOT NULL,
    priority recommendation_priority NOT NULL,
    
    -- Risorse CPU attuali e raccomandate (in millicores)
    current_cpu_request INTEGER,
    recommended_cpu_request INTEGER,
    current_cpu_limit INTEGER,
    recommended_cpu_limit INTEGER,
    
    -- Risorse memoria attuali e raccomandate (in bytes)
    current_memory_request BIGINT,
    recommended_memory_request BIGINT,
    current_memory_limit BIGINT,
    recommended_memory_limit BIGINT,
    
    -- Statistiche aggiuntive
    pods_count INTEGER DEFAULT 1,
    cpu_savings_percentage DECIMAL(5,2),
    memory_savings_percentage DECIMAL(5,2),
    estimated_cost_savings DECIMAL(10,2),
    
    -- Metadati
    labels JSONB DEFAULT '{}',
    annotations JSONB DEFAULT '{}',
    additional_data JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraint unico
    UNIQUE(scan_id, namespace, resource_name, container_name)
);

-- Tabella backup delle risorse K8s
CREATE TABLE IF NOT EXISTS resource_backups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cluster_id VARCHAR(255) NOT NULL,
    namespace VARCHAR(255) NOT NULL,
    resource_name VARCHAR(255) NOT NULL,
    resource_type resource_type NOT NULL,
    backup_data JSONB NOT NULL,
    checksum VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indice per lookup veloce
    UNIQUE(cluster_id, namespace, resource_name, resource_type, created_at)
);

-- Tabella patch applicate
CREATE TABLE IF NOT EXISTS patches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recommendation_id UUID REFERENCES recommendations(id) ON DELETE CASCADE,
    backup_id UUID REFERENCES resource_backups(id),
    
    -- Identificazione risorsa
    cluster_id VARCHAR(255) NOT NULL,
    namespace VARCHAR(255) NOT NULL,
    resource_name VARCHAR(255) NOT NULL,
    resource_type resource_type NOT NULL,
    container_name VARCHAR(255) NOT NULL,
    
    -- Dati patch
    patch_data JSONB NOT NULL,
    status patch_status DEFAULT 'pending',
    is_cumulative BOOLEAN DEFAULT FALSE,
    batch_id UUID,
    
    -- Tracking applicazione
    applied_at TIMESTAMP WITH TIME ZONE,
    applied_by VARCHAR(255),
    rollback_data JSONB,
    
    -- Risultati
    success BOOLEAN,
    error_message TEXT,
    k8s_response JSONB,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabella audit log
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    user_id VARCHAR(255),
    cluster_id VARCHAR(255),
    namespace VARCHAR(255),
    
    -- Dati azione
    action_data JSONB DEFAULT '{}',
    success BOOLEAN NOT NULL,
    error_message TEXT,
    
    -- Timing
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,
    
    -- Context
    ip_address INET,
    user_agent TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indici per performance (solo se non esistono già)
DO $$ BEGIN
    CREATE INDEX IF NOT EXISTS idx_scans_cluster_status ON scans(cluster_id, scan_status);
    CREATE INDEX IF NOT EXISTS idx_scans_date ON scans(scan_date DESC);
    CREATE INDEX IF NOT EXISTS idx_recommendations_cluster_ns ON recommendations(cluster_id, namespace);
    CREATE INDEX IF NOT EXISTS idx_recommendations_priority ON recommendations(priority);
    CREATE INDEX IF NOT EXISTS idx_recommendations_scan_id ON recommendations(scan_id);
    CREATE INDEX IF NOT EXISTS idx_patches_status ON patches(status);
    CREATE INDEX IF NOT EXISTS idx_patches_cluster_resource ON patches(cluster_id, namespace, resource_name);
    CREATE INDEX IF NOT EXISTS idx_patches_batch_id ON patches(batch_id) WHERE batch_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_backups_cluster_resource ON resource_backups(cluster_id, namespace, resource_name);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_action_date ON audit_logs(action, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
END $$;

-- Trigger per updated_at automatico
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'update_scans_updated_at') THEN
        CREATE TRIGGER update_scans_updated_at BEFORE UPDATE ON scans 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'update_recommendations_updated_at') THEN
        CREATE TRIGGER update_recommendations_updated_at BEFORE UPDATE ON recommendations 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'update_patches_updated_at') THEN
        CREATE TRIGGER update_patches_updated_at BEFORE UPDATE ON patches 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Views per query comuni (drop e ricreare per evitare conflitti)
DROP VIEW IF EXISTS v_latest_recommendations;
CREATE VIEW v_latest_recommendations AS
SELECT 
    r.*,
    s.cluster_id as scan_cluster_id,
    s.scan_date,
    s.scan_status
FROM recommendations r
JOIN scans s ON r.scan_id = s.id
WHERE s.scan_status = 'completed';

DROP VIEW IF EXISTS v_patch_summary;
CREATE VIEW v_patch_summary AS
SELECT 
    cluster_id,
    namespace,
    COUNT(*) as total_patches,
    COUNT(CASE WHEN status = 'applied' THEN 1 END) as applied_patches,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_patches,
    COUNT(CASE WHEN status = 'rolled_back' THEN 1 END) as rolled_back_patches,
    CASE 
        WHEN COUNT(*) = 0 THEN 0
        ELSE ROUND((COUNT(CASE WHEN status = 'applied' THEN 1 END)::DECIMAL / COUNT(*)) * 100, 2)
    END as success_rate
FROM patches
GROUP BY cluster_id, namespace;

-- Funzioni utili
CREATE OR REPLACE FUNCTION calculate_savings_percentage(current_value BIGINT, recommended_value BIGINT)
RETURNS DECIMAL AS $$
BEGIN
    IF current_value = 0 OR current_value IS NULL THEN
        RETURN 0;
    END IF;
    RETURN ROUND(((current_value - recommended_value)::DECIMAL / current_value) * 100, 2);
END;
$$ LANGUAGE plpgsql;

-- Trigger per calcolo automatico percentuali di risparmio
CREATE OR REPLACE FUNCTION calculate_recommendation_savings()
RETURNS TRIGGER AS $$
BEGIN
    NEW.cpu_savings_percentage = calculate_savings_percentage(NEW.current_cpu_request, NEW.recommended_cpu_request);
    NEW.memory_savings_percentage = calculate_savings_percentage(NEW.current_memory_request, NEW.recommended_memory_request);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'trigger_calculate_savings') THEN
        CREATE TRIGGER trigger_calculate_savings BEFORE INSERT OR UPDATE ON recommendations
            FOR EACH ROW EXECUTE FUNCTION calculate_recommendation_savings();
    END IF;
END $$;

-- Constraints aggiuntivi
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'check_valid_status_transition') THEN
        ALTER TABLE patches ADD CONSTRAINT check_valid_status_transition 
            CHECK (
                (status = 'pending') OR
                (status = 'applied' AND applied_at IS NOT NULL) OR
                (status = 'failed' AND error_message IS NOT NULL) OR
                (status = 'rolled_back' AND rollback_data IS NOT NULL)
            );
    END IF;
END $$;

-- Commenti per documentazione
COMMENT ON TABLE scans IS 'Memorizza le scansioni KRR importate nel sistema';
COMMENT ON TABLE recommendations IS 'Raccomandazioni estratte dalle scansioni KRR';
COMMENT ON TABLE resource_backups IS 'Backup delle risorse K8s prima di applicare le patch';
COMMENT ON TABLE patches IS 'Patch applicate alle risorse K8s';
COMMENT ON TABLE audit_logs IS 'Log di audit per tutte le operazioni del sistema';

COMMENT ON COLUMN recommendations.current_cpu_request IS 'CPU request attuale in millicores';
COMMENT ON COLUMN recommendations.recommended_cpu_request IS 'CPU request raccomandato in millicores';
COMMENT ON COLUMN recommendations.current_memory_request IS 'Memory request attuale in bytes';
COMMENT ON COLUMN recommendations.recommended_memory_limit IS 'Memory request raccomandato in bytes';