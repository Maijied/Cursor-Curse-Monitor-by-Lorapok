---
name: pc-fix
description: Guides the user and runs automated scripts to recover DESKTOP-V59ITHK from the DisplayPort CEC sleep crash.
---

# PC Fix Workflow (DESKTOP-V59ITHK)

Use this skill when the user asks to "fix the PC", "run the pc fix", or recover DESKTOP-V59ITHK.

## 1. Context
The PC (`DESKTOP-V59ITHK` at `192.168.0.206`) suffers from a DisplayPort + CEC Sleep Crash that hangs the GPU and USB/PCIe controllers. Windows blocks remote NTLM auth for Microsoft Accounts, meaning remote access is initially locked out.

## 2. Assess Current State
Check if the PC is reachable. Run `/home/maizied/pc-fix/wait-for-pc.sh` or ping `192.168.0.206`.
* If **unreachable** or ports are blocked:
  1. Ask the user if the device is enrolled in Intune. If yes, direct them to use **Option D (Intune MDM Remote Remediation)** in `/home/maizied/pc-fix/updated-fix-plan.md` to push `/home/maizied/pc-fix/intune-remediation.ps1`.
  2. If Intune is not available or too slow, provide the user with the physical offline recovery steps from `/home/maizied/pc-fix/updated-fix-plan.md` (Option A, B, or C). Wait for them to complete it.
* If **reachable** (Port 3389 or 22 is open), proceed to automated remote fix.

## 3. Execute Remote Fix
Once the PC is accessible:
1. Connect via RDP using `/home/maizied/pc-fix/connect-rdp.sh` or SSH (`ssh maizied@192.168.0.206`).
2. Run the hardening script `/home/maizied/pc-fix/phase2-full-fix.ps1` to prevent future crashes (disables USB selective suspend, clears stale displays, enables SSH).
3. If NTLM/SMB access is available, use `/home/maizied/pc-fix/remote-fix.sh`.
