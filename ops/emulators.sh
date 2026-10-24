#!/usr/bin/env bash
#
# Usage: ../proton/ops/emulators.sh
#
# Starts the Firebase emulators of the project in the current directory (functions, firestore, auth, storage).

set -x

export FIREBASE_AUTH_EMULATOR_HOST="127.0.0.1:9099"

export FIRESTORE_EMULATOR_HOST="localhost:8888"

export FIREBASE_STORAGE_EMULATOR_HOST="127.0.0.1:9199"

firebase emulators:start --only=functions,firestore,auth,storage # --import=./tmp --export-on-exit