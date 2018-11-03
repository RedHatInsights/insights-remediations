#!/bin/bash

set -e

if [[ $(oc project -q) != remediations* ]]; then
    echo "unexpected project: $(oc project -q)"
    exit 1;
fi

for i in secrets/*.yaml; do
    echo "Updating $i"
    oc process -f $i --local --ignore-unknown-parameters -p NAMESPACE="$(oc project --short)" --param-file=./secrets.txt | oc apply -f -
done;
