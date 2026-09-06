variable "cloud_provider" {
  description = "Cloud provider to deploy VPS to"
  type        = string
  default     = "aws"
  validation {
    condition     = can(regex("^(aws|gcp|digitalocean|azure)$", var.cloud_provider))
    error_message = "cloud_provider must be one of: aws, gcp, digitalocean, azure"
  }
}

variable "aws_region" {
  description = "AWS region for the VPS"
  type        = string
  default     = "us-east-1"
}

variable "aws_instance_type" {
  description = "AWS EC2 instance type"
  type        = string
  default     = "t3.medium"
}

variable "aws_instance_size" {
  description = "AWS EC2 instance size in GB"
  type        = number
  default     = 256
}

variable "gcp_project_id" {
  description = "GCP project ID"
  type        = string
  default     = ""
}

variable "gcp_region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

variable "gcp_machine_type" {
  description = "GCP machine type"
  type        = string
  default     = "e2-medium"
}

variable "digitalocean_token" {
  description = "DigitalOcean API token"
  type        = string
  sensitive   = true
  default     = ""
}

variable "digitalocean_region" {
  description = "DigitalOcean region"
  type        = string
  default     = "nyc3"
}

variable "digitalocean_size" {
  description = "DigitalOcean droplet size"
  type        = string
  default     = "s-2vcpu-2gb"
}

variable "vps_username" {
  description = "SSH username for the VPS"
  type        = string
  default     = "ubuntu"
}

variable "vps_ssh_port" {
  description = "SSH port for the VPS"
  type        = number
  default     = 22
}

variable "dokploy_project_name" {
  description = "Name of the Dokploy project"
  type        = string
  default     = "turquoise"
}

variable "dokploy_project_key" {
  description = "Key for the Dokploy project"
  type        = string
  default     = "turquoise"
}

variable "dokploy_project_description" {
  description = "Description of the Dokploy project"
  type        = string
  default     = "Turquoise Ecosystem - Model Marketplace"
}
