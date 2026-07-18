# MILES Smart Recovery Platform - Architecture

## 🏗️ System Architecture

### High-Level Overview
```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                         │
│  ┌────────┐ ┌──────────┐ ┌────────┐ ┌────────┐ ┌────────────┐  │
│  │Dashboard│ │ Clients  │ │Impayés │ │Alertes │ │Storytelling│ │
│  └────────┘ └──────────┘ └────────┘ └────────┘ └────────────┘  │
│                      ↓                                            │
│           ┌─────────────────────────┐                            │
│           │  API Client Service     │                            │
│           │  (Centralized Calls)    │                            │
│           └─────────────────────────┘                            │
└─────────────────────────────────────────────────────────────────┘
                            ↓ HTTP/REST
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND (Node.js)                           │
│  ┌────────┐ ┌──────────┐ ┌────────┐ ┌────────┐ ┌────────────┐  │
│  │ Health │ │Dashboard │ │Clients │ │Impayés │ │  Alertes   │  │
│  │ Routes │ │ Routes   │ │ Routes │ │ Routes │ │  Routes    │  │
│  └────────┘ └──────────┘ └────────┘ └────────┘ └────────────┘  │
│                      ↓                                            │
│           ┌─────────────────────────┐                            │
│           │  Database Connection    │                            │
│           │  (Connection Pool)      │                            │
│           └─────────────────────────┘                            │
└─────────────────────────────────────────────────────────────────┘
                            ↓ PostgreSQL
┌─────────────────────────────────────────────────────────────────┐
│                    DATA WAREHOUSE                                │
│  ┌─────────────┐ ┌──────────────┐ ┌──────────┐ ┌──────────┐    │
│  │fact_impayes │ │ dim_client   │ │dim_risque│ │dim_temps │    │
│  └─────────────┘ └──────────────┘ └──────────┘ └──────────┘    │
│                                                                   │
│         (Prepared by Talend ETL, analysed in Power BI)           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📂 Frontend Architecture

### Component Hierarchy
```
App (Router)
├── Navbar
│   ├── Logo
│   └── Navigation Links
├── Routes
│   ├── Dashboard
│   │   ├── KPICard (x4)
│   │   ├── AlertCard (x6)
│   │   └── Storytelling Panel
│   ├── Clients
│   │   ├── Search Bar
│   │   └── Clients Table
│   ├── Impayes
│   │   ├── Filter Bar
│   │   └── Impayes Table
│   ├── Alertes
│   │   ├── Risk Filter
│   │   └── Alert Cards Grid
│   ├── Storytelling
│   │   ├── Input Section
│   │   └── Narrative Panel
│   └── Predictions
│       ├── Roadmap
│       └── Tech Stack
```

### State Management
```javascript
// Component-level state
const [data, setData] = useState(null);
const [loading, setLoading] = useState(false);
const [error, setError] = useState("");

// No global state manager (kept simple for this phase)
// Ready for Redux/Context API expansion
```

### Data Flow
```
User Interaction
    ↓
Component Handler
    ↓
API Call (apiClient.js)
    ↓
HTTP Request → Backend
    ↓
Backend Processing
    ↓
Database Query
    ↓
Response (JSON)
    ↓
Update Component State
    ↓
Re-render UI
```

---

## 🔌 Backend Architecture

### Route Organization
```
/api
├── /health
│   ├── GET / (backend status)
│   └── GET /db (database status)
├── /dashboard
│   └── GET / (KPI metrics)
├── /clients
│   ├── GET / (list with pagination)
│   └── GET /:id (single client)
├── /impayes
│   └── GET / (list with pagination)
├── /alertes
│   └── GET / (priority sorted alerts)
└── /storytelling
    ├── GET / (global narrative)
    └── GET /:clientName (per-client narrative)
```

### Middleware Stack
```
Express App
    ↓
CORS Middleware
    ↓
JSON Parser
    ↓
Route Matching
    ↓
Route Handler
    ↓
Database Pool Query
    ↓
Response Formatting
    ↓
Error Handling
    ↓
HTTP Response
```

### Database Connection Pattern
```javascript
// Connection Pool (efficient for multiple requests)
const pool = new Pool({
  max: 20,                    // Max connections
  idleTimeoutMillis: 30000,   // Timeout
  connectionTimeoutMillis: 2000,
});

// Query execution
const result = await pool.query(SQL, [params]);
```

---

## 🗄️ Database Schema

### Tables and Relationships
```
fact_impayes (Facts)
├── impaye_id (PK)
├── client_id (FK → dim_client)
├── risque_id (FK → dim_risque)
├── montant_impaye
├── statut_paiement
└── date_impaye

dim_client (Dimension)
├── customer_id (PK)
├── nom_client
├── secteur_activite
└── region

dim_risque (Dimension)
├── risque_id (PK)
├── niveau_risque (CRITIQUE, ÉLEVÉ, MOYEN, BAS)
└── description

dim_temps (Dimension - future use)
├── date_id (PK)
├── annee
├── mois
└── jour

dim_contrat (Dimension)
├── contrat_id (PK)
├── numero_contrat
├── client_id
└── montant_contrat

dim_devise (Dimension)
├── devise_id (PK)
├── code
└── nom
```

### Query Patterns
```sql
-- JOIN pattern
SELECT f.*, c.nom_client, r.niveau_risque
FROM fact_impayes f
LEFT JOIN dim_client c ON f.client_id = c.customer_id
LEFT JOIN dim_risque r ON f.risque_id = r.risque_id

-- Aggregation pattern
SELECT 
  SUM(montant_impaye) as total,
  COUNT(*) as count,
  AVG(montant_impaye) as average
FROM fact_impayes

-- Filtering by risk
WHERE r.niveau_risque IN ('CRITIQUE', 'ÉLEVÉ')
ORDER BY f.montant_impaye DESC
```

---

## 🔐 Security Considerations

### CORS Configuration
```javascript
app.use(cors());  // Allow frontend requests
// In production: specify allowed origins
```

### SQL Injection Prevention
```javascript
// ✅ SAFE: Parameterized queries
pool.query("SELECT * FROM table WHERE id = $1", [id]);

// ❌ UNSAFE: String concatenation
pool.query(`SELECT * FROM table WHERE id = ${id}`);
```

### Environment Variables
```javascript
// ✅ Use .env for sensitive data
require("dotenv").config();
const password = process.env.DB_PASSWORD;

// ❌ Never hardcode credentials
```

### Error Handling
```javascript
// Don't expose internal errors in production
res.status(500).json({
  status: "error",
  message: "An error occurred",
  // Don't send: error: error.message in prod
});
```

---

## 📈 Scalability Roadmap

### Phase 1 (Current)
- ✅ Monolithic architecture
- ✅ Direct database queries
- ✅ Component-level state

### Phase 2 (Q3 2026)
- [ ] Global state management (Redux)
- [ ] Service layer abstraction
- [ ] Caching layer (Redis)
- [ ] Request logging

### Phase 3 (Q4 2026)
- [ ] Microservices split
- [ ] GraphQL API option
- [ ] Real-time WebSocket updates
- [ ] Advanced authentication

### Phase 4 (Q1 2027)
- [ ] ML/AI predictions module
- [ ] Advanced analytics dashboard
- [ ] Mobile native apps (React Native)
- [ ] API versioning strategy

---

## 🔄 Data Flow Examples

### Dashboard Load
```
1. User visits "/" → Dashboard component mounts
2. useEffect runs → calls apiClient.getDashboard()
3. Three parallel queries:
   - SELECT SUM(montant_impaye) FROM fact_impayes
   - SELECT COUNT(*) FROM fact_impayes
   - SELECT COUNT(DISTINCT client_id) FROM fact_impayes
4. Backend aggregates results → returns JSON
5. Component setState with data
6. UI re-renders with KPI cards
```

### Alert Generation
```
1. User visits "/alertes"
2. Component calls apiClient.getAlertes()
3. Backend query:
   SELECT f.* JOIN dim_client, dim_risque
   ORDER BY risk_level, amount DESC
   LIMIT 10
4. Response sorted by risk priority
5. Frontend displays AlertCards with color coding
```

### Storytelling Generation
```
1. User inputs client name and clicks "Generate"
2. Frontend calls apiClient.getClientStorytelling(name)
3. Backend query:
   SELECT client_name, COUNT(*), SUM(amount), MAX(risk)
   WHERE nom_client = $1
4. Backend formats narrative string with template
5. Returns story + metrics to frontend
6. Displays in styled narrative panel
```

---

## 🧪 Testing Strategy

### Unit Tests (Future)
- API response formatting
- Formatter functions
- Component rendering

### Integration Tests (Future)
- API endpoint → Database flow
- Frontend → Backend communication
- Error handling chains

### E2E Tests (Future)
- User workflows (login → dashboard → export)
- Data validation end-to-end
- Performance benchmarks

### Manual Testing (Current Phase)
- API endpoints with curl/Postman
- Component interactions in browser
- Database query validation

---

## 📊 Performance Optimization

### Frontend
- Code splitting (lazy routes)
- Image optimization
- Bundle minification
- Memoization (React.memo)

### Backend
- Connection pooling (20 max connections)
- Query optimization with indexes
- Caching strategies
- Response compression

### Database
- Indexes on foreign keys
- Materialized views for complex queries
- Partition large tables
- Archive old data

---

## 🚀 Deployment Architecture

### Development
```
localhost:3000 → localhost:5000 → PostgreSQL:5432
```

### Production
```
CDN (Frontend) → Load Balancer
                    ↓
            API Gateway (Backend)
                    ↓
            Database Cluster (PostgreSQL)
```

### CI/CD Pipeline (Future)
```
Git Push
  ↓
GitHub Actions
  ↓
Tests + Build
  ↓
Docker Image
  ↓
Deploy to Server
  ↓
Health Check
```

---

## 📞 Architecture Decision Records

### Why React + Vite?
- Fast development experience
- Modern tooling and ecosystem
- Easy component reusability
- Strong community support

### Why Express.js?
- Lightweight and flexible
- Minimal learning curve
- Excellent middleware ecosystem
- Perfect for REST APIs

### Why PostgreSQL?
- Open-source and robust
- Excellent data warehouse capabilities
- ACID transactions
- JSON support for future extensibility

### Why CSS-in-JS?
- Keeps styles colocalized with components
- Dynamic styling capabilities
- No CSS file management overhead
- Ideal for this application size

---

**Architecture Version**: 1.0  
**Last Updated**: May 2026  
**Status**: Production Ready ✅
