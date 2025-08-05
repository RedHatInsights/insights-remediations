#!/bin/bash

# RPMs
make generate-repo-file
make generate-rpms-in-yaml
make generate-rpm-lockfile

# JS
# N/A - Cachi2 handles this automatically
