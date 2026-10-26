#!/usr/bin/env bash
#
# Usage: ../proton/ops/emulators.sh
#
# Starts the Firebase emulators of the project in the current directory (functions, firestore, auth, storage),
# on the ports its own firebase.json declares, so two projects with distinct port blocks can run side by side.

set -x

port() { node -p "require('./firebase.json').emulators?.$1?.port ?? $2"; }

export FIREBASE_AUTH_EMULATOR_HOST="127.0.0.1:$(port auth 9099)"

export FIRESTORE_EMULATOR_HOST="localhost:$(port firestore 8080)"

export FIREBASE_STORAGE_EMULATOR_HOST="127.0.0.1:$(port storage 9199)"

firebase emulators:start --only=functions,firestore,auth,storage # --import=./tmp --export-on-exit
