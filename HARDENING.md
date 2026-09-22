# Pre-Launch Hardening Checklist

This document tracks security, operational, and performance hardening tasks that must be implemented before deploying the platform to any staging or production environment.

## Public Endpoints & Anti-Abuse
- [ ] **Rate-limit/spam-protect public order creation and correction endpoints before any real deployment.**
  - Scope: `POST /api/public/orders`, `POST /api/public/orders/correction/lookup`, and `POST /api/public/orders/correction`.
  - Recommended controls:
    - Express rate limiter (`express-rate-limit` with Redis or in-memory store for cluster setups).
    - CAPTCHA / bot protection (e.g., Cloudflare Turnstile or hCaptcha) on public forms.
    - IP / CIDR rate throttling on lookup attempts to prevent brute-force probing of tracking codes.

## Security & Authentication
- [ ] Review CORS policy origins and tighten from wildcard/dev defaults.
- [ ] Ensure JWT secrets and MongoDB credentials are appropriately managed via production secret management.
- [ ] Audit file upload size limits and MIME validation for public and admin file endpoints.

## Infrastructure & Monitoring
- [ ] Configure structured logging and error reporting (e.g., Winston / Sentry).
- [ ] Set up database indexing and connection pooling for production MongoDB.
