#!/usr/bin/env bash
#
# Usage: proton emulators
#
# Starts the Firebase emulators of the project in the current directory, on the ports its own
# firebase.json declares, so two projects with distinct port blocks can run side by side.
#
#   EMULATORS       which ones to start (default functions,firestore,auth,storage)
#   EMULATOR_DATA   a directory to keep the emulators' data in between runs: exported there on
#                   exit and imported from it on the next start. Unset, every run starts empty.

set -eux

port() { node -p "require('./firebase.json').emulators?.$1?.port ?? $2"; }

export FIREBASE_AUTH_EMULATOR_HOST="127.0.0.1:$(port auth 9099)"

export FIRESTORE_EMULATOR_HOST="localhost:$(port firestore 8080)"

export FIREBASE_STORAGE_EMULATOR_HOST="127.0.0.1:$(port storage 9199)"

args=(--only="${EMULATORS:-functions,firestore,auth,storage}")
if [ -n "${EMULATOR_DATA:-}" ]; then
  [ -f "$EMULATOR_DATA/firebase-export-metadata.json" ] && args+=(--import="$EMULATOR_DATA")
  args+=(--export-on-exit="$EMULATOR_DATA")
fi

exec firebase emulators:start "${args[@]}"
