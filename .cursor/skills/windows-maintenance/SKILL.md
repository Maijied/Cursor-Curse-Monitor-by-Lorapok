---
name: windows-maintenance
description: General Windows troubleshooting, cleanup, and repair steps for slow or unstable PCs.
---

# Windows Maintenance & Repair

Use this skill when the user asks to clean up a slow PC, fix general Windows instability, resolve network drops, or perform routine maintenance.

## 1. System File Corruption (Crashes, Blue Screens)
If Windows apps crash or the system feels unstable after an update:
1. Run Deployment Image Servicing and Management (DISM):
   `DISM /Online /Cleanup-Image /RestoreHealth`
2. Run System File Checker (SFC):
   `sfc /scannow`
3. Restart the PC.

## 2. Slow Startup / High RAM Usage
If the PC feels sluggish immediately after logging in:
* Check Task Manager (`Ctrl + Shift + Esc`) -> Startup apps. Disable unnecessary heavy applications.
* Sort Task Manager by Memory. Identify and close memory-leaking or unused background applications.

## 3. High Disk Usage (100% Active Time)
If the disk is maxed out and the PC freezes:
* Check Task Manager -> Disk column.
* Likely culprits: Windows Update, Windows Defender scans, or Search Indexing.
* Free up storage space and pause heavy sync tools (like OneDrive).

## 4. Network and DNS Issues
If the internet drops or websites fail to load:
* Flush the DNS resolver cache: `ipconfig /flushdns`
* Restart the network adapter or forget and reconnect to the Wi-Fi network.

## 5. Temporary Files and Clutter
If the C: drive is full:
* Use Settings > System > Storage to clear temporary files and the Recycle Bin.
* Enable Storage Sense for automatic cleanup.
