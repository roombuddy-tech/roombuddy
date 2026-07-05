#!/bin/sh
set -e

echo "Installing CocoaPods via gem"
sudo gem install cocoapods

echo "Installing Pods"
cd "$CI_PRIMARY_REPOSITORY_PATH/frontend/ios"
pod install
