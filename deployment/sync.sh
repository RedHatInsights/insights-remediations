#!/bin/bash

set -e

if [[ $(oc project -q) != remediations* ]]; then
    echo "unexpected project: $(oc project -q)"
    exit 1;
fi

for i in configuration/*.yaml; do
    echo "Updating $i"
    oc process -f $i --local --ignore-unknown-parameters NAMESPACE="$(oc project --short)" | oc apply -f -
done;
