# Environment Variables Documentation

## Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `MONGO_URL` | MongoDB connection string | `mongodb://localhost:27017` |
| `DB_NAME` | Database name | `kaizen_life` |

## Optional Variables

### Server Configuration
| Variable | Description | Default |
|----------|-------------|---------|
| `ENVIRONMENT` | Environment name (development/production) | `development` |
| `REQUEST_TIMEOUT_SECONDS` | API request timeout | `60` |
| `ALLOWED_ORIGINS` | CORS allowed origins (comma-separated) | `http://localhost:3000` |

### MongoDB Connection Pool
| Variable | Description | Default |
|----------|-------------|---------|
| `MONGO_MAX_POOL_SIZE` | Maximum connections | `50` |
| `MONGO_MIN_POOL_SIZE` | Minimum connections | `10` |
| `MONGO_MAX_IDLE_TIME_MS` | Max idle time before closing | `30000` |
| `MONGO_WAIT_QUEUE_TIMEOUT_MS` | Queue timeout | `10000` |
| `MONGO_SERVER_SELECTION_TIMEOUT_MS` | Server selection timeout | `5000` |
| `MONGO_CONNECT_TIMEOUT_MS` | Connection timeout | `10000` |
| `MONGO_SOCKET_TIMEOUT_MS` | Socket timeout | `60000` |

### External Services
| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | OpenAI API key for AI features | Optional |
| `TAVILY_API_KEY` | Tavily API key for web search | Optional |
| `SENDGRID_API_KEY` | SendGrid API key for emails | Optional |
| `STRIPE_SECRET_KEY` | Stripe secret key for payments | Optional |

### Frontend
| Variable | Description | Default |
|----------|-------------|---------|
| `REACT_APP_BACKEND_URL` | Backend API URL | `http://localhost:8001/api` |

## Security Notes

1. Never commit `.env` files to version control
2. Use secrets management in production (e.g., Kubernetes Secrets, AWS Secrets Manager)
3. Rotate API keys regularly
4. Use separate keys for development and production

## Production Checklist

- [ ] Set `ENVIRONMENT=production`
- [ ] Configure proper `ALLOWED_ORIGINS` for your domain
- [ ] Set up MongoDB with authentication
- [ ] Configure all external service API keys
- [ ] Enable HTTPS at the ingress/load balancer level
