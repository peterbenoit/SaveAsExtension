#!/bin/bash

# package.sh - zip up the Chrome extension package

# Variables
EXTENSION_NAME="SaveAsExtension"
OUTPUT_DIR="${HOME}/GitHub"
WORKING_DIR="${OUTPUT_DIR}/${EXTENSION_NAME}"

# Change to the parent directory
cd "${OUTPUT_DIR}"

# Clean up any existing zip
if [ -f "${EXTENSION_NAME}.zip" ]; then
  echo "Removing existing ${EXTENSION_NAME}.zip..."
  rm "${EXTENSION_NAME}.zip"
fi

# Create the zip file, excluding unwanted files and directories
echo "Creating ${EXTENSION_NAME}.zip..."
zip -r "${EXTENSION_NAME}.zip" "${EXTENSION_NAME}" \
  -x "*.git*" \
  -x "*.DS_Store" \
  -x "*node_modules*" \
  -x "*.vscode*" \
  -x "*/package.sh" \
  -x "*/README.md" \

# Check if zip was successful
if [ $? -eq 0 ]; then
  ZIP_SIZE=$(du -h "${EXTENSION_NAME}.zip" | cut -f1)
  echo "Package created successfully: ${OUTPUT_DIR}/${EXTENSION_NAME}.zip (${ZIP_SIZE})"
else
  echo "Error creating zip package"
  exit 1
fi
