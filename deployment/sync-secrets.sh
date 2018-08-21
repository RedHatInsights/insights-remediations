#!/bin/bash

set -e

if [[ $(oc project -q) != remediations* ]]; then
    echo "unexpected project: $(oc project -q)"
    exit 1;
fi

oc process -f secrets.yaml --local CONTENT_SERVER_TOKEN="${CONTENT_SERVER_TOKEN}" | oc apply -f -
