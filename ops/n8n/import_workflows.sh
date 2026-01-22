#!/bin/bash
# set -e

CONTAINER_NAME="n8n-n8n-1"
WORKFLOW_DIR="ops/n8n/workflows"

echo "Checking if container $CONTAINER_NAME is running..."
if ! docker ps | grep -q "$CONTAINER_NAME"; then
    echo "Error: Container $CONTAINER_NAME is not running."
    exit 1
fi

echo "Found n8n container. Starting import..."

# List of workflows to import
WORKFLOWS=(
    "1_override_request.json"
    "2_override_approve.json"
    "3_incident_intake.json"
    "4_incident_ack.json"
    "5_evidence_generator.json"
)

for wf in "${WORKFLOWS[@]}"; do
    FILE_PATH="$WORKFLOW_DIR/$wf"
    if [ -f "$FILE_PATH" ]; then
        echo "---------------------------------------------------"
        echo "Importing $wf..."
        
        # Copy file to container temp
        docker cp "$FILE_PATH" "$CONTAINER_NAME:/tmp/$wf"
        
        # Run import command
        # n8n import:workflow --input=file.json
        docker exec -u node "$CONTAINER_NAME" n8n import:workflow --input="/tmp/$wf"
        
        # Cleanup
        docker exec "$CONTAINER_NAME" rm -f "/tmp/$wf" || echo "Warning: Could not remove temp file /tmp/$wf"
        
        echo "Successfully imported $wf"
    else
        echo "Warning: File $FILE_PATH not found!"
    fi
done

echo "---------------------------------------------------"
echo "All workflows imported."
echo "Please activate them in the n8n UI (http://localhost:5678) if they are not active by default."
