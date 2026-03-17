#!/usr/bin/env python3
"""
Generate event constants from AsyncAPI specification.
This script reads the AsyncAPI YAML and generates event name constants.
"""

import re
import sys

ASYNCAPI_FILE = "docs/asyncapi/asyncapi.yaml"
OUTPUT_FILE = "../shared-types/asyncapi/events.ts"

print("🔧 Generating event constants from AsyncAPI specification...")

with open(ASYNCAPI_FILE, 'r') as f:
    content = f.read()

# Extract channels section (from "channels:" to next top-level key)
lines = content.split('\n')
in_channels = False
channels_lines = []

for line in lines:
    if line.startswith('channels:'):
        in_channels = True
        continue
    if in_channels:
        # Stop at next top-level key (not indented)
        if line and not line.startswith(' ') and not line.startswith('\t'):
            break
        channels_lines.append(line)

channels_section = '\n'.join(channels_lines)

# Find all channel names (lines starting with lowercase and ending with :)
# Match: "  group:created:" -> "group:created:"
channel_pattern = re.compile(r'^  ([a-z].+:)$', re.MULTILINE)
channels = channel_pattern.findall(channels_section)

# Generate TypeScript file
with open(OUTPUT_FILE, 'w') as f:
    f.write('''/**
 * Shared WebSocket Event Constants
 *
 * AUTO-GENERATED from docs/asyncapi/asyncapi.yaml
 * Regenerate with: npm run asyncapi:generate-types
 */

export const SOCKET_EVENTS = {
''')

    for channel in sorted(channels):
        # Convert channel:name to CHANNEL_NAME format
        # Replace both : and - with _ for valid JavaScript identifiers
        # Also add underscores before uppercase letters for better readability
        # e.g., "scheduleSlot:capacity:full" -> "SCHEDULE_SLOT_CAPACITY_FULL"
        channel_name = channel.rstrip(':')

        # First convert : to _
        constant_name = channel_name.replace(':', '_').replace('-', '_')

        # Then add underscores before uppercase letters (except first char)
        # scheduleSlot_capacity_full -> SCHEDULE_SLOT_CAPACITY_FULL
        constant_name = ''.join(['_' + c if c.isupper() and i > 0 and constant_name[i-1] != '_' else c
                                   for i, c in enumerate(constant_name)]).upper()

        f.write(f"  {constant_name}: '{channel_name}',\n")

    f.write('''} as const;

// Type for event names
export type SocketEventName = typeof SOCKET_EVENTS[keyof typeof SOCKET_EVENTS];
''')

print(f"✅ Generated event constants in {OUTPUT_FILE}")
print(f"📋 Found {len(channels)} channels")
