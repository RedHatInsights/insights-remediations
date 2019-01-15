#!/bin/bash

DEV_TOKEN=$1;
PROD_TOKEN=$2;

skopeo copy --src-creds=jharting:$DEV_TOKEN --dest-creds=jharting:$PROD_TOKEN docker://registry.insights-dev.openshift.com/remediations-ci/remediations:latest docker://registry.insights.openshift.com/remediations-prod/remediations:latest
skopeo copy --src-creds=jharting:$DEV_TOKEN --dest-creds=jharting:$PROD_TOKEN docker://registry.insights-dev.openshift.com/remediations-ci/playbooks-cac:latest docker://registry.insights.openshift.com/remediations-prod/playbooks-cac:latest
