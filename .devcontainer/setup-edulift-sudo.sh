#!/bin/bash

# EduLift DevContainer Setup Script
# Installs all E2E testing dependencies with root privileges

set -e

echo "🚀 Starting EduLift DevContainer setup..."

# Update package lists
echo "📦 Updating package lists..."
sudo apt-get update

echo "🎭 Installing Playwright browsers system dependencies..."
# This is the key command that requires root access
sudo npx --yes playwright install-deps

# Clean up package cache
echo "🧹 Cleaning up package cache..."
sudo apt-get autoremove -y
sudo apt-get autoclean

# Set up proper permissions
echo "🔒 Setting up permissions..."
sudo chown -R node:node /workspace
sudo chown -R node:node /home/node

# Create Playwright cache directory with proper permissions
sudo mkdir -p /ms-playwright
sudo chown -R node:node /ms-playwright

# Configure IPv4-first for Docker-outside-of-Docker networking
echo "🌐 Configuring IPv4-first networking for DooD..."
# Set gai.conf to prefer IPv4
echo "precedence ::ffff:0:0/96  100" | sudo tee -a /etc/gai.conf
