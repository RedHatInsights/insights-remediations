#!/bin/bash

set -e

if [[ $(oc project -q) != remediations* ]]; then
    echo "unexpected project: $(oc project -q)"
    exit 1;
fi

for i in secrets/*.yaml; do
    echo "Updating $i"
    oc process -f $i --local --ignore-unknown-parameters NAMESPACE="$(oc project --short)" REDIS_PASS=${REDIS_PASS} CONTENT_SERVER_TOKEN=${CONTENT_SERVER_TOKEN} DB_PASS=${DB_PASS} | oc apply -f -
done;
