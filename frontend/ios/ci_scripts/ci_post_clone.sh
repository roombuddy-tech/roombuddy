#!/bin/sh
set -e

echo "Installing Node via Homebrew"
export HOMEBREW_NO_INSTALL_CLEANUP=1
export HOMEBREW_NO_AUTO_UPDATE=1
brew install node

echo "Creating .env from Xcode Cloud environment variables"
cd "$CI_PRIMARY_REPOSITORY_PATH/frontend"
echo "GOOGLE_MAPS_API_KEY_IOS=$GOOGLE_MAPS_API_KEY_IOS" > .env

echo "Installing JS dependencies"
npm ci

echo "Installing Pods"
cd ios
pod install
