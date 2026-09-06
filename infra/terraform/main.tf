# === MAIN TERRAFORM LOGIC ===

# =============================================================================
# VPS PROVISIONING (Conditional based on cloud_provider)
# =============================================================================

# --- AWS ---
locals {
  aws_instance_id = can(var.aws_region) ? aws_instance.main.id : null
}

resource "aws_instance" "main" {
  count = can(var.aws_region) ? 1 : 0

  ami           = data.aws_ami.amazon_linux_2_latest.id
  instance_type = var.aws_instance_type

  vpc_security_group_ids = [aws_security_group.allow_all.id]

  root_block_device {
    volume_size           = var.aws_instance_size
    volume_type           = "gp3"
    encrypted             = true
    delete_on_termination = true
  }

  tags = {
    Name        = "turquoise-vps"
    Environment = "production"
  }
}

data "aws_ami" "amazon_linux_2_latest" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["amzn2-ami-hvm-*-x86_64-gp3"]
  }
}

# --- GCP ---
locals {
  gcp_instance_id = can(var.gcp_project_id) ? google_compute_instance.main.id : null
}

resource "google_compute_instance" "main" {
  count = can(var.gcp_project_id) ? 1 : 0

  name         = "turquoise-vps"
  machine_type = var.gcp_machine_type
  zone         = "${var.gcp_region}-a"

  boot_disk {
    initialize_params {
      image = data.google_compute_image.debian_latest.self_link
      size  = 50
    }
  }

  network_interface {
    network = "default"
  }

  metadata = {
    ssh-keys = "${var.vps_username}@${local.vps_public_ip}: ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQD..."
  }

  tags = ["turquoise"]
}

data "google_compute_image" "debian_latest" {
  project = "debian-cloud"
  family  = "debian-11"
}

# --- DigitalOcean ---
locals {
  do_instance_id = can(var.digitalocean_token) ? digitalocean_droplet.main.id : null
}

resource "digitalocean_droplet" "main" {
  count = can(var.digitalocean_token) ? 1 : 0

  name    = "turquoise-vps"
  region  = var.digitalocean_region
  size    = var.digitalocean_size
  image   = "ubuntu-22-04-x64"

  tags = ["turquoise"]
}

# --- Azure ---
locals {
  azure_instance_id = can(var.azure_client_id) ? azurerm_linux_virtual_machine.main.id : null
}

# =============================================================================
# SSH CONNECTIVITY
# =============================================================================

resource "local_file" "ssh_config" {
  count = 1

  filename = "${path.module}/.ssh/config.d/turquoise-vps"

  content = <<EOT
Host turquoise-vps
  HostName ${local.vps_public_ip}
  User ${var.vps_username}
  Port ${var.vps_ssh_port}
  IdentityFile ~/.ssh/id_rsa
  StrictHostKeyChecking yes
  UserKnownHostsFile ~/.ssh/known_hosts
EOT
}

# =============================================================================
# DOKPLOY CONFIGURATION
# =============================================================================

# Store Dokploy configuration as state data
resource "null_resource" "dokploy_config" {
  triggers = {
    project_name = var.dokploy_project_name
    project_key  = var.dokploy_project_key
  }

  provisioner "local-exec" {
    command = <<-EOT
      echo "=== Dokploy Project Configuration ==="
      echo "Project: ${var.dokploy_project_name}"
      echo "Key:     ${var.dokploy_project_key}"
      echo "Description: ${var.dokploy_project_description}"

      # Check if Dokploy CLI is available
      if command -v dokploy &> /dev/null; then
        echo "Dokploy CLI found. Configuring project..."
        dokploy project create --name "${var.dokploy_project_name}" \
          --key "${var.dokploy_project_key}" \
          --description "${var.dokploy_project_description}"
      else
        echo "Dokploy CLI not found. Please install Dokploy CLI first."
        echo "  curl -fsSL https://get.dokploy.com | bash"
      fi
    EOT
  }

  depends_on = [
    aws_instance.main,
    google_compute_instance.main,
    digitalocean_droplet.main
  ]
}

# =============================================================================
# HELPER: Get VPS Public IP
# =============================================================================

data "http" "vps_public_ip" {
  url = var.cloud_provider == "aws" ? "http://169.254.169.254/latest/meta-data/public-ipv4" :
        var.cloud_provider == "gcp" ? "http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip" :
        var.cloud_provider == "azure" ? "http://169.254.169.254/metadata/instance/network/interface/0/ipv4/ipAddress/0/publicIPAddress?api-version=2020-06-01&format=text" :
        "http://169.254.169.254/latest/meta-data/public-ipv4"
}
