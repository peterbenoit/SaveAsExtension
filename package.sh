#!/bin/bash

# package.sh - zip up the Chrome extension package

# Variables
EXTENSION_NAME="SaveAsExtension"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_DIR="${SCRIPT_DIR}/package"

# Create package directory if it doesn't exist
mkdir -p "${PACKAGE_DIR}"

# Change to the script directory
cd "${SCRIPT_DIR}"

# Clean up any existing zip
if [ -f "${PACKAGE_DIR}/${EXTENSION_NAME}.zip" ]; then
  echo "Removing existing ${EXTENSION_NAME}.zip..."
  rm "${PACKAGE_DIR}/${EXTENSION_NAME}.zip"
fi

# Create the zip file, excluding unwanted files and directories
echo "Creating ${EXTENSION_NAME}.zip in package folder..."
zip -r "${PACKAGE_DIR}/${EXTENSION_NAME}.zip" . \
  -x "*.git*" \
  -x "*.DS_Store" \
  -x "*node_modules*" \
  -x "*docs*" \
  -x "*.vscode*" \
  -x "package.sh" \
  -x "README.md" \
  -x "package/*" \

# Check if zip was successful
if [ $? -eq 0 ]; then
  ZIP_SIZE=$(du -h "${PACKAGE_DIR}/${EXTENSION_NAME}.zip" | cut -f1)
  echo "Package created successfully: ${PACKAGE_DIR}/${EXTENSION_NAME}.zip (${ZIP_SIZE})"
else
  echo "Error creating zip package"
  exit 1
fi
