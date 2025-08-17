# KRR Management System

Sistema completo per la gestione delle raccomandazioni di KRR (Kubernetes Resource Recommender) con interfaccia web, applicazione di patch automatiche, backup e rollback.

## 🎯 Panoramica

Il KRR Management System è una soluzione modulare che permette di:

- **Importare** i risultati JSON di KRR
- **Visualizzare** le raccomandazioni in un'interfaccia web intuitiva
- **Generare** patch Kubernetes per applicare le ottimizzazioni
- **Applicare** le patch con diverse strategie (conservativo, bilanciato, aggressivo)
- **Effettuare backup** automatici prima dell'applicazione
- **Rollback** delle modifiche se necessario
- **Monitorare** lo stato delle applicazioni dopo le modifiche

## 🏗️ Architettura

### Componenti Principali

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React UI      │    │   Node.js API   │    │   PostgreSQL    │
│   (Frontend)    │◄──►│   (Backend)     │◄──►│   (Database)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │ Kubernetes API  │
                       │   (K8s Cluster) │
                       └─────────────────┘
```

### Moduli Backend

- **KRR Parser**: Parsing e validazione JSON di KRR
- **Patch Generator**: Generazione patch YAML per Kubernetes
- **K8s Manager**: Gestione risorse Kubernetes (backup, apply, rollback)
- **Audit System**: Logging e tracking di tutte le operazioni

## 🚀 Quick Start

### Prerequisiti

- Docker e Docker Compose
- Kubectl configurato per il cluster target
- Node.js 18+ (per sviluppo locale)
- PostgreSQL 15+ (per produzione)

### Avvio con Docker Compose

```bash
# Clone del repository
git clone <repository-url>
cd krr-management-system

# Avvio servizi
docker-compose up -d

# Verifica stato
docker-compose ps
```

L'applicazione sarà disponibile su:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Database: localhost:5432

### Deploy su Kubernetes

```bash
# Build delle immagini
./scripts/build.sh --push

# Deploy su K8s
./scripts/deploy.sh

# Per accesso locale tramite port-forward
./scripts/deploy.sh --port-forward
```

## 📊 Utilizzo

### 1. Upload Scansione KRR

1. Esegui KRR sul tuo cluster:
```bash
krr simple -f json --fileoutput results.json
```

2. Carica il file JSON tramite l'interfaccia web:
   - Vai su "Upload Scansione"
   - Trascina il file JSON o usa il browser
   - Compila i metadati (Cluster ID, Prometheus URL)
   - Clicca "Carica Scansione"

### 2. Visualizzazione Raccomandazioni

- **Dashboard**: Overview generale con statistiche
- **Raccomandazioni**: Lista dettagliata con filtri per:
  - Priorità (CRITICAL, HIGH, MEDIUM, LOW)
  - Namespace
  - Tipo di risorsa
  - Percentuale di risparmio

### 3. Applicazione Patch

#### Patch Singole
1. Seleziona raccomandazioni dalla lista
2. Clicca "Genera Patch"
3. Scegli la strategia:
   - **Conservativo**: Solo riduzioni >20%
   - **Bilanciato**: Riduzioni >10% con aumenti limitati
   - **Aggressivo**: Applica tutte le raccomandazioni
4. Anteprima delle patch generate
5. Applica con "Dry Run" per test o direttamente

#### Patch Cumulative
- Raggruppa più container della stessa risorsa
- Applica modifiche in batch per ridurre interruzioni
- Gestione automatica dei rollback

### 4. Backup e Rollback

- **Backup automatico**: Creato prima di ogni applicazione
- **Verifica integrità**: Checksum per validare i backup
- **Rollback selettivo**: Per singole patch o interi batch
- **Monitoraggio**: Tracking dello stato post-applicazione

## 🔧 Configurazione

### Variabili d'Ambiente

#### Backend
```env
NODE_ENV=production
DATABASE_URL=postgres://user:pass@host:5432/db
CLUSTER_ID=production-cluster
LOG_LEVEL=info
CORS_ORIGIN=https://your-domain.com
```

#### Frontend
```env
REACT_APP_API_URL=https://api.your-domain.com
```

### Database

Il sistema utilizza PostgreSQL con schema ottimizzato per:
- **Scansioni**: Metadati e risultati raw di KRR
- **Raccomandazioni**: Dati strutturati per l'UI
- **Patch**: Storia delle applicazioni
- **Backup**: Copie di sicurezza delle risorse
- **Audit Log**: Tracciamento completo delle operazioni

### Strategie di Patch

#### Conservativo (Raccomandato per produzione)
- Applica solo riduzioni significative (>20%)
- Aumenti limitati al 10%
- Preserva i limits delle risorse
- Riduce il rischio di instabilità

#### Bilanciato
- Riduzioni moderate (>10%)
- Aumenti fino al 25%
- Bilanciamento risparmi/stabilità

#### Aggressivo
- Applica tutte le raccomandazioni
- Massimizza i risparmi
- Raccomandato solo per ambienti di test

## 🔒 Sicurezza

### RBAC Kubernetes

Il sistema richiede permessi per:
- **Lettura**: deployments, statefulsets, daemonsets, jobs, cronjobs
- **Aggiornamento**: Per applicare le patch
- **Namespace**: Lista e lettura

### Audit e Compliance

- Logging completo di tutte le operazioni
- Tracciabilità degli utenti e delle modifiche
- Backup verificabili con checksum
- Rollback garantito per ogni modifica

## 📈 Monitoraggio

### Health Checks

- **Backend**: `GET /api/health`
- **Database**: Connessione PostgreSQL
- **K8s**: Verifica accesso al cluster

### Metriche

- Numero di raccomandazioni per priorità
- Risparmi potenziali (CPU/Memory)
- Successo/fallimento delle applicazioni
- Tempo di esecuzione delle operazioni

### Logging

Strutturato con livelli:
- **INFO**: Operazioni normali
- **WARN**: Situazioni anomale non critiche  
- **ERROR**: Errori che richiedono attenzione
- **DEBUG**: Dettagli per troubleshooting

## 🔧 Sviluppo

### Setup Locale

```bash
# Backend
cd backend
npm install
npm run dev

# Frontend
cd frontend
npm install
npm start

# Database (con Docker)
docker run -d \
  --name postgres-krr \
  -e POSTGRES_DB=krr_management \
  -e POSTGRES_USER=krr_user \
  -e POSTGRES_PASSWORD=krr_password \
  -p 5432:5432 \
  postgres:15-alpine
```

### Testing

```bash
# Backend unit tests
cd backend
npm test

# Integration tests
npm run test:integration

# Frontend tests
cd frontend
npm test
```

### API Documentation

L'API segue i principi REST con endpoint:

- `GET /api/scans` - Lista scansioni
- `POST /api/scans/upload` - Upload nuovo scan
- `GET /api/recommendations` - Lista raccomandazioni
- `POST /api/patches/generate` - Genera patch
- `POST /api/patches/apply` - Applica patch
- `POST /api/patches/:id/rollback` - Rollback patch

Documentazione completa disponibile su `/api/docs` (Swagger).

## 🛠️ Troubleshooting

### Problemi Comuni

#### Connection refused al database
```bash
# Verifica stato PostgreSQL
docker-compose logs postgres

# Reset database
docker-compose down -v
docker-compose up -d postgres
```

#### Errori di permessi K8s
```bash
# Verifica RBAC
kubectl auth can-i get deployments --as=system:serviceaccount:krr-management:krr-management-backend

# Applica RBAC
kubectl apply -f kubernetes/rbac.yaml
```

#### Patch fallisce
- Verifica che la risorsa esista ancora
- Controlla che non ci siano conflitti di resourceVersion
- Usa dry-run per testare prima dell'applicazione

### Log Analysis

```bash
# Backend logs
docker-compose logs -f backend

# K8s logs
kubectl logs -f deployment/krr-management-backend -n krr-management

# Database logs per query lente
docker-compose exec postgres tail -f /var/log/postgresql/postgresql.log
```

## 🔄 Backup e Disaster Recovery

### Backup Database

```bash
# Backup automatico giornaliero
docker-compose exec postgres pg_dump -U krr_user krr_management > backup_$(date +%Y%m%d).sql

# Restore
docker-compose exec -T postgres psql -U krr_user krr_management < backup_20240101.sql
```

### Backup Configurazione K8s

```bash
# Export configurazione
kubectl get all,ingress,secrets,configmaps -n krr-management -o yaml > krr-management-backup.yaml

# Restore
kubectl apply -f krr-management-backup.yaml
```

## 📋 Roadmap

### Versione 1.1
- [ ] Integrazione notifiche Slack/Teams
- [ ] Scheduling automatico scansioni
- [ ] Dashboard metriche avanzate
- [ ] Export report PDF

### Versione 1.2  
- [ ] Supporto multi-cluster
- [ ] Machine Learning per raccomandazioni custom
- [ ] Integrazione GitOps (ArgoCD/Flux)
- [ ] API per automazione CI/CD

### Versione 2.0
- [ ] Supporto risorse custom (GPU, storage)
- [ ] Ottimizzazione costi cloud
- [ ] Governance e policy compliance
- [ ] Multi-tenancy

## 🤝 Contributi

1. Fork del repository
2. Crea feature branch (`git checkout -b feature/amazing-feature`)
3. Commit delle modifiche (`git commit -m 'Add amazing feature'`)
4. Push al branch (`git push origin feature/amazing-feature`)
5. Apri Pull Request

### Guidelines

- Segui le convenzioni di naming esistenti
- Aggiungi test per nuove funzionalità
- Aggiorna la documentazione
- Rispetta il linting e formattazione

## 📄 Licenza

Questo progetto è rilasciato sotto licenza MIT. Vedi `LICENSE` per dettagli.

## 🆘 Supporto

- **Issues**: Usa GitHub Issues per bug e richieste
- **Discussions**: Per domande generali e discussioni
- **Security**: Invia email a security@your-domain.com per vulnerabilità

---

**Made with ❤️ for Kubernetes optimization**