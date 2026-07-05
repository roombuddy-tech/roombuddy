#!/bin/sh
set -e

echo "Installing Pods"
cd "$CI_PRIMARY_REPOSITORY_PATH/frontend/ios"
pod install
