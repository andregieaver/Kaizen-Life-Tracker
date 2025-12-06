# Deployment Checklist

## Pre-Deployment

### Environment Configuration
- [ ] Set `ENVIRONMENT=production` in backend/.env
- [ ] Configure production `MONGO_URL` with authentication
- [ ] Set appropriate `ALLOWED_ORIGINS` for your domain
- [ ] Configure all required API keys (OpenAI, SendGrid, Stripe, etc.)
- [ ] Verify `REACT_APP_BACKEND_URL` points to production API

### Database
- [ ] Run index creation script: `python scripts/create_indexes.py`
- [ ] Verify all 32 indexes are created
- [ ] Enable MongoDB authentication
- [ ] Set up database backups

### Security
- [ ] Verify rate limiting is active (5/min auth, 100/min general)
- [ ] Confirm security headers are present (X-Frame-Options, etc.)
- [ ] Test error handling (errors sanitized in production)
- [ ] Verify HTTPS is configured at load balancer
- [ ] Review CORS origins list

### Performance
- [ ] GZip compression enabled (responses > 500 bytes)
- [ ] TTL cache for system settings active
- [ ] Database connection pooling configured
- [ ] Request timeout set (default 60s)

## Deployment Steps

1. **Build Frontend**
   ```bash
   cd /app/frontend && yarn build
   ```

2. **Verify Backend**
   ```bash
   curl http://localhost:8001/api/health
   curl http://localhost:8001/api/health/ready
   curl http://localhost:8001/api/version
   ```

3. **Run Database Migrations**
   ```bash
   cd /app/backend && python scripts/create_indexes.py
   ```

4. **Start Services**
   ```bash
   supervisorctl restart backend frontend
   ```

## Post-Deployment Verification

### API Health
```bash
# Health check
curl -s https://your-domain.com/api/health | jq

# Version check
curl -s https://your-domain.com/api/version | jq

# Metrics check
curl -s https://your-domain.com/api/metrics | jq
```

### Security Headers
```bash
curl -I https://your-domain.com/api/health | grep -E "x-content-type|x-frame|x-xss"
```

### Rate Limiting
```bash
# Should block after 5 requests
for i in {1..7}; do
  curl -X POST https://your-domain.com/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test","password":"test"}'
done
```

## Monitoring

### Endpoints to Monitor
- `/api/health` - Basic health (should return 200)
- `/api/health/ready` - Readiness with DB check
- `/api/health/live` - Liveness probe
- `/api/metrics` - Basic application metrics

### Log Locations
- Backend: `/var/log/supervisor/backend.err.log`
- Frontend: `/var/log/supervisor/frontend.err.log`

## Rollback Plan

1. Stop services: `supervisorctl stop backend frontend`
2. Restore previous deployment
3. Start services: `supervisorctl start backend frontend`
4. Verify health: `curl https://your-domain.com/api/health`

## Support

- API Documentation: `/api/docs` (Swagger UI)
- ReDoc: `/api/redoc`
- OpenAPI JSON: `/api/openapi.json`
