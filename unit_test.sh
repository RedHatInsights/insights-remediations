#!/bin/bash

# The following are defined outside of this script:
# DOCKERFILE
# APP_ROOT

cd $APP_ROOT

API_IMAGE="local/remediations-test-${IMAGE_TAG}"
API_CONTAINER_NAME="remediations-test-${IMAGE_TAG}"

DB_IMAGE="quay.io/cloudservices/postgresql-rds:14"
DB_CONTAINER_NAME="remediations-db-${IMAGE_TAG}"

NETWORK="remediations-test-${IMAGE_TAG}"

# cleanup function to tidy up after the test run
function tidy_up {
  echo 'Tidying up...'

	podman rm -f $DB_CONTAINER_ID || true
	podman rm -f $API_CONTAINER_ID || true
	podman network rm -f $NETWORK || true

  podman rmi -f $API_IMAGE || true
  podman rmi -f $DB_IMAGE || true

  podman container prune --force || true
}

trap "tidy_up" EXIT SIGINT SIGTERM

#---------------------
# create test network
#---------------------
docker network create --driver bridge $NETWORK

if [ $? -ne 0 ]; then
	echo '====> FAILED creating test network'
	exit 1
fi

#--------------------
# start db container
#--------------------
podman pull $DB_IMAGE

DB_CONTAINER_ID=$(podman run -d \
	--name "${DB_CONTAINER_NAME}" \
	--network "${NETWORK}" \
	-e POSTGRESQL_USER="postgres_user" \
	-e POSTGRESQL_PASSWORD="remediations" \
	-e POSTGRESQL_DATABASE="remediations" \
	${DB_IMAGE} || echo "0")

if [[ "$DB_CONTAINER_ID" == "0" ]]; then
	echo "====> FAILED to start DB container"
	exit 1
fi

#-----------------------------------
# start remediations-test container
#-----------------------------------
podman build -f $DOCKERFILE --target test -t $API_IMAGE .

$API_CONTAINER_ID=$(podman run -d \
  --name "${API_CONTAINER_NAME}" \
  --network "${NETWORK}" \
  -e NODE_ENV="test" \
  -e DB_HOST="${DB_CONTAINER_NAME}" \
  $API_IMAGE \
  /bin/bash -c 'sleep infinity' || echo "0")

if [[ "$API_CONTAINER_ID" == "0" ]]; then
	echo "Failed to start api container"
	exit 1
fi

#-------------------------------------
# run remediations-tests in container
#-------------------------------------
podman exec $API_CONTAINER_ID /bin/bash -c 'npm run test:ci'
TEST_RESULT=$?

if [ $TEST_RESULT -ne 0 ]; then
	echo '====> unit tests FAILED'
	exit 1
fi

#----------------
# report results
#----------------
# TODO: add unittest-xml-reporting to rbac so that junit results can be parsed by jenkins
mkdir -p $WORKSPACE/artifacts
cat << EOF > $WORKSPACE/artifacts/junit-dummy.xml
<testsuite tests="1">
    <testcase classname="dummy" name="dummytest"/>
</testsuite>
EOF

echo '====> unit tests PASSED'

tidy_up
