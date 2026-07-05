#!/bin/sh
set -e

# Xcode Cloud runners ship with CocoaPods but not Node. Install Node via
# Homebrew (no sudo needed), install JS deps so the Expo/React Native Podfile
# can resolve its autolinking scripts, then install Pods.

echo "Installing Node via Homebrew"
export HOMEBREW_NO_INSTALL_CLEANUP=1
export HOMEBREW_NO_AUTO_UPDATE=1
brew install node

echo "Installing JS dependencies"
cd "$CI_PRIMARY_REPOSITORY_PATH/frontend"
npm ci

echo "Installing Pods"
cd ios
pod install
