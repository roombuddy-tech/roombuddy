#!/bin/sh
set -e

echo "Installing CocoaPods"
export HOMEBREW_NO_INSTALL_CLEANUP=TRUE
brew install cocoapods

echo "Installing Pods"
cd "$CI_PRIMARY_REPOSITORY_PATH/frontend/ios"
pod install
