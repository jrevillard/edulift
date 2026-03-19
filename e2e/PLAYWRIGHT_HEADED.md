# Playwright Headed Mode - User Guide

## ⚠️ IMPORTANT: X11 Configuration Required (User Action)

To use Playwright in headed mode (visible browser for debugging), you must first authorize Docker containers to access the host's X server.

### Step 1: Enable X11 Access (YOU must do this on the host)

**The AI assistant CANNOT run this command** - it must be executed by you on your host machine.

Execute this command in your terminal **on the host** (outside the container):

```bash
xhost +local:docker
```

This command authorizes Docker containers to connect to the X server. The authorization persists until the host reboots.

### Why the AI Cannot Do This

- The `xhost` command must run on the **host machine**, not inside the devcontainer
- The AI assistant only has access to the **container environment**
- This is a security feature - X11 authorization requires explicit user consent

### Step 2: Use Playwright in Headed Mode

Once X11 access is enabled (by you, on the host):

```bash
cd e2e
npx playwright test --headed
```

### Troubleshooting

#### "Missing X server or $DISPLAY" after host reboot

The `xhost` permissions are reset after a host reboot.

**Solution:** Re-run `xhost +local:docker` on the host (you must do this).

### DevContainer Configuration

The devcontainer is configured with:
- X11 socket mount: `/tmp/.X11-unix`
- `DISPLAY` environment variable passed from host
- `xauth` package installed (for compatibility)
