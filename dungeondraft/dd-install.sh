#!/bin/bash
#
# Copies the generated pack file into the destination asset folder.
#

die() {
    echo $@
    exit 1
}

if [ -f .env ]
then
    . .env
else
    die "Unable to find .env file"
fi

RELEASE_PACK=$(echo $DEST_NAME | sed 's/-/_/g').dungeondraft_pack

if [ ! -f "releases/${RELEASE_PACK}" ]
then
    die "No pack file has been generated. Run install.sh to build it."
fi


cp -f "releases/${RELEASE_PACK}" "${INSTALL_PATH}"

