# === PROVIDERS ===

terraform {
  required_version = ">= 1.0.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.30"
    }
    azure = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
    local = {
      source  = "hashicorp/local"
      version = "~> 2.0"
    }
    ssh = {
      source  = "vultraz/ssh"
      version = "~> 0.1"
    }
    null = {
      source  = "hashicorp/null"
      version = "~> 3.0"
    }
  }
}

# Conditional provider configuration
locals {
  provider_config = {
    aws = {
      region = var.aws_region
    }
    gcp = {
      project = var.gcp_project_id
      region  = var.gcp_region
    }
    digitalocean = {
      token = var.digitalocean_token
    }
    azure = {
      # Azure requires ARM_CLIENT_ID, ARM_CLIENT_SECRET, ARM_SUBSCRIPTION_ID
      # Set via environment variables:
      # export ARM_CLIENT_ID="your-client-id"
      # export ARM_CLIENT_SECRET="your-client-secret"
      # export ARM_TENANT_ID="your-tenant-id"
    }
  }
}
