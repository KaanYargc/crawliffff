#!/bin/bash
# build-helper.sh - Script to prepare the codebase for Netlify build

# Display what we're doing
echo "Preparing codebase for Netlify build..."

# Check if we're in the Netlify build environment
if [ "$NETLIFY" = "true" ]; then
  echo "Detected Netlify build environment"
  
  # Define the paths
  BUILD_ROUTE="src/app/api/leads/analyze-products/route.build.ts"
  ACTUAL_ROUTE="src/app/api/leads/analyze-products/route.ts"
  BACKUP_ROUTE="src/app/api/leads/analyze-products/route.original.ts"
  
  # Check if the build-specific route file exists
  if [ -f "$BUILD_ROUTE" ]; then
    echo "Found build-specific route file"
    
    # Backup the original route file if not already backed up
    if [ ! -f "$BACKUP_ROUTE" ]; then
      echo "Backing up original route file"
      cp "$ACTUAL_ROUTE" "$BACKUP_ROUTE"
    fi
    
    # Replace the actual route with the build-specific one
    echo "Replacing route file with build-specific version"
    cp "$BUILD_ROUTE" "$ACTUAL_ROUTE"
    
    echo "Route file replaced successfully"
  else
    echo "Build-specific route file not found at $BUILD_ROUTE"
    exit 1
  fi
else
  echo "Not in Netlify build environment, skipping"
fi

echo "Build preparation completed"