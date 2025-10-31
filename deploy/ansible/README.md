# EduLift Ansible Deployment

Automated deployment of EduLift on Ubuntu servers using Ansible with support for multiple environments on the same VM.

## 📋 Prerequisites

### On Your Control Machine

1. **Ansible installed** (version 2.10+):
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install ansible

# macOS
brew install ansible

# Python pip
pip install ansible
```

2. **SSH access** to target server(s) with sudo privileges

3. **Ansible collections**:
```bash
cd ansible
ansible-galaxy install -r requirements.yml
```

### On Target Server(s)

- Ubuntu 20.04 or 22.04
- SSH access with public key authentication
- User with sudo privileges

## 🚀 Quick Start

### 1. Configure Inventory

Create separate encrypted inventory files for each environment:

```bash
cd ansible
```

**Production Inventory:**
```bash
# Create and edit production inventory
nano inventory-production.ini
```

```ini
[production]
transport-server ansible_host=YOUR_SERVER_IP ansible_user=ubuntu env=production

[edulift_servers:children]
production
```

**Staging Inventory:**
```bash
# Create and edit staging inventory
nano inventory-staging.ini
```

```ini
[staging]
transport-server ansible_host=YOUR_SERVER_IP ansible_user=ubuntu env=staging

[edulift_servers:children]
staging
```

### 2. Encrypt Inventory Files

**IMPORTANT:** Encrypt both inventory files with different vault passwords:

```bash
# Encrypt production inventory (PROD vault password)
ansible-vault encrypt inventory-production.ini

# Encrypt staging inventory (STAGING vault password)
ansible-vault encrypt inventory-staging.ini

# To edit later:
ansible-vault edit inventory-production.ini  # Uses PROD password
ansible-vault edit inventory-staging.ini       # Uses STAGING password
```

### 3. Configure Environment Variables

Edit the configuration files for each environment:

```bash
# For production
nano group_vars/production.yml

# For staging
nano group_vars/staging.yml
```

**Key configuration in production.yml:**
```yaml
edulift_deployment:
  domain: "your-domain.com"
  protocol: "https"
  pull_images: true
  backup:
    enabled: true
    minute: "0"
    hour: "2"
    retention_days: 30
```

### 4. Test Connection

```bash
# Test production environment
ansible -i inventory-production.ini production -m ping

# Test staging environment
ansible -i inventory-staging.ini staging -m ping

# Alternative: Test specific server
ansible -i inventory-production.ini transport-server -m ping
ansible -i inventory-staging.ini transport-server -m ping
```

### 5. Deploy

```bash
# Deploy production only
ansible-playbook -i inventory-production.ini deploy.yml --ask-vault-pass

# Deploy staging only
ansible-playbook -i inventory-staging.ini deploy.yml --ask-vault-pass

# Dry run production (check mode)
ansible-playbook -i inventory-production.ini deploy.yml --check --ask-vault-pass

# Verbose staging deployment
ansible-playbook -i inventory-staging.ini deploy.yml -v --ask-vault-pass

# Using vault password file
ansible-playbook -i inventory-production.ini deploy.yml --vault-password-file ~/.ansible_prod_pass
ansible-playbook -i inventory-staging.ini deploy.yml --vault-password-file ~/.ansible_staging_pass
```

## 🏗️ Multi-Environment Architecture

When deploying multiple environments on the same VM, each environment is completely isolated:

### Environment Isolation

**Production:**
- Install directory: `/opt/edulift-production`
- User/Group: `edulift-production`
- Systemd service: `edulift-production.service`
- Docker project: `edulift-production`
- Containers: `edulift-production-backend`, `edulift-production-postgres`, etc.
- Domain: `your-domain.com`

**Staging:**
- Install directory: `/opt/edulift-staging`
- User/Group: `edulift-staging`
- Systemd service: `edulift-staging.service`
- Docker project: `edulift-staging`
- Containers: `edulift-staging-backend`, `edulift-staging-postgres`, etc.
- Domain: `staging.your-domain.com`

### Managing Multiple Environments

```bash
# Check status
sudo systemctl status edulift-production
sudo systemctl status edulift-staging

# View logs
sudo journalctl -u edulift-production -f
sudo journalctl -u edulift-staging -f

# Restart services
sudo systemctl restart edulift-production
sudo systemctl restart edulift-staging

# Check containers
docker ps | grep edulift-production
docker ps | grep edulift-staging
```

## 📁 Directory Structure

```
ansible/
├── deploy.yml                      # Main Ansible playbook
├── inventory.example              # Example inventory file
├── group_vars/                    # Environment-specific variables
│   ├── production.yml            # Production configuration
│   └── staging.yml               # Staging configuration
├── templates/                     # Jinja2 templates
│   ├── _url_macros.j2            # URL parsing macros
│   ├── docker-compose.yml.j2     # Docker Compose template
│   ├── env.j2                    # Environment variables template
│   ├── backup.sh.j2              # Backup script template
│   └── edulift.service.j2        # Systemd service template
└── README.md                      # This file
```

## ⚙️ Configuration

### Group Variables Structure

The configuration is organized in nested structures for clarity:

```yaml
# Main deployment settings
edulift_deployment:
  domain: "your-domain.com"
  protocol: "https"
  pull_images: true
  backup:
    enabled: true
    minute: "0"
    hour: "2"
    retention_days: 30

# Docker image versions
docker_images:
  traefik: "docker.io/traefik:v3.2"
  postgres: "docker.io/postgres:15-alpine"
  redis: "docker.io/redis:7-alpine"
  backend: "your-registry/edulift-backend:1.0.0"
  frontend: "your-registry/edulift-frontend:1.0.0"

# Service-specific settings
edulift_services:
  traefik:
    log_level: "INFO"
    resources:
      limits:
        memory: "256M"
  backend:
    port: 3001
    resources:
      limits:
        memory: "512M"
  # ... other services

# Database and Redis credentials
postgres_db: edulift
postgres_user: edulift
postgres_password: "secure_password"

redis_password: "secure_redis_password"

# Application secrets
jwt_secret: "secure_jwt_secret"
jwt_access_secret: "secure_access_secret"
jwt_refresh_secret: "secure_refresh_secret"

# Email configuration
email_host: "smtp.example.com"
email_port: 587
email_user: "noreply@example.com"
email_password: "email_password"
email_from: "EduLift <noreply@example.com>"

# Firebase configuration
firebase_project_id: "your-firebase-project"
firebase_client_email: "firebase-service-account@your-project.iam.gserviceaccount.com"
firebase_private_key: |
  -----BEGIN PRIVATE KEY-----
  Your Firebase private key here
  -----END PRIVATE KEY-----
```

## 🌐 URL Configuration

### Overview

EduLift supports flexible URL routing for different deployment scenarios:
- **Path-based routing** (default): All services on same domain with different paths
- **Subdomain-based routing**: Services on different subdomains
- **Mixed routing**: Combination of both approaches
- **Multi-origin CORS**: Support for multiple frontend origins (web, mobile apps)

### Default Configuration (Path-Based)

The simplest configuration uses a single domain with path-based routing:

```yaml
# group_vars/production.yml
edulift_deployment:
  domain: "your-domain.com"
  protocol: "https"
```

This automatically configures:
- Frontend: `https://your-domain.com/`
- Backend API: `https://your-domain.com/api`
- Traefik Dashboard: `https://your-domain.com/traefik`
- CORS: `https://your-domain.com`

**DNS Requirements:** Only one A record needed:
```
your-domain.com    A    <server-ip>
```

### Subdomain-Based Routing

Override specific services to use subdomains:

```yaml
# group_vars/production.yml
edulift_deployment:
  domain: "your-domain.com"
  protocol: "https"
  urls:
    frontend: "https://app.your-domain.com"
    backend: "https://api.your-domain.com"
    traefik_dashboard: "https://admin.your-domain.com"
```

**DNS Requirements:** One A record per subdomain:
```
app.your-domain.com      A    <server-ip>
api.your-domain.com      A    <server-ip>
admin.your-domain.com    A    <server-ip>
```

### Mixed Routing

Combine path-based and subdomain routing:

```yaml
# group_vars/production.yml
edulift_deployment:
  domain: "your-domain.com"
  protocol: "https"
  urls:
    frontend: null  # Uses default: https://your-domain.com/
    backend: "https://api.your-domain.com"
    traefik_dashboard: null  # Uses default: https://your-domain.com/traefik
```

### Multiple CORS Origins

For mobile apps or multiple frontends:

```yaml
# group_vars/production.yml
edulift_deployment:
  domain: "your-domain.com"
  protocol: "https"
  cors_origins:
    - "https://your-domain.com"
    - "https://app.your-domain.com"
    - "capacitor://localhost"      # Capacitor mobile app
    - "ionic://localhost"           # Ionic mobile app
```

### URL Configuration Reference

All URL configuration is in the `edulift_deployment` section of group_vars:

```yaml
edulift_deployment:
  # Base domain (required)
  domain: "your-domain.com"

  # Protocol (optional, defaults to "https")
  protocol: "https"

  # Service URLs (optional, null = use defaults)
  urls:
    frontend: null              # Default: https://domain/
    backend: null               # Default: https://domain/api
    traefik_dashboard: null     # Default: https://domain/traefik

  # CORS origins (optional, null = use frontend URL)
  cors_origins: null
```

### How It Works

The deployment uses Jinja2 macros to parse URLs and generate Traefik routing rules:

- **Path-based URLs** (e.g., `https://domain.com/api`) → Traefik rule: `Host(domain.com) && PathPrefix(/api)`
- **Subdomain URLs** (e.g., `https://api.domain.com`) → Traefik rule: `Host(api.domain.com)`
- **Path stripping** is automatic for path-based routing

All URL parsing logic is in `templates/_url_macros.j2`.

## 🔧 Playbook Features

The playbook automatically:

1. **System Setup**
   - Updates system packages
   - Installs required dependencies
   - Configures firewall (UFW)

2. **Docker Installation**
   - Adds Docker repository
   - Installs Docker CE and Compose plugin
   - Starts and enables Docker service

3. **User Management**
   - Creates environment-specific user and group
   - Adds user to docker group

4. **Application Deployment**
   - Creates environment-specific directory structure
   - Generates docker-compose.yml from template
   - Generates environment variables from template
   - Deploys environment configuration
   - Pulls Docker images with environment-specific project names

5. **Systemd Service**
   - Installs environment-specific systemd service
   - Enables auto-start on boot
   - Starts the service

6. **Backup Setup**
   - Creates backup script
   - Configures daily cron job (configurable per environment)
   - Sets up log rotation

7. **Security**
   - Configures firewall (SSH, HTTP, HTTPS only)
   - Sets proper file permissions
   - Restricts environment file access

**Note:** The playbook generates deployment files from templates. No git repository is cloned on the production server.

## 🔒 Security Best Practices

### 1. Use Ansible Vault for secrets

**Separate vault passwords for each environment:**

```bash
# Encrypt production configuration with PROD vault password
ansible-vault encrypt group_vars/production.yml

# Encrypt staging configuration with STAGING vault password
ansible-vault encrypt group_vars/staging.yml

# Encrypt production inventory with PROD vault password
ansible-vault encrypt inventory-production.ini

# Encrypt staging inventory with STAGING vault password
ansible-vault encrypt inventory-staging.ini
```

**Store vault passwords securely:**
```bash
# Create secure password files
chmod 600 ~/.ansible_prod_pass    # Production vault password
chmod 600 ~/.ansible_staging_pass # Staging vault password

# Or use password manager
```

### 2. Generate strong passwords

For sensitive values, use cryptographically secure passwords:

```bash
# Generate 48-character password (for database, redis, email)
openssl rand -base64 36 | tr -d '\n'

# Generate 64-character password (for JWT secrets)
openssl rand -base64 48 | tr -d '\n'
```

### 3. Generate Traefik authentication

```bash
# Generate htpasswd hash for Traefik dashboard
docker run --rm httpd:alpine htpasswd -nb admin your-password
# Output format: admin:$$apr1$salt$$hash
```

### 4. Use SSH keys instead of passwords

### 5. Limit inventory file permissions

```bash
chmod 600 inventory
```

### 6. Keep vault passwords secure

Store vault passwords in a password manager or secure location, never in version control.

```bash
# Recommended directory structure
ansible/
├── inventory-production.ini    # Encrypted with PROD vault password
├── inventory-staging.ini       # Encrypted with STAGING vault password
├── group_vars/
│   ├── production.yml          # Encrypted with PROD vault password
│   └── staging.yml             # Encrypted with STAGING vault password
└── .gitignore                  # Protects unencrypted files
```

## 🔄 Update Deployment

### Update Specific Environment

```bash
# Update production only
ansible-playbook -i inventory-production.ini deploy.yml --ask-vault-pass

# Update staging only
ansible-playbook -i inventory-staging.ini deploy.yml --ask-vault-pass
```

### Update Configuration Only

```bash
# 1. Modify production configuration
ansible-vault edit group_vars/production.yml  # Uses PROD vault password

# 2. Re-run production playbook
ansible-playbook -i inventory-production.ini deploy.yml --ask-vault-pass

# 3. For staging
ansible-vault edit group_vars/staging.yml   # Uses STAGING vault password
ansible-playbook -i inventory-staging.ini deploy.yml --ask-vault-pass
```

## 🛠️ Maintenance Tasks

### Check Current Status

```bash
# Check production service status
ansible -i inventory-production.ini production -m shell -a "systemctl status edulift-production" --become

# Check staging service status
ansible -i inventory-staging.ini staging -m shell -a "systemctl status edulift-staging" --become

# Check production Docker containers
ansible -i inventory-production.ini production -m shell -a "docker ps | grep edulift-production" --become

# Check staging Docker containers
ansible -i inventory-staging.ini staging -m shell -a "docker ps | grep edulift-staging" --become
```

### Restart Services

```bash
# Restart production
ansible -i inventory-production.ini production -m systemd -a "name=edulift-production state=restarted" --become

# Restart staging
ansible -i inventory-staging.ini staging -m systemd -a "name=edulift-staging state=restarted" --become
```

### View Logs

```bash
# View service logs
ansible production -m shell -a "journalctl -u edulift-production -f" --become
ansible staging -m shell -a "journalctl -u edulift-staging -f" --become

# View Docker logs
ansible production -m shell -a "docker logs edulift-production-backend" --become
```

### Manual Backup

```bash
# Trigger manual backup
ansible production -m shell -a "/opt/edulift-production/backup.sh" --become
ansible staging -m shell -a "/opt/edulift-staging/backup.sh" --become
```

## 🆘 Troubleshooting

### Connection Issues

```bash
# Test SSH connection
ssh ubuntu@your-server-ip

# Verbose Ansible connection test
ansible edulift_servers -m ping -vvv
```

### Playbook Fails

```bash
# Run with verbose output
ansible-playbook deploy.yml --limit production -vvv

# Check syntax
ansible-playbook deploy.yml --syntax-check

# Dry run
ansible-playbook deploy.yml --check --limit production
```

### Service Not Starting

```bash
# Check service status on server
ansible production -m shell -a "systemctl status edulift-production" --become

# View service logs
ansible production -m shell -a "journalctl -u edulift-production -n 50" --become

# Check Docker logs
ansible production -m shell -a "docker compose -p edulift-production logs" --become
```

### SSL Certificate Issues

```bash
# Check Traefik logs for certificate issues
ansible production -m shell -a "docker logs edulift-production-traefik" --become

# Verify domain resolves correctly
dig +short your-domain.com
```

### Port Conflicts

If deploying multiple environments on the same VM, each environment uses:
- Different Docker project names
- Different container names
- Different directories
- Different systemd services

Traefik handles routing based on domains/paths, so no port conflicts occur.

## 📚 Examples

### Deploy production and staging on same VM

```bash
# Setup inventory
cat > inventory << 'EOL'
[production]
server ansible_host=10.0.0.100 ansible_user=ubuntu env=production

[staging]
server ansible_host=10.0.0.100 ansible_user=ubuntu env=staging

[edulift_servers:children]
production
staging
EOL

# Deploy both
ansible-playbook deploy.yml
```

### Deploy to separate VMs

```bash
# Setup inventory
cat > inventory << 'EOL'
[production]
prod-server ansible_host=10.0.0.100 ansible_user=ubuntu env=production

[staging]
stage-server ansible_host=10.0.0.101 ansible_user=ubuntu env=staging

[edulift_servers:children]
production
staging
EOL

# Deploy both
ansible-playbook deploy.yml
```

## 📞 Support

For issues with Ansible deployment:
- Check the troubleshooting section above
- Review Ansible logs with `-vvv` flag
- Verify all prerequisites are met
- Ensure all secrets are properly configured

## 🔄 Migration from Old Configuration

If migrating from an older version:
1. Backup your existing configuration
2. Update configuration files to use the new nested structure
3. Test deployment in staging first
4. Deploy to production after validation

The new configuration structure is backward compatible, but using the nested structure is recommended for clarity and maintainability.