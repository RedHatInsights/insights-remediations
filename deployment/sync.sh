#!/bin/bash

set -e

NAMESPACE=$(oc project -q)

if [[ $NAMESPACE != remediations* || $NAMESPACE == "remediations-pr" ]]; then
    echo "unexpected project: $(oc project -q)"
    exit 1;
fi

HOSTNAME="${NAMESPACE}.5a9f.insights-dev.openshiftapps.com"
if [[ $NAMESPACE == "remediations-prod" ]]; then
    HOSTNAME="remediations.1b13.insights.openshiftapps.com"
fi

for i in configuration/*.yaml configuration/cac/*.yaml; do
    echo "Updating $i"
    oc process -f $i --local --ignore-unknown-parameters NAMESPACE="$(oc project --short)" HOSTNAME="$HOSTNAME" | oc apply -f -
done;
