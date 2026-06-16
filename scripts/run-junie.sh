#!/bin/bash

# Configuration
PROMPT="Continue working on the project task board."
CONFIG_FILE="/tmp/junie_config.json"
LOCK_FILE="/tmp/junie_lock"
LIMIT=$1
COUNT=0

# Create config file
cat <<EOF > "$CONFIG_FILE"
{
  "model": "gemini-3.1-flash-lite-preview",
  "flags": ["high-effort"]
}
EOF

# Function to run junie
run_junie() {
    echo "Starting Junie..."

    # Run junie
    junie --config-location "$CONFIG_FILE" "$PROMPT"
}

# The requirement "should launch a new instance on completion" suggests a loop.
while true; do
    if [ -n "$LIMIT" ] && [ "$COUNT" -ge "$LIMIT" ]; then
        echo "Reached iteration limit $LIMIT. Exiting."
        exit 0
    fi

    # Run junie with flock to ensure only one instance
    (
        flock -n 200 || { echo "Junie is already running"; exit 0; }

        run_junie

        echo "Junie finished. Restarting..."
    ) 200>"$LOCK_FILE"

    COUNT=$((COUNT+1))

    sleep 5
done
