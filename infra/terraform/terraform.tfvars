# === INFRASTRUCTURE CONFIGURATION ===
# Edit this file to configure your VPS deployment

# Cloud Provider: aws | gcp | digitalocean | azure
cloud_provider = "aws"

# AWS Configuration
aws_region = "us-east-1"
aws_instance_type = "t3.medium"
aws_instance_size = 256
aws_instance_type = "t3.medium"

# GCP Configuration
gcp_project_id = ""
gcp_region = "us-central1"
gcp_machine_type = "e2-medium"

# DigitalOcean Configuration
digitalocean_token = ""
digitalocean_region = "nyc3"
digitalocean_size = "s-2vcpu-2gb"

# VPS Configuration
vps_username = "ubuntu"
vps_ssh_port = 22

# Dokploy Configuration
dokploy_project_name = "turquoise"
dokploy_project_key = "turquoise"
dokploy_project_description = "Turquoise Ecosystem - Model Marketplace"
