#!/bin/bash

# --------------------------------------------
# Options that must be configured by app owner
# --------------------------------------------
APP_NAME="remediations"  # name of app-sre "application" folder this component lives in
COMPONENT_NAME="remediations"  # name of app-sre "resourceTemplate" in deploy.yaml for this component
IMAGE="quay.io/cloudservices/insights-remediations"  

IQE_PLUGINS=""
IQE_MARKER_EXPRESSION=""
IQE_FILTER_EXPRESSION=""

# Install bonfire repo/initialize
CICD_URL=https://raw.githubusercontent.com/RedHatInsights/bonfire/master/cicd
curl -s $CICD_URL/bootstrap.sh > .cicd_bootstrap.sh && source .cicd_bootstrap.sh

source $CICD_ROOT/build.sh

# TODO: add unit testing here??
