#!/bin/bash

# Vectoria Auto-Archiver
# Usage: ./scripts/archive_plan.sh <filename>

FILE=$1
ARCHIVE_DIR="archive"

if [ -z "$FILE" ]; then
  echo "❌ Error: No filename provided."
  echo "Usage: npm run archive <filename>"
  exit 1
fi

if [ ! -f "$FILE" ]; then
  echo "❌ Error: File '$FILE' not found in root."
  exit 1
fi

# Create archive dir if not exists
mkdir -p "$ARCHIVE_DIR"

# Move the file
mv "$FILE" "$ARCHIVE_DIR/"

echo "✅ Archived '$FILE' to '$ARCHIVE_DIR/'."
