# Default value for BASE_IMAGE
BASE_IMAGE ?= registry.access.redhat.com/ubi10/ubi-minimal:10.3-1795196920
# Default value for CONTAINERFILE
CONTAINERFILE ?= Dockerfile
# Lockfiles and ubi.repo are generated for x86_64; pin Podman so ARM hosts match
PLATFORM ?= linux/amd64

# Define AWK/SED based on platform (BSD sed on macOS needs an explicit -i '')
AWK = awk
SED_INPLACE = sed -i
ifeq ($(shell uname),Darwin)
AWK = gawk
SED_INPLACE = sed -i ''
endif

.PHONY: generate-repo-file
generate-repo-file:
	@podman run --rm --platform $(PLATFORM) $(BASE_IMAGE) cat /etc/yum.repos.d/ubi.repo > ubi.repo || { echo "Failed to fetch ubi.repo"; exit 1; }
	@$(SED_INPLACE) 's/ubi-10-appstream-source-rpms/ubi-10-for-x86_64-appstream-source-rpms/' ubi.repo
	@$(SED_INPLACE) 's/ubi-10-appstream-rpms/ubi-10-for-x86_64-appstream-rpms/' ubi.repo
	@$(SED_INPLACE) 's/ubi-10-baseos-source-rpms/ubi-10-for-x86_64-baseos-source-rpms/' ubi.repo
	@$(SED_INPLACE) 's/ubi-10-baseos-rpms/ubi-10-for-x86_64-baseos-rpms/' ubi.repo
	@$(SED_INPLACE) 's/\r$$//' ubi.repo
	@$(SED_INPLACE) '/\[.*x86_64.*\]/,/^\[/ s/enabled[[:space:]]*=[[:space:]]*0/enabled = 1/g' ubi.repo


# Generate rpms.in.yaml listing RPM packages installed via yum, dnf, or microdnf from CONTAINERFILE
# Usage: make generate-rpms-in-yaml [CONTAINERFILE=<path>]
# Example: make generate-rpms-in-yaml CONTAINERFILE=Containerfile
#          make generate-rpms-in-yaml (uses default CONTAINERFILE=Containerfile)
.PHONY: generate-rpms-in-yaml
generate-rpms-in-yaml:
	@if [ ! -f "$(CONTAINERFILE)" ]; then \
		exit 1; \
	fi
	@if ! command -v $(AWK) >/dev/null 2>&1; then \
		exit 1; \
	fi; \
	packages=$$(grep -E '^(RUN[[:space:]]+)?(.*[[:space:]]*(yum|dnf|microdnf)[[:space:]]+.*install.*)' "$(CONTAINERFILE)" | \
		sed -E 's/\\$$//' | \
		$(AWK) '{ \
			start=0; \
			for (i=1; i<=NF; i++) { \
				if ($$i == "install") { start=1; continue } \
				if (start && $$i ~ /^[a-zA-Z0-9][a-zA-Z0-9_.+-]*$$/ && \
					$$i !~ /^-/ && $$i != "&&" && $$i != "clean" && $$i != "all" && $$i != "upgrade") { \
					print $$i \
				} \
				if ($$i == "&&") { start=0 } \
			} \
		}' | sort -u); \
	if [ -z "$$packages" ]; then \
		exit 1; \
	else \
		echo "packages: [$$(echo "$$packages" | tr '\n' ',' | sed -E 's/,/, /g; s/, $$//')]" > rpms.in.yaml; \
		echo "contentOrigin:" >> rpms.in.yaml; \
		echo "  repofiles: [\"./ubi.repo\"]" >> rpms.in.yaml; \
		echo "arches: [x86_64]" >> rpms.in.yaml; \
	fi

# Generate rpms.lock.yaml using rpm-lockfile-prototype container
# Usage: make generate-rpm-lockfile [BASE_IMAGE=<image>]
# Example: make generate-rpm-lockfile BASE_IMAGE=registry.access.redhat.com/ubi10/ubi-minimal:10.3-1795196920
#          make generate-rpm-lockfile (uses default BASE_IMAGE)
.PHONY: generate-rpm-lockfile-containerized
generate-rpm-lockfile-containerized: rpms.in.yaml
	@curl -s https://raw.githubusercontent.com/konflux-ci/rpm-lockfile-prototype/refs/heads/main/Containerfile | \
	podman build --platform $(PLATFORM) -t localhost/rpm-lockfile-prototype -
	@container_dir=/work; \
	podman run --rm --platform $(PLATFORM) -v $${PWD}:$${container_dir}:Z localhost/rpm-lockfile-prototype:latest --outfile=$${container_dir}/rpms.lock.yaml --image $(BASE_IMAGE) $${container_dir}/rpms.in.yaml
	@if [ ! -f rpms.lock.yaml ]; then \
		echo "Error: rpms.lock.yaml was not generated"; \
		exit 1; \
	fi

# Generate rpms.lock.yaml using rpm-lockfile-prototype command
.PHONY: generate-rpm-lockfile
generate-rpm-lockfile: rpms.in.yaml
	# I think this is needed even though this is a Javascript project
	# python3 -m pip install --user https://github.com/konflux-ci/rpm-lockfile-prototype/archive/refs/heads/main.zip
	rpm-lockfile-prototype --image $(BASE_IMAGE) rpms.in.yaml
	@if [ ! -f rpms.lock.yaml ]; then \
		echo "Error: rpms.lock.yaml was not generated"; \
		exit 1; \
	fi
