#!/bin/bash

set -e

if [[ $(oc project -q) != remediations-pr ]]; then
    echo "unexpected project: $(oc project -q)"
    exit 1;
fi

for i in secrets/postgres.yaml configuration/postgres.yaml; do
    echo "Updating $i"
    oc process -f $i --local --ignore-unknown-parameters NAMESPACE="$(oc project --short)" DB_PASS="remediations" | oc apply -f -
done;
