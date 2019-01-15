#!/bin/bash

set -e

NAMESPACE=$(oc project -q)

if [[ $NAMESPACE != "buildfactory" ]]; then
    echo "unexpected project: $NAMESPACE"
    exit 1;
fi

helm template . | oc apply -f - | grep --color=auto -E 'configured|created|$'
