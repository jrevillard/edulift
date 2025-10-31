# EduLift Deployment

This directory contains the deployment infrastructure for EduLift.

## 📂 Directory Structure

- **`ansible/`** - Ansible-based deployment for Ubuntu servers with Docker, Traefik, and systemd
- **`production/`** - Legacy production-specific configurations (deprecated, use ansible/)

## 🚀 Quick Start

For deploying EduLift to production or staging environments, see the **[Ansible Deployment Guide](./ansible/README.md)**.

The Ansible-based deployment provides:
- ✅ Automated deployment to Ubuntu servers
- ✅ Docker and Docker Compose setup
- ✅ Traefik reverse proxy with automatic SSL (Let's Encrypt)
- ✅ Multi-environment support (production and staging on same VM)
- ✅ Systemd service management
- ✅ Automated database backups
- ✅ Firewall configuration
- ✅ Flexible URL routing (path-based or subdomain-based)

## 📖 Documentation

All deployment documentation is in **[ansible/README.md](./ansible/README.md)**.

For CI/CD pipeline information, see the root **[README-CI-CD.md](../README-CI-CD.md)**.
