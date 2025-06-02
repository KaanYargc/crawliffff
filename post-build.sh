#!/bin/bash
# post-build.sh - Script to restore the original files after Netlify build

# Display what we're doing
echo "Restoring files after Netlify build..."

# Check if we're in the Netlify build environment
if [ "$NETLIFY" = "true" ]; then
  echo "Detected Netlify build environment"
  
  # Define the paths
  ACTUAL_ROUTE="src/app/api/leads/analyze-products/route.ts"
  BACKUP_ROUTE="src/app/api/leads/analyze-products/route.original.ts"
  
  # Check if the backup file exists
  if [ -f "$BACKUP_ROUTE" ]; then
    echo "Found backup of original route file"
    
    # Restore the original route file
    echo "Restoring original route file"
    cp "$BACKUP_ROUTE" "$ACTUAL_ROUTE"
    
    # Remove the backup file
    echo "Removing backup file"
    rm "$BACKUP_ROUTE"
    
    echo "Original route file restored successfully"
  else
    echo "No backup route file found at $BACKUP_ROUTE"
  fi
else
  echo "Not in Netlify build environment, skipping"
fi

echo "Post-build restoration completed"