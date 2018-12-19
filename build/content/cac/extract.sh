#!/bin/bash
set -e

REVISION="${1:-972f5ac923fbc1e667326fc4c5c50ade3f8e70e2}"
echo "Fetching playbooks from rev. ${REVISION}"

curl -s -L "https://github.com/ComplianceAsCode/content/tarball/${REVISION}" --output - | tar xz

CONTENT=$(find ComplianceAsCode-content-*/linux_os/ -name 'shared.yml')

echo "Processing $(echo $CONTENT | wc -w) files"
mkdir playbooks

for i in $CONTENT; do
    NAME=$(echo $i | sed -e 's%^.*/\([a-z0-9_-]\+\)/ansible/shared.yml$%\1%');
    OUTPUT="./playbooks/${NAME}.yml"
    cp $i $OUTPUT
    echo "Created $OUTPUT"
done

echo "$REVISION" > playbooks/revision.txt

echo "Done saving playbooks for rev. ${REVISION}. Cleaning up"
rm -r ComplianceAsCode-content-*
